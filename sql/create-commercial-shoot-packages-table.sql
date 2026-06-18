-- 商拍套餐表（挂在具体商拍场地下）
-- mysql --default-character-set=utf8mb4 -u root -p xinglian < sql/create-commercial-shoot-packages-table.sql

CREATE TABLE IF NOT EXISTS commercial_shoot_packages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  shoot_id BIGINT UNSIGNED NOT NULL COMMENT '所属商拍场地',
  name VARCHAR(120) NOT NULL COMMENT '套餐名称',
  fee VARCHAR(120) NOT NULL COMMENT '费用',
  list_price VARCHAR(120) NOT NULL DEFAULT '' COMMENT '标牌价',
  remark TEXT NULL COMMENT '备注',
  cover_url VARCHAR(1000) NOT NULL COMMENT '头图',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序，越小越靠前',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_commercial_shoot_packages_shoot (shoot_id, sort_order, id),
  CONSTRAINT fk_commercial_shoot_packages_shoot
    FOREIGN KEY (shoot_id) REFERENCES commercial_shoots(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
