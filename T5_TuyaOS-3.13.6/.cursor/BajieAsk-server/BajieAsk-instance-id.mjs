/**
 * 统一隔离·支柱2（方案 B · 2026-06-18）：MCP server 侧「按工作区路径派生 instanceId」纯逻辑（ESM）。
 *
 * 必须与 src/BajieAsk-instance-id.js（host/extension 侧 CJS）**逐字节一致**——否则 host 读
 * instances/<hostHash>、MCP 写 instances/<mcpHash> → 面板空。两端一致性由
 * src/BajieAsk-instance-id-crossimpl.test.mjs 钉死。改其一必须同步改另一并跑该测试。
 *
 * 背景：全局 mcp.json 的 BajieAsk_INSTANCE_ID env 被最后激活窗口覆盖 → 多窗口同 instanceId → 会话串台。
 * 方案 B：mcp.json 给 BajieAsk 条目加 cwd=${workspaceFolder}，MCP server 用 process.cwd() 自派生
 * 工作区 hash instanceId（与 host getInstanceId 对齐），无需 per-workspace mcp.json。
 */

import crypto from "crypto";

export const INSTANCE_ID_PREFIX = "BajieAsk-ws-";
export const NO_WORKSPACE_KEY = "__no_workspace__";

/**
 * 把工作区文件夹列表 + 远端 scope 归一化成稳定 key（与 src 实现一致）。
 * Windows 大小写不敏感；多根工作区排序后拼接；空工作区用固定占位。
 */
export function normalizeWorkspaceKey(workspacePaths, remoteScope) {
  const isWin = process.platform === "win32";
  const arr = Array.isArray(workspacePaths) ? workspacePaths : [];
  const norm = arr
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .map((p) => {
      // 统一斜杠方向为当前平台原生分隔符：吸收 webview 反斜杠 fsPath 与 mcp-server 侧
      // WORKSPACE_FOLDER_PATHS 可能的正斜杠/混合写法差异，否则同一工作区两端算出不同 hash → 面板串台。
      let s = isWin ? p.replace(/\//g, "\\") : p.replace(/\\/g, "/");
      // 去尾部分隔符（保留纯根如 "C:\" / "/"，避免归一成空）。
      const stripped = s.replace(/[\\/]+$/, "");
      s = stripped || s;
      // Windows 路径大小写不敏感。
      return isWin ? s.toLowerCase() : s;
    })
    .filter(Boolean)
    .sort();
  const scope = String(remoteScope || "").trim();
  const body = norm.length ? norm.join("|") : NO_WORKSPACE_KEY;
  return scope ? `${scope}|${body}` : body;
}

/**
 * 由工作区 key 派生稳定 instanceId（`BajieAsk-ws-<sha256 前 8 hex>`）。
 */
export function deriveWorkspaceInstanceId(workspacePaths, remoteScope) {
  const key = normalizeWorkspaceKey(workspacePaths, remoteScope);
  const hash = crypto.createHash("sha256").update(key).digest("hex").slice(0, 8);
  return `${INSTANCE_ID_PREFIX}${hash}`;
}

export default { INSTANCE_ID_PREFIX, NO_WORKSPACE_KEY, normalizeWorkspaceKey, deriveWorkspaceInstanceId };
