-- 修复合同模板「标题」乱码（常见于：执行建表 SQL 时 mysql 客户端默认 latin1，中文被误写入）
-- 执行前请客户端使用 utf8mb4，例如：
--   mysql --no-defaults --default-character-set=utf8mb4 -h HOST -u USER -p DB_NAME < sql/repair-contract-template-titles.sql

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

UPDATE contract_templates SET title = '平台与经纪人服务合同' WHERE contract_kind = 'platform_broker';
UPDATE contract_templates SET title = '平台与商家服务合同' WHERE contract_kind = 'platform_merchant';
UPDATE contract_templates SET title = '经纪人与模特合作协议' WHERE contract_kind = 'broker_model';
