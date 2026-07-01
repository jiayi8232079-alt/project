// jsonl-merge.mjs · 把 Cursor 本地 agent-transcripts jsonl 合并入 sessions/<sid>/history.json
//
// 设计文档：docs/superpowers/specs/2026-05-27-jsonl-merge-history-design.md
// 实施计划：docs/superpowers/plans/2026-05-27-jsonl-merge-history.md

import { join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * 把工作区路径转成 Cursor 项目 ID（小写盘符 + "-" + 路径段连接）。
 *
 * 实测样本：
 *  - d:\BajieAsk                 -> d-BajieAsk
 *  - d:\cursor\resources\app     -> d-cursor-resources-app
 *  - D:/BajieAsk                 -> d-BajieAsk
 *  - ''                          -> ''
 *
 * 反向推导有歧义（d-foo-bar 可能对应 d:\foo\bar 或 d:\foo-bar），故本工具仅做正向。
 */
export function workspacePathToProjectId(workspacePath) {
  if (!workspacePath || typeof workspacePath !== 'string') return '';
  const norm = workspacePath.replace(/\\/g, '/');
  const parts = norm.split('/').filter(Boolean);
  if (parts.length === 0) return '';
  const drive = parts[0].replace(':', '').toLowerCase();
  return [drive, ...parts.slice(1)].join('-');
}

/**
 * 拼接 Cursor agent-transcripts jsonl 路径：
 *   <homedir>/.cursor/projects/<projectId>/agent-transcripts/<composerId>/<composerId>.jsonl
 *
 * 走 path.join，跟随当前平台分隔符（Windows 为 \，POSIX 为 /）。
 * 参数任一为空 → 返回空串（调用方自决跳过）。
 */
export function resolveJsonlPath({ homedir, workspacePath, composerId }) {
  if (!homedir || !workspacePath || !composerId) return '';
  const projectId = workspacePathToProjectId(workspacePath);
  if (!projectId) return '';
  return join(
    homedir,
    '.cursor',
    'projects',
    projectId,
    'agent-transcripts',
    composerId,
    `${composerId}.jsonl`,
  );
}

/**
 * 把 jsonl 单 turn 转成 history NDJSON 条目数组。
 *
 * 支持块类型：
 *  - text                  → role 跟 turn.role 走；user → user_msg；assistant → ai_thinking
 *  - tool_use              → role=assistant；wait_message / CallMcpTool(wait_message) → ai_wait_msg_call；其余 → ai_tool_use
 *  - 其余类型              → 忽略（jsonl 本身不记 tool_result）
 *
 * 同 turn 多块按顺序输出多条。
 */
export function jsonlTurnToHistoryEntries(turn, { composerId, baseTime }) {
  if (!turn || !turn.role || !turn.message) return [];
  const blocks = Array.isArray(turn.message.content) ? turn.message.content : [];
  const out = [];
  for (const block of blocks) {
    if (!block || !block.type) continue;
    const base = { source: 'jsonl', composerId, time: baseTime };

    if (block.type === 'text') {
      out.push({
        ...base,
        role: turn.role,
        kind: turn.role === 'user' ? 'user_msg' : 'ai_thinking',
        content: String(block.text || ''),
      });
      continue;
    }

    if (block.type === 'tool_use') {
      const toolName = String(block.name || 'unknown');
      const input = block.input || {};
      const isWaitMessage =
        toolName === 'wait_message' ||
        (toolName === 'CallMcpTool' && String(input.toolName || '') === 'wait_message');

      if (isWaitMessage) {
        out.push({
          ...base,
          role: 'assistant',
          kind: 'ai_wait_msg_call',
          content: 'wait_message',
          toolName,
        });
        continue;
      }

      let inputPreview;
      try {
        inputPreview = JSON.stringify(input).slice(0, 1000);
      } catch {
        inputPreview = '[unstringifiable input]';
      }
      out.push({
        ...base,
        role: 'assistant',
        kind: 'ai_tool_use',
        content: `${toolName}: ${inputPreview}`,
        toolName,
        toolInput: input,
      });
      continue;
    }
  }
  return out;
}

const WAIT_FOLD_THRESHOLD = 3;

/**
 * 把连续 ≥3 条 ai_wait_msg_call 折叠为单条 wait_idle_summary，少于 3 条按原顺序保留。
 *
 * 折叠条目格式：
 *  - kind: 'wait_idle_summary'
 *  - content: `等待 N 轮 · 全部 TIMEOUT`
 *  - time: 首轮 time
 *  - timeEnd: 末轮 time
 *  - agentStatus: 'waiting'
 *
 * 输入条目顺序假设已按 time 单调递增；非 ai_wait_msg_call 类型原样透传。
 */
export function collapseWaitIdleRuns(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const out = [];
  let runStart = -1;
  let runEnd = -1;

  const flushRun = () => {
    if (runStart < 0) return;
    const runLen = runEnd - runStart + 1;
    if (runLen >= WAIT_FOLD_THRESHOLD) {
      out.push({
        role: 'assistant',
        source: 'jsonl',
        kind: 'wait_idle_summary',
        content: `等待 ${runLen} 轮 · 全部 TIMEOUT`,
        time: entries[runStart].time,
        timeEnd: entries[runEnd].time,
        agentStatus: 'waiting',
        composerId: entries[runStart].composerId || '',
      });
    } else {
      for (let i = runStart; i <= runEnd; i++) out.push(entries[i]);
    }
    runStart = -1;
    runEnd = -1;
  };

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e && e.kind === 'ai_wait_msg_call') {
      if (runStart < 0) runStart = i;
      runEnd = i;
      continue;
    }
    flushRun();
    out.push(e);
  }
  flushRun();
  return out;
}

/**
 * 计算 history.json 条目去重 key：time 截到 1s 精度 + role + content sha1 前 32 位。
 *
 * 同 key 视为同一条消息：
 *  - mcp 源条目先入集合
 *  - jsonl 源条目同 key 直接跳过（避免重复合并）
 */
export function mergeDedupKey(entry) {
  if (!entry) return '';
  const tRaw = String(entry.time || '');
  const t = tRaw.length >= 19 ? tRaw.slice(0, 19) : tRaw;
  const r = String(entry.role || '');
  const c = String(entry.content || '').trim();
  const h = createHash('sha1').update(c).digest('hex').slice(0, 32);
  return `${t}|${r}|${h}`;
}
