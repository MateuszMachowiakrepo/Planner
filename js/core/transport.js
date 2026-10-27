// Tabela „Transport" (dawniej „Loty") — wspólne definicje dla tablic Research i tabel podróży.
// Każda grupa wierszy to jedna podróż (z przesiadkami/etapami), a pole `mode` pierwszego wiersza
// mówi, czym jedziemy: lot / samochód / pociąg-bus. Klucze kolumn zostają po staremu (przylot = wyjazd,
// wylot = przyjazd, linia = firma), żeby zapisane dane nie wymagały migracji.
(function(){
  const MODES = {
    lot:      { label: 'Lot', depart: 'Wylot',  arrive: 'Przylot',  company: 'Linia lotnicza',       leg: '+ Przesiadka', transfer: true },
    samochod: { label: 'Samochód', depart: 'Wyjazd', arrive: 'Przyjazd', company: 'Auto / wypożyczalnia', leg: '+ Etap',       transfer: false },
    pociag:   { label: 'Pociąg / bus', depart: 'Odjazd', arrive: 'Przyjazd', company: 'Przewoźnik',           leg: '+ Przesiadka', transfer: true }
  };
  const MODE_ORDER = ['lot', 'samochod', 'pociag'];

  const COLUMNS = [
    { key: 'kierunek', label: 'Kierunek' },
    { key: 'data', label: 'Data', type: 'date' },
    { key: 'przylot', label: 'Wyjazd', type: 'time' },
    { key: 'wylot', label: 'Przyjazd', type: 'time' },
    { key: 'czyPrzesiadka', label: 'Przesiadka', type: 'yesno', transferOnly: true },
    { key: 'linia', label: 'Firma' },
    { key: 'cena', label: 'Cena', type: 'number', money: true }
  ];

  function modeKey(m){ return MODES[m] ? m : 'lot'; }
  function modeOf(group){ return modeKey(group && group[0] && group[0].mode); }

  // Etykieta kolumny w danym trybie (nagłówek w karcie mobilnej i placeholder pola).
  function colLabel(col, mode){
    const m = MODES[modeKey(mode)];
    if(col.key === 'przylot') return m.depart;
    if(col.key === 'wylot') return m.arrive;
    if(col.key === 'linia') return m.company;
    if(col.key === 'czyPrzesiadka') return 'Czy przesiadka';
    return col.label;
  }
  function showsCol(col, mode){ return !col.transferOnly || MODES[modeKey(mode)].transfer; }

  function isTime(v){ return /^\d{1,2}:\d{2}$/.test(String(v || '').trim()); }
  function isDate(v){ return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()); }

  // Czas między przyjazdem poprzedniego etapu a wyjazdem następnego (gdy daty/godziny są czytelne).
  function layover(prev, next){
    if(!isTime(prev.wylot) || !isTime(next.przylot)) return '';
    const d1 = isDate(prev.data) ? prev.data : null;
    const d2 = isDate(next.data) ? next.data : d1;
    if(!d1 || !d2) return '';
    const a = new Date(`${d1}T${prev.wylot.trim().padStart(5, '0')}`);
    const b = new Date(`${d2}T${next.przylot.trim().padStart(5, '0')}`);
    let min = Math.round((b - a) / 60000);
    if(!isFinite(min) || min < 0) return '';
    const h = Math.floor(min / 60); min %= 60;
    return h ? `${h} h${min ? ' ' + min + ' min' : ''}` : `${min} min`;
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Wiersz-nagłówek grupy: przełącznik środka transportu. setFn(groupId, mode) zmienia tryb.
  function groupHeadHtml(groupId, mode, colspan, setFn, removeFn){
    mode = modeKey(mode);
    const chips = MODE_ORDER.map(k => {
      const m = MODES[k];
      return `<button type="button" class="tr-mode-chip${k === mode ? ' active' : ''}" data-mode="${k}" aria-pressed="${k === mode}" onclick="${setFn}('${groupId}','${k}')">${m.label}</button>`;
    }).join('');
    return `<tr class="tr-group-head tr-mode-${mode}"><td colspan="${colspan}">
      <div class="tr-group-head-inner"><div class="tr-mode-switch" role="group" aria-label="Środek transportu">${chips}</div></div>
    </td></tr>`;
  }

  function connectorHtml(prev, next, mode, colspan){
    mode = modeKey(mode);
    const wait = layover(prev, next);
    const legacy = String(prev.przesiadka || '').trim();
    const word = MODES[mode].transfer ? 'Przesiadka' : 'Postój';
    const info = wait || legacy;
    return `<tr class="research-row-arrow tr-mode-${mode}"><td colspan="${colspan}"><span class="arrow-marker">↓</span>${info ? `<span class="tr-layover">${word} · ${esc(info)}</span>` : ''}</td></tr>`;
  }

  function groupEndHtml(groupId, mode, colspan, addLegFn){
    mode = modeKey(mode);
    return `<tr class="research-row-groupend tr-mode-${mode}"><td colspan="${colspan}">
      <button type="button" class="research-mini-btn" onclick="${addLegFn}('${groupId}')">${MODES[mode].leg}</button>
    </td></tr>`;
  }

  // Pole komórki dla kolumn date/time; null = niech wywołujący wyrenderuje zwykłe pole.
  // Stare wpisy tekstowe („10:30 15.07") zostają w polu tekstowym, żeby nic nie zginęło.
  function specialInputHtml(col, val, mode, onchangeJs){
    const ph = esc(colLabel(col, mode));
    if(col.type === 'date' && (val === '' || isDate(val))){
      return `<input class="research-cell-input tr-cell-date" type="date" value="${esc(val)}" aria-label="${ph}" onchange="${onchangeJs}">`;
    }
    if(col.type === 'time' && (val === '' || isTime(val))){
      return `<input class="research-cell-input tr-cell-time" type="time" value="${esc(val)}" aria-label="${ph}" onchange="${onchangeJs}">`;
    }
    return null;
  }

  // Nowy etap dziedziczy tryb, a datę bierze z poprzedniego etapu.
  function newLeg(prev, genId){
    const row = { id: genId(), checked: false, groupId: prev.groupId || prev.id, mode: modeKey(prev.mode) };
    COLUMNS.forEach(c => row[c.key] = '');
    row.data = prev.data || '';
    return row;
  }

  window.Transport = {
    MODES, MODE_ORDER, COLUMNS,
    modeKey, modeOf, colLabel, showsCol, layover,
    groupHeadHtml, connectorHtml, groupEndHtml, specialInputHtml, newLeg,
    TITLE: 'Transport', LEGACY_TITLE: 'Loty'
  };
})();
