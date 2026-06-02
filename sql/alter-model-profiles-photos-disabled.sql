-- 模特扩展：禁用用户端展示模卡/作品集/形象定位
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE model_profiles
  ADD COLUMN photos_disabled TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1=用户端不返回模卡/作品集/形象定位 0=正常展示'
    AFTER is_platform_featured;
