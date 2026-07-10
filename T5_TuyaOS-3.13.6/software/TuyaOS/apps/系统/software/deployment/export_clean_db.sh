#!/bin/zsh
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DB_NAME="${DB_NAME:-qiaoguo_health}"
OUT_FILE="${1:-deployment/qiaoguo_health_clean_$(date +%Y%m%d).sql}"

MYSQL_CMD=(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER")
MYSQLDUMP_CMD=(mysqldump -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER")
if [[ -n "$DB_PASS" ]]; then
  MYSQL_CMD+=( -p"$DB_PASS" )
  MYSQLDUMP_CMD+=( -p"$DB_PASS" )
fi

mkdir -p "$(dirname "$OUT_FILE")"

"${MYSQLDUMP_CMD[@]}" --no-data --routines=false --triggers --single-transaction "$DB_NAME" > "$OUT_FILE"
perl -0pi -e 's/AUTO_INCREMENT=\d+/AUTO_INCREMENT=1/g' "$OUT_FILE"

cat >> "$OUT_FILE" <<'SQL'

SET FOREIGN_KEY_CHECKS=0;

-- ==============================
-- Clean production seed data
-- Preserved: pricing, package, role and membership configuration
-- Removed: users, service targets, orders, finance records, timelines, documents,
--          schedules, consultations, reminders, reviews and any runtime/demo data.
-- Secrets such as webhook, COS key, enterprise WeCom app credentials are not exported.
-- Admin user rows are intentionally not exported. Create the first admin via env seed.
-- ==============================

SQL

"${MYSQL_CMD[@]}" "$DB_NAME" -N -e '
SELECT CONCAT(
  "INSERT INTO system_configs (`key`,`value`,`description`,`created_at`,`updated_at`) VALUES (",
  QUOTE(`key`), ",",
  QUOTE(`value`), ",",
  IF(description IS NULL, "NULL", QUOTE(description)), ",NOW(),NOW());"
)
FROM system_configs
WHERE `key` IN (
  "service_pricing",
  "value_added_service_pricing",
  "checkup_packages",
  "attendant_fee_pricing",
  "customer_additional_fee_pricing",
  "roles_config",
  "customer_service_url",
  "store_name",
  "store_phone",
  "store_address",
  "store_hours",
  "store_wechat",
  "store_latitude",
  "store_longitude",
  "store_description"
)
ORDER BY `key`;
' >> "$OUT_FILE"

"${MYSQL_CMD[@]}" "$DB_NAME" -N -e '
SELECT CONCAT(
  "INSERT INTO membership_levels (`level_name`,`discount_rate`,`min_recharge`,`benefits`,`sort_order`,`status`,`created_at`,`updated_at`) VALUES (",
  QUOTE(level_name), ",",
  discount_rate, ",",
  min_recharge, ",",
  IF(benefits IS NULL, "NULL", QUOTE(benefits)), ",",
  sort_order, ",",
  status, ",NOW(),NOW());"
)
FROM (
  SELECT MIN(id) AS id, level_name, discount_rate, min_recharge, benefits, sort_order, status
  FROM membership_levels
  GROUP BY level_name, discount_rate, min_recharge, benefits, sort_order, status
) t
ORDER BY sort_order, id;
' >> "$OUT_FILE"

"${MYSQL_CMD[@]}" "$DB_NAME" -N -e '
SELECT CONCAT(
  "INSERT INTO membership_card_types (`card_name`,`duration_days`,`price`,`level_id`,`description`,`sort_order`,`status`,`created_at`,`updated_at`) VALUES (",
  QUOTE(card_name), ",",
  duration_days, ",",
  price, ",",
  IF(level_id IS NULL, "NULL", level_id), ",",
  IF(description IS NULL, "NULL", QUOTE(description)), ",",
  sort_order, ",",
  status, ",NOW(),NOW());"
)
FROM (
  SELECT MIN(id) AS id, card_name, duration_days, price, level_id, description, sort_order, status
  FROM membership_card_types
  GROUP BY card_name, duration_days, price, level_id, description, sort_order, status
) t
ORDER BY sort_order, id;
' >> "$OUT_FILE"

cat >> "$OUT_FILE" <<'SQL'

SET FOREIGN_KEY_CHECKS=1;
SQL

echo "Clean SQL exported to: $OUT_FILE"
