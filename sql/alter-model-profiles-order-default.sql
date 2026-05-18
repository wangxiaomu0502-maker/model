-- 接单开关默认关闭：新模特默认暂停接单，需主动开启
-- is_available: 0=关闭 1=开启

ALTER TABLE model_profiles
  MODIFY COLUMN is_available TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '接单开关 0关1开';
