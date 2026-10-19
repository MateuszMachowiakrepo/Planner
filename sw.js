// Service worker Plannera Podróży.
// - Własne pliki: najpierw sieć (zawsze świeża wersja), bez sieci — kopia z cache.
// - Biblioteki z CDN (Firebase SDK, Leaflet, Chart.js, fonty): z cache, odświeżane w tle.
// - Firestore, logowanie, kafelki mapy, kursy walut itp. idą zawsze prosto do sieci.
const CACHE = 'planner-v1';

const PRECACHE = [
  './',
  'index.html',
  'firebase-config.js',
  'manifest.webmanifest',
  'css/styles.css',
  'css/notes-theme.css',
  'css/dark-theme.css',
  'js/core/theme.js',
  'js/core/app-core.js',
  'js/core/country-names.js',
  'js/core/country-sheet.js',
  'js/plan/point-categories.js',
  'js/plan/maps-routing.js',
  'js/plan/plan.js',
  'js/trips/trips.js',
  'js/stats/stats.js',
  'js/nav/tools.js',
  'js/nav/fx.js',
  'js/research/research.js',
  'js/trip/trip-tables.js',
  'js/trip/trip-day.js',
  'js/trip/today.js',
  'js/trip/trip-tickets.js',
  'tło.jpg',
  'tlo2.jpg',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

const CDN_HOSTS = [
  'www.gstatic.com',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request){
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if(res && res.ok) cache.put(request, res.clone());
    return res;
  } catch(e){
    const hit = await cache.match(request, { ignoreSearch: true });
    if(hit) return hit;
    if(request.mode === 'navigate'){
      const shell = await cache.match('index.html');
      if(shell) return shell;
    }
    throw e;
  }
}

async function staleWhileRevalidate(request){
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then(res => { if(res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone()); return res; })
    .catch(() => null);
  return hit || (await refresh) || Response.error();
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  if(url.origin === self.location.origin){
    event.respondWith(networkFirst(req));
    return;
  }
  const isFirebaseSdk = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if(CDN_HOSTS.includes(url.hostname) && (url.hostname !== 'www.gstatic.com' || isFirebaseSdk)){
    event.respondWith(staleWhileRevalidate(req));
  }
});
