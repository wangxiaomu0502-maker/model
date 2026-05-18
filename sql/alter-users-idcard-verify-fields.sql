ALTER TABLE users
  ADD COLUMN IF NOT EXISTS id_card_front_url VARCHAR(255) NULL COMMENT '身份证人像面图片URL' AFTER id_card_no,
  ADD COLUMN IF NOT EXISTS id_card_back_url VARCHAR(255) NULL COMMENT '身份证国徽面图片URL' AFTER id_card_front_url,
  ADD COLUMN IF NOT EXISTS id_card_issue_authority VARCHAR(120) NULL COMMENT '身份证签发机关' AFTER id_card_back_url,
  ADD COLUMN IF NOT EXISTS id_card_valid_date VARCHAR(64) NULL COMMENT '身份证有效期文本' AFTER id_card_issue_authority;
