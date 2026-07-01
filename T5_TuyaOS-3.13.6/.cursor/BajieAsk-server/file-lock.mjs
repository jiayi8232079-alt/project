// Cross-process advisory file lock for BajieAsk session inboxes.
//
// Extracted from index.mjs (was ~lines 1726-1776) and hardened. The lock file
// is sessions/<sid>/inbox.lock and the on-disk protocol is SHARED with the VS
// Code extension (src/BajieAsk-session-model.js). To stay byte-compatible with the
// extension's reader the lock body is STILL a JSON object that carries a numeric
// `timestamp` field. Server-side hardening below needs no extension rebuild:
//
//   - staleness is judged by file mtime, never by parsing the lock body, so a
//     half-written / empty lock body can no longer be misread as "corrupt" and
//     stolen (fixes the parse-steal race that dropped messages under load);
//   - openSync(wx) tolerates EPERM/EBUSY — Windows surfaces these (not EEXIST)
//     when a lock file is pending-deletion — instead of throwing (fixes crashes);
//   - the lock body carries a unique owner token; releaseLock only unlinks when
//     the on-disk token still matches, so a process can never delete a lock that
//     was stale-stolen from it (fix B);
//   - acquireLock throws on timeout, so withLock never runs the critical section
//     unlocked, and tryWithLock degrades to {ok:false} so pollers retry next
//     tick (fix A — no more unlocked read-modify-write).
import {
  writeFileSync, readFileSync, unlinkSync, statSync, openSync, closeSync,
  mkdirSync, existsSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";

export const LOCK_POLL_MS = 5;
export const LOCK_MAX_ATTEMPTS = 200;
export const LOCK_STALE_MS = 5000;

const _sleepBuf = new Int32Array(new SharedArrayBuffer(4));
function _syncSleep(ms) {
  try { Atomics.wait(_sleepBuf, 0, 0, Math.max(1, ms)); }
  catch { const end = Date.now() + ms; while (Date.now() < end) { /* spin */ } }
}

function _ensureDir(p) {
  try { if (!existsSync(p)) mkdirSync(p, { recursive: true }); } catch { /* ignore */ }
}

export function newToken() {
  return `${process.pid}-${Date.now()}-${randomBytes(6).toString("hex")}`;
}

// Acquire an exclusive advisory lock. Returns an opaque owner token on success.
// Throws after maxAttempts*pollMs ms so callers never proceed without the lock.
export function acquireLock(lockPath, {
  pollMs = LOCK_POLL_MS,
  maxAttempts = LOCK_MAX_ATTEMPTS,
  staleMs = LOCK_STALE_MS,
  holder = "mcp-server",
} = {}) {
  _ensureDir(dirname(lockPath));
  const token = newToken();
  const payload = JSON.stringify({ pid: process.pid, timestamp: Date.now(), token, holder });
  for (let i = 0; i < maxAttempts; i++) {
    let fd;
    try {
      fd = openSync(lockPath, "wx");
    } catch (e) {
      // Windows pending-delete surfaces EPERM/EBUSY instead of EEXIST.
      if (e.code !== "EEXIST" && e.code !== "EPERM" && e.code !== "EBUSY") throw e;
      // Stale detection by mtime ONLY — never parse the (possibly partial) body.
      let st;
      try { st = statSync(lockPath); }
      catch { _syncSleep(pollMs); continue; } // lock vanished → retry create
      if (Date.now() - st.mtimeMs > staleMs) {
        try { unlinkSync(lockPath); } catch { /* ignore */ }
        continue;
      }
      _syncSleep(pollMs);
      continue;
    }
    // Won the exclusive create — stamp the body, then hold the lock.
    try { writeFileSync(fd, payload); } finally { closeSync(fd); }
    return token;
  }
  throw new Error(`[LOCK TIMEOUT] ${lockPath} after ${maxAttempts * pollMs}ms`);
}

// Release a lock only if we still own it (on-disk token matches). Returns true
// when this call removed the lock file.
export function releaseLock(lockPath, token) {
  if (token != null) {
    try {
      const cur = JSON.parse(readFileSync(lockPath, "utf-8"));
      if (cur && typeof cur.token === "string" && cur.token !== token) {
        return false; // stale-stolen by another owner — do not delete theirs
      }
    } catch (e) {
      if (e.code === "ENOENT") return false; // already released
      // unreadable/half-written: fall through to best-effort unlink of ours
    }
  }
  try { unlinkSync(lockPath); return true; } catch { return false; }
}

// Run fn while holding the lock. Always releases. Throws (never runs fn) if the
// lock cannot be acquired within the budget.
export function withLock(lockPath, fn, opts) {
  const token = acquireLock(lockPath, opts);
  try { return fn(); }
  finally { releaseLock(lockPath, token); }
}

// Like withLock but returns { ok:false } instead of throwing when the lock
// cannot be acquired — callers degrade gracefully (e.g. retry on next poll).
export function tryWithLock(lockPath, fn, opts) {
  let token;
  try { token = acquireLock(lockPath, opts); }
  catch { return { ok: false }; }
  try { return { ok: true, value: fn() }; }
  finally { releaseLock(lockPath, token); }
}
