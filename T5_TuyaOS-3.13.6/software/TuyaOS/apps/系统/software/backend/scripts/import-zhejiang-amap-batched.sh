#!/usr/bin/env bash
# 按市调用 POST /hospitals/admin/import-zhejiang-amap，避免「全省一次」请求超时。
# 用法：BASE_URL=http://127.0.0.1:3000 ADMIN_USER=admin ADMIN_PASS=123456 ./scripts/import-zhejiang-amap-batched.sh

set -euo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-123456}"
DELAY_MS="${DELAY_MS:-450}"

TOKEN=$(curl -s -X POST "$BASE_URL/auth/admin-login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('token','') or '')")
if [[ -z "$TOKEN" ]]; then
  echo "登录失败"
  exit 1
fi

CITIES=(杭州市 宁波市 温州市 嘉兴市 湖州市 绍兴市 金华市 衢州市 舟山市 台州市 丽水市)
total_ins=0
for c in "${CITIES[@]}"; do
  echo "========== 导入：$c =========="
  body=$(python3 -c "import json; print(json.dumps({'cities':['$c'],'delayMs':int('$DELAY_MS')}))")
  res=$(curl -sS -X POST "$BASE_URL/hospitals/admin/import-zhejiang-amap" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$body")
  echo "$res" | python3 -m json.tool || echo "$res"
  ins=$(echo "$res" | python3 -c "import sys,json; d=json.load(sys.stdin); print(int(d.get('data',{}).get('inserted') or 0))" 2>/dev/null | tr -d '\n')
  ins="${ins:-0}"
  total_ins=$((total_ins + ins))
done
echo "全部完成，本脚本累计 inserted 约 $total_ins（各市委托返回相加，未去重跨市）"
