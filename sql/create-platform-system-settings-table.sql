CREATE TABLE IF NOT EXISTS platform_system_settings (
  setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO platform_system_settings (setting_key, setting_value)
VALUES ('merchant_order_enabled', '1')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
