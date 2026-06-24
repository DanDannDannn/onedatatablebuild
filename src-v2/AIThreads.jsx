// Forward AI — thread store
//
// Schema (localStorage key: fai-threads-v1):
//   [
//     {
//       id: "t_xxx",
//       title: "Q1 2026 footprint summary",
//       createdAt: ISO,
//       updatedAt: ISO,
//       turns: [
//         { id: "turn_xxx", q: "<question text>", key: "<suggestion key>",
//           createdAt: ISO, status: "thinking" | "done" }
//       ]
//     }
//   ]
//
// Pinned answers also reference these (threadId + turnId) so a pin on a board
// can deep-link back to its origin.

const FAI_THREADS_KEY     = "fai-threads-v1";
const FAI_ACTIVE_KEY      = "fai-active-thread";
const FAI_THREADS_EVT     = "fai-threads-changed";

function loadThreads() {
  try {
    const v = JSON.parse(localStorage.getItem(FAI_THREADS_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function saveThreads(arr) {
  localStorage.setItem(FAI_THREADS_KEY, JSON.stringify(arr));
  window.dispatchEvent(new CustomEvent(FAI_THREADS_EVT));
}

function getActiveThreadId() {
  return localStorage.getItem(FAI_ACTIVE_KEY) || null;
}
function setActiveThreadId(id) {
  if (id) localStorage.setItem(FAI_ACTIVE_KEY, id);
  else    localStorage.removeItem(FAI_ACTIVE_KEY);
  window.dispatchEvent(new CustomEvent(FAI_THREADS_EVT));
}

function rid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

// Auto-derive a thread title from its first question.
function deriveTitle(q) {
  if (!q) return "New thread";
  // Trim, drop trailing punctuation, cap at ~64 chars
  let t = q.trim().replace(/[?.!]+$/, "");
  if (t.length > 64) t = t.slice(0, 61).trimEnd() + "…";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function createThread({ firstQ = null, firstKey = null } = {}) {
  const id = rid("t");
  const now = new Date().toISOString();
  const turns = [];
  if (firstQ) {
    turns.push({
      id: rid("turn"),
      q: firstQ,
      key: firstKey || null,
      createdAt: now,
      status: "thinking",
    });
  }
  const t = {
    id,
    title: firstQ ? deriveTitle(firstQ) : "New thread",
    createdAt: now,
    updatedAt: now,
    turns,
  };
  saveThreads([t, ...loadThreads()]);
  setActiveThreadId(id);
  return t;
}

function addTurn(threadId, { q, key }) {
  const all = loadThreads();
  const idx = all.findIndex(t => t.id === threadId);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  const turn = { id: rid("turn"), q, key: key || null, createdAt: now, status: "thinking" };
  all[idx] = {
    ...all[idx],
    turns: [...all[idx].turns, turn],
    updatedAt: now,
    // First-question fallback rename if thread was empty
    title: all[idx].turns.length === 0 ? deriveTitle(q) : all[idx].title,
  };
  saveThreads(all);
  return turn;
}

function markTurnDone(threadId, turnId) {
  const all = loadThreads();
  const t = all.find(x => x.id === threadId);
  if (!t) return;
  t.turns = t.turns.map(tu => tu.id === turnId ? { ...tu, status: "done" } : tu);
  saveThreads(all);
}

function renameThread(threadId, title) {
  const all = loadThreads();
  const t = all.find(x => x.id === threadId);
  if (!t) return;
  t.title = title;
  saveThreads(all);
}

function deleteThread(threadId) {
  const all = loadThreads().filter(t => t.id !== threadId);
  saveThreads(all);
  if (getActiveThreadId() === threadId) {
    setActiveThreadId(all[0]?.id || null);
  }
}

function getThread(threadId) {
  return loadThreads().find(t => t.id === threadId) || null;
}

function deleteTurn(threadId, turnId) {
  const all = loadThreads();
  const t = all.find(x => x.id === threadId);
  if (!t) return;
  t.turns = t.turns.filter(tu => tu.id !== turnId);
  t.updatedAt = new Date().toISOString();
  saveThreads(all);
}

// Group threads by "Today / This week / Older" for the left rail.
function groupThreads(threads) {
  const groups = { today: [], week: [], older: [] };
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  threads.forEach(t => {
    const ts = new Date(t.updatedAt || t.createdAt).getTime();
    const ageDays = (now - ts) / dayMs;
    if (ageDays < 1)      groups.today.push(t);
    else if (ageDays < 7) groups.week.push(t);
    else                  groups.older.push(t);
  });
  // Most-recent first within each group
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  return groups;
}

function relativeTime(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)        return "Just now";
  if (diff < 3600)      return Math.floor(diff / 60) + "m ago";
  if (diff < 86400)     return Math.floor(diff / 3600) + "h ago";
  if (diff < 86400*7)   return Math.floor(diff / 86400) + "d ago";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// React hooks --------------------------------------------------------------
function useThreads() {
  const [threads, setThreads] = React.useState(loadThreads);
  React.useEffect(() => {
    const h = () => setThreads(loadThreads());
    window.addEventListener(FAI_THREADS_EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(FAI_THREADS_EVT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return threads;
}

function useActiveThread() {
  const [id, setId] = React.useState(getActiveThreadId);
  React.useEffect(() => {
    const h = () => setId(getActiveThreadId());
    window.addEventListener(FAI_THREADS_EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(FAI_THREADS_EVT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return id;
}

Object.assign(window, {
  // store
  loadThreads, saveThreads, createThread, addTurn, markTurnDone,
  renameThread, deleteThread, deleteTurn, getThread,
  getActiveThreadId, setActiveThreadId,
  // helpers
  deriveTitle, groupThreads, relativeTime,
  // hooks
  useThreads, useActiveThread,
  // constants
  FAI_THREADS_EVT,
});
