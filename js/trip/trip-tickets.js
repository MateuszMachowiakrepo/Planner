(function(){
  // ---------- Strony — kafelki z linkami do muzeów/atrakcji (jak Inspiracje w researchu) ----------
  // Dane zostają w trip.tickets (dawna sekcja Bilety), żeby nie gubić tego, co już zapisane.
  let siteFilter = '';

  function genId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function escapeHtml(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }
  function getTrip(){ return typeof activeTripObj === 'function' ? activeTripObj() : null; }
  function save(){ if(typeof window.saveTrips === 'function') window.saveTrips(); }

  function normalizeUrl(raw){
    const s = String(raw || '').trim();
    if(!s) return '';
    const withProto = /^https?:\/\//i.test(s) ? s : 'https://' + s;
    try { const u = new URL(withProto); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch(e){ return ''; }
  }

  function ensureSites(trip){
    if(trip && !Array.isArray(trip.tickets)) trip.tickets = [];
  }

  // Starsze wpisy z sekcji Bilety mogą mieć plik zamiast linku — nadal je pokazujemy.
  function sourceOf(t){
    if(t.file){
      const type = t.file.type || '';
      if(type === 'application/pdf' || /\.pdf$/i.test(t.file.name || '')) return { key: 'pdf', label: 'PDF' };
      if(type.startsWith('image/')) return { key: 'image', label: 'Zdjęcie' };
      return { key: 'file', label: 'Plik' };
    }
    let host = '';
    try { host = new URL(t.url).hostname.replace(/^www\.|^m\./, ''); } catch(e){}
    return { key: 'web', label: host || 'Link' };
  }

  window.renderTripTickets = function(){
    const trip = getTrip();
    const list = document.getElementById('ticket-list');
    const filters = document.getElementById('ticket-filters');
    if(!trip || !list || !filters) return;
    ensureSites(trip);
    const items = trip.tickets;
    const kinds = [...new Set(items.map(i => (i.kind || '').trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'pl'));
    if(siteFilter && !kinds.includes(siteFilter)) siteFilter = '';

    const dl = document.getElementById('ticket-kinds');
    if(dl) dl.innerHTML = kinds.map(k => `<option value="${escapeAttr(k)}"></option>`).join('');

    filters.innerHTML = kinds.length > 1
      ? [['', `Wszystkie (${items.length})`], ...kinds.map(k => [k, k])].map(([val, label]) =>
          `<button type="button" class="inspo-filter${val === siteFilter ? ' active' : ''}" data-kind="${escapeAttr(val)}" onclick="setTripTicketFilter(this.dataset.kind)">${escapeHtml(label)}</button>`
        ).join('')
      : '';

    if(!items.length){
      list.innerHTML = `<p class="research-empty">Brak stron. Wklej link do muzeum lub atrakcji powyżej.</p>`;
      return;
    }
    const shown = siteFilter ? items.filter(i => (i.kind || '').trim() === siteFilter) : items;
    list.innerHTML = shown.slice().reverse().map(t => {
      const src = sourceOf(t);
      const href = t.file ? t.file.url : t.url;
      const media = src.key === 'image'
        ? `<img src="${escapeAttr(href)}" alt="" loading="lazy">`
        : `<span class="inspo-thumb-label">${escapeHtml(t.kind || src.label)}</span>`;
      return `<article class="inspo-card ticket-card" data-source="${src.key}">
        <a class="inspo-thumb" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true">${media}</a>
        <div class="inspo-body">
          <div class="inspo-meta">
            <span class="inspo-platform">${escapeHtml(src.label)}</span>
            ${t.kind ? `<span class="inspo-topic">${escapeHtml(t.kind)}</span>` : ''}
          </div>
          <a class="inspo-name" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.name || (t.file && t.file.name) || href)}</a>
        </div>
        <button type="button" class="inspo-remove" onclick="removeTripTicket('${escapeAttr(t.id)}')" aria-label="Usuń stronę">&times;</button>
      </article>`;
    }).join('');
  };

  window.addTripTicket = function(){
    const trip = getTrip();
    if(!trip) return;
    ensureSites(trip);
    const nameEl = document.getElementById('ticket-name');
    const kindEl = document.getElementById('ticket-kind');
    const linkEl = document.getElementById('ticket-link');
    const url = normalizeUrl(linkEl.value);
    if(!url){ alert('Podaj poprawny link (http/https).'); linkEl.focus(); return; }
    trip.tickets.push({ id: genId(), name: nameEl.value.trim(), kind: kindEl.value.trim(), url });
    save();
    nameEl.value = '';
    linkEl.value = '';
    window.renderTripTickets();
    nameEl.focus();
  };

  window.removeTripTicket = function(id){
    const trip = getTrip();
    if(!trip) return;
    if(!confirm('Usunąć tę stronę?')) return;
    const t = (trip.tickets || []).find(x => x.id === id);
    trip.tickets = (trip.tickets || []).filter(x => x.id !== id);
    save();
    if(t && t.file && t.file.path && typeof window.deleteUserFile === 'function') window.deleteUserFile(t.file.path);
    window.renderTripTickets();
  };

  window.setTripTicketFilter = function(kind){
    siteFilter = kind || '';
    window.renderTripTickets();
  };
})();
