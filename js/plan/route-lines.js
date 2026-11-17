// Trasy po prawdziwych drogach (Valhalla na serwerach FOSSGIS, zapasowo OSRM: routing.openstreetmap.de) zamiast linii prostych.
// Linia przerywana rysuje się od razu, a gdy przyjdzie trasa — zostaje podmieniona na właściwą.
// Bez sieci / przy błędzie zostaje linia prosta, więc mapa zawsze coś pokazuje.
(function(){
  const PROFILES = {
    foot: { label: 'Pieszo',   icon: '🚶', url: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/' },
    bike: { label: 'Rower',    icon: '🚲', url: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving/' },
    car:  { label: 'Samochód', icon: '🚗', url: 'https://routing.openstreetmap.de/routed-car/route/v1/driving/' }
  };
  const PROFILE_ORDER = ['foot', 'bike', 'car'];
  const ROUTE_COLOR = '#1e3a8a';
  const cache = new Map();   // klucz: profil|współrzędne → Promise<{ geometry, legs } | null>

  function profileKey(p){ return PROFILES[p] ? p : 'foot'; }

  // Serwer OSRM odrzuca (429) zbyt wiele równoczesnych zapytań — przy dniu z kilkunastoma punktami część tras
  // wracała błędem i zostawała linią prostą. Dlatego zapytania idą w małej kolejce, a błąd jest ponawiany.
  const MAX_PARALLEL = 2;
  const RETRIES = 2;
  const TIMEOUT_MS = 12000;
  const waiting = [];
  let running = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function schedule(task){
    return new Promise(resolve => { waiting.push({ task, resolve }); pump(); });
  }
  function pump(){
    while(running < MAX_PARALLEL && waiting.length){
      const { task, resolve } = waiting.shift();
      running++;
      task().then(resolve, () => resolve(null)).finally(() => { running--; pump(); });
    }
  }

  // Valhalla (serwery FOSSGIS) — główne źródło tras; OSRM zostaje jako zapas, gdy Valhalla nie odpowie.
  const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';
  const MAX_LEGS_PER_REQUEST = 8;   // Valhalla odrzuca (400) zapytania z więcej niż 10 punktami
  const VALHALLA_COSTING = { foot: 'pedestrian', bike: 'bicycle', car: 'auto' };

  function decodePolyline6(str){
    const out = [];
    let i = 0, lat = 0, lng = 0;
    while(i < str.length){
      for(let k = 0; k < 2; k++){
        let shift = 0, result = 0, b;
        do { b = str.charCodeAt(i++) - 63; result |= (b & 31) << shift; shift += 5; } while(b >= 32);
        const d = (result & 1) ? ~(result >> 1) : (result >> 1);
        if(k === 0) lat += d; else lng += d;
      }
      out.push([lat / 1e6, lng / 1e6]);
    }
    return out;
  }

  function parseValhalla(j){
    const legs = j && j.trip && j.trip.legs;
    if(!legs || !legs.length) return null;
    const geometry = [];
    legs.forEach(l => decodePolyline6(l.shape).forEach(pt => geometry.push(pt)));
    return { geometry, legs: legs.map(l => ({ distance: l.summary.length * 1000, duration: l.summary.time })) };
  }

  function parseOsrm(j){
    const route = j && j.code === 'Ok' && j.routes && j.routes[0];
    if(!route) return null;
    return {
      geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      legs: route.legs.map(l => ({ distance: l.distance, duration: l.duration }))
    };
  }

  // Zwraca { res } gdy serwer odpowiedział (res może być null = brak trasy po drogach), albo null przy błędzie.
  async function requestRoute(url, parse){
    for(let attempt = 0; attempt <= RETRIES; attempt++){
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);   // zawieszone zapytanie nie może blokować kolejki
      try {
        const r = await fetch(url, { signal: ctrl.signal });
        if(r.ok) return { res: parse(await r.json()) };
        if(r.status !== 429 && r.status < 500) return { res: null };   // np. 400 „brak trasy" — ponawianie nic nie da
      } catch(e) { /* sieć / timeout — próbujemy ponownie */ }
      finally { clearTimeout(timer); }
      if(attempt < RETRIES) await sleep(600 * (attempt + 1));
    }
    return null;
  }

  async function requestAny(profile, coords){
    const vq = { locations: coords.map(c => ({ lat: Number(c[0]), lon: Number(c[1]) })), costing: VALHALLA_COSTING[profile], units: 'kilometers' };
    const v = await requestRoute(`${VALHALLA_URL}?json=${encodeURIComponent(JSON.stringify(vq))}`, parseValhalla);
    if(v && v.res) return v.res;
    const path = coords.map(c => `${Number(c[1]).toFixed(5)},${Number(c[0]).toFixed(5)}`).join(';');
    const o = await requestRoute(`${PROFILES[profile].url}${path}?overview=full&geometries=geojson&steps=false`, parseOsrm);
    return o && o.res || null;
  }

  // Gotowe trasy zapamiętujemy też w localStorage — po odświeżeniu strony nie trzeba pytać serwera drugi raz.
  const STORE_KEY = 'routeCache:v1', STORE_MAX = 80;
  function loadStore(){ try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch(e){ return {}; } }
  function saveToStore(key, res){
    try {
      const st = loadStore();
      delete st[key]; st[key] = res;
      const keys = Object.keys(st);
      keys.slice(0, Math.max(0, keys.length - STORE_MAX)).forEach(k => delete st[k]);
      localStorage.setItem(STORE_KEY, JSON.stringify(st));
    } catch(e) { /* brak miejsca / tryb prywatny — cache tylko w pamięci */ }
  }

  function fetchRoute(coords, profile){
    profile = profileKey(profile);
    const path = coords.map(c => `${Number(c[1]).toFixed(5)},${Number(c[0]).toFixed(5)}`).join(';');
    const key = profile + '|' + path;
    if(cache.has(key)) return cache.get(key);
    const stored = loadStore()[key];
    if(stored){ const hit = Promise.resolve(stored); cache.set(key, hit); return hit; }
    const req = schedule(() => requestAny(profile, coords));
    req.then(res => { if(res) saveToStore(key, res); else cache.delete(key); }); // błąd nie zostaje w pamięci — kolejna próba pójdzie do sieci
    cache.set(key, req);
    return req;
  }

  // Rysuje trasę przez coords ([[lat,lng],…]). Zwraca uchwyt { remove() }.
  // opts: { profile, onLegs(legs|null) } — onLegs dostaje czasy/dystanse odcinków albo null przy błędzie.
  function draw(map, coords, opts){
    opts = opts || {};
    const layer = L.layerGroup().addTo(map);
    const handle = { removed: false, remove(){ this.removed = true; layer.remove(); } };
    if(!coords || coords.length < 2){ if(opts.onLegs) opts.onLegs(null); return handle; }

    const straight = L.polyline(coords, { color: ROUTE_COLOR, weight: 3, opacity: 0.55, dashArray: '6,6' }).addTo(layer);
    // Odcinek, któremu serwer nie odpowiedział, jest ponawiany w tle (z rosnącą przerwą), aż się narysuje —
    // dzięki temu nie trzeba ręcznie przestawiać sposobu dotarcia.
    const LATE_RETRIES = 4;
    const attempt = n => fetchRoute(coords, opts.profile).then(res => {
      if(handle.removed) return;
      if(!res){
        if(n < LATE_RETRIES){ setTimeout(() => { if(!handle.removed) attempt(n + 1); }, 2500 * (n + 1)); return; }
        straight.setStyle({ opacity: 0.85 }); if(opts.onLegs) opts.onLegs(null); return;
      }
      straight.remove();
      L.polyline(res.geometry, { color: '#fff', weight: 7, opacity: 0.85, interactive: false }).addTo(layer);
      L.polyline(res.geometry, { color: ROUTE_COLOR, weight: 4, opacity: 0.9, interactive: false }).addTo(layer);
      if(opts.onLegs) opts.onLegs(res.legs);
    });
    attempt(0);
    return handle;
  }

  // Trasa złożona z odcinków, każdy z własnym sposobem poruszania się.
  // segs: [{ from:[lat,lng], to:[lat,lng], profile }]; onLegs(legs) dostaje po jednym wpisie na odcinek (null przy błędzie).
  // Sąsiednie odcinki z tym samym sposobem i ciągłe (koniec jednego = początek następnego) idą jednym zapytaniem
  // z wieloma punktami (maks. 8 odcinków, limit Valhalli to 10 punktów) — dzień z 14 punktami to wtedy 2 zapytania zamiast 13.
  function drawSegments(map, segs, onLegs){
    const handles = [];
    const legs = new Array(segs.length).fill(null);
    const handle = { remove(){ handles.forEach(h => h.remove()); } };
    const same = (a, b) => a[0] === b[0] && a[1] === b[1];
    const groups = [];
    segs.forEach((s, i) => {
      const g = groups[groups.length - 1];
      if(g && g.idx.length < MAX_LEGS_PER_REQUEST && profileKey(g.profile) === profileKey(s.profile) && same(g.coords[g.coords.length - 1], s.from)){
        g.coords.push(s.to); g.idx.push(i);
      } else groups.push({ profile: s.profile, coords: [s.from, s.to], idx: [i] });
    });
    let pending = groups.length;
    if(!pending){ if(onLegs) onLegs(legs); return handle; }
    groups.forEach(g => {
      handles.push(draw(map, g.coords, { profile: g.profile, onLegs: l => {
        g.idx.forEach((si, k) => { legs[si] = l && l[k] ? l[k] : null; });
        if(--pending === 0 && onLegs) onLegs(legs);
      } }));
    });
    return handle;
  }

  function fmtDuration(sec){
    const min = Math.max(1, Math.round(sec / 60));
    if(min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  function fmtDistance(m){
    return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} km`;
  }

  window.RouteLines = { PROFILES, PROFILE_ORDER, profileKey, fetchRoute, draw, drawSegments, fmtDuration, fmtDistance };
})();
