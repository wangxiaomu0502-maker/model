-- 分账：全局比例配置 + 订单分项字段（与 分账实现.txt 一致）
-- 请在业务低峰执行；若列已存在会报错，需跳过对应 ALTER。

-- 1) 平台分账比例（单行配置，id 固定为 1）
CREATE TABLE IF NOT EXISTS platform_split_rules (
  id TINYINT UNSIGNED PRIMARY KEY DEFAULT 1 COMMENT '固定单行',
  platform_fee_rate_bp SMALLINT UNSIGNED NOT NULL DEFAULT 1500 COMMENT '技术服务费 r，万分比，1500=15%',
  model_share_bp SMALLINT UNSIGNED NOT NULL DEFAULT 7000 COMMENT '可分配池模特 M，万分比',
  merchant_referrer_share_bp SMALLINT UNSIGNED NOT NULL DEFAULT 1500 COMMENT '商户推荐人 S，万分比',
  model_referrer_share_bp SMALLINT UNSIGNED NOT NULL DEFAULT 1500 COMMENT '模特推荐人 T，万分比',
  orphan_merchant_referrer_policy ENUM('to_platform', 'to_model') NOT NULL DEFAULT 'to_platform' COMMENT '无商户推荐人时 S 去向',
  orphan_model_referrer_policy ENUM('to_platform', 'to_model') NOT NULL DEFAULT 'to_platform' COMMENT '无模特推荐人时 T 去向',
  remark VARCHAR(500) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台分账比例（单行）；M+S+T=10000 由服务端校验';

INSERT INTO platform_split_rules (
  id,
  platform_fee_rate_bp,
  model_share_bp,
  merchant_referrer_share_bp,
  model_referrer_share_bp,
  orphan_merchant_referrer_policy,
  orphan_model_referrer_policy
)
VALUES (1, 1500, 7000, 1500, 1500, 'to_platform', 'to_platform')
ON DUPLICATE KEY UPDATE id = id;

-- 2) 订单表扩展（推荐人与分账结果）
ALTER TABLE orders
  ADD COLUMN merchant_referrer_user_id BIGINT UNSIGNED NULL COMMENT '商户推荐人 users.id' AFTER model_user_id,
  ADD COLUMN model_referrer_user_id BIGINT UNSIGNED NULL COMMENT '模特推荐人 users.id' AFTER merchant_referrer_user_id,
  ADD COLUMN model_income DECIMAL(10, 2) NULL COMMENT '模特分成(元)，订单完成后写入' AFTER payable_amount,
  ADD COLUMN merchant_referrer_income DECIMAL(10, 2) NULL COMMENT '商户推荐人分成(元)' AFTER model_income,
  ADD COLUMN model_referrer_income DECIMAL(10, 2) NULL COMMENT '模特推荐人分成(元)' AFTER merchant_referrer_income,
  ADD COLUMN split_config_snapshot JSON NULL COMMENT '分账比例与策略快照' AFTER model_referrer_income,
  ADD COLUMN split_calculated_at DATETIME NULL COMMENT '分账计算时间' AFTER split_config_snapshot;
