-- 模特等级：LV0-LV3 自动计算，LV4/LV5 由后台管理员手动指定。
-- 可重复执行：字段已存在时不会重复添加。
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'model_profiles'
    AND COLUMN_NAME = 'model_level_override'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE model_profiles ADD COLUMN model_level_override TINYINT UNSIGNED NULL COMMENT ''管理员手动等级：4=皇冠模特 5=天幕模特 NULL=自动计算LV0-LV3'' AFTER is_admin_created',
  'SELECT ''model_level_override already exists'' AS message'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
