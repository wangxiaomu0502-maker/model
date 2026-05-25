-- 平台与代理人合同（platform_agent）：代理人 role=4 签署
-- 执行示例：
--   mysql --no-defaults --default-character-set=utf8mb4 -h HOST -P PORT -u USER -p DB_NAME < sql/alter-users-contract-platform-agent.sql

ALTER TABLE users
  ADD COLUMN contract_platform_agent_signed_at DATETIME NULL DEFAULT NULL
    COMMENT '平台与代理人服务合同签署时间 platform_agent';

ALTER TABLE users
  ADD COLUMN contract_platform_agent_signature_url VARCHAR(255) NULL DEFAULT NULL
    COMMENT '平台与代理人合同手写签名图URL platform_agent'
    AFTER contract_platform_agent_signed_at;

INSERT IGNORE INTO contract_templates (contract_kind, title, content_html) VALUES
  ('platform_agent', '代理人平台入驻协议（线上版）', '');
