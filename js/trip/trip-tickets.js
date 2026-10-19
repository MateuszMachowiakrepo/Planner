(function(){
  // ---------- Bilety — kafelki z linkiem albo plikiem (PDF/zdjęcie), jak Inspiracje w researchu ----------
  let ticketFilter = '';
  let ticketUploading = false;

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

  function ensureTickets(trip){
    if(trip && !Array.isArray(trip.tickets)) trip.tickets = [];
  }

  function stripExt(name){ return String(name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(); }

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

  function setUploading(on){
    ticketUploading = on;
    const btn = document.getElementById('ticket-add-btn');
    if(btn){ btn.disabled = on; btn.textContent = on ? 'Wysyłanie…' : 'Dodaj'; }
  }

  function resetFileInput(){
    const fileEl = document.getElementById('ticket-file');
    const label = document.getElementById('ticket-file-label');
    if(fileEl) fileEl.value = '';
    if(label){ label.textContent = 'Wybierz plik'; label.classList.remove('has-file'); }
  }

  window.renderTripTickets = function(){
    const trip = getTrip();
    const list = document.getElementById('ticket-list');
    const filters = document.getElementById('ticket-filters');
    if(!trip || !list || !filters) return;
    ensureTickets(trip);
    const items = trip.tickets;
    const kinds = [...new Set(items.map(i => (i.kind || '').trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'pl'));
    if(ticketFilter && !kinds.includes(ticketFilter)) ticketFilter = '';

    const dl = document.getElementById('ticket-kinds');
    if(dl) dl.innerHTML = kinds.map(k => `<option value="${escapeAttr(k)}"></option>`).join('');

    filters.innerHTML = kinds.length > 1
      ? [['', `Wszystkie (${items.length})`], ...kinds.map(k => [k, k])].map(([val, label]) =>
          `<button type="button" class="inspo-filter${val === ticketFilter ? ' active' : ''}" data-kind="${escapeAttr(val)}" onclick="setTripTicketFilter(this.dataset.kind)">${escapeHtml(label)}</button>`
        ).join('')
      : '';

    if(!items.length){
      list.innerHTML = `<p class="research-empty">Brak biletów. Wklej link albo dodaj plik powyżej.</p>`;
      return;
    }
    const shown = ticketFilter ? items.filter(i => (i.kind || '').trim() === ticketFilter) : items;
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
        <button type="button" class="inspo-remove" onclick="removeTripTicket('${escapeAttr(t.id)}')" aria-label="Usuń bilet">&times;</button>
      </article>`;
    }).join('');
  };

  window.onTripTicketFileChange = function(input){
    const file = input.files && input.files[0];
    const label = document.getElementById('ticket-file-label');
    if(label){
      label.textContent = file ? file.name : 'Wybierz plik';
      label.classList.toggle('has-file', !!file);
    }
    const nameEl = document.getElementById('ticket-name');
    if(file && nameEl && !nameEl.value.trim()) nameEl.value = stripExt(file.name);
  };

  window.addTripTicket = async function(){
    if(ticketUploading) return;
    const trip = getTrip();
    if(!trip) return;
    ensureTickets(trip);
    const nameEl = document.getElementById('ticket-name');
    const kindEl = document.getElementById('ticket-kind');
    const linkEl = document.getElementById('ticket-link');
    const fileEl = document.getElementById('ticket-file');
    const file = fileEl && fileEl.files && fileEl.files[0];
    const rawLink = linkEl.value.trim();

    if(!file && !rawLink){ alert('Wklej link albo wybierz plik z biletem.'); linkEl.focus(); return; }
    if(file && file.size > 15 * 1024 * 1024){ alert('Plik jest za duży (maks. 15 MB).'); return; }

    const ticket = { id: genId(), name: nameEl.value.trim(), kind: kindEl.value.trim() };
    if(file){
      if(typeof window.uploadUserFile !== 'function'){ alert('Wysyłanie plików jest niedostępne.'); return; }
      setUploading(true);
      try {
        const up = await window.uploadUserFile(file, `tickets/${trip.id}`);
        ticket.file = { name: file.name, type: file.type || '', size: file.size, path: up.path, url: up.url };
      } catch(e){
        console.error('Wysyłanie biletu:', e);
        alert('Nie udało się wysłać pliku: ' + (e && e.message ? e.message : e));
        setUploading(false);
        return;
      }
      setUploading(false);
    } else {
      const url = normalizeUrl(rawLink);
      if(!url){ alert('Podaj poprawny link (http/https).'); linkEl.focus(); return; }
      ticket.url = url;
    }
    if(!ticket.name) ticket.name = file ? stripExt(file.name) : '';

    // Podróż mogła zostać podmieniona przez echo z Firestore w trakcie wysyłania — dopisz do aktualnej.
    const current = getTrip() || trip;
    ensureTickets(current);
    current.tickets.push(ticket);
    save();
    nameEl.value = '';
    linkEl.value = '';
    resetFileInput();
    window.renderTripTickets();
    nameEl.focus();
  };

  window.removeTripTicket = function(id){
    const trip = getTrip();
    if(!trip) return;
    if(!confirm('Usunąć ten bilet?')) return;
    const t = (trip.tickets || []).find(x => x.id === id);
    trip.tickets = (trip.tickets || []).filter(x => x.id !== id);
    save();
    if(t && t.file && t.file.path && typeof window.deleteUserFile === 'function') window.deleteUserFile(t.file.path);
    window.renderTripTickets();
  };

  window.setTripTicketFilter = function(kind){
    ticketFilter = kind || '';
    window.renderTripTickets();
  };
})();
