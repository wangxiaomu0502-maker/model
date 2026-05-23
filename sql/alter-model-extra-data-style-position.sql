ALTER TABLE model_extra_data
  ADD COLUMN style_position_json JSON NULL COMMENT '风格定位图片 {photos:[{id,url}]}'
  AFTER portfolio_json;
