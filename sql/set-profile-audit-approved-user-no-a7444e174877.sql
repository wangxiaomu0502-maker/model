-- 将 user_no = a7444e174877 的用户资料审核置为「已通过」(2)，并清空驳回说明。
-- 适用于模特（role = 1）。执行前可先 SELECT 核对。

SELECT id, user_no, role, nickname, profile_audit_status, profile_audit_reject_reason
FROM users
WHERE user_no = 'a7444e174877'
  AND deleted_at IS NULL;

UPDATE users
SET profile_audit_status = 2,
    profile_audit_reject_reason = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE user_no = 'a7444e174877'
  AND role = 1
  AND deleted_at IS NULL;
