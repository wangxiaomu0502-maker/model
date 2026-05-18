-- 代理人资料扩展：公司、联系人、营业执照等

ALTER TABLE agent_profiles
  ADD COLUMN company_name VARCHAR(100) NULL COMMENT '公司名称' AFTER user_id,
  ADD COLUMN contact_name VARCHAR(50) NULL COMMENT '联系人' AFTER company_name,
  ADD COLUMN emergency_contact_name VARCHAR(50) NULL COMMENT '紧急联系人' AFTER contact_name,
  ADD COLUMN emergency_contact_phone VARCHAR(20) NULL COMMENT '紧急联系人电话' AFTER emergency_contact_name,
  ADD COLUMN business_license_url VARCHAR(2048) NULL COMMENT '营业执照图片URL' AFTER city;
