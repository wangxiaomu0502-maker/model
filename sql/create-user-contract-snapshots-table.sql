-- 用户合同签署快照：锁定签署时的合同编号、标题、正文、签名图与签署时间
-- 执行示例：
--   mysql --no-defaults --default-character-set=utf8mb4 -h HOST -P PORT -u USER -p DB_NAME < sql/create-user-contract-snapshots-table.sql

CREATE TABLE IF NOT EXISTS user_contract_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  contract_kind VARCHAR(32) NOT NULL COMMENT 'platform_broker | platform_merchant | broker_model | platform_agent',
  contract_no VARCHAR(64) NOT NULL COMMENT '系统生成合同编号',
  title VARCHAR(200) NOT NULL DEFAULT '',
  content_html MEDIUMTEXT NOT NULL COMMENT '签署时已替换合同编号/签署日期的正文快照',
  signature_url VARCHAR(255) NOT NULL DEFAULT '' COMMENT '手写签名图 URL',
  template_updated_at DATETIME NULL DEFAULT NULL COMMENT '签署时所用模板更新时间',
  signed_at DATETIME NOT NULL COMMENT '签署时间',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_contract_kind (user_id, contract_kind),
  UNIQUE KEY uk_contract_no (contract_no),
  KEY idx_contract_kind_signed_at (contract_kind, signed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户合同签署快照';
