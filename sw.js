/* My Accounts Vault service worker — offline app shell.
   Strategy: navigations are network-first (fresh copy when online, cached
   shell when offline); same-origin files are cache-first. No account data
   is ever cached or sent anywhere — accounts are saved automatically in
   this device's local storage, encrypted with the master password. */
var VERSION = "accounts-vault-v2";
var CACHE = VERSION + "-shell";
var SCOPE = self.registration.scope;

function u(path) { return new URL(path, SCOPE).toString(); }

var SHELL = [
  u("./"),
  u("index.html"),
  u("manifest.webmanifest"),
  u("icon-192.png"),
  u("icon-512.png"),
  u("icon-maskable-512.png"),
  u("icon-180.png")
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(SHELL.map(function (url) {
        return fetch(url, { credentials: "same-origin" })
          .then(function (res) { if (res && res.ok) return cache.put(url, res); })
          .catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        return res;
      }).catch(function () {
        return caches.match(event.request).then(function (hit) {
          return hit || caches.match(u("index.html"));
        });
      })
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function (hit) {
      return hit || fetch(event.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        }
        return res;
      });
    })
  );
});
