-- 首页 Banner 配置表
-- mysql --default-character-set=utf8mb4 -u root -p xinglian < sql/create-home-banners-table.sql

CREATE TABLE IF NOT EXISTS home_banners (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type ENUM('image', 'video') NOT NULL COMMENT 'Banner 类型',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序，越小越靠前',
  image_url VARCHAR(1000) NULL COMMENT '图片类型展示图（详情页）',
  cover_url VARCHAR(1000) NULL COMMENT '首图（首页轮播）',
  video_url VARCHAR(1000) NULL COMMENT '视频类型视频地址（详情页）',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=启用 0=停用',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_home_banners_sort (enabled, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
