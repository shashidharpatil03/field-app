// All requests to the backend go through apiFetch, so that every one of
// them tells the server who is asking (the X-User-Id header).

let currentUserId = null;
let onUnauthorized = () => {};

export function setApiUser(id) {
  currentUserId = id;
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
    `http://${window.location.hostname}:8000`
  );
}

export function apiFetch(url, options = {}) {
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
      return response;
    })
    .finally(() => clearTimeout(timer));
}
