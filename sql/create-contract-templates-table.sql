-- 合同模板（运营后台富文本配置，用户端只读展示）
-- 四种固定类型：platform_broker（经纪人签署）、platform_merchant（商家签署）、broker_model（模特签署）、platform_agent（代理人签署）
--
-- 执行本文件时请使用 utf8mb4 客户端字符集，否则 INSERT 里的中文标题可能乱码，例如：
--   mysql --no-defaults --default-character-set=utf8mb4 ... < sql/create-contract-templates-table.sql
-- 若已乱码，可执行 sql/repair-contract-template-titles.sql 修正。

CREATE TABLE IF NOT EXISTS contract_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  contract_kind VARCHAR(32) NOT NULL COMMENT 'platform_broker | platform_merchant | broker_model | platform_agent',
  title VARCHAR(200) NOT NULL DEFAULT '',
  content_html MEDIUMTEXT NOT NULL COMMENT '富文本 HTML，服务端存储前做基础净化',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_contract_kind (contract_kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='合同正文模板';

INSERT IGNORE INTO contract_templates (contract_kind, title, content_html) VALUES
('platform_broker', '经纪人入驻合作协议（线上版）', ''),
('platform_merchant', '商家入驻合作协议（线上版）', ''),
('broker_model', '模特入驻合作协议（线上版）', ''),
('platform_agent', '代理人平台入驻协议（线上版）', '');
