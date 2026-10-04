// All requests to the backend go through apiFetch, so that every one of
// them tells the server who is asking (the X-User-Id header).

import { getSnapshot } from "./snapshotStore.js";
import { answerLocal } from "./localQuery.js";

let currentUserId = null;
let currentRole = null;
let onUnauthorized = () => {};
let afterWrite = null;
let refreshPaused = false;

// The role is needed because a facilitator's questions are answered from the
// copy saved on the phone (see localQuery.js).
export function setApiUser(id, role = null) {
  currentUserId = id;
  currentRole = role;
}

export function getApiRole() {
  return currentRole;
}

// Facilitators and PU managers both work from the copy saved on the phone.
export function usesLocalData() {
  return currentRole === "facilitator" || currentRole === "pu_manager";
}

// localData.js registers what to do after a change reached the server: fetch
// a fresh copy, so the screens never show the old numbers.
export function setAfterWrite(handler) {
  afterWrite = handler;
}

// While waiting changes are being sent one by one, the copy is refreshed
// once at the end instead of after each one.
export function pauseRefresh(on) {
  refreshPaused = on;
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export function getApiUser() {
  return currentUserId;
}

// On a poor connection a request can hang for minutes. After this long we
// give up, and the caller treats it like being offline.
const TIMEOUT_MS = 20000;

// The code asks for "http://localhost:8000/...". When the app is opened from
// another device (a phone on the same Wi-Fi), "localhost" would mean that
// device itself, so we swap in the address the page was opened from.
function fixAddress(url) {
  return url.replace(
    "http://localhost:8000",
    `http://${window.location.hostname}:8000`,
  );
}

// Asks the server "are you there?" and gives up after 5 seconds. Used to
// tell "the server is reachable" from "the phone only thinks it is online".
export async function pingServer() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(fixAddress("http://localhost:8000/ping"), {
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Asks the server. Every request to the backend that must really go to the
// server (and not to the saved copy) uses this.
export function networkFetch(url, options = {}) {
  // The phone knows when it has no connection at all: do not wait 20 seconds.
  if (navigator.onLine === false) {
    return Promise.reject(new TypeError("offline"));
  }
  const headers = { ...(options.headers || {}) };
  if (currentUserId !== null) {
    headers["X-User-Id"] = String(currentUserId);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  return fetch(fixAddress(url), {
    ...options,
    headers,
    signal: controller.signal,
  })
    .then((response) => {
      if (response.status === 401) {
        onUnauthorized();
      }
      // Anything saved on the server counts as "data sent". offline.js
      // listens for this and remembers the time.
      const method = (options.method || "GET").toUpperCase();
      if (response.ok && (method === "POST" || method === "PUT")) {
        window.dispatchEvent(new Event("data-sent"));
      }
      return response;
    })
    .finally(() => clearTimeout(timer));
}

// What the screens use. A facilitator who has a saved copy of their data
// gets reading questions answered from it, instantly and with or without
// signal. Everything else goes to the server, and after a change succeeds
// the saved copy is refreshed before the screen reads again.
export function apiFetch(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  // A request can ask for the server's own answer with { fresh: true }.
  if (method === "GET" && usesLocalData() && !options.fresh) {
    const snapshot = getSnapshot();
    if (snapshot) {
      const address = new URL(fixAddress(url));
      const answer = answerLocal(
        snapshot,
        address.pathname,
        address.searchParams,
      );
      if (answer) {
        return Promise.resolve(
          new Response(JSON.stringify(answer.body), {
            status: answer.status,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
    }
  }

  return networkFetch(url, options).then(async (response) => {
    if (
      response.ok &&
      method !== "GET" &&
      usesLocalData() &&
      afterWrite &&
      !refreshPaused
    ) {
      await afterWrite();
    }
    return response;
  });
}
