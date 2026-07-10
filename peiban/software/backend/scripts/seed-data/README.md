# 医院名录与生产同步

本目录中的 `hospitals_prod_sync.sql` 由开发库 **`qiaoguo_local.hospitals`** 导出（当前快照约 **3988** 条；随每次重新导出更新）。用于在**空库或允许覆盖**的生产/预发环境快速对齐医院数据。

## 部署前请确认

1. 已部署与本地一致的 **后端代码版本**（含 `hospitals` 表结构兼容）。
2. 目标库已创建，且账号有 **CREATE / DROP / INSERT** 权限。
3. **先备份**目标库；本 SQL 包含 **`DROP TABLE IF EXISTS hospitals`**，会清空并重建该表。
4. 若 `hospital_doctors` 表中有引用 `hospitals.id` 的数据，导入后需重新维护医生名录（当前导出未含该表，本地亦为 0 条）。

## 服务器一键导入（推荐给运维 / 服务器侧 AI）

在项目仓库中定位到本脚本目录后执行：

```bash
chmod +x import-hospitals.sh
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_USERNAME=你的用户
export DB_PASSWORD=你的密码
export DB_DATABASE=你的库名
./import-hospitals.sh
```

也可使用与 Nest 一致的变量名（脚本读取的是上面五个）。

## 手工导入

```bash
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" -p"$DB_PASSWORD" "$DB_DATABASE" < hospitals_prod_sync.sql
```

## 更新 SQL 快照（开发者）

当本地 `hospitals` 数据更新后，在开发机重新导出并提交本文件：

```bash
mysqldump -h 127.0.0.1 -P 3306 -u root --protocol=tcp \
  --single-transaction --no-tablespaces --skip-comments \
  qiaoguo_local hospitals \
  > backend/scripts/seed-data/hospitals_prod_sync.sql
```

（将 `qiaoguo_local` 换为你的开发库名。）
