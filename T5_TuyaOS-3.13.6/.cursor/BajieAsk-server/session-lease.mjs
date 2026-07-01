// Session lease for the channel-handoff feature. A lease records which poller
// (Cursor client / server process) currently owns a session's wait loop, so a
// second client can take over (claim_channel) without two pollers double-reading
// the same inbox. Guarded entirely by LEASE_ENABLED in index.mjs — when disabled,
// none of this runs and behavior is identical to before.
//
// lease.json shape: { holderToken, pid, clientId, acquiredAt, renewAt, ttlMs }
// A lease is "expired" when now > renewAt + ttlMs (default ttlMs = 3 heartbeats).
// All read-modify-write goes through the hardened file-lock (lease:<sid> scope).
import { withLock, tryWithLock } from "./file-lock.mjs";
import { readFileSync, writeFileSync, unlinkSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

function _readLease(leasePath) {
  try { return JSON.parse(readFileSync(leasePath, "utf-8")); }
  catch { return null; }
}

function _writeLease(leasePath, obj) {
  try { const d = dirname(leasePath); if (!existsSync(d)) mkdirSync(d, { recursive: true }); }
  catch { /* ignore */ }
  // [harden1-1] Atomic write: stage to tmp then rename over the target, so the
  // lock-free leaseHeldBy() reader can never observe a half-written lease body
  // (mirrors inbox-queue.mjs). Writes here are already under the lease lock; the
  // atomicity protects the unlocked reader specifically.
  const tmp = `${leasePath}.tmp.${Math.random().toString(36).slice(2, 8)}`;
  writeFileSync(tmp, JSON.stringify(obj), { encoding: "utf-8", mode: 0o600 });
  try {
    renameSync(tmp, leasePath);
  } catch {
    // Windows: rename may fail if target is briefly locked → remove then rename.
    try { unlinkSync(leasePath); } catch { /* ignore */ }
    try { renameSync(tmp, leasePath); }
    catch { try { writeFileSync(leasePath, JSON.stringify(obj)); } catch { /* ignore */ } try { unlinkSync(tmp); } catch { /* ignore */ } }
  }
}

export function isLeaseExpired(lease, now = Date.now()) {
  if (!lease || typeof lease.renewAt !== "number") return true;
  const ttl = typeof lease.ttlMs === "number" && lease.ttlMs > 0 ? lease.ttlMs : 0;
  return now > lease.renewAt + ttl;
}

// CAS acquire / renew / preempt-expired, all under the lease lock.
// Returns { held, token, preempted, lease, holder? }.
//  - no lease            → first-come-first-served, write ours, held=true
//  - lease is ours       → renew (bump renewAt), held=true
//  - lease is someone's, expired → preempt, held=true, preempted=true
//  - lease is someone's, fresh   → held=false, holder=<theirToken>
export function acquireOrRenewLease(lockPath, leasePath, { token, pid, clientId, ttlMs, now = Date.now() }) {
  return withLock(lockPath, () => {
    const cur = _readLease(leasePath);
    if (!cur) {
      const lease = { holderToken: token, pid, clientId, acquiredAt: now, renewAt: now, ttlMs };
      _writeLease(leasePath, lease);
      return { held: true, token, preempted: false, lease };
    }
    if (cur.holderToken === token) {
      cur.renewAt = now;
      cur.ttlMs = ttlMs;
      cur.pid = pid;
      if (clientId) cur.clientId = clientId;
      _writeLease(leasePath, cur);
      return { held: true, token, preempted: false, lease: cur };
    }
    if (isLeaseExpired(cur, now)) {
      const lease = { holderToken: token, pid, clientId, acquiredAt: now, renewAt: now, ttlMs };
      _writeLease(leasePath, lease);
      return { held: true, token, preempted: true, lease };
    }
    return { held: false, token: null, preempted: false, lease: cur, holder: cur.holderToken };
  });
}

// Forcefully claim the lease for a new owner (claim_channel). Always wins unless
// it already belongs to `token`. Returns { ok, prevHolder, lease }.
export function claimLease(lockPath, leasePath, { token, pid, clientId, ttlMs, now = Date.now() }) {
  return withLock(lockPath, () => {
    const cur = _readLease(leasePath);
    const prevHolder = cur && cur.holderToken !== token ? cur.holderToken : null;
    const lease = { holderToken: token, pid, clientId, acquiredAt: now, renewAt: now, ttlMs };
    _writeLease(leasePath, lease);
    return { ok: true, prevHolder, lease };
  });
}

// Lock-free read: does `token` currently hold a non-expired lease?
// No lease at all → false (strict): callers acquire first, so during polling the
// lease always exists and belongs to the holder.
export function leaseHeldBy(leasePath, token, now = Date.now()) {
  const cur = _readLease(leasePath);
  if (!cur) return false;
  if (cur.holderToken !== token) return false;
  return !isLeaseExpired(cur, now);
}

// Single source of truth for the atomic poll gate, shared by index.mjs
// waitForSessionMessage and the relay E2E test so the test drives the real gate
// code path rather than a hand-copied replica (prevents drift between them).
// Ownership check AND dequeue happen inside ONE non-blocking lease lock; claim
// takes the same lock, so it can never interleave between check and dequeue.
//   - lock not acquired → { ok:false } (caller falls through to sleep + re-poll)
//   - lease not ours     → { ok:true, value:{ handoff:true } }
//   - otherwise          → { ok:true, value:{ msg } } (msg null when inbox empty)
// dequeueFirst is injected to keep this module free of an inbox-queue dependency.
export function leaseGateDequeue(lockPath, leasePath, token, inboxPath, dequeueFirst, now = Date.now()) {
  return tryWithLock(lockPath, () => {
    if (!leaseHeldBy(leasePath, token, now)) return { handoff: true };
    return { msg: dequeueFirst(inboxPath) };
  });
}

export function readLease(leasePath) {
  return _readLease(leasePath);
}

// Release only if we still own it.
export function releaseLease(lockPath, leasePath, token) {
  return withLock(lockPath, () => {
    const cur = _readLease(leasePath);
    if (cur && cur.holderToken === token) {
      try { unlinkSync(leasePath); } catch { /* ignore */ }
      return true;
    }
    return false;
  });
}
