-- 模特个人荣誉表
-- 执行示例：
--   mysql --no-defaults --default-character-set=utf8mb4 -h HOST -P PORT -u USER -p DB_NAME < sql/create-model-honors-table.sql

CREATE TABLE IF NOT EXISTS model_honors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '模特 users.id',
  title VARCHAR(100) NOT NULL COMMENT '荣誉名称',
  image_url VARCHAR(512) NULL DEFAULT NULL COMMENT '荣誉图片 URL（奖杯/证明，选填）',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序，越小越靠前',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_model_honors_user_sort (user_id, sort_order, id),
  CONSTRAINT fk_model_honors_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模特个人荣誉';
