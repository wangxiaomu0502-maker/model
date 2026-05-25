-- 经纪人扩展：是否专业经纪人 + 经纪人证图片
-- 执行：mysql --default-character-set=utf8mb4 -h... -u... -p xinglian < sql/alter-broker-profiles-professional-license.sql

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE broker_profiles
  ADD COLUMN is_professional TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1=专业经纪人 0=兼职经纪人'
    AFTER real_name,
  ADD COLUMN broker_license_url VARCHAR(2048) NULL
    COMMENT '经纪人证图片 URL（专业经纪人）'
    AFTER is_professional;
