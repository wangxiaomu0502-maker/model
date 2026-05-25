-- 模特扩展：标记是否由后管创建
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE model_profiles
  ADD COLUMN is_admin_created TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1=后管创建 0=用户端注册/自行完善'
    AFTER user_id;
