// Per-session inbox message queue for BajieAsk. Extracted from index.mjs
// (was ~lines 1778-1939) and wired onto the hardened file-lock. Each session
// inbox is sessions/<sid>/inbox.json; the sibling inbox.lock serializes every
// read-modify-write. Function signatures are path-based and unchanged, so the
// many index.mjs call sites keep working as-is.
import {
  readFileSync, writeFileSync, statSync, openSync, closeSync, fsyncSync,
  renameSync, unlinkSync, copyFileSync, existsSync, mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { withLock, tryWithLock } from "./file-lock.mjs";

export const ATTACHMENT_INLINE_MAX_BYTES = 64 * 1024;

function _lockPathFor(inboxPath) {
  return join(dirname(inboxPath), "inbox.lock");
}

// Atomic JSON write (mirrors index.mjs atomicWriteJSON compact path): write a
// tmp file, fsync, then rename over the target. On Windows where rename may fail
// when the target is locked, rotate target → .old first and keep it as fallback.
function _atomicWriteJSON(filePath, dataObj) {
  const dir = dirname(filePath);
  try { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
  const tmp = filePath + ".tmp." + Math.random().toString(36).slice(2, 8);
  const json = JSON.stringify(dataObj);
  writeFileSync(tmp, json, { encoding: "utf-8", mode: 0o600 });
  try { const fd = openSync(tmp, "r+"); try { fsyncSync(fd); } finally { closeSync(fd); } }
  catch { /* fsync best-effort */ }
  try {
    renameSync(tmp, filePath);
  } catch {
    const old = filePath + ".old." + Math.random().toString(36).slice(2, 8);
    try { renameSync(filePath, old); } catch { /* target may not exist */ }
    try { renameSync(tmp, filePath); } catch { copyFileSync(tmp, filePath); }
    try { unlinkSync(tmp); } catch { /* ignore */ }
    try {
      readFileSync(filePath, "utf-8");
      try { unlinkSync(old); } catch { /* ignore */ }
    } catch {
      try { renameSync(old, filePath); } catch { /* ignore */ }
    }
  }
}

export function readInbox(path) {
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    return data && Array.isArray(data.messages) ? data.messages : [];
  } catch (e) {
    if (e.code === "ENOENT") return [];
    // Transient concurrent-access errors: retry once (matches readJSON).
    if (e.code === "EBUSY" || e.code === "EACCES" || e.code === "EPERM") {
      try {
        const data = JSON.parse(readFileSync(path, "utf-8"));
        return data && Array.isArray(data.messages) ? data.messages : [];
      } catch { return []; }
    }
    return []; // corrupt → empty fallback
  }
}

// path → { mtimeMs, empty, msgs } fast-path cache. Kept module-local; index.mjs
// invalidates via invalidateInboxCache() on session cleanup.
const _inboxMtimeCache = new Map();

export function invalidateInboxCache(path) {
  _inboxMtimeCache.delete(path);
}

export function writeInbox(path, messages) {
  _atomicWriteJSON(path, { messages });
  try {
    _inboxMtimeCache.set(path, {
      mtimeMs: statSync(path).mtimeMs,
      empty: messages.length === 0,
      msgs: messages,
    });
  } catch { /* ignore */ }
}

function _sanitizeAttachmentData(item) {
  if (!item || typeof item !== "object") return item;
  const sanitized = { ...item };
  if (Array.isArray(sanitized.images)) {
    sanitized.images = sanitized.images.map((img) => {
      if (!img?.data || typeof img.data !== "string") return img;
      const byteLen = Math.ceil(img.data.length * 3 / 4);
      if (byteLen <= ATTACHMENT_INLINE_MAX_BYTES) return img;
      return {
        mimeType: img.mimeType,
        _stripped: true,
        _originalSize: byteLen,
        _reason: `base64 data stripped (${(byteLen / 1024).toFixed(1)}KB > ${ATTACHMENT_INLINE_MAX_BYTES / 1024}KB limit)`,
      };
    });
  }
  if (Array.isArray(sanitized.files)) {
    sanitized.files = sanitized.files.map((f) => {
      if (!f?.data || typeof f.data !== "string") return f;
      const byteLen = Math.ceil(f.data.length * 3 / 4);
      if (byteLen <= ATTACHMENT_INLINE_MAX_BYTES) return f;
      return {
        name: f.name,
        mimeType: f.mimeType,
        _stripped: true,
        _originalSize: byteLen,
        _reason: `base64 data stripped (${(byteLen / 1024).toFixed(1)}KB > ${ATTACHMENT_INLINE_MAX_BYTES / 1024}KB limit)`,
      };
    });
  }
  return sanitized;
}

export function isKeepaliveMsg(m) {
  if (!m || typeof m !== "object") return false;
  return m.type === "auto_keepalive" || m.isAutoQuestion === true;
}

// §0 SUPREME RULE priority: user > agent inter-message > keepalive.
export function isUserMsg(m) {
  if (!m || typeof m !== "object") return false;
  if (isKeepaliveMsg(m)) return false;
  const from = typeof m.from === "string" ? m.from : "";
  const content = typeof m.content === "string" ? m.content : "";
  if (!from || from === "user") return true;
  if (/^\[FROM:/.test(content)) return false;
  return true;
}

function _dequeueFromMsgs(path, msgsCandidate) {
  if (msgsCandidate.length === 0) {
    try {
      _inboxMtimeCache.set(path, { mtimeMs: statSync(path).mtimeMs, empty: true, msgs: [] });
    } catch { /* ignore */ }
    return null;
  }
  // Priority 1/2/3
  let pickedIdx = msgsCandidate.findIndex(isUserMsg);
  if (pickedIdx < 0) pickedIdx = msgsCandidate.findIndex((m) => !isKeepaliveMsg(m));
  if (pickedIdx < 0) pickedIdx = 0;

  const picked = msgsCandidate[pickedIdx];
  const rest = msgsCandidate.filter((_, i) => i !== pickedIdx);
  writeInbox(path, rest);
  return picked;
}

export function enqueueInbox(path, item) {
  if (!path) return;
  const lockPath = _lockPathFor(path);
  withLock(lockPath, () => {
    const msgs = readInbox(path);
    msgs.push(_sanitizeAttachmentData(item));
    writeInbox(path, msgs);
  });
}

export function dequeueFirst(path) {
  if (!path) return null;
  // [A1] Lock-free fast skip ONLY when the cache says empty AND mtime is
  // unchanged. We deliberately no longer serve messages out of the in-process
  // cache: under cross-process writes the filesystem mtime can collide within
  // its resolution, so trusting cache.msgs could silently overwrite another
  // process's enqueue. The critical section below ALWAYS re-reads from disk,
  // which is the single source of truth.
  try {
    const st = statSync(path);
    const cached = _inboxMtimeCache.get(path);
    if (cached && cached.mtimeMs === st.mtimeMs && cached.empty) return null;
  } catch (e) {
    if (e.code === "ENOENT") return null;
  }

  const lockPath = _lockPathFor(path);
  const r = tryWithLock(lockPath, () => {
    const msgs = readInbox(path); // authoritative re-read inside the lock
    return _dequeueFromMsgs(path, msgs);
  });
  return r.ok ? r.value : null; // lock-timeout → null (poller retries next tick)
}
