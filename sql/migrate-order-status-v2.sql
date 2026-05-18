-- ⚠️ 一次性脚本：仅在部署「新状态语义」之前执行。
-- 旧版 order_status=2 表示「已完成」→ 新版 3「订单完成」。
-- 部署新后端后切勿再执行：此时 2 表示「服务完成」，会被误改成 3。
UPDATE orders SET order_status = 3 WHERE order_status = 2;
