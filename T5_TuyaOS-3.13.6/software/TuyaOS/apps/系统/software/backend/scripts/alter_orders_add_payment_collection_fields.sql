ALTER TABLE `orders`
  ADD COLUMN `payment_method` ENUM('wechat', 'alipay', 'qr_transfer', 'bank_transfer', 'cash', 'other') NULL AFTER `payment_status`,
  ADD COLUMN `payment_paid_at` DATETIME NULL AFTER `payment_method`,
  ADD COLUMN `settled_at` DATETIME NULL AFTER `payment_paid_at`,
  ADD COLUMN `settlement_remark` TEXT NULL AFTER `settled_at`;
