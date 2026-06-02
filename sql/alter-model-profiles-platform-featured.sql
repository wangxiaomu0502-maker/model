-- 模特扩展：平台优选/重点推荐标记
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE model_profiles
  ADD COLUMN is_platform_featured TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1=平台优选/重点推荐 0=普通模特'
    AFTER is_admin_created;
