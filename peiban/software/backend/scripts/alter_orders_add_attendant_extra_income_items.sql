ALTER TABLE `orders`
ADD COLUMN `attendant_extra_income_items` JSON NULL COMMENT '陪诊员附加收入项'
AFTER `attendant_fee_type`;
