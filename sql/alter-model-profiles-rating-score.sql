-- 模特列表评分字段：当前默认所有模特 5.0 分，后续可接入真实评价统计。
ALTER TABLE model_profiles
  ADD COLUMN rating_score DECIMAL(3, 2) NOT NULL DEFAULT 5.00 COMMENT '模特评分，默认5.00';

CREATE INDEX idx_model_profiles_rating_score ON model_profiles (rating_score);
