-- 为 mock 模特 MK0000000001 / MK0000000002 补全 model_extra_data，并写入未来档期（日期相对 CURDATE()）
-- 需要 MySQL 5.7.8+（JSON 类型）。执行：mysql -h... -u... -p xinglian < sql/seed-mock-model-schedule.sql

-- 1) 若无扩展行则插入（主键 user_id）
INSERT INTO model_extra_data (user_id)
SELECT u.id
FROM users u
WHERE u.user_no IN ('MK0000000001', 'MK0000000002')
  AND NOT EXISTS (
    SELECT 1 FROM model_extra_data e WHERE e.user_id = u.id
  );

-- 2) 写入 schedule_json（含 available / rest / full 示例；商家端只展示 available）
UPDATE model_extra_data mex
INNER JOIN users u ON u.id = mex.user_id
   AND u.user_no IN ('MK0000000001', 'MK0000000002')
SET mex.schedule_json = CAST(
  CONCAT(
    '{"scheduleMap":{',
    '"',
    DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '%Y-%m-%d'),
    '":"available",',
    '"',
    DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 2 DAY), '%Y-%m-%d'),
    '":"available",',
    '"',
    DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 4 DAY), '%Y-%m-%d'),
    '":"available",',
    '"',
    DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 6 DAY), '%Y-%m-%d'),
    '":"available",',
    '"',
    DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 8 DAY), '%Y-%m-%d'),
    '":"rest",',
    '"',
    DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 10 DAY), '%Y-%m-%d'),
    '":"full",',
    '"',
    DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 12 DAY), '%Y-%m-%d'),
    '":"available"',
    '}}'
  ) AS JSON
);
