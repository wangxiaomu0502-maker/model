-- 将旧版仅上传展示图的图片 Banner 回填首图
-- mysql --default-character-set=utf8mb4 -u root -p xinglian < sql/alter-home-banners-backfill-cover.sql

UPDATE home_banners
   SET cover_url = image_url
 WHERE type = 'image'
   AND (cover_url IS NULL OR cover_url = '')
   AND image_url IS NOT NULL
   AND image_url <> '';
