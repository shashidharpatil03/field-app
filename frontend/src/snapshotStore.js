// The facilitator's saved copy of their data (see "/sync/snapshot" on the
// server). It lives in IndexedDB, the phone's built-in database, which holds
// far more than localStorage and does not slow the screen down. The copy
// is also kept in a variable while the app runs, so reading it is instant.

const DB_NAME = "fieldtools";
const STORE = "kv";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Runs one operation on the store and gives back its result.
async function run(mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

const keyFor = (userId) => `snapshot_${userId}`;

// `saved` is the server's data as last fetched. `view` is what the screens
// read: the saved data with the changes still waiting on the phone on top.
let saved = null;
let view = null;
let buildView = null;
let frozen = false;

// localData.js says how to put the waiting changes on top (see overlay.js).
export function setViewBuilder(builder) {
  buildView = builder;
}

// Works the view out again. While a send is under way it is kept as it was,
// so the screens do not jump back and forth.
export function rebuildView() {
  if (frozen) {
    return;
  }
  try {
    view = saved && buildView ? buildView(saved) : saved;
  } catch {
    view = saved;
  }
}

export function freezeView(on) {
  frozen = on;
  if (!on) {
    rebuildView();
  }
}

// What the screens read, or null if there is no copy yet.
export function getSnapshot() {
  return view;
}

// Reads the saved copy of this user from the phone into memory.
export async function loadSnapshot(userId) {
  try {
    saved = (await run("readonly", (s) => s.get(keyFor(userId)))) ?? null;
  } catch {
    saved = null;
  }
  rebuildView();
  return saved;
}

export async function saveSnapshot(userId, snapshot) {
  saved = snapshot;
  rebuildView();
  try {
    await run("readwrite", (s) => s.put(snapshot, keyFor(userId)));
  } catch {
    // The copy still works while the app is open, even if the phone had no
    // room to keep it.
  }
}

// Forgets the copy in memory (signing out). The saved one stays.
export function forgetSnapshot() {
  saved = null;
  view = null;
  frozen = false;
}

// Removes the saved copy from the phone (the account was switched off).
export async function wipeSnapshot(userId) {
  saved = null;
  view = null;
  try {
    await run("readwrite", (s) => s.delete(keyFor(userId)));
  } catch {
    // Nothing more to do.
  }
}
