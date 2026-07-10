# 敏感字段列加密（P0①）

本系统对客户侧最敏感的字段（身份证、联系电话、紧急联系人、家庭地址、保单信息等）启用了 **AES-256-GCM** 透明列加密，密文随机化存储；读取时由 TypeORM transformer 自动解密。

## 1. 加密范围

| 表 | 列（数据库） | 实体字段 |
|---|---|---|
| `service_targets` | `id_card` | `idCard` |
| `service_targets` | `phone` | `phone` |
| `service_targets` | `emergency_contact` | `emergencyContact` |
| `service_targets` | `emergency_phone` | `emergencyPhone` |
| `service_targets` | `home_address` | `homeAddress` |
| `orders` | `callback_contact_phone` | `callbackContactPhone` |
| `orders` | `service_confirm_signer_name` | `serviceConfirmSignerName` |
| `complaints` | `contact_phone` | `contactPhone` |
| `attendants` | `insurance_info` | `insuranceInfo` |

> 未加密的字段：`users.phone`、`attendants.phone`、`admin_users.phone`、`attendants.real_name`、`admin_users.real_name` 等，这些字段在后台搜索/模糊匹配中被高频使用，暂时保留明文，仅在 API 返回时做脱敏。后续若要加密，需同步改造为独立 hash 列 + 精确匹配索引。

## 2. 加密规格

- 算法：AES-256-GCM（96-bit IV、128-bit auth tag）
- 密钥派生：`scrypt(COLUMN_ENCRYPTION_KEY 或 JWT_SECRET, 'qiaoguo-salt', 32)`
- 存储格式：`enc2:<ivHex>:<tagHex>:<cipherHex>`
- 同时兼容读取旧版 `enc:<ivHex>:<cipherHex>`（AES-256-CBC），只在迁移过渡期存在

### 2.1 环境变量

`backend/.env`（或部署环境）需设置：

```env
# 强烈建议单独配置，一旦更换旧数据将无法解密
COLUMN_ENCRYPTION_KEY=<请替换为 32+ 位随机字符串>
```

若未设置，系统会降级为使用 `JWT_SECRET`，并在控制台打印告警；若两个都未设置，将使用硬编码兜底串（仅供本地开发，严禁生产使用）。

> **密钥轮换**：一旦生产数据已加密，切勿再修改密钥，否则历史数据不可解。未来若要轮换，需单独实现「双密钥解密 → 批量重加密」流程。

## 3. 上线步骤

### 3.1 首次上线 / 历史库

1. **备份数据库**（强制）：
   ```bash
   mysqldump -uroot -p qiaoguo_health > backup-$(date +%F).sql
   ```

2. **加宽列宽度**（密文比明文长）：
   ```bash
   mysql -uroot -p qiaoguo_health < backend/migrations/20260418_enlarge_encrypted_columns.sql
   ```

   > 若启用了 `DB_SYNCHRONIZE=true`，TypeORM 会自动按实体定义调整列；生产建议手动执行 SQL 后再重启服务。

3. **配置环境变量**：
   在 `backend/.env` 中加入 `COLUMN_ENCRYPTION_KEY=xxx`，和未来生产保持一致。

4. **明文 → 密文批量迁移**（幂等可多次执行）：
   ```bash
   cd backend
   node scripts/encrypt-sensitive-fields.mjs --dry-run  # 先试跑，看有多少行
   node scripts/encrypt-sensitive-fields.mjs            # 正式执行
   ```

5. 重启后端服务：
   ```bash
   pnpm start:prod  # 或对应的启动命令
   ```

### 3.2 后续增加加密字段

1. 在实体上添加 `transformer: EncryptedColumnTransformer`。
2. 在 `backend/migrations/` 新增 SQL：加宽列宽度到 `VARCHAR(255)` 或更大。
3. 在 `scripts/encrypt-sensitive-fields.mjs` 的 `TARGETS` 列表中追加该列。
4. 执行脚本完成旧数据迁移。

## 4. 开发者注意

- **不要**在 WHERE 条件中对加密字段做 `=` 或 `LIKE` 查询——密文含随机 IV，每次加密结果不同。
- 如果确实需要等值查询，可使用 `deterministicHash()` 生成稳定哈希列（暂未启用）。
- 插入/更新代码无需改动：TypeORM transformer 会自动在写入前加密、在读取后解密。
- 日志/审计系统的脱敏：请查看 `audit-log.service.ts` 中的 `SENSITIVE_KEYS`，已将 `phone`、`idCard`、`password` 等关键字做了替换。

## 5. 紧急回滚

若迁移后发现问题，回滚方案：

1. 停服
2. 从备份恢复数据库：
   ```bash
   mysql -uroot -p qiaoguo_health < backup-2026-04-18.sql
   ```
3. 在代码层移除 `transformer: EncryptedColumnTransformer` 再重新发布
4. 排查原因后再次上线

---
最近一次更新：2026-04-18
