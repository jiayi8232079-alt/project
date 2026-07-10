-- 导诊一键下单：约号状态、名录医院、回电号码（请在目标库执行一次）
ALTER TABLE orders
  ADD COLUMN hospital_booking_status VARCHAR(32) NULL COMMENT 'booked=已自行约号 pending_cs=待客服协助约号' AFTER department,
  ADD COLUMN hospital_directory_id INT NULL COMMENT 'hospitals.id 名录医院' AFTER hospital_booking_status,
  ADD COLUMN callback_contact_phone VARCHAR(32) NULL COMMENT '用户回电号码' AFTER hospital_directory_id;

CREATE INDEX idx_orders_hospital_directory_id ON orders (hospital_directory_id);
CREATE INDEX idx_orders_hospital_booking_status ON orders (hospital_booking_status);
