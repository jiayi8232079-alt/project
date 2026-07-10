ALTER TABLE `orders`
ADD COLUMN `additional_service_items` JSON NULL COMMENT '订单附加服务项'
AFTER `checkup_optional_items`;
