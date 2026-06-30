-- 平台维护模式开关与提示文案
-- mysql -u root -p xinglian < sql/alter-platform-system-settings-maintenance.sql

INSERT INTO platform_system_settings (setting_key, setting_value)
VALUES
  ('platform_maintenance_enabled', '0'),
  ('platform_maintenance_message', '系统维护中，请稍后再试')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
