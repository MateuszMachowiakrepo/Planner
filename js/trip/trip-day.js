(function(){
  const DAY_TABLES = ['atrakcje', 'restauracje', 'miejscowki', 'apartamenty'];

  const TABLE_LABEL = {
    atrakcje: 'Atrakcje',
    restauracje: 'Restauracje',
    miejscowki: 'Miejscówki',
    apartamenty: 'Apartamenty'
  };

  const TABLE_COLOR = {
    atrakcje: 'var(--rsc-atrakcje)',
    restauracje: 'var(--rsc-restauracje)',
    miejscowki: 'var(--rsc-miejscowki)',
    apartamenty: 'var(--rsc-apartamenty)'
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
      if(it.routeMode && !RouteLines.PROFILES[it.routeMode]) it.routeMode = '';
      if(it.timeMode !== 'hours' && it.timeMode !== 'duration') it.timeMode = 'hours';
    });
    return trip.plan.days[day];
  }

  // Punkty postawione na mapie przed powiązaniem z tabelami nie mają wiersza — kolor i etykietę
  // biorą wtedy z kategorii punktu, a jako „wiersz" służy sam punkt.
  const CAT_TO_DAY_TABLE = { attraction: 'atrakcje', restaurant: 'restauracje', place: 'miejscowki', apartment: 'apartamenty' };

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

  // Nowa kolejność po przeciągnięciu kafelka. „Dojazd" zostaje tylko tam, gdzie następny punkt się nie zmienił.
  window.reorderTripDayItems = function(day, orderedIds){
    const t = getTrip(); if(!t) return;
    const d = ensureDay(t, day);
    const byId = new Map(d.items.map(it => [it.id, it]));
    const nextBefore = new Map(d.items.map((it, i) => [it.id, d.items[i + 1] ? d.items[i + 1].id : null]));
    const items = orderedIds.map(id => byId.get(id)).filter(Boolean);
    d.items.forEach(it => { if(!items.includes(it)) items.push(it); });
    if(items.every((it, i) => it === d.items[i])){ rerender(day); return; }
    items.forEach((it, i) => {
      const next = items[i + 1] ? items[i + 1].id : null;
      if(nextBefore.get(it.id) !== next){ it.travelToNext = ''; it.travelMode = ''; }
    });
    d.items = items;
    save();
    rerender(day);
  };

  function routeProfileOf(t, day){
    return RouteLines.profileKey(t && t.dayMeta && t.dayMeta[day] && t.dayMeta[day].routeMode);
  }

  // Sposób dotarcia do następnego punktu: własny wybór albo domyślny dla dnia.
  function legProfileOf(t, day, it){
    return it && RouteLines.PROFILES[it.routeMode] ? it.routeMode : routeProfileOf(t, day);
  }

  window.setTripDayItemRouteMode = function(day, itemId, mode){
    const t = getTrip(); if(!t) return;
    const it = ensureDay(t, day).items.find(i => i.id === itemId);
    if(!it) return;
    it.routeMode = RouteLines.PROFILES[mode] ? mode : '';
    save();
    buildTripDayMap(day);
  };

  window.setTripDayRouteMode = function(day, mode){
    const t = getTrip(); if(!t) return;
    if(!t.dayMeta || typeof t.dayMeta !== 'object') t.dayMeta = {};
    if(!t.dayMeta[day]) t.dayMeta[day] = {};
    t.dayMeta[day].routeMode = RouteLines.profileKey(mode);
    save();
    const root = document.getElementById(ctx.containerId);
    if(root) root.querySelectorAll('.tdv-route-chip').forEach(b => {
      const on = b.dataset.mode === t.dayMeta[day].routeMode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    });
    buildTripDayMap(day);
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
    // stare punkty z mapy (bez wiersza w tabelach)
    (t.planPoints || t.points || []).forEach(p => {
      if(!p.coords || p.coords.length !== 2 || isTableRow(t, p.id)) return;
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
    const pickerProfile = routeProfileOf(t, day);
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
        if(pts.length >= 2) routeLine = RouteLines.draw(map, pts, { profile: pickerProfile });
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
  let tdvMarkerById = {};

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
    tdvMarkerById = {};
    tdvMap = L.map(container).setView([20, 0], 2);
    const map = tdvMap;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(tdvMap);

    const coords = [];
    const coordIdx = [];   // indeks punktu dnia dla każdej współrzędnej trasy
    d.items.forEach((it, idx) => {
      const point = findPoint(t, it.rowId);
      if(!point || !point.coords || point.coords.length !== 2) return;
      coordIdx.push(idx);
      const info = findRow(t, it.rowId);
      const color = info ? (info.color || getComputedStyle(document.documentElement).getPropertyValue('--rsc-' + info.tableKey).trim()) : '#333';
      const html = `<div class="tdv-pin" style="background:${color};">${idx + 1}</div>`;
      const icon = L.divIcon({ html, className: 'tdv-pin-wrap', iconSize: [28, 28], iconAnchor: [14, 14] });
      const marker = L.marker(point.coords, { icon }).addTo(tdvMap);
      const name = info?.row?.nazwa || point.name || '(bez nazwy)';
      // autoPan wyłączony: inaczej otwarcie popupu przerywa centrowanie mapy na punkcie.
      marker.bindPopup(`<b>${escapeHtml(name)}</b>`, { autoPan: false });
      tdvMarkers.push(marker);
      tdvMarkerById[it.id] = marker;
      coords.push(point.coords);
    });

    root.querySelectorAll('.tdv-travel-auto').forEach(el => { el.textContent = ''; el.hidden = true; });
    root.querySelectorAll('.tdv-route-total').forEach(el => { el.textContent = ''; });
    if(coords.length >= 2){
      const segs = coords.slice(0, -1).map((c, k) => ({ from: c, to: coords[k + 1], profile: legProfileOf(t, day, d.items[coordIdx[k]]) }));
      RouteLines.drawSegments(tdvMap, segs, legs => {
        if(tdvMap !== map) return;
        const ok = legs.filter(Boolean);
        root.querySelectorAll('.tdv-route-total').forEach(el => {
          el.textContent = !ok.length
            ? 'Linia prosta — serwer tras nie odpowiada'
            : `${RouteLines.fmtDistance(ok.reduce((s, l) => s + l.distance, 0))} · ${RouteLines.fmtDuration(ok.reduce((s, l) => s + l.duration, 0))}${ok.length < legs.length ? ' (część odcinków: linia prosta)' : ''}`;
        });
        // Szacunek odcinka trafia pod kafelek tylko, gdy oba punkty sąsiadują ze sobą w planie dnia.
        legs.forEach((leg, k) => {
          if(!leg) return;
          const from = coordIdx[k], to = coordIdx[k + 1];
          if(to !== from + 1) return;
          const it = d.items[from];
          const el = it && root.querySelector(`.tdv-travel-auto[data-from="${CSS.escape(it.id)}"]`);
          if(!el) return;
          el.textContent = `≈ ${RouteLines.fmtDuration(leg.duration)} · ${RouteLines.fmtDistance(leg.distance)}`;
          el.hidden = false;
        });
      });
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
      <span class="tdv-travel-auto" data-from="${escapeAttr(it.id)}" title="Szacunek wg trasy na mapie" hidden></span>
      <select class="tdv-travel-input tdv-travel-route" aria-label="Sposób dotarcia do następnego punktu" title="Sposób dotarcia (trasa na mapie)" onchange="setTripDayItemRouteMode(${day},'${it.id}',this.value)">
        ${RouteLines.PROFILE_ORDER.map(k => `<option value="${k}"${legProfileOf(getTrip(), day, it) === k ? ' selected' : ''}>${RouteLines.PROFILES[k].label}</option>`).join('')}
      </select>
    </div>`;
    const hours = info.row.otwarcie;

    return `<div class="tdv-slot" data-item="${escapeAttr(it.id)}"><div class="tdv-item research-theme-${info.tableKey}">
      <button type="button" class="tdv-drag-handle" aria-label="Przeciągnij, aby zmienić kolejność (lub strzałki w górę/dół)" title="Przeciągnij, aby zmienić kolejność">⠿</button>
      <span class="tdv-item-num">${idx + 1}</span>
      <div class="tdv-item-body">
        <div class="tdv-item-name">${escapeHtml(name)}</div>
        <div class="tdv-item-meta">${escapeHtml(catLabel)}${loc ? ' · ' + escapeHtml(loc) : ''}${price ? ' · ' + Number(price).toLocaleString('pl-PL') + ' zł' : ''}${missingCoords ? ' · brak lokalizacji' : ''}</div>
        ${hours ? `<div class="tdv-item-hours" title="Godziny otwarcia">${escapeHtml(hours)}</div>` : ''}
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
        <button type="button" class="tdv-item-btn tdv-item-del" onclick="removeTripDayItemById(${day},'${it.id}')" aria-label="Usuń">×</button>
      </div>
    </div>${travelHtml}</div>`;
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
          if(!info) return `<div class="tdv-slot" data-item="${escapeAttr(it.id)}"><div class="tdv-item tdv-item-missing">
            <span class="tdv-item-num">${idx + 1}</span>
            <span class="tdv-item-name">Punkt usunięty (kliknij Usuń)</span>
            <button type="button" class="tdv-item-btn tdv-item-del" onclick="removeTripDayItemById(${day},'${it.id}')">Usuń</button>
          </div></div>`;
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
          <div class="tdv-route-bar">
            <span class="tdv-route-total" aria-live="polite"></span>
          </div>
          <div class="tdv-map"></div>
        </section>
      </div>

      <div class="tdv-back">
        <button type="button" class="btn btn-secondary btn-sm" onclick="planDayGoBack()">${escapeHtml(ctx.backLabel)}</button>
      </div>
    </div>`;

    bindDayDrag(container.querySelector('.tdv-items'), day);
    bindTileFocus(container.querySelector('.tdv-items'), day);
    buildTripDayMap(day);
  }

  // Kliknięcie kafelka (poza polami i przyciskami) pokazuje punkt na mapie obok.
  // Kliknięcie poza kafelkiem zdejmuje podświetlenie (listener dokumentu dodajemy raz).
  // Odznaczenie kafelka zdejmuje też zaznaczenie punktu na mapie i wraca do widoku całego dnia.
  function clearTileFocus(){
    const active = document.querySelectorAll('.tdv-item-active');
    if(!active.length) return;
    active.forEach(el => el.classList.remove('tdv-item-active'));
    if(!tdvMap) return;
    tdvMap.closePopup();
    const pts = tdvMarkers.map(m => m.getLatLng());
    if(pts.length >= 2) tdvMap.flyToBounds(L.latLngBounds(pts), { padding: [30, 30], duration: 0.6 });
    else if(pts.length === 1) tdvMap.flyTo(pts[0], 13, { duration: 0.6 });
  }

  document.addEventListener('click', e => {
    if(e.target.closest('.tdv-item, .tdv-map')) return;
    clearTileFocus();
  });

  function bindTileFocus(list, day){
    if(!list) return;
    list.addEventListener('click', e => {
      if(e.target.closest('input, select, textarea, button, label')) return;
      const slot = e.target.closest('.tdv-slot');
      if(!slot || !tdvMap) return;
      const marker = tdvMarkerById[slot.dataset.item];
      if(!marker) return;
      const tile = slot.querySelector('.tdv-item');
      if(tile && tile.classList.contains('tdv-item-active')){ clearTileFocus(); return; }
      list.querySelectorAll('.tdv-item-active').forEach(el => el.classList.remove('tdv-item-active'));
      if(tile) tile.classList.add('tdv-item-active');
      // flyTo robi łuk (oddala i przybliża) i trwa długo przy przeskoku między punktami —
      // zwykłe, krótkie przesunięcie jest dużo szybsze.
      tdvMap.stop();
      tdvMap.setView(marker.getLatLng(), Math.max(tdvMap.getZoom(), 15), { animate: true, duration: 0.3, easeLinearity: 0.5 });
      marker.openPopup();
    });
  }

  // Przeciąganie kafelków za uchwyt ⠿ (mysz i dotyk). Kafelek „płynie" za kursorem, a pusty
  // placeholder pokazuje, gdzie wyląduje. Strzałki góra/dół na uchwycie robią to samo z klawiatury.
  function bindDayDrag(list, day){
    if(!list) return;
    list.querySelectorAll('.tdv-drag-handle').forEach(handle => {
      const slot = handle.closest('.tdv-slot');
      handle.addEventListener('keydown', e => {
        if(e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const id = slot.dataset.item;
        window.moveTripDayItemById(day, id, e.key === 'ArrowUp' ? 'up' : 'down');
        const again = document.querySelector(`#${ctx.containerId} .tdv-slot[data-item="${CSS.escape(id)}"] .tdv-drag-handle`);
        if(again) again.focus();
      });
      handle.addEventListener('pointerdown', e => {
        if(e.button !== 0) return;
        e.preventDefault();
        const rect = slot.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const ph = document.createElement('div');
        ph.className = 'tdv-drop-placeholder';
        ph.style.height = rect.height + 'px';
        slot.after(ph);
        Object.assign(slot.style, { position: 'fixed', left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', zIndex: 1000 });
        slot.classList.add('tdv-dragging');
        list.classList.add('tdv-list-dragging');
        handle.setPointerCapture(e.pointerId);
        let lastY = e.clientY;
        let scrollTimer = null;

        function place(y){
          slot.style.top = (y - offsetY) + 'px';
          const others = [...list.querySelectorAll('.tdv-slot')].filter(s => s !== slot);
          const before = others.find(s => { const r = s.getBoundingClientRect(); return y < r.top + r.height / 2; });
          if(before){ if(ph.nextElementSibling !== before) list.insertBefore(ph, before); }
          else if(list.lastElementChild !== ph) list.appendChild(ph);
        }
        // Przy krawędzi okna strona sama się przewija, żeby dało się przenieść punkt daleko.
        function autoScroll(y){
          clearInterval(scrollTimer);
          const edge = 60, vh = window.innerHeight;
          const dir = y < edge ? -1 : y > vh - edge ? 1 : 0;
          if(dir) scrollTimer = setInterval(() => { window.scrollBy(0, dir * 12); place(lastY); }, 16);
        }
        const onMove = ev => { lastY = ev.clientY; place(lastY); autoScroll(lastY); };
        const onUp = () => {
          clearInterval(scrollTimer);
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
          handle.removeEventListener('pointercancel', onUp);
          ph.replaceWith(slot);
          slot.removeAttribute('style');
          slot.classList.remove('tdv-dragging');
          list.classList.remove('tdv-list-dragging');
          window.reorderTripDayItems(day, [...list.querySelectorAll('.tdv-slot')].map(s => s.dataset.item));
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
      });
    });
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
