-- 模特是否已激活（授权码激活后可上传模卡/风格定位/作品集）
-- 执行示例：
-- mysql --default-character-set=utf8mb4 -u root -p xinglian < sql/alter-model-profiles-is-activated.sql

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE model_profiles
  ADD COLUMN is_activated TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已激活（授权码）' AFTER is_admin_created;

-- 已有模特均视为已激活；此后新注册模特默认为 0，需授权码激活
UPDATE model_profiles SET is_activated = 1;
