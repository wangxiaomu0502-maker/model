ALTER TABLE orders
  ADD COLUMN service_type ENUM('ordinary','agent') NOT NULL DEFAULT 'ordinary' COMMENT 'ordinary普通服务 agent代理服务(提供影棚)' AFTER model_user_id;
