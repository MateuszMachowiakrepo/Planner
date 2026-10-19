(function(){
  const DAY_TABLES = ['atrakcje', 'restauracje', 'miejscowki'];

  const TABLE_LABEL = {
    atrakcje: 'Atrakcje',
    restauracje: 'Restauracje',
    miejscowki: 'Miejscówki'
  };

  const TABLE_COLOR = {
    atrakcje: 'var(--rsc-atrakcje)',
    restauracje: 'var(--rsc-restauracje)',
    miejscowki: 'var(--rsc-miejscowki)'
  };

  function escapeHtml(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }
  function genItemId(){ return 'it_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function getActiveTrip(){ return typeof activeTripObj === 'function' ? activeTripObj() : null; }

  // Widok dnia obsługuje dwa „hosty" o tym samym kształcie danych (tables, planPoints, plan.days, dayMeta):
  // podróż (dni wynikają z dat) oraz tablicę researchu (dni bez dat, liczba ustawiana ręcznie).
  const TRIP_CTX = {
    getHost: getActiveTrip,
    save: () => { if(typeof window.saveTrips === 'function') window.saveTrips(); },
    containerId: 'plan-board-container',
    dayCount: t => calculateDays(t.startDate, t.endDate),
    dateLabel: (t, day) => {
      const dd = new Date(t.startDate); dd.setDate(dd.getDate() + day);
      return dd.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
    },
    center: t => t.coords ? [t.coords.lat, t.coords.lng] : null,
    selectDay: d => { if(typeof window.selectPlanDay === 'function') window.selectPlanDay(d); },
    onInvalidDay: () => { if(typeof window.setTripViewPanel === 'function') window.setTripViewPanel('calendar'); },
    backLabel: 'Wróć do kalendarza'
  };
  let ctx = TRIP_CTX;
  let activeDay = 0;

  function getTrip(){ return ctx.getHost(); }

  function ensureTripPlan(trip){
    if(!trip) return;
    if(!trip.plan || typeof trip.plan !== 'object') trip.plan = {};
    if(!trip.plan.days || typeof trip.plan.days !== 'object') trip.plan.days = {};
  }

  function ensureDay(trip, day){
    ensureTripPlan(trip);
    if(!trip.plan.days[day] || typeof trip.plan.days[day] !== 'object') trip.plan.days[day] = { items: [] };
    if(!Array.isArray(trip.plan.days[day].items)) trip.plan.days[day].items = [];
    trip.plan.days[day].items.forEach(it => {
      if(!it.id || it.id === it.rowId) it.id = genItemId();
      if(typeof it.startTime !== 'string') it.startTime = '';
      if(typeof it.endTime !== 'string') it.endTime = '';
      if(typeof it.travelToNext !== 'string') it.travelToNext = '';
      if(typeof it.travelMode !== 'string') it.travelMode = '';
      if(typeof it.duration !== 'string') it.duration = '';
      if(it.timeMode !== 'hours' && it.timeMode !== 'duration') it.timeMode = 'hours';
    });
    return trip.plan.days[day];
  }

  // Punkty postawione na mapie przed powiązaniem z tabelami nie mają wiersza — kolor i etykietę
  // biorą wtedy z kategorii punktu, a jako „wiersz" służy sam punkt.
  const CAT_TO_DAY_TABLE = { attraction: 'atrakcje', restaurant: 'restauracje', place: 'miejscowki' };

  function isTableRow(trip, id){
    return Object.values(trip.tables || {}).some(rows => Array.isArray(rows) && rows.some(r => r.id === id));
  }

  function findRow(trip, rowId){
    if(!trip) return null;
    for(const k of DAY_TABLES){
      const row = ((trip.tables && trip.tables[k]) || []).find(r => r.id === rowId);
      if(row) return { row, tableKey: k };
    }
    const point = findPoint(trip, rowId);
    if(!point || isTableRow(trip, rowId)) return null;
    const cat = typeof categoryByKey === 'function' ? categoryByKey(trip, point.categoryKey) : null;
    return {
      row: { id: point.id, nazwa: point.name || '' },
      tableKey: CAT_TO_DAY_TABLE[point.categoryKey] || 'miejscowki',
      label: cat ? cat.title : ''
    };
  }
  window.resolvePlanDayRow = findRow;

  function findPoint(trip, rowId){
    // podróż trzyma piny w planPoints, tablica researchu w points
    return (trip.planPoints || trip.points || []).find(p => p.id === rowId);
  }

  function save(){ ctx.save(); }
  function rerender(day){ renderDayView(day); }

  window.ensureTripDayModel = ensureTripPlan;

  function countForRow(items, rowId){
    return items.reduce((n, it) => n + (it.rowId === rowId ? 1 : 0), 0);
  }

  window.addTripDayItem = function(day, rowId){
    const t = getTrip(); if(!t) return;
    const d = ensureDay(t, day);
    d.items.push({ id: genItemId(), rowId, startTime: '', endTime: '', travelToNext: '', travelMode: '', duration: '', timeMode: 'hours' });
    save();
    rerender(day);
  };

  window.setTripDayItemCount = function(day, rowId, count){
    const t = getTrip(); if(!t) return;
    const d = ensureDay(t, day);
    const target = Math.max(0, Math.floor(Number(count) || 0));
    const current = countForRow(d.items, rowId);
    if(target === current) return;
    if(target < current){
      let toRemove = current - target;
      for(let i = d.items.length - 1; i >= 0 && toRemove > 0; i--){
        if(d.items[i].rowId === rowId){ d.items.splice(i, 1); toRemove--; }
      }
    } else {
      for(let i = 0; i < target - current; i++){
        d.items.push({ id: genItemId(), rowId, startTime: '', endTime: '', travelToNext: '', travelMode: '', duration: '', timeMode: 'hours' });
      }
    }
    save();
  };

  window.removeTripDayItemById = function(day, itemId){
    const t = getTrip(); if(!t) return;
    const d = ensureDay(t, day);
    d.items = d.items.filter(it => it.id !== itemId);
    save();
    rerender(day);
  };

  window.removeTripDayItem = function(day, rowId){
    const t = getTrip(); if(!t) return;
    const d = ensureDay(t, day);
    d.items = d.items.filter(it => it.rowId !== rowId);
    save();
    rerender(day);
  };

  window.moveTripDayItemById = function(day, itemId, dir){
    const t = getTrip(); if(!t) return;
    const d = ensureDay(t, day);
    const idx = d.items.findIndex(it => it.id === itemId);
    if(idx < 0) return;
    const to = idx + (dir === 'up' ? -1 : 1);
    if(to < 0 || to >= d.items.length) return;
    const [it] = d.items.splice(idx, 1);
    d.items.splice(to, 0, it);
    const lo = Math.min(idx, to);
    const hi = Math.max(idx, to);
    [lo - 1, lo, hi].forEach(i => {
      if(i >= 0 && i < d.items.length){
        d.items[i].travelToNext = '';
        d.items[i].travelMode = '';
      }
    });
    save();
    rerender(day);
  };

  window.updateTripDayItemField = function(day, itemId, field, val){
    const t = getTrip(); if(!t) return;
    const d = ensureDay(t, day);
    const it = d.items.find(i => i.id === itemId);
    if(!it) return;
    it[field] = val;
    save();
  };

  window.toggleTripDayItemTimeMode = function(day, itemId){
    const t = getTrip(); if(!t) return;
    const d = ensureDay(t, day);
    const it = d.items.find(i => i.id === itemId);
    if(!it) return;
    it.timeMode = it.timeMode === 'duration' ? 'hours' : 'duration';
    save();
    rerender(day);
  };

  // Usuwa wpisy planu wskazujące na usunięty wiersz. Bez hosta działa na aktywnej podróży.
  function prunePlanItemsForRow(host, rowId){
    if(!host) return false;
    ensureTripPlan(host);
    let dirty = false;
    Object.keys(host.plan.days).forEach(k => {
      const day = host.plan.days[k];
      if(!day || !Array.isArray(day.items)) return;
      const before = day.items.length;
      day.items = day.items.filter(it => it.rowId !== rowId);
      if(day.items.length !== before) dirty = true;
    });
    return dirty;
  }
  window.prunePlanItemsForRow = prunePlanItemsForRow;

  window.pruneTripDayItemsForRow = function(rowId){
    if(prunePlanItemsForRow(getActiveTrip(), rowId)) TRIP_CTX.save();
  };

  window.updateDayPlanMeta = function(day, field, val){
    const t = getTrip(); if(!t) return;
    if(!t.dayMeta || typeof t.dayMeta !== 'object') t.dayMeta = {};
    if(!t.dayMeta[day]) t.dayMeta[day] = {};
    t.dayMeta[day][field] = val;
    save();
  };

  window.updateTripDayField = function(day, field, val){
    const t = getTrip(); if(!t) return;
    const d = ensureDay(t, day);
    d[field] = val;
    save();
  };

  function goDay(delta){
    const t = getTrip(); if(!t) return;
    const total = ctx.dayCount(t);
    const cur = activeDay;
    let next = cur + delta;
    if(next < 0) next = 0;
    if(next >= total) next = total - 1;
    if(next === cur) return;
    ctx.selectDay(next);
  }
  window.tripDayGoPrev = () => goDay(-1);
  window.tripDayGoNext = () => goDay(1);

  // Wybór punktów dnia odbywa się na mapie — położenie punktów decyduje o kolejności i sensie trasy.
  // Punkty bez współrzędnych są dostępne w osobnej liście obok mapy.
  window.openTripDayPicker = function(day){
    const t = getTrip(); if(!t) return;
    const d = ensureDay(t, day);
    const rootStyle = getComputedStyle(document.documentElement);
    const colorOf = c => c.color || rootStyle.getPropertyValue('--rsc-' + c.tableKey).trim() || '#333';
    const dotOf = c => c.color || TABLE_COLOR[c.tableKey];
    const labelOf = c => c.label || t.tableNames?.[c.tableKey] || TABLE_LABEL[c.tableKey];

    const candidates = [];
    DAY_TABLES.forEach(k => {
      (t.tables?.[k] || []).forEach(r => {
        const point = findPoint(t, r.id);
        const coords = point && point.coords && point.coords.length === 2 ? point.coords : null;
        candidates.push({ rowId: r.id, tableKey: k, name: (r.nazwa || '').trim() || '(bez nazwy)', coords });
      });
    });
    // stare punkty z mapy (bez wiersza w tabelach, poza apartamentami)
    (t.planPoints || t.points || []).forEach(p => {
      if(!p.coords || p.coords.length !== 2 || p.categoryKey === 'apartment' || isTableRow(t, p.id)) return;
      const info = findRow(t, p.id);
      candidates.push({ rowId: p.id, tableKey: info.tableKey, name: (p.name || '').trim() || '(bez nazwy)', coords: p.coords, label: info.label });
    });
    const byId = new Map(candidates.map(c => [c.rowId, c]));
    const withCoords = candidates.filter(c => c.coords);
    const noCoords = candidates.filter(c => !c.coords);

    // W których innych dniach punkt już występuje.
    const otherDays = {};
    Object.keys(t.plan.days || {}).forEach(k => {
      const di = Number(k);
      if(di === day) return;
      ((t.plan.days[k] && t.plan.days[k].items) || []).forEach(it => {
        (otherDays[it.rowId] = otherDays[it.rowId] || new Set()).add(di);
      });
    });

    const current = {};
    d.items.forEach(it => { current[it.rowId] = (current[it.rowId] || 0) + 1; });
    const pending = { ...current };
    const addOrder = [];

    function inc(rowId){
      pending[rowId] = (pending[rowId] || 0) + 1;
      addOrder.push(rowId);
      refresh();
    }
    function dec(rowId){
      const n = pending[rowId] || 0;
      if(n <= 0) return;
      pending[rowId] = n - 1;
      const i = addOrder.lastIndexOf(rowId);
      if(i >= 0) addOrder.splice(i, 1);
      refresh();
    }

    // Kolejność dnia po zapisie: istniejące punkty (usuwane od końca) + dodane w kolejności klikania.
    function previewOrder(){
      const seen = {};
      const kept = [];
      d.items.forEach(it => {
        seen[it.rowId] = (seen[it.rowId] || 0) + 1;
        if(seen[it.rowId] <= Math.min(current[it.rowId], pending[it.rowId] || 0)) kept.push(it.rowId);
      });
      return kept.concat(addOrder);
    }

    const legend = DAY_TABLES.map(k => `<span class="tdp-legend-item"><span class="tdv-picker-dot" style="background:${TABLE_COLOR[k]}"></span>${escapeHtml(t.tableNames?.[k] || TABLE_LABEL[k])}</span>`).join('');

    const bd = document.createElement('div');
    bd.className = 'tdv-picker-backdrop';
    bd.innerHTML = `<div class="tdv-picker-card tdp-card" role="dialog" aria-modal="true" aria-label="Dodaj punkty do Dnia ${day + 1}">
      <header class="tdv-picker-head">
        <h3>Dodaj punkty do Dnia ${day + 1}</h3>
        <button type="button" class="qr-close" data-cancel aria-label="Zamknij">×</button>
      </header>
      <div class="tdp-body">
        <div class="tdp-map-wrap">
          <div class="tdp-map"></div>
          <div class="tdp-legend">${legend}<span class="tdp-legend-item"><span class="tdp-dot tdp-dot-elsewhere tdp-dot-sample"></span>w innym dniu</span></div>
          ${withCoords.length ? '' : `<p class="tdv-picker-empty">Żaden punkt nie ma jeszcze pinu. Ustaw lokalizacje w zakładce Mapa.</p>`}
        </div>
        <aside class="tdp-side">
          <div class="tdp-search">
            <input type="search" placeholder="Szukaj punktu…" aria-label="Szukaj punktu po nazwie" autocomplete="off">
            <div class="tdp-search-results" hidden></div>
          </div>
          <h4>Plan dnia</h4>
          <ol class="tdp-order"></ol>
          ${noCoords.length ? `<h4>Bez lokalizacji</h4><div class="tdv-picker-rows tdp-nocoords"></div>` : ''}
        </aside>
      </div>
      <footer class="tdv-picker-foot">
        <span class="tdp-hint">Kliknij pin, aby dodać punkt do dnia.</span>
        <button type="button" class="btn btn-secondary btn-sm" data-cancel>Anuluj</button>
        <button type="button" class="btn btn-primary btn-sm" data-apply>Zapisz</button>
      </footer>
    </div>`;

    let map = null;
    let routeLine = null;
    const markers = {};

    const onKey = e => { if(e.key === 'Escape') close(); };
    function close(){
      if(map){ map.remove(); map = null; }
      bd.remove();
      document.removeEventListener('keydown', onKey);
    }
    bd.querySelectorAll('[data-cancel]').forEach(el => el.addEventListener('click', close));
    bd.addEventListener('click', e => { if(e.target === bd) close(); });
    document.addEventListener('keydown', onKey);

    function iconFor(c, positions){
      const color = colorOf(c);
      if(positions.length){
        const label = positions.length > 2 ? positions.slice(0, 2).join(',') + '…' : positions.join(',');
        return L.divIcon({ html: `<div class="tdv-pin" style="background:${color};">${label}</div>`, className: 'tdv-pin-wrap', iconSize: [28, 28], iconAnchor: [14, 14] });
      }
      const elsewhere = otherDays[c.rowId] && otherDays[c.rowId].size;
      return L.divIcon({ html: `<div class="tdp-dot${elsewhere ? ' tdp-dot-elsewhere' : ''}" style="background:${color};"></div>`, className: 'tdv-pin-wrap', iconSize: [18, 18], iconAnchor: [9, 9] });
    }

    function stepperHtml(n){
      return `<div class="tdv-picker-stepper">
        <button type="button" class="tdv-step-btn" data-op="dec" aria-label="Mniej">−</button>
        <span class="tdv-step-count">${n}</span>
        <button type="button" class="tdv-step-btn" data-op="inc" aria-label="Więcej">+</button>
      </div>`;
    }
    function bindOps(el, rowId){
      el.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', ev => {
        ev.stopPropagation();
        if(b.dataset.op === 'inc') inc(rowId); else dec(rowId);
      }));
    }

    function popupEl(c){
      const n = pending[c.rowId] || 0;
      const other = otherDays[c.rowId] ? [...otherDays[c.rowId]].sort((a, b) => a - b).map(x => 'Dzień ' + (x + 1)).join(', ') : '';
      const el = document.createElement('div');
      el.className = 'tdp-popup';
      el.innerHTML = `<div class="tdp-popup-name">${escapeHtml(c.name)}</div>
        <div class="tdp-popup-meta">${escapeHtml(labelOf(c))}${other ? ' · już w: ' + escapeHtml(other) : ''}</div>
        ${n > 0 ? stepperHtml(n) : `<button type="button" class="btn btn-primary btn-sm" data-op="inc">Dodaj do dnia</button>`}`;
      bindOps(el, c.rowId);
      return el;
    }

    function focusCandidate(c){
      const m = markers[c.rowId];
      if(!map || !m) return;
      map.setView(c.coords, Math.max(map.getZoom(), 15));
      m.openPopup();
    }

    function refresh(){
      const order = previewOrder();
      const positions = {};
      order.forEach((id, i) => { (positions[id] = positions[id] || []).push(i + 1); });

      withCoords.forEach(c => {
        const m = markers[c.rowId]; if(!m) return;
        m.setIcon(iconFor(c, positions[c.rowId] || []));
        m.setZIndexOffset(positions[c.rowId] ? 1000 : 0);
        if(m.isPopupOpen()) m.setPopupContent(popupEl(c));
      });

      if(map){
        if(routeLine){ routeLine.remove(); routeLine = null; }
        const pts = order.map(id => byId.get(id)).filter(c => c && c.coords).map(c => c.coords);
        if(pts.length >= 2) routeLine = L.polyline(pts, { color: '#1e3a8a', weight: 3, opacity: 0.8, dashArray: '6,6' }).addTo(map);
      }

      const ol = bd.querySelector('.tdp-order');
      ol.innerHTML = order.length ? '' : '<li class="tdp-order-empty">Brak punktów — wybierz je na mapie.</li>';
      order.forEach(id => {
        const c = byId.get(id);
        const li = document.createElement('li');
        li.innerHTML = `<span class="tdv-picker-dot" style="background:${c ? dotOf(c) : 'var(--ink-muted)'}"></span>
          <span class="tdp-order-name">${escapeHtml(c ? c.name : 'Punkt usunięty')}${c && !c.coords ? ' <em>(bez lokalizacji)</em>' : ''}</span>
          <button type="button" class="tdv-item-btn tdv-item-del" aria-label="Usuń z dnia">×</button>`;
        li.querySelector('button').addEventListener('click', () => dec(id));
        if(c && c.coords){
          li.classList.add('has-coords');
          li.querySelector('.tdp-order-name').addEventListener('click', () => focusCandidate(c));
        }
        ol.appendChild(li);
      });

      const nc = bd.querySelector('.tdp-nocoords');
      if(nc){
        nc.innerHTML = '';
        noCoords.forEach(c => {
          const n = pending[c.rowId] || 0;
          const row = document.createElement('div');
          row.className = 'tdv-picker-row' + (n > 0 ? ' inuse' : '');
          row.innerHTML = `<span class="tdv-picker-dot" style="background:${dotOf(c)}"></span>
            <span class="tdv-picker-name">${escapeHtml(c.name)}</span>${stepperHtml(n)}`;
          bindOps(row, c.rowId);
          nc.appendChild(row);
        });
      }
    }

    // Wyszukiwarka: punkt z pinem centruje mapę, punkt bez pinu dodaje się od razu.
    const searchInput = bd.querySelector('.tdp-search input');
    const searchRes = bd.querySelector('.tdp-search-results');
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      searchRes.innerHTML = '';
      searchRes.hidden = !q;
      if(!q) return;
      const hits = candidates.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
      if(!hits.length){ searchRes.innerHTML = '<p class="tdv-picker-empty">Brak punktów o tej nazwie.</p>'; return; }
      hits.forEach(c => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tdp-search-hit';
        b.innerHTML = `<span class="tdv-picker-dot" style="background:${dotOf(c)}"></span><span>${escapeHtml(c.name)}${c.coords ? '' : ' <em>(bez lokalizacji)</em>'}</span>`;
        b.addEventListener('click', () => {
          searchInput.value = '';
          searchRes.hidden = true;
          searchRes.innerHTML = '';
          if(c.coords) focusCandidate(c); else inc(c.rowId);
        });
        searchRes.appendChild(b);
      });
    });
    searchInput.addEventListener('keydown', e => {
      if(e.key !== 'Enter') return;
      e.preventDefault();
      const first = searchRes.querySelector('.tdp-search-hit');
      if(first) first.click();
    });

    bd.querySelector('[data-apply]').addEventListener('click', () => {
      // najpierw zmniejszenia (usuwają od końca), potem dodania w kolejności klikania
      Object.keys(current).forEach(id => {
        if((pending[id] || 0) < current[id]) window.setTripDayItemCount(day, id, pending[id] || 0);
      });
      const fresh = ensureDay(t, day);
      addOrder.forEach(rowId => {
        fresh.items.push({ id: genItemId(), rowId, startTime: '', endTime: '', travelToNext: '', travelMode: '', duration: '', timeMode: 'hours' });
      });
      save();
      close();
      rerender(day);
    });

    document.body.appendChild(bd);

    if(typeof L !== 'undefined'){
      map = L.map(bd.querySelector('.tdp-map')).setView([20, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
      withCoords.forEach(c => {
        const m = L.marker(c.coords, { icon: iconFor(c, []) }).addTo(map);
        m.bindTooltip(escapeHtml(c.name), { direction: 'top', offset: [0, -10] });
        m.bindPopup(() => popupEl(c), { closeButton: false, minWidth: 180 });
        markers[c.rowId] = m;
      });
      if(withCoords.length >= 2) map.fitBounds(L.latLngBounds(withCoords.map(c => c.coords)), { padding: [30, 30] });
      else if(withCoords.length === 1) map.setView(withCoords[0].coords, 14);
      else { const ctr = ctx.center(t); if(ctr) map.setView(ctr, 11); }
      setTimeout(() => map && map.invalidateSize(), 60);
    }
    refresh();
  };

  let tdvMap = null;
  let tdvMarkers = [];

  function destroyDayMap(){
    if(tdvMap){ tdvMap.remove(); tdvMap = null; tdvMarkers = []; }
  }
  window.destroyPlanDayMap = destroyDayMap;

  function buildTripDayMap(day){
    const root = document.getElementById(ctx.containerId);
    const container = root && root.querySelector('.tdv-map');
    if(!container || typeof L === 'undefined') return;
    const t = getTrip(); if(!t) return;
    const d = ensureDay(t, day);

    if(tdvMap){ tdvMap.remove(); tdvMap = null; tdvMarkers = []; }
    tdvMap = L.map(container).setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(tdvMap);

    const coords = [];
    d.items.forEach((it, idx) => {
      const point = findPoint(t, it.rowId);
      if(!point || !point.coords || point.coords.length !== 2) return;
      const info = findRow(t, it.rowId);
      const color = info ? (info.color || getComputedStyle(document.documentElement).getPropertyValue('--rsc-' + info.tableKey).trim()) : '#333';
      const html = `<div class="tdv-pin" style="background:${color};">${idx + 1}</div>`;
      const icon = L.divIcon({ html, className: 'tdv-pin-wrap', iconSize: [28, 28], iconAnchor: [14, 14] });
      const marker = L.marker(point.coords, { icon }).addTo(tdvMap);
      const name = info?.row?.nazwa || point.name || '(bez nazwy)';
      marker.bindPopup(`<b>${escapeHtml(name)}</b>`);
      tdvMarkers.push(marker);
      coords.push(point.coords);
    });

    if(coords.length >= 2){
      L.polyline(coords, { color: '#1e3a8a', weight: 3.5, opacity: 0.9, dashArray: '6,6' }).addTo(tdvMap);
      tdvMap.fitBounds(L.latLngBounds(coords), { padding: [30, 30] });
    } else if(coords.length === 1){
      tdvMap.setView(coords[0], 13);
    } else {
      const c = ctx.center(t);
      if(c) tdvMap.setView(c, 10);
    }
    setTimeout(() => tdvMap && tdvMap.invalidateSize(), 60);
  }

  function renderItemBlock(it, idx, day, info, point, isLast){
    const name = info.row.nazwa || '(bez nazwy)';
    const catLabel = info.label || TABLE_LABEL[info.tableKey];
    const price = info.row.cena;
    const loc = info.row.lokalizacja || info.row.miejsce || '';
    const missingCoords = !point || !point.coords;
    const travelHtml = isLast ? '' : `<div class="tdv-travel">
      <span class="tdv-travel-icon" aria-hidden="true">↓</span>
      <label class="tdv-travel-label">Dojazd:</label>
      <input type="text" class="tdv-travel-input tdv-travel-time" value="${escapeAttr(it.travelToNext || '')}" placeholder="np. 20 min" oninput="updateTripDayItemField(${day},'${it.id}','travelToNext',this.value)">
      <input type="text" class="tdv-travel-input tdv-travel-mode" value="${escapeAttr(it.travelMode || '')}" placeholder="jak? np. pieszo, metro M1, auto" oninput="updateTripDayItemField(${day},'${it.id}','travelMode',this.value)">
    </div>`;

    return `<div class="tdv-item research-theme-${info.tableKey}" data-item="${escapeAttr(it.id)}">
      <span class="tdv-item-num">${idx + 1}</span>
      <div class="tdv-item-body">
        <div class="tdv-item-name">${escapeHtml(name)}</div>
        <div class="tdv-item-meta">${escapeHtml(catLabel)}${loc ? ' · ' + escapeHtml(loc) : ''}${price ? ' · ' + Number(price).toLocaleString('pl-PL') + ' zł' : ''}${missingCoords ? ' · brak lokalizacji' : ''}</div>
        <div class="tdv-item-times">
          ${it.timeMode === 'duration' ? `
            <label class="tdv-time-field tdv-duration-field">
              <span>Czas trwania</span>
              <input type="text" value="${escapeAttr(it.duration || '')}" placeholder="np. 2h, 90 min" oninput="updateTripDayItemField(${day},'${it.id}','duration',this.value)">
            </label>
          ` : `
            <label class="tdv-time-field">
              <span>Od</span>
              <input type="time" value="${escapeAttr(it.startTime || '')}" onchange="updateTripDayItemField(${day},'${it.id}','startTime',this.value)">
            </label>
            <label class="tdv-time-field">
              <span>Do</span>
              <input type="time" value="${escapeAttr(it.endTime || '')}" onchange="updateTripDayItemField(${day},'${it.id}','endTime',this.value)">
            </label>
          `}
          <button type="button" class="tdv-time-toggle" onclick="toggleTripDayItemTimeMode(${day},'${it.id}')" title="Przełącz między godzinami a czasem trwania">${it.timeMode === 'duration' ? 'Godziny' : 'Czas trwania'}</button>
        </div>
      </div>
      <div class="tdv-item-actions">
        <button type="button" class="tdv-item-btn" onclick="moveTripDayItemById(${day},'${it.id}','up')" ${idx === 0 ? 'disabled' : ''} aria-label="W górę">▲</button>
        <button type="button" class="tdv-item-btn" onclick="moveTripDayItemById(${day},'${it.id}','down')" ${isLast ? 'disabled' : ''} aria-label="W dół">▼</button>
        <button type="button" class="tdv-item-btn tdv-item-del" onclick="removeTripDayItemById(${day},'${it.id}')" aria-label="Usuń">×</button>
      </div>
    </div>${travelHtml}`;
  }

  function renderDayView(day){
    const t = getTrip(); if(!t) return;
    ensureTripPlan(t);
    const container = document.getElementById(ctx.containerId);
    if(!container) return;

    const total = ctx.dayCount(t);
    if(typeof day !== 'number' || day < 0 || day >= total){
      ctx.onInvalidDay();
      return;
    }
    activeDay = day;

    const d = ensureDay(t, day);
    const meta = (t.dayMeta && t.dayMeta[day]) || {};
    const dateLabel = ctx.dateLabel(t, day);
    const color = (typeof planDayColor === 'function') ? planDayColor(day) : '#0088b0';

    const itemsHtml = d.items.length
      ? d.items.map((it, idx) => {
          const isLast = idx === d.items.length - 1;
          const info = findRow(t, it.rowId);
          if(!info) return `<div class="tdv-item tdv-item-missing" data-item="${escapeAttr(it.id)}">
            <span class="tdv-item-num">${idx + 1}</span>
            <span class="tdv-item-name">Punkt usunięty (kliknij Usuń)</span>
            <button type="button" class="tdv-item-btn tdv-item-del" onclick="removeTripDayItemById(${day},'${it.id}')">Usuń</button>
          </div>`;
          const point = findPoint(t, it.rowId);
          return renderItemBlock(it, idx, day, info, point, isLast);
        }).join('')
      : `<div class="tdv-empty"><p>Brak punktów w tym dniu. Kliknij „Dodaj punkty", aby wybrać je na mapie.</p></div>`;

    container.innerHTML = `<div class="tdv-view">
      <header class="tdv-head" style="--day-color:${color};">
        <button type="button" class="tdv-nav" onclick="tripDayGoPrev()" ${day === 0 ? 'disabled' : ''} aria-label="Poprzedni dzień">‹</button>
        <div class="tdv-head-main">
          <div class="tdv-head-kicker">Dzień ${day + 1}</div>
          <input class="tdv-head-title" type="text" value="${escapeAttr(meta.title || '')}" placeholder="Tytuł dnia" oninput="updateDayPlanMeta(${day},'title',this.value)">
          ${dateLabel ? `<div class="tdv-head-date">${escapeHtml(dateLabel)}</div>` : ''}
        </div>
        <button type="button" class="tdv-nav" onclick="tripDayGoNext()" ${day >= total - 1 ? 'disabled' : ''} aria-label="Następny dzień">›</button>
      </header>

      <div class="tdv-body">
        <section class="tdv-list">
          <div class="tdv-list-head">
            <h3>Punkty dnia</h3>
            <button type="button" class="btn btn-primary btn-sm" onclick="openTripDayPicker(${day})">Dodaj punkty</button>
          </div>
          <div class="tdv-items">${itemsHtml}</div>
          <textarea class="tdv-note" placeholder="Notatki dnia — pomysły, kolejność, godziny…" oninput="updateDayPlanMeta(${day},'desc',this.value)">${escapeHtml(meta.desc || '')}</textarea>
        </section>
        <section class="tdv-map-section">
          <div class="tdv-map"></div>
        </section>
      </div>

      <div class="tdv-back">
        <button type="button" class="btn btn-secondary btn-sm" onclick="planDayGoBack()">${escapeHtml(ctx.backLabel)}</button>
      </div>
    </div>`;

    buildTripDayMap(day);
  }

  window.planDayGoBack = () => ctx.selectDay('all');

  window.renderTripDayView = function(day){
    ctx = TRIP_CTX;
    renderDayView(day);
  };

  // hostCtx: { getHost, save, containerId, dayCount, dateLabel, center, selectDay, onInvalidDay, backLabel }
  window.renderPlanDayView = function(hostCtx, day){
    ctx = hostCtx;
    renderDayView(day);
  };
})();
