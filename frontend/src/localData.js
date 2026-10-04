// Keeps the facilitator's saved copy of their data (the "snapshot") up to
// date. The copy is fetched from the server in one call, saved on the phone,
// and read by apiFetch (api.js) through localQuery.js.

import {
  networkFetch,
  pingServer,
  getApiUser,
  usesLocalData,
  setAfterWrite,
} from "./api.js";
import {
  loadSnapshot,
  saveSnapshot,
  getSnapshot,
  forgetSnapshot,
  wipeSnapshot,
  setViewBuilder,
  rebuildView,
  freezeView,
} from "./snapshotStore.js";
import { getPending, syncAll, setSyncHooks } from "./offline.js";
import { applyPending } from "./overlay.js";

// Who is signed in, for the "registered by" line of a farmer who is waiting.
let me = { name: "" };

// What the screens read: the server's data with the waiting changes on top.
setViewBuilder((saved) => applyPending(saved, getPending(), me));

// Every time the waiting list changes, the screens' view is worked out again.
window.addEventListener("pending-changed", () => rebuildView());

// Around a send: keep the view steady, and at the end fetch a fresh copy.
setSyncHooks({
  start: () => freezeView(true),
  finish: async () => {
    try {
      await refreshSnapshot();
    } finally {
      freezeView(false);
    }
  },
});

let running = null;

// Fetches a fresh copy and saves it. Never throws: with no signal it just
// returns false and the older copy stays in use.
export function refreshSnapshot() {
  if (!usesLocalData()) {
    return Promise.resolve(false);
  }
  if (running) {
    return running;
  }
  const userId = getApiUser();
  running = (async () => {
    try {
      const response = await networkFetch(
        "http://localhost:8000/sync/snapshot",
      );
      if (!response.ok || getApiUser() !== userId) {
        return false;
      }
      const snapshot = await response.json();
      snapshot.fetchedAt = new Date().toISOString();
      await saveSnapshot(userId, snapshot);
      window.dispatchEvent(new Event("snapshot-updated"));
      return true;
    } catch {
      return false;
    } finally {
      running = null;
    }
  })();
  return running;
}

// After any change reaches the server, the copy is refreshed first.
setAfterWrite(refreshSnapshot);

// When the signal comes back, bring the copy up to date.
window.addEventListener("online", () => refreshSnapshot());

// Gets the saved copy ready after signing in or opening the app. Returns
// when the screens can be shown. With a saved copy and signal, it waits a
// moment for a fresh one; with no signal it carries on with the old one.
export async function prepareLocalData(user) {
  forgetSnapshot();
  me = { name: user.name ?? "" };
  if (user.role !== "facilitator" && user.role !== "pu_manager") {
    return;
  }
  const saved = await loadSnapshot(user.id);
  const fresh = refreshSnapshot();
  if (saved) {
    await Promise.race([fresh, new Promise((done) => setTimeout(done, 1500))]);
  } else {
    await fresh;
  }
}

export function hasLocalData() {
  return getSnapshot() !== null;
}

export function leaveLocalData() {
  forgetSnapshot();
}

// For an account that was switched off: remove the copy from the phone.
export function removeLocalData(userId) {
  return wipeSnapshot(userId);
}

// ---- Sending by itself ----------------------------------------------------
// Whenever something is waiting and the server can be reached, send it, so
// the facilitator never has to remember. Entries the server refused stay
// until the facilitator looks at them on the Sync screen.
let timer = null;

async function trySend() {
  timer = null;
  if (!usesLocalData()) {
    return;
  }
  const waiting = getPending().filter((item) => !item.error);
  if (waiting.length === 0 || !(await pingServer())) {
    return;
  }
  try {
    await syncAll({ skipErrored: true });
  } catch {
    // The Sync screen shows what is still waiting.
  }
}

export function sendSoon(delay = 1500) {
  if (timer === null) {
    timer = setTimeout(trySend, delay);
  }
}

window.addEventListener("pending-changed", () => sendSoon());
window.addEventListener("online", () => sendSoon(500));
// A phone can say it is online with no real connection, so also try every
// minute while something is waiting.
setInterval(() => {
  if (getPending().some((item) => !item.error)) {
    sendSoon(0);
  }
}, 60000);

// Other people's changes (a facilitator's edits, seen by the PU manager)
// only arrive with a fresh copy, so fetch one every five minutes while the
// app is open, there is signal and nothing is waiting to be sent.
setInterval(() => {
  if (
    document.visibilityState === "visible" &&
    navigator.onLine &&
    getPending().length === 0
  ) {
    refreshSnapshot();
  }
}, 300000);
