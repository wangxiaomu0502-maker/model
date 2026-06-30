-- 模特列表排序：数值越大越靠前
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE model_profiles
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0
    COMMENT '列表排序，越大越靠前'
    AFTER model_level_override;

ALTER TABLE model_profiles
  ADD KEY idx_model_profiles_sort_order (sort_order, user_id);
