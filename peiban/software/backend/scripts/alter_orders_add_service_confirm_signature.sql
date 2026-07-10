-- 用户签署的陪诊服务确认单（生产环境 synchronize=false 时执行一次）
ALTER TABLE `orders`
  ADD COLUMN `service_confirm_signature_url` VARCHAR(512) NULL COMMENT '确认单手写签名图片地址' AFTER `sign_url`,
  ADD COLUMN `service_confirm_signed_at` DATETIME NULL COMMENT '确认单签署时间' AFTER `service_confirm_signature_url`,
  ADD COLUMN `service_confirm_signer_name` VARCHAR(64) NULL COMMENT '签署人姓名' AFTER `service_confirm_signed_at`;
