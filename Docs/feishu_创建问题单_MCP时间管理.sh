#!/usr/bin/env bash
# 创建飞书云文档：涂鸦云 MCP 时间管理策略优化问题单
# 前置：lark-cli 已安装且已执行 lark-cli auth login

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v lark-cli >/dev/null 2>&1; then
  echo "未找到 lark-cli，请先安装：npx @larksuite/cli@latest install" >&2
  exit 1
fi

echo "提示：若创建失败并提示 need_user_authorization，请先执行 lark-cli auth login"

TITLE="问题单：涂鸦云 MCP 时间管理话术与策略优化"
MD_REL="./Docs/问题单_涂鸦云MCP时间管理话术与策略优化.md"

if [[ ! -f "$MD_REL" ]]; then
  echo "找不到 Markdown 源文件：$MD_REL" >&2
  exit 3
fi

DOC_TOKEN="${FEISHU_DOC_TOKEN:-GNsVde4yQoqOxexfuQvcdDmynxc}"

if [[ "${1:-}" == "--update" ]] || [[ -n "${FEISHU_DOC_TOKEN:-}" ]]; then
  echo "正在覆盖更新飞书云文档（token: $DOC_TOKEN）…"
  lark-cli docs +update --api-version v2 --as user \
    --doc "$DOC_TOKEN" \
    --command overwrite \
    --doc-format markdown \
    --content "@$MD_REL"
else
  echo "正在创建飞书云文档（v2 API，Markdown）…"
  lark-cli docs +create --api-version v2 --as user \
    --title "$TITLE" \
    --doc-format markdown \
    --content "@$MD_REL" \
    --parent-position my_library
fi

echo "完成。"
