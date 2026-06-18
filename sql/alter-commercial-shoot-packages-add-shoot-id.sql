-- 若已按旧版建过 global 套餐表，执行此脚本改为挂场地
-- mysql --default-character-set=utf8mb4 -u root -p xinglian < sql/alter-commercial-shoot-packages-add-shoot-id.sql

ALTER TABLE commercial_shoot_packages
  ADD COLUMN shoot_id BIGINT UNSIGNED NULL COMMENT '所属商拍场地' AFTER id;

-- 旧数据无归属场地，需人工处理或删除后再加 NOT NULL
-- DELETE FROM commercial_shoot_packages WHERE shoot_id IS NULL;

ALTER TABLE commercial_shoot_packages
  MODIFY COLUMN shoot_id BIGINT UNSIGNED NOT NULL COMMENT '所属商拍场地';

ALTER TABLE commercial_shoot_packages
  DROP INDEX idx_commercial_shoot_packages_sort;

ALTER TABLE commercial_shoot_packages
  ADD KEY idx_commercial_shoot_packages_shoot (shoot_id, sort_order, id);

ALTER TABLE commercial_shoot_packages
  ADD CONSTRAINT fk_commercial_shoot_packages_shoot
    FOREIGN KEY (shoot_id) REFERENCES commercial_shoots(id) ON DELETE CASCADE;
