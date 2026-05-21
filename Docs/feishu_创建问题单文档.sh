#!/usr/bin/env bash
# 在本地终端执行：先完成飞书用户授权，再创建云文档（Markdown → 飞书 docx）
#
# 参考：飞书 CLI 安装与使用（官方博客）
# https://www.feishu.cn/content/article/7623291503305083853
#
# 前置：
#   1) 已安装 lark-cli（推荐）：  npx @larksuite/cli@latest install
#      或升级：  lark-cli update
#   2) 至少执行过一次配置（若未配置）：按官方文档完成 lark-cli 初始化
#   3) 用户授权（token 过期时必须重做，会打开浏览器）：
#        lark-cli auth login
#
# 若要把文档建到「指定知识库节点」下，请改用 --parent-token（wiki 节点 token），
# 并去掉 --parent-position my_library（需自行查 lark-cli wiki nodes 帮助）。

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v lark-cli >/dev/null 2>&1; then
  echo "未找到 lark-cli，请先安装：npx @larksuite/cli@latest install" >&2
  exit 1
fi

echo "提示：若创建失败并提示 need_user_authorization，请先执行 lark-cli auth login 完成浏览器授权。"

TITLE="问题单：涂鸦云 BLE 配网添加设备失败"
MD_REL="./Docs/问题单_涂鸦云BLE配网添加设备失败.md"

if [[ ! -f "$MD_REL" ]]; then
  echo "找不到 Markdown 源文件：$MD_REL" >&2
  exit 3
fi

echo "正在创建飞书云文档（v2 API，Markdown）…"
lark-cli docs +create --api-version v2 --as user \
  --title "$TITLE" \
  --doc-format markdown \
  --content "@$MD_REL" \
  --parent-position my_library

echo "完成。若上方 JSON 中含文档链接或 token，请复制保存。"
