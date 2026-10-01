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

export function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (currentUserId !== null) {
    headers["X-User-Id"] = String(currentUserId);
  }

  return fetch(url, { ...options, headers }).then((response) => {
    if (response.status === 401) {
      onUnauthorized();
    }
    return response;
  });
}
