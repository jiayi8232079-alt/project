#!/usr/bin/env bash
# 按省/市调用 POST /hospitals/admin/import-region-amap，导入北京或广东高德医院 POI（需配置 AMAP_WEB_KEY）。
# 用法：
#   BASE_URL=http://127.0.0.1:3000 ADMIN_USER=admin ADMIN_PASS=123456 ./scripts/import-beijing-guangdong-amap.sh beijing
#   BASE_URL=... ./scripts/import-beijing-guangdong-amap.sh guangdong
set -uo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-123456}"
DELAY_MS="${DELAY_MS:-450}"
MODE="${1:-}"

TOKEN=$(curl -s -X POST "$BASE_URL/auth/admin-login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('token','') or '')")
if [[ -z "$TOKEN" ]]; then
  echo "登录失败"
  exit 1
fi

post_import_city_json() {
  local body="$1"
  curl -sS -X POST "$BASE_URL/hospitals/admin/import-region-amap" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$body"
}

run_body() {
  local body="$1"
  curl -sS -X POST "$BASE_URL/hospitals/admin/import-region-amap" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$body" | python3 -m json.tool
}

if [[ "$MODE" == "beijing" ]]; then
  echo "========== 北京市（直辖市一条 city）=========="
  body=$(python3 -c "import json; print(json.dumps({'province':'北京市','cities':['北京市'],'delayMs':int('$DELAY_MS')}))")
  run_body "$body"
  exit 0
fi

if [[ "$MODE" == "guangdong" ]]; then
  CITIES=(广州市 深圳市 珠海市 汕头市 佛山市 韶关市 湛江市 肇庆市 江门市 茂名市 惠州市 梅州市 汕尾市 河源市 阳江市 清远市 东莞市 中山市 潮州市 揭阳市 云浮市)
  total_ins=0
  failed=0
  for c in "${CITIES[@]}"; do
    echo "========== 导入：广东省 $c =========="
    body=$(python3 -c "import json; print(json.dumps({'province':'广东省','cities':['$c'],'delayMs':int('$DELAY_MS')}))")
    res=$(post_import_city_json "$body")
    echo "$res" | python3 -m json.tool 2>/dev/null || echo "$res"
    code=$(echo "$res" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code',0))" 2>/dev/null | tr -d '\n')
    if [[ "$code" != "200" ]]; then
      echo "^^^ 失败，3 秒后重试一次…"
      sleep 3
      res=$(post_import_city_json "$body")
      echo "$res" | python3 -m json.tool 2>/dev/null || echo "$res"
      code=$(echo "$res" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code',0))" 2>/dev/null | tr -d '\n')
    fi
    if [[ "$code" != "200" ]]; then
      echo "!!! $c 仍失败，请稍后单独重跑该市的 import-region-amap"
      failed=$((failed + 1))
    fi
    ins=$(echo "$res" | python3 -c "import sys,json; d=json.load(sys.stdin); print(int((d.get('data') or {}).get('inserted') or 0))" 2>/dev/null | tr -d '\n')
    ins="${ins:-0}"
    total_ins=$((total_ins + ins))
  done
  echo "广东省各市 inserted 合计约 $total_ins；失败城市数: $failed"
  exit 0
fi

echo "用法: $0 beijing | guangdong"
exit 1
