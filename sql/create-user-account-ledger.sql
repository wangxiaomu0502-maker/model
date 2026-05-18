-- 用户账户流水 + 可提现余额（设计稿，与「后台手动分账」配套）
-- 执行前请确认 orders 已含 split-rules-and-order-split.sql 中的分账列。
-- 推荐：在 xinglian-server 目录执行 npm run migrate:user-account-ledger（使用 .env 连接库，等价于导入本文件）
-- 模特、商家（及推荐人）统一用 users.id；商家作为「付款方」的支出流水可选记入本表或仅保留在 orders 支付字段。

-- ---------------------------------------------------------------------------
-- 1) 账户流水：每一笔「入账/扣款/冻结/解冻」一条，便于对账与审计
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_account_ledger (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL COMMENT 'users.id，收款方或扣款方',
  amount DECIMAL(12, 2) NOT NULL COMMENT '正数入账、负数出账（元）',
  balance_after DECIMAL(14, 2) NULL COMMENT '可选：本笔后可用余额快照，便于逐笔核对',
  biz_type VARCHAR(32) NOT NULL COMMENT '业务类型，如 order_split_model / order_split_merchant_referrer / order_split_model_referrer / withdrawal / admin_adjust',
  order_id BIGINT UNSIGNED NULL COMMENT '关联订单，非订单类业务为空',
  idempotency_key VARCHAR(64) NOT NULL COMMENT '幂等键，防重复分账，如 ORDER_SPLIT:{orderId}:MODEL',
  title VARCHAR(128) NULL COMMENT '摘要，展示给用户端',
  remark VARCHAR(500) NULL COMMENT '备注',
  meta JSON NULL COMMENT '扩展：如 split_config_snapshot 摘要、管理员说明',
  admin_user_id BIGINT UNSIGNED NULL COMMENT '后台操作人 admin_users.id，系统任务为空',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_account_ledger_idempotency (idempotency_key),
  KEY idx_ledger_user_created (user_id, created_at DESC),
  KEY idx_ledger_order (order_id),
  CONSTRAINT fk_ledger_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_ledger_order FOREIGN KEY (order_id) REFERENCES orders (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户账户流水（分账入账、提现、调账等）';

-- ---------------------------------------------------------------------------
-- 2) 可用余额缓存（可选；也可由 SUM(amount) 派生，大流量时再上缓存表）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_account_balance (
  user_id BIGINT UNSIGNED PRIMARY KEY COMMENT 'users.id',
  available_yuan DECIMAL(14, 2) NOT NULL DEFAULT 0.00 COMMENT '可提现/可用余额（元）',
  frozen_yuan DECIMAL(14, 2) NOT NULL DEFAULT 0.00 COMMENT '冻结（元），预留提现审核等',
  version INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '乐观锁，更新余额时 version+1',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_balance_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户账户余额缓存；与 ledger 同事务更新';

-- ---------------------------------------------------------------------------
-- 3) 订单侧：分账状态（若仅用 split_calculated_at 非空表示「已分账」可跳过本段）
-- ---------------------------------------------------------------------------
-- ALTER TABLE orders
--   ADD COLUMN split_status TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0未分账 1已分账 2失败' AFTER split_calculated_at,
--   ADD KEY idx_orders_split_pending (order_status, split_status);
