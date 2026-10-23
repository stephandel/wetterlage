/* sw.js – Service Worker: Hülle der App offline bereithalten. Die Build-Nummer erhöht tools/bauen.js. */
const BUILD = 3;
const CACHE = 'wetterlage-' + BUILD;
const HUELLE = [
  './', 'index.html', 'base.css', 'tokens.css', 'app.css', 'module.css', 'meteogramm.css',
  'lib/leaflet.css', 'lib/wpkarte.css', 'lib/ks-studio.css',
  'symbole.js', 'ikonen.js', 'lib/leaflet.min.js', 'meteogramm.js', 'lib/wpkarte.js', 'bausteine-einbau.js',
  'gemeinsam.js', 'version.js', 'module.js', 'app.js',
  'lib/ks-symbole.js', 'lib/ks-engine.js', 'lib/ks-studio.js', 'lib/beispiel-foto.jpg',
  'manifest.json', 'apple-touch-icon.png', 'app-symbol-1024.png', 'kamera-studio.json'
];

self.addEventListener('install', (ev) => {
  // Einzeln und am Browser-Zwischenspeicher vorbei (cache: 'reload') ablegen; fehlt eine Datei, bleibt der Rest trotzdem im Cache
  ev.waitUntil(caches.open(CACHE).then((c) => Promise.all(HUELLE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch((e) => { console.warn('sw: ' + u + ' nicht abgelegt', e); })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // fremde Server: nur Netz, nicht cachen
  if (req.mode === 'navigate') {
    ev.respondWith(caches.match('index.html').then((r) => r || fetch(req)).catch(() => caches.match('index.html')));
    return;
  }
  ev.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) { const kopie = res.clone(); caches.open(CACHE).then((c) => c.put(req, kopie)); }
        return res;
      });
    })
  );
});
