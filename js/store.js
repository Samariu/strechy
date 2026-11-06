// Thin localStorage wrapper. Every access is guarded: Safari Private Browsing,
// storage-full and disabled storage must never break the app.

const NS = "strechy.v1.";
const HISTORY_CAP = 100;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(NS + key);
    else localStorage.setItem(NS + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_PREFS = { sound: true, vibrate: true, prepSeconds: 5 };

export function getPrefs() {
  const p = read("prefs", {});
  return { ...DEFAULT_PREFS, ...(p && typeof p === "object" ? p : {}) };
}

export function setPrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  write("prefs", next);
  return next;
}

export function getHistory() {
  const h = read("history", []);
  return Array.isArray(h) ? h : [];
}

/** @param {{programId:string, finishedAt:number, durationSec:number, holdsCompleted:number, holdsTotal:number}} entry */
export function addHistory(entry) {
  const h = [entry, ...getHistory()].slice(0, HISTORY_CAP);
  write("history", h);
  return h;
}

export function clearHistory() {
  write("history", null);
}

export function lastDone(programId) {
  const e = getHistory().find((x) => x.programId === programId);
  return e ? e.finishedAt : null;
}

export function getLastProgramId() {
  return read("lastProgramId", null);
}

export function setLastProgramId(id) {
  write("lastProgramId", id);
}

// In-progress session, so an iOS reload/kill mid-session can be resumed.
const ACTIVE_MAX_AGE_MS = 30 * 60 * 1000;

export function getActive() {
  const a = read("active", null);
  if (!a || typeof a !== "object") return null;
  if (Date.now() - (a.savedAt || 0) > ACTIVE_MAX_AGE_MS) {
    write("active", null);
    return null;
  }
  return a;
}

export function setActive(a) {
  write("active", a ? { ...a, savedAt: Date.now() } : null);
}
