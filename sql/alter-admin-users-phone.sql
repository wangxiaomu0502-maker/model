-- 客服/管理员联系手机号（用户端订单详情展示客服电话）
ALTER TABLE admin_users
  ADD COLUMN phone VARCHAR(20) NULL DEFAULT NULL
    COMMENT '联系电话'
    AFTER display_name;
