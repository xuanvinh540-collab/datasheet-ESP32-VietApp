// Cache để mở offline: mạng trước, lỗi mạng thì lấy cache
const C = "pindex-v62";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(["./", "index.html", "404.html", "css/app.css", "css/retro.css", "css/pinout.css", "css/amber.css", "js/boards.js", "js/app.js", "js/specs.js", "js/learn.js", "js/i18n.js", "js/i18n-data.js", "js/modules.js", "js/build.js", "icon.svg"]))); });
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
