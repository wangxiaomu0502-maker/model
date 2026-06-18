-- 模特自行注册授权码
-- 执行示例：
-- mysql --default-character-set=utf8mb4 -u root -p xinglian < sql/create-model-registration-codes-table.sql

CREATE TABLE IF NOT EXISTS model_registration_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code CHAR(8) NOT NULL COMMENT '8位数字+字母授权码',
  used_by_user_id BIGINT UNSIGNED NULL COMMENT '使用该码注册的 user_id',
  used_at TIMESTAMP NULL DEFAULT NULL COMMENT '使用时间',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_model_registration_codes_code (code),
  KEY idx_model_registration_codes_used_at (used_at),
  KEY idx_model_registration_codes_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
