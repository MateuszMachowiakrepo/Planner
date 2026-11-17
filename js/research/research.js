(function(){
  const TABLE_ORDER_FULL = ['koszty', 'loty', 'apartamenty', 'atrakcje', 'restauracje', 'miejscowki'];
  const TABLE_ORDER_QUICK = ['koszty_mix', 'miejscowki'];
  const QUICK_TYPE_OPTIONS = ['koszt', 'apartament', 'transport', 'restauracja', 'atrakcja'];
  const QUICK_TYPE_LABELS = { koszt: 'Koszt', apartament: 'Apartament', transport: 'Transport', restauracja: 'Restauracja', atrakcja: 'Atrakcja' };
  const QUICK_TYPE_FROM_CAT = { attraction: 'atrakcja', restaurant: 'restauracja', apartment: 'apartament' };
  const QUICK_CAT_FROM_TYPE = { atrakcja: 'attraction', restauracja: 'restaurant', apartament: 'apartment' };

  function isQuick(board){ return !!(board && board.quick); }
  function tableOrderFor(board){ return isQuick(board) ? TABLE_ORDER_QUICK : TABLE_ORDER_FULL; }

  const TABLE_DEFS = {
    koszty: {
      title: 'Koszty stałe',
      addLabel: 'Dodaj wiersz',
      columns: [
        { key: 'nazwa', label: 'Nazwa' },
        { key: 'kategoria', label: 'Kategoria' },
        { key: 'czas', label: 'Czas' },
        { key: 'cena', label: 'Cena', type: 'number', money: true }
      ],
      checkable: true,
      contributes: true
    },
    loty: {
      title: Transport.TITLE,
      addLabel: 'Nowy transport',
      columns: Transport.COLUMNS,
      checkable: true,
      contributes: true,
      grouped: true
    },
    apartamenty: {
      title: 'Apartamenty',
      addLabel: 'Dodaj wiersz',
      columns: [
        { key: 'nazwa', label: 'Nazwa' },
        { key: 'ocena', label: 'Ocena' },
        { key: 'freeCancel', label: 'Bezpłatne odwołanie', type: 'yesno' },
        { key: 'lokalizacja', label: 'Lokalizacja' },
        { key: 'cena', label: 'Cena', type: 'number', money: true }
      ],
      checkable: true,
      contributes: true
    },
    atrakcje: {
      title: 'Atrakcje',
      addLabel: 'Dodaj wiersz',
      columns: [
        { key: 'nazwa', label: 'Nazwa' },
        { key: 'kategoria', label: 'Kategoria' },
        { key: 'miejsce', label: 'Miejsce' },
        { key: 'czas', label: 'Czas trwania' },
        { key: 'otwarcie', label: 'Godziny otwarcia' },
        { key: 'cena', label: 'Cena', type: 'number', money: true }
      ],
      checkable: true,
      contributes: true
    },
    restauracje: {
      title: 'Restauracje',
      addLabel: 'Dodaj wiersz',
      columns: [
        { key: 'nazwa', label: 'Nazwa' },
        { key: 'lokalizacja', label: 'Lokalizacja' },
        { key: 'kuchnia', label: 'Rodzaj kuchni' },
        { key: 'oceny', label: 'Oceny' },
        { key: 'otwarcie', label: 'Godziny otwarcia' },
        { key: 'cena', label: 'Cena', type: 'number', money: true }
      ],
      checkable: true,
      contributes: true
    },
    miejscowki: {
      title: 'Miejscówki',
      addLabel: 'Dodaj wiersz',
      columns: [
        { key: 'nazwa', label: 'Nazwa' },
        { key: 'kategoria', label: 'Kategoria' },
        { key: 'lokalizacja', label: 'Lokalizacja' },
        { key: 'walory', label: 'Walory' },
        { key: 'otwarcie', label: 'Godziny otwarcia' }
      ],
      checkable: false,
      contributes: false
    },
    koszty_mix: {
      title: 'Koszty',
      addLabel: 'Dodaj wiersz',
      columns: [
        { key: 'nazwa', label: 'Nazwa' },
        { key: 'typ', label: 'Typ', type: 'select', options: QUICK_TYPE_OPTIONS, optionLabels: QUICK_TYPE_LABELS },
        { key: 'ocena', label: 'Ocena' },
        { key: 'cena', label: 'Cena', type: 'number', money: true }
      ],
      checkable: true,
      contributes: true
    }
  };

  let currentResearchBoardId = null;
  let currentResearchPanel = 'tables';
  let researchPlanDay = 'all';
  let researchMap = null;
  let researchMapMode = false;
  let researchMarkers = {};
  const CAT_TO_TABLE = { attraction: 'atrakcje', restaurant: 'restauracje', place: 'miejscowki', apartment: 'apartamenty' };
  const TABLE_TO_CAT = { atrakcje: 'attraction', restauracje: 'restaurant', miejscowki: 'place', apartamenty: 'apartment' };
  const CAT_LABEL = { attraction: 'atrakcję', restaurant: 'restaurację', place: 'miejscówkę', apartment: 'apartament' };
  const CAT_COLOR_FALLBACK = { attraction: '#c026d3', restaurant: '#ea580c', place: '#0d9488', apartment: '#2d8a5e' };

  // Kolory pinów te same co na mapie podróży (BUILTIN_POINT_CATEGORIES z point-categories.js).
  function catColor(cat){
    const builtin = (typeof BUILTIN_POINT_CATEGORIES !== 'undefined') ? BUILTIN_POINT_CATEGORIES.find(c => c.key === cat) : null;
    return (builtin && builtin.color) || CAT_COLOR_FALLBACK[cat] || '#64748b';
  }

  function catTitle(cat){
    const tk = CAT_TO_TABLE[cat];
    const b = getBoard();
    return (b && b.tableNames && b.tableNames[tk]) || (TABLE_DEFS[tk] && TABLE_DEFS[tk].title) || '';
  }

  function makePinIcon(cat){
    if(typeof planMakeDot === 'function') return planMakeDot(catColor(cat), cat);
    return L.divIcon({
      html: `<div style="width:18px;height:18px;background:${catColor(cat)};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [18, 18], iconAnchor: [9, 9], className: ''
    });
  }

  function genId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function escapeHtml(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');
  }

  function money(n){
    const num = Number(n) || 0;
    return num.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getBoard(){
    return (window.research || []).find(b => b.id === currentResearchBoardId);
  }

  function ensureTables(board){
    board.tables = board.tables || {};
    board.tableNames = board.tableNames || {};
    tableOrderFor(board).forEach(k => {
      if(!Array.isArray(board.tables[k])) board.tables[k] = [];
      if(!board.tableNames[k]) board.tableNames[k] = TABLE_DEFS[k].title;
    });
    if(board.tableNames.loty === Transport.LEGACY_TITLE) board.tableNames.loty = Transport.TITLE;
    if(!Array.isArray(board.points)) board.points = [];
    if(!Array.isArray(board.inspirations)) board.inspirations = [];
    if(!Array.isArray(board.sites)) board.sites = [];
    if(!board.plan || typeof board.plan !== 'object') board.plan = {};
    if(!board.plan.days || typeof board.plan.days !== 'object') board.plan.days = {};
    if(!board.dayMeta || typeof board.dayMeta !== 'object') board.dayMeta = {};
    if(!(Number(board.planDayCount) >= 1)) board.planDayCount = 1;
  }

  function priceKeyOf(def){
    const c = def.columns.find(c => c.money);
    return c ? c.key : null;
  }

  function sumForTable(rows, def){
    if(!def.contributes) return 0;
    const pk = priceKeyOf(def);
    if(!pk) return 0;
    return rows.filter(r => r.checked).reduce((s, r) => s + (Number(r[pk]) || 0), 0);
  }

  function calcBoardTotal(board){
    ensureTables(board);
    let total = 0;
    tableOrderFor(board).forEach(k => {
      const def = TABLE_DEFS[k];
      if(!def.contributes) return;
      total += sumForTable(board.tables[k] || [], def);
    });
    return total;
  }

  function groupRows(rows){
    const map = new Map();
    rows.forEach(r => {
      const g = r.groupId || r.id;
      if(!map.has(g)) map.set(g, []);
      map.get(g).push(r);
    });
    return [...map.values()];
  }

  function save(){ if(typeof window.saveResearch === 'function') window.saveResearch(); }

  function createBoardWithKind(quick){
    const board = { id: genId(), name: 'Nowa tablica', budget: '', quick: !!quick, tables: {}, tableNames: {} };
    ensureTables(board);
    window.research = window.research || [];
    window.research.push(board);
    save();
    currentResearchBoardId = board.id;
    researchPlanDay = 'all';
    renderBoard();
  }

  window.createResearchBoard = function(){
    const bd = document.createElement('div');
    bd.className = 'tmm-picker-backdrop';
    bd.innerHTML = `<div class="tmm-picker-card" role="dialog" aria-modal="true" aria-label="Nowa tablica">
        <div class="tmm-picker-head">
            <h3>Nowa tablica</h3>
            <button type="button" class="qr-close" data-close aria-label="Zamknij">×</button>
        </div>
        <div class="tmm-picker-list">
            <button type="button" class="tmm-picker-row" data-kind="full">
                <span class="tmm-picker-text">
                    <span class="tmm-picker-label">Zwykła tablica</span>
                    <span class="tmm-picker-note">Pełny zestaw: koszty, transport, apartamenty, atrakcje, restauracje, miejsca.</span>
                </span>
                <span class="tmm-picker-chev" aria-hidden="true">›</span>
            </button>
            <button type="button" class="tmm-picker-row" data-kind="quick">
                <span class="tmm-picker-text">
                    <span class="tmm-picker-label">Szybka podróż</span>
                    <span class="tmm-picker-note">Dwie tabele: Koszty (z typem) i Miejsca.</span>
                </span>
                <span class="tmm-picker-chev" aria-hidden="true">›</span>
            </button>
        </div>
    </div>`;
    const close = () => bd.remove();
    bd.addEventListener('click', e => { if(e.target === bd) close(); });
    bd.querySelector('[data-close]').addEventListener('click', close);
    bd.querySelectorAll('.tmm-picker-row[data-kind]').forEach(btn => {
      btn.addEventListener('click', () => {
        const quick = btn.dataset.kind === 'quick';
        close();
        createBoardWithKind(quick);
      });
    });
    document.body.appendChild(bd);
  };

  window.openResearchBoardById = function(id){
    currentResearchBoardId = id;
    researchPlanDay = 'all';
    renderBoard();
  };

  window.closeResearchBoard = function(){
    currentResearchBoardId = null;
    renderHub();
  };

  // Po utworzeniu podróży z tablicy research nie jest już potrzebny.
  window.removeResearchBoardAfterImport = function(boardId){
    if(!boardId) return;
    window.research = (window.research || []).filter(b => b.id !== boardId);
    if(currentResearchBoardId === boardId){
      currentResearchBoardId = null;
      if(researchMap){ researchMap.remove(); researchMap = null; researchMarkers = {}; }
      if(typeof window.destroyPlanDayMap === 'function') window.destroyPlanDayMap();
    }
    save();
    if(typeof window.renderResearch === 'function') window.renderResearch();
  };

  window.deleteCurrentResearchBoard = function(){
    if(!currentResearchBoardId) return;
    if(!confirm('Usunąć tę tablicę? Tej operacji nie da się cofnąć.')) return;
    window.research = (window.research || []).filter(b => b.id !== currentResearchBoardId);
    currentResearchBoardId = null;
    save();
    renderHub();
  };

  window.updateResearchBoardField = function(field, val){
    const b = getBoard();
    if(!b) return;
    if(field === 'budget') b.budget = val === '' ? '' : Number(val);
    else b[field] = val;
    save();
    if(field === 'budget') renderSummary();
    if(field === 'quick'){
      ensureTables(b);
      renderTables();
      renderSummary();
    }
  };

  window.updateResearchTableName = function(key, val){
    const b = getBoard();
    if(!b) return;
    b.tableNames = b.tableNames || {};
    b.tableNames[key] = val;
    save();
    const summaryLabel = document.querySelector(`.research-sum-row[data-key="${key}"] .research-sum-name`);
    if(summaryLabel) summaryLabel.textContent = val;
  };

  window.addResearchRow = function(key, mode){
    const b = getBoard();
    if(!b) return;
    const def = TABLE_DEFS[key];
    const row = { id: genId(), checked: false };
    def.columns.forEach(c => row[c.key] = '');
    if(def.grouped) row.groupId = row.id;
    if(key === 'loty') row.mode = Transport.modeKey(mode);
    if(key === 'koszty_mix') row.typ = 'koszt';
    b.tables[key].push(row);
    const cat = TABLE_TO_CAT[key];
    if(cat){
      if(!Array.isArray(b.points)) b.points = [];
      b.points.push({ id: row.id, name: '', coords: null, categoryKey: cat });
    }
    save();
    renderTables();
    renderSummary();
  };

  window.addResearchFlightLeg = function(groupId){
    const b = getBoard();
    if(!b) return;
    const rows = b.tables.loty;
    let lastIdx = -1;
    rows.forEach((r, i) => { if((r.groupId || r.id) === groupId) lastIdx = i; });
    if(lastIdx < 0) return;
    rows.splice(lastIdx + 1, 0, Transport.newLeg(rows[lastIdx], genId));
    save();
    renderTables();
    renderSummary();
  };

  window.setResearchTransportMode = function(rowId, mode){
    const b = getBoard();
    if(!b) return;
    const row = b.tables.loty.find(r => r.id === rowId);
    if(!row) return;
    row.mode = Transport.modeKey(mode);
    save();
    renderTables();
  };

  window.updateResearchRow = function(key, rowId, field, val){
    const b = getBoard();
    if(!b) return;
    const row = b.tables[key].find(r => r.id === rowId);
    if(!row) return;
    const col = TABLE_DEFS[key].columns.find(c => c.key === field);
    if(col && col.type === 'number') row[field] = val === '' ? '' : Number(val);
    else row[field] = val;
    save();
    if(col && col.money){
      updateTableSum(key);
      renderSummary();
    }
    if(field === 'nazwa' && (TABLE_TO_CAT[key] || key === 'koszty_mix')){
      const point = (b.points || []).find(p => p.id === rowId);
      if(point){
        point.name = val;
        const m = researchMarkers[rowId];
        if(m) m.setPopupContent(popupHtmlForPoint(point));
      }
    }
    if(key === 'koszty_mix' && field === 'typ'){
      const point = (b.points || []).find(p => p.id === rowId);
      const newCat = QUICK_CAT_FROM_TYPE[val];
      if(point && newCat){
        point.categoryKey = newCat;
        if(researchMarkers[rowId]){
          researchMarkers[rowId].remove();
          delete researchMarkers[rowId];
          if(point.coords && researchMap && typeof L !== 'undefined'){
            const marker = L.marker(point.coords, { icon: makePinIcon(newCat), zIndexOffset: newCat === 'apartment' ? 500 : 0 }).addTo(researchMap);
            marker.bindPopup(popupHtmlForPoint(point), { offset: [0, -6] });
            researchMarkers[rowId] = marker;
          }
        }
      }
    }
    if(key === 'loty' && field === 'czyPrzesiadka' && val === 'tak'){
      // „Tak" na ostatnim etapie od razu dokłada wiersz kolejnego lotu/kursu.
      const gid = row.groupId || row.id;
      const group = b.tables.loty.filter(r => (r.groupId || r.id) === gid);
      if(group[group.length - 1] === row) window.addResearchFlightLeg(gid);
    } else if(key === 'loty' && (field === 'data' || field === 'przylot' || field === 'wylot')
              && document.activeElement?.tagName !== 'TEXTAREA'){
      renderTables(); // przelicza czas przesiadki między etapami
    }
  };

  window.toggleResearchCheck = function(key, rowId, checked){
    const b = getBoard();
    if(!b) return;
    const row = b.tables[key].find(r => r.id === rowId);
    if(!row) return;
    row.checked = !!checked;
    save();
    updateTableSum(key);
    renderSummary();
  };

  window.removeResearchRow = function(key, rowId){
    const b = getBoard();
    if(!b) return;
    if(!confirm('Usunąć ten wiersz? Tej operacji nie da się cofnąć.')) return;
    b.tables[key] = b.tables[key].filter(r => r.id !== rowId);
    if(TABLE_TO_CAT[key] || key === 'koszty_mix'){
      b.points = (b.points || []).filter(p => p.id !== rowId);
      if(researchMarkers[rowId]){ researchMarkers[rowId].remove(); delete researchMarkers[rowId]; }
      if(typeof window.prunePlanItemsForRow === 'function') window.prunePlanItemsForRow(b, rowId);
    }
    save();
    renderTables();
    renderSummary();
    if(researchMap) drawMarkers();
  };

  function updateTableSum(key){
    const b = getBoard();
    if(!b) return;
    const el = document.getElementById(`sum-${key}`);
    if(!el) return;
    el.textContent = money(sumForTable(b.tables[key] || [], TABLE_DEFS[key])) + ' zł';
  }

  function renderHub(){
    const hubEl = document.getElementById('research-hub');
    const boardEl = document.getElementById('research-board');
    if(!hubEl || !boardEl) return;
    hubEl.hidden = false;
    boardEl.hidden = true;

    const list = document.getElementById('research-hub-list');
    const boards = window.research || [];
    if(boards.length === 0){
      list.innerHTML = `<p class="research-empty">Nie masz jeszcze żadnej tablicy. Kliknij „+ Nowa tablica", aby zacząć.</p>`;
      return;
    }
    list.innerHTML = boards.map(b => {
      const total = calcBoardTotal(b);
      const budget = Number(b.budget) || 0;
      const meta = budget ? `${money(total)} zł / ${money(budget)} zł` : `${money(total)} zł`;
      const quickCls = b.quick ? ' research-hub-item-quick' : '';
      const quickTag = b.quick ? '<span class="research-hub-item-tag">Szybka</span>' : '';
      return `<button type="button" class="research-hub-item${quickCls}" data-id="${escapeAttr(b.id)}" onclick="openResearchBoardById('${b.id}')">
        <span class="research-hub-item-name">${escapeHtml(b.name || 'Bez nazwy')}${quickTag}</span>
        <span class="research-hub-item-meta">${meta}</span>
      </button>`;
    }).join('');
  }

  function renderBoard(){
    const b = getBoard();
    if(!b){ closeResearchBoard(); return; }
    ensureTables(b);
    const hubEl = document.getElementById('research-hub');
    const boardEl = document.getElementById('research-board');
    if(!hubEl || !boardEl) return;
    hubEl.hidden = true;
    boardEl.hidden = false;

    document.getElementById('research-board-title').value = b.name || '';
    document.getElementById('research-budget-input').value = (b.budget === '' || b.budget == null) ? '' : b.budget;
    const quickEl = document.getElementById('research-quick');
    if(quickEl) quickEl.checked = !!b.quick;
    renderTables();
    renderSummary();
    window.setResearchBoardPanel(currentResearchPanel || 'tables');
  }

  function renderTables(){
    const b = getBoard();
    if(!b) return;
    const cont = document.getElementById('research-tables');
    if(!cont) return;
    cont.innerHTML = tableOrderFor(b).map(k => renderTable(k, b)).join('');
    requestAnimationFrame(autosizeAllResearchCells);
  }

  function renderTable(key, board){
    const def = TABLE_DEFS[key];
    const rows = board.tables[key] || [];
    const name = board.tableNames?.[key] || def.title;
    const checkable = def.checkable;
    const cols = def.columns;

    const headerCells = cols.map(c => `<th>${escapeHtml(c.label)}</th>`).join('');
    const colspan = cols.length + (checkable ? 1 : 0) + 1;

    let bodyHtml = '';
    if(rows.length === 0){
      const emptyMsg = def.mapOnly ? 'Brak wierszy. Kliknij zakładkę Mapa i dodaj pin.' : 'Brak wierszy. Dodaj pierwszy poniżej.';
      bodyHtml = `<tr class="research-empty-row"><td colspan="${colspan}">${emptyMsg}</td></tr>`;
    } else if(def.grouped){
      const groups = groupRows(rows);
      groups.forEach(group => {
        const groupId = group[0].groupId || group[0].id;
        group.forEach((row, ri) => {
          const mode = Transport.rowMode(row, group);
          bodyHtml += renderRow(row, key, def, mode);
          if(ri < group.length - 1) bodyHtml += Transport.connectorHtml(row, group[ri + 1], mode, colspan);
        });
      });
    } else {
      bodyHtml = rows.map(row => renderRow(row, key, def)).join('');
    }

    return `<section class="research-table-section research-theme-${key}" data-table="${key}">
      <header class="research-table-head">
        <input type="text" class="research-table-name" value="${escapeAttr(name)}" oninput="updateResearchTableName('${key}', this.value)">
        <span class="research-table-sum" ${def.contributes ? '' : 'hidden'}>Suma: <b id="sum-${key}">${money(sumForTable(rows, def))} zł</b></span>
      </header>
      <div class="research-table-wrap">
        <table class="research-table">
          <thead>
            <tr>
              ${checkable ? '<th class="research-check-col"></th>' : ''}
              ${headerCells}
              <th class="research-del-col"></th>
            </tr>
          </thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
      <div class="research-table-actions">
        ${def.mapOnly ? '<span class="research-add-hint">Wiersze pojawiają się po dodaniu pinu w zakładce Mapa.</span>' : key === 'loty' ? `<button type="button" class="research-add-btn" onclick="addResearchRow('loty','lot')">+ ${escapeHtml(def.addLabel)}</button>` : `<button type="button" class="research-add-btn" onclick="addResearchRow('${key}')">+ ${escapeHtml(def.addLabel)}</button>`}
      </div>
    </section>`;
  }

  function renderRow(row, key, def, mode){
    const checkable = def.checkable;
    const cells = def.columns.map(c => {
      const val = row[c.key] == null ? '' : row[c.key];
      const label = escapeAttr(mode ? Transport.colLabel(c, mode) : c.label);
      if(mode && c.modeCell) return `<td data-label="${label}">${Transport.modeCellHtml(row, mode, `setResearchTransportMode('${row.id}', this.value)`, `updateResearchRow('${key}','${row.id}','${c.key}', this.value)`)}</td>`;
      if(mode && !Transport.showsCol(c, mode)) return `<td class="tr-cell-na" data-label="${label}" aria-hidden="true">—</td>`;
      const special = mode && Transport.specialInputHtml(c, val, mode, `updateResearchRow('${key}','${row.id}','${c.key}', this.value)`);
      if(special) return `<td data-label="${label}">${special}</td>`;
      if(c.type === 'yesno'){
        const optSel = v => v === val ? 'selected' : '';
        return `<td data-label="${label}"><select class="research-cell-select" onchange="updateResearchRow('${key}','${row.id}','${c.key}', this.value)">
          <option value="" ${optSel('')}>—</option>
          <option value="tak" ${optSel('tak')}>Tak</option>
          <option value="nie" ${optSel('nie')}>Nie</option>
        </select></td>`;
      }
      if(c.type === 'select'){
        const labels = c.optionLabels || {};
        const opts = c.options.map(o => `<option value="${escapeAttr(o)}" ${o === val ? 'selected' : ''}>${escapeHtml(labels[o] || o)}</option>`).join('');
        return `<td data-label="${label}"><select class="research-cell-select" onchange="updateResearchRow('${key}','${row.id}','${c.key}', this.value)">${opts}</select></td>`;
      }
      if(c.type === 'number'){
        return `<td data-label="${label}"><input class="research-cell-input" type="number" step="0.01" min="0" value="${escapeAttr(val)}" oninput="updateResearchRow('${key}','${row.id}','${c.key}', this.value)"></td>`;
      }
      const ph = mode ? ` placeholder="${label}"` : '';
      return `<td data-label="${label}"><textarea class="research-cell-textarea" rows="1"${ph} oninput="updateResearchRow('${key}','${row.id}','${c.key}', this.value); autosizeResearchCell(this)">${escapeHtml(val)}</textarea></td>`;
    }).join('');
    const typAttr = (key === 'koszty_mix' && row.typ) ? ` data-typ="${escapeAttr(row.typ)}"` : '';
    const trClass = mode ? ` class="tr-row tr-mode-${mode}"` : (key === 'koszty_mix' ? ` class="koszty-mix-row"` : '');
    return `<tr data-row="${row.id}"${typAttr}${trClass}>
      ${checkable ? `<td class="research-check-col" data-label="Uwzględnij"><input type="checkbox" class="research-check" ${row.checked ? 'checked' : ''} onchange="toggleResearchCheck('${key}','${row.id}', this.checked)"></td>` : ''}
      ${cells}
      <td class="research-del-col"><button type="button" class="research-row-del" title="Usuń wiersz" onclick="removeResearchRow('${key}','${row.id}')">×</button></td>
    </tr>`;
  }

  function autosizeResearchCell(ta){
    if(!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.max(36, ta.scrollHeight) + 'px';
  }
  window.autosizeResearchCell = autosizeResearchCell;

  function autosizeAllResearchCells(){
    document.querySelectorAll('#research-tables .research-cell-textarea').forEach(autosizeResearchCell);
  }

  function renderSummary(){
    const b = getBoard();
    if(!b) return;
    const el = document.getElementById('research-summary');
    if(!el) return;
    const rows = tableOrderFor(b)
      .filter(k => TABLE_DEFS[k].contributes)
      .map(k => {
        const def = TABLE_DEFS[k];
        const sum = sumForTable(b.tables[k] || [], def);
        const name = b.tableNames?.[k] || def.title;
        return `<tr class="research-sum-row research-theme-${k}" data-key="${k}">
          <td class="research-sum-name">${escapeHtml(name)}</td>
          <td class="research-sum-val">${money(sum)} zł</td>
        </tr>`;
      }).join('');
    const total = calcBoardTotal(b);
    const budget = Number(b.budget) || 0;
    const delta = budget - total;
    const deltaHtml = budget
      ? (delta >= 0
        ? `<div class="research-delta ok">W budżecie — zostaje ${money(delta)} zł</div>`
        : `<div class="research-delta over">Przekroczono budżet o ${money(-delta)} zł</div>`)
      : '';
    el.innerHTML = `
      <h3>Podsumowanie</h3>
      <table class="research-summary-table">
        <tbody>
          ${rows}
          <tr class="research-sum-total"><td>Razem</td><td>${money(total)} zł</td></tr>
          ${budget ? `<tr class="research-sum-budget"><td>Budżet</td><td>${money(budget)} zł</td></tr>` : ''}
        </tbody>
      </table>
      ${deltaHtml}
    `;
    tableOrderFor(b).forEach(updateTableSum);
  }

  function popupHtmlForPoint(point){
    const name = escapeHtml(point.name || 'Bez nazwy');
    return `<div class="research-map-popup">
      <b>${name}</b>
      <div class="research-map-popup-actions">
        <button type="button" class="btn btn-danger btn-sm" onclick="removeResearchPoint('${point.id}')">Usuń pin</button>
      </div>
    </div>`;
  }

  function drawMarkers(){
    if(!researchMap || typeof L === 'undefined') return;
    const b = getBoard();
    if(!b) return;
    ensureTables(b);
    Object.values(researchMarkers).forEach(m => m.remove());
    researchMarkers = {};
    (b.points || []).forEach(p => {
      if(!p.coords || p.coords.length !== 2) return;
      const marker = L.marker(p.coords, { icon: makePinIcon(p.categoryKey), zIndexOffset: p.categoryKey === 'apartment' ? 500 : 0 }).addTo(researchMap);
      marker.bindPopup(popupHtmlForPoint(p), { offset: [0, -6] });
      researchMarkers[p.id] = marker;
    });
  }

  function initResearchMap(){
    if(typeof L === 'undefined') return;
    const el = document.getElementById('research-map-container');
    if(!el) return;
    if(researchMap){
      researchMap.remove();
      researchMap = null;
    }
    const b = getBoard();
    const withCoords = (b && Array.isArray(b.points) ? b.points : []).filter(p => p.coords && p.coords.length === 2);
    const fitToPoints = () => {
      if(!researchMap || !withCoords.length) return;
      if(withCoords.length === 1) researchMap.setView(withCoords[0].coords, 14);
      else researchMap.fitBounds(L.latLngBounds(withCoords.map(p => p.coords)), { padding: [30, 30], maxZoom: 15 });
    };
    researchMap = L.map(el).setView([20, 0], 2);
    fitToPoints();
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(researchMap);
    researchMap.on('click', (e) => {
      if(!researchMapMode) return;
      linkResearchPointFromMap(e.latlng, researchMapMode);
    });
    drawMarkers();
    setTimeout(() => { if(!researchMap) return; researchMap.invalidateSize(); fitToPoints(); }, 60);
  }

  function updateMapToolButtons(){
    const hint = document.getElementById('research-map-hint');
    const el = document.getElementById('research-map-container');
    const addBtn = document.getElementById('research-map-add-btn');
    if(researchMapMode && typeof researchMapMode === 'object' && researchMapMode.rowId){
      const b = getBoard();
      const tk = isQuick(b) ? (researchMapMode.categoryKey === 'place' ? 'miejscowki' : 'koszty_mix') : CAT_TO_TABLE[researchMapMode.categoryKey];
      const row = tk && b ? (b.tables?.[tk] || []).find(r => r.id === researchMapMode.rowId) : null;
      const name = ((row && row.nazwa) || '').trim() || '(bez nazwy)';
      if(hint) hint.textContent = `Kliknij na mapie, aby ustawić pin dla „${name}".`;
      if(el) el.style.cursor = 'crosshair';
      if(addBtn){
        addBtn.textContent = `Klikaj mapę: ${name} · Anuluj`;
        addBtn.classList.add('active');
      }
    } else {
      if(hint) hint.textContent = 'Kliknij „Dodaj", aby przypiąć wiersz z tabeli na mapie.';
      if(el) el.style.cursor = '';
      if(addBtn){
        addBtn.textContent = '＋ Dodaj';
        addBtn.classList.remove('active');
      }
    }
  }

  function closeResearchPickers(){
    document.querySelectorAll('.research-picker-backdrop').forEach(el => el.remove());
  }

  function openPickerCard(title, bodyHtml, searchCount){
    closeResearchPickers();
    const bd = document.createElement('div');
    bd.className = 'research-picker-backdrop tmm-picker-backdrop';
    bd.innerHTML = `<div class="tmm-picker-card" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}">
        <div class="tmm-picker-head">
            <h3>${escapeHtml(title)}</h3>
            <button type="button" class="qr-close" data-close aria-label="Zamknij">×</button>
        </div>
        ${searchCount != null && typeof window.tmmPickerSearchHtml === 'function' ? window.tmmPickerSearchHtml(searchCount) : ''}
        <div class="tmm-picker-list">${bodyHtml}</div>
    </div>`;
    const close = () => bd.remove();
    bd.addEventListener('click', e => { if(e.target === bd) close(); });
    bd.querySelector('[data-close]').addEventListener('click', close);
    document.body.appendChild(bd);
    return { bd, close };
  }

  // Ten sam przepływ co na mapie podróży: „Dodaj" → kategoria → wiersz z tabeli → klik na mapie.
  window.openResearchMapAddPicker = function(){
    if(researchMapMode){
      researchMapMode = false;
      updateMapToolButtons();
      return;
    }
    const rows = Object.keys(CAT_TO_TABLE).map(cat => `<button type="button" class="tmm-picker-row" data-cat="${cat}" style="--cat:${catColor(cat)};">
        <span class="tmm-picker-dot" aria-hidden="true"></span>
        <span class="tmm-picker-label">${escapeHtml(catTitle(cat))}</span>
        <span class="tmm-picker-chev" aria-hidden="true">›</span>
      </button>`).join('');
    const { bd, close } = openPickerCard('Co dodać?', rows, null);
    bd.querySelectorAll('.tmm-picker-row[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        close();
        openResearchRowPicker(btn.dataset.cat);
      });
    });
  };

  function openResearchRowPicker(categoryKey){
    const b = getBoard(); if(!b) return;
    ensureTables(b);
    let tableKey, rowFilter = null;
    if(isQuick(b)){
      if(categoryKey === 'place') tableKey = 'miejscowki';
      else if(QUICK_TYPE_FROM_CAT[categoryKey]){
        tableKey = 'koszty_mix';
        const typ = QUICK_TYPE_FROM_CAT[categoryKey];
        rowFilter = r => r.typ === typ;
      }
    } else {
      tableKey = CAT_TO_TABLE[categoryKey];
    }
    if(!tableKey) return;
    let rows = b.tables[tableKey] || [];
    if(rowFilter) rows = rows.filter(rowFilter);
    const color = catColor(categoryKey);
    const rowsHtml = rows.length ? rows.map(r => {
      const point = (b.points || []).find(p => p.id === r.id);
      const hasCoords = !!(point && point.coords && point.coords.length === 2);
      const name = (r.nazwa || '').trim() || '(bez nazwy)';
      return window.tmmPickerPointRowHtml(r.id, name, color, hasCoords);
    }).join('') : `<p class="tmm-picker-empty" style="padding:16px;color:var(--ink-muted);">Brak wierszy w tabeli „${escapeHtml(catTitle(categoryKey))}". Najpierw dodaj wiersz w zakładce Tabele.</p>`;

    const { bd, close } = openPickerCard(`Wybierz ${CAT_LABEL[categoryKey] || 'punkt'}`, rowsHtml, rows.length);
    bd.querySelectorAll('.tmm-picker-row[data-row]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rowId = btn.dataset.row;
        close();
        researchMapMode = { categoryKey, rowId };
        updateMapToolButtons();
      });
    });
    if(typeof window.attachTmmPickerSearch === 'function') window.attachTmmPickerSearch(bd);
  }

  function linkResearchPointFromMap(latlng, mode){
    if(!mode || typeof mode !== 'object') return;
    const { categoryKey, rowId } = mode;
    const b = getBoard();
    if(!b) return;
    ensureTables(b);
    const tableKey = isQuick(b)
      ? (categoryKey === 'place' ? 'miejscowki' : (QUICK_TYPE_FROM_CAT[categoryKey] ? 'koszty_mix' : null))
      : CAT_TO_TABLE[categoryKey];
    if(!tableKey || !rowId) return;
    const row = (b.tables[tableKey] || []).find(r => r.id === rowId);
    if(!row) return;
    if(!Array.isArray(b.points)) b.points = [];
    let point = b.points.find(p => p.id === rowId);
    if(!point){
      point = { id: rowId, name: row.nazwa || '', coords: null, categoryKey };
      b.points.push(point);
    } else {
      if(row.nazwa) point.name = row.nazwa;
    }
    point.coords = [latlng.lat, latlng.lng];
    save();
    if(researchMap){
      if(researchMarkers[point.id]){ researchMarkers[point.id].remove(); delete researchMarkers[point.id]; }
      const marker = L.marker(point.coords, { icon: makePinIcon(point.categoryKey), zIndexOffset: point.categoryKey === 'apartment' ? 500 : 0 }).addTo(researchMap);
      marker.bindPopup(popupHtmlForPoint(point), { offset: [0, -6] });
      researchMarkers[point.id] = marker;
    }
    researchMapMode = false;
    updateMapToolButtons();
  }

  window.removeResearchPoint = function(id){
    if(!confirm('Usunąć pin z mapy? Wiersz w tabeli zostanie zachowany.')) return;
    const b = getBoard();
    if(!b) return;
    ensureTables(b);
    const point = (b.points || []).find(p => p.id === id);
    if(point) point.coords = null;
    if(researchMarkers[id]){ researchMarkers[id].remove(); delete researchMarkers[id]; }
    save();
    if(document.getElementById('research-tables')) renderTables();
    if(document.getElementById('research-summary')) renderSummary();
  };

  // ---------- Inspiracje (baza filmików) — zostają w tablicy, nie przechodzą do podróży ----------
  let inspoFilter = '';

  function normalizeUrl(raw){
    const s = String(raw || '').trim();
    if(!s) return '';
    const withProto = /^https?:\/\//i.test(s) ? s : 'https://' + s;
    try { const u = new URL(withProto); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch(e){ return ''; }
  }

  function youtubeId(url){
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\.|^m\./, '');
      if(host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
      if(host.endsWith('youtube.com')){
        if(u.searchParams.get('v')) return u.searchParams.get('v');
        const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/);
        if(m) return m[2];
      }
    } catch(e){}
    return null;
  }

  function platformOf(url){
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\.|^m\./, ''); } catch(e){}
    if(host === 'youtu.be' || host.endsWith('youtube.com')) return { key: 'youtube', label: 'YouTube' };
    if(host.endsWith('tiktok.com')) return { key: 'tiktok', label: 'TikTok' };
    if(host.endsWith('instagram.com')) return { key: 'instagram', label: 'Instagram' };
    if(host.endsWith('facebook.com') || host === 'fb.watch') return { key: 'facebook', label: 'Facebook' };
    return { key: 'web', label: host || 'Link' };
  }

  function renderInspirations(){
    const b = getBoard();
    const list = document.getElementById('inspo-list');
    const filters = document.getElementById('inspo-filters');
    if(!b || !list || !filters) return;
    ensureTables(b);
    const items = b.inspirations;
    const topics = [...new Set(items.map(i => (i.topic || '').trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'pl'));
    if(inspoFilter && !topics.includes(inspoFilter)) inspoFilter = '';

    const dl = document.getElementById('inspo-topics');
    if(dl) dl.innerHTML = topics.map(t => `<option value="${escapeAttr(t)}"></option>`).join('');

    filters.innerHTML = topics.length > 1
      ? [['', `Wszystkie (${items.length})`], ...topics.map(t => [t, t])].map(([val, label]) =>
          `<button type="button" class="inspo-filter${val === inspoFilter ? ' active' : ''}" data-topic="${escapeAttr(val)}" onclick="setResearchInspirationFilter(this.dataset.topic)">${escapeHtml(label)}</button>`
        ).join('')
      : '';

    const shown = inspoFilter ? items.filter(i => (i.topic || '').trim() === inspoFilter) : items;
    if(!items.length){
      list.innerHTML = `<p class="research-empty">Brak inspiracji. Dodaj pierwszy filmik lub artykuł powyżej.</p>`;
      return;
    }
    list.innerHTML = shown.slice().reverse().map(i => {
      const p = platformOf(i.url);
      const yt = p.key === 'youtube' ? youtubeId(i.url) : null;
      const media = yt
        ? `<img src="https://i.ytimg.com/vi/${encodeURIComponent(yt)}/mqdefault.jpg" alt="" loading="lazy">`
        : `<span class="inspo-thumb-label">${escapeHtml(p.label)}</span>`;
      return `<article class="inspo-card" data-platform="${p.key}">
        <a class="inspo-thumb" href="${escapeAttr(i.url)}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true">${media}</a>
        <div class="inspo-body">
          <div class="inspo-meta">
            <span class="inspo-platform">${escapeHtml(p.label)}</span>
            ${i.topic ? `<span class="inspo-topic">${escapeHtml(i.topic)}</span>` : ''}
          </div>
          <a class="inspo-name" href="${escapeAttr(i.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(i.name || i.url)}</a>
        </div>
        <button type="button" class="inspo-remove" onclick="removeResearchInspiration('${escapeAttr(i.id)}')" aria-label="Usuń inspirację">&times;</button>
      </article>`;
    }).join('');
  }

  window.addResearchInspiration = function(){
    const b = getBoard();
    if(!b) return;
    ensureTables(b);
    const nameEl = document.getElementById('inspo-name');
    const topicEl = document.getElementById('inspo-topic');
    const linkEl = document.getElementById('inspo-link');
    const url = normalizeUrl(linkEl.value);
    if(!url){ alert('Podaj poprawny link (http/https).'); linkEl.focus(); return; }
    b.inspirations.push({ id: genId(), name: nameEl.value.trim(), topic: topicEl.value.trim(), url });
    save();
    nameEl.value = '';
    linkEl.value = '';
    renderInspirations();
    nameEl.focus();
  };

  window.removeResearchInspiration = function(id){
    const b = getBoard();
    if(!b) return;
    if(!confirm('Usunąć tę inspirację?')) return;
    b.inspirations = (b.inspirations || []).filter(i => i.id !== id);
    save();
    renderInspirations();
  };

  window.setResearchInspirationFilter = function(topic){
    inspoFilter = topic || '';
    renderInspirations();
  };

  // ---------- Strony — linki do muzeów/atrakcji; przechodzą do podróży jako trip.tickets ----------
  let siteFilter = '';

  function renderSites(){
    const b = getBoard();
    const list = document.getElementById('rsite-list');
    const filters = document.getElementById('rsite-filters');
    if(!b || !list || !filters) return;
    ensureTables(b);
    const items = b.sites;
    const kinds = [...new Set(items.map(i => (i.kind || '').trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'pl'));
    if(siteFilter && !kinds.includes(siteFilter)) siteFilter = '';

    const kindSlug = k => { const s = String(k || '').trim().toLowerCase(); return ['muzeum', 'atrakcja', 'restauracja', 'info'].includes(s) ? s : ''; };

    filters.innerHTML = kinds.length > 1
      ? [['', `Wszystkie (${items.length})`], ...kinds.map(k => [k, k])].map(([val, label]) =>
          `<button type="button" class="inspo-filter site-kind${val === siteFilter ? ' active' : ''}" data-site-kind="${escapeAttr(kindSlug(val))}" data-kind="${escapeAttr(val)}" onclick="setResearchSiteFilter(this.dataset.kind)">${escapeHtml(label)}</button>`
        ).join('')
      : '';

    if(!items.length){
      list.innerHTML = `<p class="research-empty">Brak stron. Wklej link do muzeum lub atrakcji powyżej.</p>`;
      return;
    }
    const shown = siteFilter ? items.filter(i => (i.kind || '').trim() === siteFilter) : items;
    list.innerHTML = shown.slice().reverse().map(t => {
      const label = platformOf(t.url).label;
      return `<article class="inspo-card ticket-card" data-source="web" data-site-kind="${escapeAttr(kindSlug(t.kind))}">
        <a class="inspo-thumb" href="${escapeAttr(t.url)}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true"><span class="inspo-thumb-label">${escapeHtml(t.kind || label)}</span></a>
        <div class="inspo-body">
          <div class="inspo-meta">
            <span class="inspo-platform">${escapeHtml(label)}</span>
            ${t.kind ? `<span class="inspo-topic">${escapeHtml(t.kind)}</span>` : ''}
          </div>
          <a class="inspo-name" href="${escapeAttr(t.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.name || t.url)}</a>
        </div>
        <button type="button" class="inspo-remove" onclick="removeResearchSite('${escapeAttr(t.id)}')" aria-label="Usuń stronę">&times;</button>
      </article>`;
    }).join('');
  }

  window.addResearchSite = function(){
    const b = getBoard();
    if(!b) return;
    ensureTables(b);
    const nameEl = document.getElementById('rsite-name');
    const kindEl = document.getElementById('rsite-kind');
    const linkEl = document.getElementById('rsite-link');
    const url = normalizeUrl(linkEl.value);
    if(!url){ alert('Podaj poprawny link (http/https).'); linkEl.focus(); return; }
    b.sites.push({ id: genId(), name: nameEl.value.trim(), kind: kindEl.value.trim(), url });
    save();
    nameEl.value = '';
    linkEl.value = '';
    renderSites();
    nameEl.focus();
  };

  window.removeResearchSite = function(id){
    const b = getBoard();
    if(!b) return;
    if(!confirm('Usunąć tę stronę?')) return;
    b.sites = (b.sites || []).filter(i => i.id !== id);
    save();
    renderSites();
  };

  window.setResearchSiteFilter = function(kind){
    siteFilter = kind || '';
    renderSites();
  };

  // ---------- Plan dni — ten sam model co w podróży (plan.days + dayMeta), ale bez dat ----------
  const RESEARCH_PLAN_CTX = {
    getHost: getBoard,
    save,
    containerId: 'research-plan',
    dayCount: b => { ensureTables(b); return b.planDayCount; },
    dateLabel: () => '',
    center: b => {
      const p = (b.points || []).find(p => p.coords && p.coords.length === 2);
      return p ? p.coords : null;
    },
    selectDay: d => { researchPlanDay = d; renderResearchPlan(); },
    onInvalidDay: () => { researchPlanDay = 'all'; renderResearchPlan(); },
    backLabel: 'Wróć do listy dni'
  };

  function renderResearchPlan(){
    const b = getBoard();
    const el = document.getElementById('research-plan');
    if(!b || !el) return;
    ensureTables(b);
    if(researchPlanDay !== 'all' && typeof window.renderPlanDayView === 'function'){
      window.renderPlanDayView(RESEARCH_PLAN_CTX, researchPlanDay);
      return;
    }
    if(typeof window.destroyPlanDayMap === 'function') window.destroyPlanDayMap();
    const count = b.planDayCount;
    let tiles = '';
    for(let i = 0; i < count; i++){
      const col = typeof planDayColor === 'function' ? planDayColor(i) : 'var(--primary)';
      const cnt = ((b.plan.days[i] && b.plan.days[i].items) || []).length;
      const title = ((b.dayMeta[i] && b.dayMeta[i].title) || '').trim();
      tiles += `<button type="button" class="pcal-cell in" style="--dc:${col};" onclick="openResearchPlanDay(${i})">
        <span class="pcal-top"><span class="pcal-dnum">Dzień ${i + 1}</span><span class="pcal-daydot"></span></span>
        ${title ? `<span class="pcal-title">${escapeHtml(title)}</span>` : ''}
        ${cnt ? `<span class="pcal-cnt">${cnt}</span>` : ''}
      </button>`;
    }
    el.innerHTML = `<div class="plan-calendar rplan">
      <div class="plan-cal-head">
        <p class="rplan-hint">Dni nie mają jeszcze dat — po utworzeniu podróży Dzień 1 przypada na datę wyjazdu.</p>
        <div class="rplan-actions">
          <button type="button" class="btn btn-secondary btn-sm" onclick="removeResearchPlanDay()" ${count <= 1 ? 'disabled' : ''}>Usuń ostatni dzień</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="addResearchPlanDay()">+ Dodaj dzień</button>
        </div>
      </div>
      <div class="rplan-grid">${tiles}</div>
    </div>`;
  }

  window.openResearchPlanDay = function(day){
    researchPlanDay = day;
    renderResearchPlan();
  };

  window.addResearchPlanDay = function(){
    const b = getBoard(); if(!b) return;
    ensureTables(b);
    b.planDayCount += 1;
    save();
    renderResearchPlan();
  };

  window.removeResearchPlanDay = function(){
    const b = getBoard(); if(!b) return;
    ensureTables(b);
    if(b.planDayCount <= 1) return;
    const last = b.planDayCount - 1;
    const hasItems = ((b.plan.days[last] && b.plan.days[last].items) || []).length > 0;
    const meta = b.dayMeta[last] || {};
    const hasMeta = !!((meta.title || '').trim() || (meta.desc || '').trim());
    if((hasItems || hasMeta) && !confirm(`Usunąć Dzień ${last + 1} razem z jego punktami i notatkami?`)) return;
    delete b.plan.days[last];
    delete b.dayMeta[last];
    b.planDayCount = last;
    save();
    renderResearchPlan();
  };

  window.setResearchBoardPanel = function(panel){
    if(!['tables', 'plan', 'inspo', 'sites', 'country'].includes(panel)) panel = 'tables';
    currentResearchPanel = panel;
    document.querySelectorAll('#research-board .research-board-panel').forEach(p => {
      p.hidden = p.dataset.panel !== panel;
    });
    document.querySelectorAll('#research-board .research-board-navbtn').forEach(b => {
      b.classList.toggle('active', b.dataset.panel === panel);
      b.setAttribute('aria-selected', b.dataset.panel === panel ? 'true' : 'false');
    });
    const toolbar = document.getElementById('research-tables-toolbar');
    if(toolbar) toolbar.hidden = panel !== 'tables';
    if(panel === 'inspo') renderInspirations();
    if(panel === 'sites') renderSites();
    if(panel === 'plan') renderResearchPlan();
    else if(typeof window.destroyPlanDayMap === 'function') window.destroyPlanDayMap();
    if(panel === 'country' && typeof window.renderCountrySheet === 'function') window.renderCountrySheet('research-country', getBoard, save);
    closeResearchMapModal();
  };

  // Mapa researchu otwiera się w oknie, jak mapa podróży (przycisk obok Kantoru).
  function closeResearchMapModal(){
    document.querySelectorAll('.research-map-backdrop').forEach(el => el.remove());
    document.querySelectorAll('.tmm-picker-backdrop').forEach(el => el.remove());
    if(researchMap){
      researchMap.remove();
      researchMap = null;
      researchMarkers = {};
    }
    researchMapMode = false;
  }

  window.openResearchMapModal = function(){
    if(!getBoard()) return;
    closeResearchMapModal();
    const bd = document.createElement('div');
    bd.className = 'plan-map-backdrop research-map-backdrop';
    bd.innerHTML = `<div class="plan-map-card" role="dialog" aria-modal="true" aria-label="Mapa researchu">
      <div class="pmm-head">
        <h3>Mapa</h3>
        <button type="button" class="pmm-close" aria-label="Wróć do tabel">×</button>
      </div>
      <div class="pmm-toolbar">
        <span class="research-map-hint" id="research-map-hint"></span>
        <button type="button" id="research-map-add-btn" class="tmm-add-btn" onclick="openResearchMapAddPicker()">＋ Dodaj</button>
      </div>
      <div class="pmm-map research-map-container" id="research-map-container"></div>
    </div>`;
    const onKey = e => {
      if(e.key !== 'Escape' || document.querySelector('.tmm-picker-backdrop')) return;
      close();
    };
    const close = () => {
      document.removeEventListener('keydown', onKey);
      closeResearchMapModal();
    };
    bd.addEventListener('click', e => { if(e.target === bd) close(); });
    bd.querySelector('.pmm-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(bd);
    initResearchMap();
    updateMapToolButtons();
  };

  window.renderResearch = function(){
    if(currentResearchBoardId){
      const b = getBoard();
      if(b) renderBoard();
      else { currentResearchBoardId = null; renderHub(); }
    } else {
      renderHub();
    }
  };

  window.importCurrentResearchToTrip = function(){
    const b = getBoard();
    if(!b){ alert('Otwórz najpierw tablicę.'); return; }
    ensureTables(b);
    const filteredTables = {};
    const keptIds = new Set();
    tableOrderFor(b).forEach(k => {
      const def = TABLE_DEFS[k];
      const rows = b.tables[k] || [];
      const kept = def.checkable ? rows.filter(r => r.checked) : rows.slice();
      const cloned = JSON.parse(JSON.stringify(kept));
      cloned.forEach(r => { if(def.checkable) r.checked = false; });
      filteredTables[k] = cloned;
      kept.forEach(r => keptIds.add(r.id));
    });
    const importedPoints = (b.points || [])
      .filter(p => keptIds.has(p.id))
      .map(p => ({ id: p.id, name: p.name, coords: p.coords, categoryKey: p.categoryKey, done: false, cols: {}, comments: [] }));
    // Plan dni przechodzi do podróży; wpisy wskazujące na niezaznaczone (nieprzeniesione) wiersze odpadają.
    const importedPlanDays = {};
    const importedDayMeta = {};
    for(let i = 0; i < b.planDayCount; i++){
      const day = b.plan.days[i];
      if(day && Array.isArray(day.items)){
        const clone = JSON.parse(JSON.stringify(day));
        clone.items = clone.items.filter(it => keptIds.has(it.rowId));
        importedPlanDays[i] = clone;
      }
      if(b.dayMeta[i]) importedDayMeta[i] = JSON.parse(JSON.stringify(b.dayMeta[i]));
    }
    const totalKept = Object.values(filteredTables).reduce((n, arr) => n + arr.length, 0);
    if(totalKept === 0){
      if(!confirm('Nic nie zaznaczono w tabelach. Utworzyć pustą podróż na podstawie tablicy?')) return;
    }
    window.pendingResearchImport = {
      boardId: b.id,
      name: b.name || '',
      budget: b.budget,
      quick: !!b.quick,
      tables: filteredTables,
      tableNames: JSON.parse(JSON.stringify(b.tableNames || {})),
      planPoints: importedPoints,
      plan: { days: importedPlanDays },
      dayMeta: importedDayMeta,
      countryInfo: JSON.parse(JSON.stringify(b.countryInfo || {})),
      tickets: JSON.parse(JSON.stringify(b.sites || []))
    };
    if(typeof window.showMainTab === 'function') window.showMainTab('add');
    const nameEl = document.getElementById('trip-name');
    const budgetEl = document.getElementById('budget');
    if(nameEl) nameEl.value = b.name || '';
    if(budgetEl) budgetEl.value = (b.budget === '' || b.budget == null) ? '' : b.budget;
    const submitBtn = document.querySelector('#trip-form button[type="submit"]');
    if(submitBtn) submitBtn.textContent = 'Utwórz podróż z tablicy';
    const dest = document.getElementById('destination');
    if(dest) setTimeout(() => dest.focus(), 100);
  };
})();
