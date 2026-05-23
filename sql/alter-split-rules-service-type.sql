ALTER TABLE platform_split_rules
  ADD COLUMN service_type ENUM('ordinary','agent') NOT NULL DEFAULT 'ordinary' COMMENT 'ordinary普通服务 agent代理服务(提供影棚)' AFTER id;

UPDATE platform_split_rules SET service_type = 'ordinary' WHERE id = 1;

INSERT IGNORE INTO platform_split_rules (
  id,
  service_type,
  platform_fee_rate_bp,
  model_share_bp,
  platform_share_of_fee_bp,
  agent_share_of_fee_bp,
  broker_share_of_fee_bp
)
SELECT
  2,
  'agent',
  platform_fee_rate_bp,
  model_share_bp,
  platform_share_of_fee_bp,
  agent_share_of_fee_bp,
  broker_share_of_fee_bp
FROM platform_split_rules
WHERE service_type = 'ordinary'
ORDER BY id
LIMIT 1;

ALTER TABLE platform_split_rules
  ADD UNIQUE KEY uk_platform_split_rules_service_type (service_type);
