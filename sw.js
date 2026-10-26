// Cache để mở offline: mạng trước, lỗi mạng thì lấy cache
const C = "pin-explorer-v20";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(["./", "index.html", "css/app.css", "css/retro.css", "css/pinout.css", "css/amber.css", "js/boards.js", "js/app.js", "js/specs.js", "js/learn.js", "icon.svg"]))); });
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
