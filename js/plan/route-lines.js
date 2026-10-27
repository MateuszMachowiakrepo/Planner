// Trasy po prawdziwych drogach (OSRM na serwerach FOSSGIS: routing.openstreetmap.de) zamiast linii prostych.
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

  function fetchRoute(coords, profile){
    profile = profileKey(profile);
    const path = coords.map(c => `${Number(c[1]).toFixed(5)},${Number(c[0]).toFixed(5)}`).join(';');
    const key = profile + '|' + path;
    if(cache.has(key)) return cache.get(key);
    const req = fetch(`${PROFILES[profile].url}${path}?overview=full&geometries=geojson&steps=false`)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const route = j && j.code === 'Ok' && j.routes && j.routes[0];
        if(!route) return null;
        return {
          geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          legs: route.legs.map(l => ({ distance: l.distance, duration: l.duration }))
        };
      })
      .catch(() => null);
    req.then(res => { if(!res) cache.delete(key); }); // błąd nie zostaje w pamięci — kolejna próba pójdzie do sieci
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
    fetchRoute(coords, opts.profile).then(res => {
      if(handle.removed) return;
      if(!res){ straight.setStyle({ opacity: 0.85 }); if(opts.onLegs) opts.onLegs(null); return; }
      straight.remove();
      L.polyline(res.geometry, { color: '#fff', weight: 7, opacity: 0.85, interactive: false }).addTo(layer);
      L.polyline(res.geometry, { color: ROUTE_COLOR, weight: 4, opacity: 0.9, interactive: false }).addTo(layer);
      if(opts.onLegs) opts.onLegs(res.legs);
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

  window.RouteLines = { PROFILES, PROFILE_ORDER, profileKey, fetchRoute, draw, fmtDuration, fmtDistance };
})();
