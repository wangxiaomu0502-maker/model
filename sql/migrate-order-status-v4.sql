-- 将旧版 order_status 迁移为 v4（部署新后端前执行一次）
-- 旧：0待支付 4待接单 1进行中 2服务完成 3订单完成 9取消
-- 新：1待模特确认接单 2进行中 3模特已完成 4已完成 9已取消
UPDATE orders
SET order_status = CASE order_status
  WHEN 0 THEN 9
  WHEN 4 THEN 1
  WHEN 1 THEN 2
  WHEN 2 THEN 3
  WHEN 3 THEN 4
  WHEN 9 THEN 9
  ELSE order_status
END
WHERE order_status IN (0, 1, 2, 3, 4, 9);
