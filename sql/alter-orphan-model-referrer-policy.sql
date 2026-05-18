-- 无商户推荐人时已有 orphan_merchant_referrer_policy；本脚本补齐「无模特推荐人」时 T 份额去向。
-- 若列已存在会报错，可跳过。

ALTER TABLE platform_split_rules
  ADD COLUMN orphan_model_referrer_policy ENUM('to_platform', 'to_model') NOT NULL DEFAULT 'to_platform'
    COMMENT '无模特推荐人时 T 去向'
    AFTER orphan_merchant_referrer_policy;
