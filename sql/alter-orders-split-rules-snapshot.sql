-- 订单完成时锁定 platform_split_rules 快照，管理端分账优先读此列（无则回退读当前配置表）
-- 可重复执行：若列已存在则跳过。

SET @db := DATABASE();
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'split_rules_snapshot'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE orders ADD COLUMN split_rules_snapshot JSON NULL COMMENT ''订单完成时刻锁定的分账比例与 orphan 策略（JSON）'' AFTER model_referrer_user_id',
  'SELECT ''skip: split_rules_snapshot already exists'' AS _msg'
);
PREPARE _stmt FROM @sql;
EXECUTE _stmt;
DEALLOCATE PREPARE _stmt;
