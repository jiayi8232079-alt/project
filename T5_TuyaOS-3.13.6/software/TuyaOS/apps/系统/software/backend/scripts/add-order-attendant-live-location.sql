-- 陪诊员实时位置（生产环境 synchronize=false 时执行）
ALTER TABLE `orders`
  ADD COLUMN `attendant_live_lat` DOUBLE NULL COMMENT '陪诊员实时纬度 GCJ-02' AFTER `sign_url`,
  ADD COLUMN `attendant_live_lng` DOUBLE NULL COMMENT '陪诊员实时经度 GCJ-02' AFTER `attendant_live_lat`,
  ADD COLUMN `attendant_live_at` DATETIME NULL COMMENT '位置上报时间' AFTER `attendant_live_lng`;
