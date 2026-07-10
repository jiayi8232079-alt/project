#!/usr/bin/env bash
# 将本仓库内的 hospitals_prod_sync.sql 导入到目标 MySQL（覆盖 hospitals 表）。
# 用法（在服务器 backend 目录或任意目录执行均可）：
#   export DB_HOST=127.0.0.1 DB_PORT=3306 DB_USERNAME=root DB_PASSWORD=secret DB_DATABASE=qiaoguo_health
#   bash path/to/import-hospitals.sh
#
# 说明：SQL 内含 DROP TABLE hospitals；若存在 hospital_doctors 外键，文件开头已关闭外键检查。
# 导入前请自行备份线上库。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/hospitals_prod_sync.sql"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USERNAME="${DB_USERNAME:-root}"
DB_DATABASE="${DB_DATABASE:-}"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "找不到 SQL 文件: $SQL_FILE"
  exit 1
fi

if [[ -z "$DB_DATABASE" ]]; then
  echo "请设置环境变量 DB_DATABASE（以及 DB_HOST、DB_USERNAME、DB_PASSWORD 等）"
  exit 1
fi

MYSQL_ARGS=( -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" --protocol=tcp "$DB_DATABASE" )

if [[ -n "${DB_PASSWORD:-}" ]]; then
  export MYSQL_PWD="$DB_PASSWORD"
fi

echo "即将导入 $SQL_FILE -> $DB_USERNAME@$DB_HOST:$DB_PORT/$DB_DATABASE"
echo "（将删除并重建 hospitals 表，请先确认已备份）"
mysql "${MYSQL_ARGS[@]}" < "$SQL_FILE"
echo "导入完成。"

unset MYSQL_PWD 2>/dev/null || true
