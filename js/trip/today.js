// „Dziś w podróży": gdy dzisiejsza data wypada w którejś podróży, ekran główny pokazuje
// plan tego dnia, a skrót z ikony aplikacji (manifest → ./?view=today) otwiera go od razu.
(function(){
  const DAY_TABLES = ['atrakcje', 'restauracje', 'miejscowki'];

  function esc(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 'YYYY-MM-DD' → północ czasu lokalnego (new Date('YYYY-MM-DD') to północ UTC)
  function localDate(str){
    const m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  // Podróże trwające dziś, z indeksem dzisiejszego dnia
  function tripsToday(){
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return (window.trips || []).map(trip => {
      const s = localDate(trip.startDate), e = localDate(trip.endDate);
      if(!s || !e || today < s || today > e) return null;
      return { trip, day: Math.round((today - s) / 86400000), total: Math.round((e - s) / 86400000) + 1 };
    }).filter(Boolean).sort((a, b) => localDate(a.trip.startDate) - localDate(b.trip.startDate));
  }
  window.getTripsToday = tripsToday;

  function findRow(trip, rowId){
    if(typeof window.resolvePlanDayRow === 'function') return window.resolvePlanDayRow(trip, rowId);
    for(const k of DAY_TABLES){
      const row = ((trip.tables && trip.tables[k]) || []).find(r => r.id === rowId);
      if(row) return { row, tableKey: k };
    }
    return null;
  }

  function timeLabel(it){
    if(it.timeMode === 'duration') return it.duration || '';
    if(it.startTime && it.endTime) return `${it.startTime}–${it.endTime}`;
    return it.startTime || '';
  }

  function renderTodayCard({ trip, day, total }){
    const items = (trip.plan && trip.plan.days && trip.plan.days[day] && trip.plan.days[day].items) || [];
    const meta = (trip.dayMeta && trip.dayMeta[day]) || {};
    const title = (meta.title || '').trim();
    const note = (meta.desc || '').trim();
    const rows = items.map(it => {
      const info = findRow(trip, it.rowId);
      if(!info) return '';
      const t = timeLabel(it);
      return `<li class="today-item research-theme-${info.tableKey}">
        <span class="today-item-dot" aria-hidden="true"></span>
        <span class="today-item-name">${esc(info.row.nazwa || '(bez nazwy)')}</span>
        ${t ? `<span class="today-item-time">${esc(t)}</span>` : ''}
      </li>`;
    }).join('');
    return `<article class="today-card">
      <div class="today-head">
        <p class="today-kicker">Dziś w podróży · Dzień ${day + 1} z ${total}</p>
        <h3 class="today-title">${esc(trip.name || trip.destination || 'Podróż')}${title ? ` <span class="today-daytitle">— ${esc(title)}</span>` : ''}</h3>
      </div>
      ${rows ? `<ol class="today-items">${rows}</ol>` : `<p class="today-empty">Na dziś nie ma jeszcze punktów w planie.</p>`}
      ${note ? `<p class="today-note">${esc(note)}</p>` : ''}
      <button type="button" class="btn btn-primary btn-sm today-open" onclick="openTodayQuickView('${esc(trip.id)}', ${day})">Pokaż plan i mapę</button>
    </article>`;
  }

  // ---------- Szybki podgląd dnia: tylko kroki + mapa, bez interfejsu podróży ----------
  let qvMap = null;
  let qvState = null; // { tripId, day, pushed }

  function findPoint(trip, rowId){
    return (trip.planPoints || []).find(p => p.id === rowId);
  }

  function dayCountOf(trip){
    const s = localDate(trip.startDate), e = localDate(trip.endDate);
    return (s && e) ? Math.round((e - s) / 86400000) + 1 : 0;
  }

  function dateLabelOf(trip, day){
    const d = localDate(trip.startDate); if(!d) return '';
    d.setDate(d.getDate() + day);
    return d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function navUrl(coords){
    return `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}`;
  }

  function renderQuickView(){
    const bd = document.querySelector('.tqv-backdrop');
    if(!bd || !qvState) return;
    const trip = (window.trips || []).find(t => t.id === qvState.tripId);
    if(!trip){ closeQuickView(); return; }
    const total = dayCountOf(trip);
    const day = Math.max(0, Math.min(qvState.day, total - 1));
    qvState.day = day;
    const items = (trip.plan && trip.plan.days && trip.plan.days[day] && trip.plan.days[day].items) || [];
    const meta = (trip.dayMeta && trip.dayMeta[day]) || {};
    const todayIdx = (tripsToday().find(x => x.trip.id === trip.id) || {}).day;

    const steps = items.map((it, idx) => {
      const info = findRow(trip, it.rowId);
      if(!info) return '';
      const point = findPoint(trip, it.rowId);
      const hasCoords = !!(point && point.coords && point.coords.length === 2);
      const t = timeLabel(it);
      const loc = info.row.lokalizacja || info.row.miejsce || '';
      const isLast = idx === items.length - 1;
      const travel = [it.travelToNext, it.travelMode].filter(Boolean).join(' · ');
      return `<li class="tqv-step research-theme-${info.tableKey}">
        <span class="tqv-num">${idx + 1}</span>
        <div class="tqv-step-body">
          <div class="tqv-step-top">
            <span class="tqv-step-name">${esc(info.row.nazwa || '(bez nazwy)')}</span>
            ${t ? `<span class="tqv-step-time">${esc(t)}</span>` : ''}
          </div>
          ${loc ? `<div class="tqv-step-loc">${esc(loc)}</div>` : ''}
          ${hasCoords ? `<a class="tqv-nav" href="${navUrl(point.coords)}" target="_blank" rel="noopener noreferrer">Prowadź ↗</a>` : ''}
        </div>
      </li>${!isLast && travel ? `<li class="tqv-travel" aria-label="Dojazd">↓ ${esc(travel)}</li>` : ''}`;
    }).join('');

    bd.querySelector('.tqv-card').innerHTML = `
      <header class="tqv-head">
        <button type="button" class="tqv-arrow" data-go="-1" ${day === 0 ? 'disabled' : ''} aria-label="Poprzedni dzień">‹</button>
        <div class="tqv-head-main">
          <p class="tqv-kicker">${day === todayIdx ? 'Dziś · ' : ''}Dzień ${day + 1} z ${total}</p>
          <h3 class="tqv-title">${esc(meta.title || trip.name || 'Plan dnia')}</h3>
          <p class="tqv-date">${esc(dateLabelOf(trip, day))}${meta.title ? ` · ${esc(trip.name || '')}` : ''}</p>
        </div>
        <button type="button" class="tqv-arrow" data-go="1" ${day >= total - 1 ? 'disabled' : ''} aria-label="Następny dzień">›</button>
        <button type="button" class="qr-close tqv-close" data-close aria-label="Zamknij">×</button>
      </header>
      <div class="tqv-body">
        <div class="tqv-map"></div>
        ${steps ? `<ol class="tqv-steps">${steps}</ol>` : `<p class="tqv-empty">Brak punktów w planie tego dnia.</p>`}
        ${(meta.desc || '').trim() ? `<p class="tqv-note">${esc(meta.desc.trim())}</p>` : ''}
        <button type="button" class="tqv-edit" data-edit>Edytuj w planie podróży</button>
      </div>`;

    buildQuickMap(trip, items);
  }

  function buildQuickMap(trip, items){
    if(qvMap){ qvMap.remove(); qvMap = null; }
    const el = document.querySelector('.tqv-backdrop .tqv-map');
    if(!el || typeof L === 'undefined') return;
    qvMap = L.map(el, { zoomControl: true }).setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(qvMap);
    const css = getComputedStyle(document.documentElement);
    const coords = [];
    items.forEach((it, idx) => {
      const point = findPoint(trip, it.rowId);
      if(!point || !point.coords || point.coords.length !== 2) return;
      const info = findRow(trip, it.rowId);
      const color = info ? (info.color || css.getPropertyValue('--rsc-' + info.tableKey).trim()) : '#333';
      const icon = L.divIcon({ html: `<div class="tdv-pin" style="background:${color};">${idx + 1}</div>`, className: 'tdv-pin-wrap', iconSize: [28, 28], iconAnchor: [14, 14] });
      L.marker(point.coords, { icon }).addTo(qvMap).bindPopup(`<b>${esc((info && info.row.nazwa) || point.name || '')}</b>`);
      coords.push(point.coords);
    });
    if(coords.length >= 2){
      L.polyline(coords, { color: '#1e3a8a', weight: 3.5, opacity: 0.9, dashArray: '6,6' }).addTo(qvMap);
      qvMap.fitBounds(L.latLngBounds(coords), { padding: [30, 30] });
    } else if(coords.length === 1){
      qvMap.setView(coords[0], 14);
    } else if(trip.coords){
      qvMap.setView([trip.coords.lat, trip.coords.lng], 11);
    }
    setTimeout(() => qvMap && qvMap.invalidateSize(), 60);
  }

  function onQvKey(e){ if(e.key === 'Escape') closeQuickView(); }

  // Systemowy „wstecz" (Android) zamyka podgląd zamiast wychodzić z aplikacji
  function onQvPop(){
    if(qvState){ qvState.pushed = false; closeQuickView(); }
  }

  function closeQuickView(){
    const st = qvState;
    qvState = null;
    if(qvMap){ qvMap.remove(); qvMap = null; }
    document.querySelectorAll('.tqv-backdrop').forEach(el => el.remove());
    document.documentElement.classList.remove('tqv-open');
    document.removeEventListener('keydown', onQvKey);
    window.removeEventListener('popstate', onQvPop);
    if(st && st.pushed){ try { history.back(); } catch(e){} }
  }
  window.closeTodayQuickView = closeQuickView;

  window.openTodayQuickView = function(tripId, day){
    if(qvState){ qvState.tripId = tripId; qvState.day = day; renderQuickView(); return; }
    const bd = document.createElement('div');
    bd.className = 'tqv-backdrop';
    bd.innerHTML = `<div class="tqv-card" role="dialog" aria-modal="true" aria-label="Plan dnia"></div>`;
    bd.addEventListener('click', e => {
      if(e.target === bd || e.target.closest('[data-close]')){ closeQuickView(); return; }
      const go = e.target.closest('[data-go]');
      if(go && !go.disabled){ qvState.day += Number(go.dataset.go); renderQuickView(); return; }
      if(e.target.closest('[data-edit]')){
        const { tripId: id, day: d } = qvState;
        closeQuickView();
        window.openTripToday(id, d);
      }
    });
    document.body.appendChild(bd);
    document.documentElement.classList.add('tqv-open');
    qvState = { tripId, day, pushed: false };
    try { history.pushState({ tqv: 1 }, ''); qvState.pushed = true; } catch(e){}
    document.addEventListener('keydown', onQvKey);
    window.addEventListener('popstate', onQvPop);
    renderQuickView();
  };

  // Zmiana danych (np. z innego urządzenia) przy otwartym podglądzie
  window.refreshTodayQuickView = function(){ if(qvState) renderQuickView(); };

  window.renderHomeToday = function(){
    const el = document.getElementById('home-today');
    if(!el) return;
    const list = tripsToday();
    el.hidden = list.length === 0;
    el.innerHTML = list.map(renderTodayCard).join('');
    if(qvState) renderQuickView();
  };

  window.openTripToday = function(tripId, day){
    if(typeof window.openTripBoard !== 'function') return;
    window.openTripBoard(tripId, 'home');
    planSelectedDay = day;
    if(typeof window.setTripViewPanel === 'function') window.setTripViewPanel('day');
  };

  // Start ze skrótu „Plan na dziś": ekran główny + szybki podgląd dzisiejszego dnia pierwszej
  // trwającej podróży. Zwraca true (wtedy restoreLastView nie przywraca poprzedniego widoku).
  window.consumeTodayShortcut = function(){
    let wanted = false;
    try { wanted = new URLSearchParams(location.search).get('view') === 'today'; } catch(e){}
    if(!wanted) return false;
    try { history.replaceState(null, '', location.pathname); } catch(e){}
    if(typeof window.showMainTab === 'function') window.showMainTab('home');
    const list = tripsToday();
    if(list.length) window.openTodayQuickView(list[0].trip.id, list[0].day);
    return true;
  };
})();
