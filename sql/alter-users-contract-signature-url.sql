-- users：四类合同手写签名图片 URL（COS）
-- 对应 contract_kind:
--   platform_broker  -> contract_platform_broker_signature_url
--   platform_merchant -> contract_platform_merchant_signature_url
--   broker_model -> contract_broker_model_signature_url（平台与模特）

ALTER TABLE users
  ADD COLUMN contract_platform_broker_signature_url VARCHAR(255) NULL DEFAULT NULL
    COMMENT '平台与经纪人合同手写签名图URL（platform_broker）'
    AFTER contract_platform_broker_signed_at;

ALTER TABLE users
  ADD COLUMN contract_platform_merchant_signature_url VARCHAR(255) NULL DEFAULT NULL
    COMMENT '平台与商家合同手写签名图URL（platform_merchant）'
    AFTER contract_platform_merchant_signed_at;

ALTER TABLE users
  ADD COLUMN contract_broker_model_signature_url VARCHAR(255) NULL DEFAULT NULL
    COMMENT '平台与模特合同手写签名图URL（broker_model）'
    AFTER contract_broker_model_signed_at;
