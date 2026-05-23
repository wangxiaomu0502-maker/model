CREATE TABLE IF NOT EXISTS payment_operation_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  event_type VARCHAR(64) NOT NULL COMMENT '事件类型：wechat_prepay/wechat_pay_notify/wechat_query_order/wechat_close_order/wechat_refund/wechat_query_refund 等',
  order_id BIGINT UNSIGNED NULL COMMENT '本地订单 id',
  order_no VARCHAR(32) NULL COMMENT '商户订单号 out_trade_no',
  refund_no VARCHAR(64) NULL COMMENT '商户退款单号 out_refund_no',
  wechat_transaction_id VARCHAR(64) NULL COMMENT '微信支付交易单号 transaction_id',
  wechat_refund_id VARCHAR(64) NULL COMMENT '微信退款单号 refund_id',
  trade_state VARCHAR(32) NULL COMMENT '微信支付交易状态',
  refund_status VARCHAR(32) NULL COMMENT '微信退款状态',
  direction VARCHAR(16) NOT NULL DEFAULT 'internal' COMMENT 'request/response/callback/internal',
  request_json JSON NULL COMMENT '请求摘要，敏感字段需脱敏',
  response_json JSON NULL COMMENT '响应摘要，敏感字段需脱敏',
  error_message TEXT NULL COMMENT '错误信息',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_payment_logs_order_no (order_no, created_at),
  KEY idx_payment_logs_refund_no (refund_no, created_at),
  KEY idx_payment_logs_event_type (event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付与退款操作流水';
