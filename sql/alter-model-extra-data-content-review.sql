-- 模卡 / 作品集 / 风格定位 分项内容审核
-- 0待提交 1待审核 2已通过 3已驳回；默认 2 表示历史数据视为已通过

ALTER TABLE model_extra_data
  ADD COLUMN card_review_status TINYINT UNSIGNED NOT NULL DEFAULT 2
    COMMENT '模卡审核：0待提交 1待审 2通过 3驳回' AFTER card_json,
  ADD COLUMN card_review_reject_reason VARCHAR(500) NULL
    COMMENT '模卡驳回原因' AFTER card_review_status,
  ADD COLUMN portfolio_review_status TINYINT UNSIGNED NOT NULL DEFAULT 2
    COMMENT '作品集审核：0待提交 1待审 2通过 3驳回' AFTER portfolio_json,
  ADD COLUMN portfolio_review_reject_reason VARCHAR(500) NULL
    COMMENT '作品集驳回原因' AFTER portfolio_review_status,
  ADD COLUMN style_position_review_status TINYINT UNSIGNED NOT NULL DEFAULT 2
    COMMENT '风格定位审核：0待提交 1待审 2通过 3驳回' AFTER style_position_json,
  ADD COLUMN style_position_review_reject_reason VARCHAR(500) NULL
    COMMENT '风格定位驳回原因' AFTER style_position_review_status;
