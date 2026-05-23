-- 后台账号角色：admin 管理员 | cs 客服
-- 执行：mysql ... < sql/alter-admin-users-role.sql

ALTER TABLE admin_users
  ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'admin'
    COMMENT 'admin=管理员 cs=客服'
    AFTER username;

UPDATE admin_users SET role = 'admin' WHERE role IS NULL OR role = '';

CREATE INDEX idx_admin_users_role ON admin_users (role);
