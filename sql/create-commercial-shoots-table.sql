-- 商拍中心需求表
-- 执行示例：
-- mysql --default-character-set=utf8mb4 -u root -p xinglian < sql/create-commercial-shoots-table.sql

CREATE TABLE IF NOT EXISTS commercial_shoots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL COMMENT '名称',
  province VARCHAR(64) NOT NULL COMMENT '省',
  city VARCHAR(64) NOT NULL COMMENT '市',
  district VARCHAR(64) NOT NULL COMMENT '区/县',
  detail_address VARCHAR(255) NOT NULL COMMENT '详细地址',
  contact_name VARCHAR(64) NOT NULL COMMENT '联系人',
  contact_phone VARCHAR(64) NOT NULL COMMENT '联系方式',
  price_range VARCHAR(120) NOT NULL COMMENT '价格区间',
  description TEXT NOT NULL COMMENT '介绍',
  image_urls TEXT NOT NULL COMMENT '图片链接 JSON 数组',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_commercial_shoots_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
