ALTER TABLE `orders`
  ADD COLUMN `settlement_status` ENUM('pending', 'settled') NOT NULL DEFAULT 'pending' AFTER `total_fee`,
  ADD COLUMN `payment_status` ENUM('unpaid', 'paid', 'refunded') NOT NULL DEFAULT 'unpaid' AFTER `settlement_status`;
