// "Offline-lite": when there is no signal, new farmers and drafts are kept
// on the phone (in localStorage) and sent later from the Sync screen.
// Everything is kept per signed-in user, so two people sharing a phone
// never see each other's pending work.

import { apiFetch, getApiUser } from "./api.js";

const BASE = "http://localhost:8000";

function read(key, fallback) {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// A request that never got an answer (no signal, or timed out) throws a
// TypeError or an AbortError. A server answer, even an error, does not.
export function isNetworkError(error) {
  return error instanceof TypeError || (error && error.name === "AbortError");
}

function announce() {
  window.dispatchEvent(new Event("pending-changed"));
}

// Times are stored in UTC; show them in the phone's own time zone.
// Today's times show just the clock time; older ones also show the date.
export function formatWhen(iso) {
  const date = new Date(iso);
  if (isNaN(date)) {
    return "";
  }
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---- The waiting list -------------------------------------------------

export function getPending(userId = getApiUser()) {
  return read(`pending_${userId}`, []);
}

function setPending(list, userId = getApiUser()) {
  const ok = write(`pending_${userId}`, list);
  announce();
  return ok;
}

// item: { lgId, lgCode, draftId, data, submit }
// Returns false if the phone had no room to keep it.
export function addPending(item) {
  const entry = {
    ...item,
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
  };
  return setPending([...getPending(), entry]);
}

export function removePending(key) {
  setPending(getPending().filter((item) => item.key !== key));
}

function updatePending(key, changes) {
  setPending(
    getPending().map((item) =>
      item.key === key ? { ...item, ...changes } : item,
    ),
  );
}

// ---- A saved copy of the learning-group list --------------------------
// Lets the facilitator open "Register farmer" with no signal.

export function saveLgCache(lgs) {
  write(`lgs_${getApiUser()}`, { savedAt: new Date().toISOString(), lgs });
}

export function readLgCache() {
  return read(`lgs_${getApiUser()}`, null);
}

export function getLastSync() {
  return read(`lastsync_${getApiUser()}`, null);
}

// Called when the person taps Sync and everything got through: the time
// becomes now, even if there was nothing to send.
export function markSynced() {
  if (getApiUser() !== null) {
    write(`lastsync_${getApiUser()}`, new Date().toISOString());
    announce();
  }
}

// ---- When data last reached the server --------------------------------
// apiFetch announces every successful save ("data-sent"); we keep the time.
window.addEventListener("data-sent", () => {
  if (getApiUser() !== null) {
    write(`lastsync_${getApiUser()}`, new Date().toISOString());
    announce();
  }
});

// ---- A saved copy of the dashboard numbers ----------------------------
// So the dashboard still shows something when there is no signal.

export function saveDashCache(data) {
  write(`dash_${getApiUser()}`, { savedAt: new Date().toISOString(), data });
}

export function readDashCache() {
  return read(`dash_${getApiUser()}`, null);
}

// ---- Sending one waiting item ----------------------------------------

function messagesFrom(data) {
  if (data && typeof data.detail === "object" && data.detail !== null) {
    return Object.values(data.detail).join(" ");
  }
  if (data && typeof data.detail === "string") {
    return data.detail;
  }
  return "The server did not accept this.";
}

async function parse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

// Returns { status: "done", code? } or { status: "rejected", message,
// keep }. Throws on network problems, so the caller can stop and retry.
export async function sendItem(item) {
  let draftId = item.draftId;

  // 1. Make sure the answers exist as a draft on the server.
  const response = await apiFetch(
    draftId === null
      ? `${BASE}/lgs/${item.lgId}/drafts`
      : `${BASE}/drafts/${draftId}`,
    {
      method: draftId === null ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.data),
    },
  );
  const data = await parse(response);

  if (!response.ok) {
    if (response.status === 404 && draftId !== null) {
      return {
        status: "rejected",
        keep: false,
        message:
          "This draft is no longer on the server. It may already have been registered, so please check the farmer list.",
      };
    }
    return { status: "rejected", keep: true, message: messagesFrom(data) };
  }

  draftId = data.id;
  // Remember the draft right away, so a retry never creates a second one.
  updatePending(item.key, { draftId: draftId });

  if (!item.submit) {
    return { status: "done" };
  }

  // 2. Submit it. This is where the farmer number is given out.
  const submitted = await apiFetch(`${BASE}/drafts/${draftId}/submit`, {
    method: "POST",
  });
  const submitData = await parse(submitted);

  if (submitted.ok) {
    return { status: "done", code: submitData.farmer_code };
  }
  // The answers are safe on the server as a draft; the facilitator can fix
  // them from the Drafts button, so there is nothing to keep here.
  return {
    status: "rejected",
    keep: false,
    message:
      messagesFrom(submitData) +
      " It is saved as a draft, so you can fix it from the Drafts button.",
  };
}

// Sends everything waiting, one by one. Stops at the first network
// problem. Returns { results, offline }.
export async function syncAll() {
  const results = [];
  let offline = false;

  for (const item of getPending()) {
    try {
      const outcome = await sendItem(item);
      if (outcome.status === "done") {
        removePending(item.key);
      } else if (!outcome.keep) {
        removePending(item.key);
      } else {
        updatePending(item.key, { error: outcome.message });
      }
      results.push({ item, ...outcome });
    } catch (error) {
      if (!isNetworkError(error)) {
        throw error;
      }
      offline = true;
      break;
    }
  }

  announce();
  return { results, offline };
}
