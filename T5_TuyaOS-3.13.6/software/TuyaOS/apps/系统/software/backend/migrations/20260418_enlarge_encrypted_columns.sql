-- 迁移说明：为即将实施的列级加密（AES-256-GCM）扩大列宽度
-- 加密后单值长度大约为 (原始长度 + 72) 字节，短字段普遍 100~160 字节
-- 若使用 TypeORM synchronize: true，会自动执行该迁移，但生产环境请手动执行一次
--
-- 配套脚本：backend/scripts/encrypt-sensitive-fields.mjs 会在首次执行前自动 ALTER
-- 再把表中历史明文数据写为密文；多次执行幂等。

-- 1. 服务对象（客户的家属/本人档案）
ALTER TABLE service_targets MODIFY COLUMN phone VARCHAR(255) NULL;
ALTER TABLE service_targets MODIFY COLUMN emergency_contact VARCHAR(255) NULL;
ALTER TABLE service_targets MODIFY COLUMN emergency_phone VARCHAR(255) NULL;
ALTER TABLE service_targets MODIFY COLUMN home_address VARCHAR(512) NULL;

-- 2. 订单中的客户侧联络/签署人
ALTER TABLE orders MODIFY COLUMN callback_contact_phone VARCHAR(255) NULL;
ALTER TABLE orders MODIFY COLUMN service_confirm_signer_name VARCHAR(255) NULL;

-- 3. 工单客户联系方式
ALTER TABLE complaints MODIFY COLUMN contact_phone VARCHAR(255) NULL;

-- 4. 陪诊员证照/保单信息
ALTER TABLE attendants MODIFY COLUMN insurance_info VARCHAR(512) NULL;
