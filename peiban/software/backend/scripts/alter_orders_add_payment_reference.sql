ALTER TABLE `orders`
  ADD COLUMN `payment_reference` VARCHAR(128) NULL AFTER `payment_paid_at`;
