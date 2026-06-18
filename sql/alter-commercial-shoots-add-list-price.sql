-- 商拍场地追加标牌价
-- mysql --default-character-set=utf8mb4 -u root -p xinglian < sql/alter-commercial-shoots-add-list-price.sql

ALTER TABLE commercial_shoots
  ADD COLUMN list_price VARCHAR(120) NOT NULL DEFAULT '' COMMENT '标牌价' AFTER price_range;
