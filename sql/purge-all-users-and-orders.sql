-- 清空全部 C 端用户与订单数据，仅保留 admin_users 及运营配置（合同模板、分账规则、分类树等）。
-- 执行前请确认环境；建议在 xinglian-server 目录：npm run purge:users-orders

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE user_account_ledger;
TRUNCATE TABLE user_account_balance;
TRUNCATE TABLE orders;

TRUNCATE TABLE model_profile_categories;
TRUNCATE TABLE model_extra_data;
TRUNCATE TABLE model_profiles;
TRUNCATE TABLE merchant_profiles;

-- 扩展表可能尚未建表，由执行脚本忽略 ER_NO_SUCH_TABLE
TRUNCATE TABLE broker_profiles;
TRUNCATE TABLE agent_profiles;

TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- admin_users、user_role、contract_templates、platform_split_rules、model_category_nodes 不清理
