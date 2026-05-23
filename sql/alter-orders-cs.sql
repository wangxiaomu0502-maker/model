-- 客服待处理订单：状态与时间节点
ALTER TABLE orders
  ADD COLUMN cs_status TINYINT UNSIGNED NULL DEFAULT NULL
    COMMENT 'NULL=未进客服队列 1待处理 2处理中 3已完成'
    AFTER remark,
  ADD COLUMN cs_queued_at DATETIME NULL COMMENT '进入客服队列时间（模特接单）'
    AFTER cs_status,
  ADD COLUMN cs_started_at DATETIME NULL COMMENT '客服开始处理时间'
    AFTER cs_queued_at,
  ADD COLUMN cs_completed_at DATETIME NULL COMMENT '客服处理完成时间'
    AFTER cs_started_at,
  ADD COLUMN cs_handler_admin_id BIGINT UNSIGNED NULL COMMENT '当前/最后处理客服 admin_users.id'
    AFTER cs_completed_at;

CREATE INDEX idx_orders_cs_status ON orders (cs_status, cs_queued_at DESC);

CREATE TABLE IF NOT EXISTS order_cs_notes (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL COMMENT 'orders.id',
  admin_user_id BIGINT UNSIGNED NOT NULL COMMENT 'admin_users.id',
  content VARCHAR(2000) NOT NULL COMMENT '备注内容',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_cs_notes_order (order_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客服订单备注';

-- 历史已接单订单补进待处理队列
UPDATE orders
SET cs_status = 1,
    cs_queued_at = COALESCE(cs_queued_at, updated_at, created_at)
WHERE order_status IN (2, 3, 4)
  AND cs_status IS NULL;
