// Service worker: η εφαρμογή ανοίγει γρήγορα και εγκαθίσταται στο κινητό.
// Τα δεδομένα ΔΕΝ αποθηκεύονται εδώ — έρχονται πάντα ζωντανά από τη βάση.
const CACHE = 'mg-shell-v1';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Supabase, AI, φωνή: πάντα από το δίκτυο
  // πρώτα δίκτυο (για να έρχεται πάντα η νέα έκδοση), αλλιώς η αποθηκευμένη
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
