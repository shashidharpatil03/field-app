// The "service worker": a small program the browser keeps next to the app.
// It sits between the app and the network. It saves a copy of the app's own
// files (screens, styles, fonts, icons) on the phone, so the app opens even
// with no signal. It does not touch the data: requests to the server on port
// 8000 are a different address, so they pass straight through.

const CACHE = "field-tools-v1";
const BASICS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

// Finds every "/assets/..." file named in a piece of text (the page, or a
// stylesheet, which names the fonts).
function assetsIn(text) {
  return text.match(/\/assets\/[^"')\s]+/g) || [];
}

// Saves a copy of every file the page needs, and removes copies of files
// from older versions of the app.
async function saveEverything(html) {
  const cache = await caches.open(CACHE);
  await cache.addAll(BASICS);

  const files = new Set(assetsIn(html));
  for (const file of [...files]) {
    if (file.endsWith(".css")) {
      const response = await fetch(file);
      for (const inner of assetsIn(await response.text())) {
        files.add(inner);
      }
    }
  }
  await cache.addAll([...files]);

  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/assets/") && !files.has(path)) {
      await cache.delete(request);
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    fetch("/", { cache: "reload" })
      .then((response) => response.text())
      .then(saveEverything),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Opening the app: try the network for a few seconds, because that brings
// the newest version. If there is no signal, use the saved copy.
async function openPage(event) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([
      fetch(event.request),
      new Promise((_, reject) => setTimeout(reject, 4000)),
    ]);
    cache.put("/", response.clone());
    event.waitUntil(response.clone().text().then(saveEverything));
    return response;
  } catch {
    return (await cache.match("/")) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Only the app's own files. Server requests (port 8000) are not touched.
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(openPage(event));
    return;
  }
  // Files with a code in their name never change, so the saved copy is
  // always right. Anything else: show the saved copy now, refresh it quietly.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const saved = await cache.match(request);
      if (saved && url.pathname.startsWith("/assets/")) {
        return saved;
      }
      const fresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => saved || Response.error());
      return saved || fresh;
    }),
  );
});
