/**
 * BajieAsk · 本地技能 Manifest 注入模块（方案 B v3 · 全量本地 + AI 自选）
 *
 * 与 `mcp-server/index.mjs` 的 wait_message handler 配套：
 *   - 仅在「会话首条 user 消息」尾部注入 [SKILL_MANIFEST] 全量本地清单
 *   - 每条 user 消息尾部注入 [SKILL_RECEIPT_REQUIRED] 回执提醒（renderSkillReceiptReminder）
 *   - 让 AI 直接基于 slug + name + 截断 description 自行判断需读哪个 skill
 *   - reply_message handler 用 hasSkillReceipt() 软校验「已参考技能：」回执是否存在
 *   - 不再做算法预筛 / 评分匹配（v2 的 scoreSkill / matchSkillsByMessage 已废弃）
 *
 * 仅读本地后端目录 `mcp-server/role-skills/<category>/<slug>.md`，
 * 永不读取 `skills-cache/`（远程缓存，仅用户手动本地化用，禁止运行时依赖）。
 *
 * 四重门禁仍由 caller 实现：
 *   G1 仅 user 消息触发
 *   G2 role 无关（manifest 对所有 role 共用一份）
 *   G3 携带 [ROLE_HINT:<slug>] 时跳过
 *   G4 仅首条 user 注入（caller 维护 _sessionManifestInjected 状态）
 *
 * 兼容性：保留 readSkillMatchConfig / normalizeSkillMatchConfig / shouldMatch
 *        移除 loadSkillIndex / scoreSkill / matchSkillsByMessage / renderCandidates /
 *             renderDispatchHint / setSkillIndexPath / pickRenderer / getSkillIndexStats
 */

import { readFileSync, statSync, existsSync, readdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROLE_SKILLS_DIR = join(__dirname, "role-skills");

const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  descTruncate: 80,
  rawInjection: "off",
});

let _roleSkillsDir = DEFAULT_ROLE_SKILLS_DIR;
let _manifestCache = null;
let _manifestCacheKey = "";
let _manifestLoadedAt = 0;

export function setRoleSkillsDir(dir) {
  if (dir && typeof dir === "string") {
    _roleSkillsDir = dir;
    _manifestCache = null;
    _manifestCacheKey = "";
  }
}

export function getRoleSkillsDir() {
  return _roleSkillsDir;
}

const ASCII_TOKEN_RE = /[a-z0-9][a-z0-9_-]*/g;

export function tokenizeAscii(text) {
  if (!text || typeof text !== "string") return [];
  const lower = text.toLowerCase();
  const tokens = lower.match(ASCII_TOKEN_RE);
  return tokens ? Array.from(new Set(tokens)) : [];
}

export function parseFrontmatter(mdText) {
  if (typeof mdText !== "string" || mdText.length === 0) return null;
  const normalized = mdText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const m = normalized.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return null;
  const block = m[1];
  const out = {};
  const lines = block.split("\n");
  for (const line of lines) {
    if (!line || /^\s*#/.test(line)) continue;
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].trim();
    let val = kv[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

function _safeStat(p) {
  try { return statSync(p); } catch { return null; }
}

function _safeReaddir(p) {
  try { return readdirSync(p, { withFileTypes: true }); } catch { return []; }
}

function _computeDirCacheKey(dir) {
  const st = _safeStat(dir);
  if (!st) return "";
  const parts = [`r:${st.mtimeMs}`];
  const sub = _safeReaddir(dir);
  for (const ent of sub) {
    if (!ent.isDirectory()) continue;
    const subSt = _safeStat(join(dir, ent.name));
    if (subSt) parts.push(`${ent.name}:${subSt.mtimeMs}`);
  }
  return parts.join("|");
}

export function buildManifestFromRoleSkillsDir(dir) {
  const root = dir || _roleSkillsDir;
  if (!root || !existsSync(root)) return [];
  const entries = [];
  const categories = _safeReaddir(root);
  for (const catEnt of categories) {
    if (!catEnt.isDirectory()) continue;
    const catDir = join(root, catEnt.name);
    const category = catEnt.name;
    const files = _safeReaddir(catDir);
    for (const fileEnt of files) {
      if (!fileEnt.isFile() || !fileEnt.name.endsWith(".md")) continue;
      const slug = basename(fileEnt.name, ".md");
      const filePath = join(catDir, fileEnt.name);
      let text = "";
      try { text = readFileSync(filePath, "utf-8"); } catch { continue; }
      const fm = parseFrontmatter(text);
      if (!fm) continue;
      const name = (fm.name && typeof fm.name === "string") ? fm.name : slug;
      const description = (fm.description && typeof fm.description === "string") ? fm.description : "";
      entries.push({ slug, category, name, description });
    }
  }
  entries.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.slug.localeCompare(b.slug);
  });
  return entries;
}

export function loadManifest(dir) {
  const root = dir || _roleSkillsDir;
  const cacheKey = _computeDirCacheKey(root);
  if (_manifestCache && cacheKey && cacheKey === _manifestCacheKey) {
    return _manifestCache;
  }
  const entries = buildManifestFromRoleSkillsDir(root);
  _manifestCache = entries;
  _manifestCacheKey = cacheKey;
  _manifestLoadedAt = Date.now();
  return entries;
}

export function getManifestStats() {
  return {
    loaded: _manifestCache !== null,
    count: _manifestCache ? _manifestCache.length : 0,
    cacheKey: _manifestCacheKey,
    loadedAt: _manifestLoadedAt,
    dir: _roleSkillsDir,
  };
}

function _escapePipe(s) {
  return String(s == null ? "" : s).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function _truncate(s, max) {
  if (typeof s !== "string") return "";
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

export function renderSkillManifest(entries, opts) {
  if (!Array.isArray(entries) || entries.length === 0) return "";
  const _opts = opts || {};
  const truncate = Number.isFinite(_opts.descTruncate) && _opts.descTruncate > 0
    ? _opts.descTruncate : DEFAULT_CONFIG.descTruncate;
  const rows = entries.map((e) => {
    const desc = _truncate(e.description || "", truncate);
    return `| ${_escapePipe(e.category)} | ${_escapePipe(e.slug)} | ${_escapePipe(e.name)} | ${_escapePipe(desc)} |`;
  }).join("\n");
  // [SSH/远程修复 2026-06-12] 注解给出 role-skills 的「实际目录」绝对路径，不再硬编码相对路径
  // `mcp-server/role-skills/`。普通用户 / SSH 远程工作区根没有 mcp-server/ 目录（技能实际部署在
  // serverDir 下的 .cursor/BajieAsk-server/role-skills/），AI 按相对路径 Read 会"召回失败没找到"。
  // _roleSkillsDir 跟随 mcp-server 部署位置（__dirname/role-skills），是 AI 唯一可靠的读取根。
  const _realDir = (typeof _opts.roleSkillsDir === "string" && _opts.roleSkillsDir) ? _opts.roleSkillsDir : getRoleSkillsDir();
  const note = "注：以上为本地全量 skill 清单。**实际目录（务必按此读取）**：`" + _realDir + "`。如需加载某 skill 正文，请 Read `" + _realDir + "/<category>/<slug>.md`（SSH / 远程 / 非源码工作区下，工作区根通常没有 `mcp-server/role-skills/`，必须用上面这个实际目录的绝对路径）。本清单仅在会话首条 user 消息附带一次，后续轮次不再重复。**每轮 reply_message 末尾必须输出一行『已参考技能：…』回执**（即使为『无』），供用户核对技能是否真实调用。";
  return `\n\n---\n[SKILL_MANIFEST] 共 ${entries.length} 个本地 skill · 实际目录 ${_realDir}\n| category | slug | name | description |\n|---|---|---|---|\n${rows}\n${note}`;
}

// 每条 user 消息尾部注入的「回执提醒」段（E-D：不止首条 manifest，每轮都提醒）。
// 与 [SKILL_MANIFEST] 互补：manifest 只首条给一次，本提醒每条 user 消息都给，
// 确保 AI 任何一轮都被提示在 reply_message 末尾输出「已参考技能：」回执。
export function renderSkillReceiptReminder() {
  return (
    "\n\n---\n[SKILL_RECEIPT_REQUIRED] 本轮 reply_message 末尾必须输出一行回执：" +
    '"已参考技能：<category/slug>(must·已 Read)… / 无（候选均不命中本步骤）"，' +
    "供用户核对技能是否真实调用；缺失会被服务端标记 skillReceiptMissing=true。"
  );
}

// reply_message 软校验用：判断回复正文是否含「已参考技能：」回执行（兼容全角/半角冒号）。
export function hasSkillReceipt(text) {
  if (typeof text !== "string" || text.length === 0) return false;
  return /已参考技能\s*[:：]/.test(text);
}

function _clampInt(v, lo, hi, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

function _normalizeRawInjection(v) {
  const s = String(v == null ? "" : v).toLowerCase();
  if (s === "off" || s === "on" || s === "all") return s;
  return "off";
}

export function normalizeSkillMatchConfig(raw) {
  const r = (raw && typeof raw === "object") ? raw : {};
  return {
    enabled: r.enabled === false ? false : r.enabled === true ? true : DEFAULT_CONFIG.enabled,
    descTruncate: _clampInt(r.descTruncate, 20, 500, DEFAULT_CONFIG.descTruncate),
    rawInjection: _normalizeRawInjection(r.rawInjection),
  };
}

export function readSkillMatchConfig(instanceId, queueRoot) {
  if (!instanceId || !queueRoot) return { ...DEFAULT_CONFIG };
  const cfgPath = join(queueRoot, "instances", instanceId, "skill-match-config.json");
  try {
    if (!existsSync(cfgPath)) return { ...DEFAULT_CONFIG };
    const raw = readFileSync(cfgPath, "utf-8");
    const data = JSON.parse(raw);
    return normalizeSkillMatchConfig(data);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function shouldMatch(msg, roleHintSlug, cfg) {
  if (!cfg || cfg.enabled === false) return false;
  if (roleHintSlug) return false;
  if (!msg || typeof msg !== "object") return false;
  const t = msg.type || "";
  if (t === "user" || t === "") return true;
  return false;
}

export const __test = {
  DEFAULT_CONFIG,
  resetManifestCache() {
    _manifestCache = null;
    _manifestCacheKey = "";
    _manifestLoadedAt = 0;
  },
};
