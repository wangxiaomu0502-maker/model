-- 分账 v2：应付 P = 模特收入 + 服务费；服务费在 平台 / 代理人 / 经纪人 间分配。
-- 模特归属代理人 users.agent_user_id；商户绑定经纪人 users.referrer_id（role=3）。
-- 执行：在 xinglian-server 目录 npm run migrate:split-v2

SET NAMES utf8mb4;

-- 1) 模特所属代理人（与商户 referrer_id 解耦）
ALTER TABLE users
  ADD COLUMN agent_user_id BIGINT UNSIGNED NULL COMMENT '所属代理人 users.id，仅 role=1' AFTER referrer_id;

-- 历史：模特 referrer_id 若指向经纪人，清空（经纪人不再绑定模特）
UPDATE users SET referrer_id = NULL WHERE role = 1 AND referrer_id IS NOT NULL;

-- 2) 分账规则：服务费内三方占比（万分比之和 = 10000）
ALTER TABLE platform_split_rules
  ADD COLUMN platform_share_of_fee_bp SMALLINT UNSIGNED NOT NULL DEFAULT 3400 COMMENT '服务费内平台占比' AFTER model_share_bp,
  ADD COLUMN agent_share_of_fee_bp SMALLINT UNSIGNED NOT NULL DEFAULT 3300 COMMENT '服务费内代理人占比' AFTER platform_share_of_fee_bp,
  ADD COLUMN broker_share_of_fee_bp SMALLINT UNSIGNED NOT NULL DEFAULT 3300 COMMENT '服务费内经纪人占比' AFTER agent_share_of_fee_bp;

-- 默认：模特 85%、服务费 15%；服务费内 34% / 33% / 33%
UPDATE platform_split_rules SET
  model_share_bp = 8500,
  platform_fee_rate_bp = 1500,
  platform_share_of_fee_bp = 3400,
  agent_share_of_fee_bp = 3300,
  broker_share_of_fee_bp = 3300
WHERE id = 1;

-- 3) 订单分账字段重命名（若列已存在则跳过对应 CHANGE，由 migrate 脚本按 information_schema 判断）
-- merchant_referrer_user_id -> broker_user_id
-- model_referrer_user_id -> agent_user_id
-- merchant_referrer_income -> broker_income
-- model_referrer_income -> agent_income
