-- 目标：档期默认值统一为“休息”
-- 说明：
-- 1) DB 层把 schedule_json 空值统一为 {"scheduleMap":{}}
-- 2) 应用层会把缺省日期解释为 rest（明天起未来30天）

UPDATE model_extra_data
SET schedule_json = JSON_OBJECT("scheduleMap", JSON_OBJECT())
WHERE schedule_json IS NULL;

ALTER TABLE model_extra_data
  MODIFY COLUMN schedule_json JSON NULL
  DEFAULT (JSON_OBJECT("scheduleMap", JSON_OBJECT()))
  COMMENT '未来档期数据，缺省日期按休息处理';
