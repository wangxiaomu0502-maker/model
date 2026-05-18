-- users：三类合同签署时间（NULL=未签署）
-- 与 contract_templates.contract_kind 对齐：
--   platform_broker → contract_platform_broker_signed_at
--   platform_merchant → contract_platform_merchant_signed_at
--   broker_model → contract_broker_model_signed_at
--
-- 执行示例（本地 my.cnf 有问题时可加 --no-defaults）：
--   mysql --no-defaults --default-character-set=utf8mb4 -h HOST -P PORT -u USER -p DB_NAME < sql/alter-users-contract-signed-at.sql
--
-- 若某列已存在，对应那条 ALTER 会报错（Duplicate column），跳过或注释掉该行即可。

ALTER TABLE users
  ADD COLUMN contract_platform_broker_signed_at DATETIME NULL DEFAULT NULL
    COMMENT '平台与经纪人服务合同签署时间 platform_broker';

ALTER TABLE users
  ADD COLUMN contract_platform_merchant_signed_at DATETIME NULL DEFAULT NULL
    COMMENT '平台与商家服务合同签署时间 platform_merchant';

ALTER TABLE users
  ADD COLUMN contract_broker_model_signed_at DATETIME NULL DEFAULT NULL
    COMMENT '经纪人与模特合作协议签署时间 broker_model';
