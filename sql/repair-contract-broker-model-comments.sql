-- 统一 users 表「平台与模特」合同字段 COMMENT（历史脚本可能仍为「经纪人与模特」）
-- 执行示例：
--   mysql --no-defaults --default-character-set=utf8mb4 -h HOST -u USER -p DB_NAME < sql/repair-contract-broker-model-comments.sql

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE users
  MODIFY COLUMN contract_broker_model_signed_at DATETIME NULL DEFAULT NULL
    COMMENT '平台与模特服务合同签署时间 broker_model，NULL=未签';

ALTER TABLE users
  MODIFY COLUMN contract_broker_model_signature_url VARCHAR(255) NULL DEFAULT NULL
    COMMENT '平台与模特合同手写签名图URL broker_model';
