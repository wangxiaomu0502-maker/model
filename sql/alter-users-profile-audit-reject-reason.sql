-- 资料审核驳回说明（模特）；通过后或未驳回时为 NULL
-- 执行前请确认 users 表无同名列；已存在则跳过本脚本

ALTER TABLE users
  ADD COLUMN profile_audit_reject_reason VARCHAR(500) NULL DEFAULT NULL
    COMMENT '资料审核驳回说明'
    AFTER profile_audit_status;
