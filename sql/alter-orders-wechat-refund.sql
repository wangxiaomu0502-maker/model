ALTER TABLE orders
  MODIFY COLUMN payment_status TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '0未支付 1已支付 2退款中 3已退款 4退款失败',
  ADD COLUMN wechat_transaction_id VARCHAR(64) NULL COMMENT '微信支付交易单号 transaction_id' AFTER payment_channel,
  ADD COLUMN refund_no VARCHAR(64) NULL COMMENT '商户退款单号 out_refund_no' AFTER wechat_transaction_id,
  ADD COLUMN wechat_refund_id VARCHAR(64) NULL COMMENT '微信退款单号 refund_id' AFTER refund_no,
  ADD COLUMN refund_status VARCHAR(32) NULL COMMENT '微信退款状态 SUCCESS/PROCESSING 等' AFTER wechat_refund_id,
  ADD COLUMN refund_amount DECIMAL(10, 2) NULL COMMENT '退款金额' AFTER refund_status,
  ADD COLUMN refunded_at DATETIME NULL COMMENT '退款完成时间' AFTER refund_amount,
  ADD UNIQUE KEY uk_orders_refund_no (refund_no);
