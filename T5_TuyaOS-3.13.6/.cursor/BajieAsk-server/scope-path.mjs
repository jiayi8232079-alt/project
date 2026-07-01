// Maps a withScopeLock / memory scope string to relative path SEGMENTS under
// memoriesDir. Extracted as a pure, testable function (index.mjs joins these
// onto memoriesDir in memoryScopeDir).
//
// [M1] Lock-only scopes (dispatch-plan:/session-history:/legacy-reply:/__events__)
// used to fall through to ["global"], so every dispatchId ACK, every sid history
// write, events, legacy-reply AND global-memory KV all collapsed onto one lock
// (memories/global/.lock). That serialized unrelated work across all agents — an
// activity stall that A3's throw-on-timeout turned into 2000ms LOCK TIMEOUT
// errors under load. Each lock-only scope now gets its own per-key directory.
//
// global/group:/session: segments are intentionally UNCHANGED so existing memory
// KV files (memories/global, memories/group/<id>, memories/session/<sid>) keep
// their locations — only the previously-colliding lock scopes move.

// Sanitize a single path segment: keep filesystem- and Windows-safe chars only
// (note: ':' is excluded — it is illegal in Windows path segments), cap length,
// and guard against path traversal from caller-supplied ids (e.g. dispatchId).
export function safeScopeSeg(s) {
  return String(s || "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128) || "_";
}

export function scopeToSegments(scope) {
  const s = String(scope || "global").trim();
  if (s === "global") return ["global"];
  if (s.startsWith("group:")) return ["group", s.slice(6)];
  if (s.startsWith("session:")) return ["session", s.slice(8)];
  // Lock-only scopes → dedicated per-key directories (see header).
  if (s.startsWith("dispatch-plan:")) return ["locks", "dispatch-plan", safeScopeSeg(s.slice(14))];
  if (s.startsWith("session-history:")) return ["locks", "session-history", safeScopeSeg(s.slice(16))];
  if (s.startsWith("legacy-reply:")) return ["locks", "legacy-reply", safeScopeSeg(s.slice(13))];
  if (s.startsWith("lease:")) return ["locks", "lease", safeScopeSeg(s.slice(6))];
  if (s === "__events__") return ["locks", "events"];
  // Unrecognized → global (keep unknown KV scopes from scattering).
  return ["global"];
}
