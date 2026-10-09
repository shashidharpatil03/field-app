// "Offline-lite": when there is no signal, new farmers and drafts are kept
// on the phone (in localStorage) and sent later from the Sync screen.
// Everything is kept per signed-in user, so two people sharing a phone
// never see each other's pending work.

import { apiFetch, getApiUser, pauseRefresh } from "./api.js";

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

// Times are written like "Today 7:49 AM" or "4 Oct 5:00 PM" (see dates.js).
export { formatWhen } from "./dates.js";

// ---- The waiting list -------------------------------------------------
// Everything done without signal waits here until it can be sent. Each
// entry has a `kind`:
//   (none)       a form: a draft, or a farmer waiting to be registered
//                { lgId, lgCode, draftId, data, submit }
//   "edit"       a change to a farmer     { farmerId, farmerCode, name, body }
//   "delete"     a farmer to delete       { farmerId, farmerCode, name, body }
//   "draftDelete" a draft to throw away   { draftId, name }
// Entries are sent one by one, in the order they were made.

// A forms' number on this phone only: it is negative, so it can never be
// the same as a number the server gave out.
function newLocalId() {
  return -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
}

// One number per registration, made on the phone when the form is opened and
// sent with every request about it. If a reply is lost and the phone sends
// the registration again, the server recognises the number instead of
// registering the farmer twice. (crypto.randomUUID needs https, so this
// uses getRandomValues, which also works on a plain http test address.)
export function newClientId() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getPending(userId = getApiUser()) {
  return read(`pending_${userId}`, []).map((item) =>
    item.kind || item.localId
      ? item
      : { ...item, localId: -(Number(String(item.key).split("-")[0]) * 1000) },
  );
}

function setPending(list, userId = getApiUser()) {
  const ok = write(`pending_${userId}`, list);
  announce();
  return ok;
}

function newEntry(item) {
  return {
    ...item,
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
  };
}

// Keeps a form on the phone. Saving the same form again (same key, or the
// same draft on the server) replaces the earlier entry instead of adding a
// second one. Returns false if the phone had no room to keep it.
export function addPending(item) {
  const list = getPending();
  const same = list.find(
    (p) =>
      !p.kind &&
      ((item.key && p.key === item.key) ||
        (item.draftId !== null &&
          item.draftId !== undefined &&
          p.draftId === item.draftId)),
  );
  if (same) {
    return setPending(
      list.map((p) =>
        p === same
          ? {
              ...p,
              ...item,
              key: p.key,
              localId: p.localId,
              savedAt: new Date().toISOString(),
              error: undefined,
            }
          : p,
      ),
    );
  }
  return setPending([...list, { ...newEntry(item), localId: newLocalId() }]);
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

// Changes the answers of a farmer who is still waiting to be registered.
export function updateWaitingForm(key, patch) {
  return setPending(
    getPending().map((item) =>
      item.key === key
        ? { ...item, data: { ...item.data, ...patch }, error: undefined }
        : item,
    ),
  );
}

// A change to a farmer that is on the server. A second change to the same
// farmer replaces the first, because it holds all the answers anyway.
export function queueEdit(farmer, body) {
  const rest = getPending().filter(
    (p) => !(p.kind === "edit" && p.farmerId === farmer.id),
  );
  return setPending([
    ...rest,
    newEntry({
      kind: "edit",
      farmerId: farmer.id,
      farmerCode: farmer.farmer_code,
      lgCode: farmer.lg_code,
      name: farmer.name,
      body: body,
    }),
  ]);
}

export function queueDelete(farmer, body) {
  const rest = getPending().filter(
    (p) => !(p.kind === "edit" && p.farmerId === farmer.id),
  );
  return setPending([
    ...rest,
    newEntry({
      kind: "delete",
      farmerId: farmer.id,
      farmerCode: farmer.farmer_code,
      lgCode: farmer.lg_code,
      name: farmer.name,
      body: body,
    }),
  ]);
}

export function queueDraftDelete(draft) {
  return setPending([
    ...getPending(),
    newEntry({
      kind: "draftDelete",
      draftId: draft.id,
      lgCode: draft.lg_code,
      name: draft.name,
    }),
  ]);
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
  if (item.kind === "edit") {
    const response = await apiFetch(`${BASE}/farmers/${item.farmerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.body),
    });
    const data = await parse(response);
    // "Nothing was changed" means the change is already on the server (for
    // example, the answer was lost on the way back).
    if (response.ok || messagesFrom(data) === "Nothing was changed") {
      return { status: "done" };
    }
    return { status: "rejected", keep: true, message: messagesFrom(data) };
  }

  if (item.kind === "delete") {
    const response = await apiFetch(`${BASE}/farmers/${item.farmerId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.body),
    });
    if (response.ok || response.status === 404) {
      return { status: "done" };
    }
    return {
      status: "rejected",
      keep: true,
      message: messagesFrom(await parse(response)),
    };
  }

  if (item.kind === "draftDelete") {
    const response = await apiFetch(`${BASE}/drafts/${item.draftId}`, {
      method: "DELETE",
    });
    if (response.ok || response.status === 404) {
      return { status: "done" };
    }
    return {
      status: "rejected",
      keep: true,
      message: messagesFrom(await parse(response)),
    };
  }

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
    // The draft is gone (404), or the server says this registration was
    // already made (409). If the reply to it was lost, the server still
    // knows this registration's number, so ask it.
    const clientId = item.data && item.data.client_id;
    const maybeDone =
      (response.status === 404 && draftId !== null) || response.status === 409;
    if (maybeDone && item.submit && clientId) {
      const known = await apiFetch(`${BASE}/submissions/${clientId}`);
      if (known.ok) {
        const farmer = await parse(known);
        return { status: "done", code: farmer.farmer_code };
      }
    }
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

// localData.js says what to do around a send: keep the screens steady while
// it runs, and fetch a fresh copy of the server's data when it ends.
let syncHooks = { start: () => {}, finish: async () => {} };

export function setSyncHooks(hooks) {
  syncHooks = hooks;
}

let running = null;

// Sends everything waiting, one by one. Stops at the first network problem.
// Two sends never run at the same time (that could register a farmer
// twice). With skipErrored, entries the server already refused are left
// alone. Returns { results, offline }.
export function syncAll(options = {}) {
  if (running) {
    return running;
  }
  running = doSync(options).finally(() => {
    running = null;
  });
  return running;
}

async function doSync({ skipErrored = false } = {}) {
  const results = [];
  let offline = false;

  syncHooks.start();
  pauseRefresh(true);
  try {
    for (const item of getPending()) {
      if (skipErrored && item.error) {
        continue;
      }
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
  } finally {
    pauseRefresh(false);
    await syncHooks.finish();
  }

  announce();
  return { results, offline };
}
