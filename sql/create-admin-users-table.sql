-- 运营后台账号（与 C 端 users 表分离）
CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL COMMENT '登录账号',
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt',
  display_name VARCHAR(64) NULL COMMENT '展示名',
  status TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1正常 0禁用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_admin_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='后台管理员账号';

-- 默认管理员（首次部署执行一次；登录后请修改密码）
-- 用户名：admin  密码：xinglian@2026
INSERT INTO admin_users (username, password_hash, display_name, status)
VALUES (
  'admin',
  '$2b$10$lAh5WMxLa7/5vteJd79PmOKZ33RX30SDgiCtjImAKqcscdp8U/Evy',
  '超级管理员',
  1
)
ON DUPLICATE KEY UPDATE username = username;

-- 已有库若曾插入过默认账号，执行脚本后同步为上述默认密码哈希
UPDATE admin_users
SET password_hash = '$2b$10$lAh5WMxLa7/5vteJd79PmOKZ33RX30SDgiCtjImAKqcscdp8U/Evy'
WHERE username = 'admin';
