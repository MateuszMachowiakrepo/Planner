(function(){
  const TABLE_ORDER = ['koszty', 'loty', 'apartamenty', 'atrakcje', 'restauracje', 'miejscowki'];

  const TABLE_DEFS = {
    koszty: {
      title: 'Koszty stałe', addLabel: 'Dodaj wiersz',
      columns: [
        { key: 'nazwa', label: 'Nazwa' },
        { key: 'kategoria', label: 'Kategoria' },
        { key: 'czas', label: 'Czas' },
        { key: 'cena', label: 'Cena', type: 'number', money: true }
      ],
      checkable: true, contributes: true
    },
    loty: {
      title: 'Loty', addLabel: 'Nowy lot',
      columns: [
        { key: 'kierunek', label: 'Kierunek' },
        { key: 'przylot', label: 'Czas wylotu' },
        { key: 'wylot', label: 'Czas przylotu' },
        { key: 'linia', label: 'Linia lotnicza' },
        { key: 'przesiadka', label: 'Czas przesiadki' },
        { key: 'cena', label: 'Cena', type: 'number', money: true }
      ],
      checkable: true, contributes: true, grouped: true
    },
    apartamenty: {
      title: 'Apartamenty', addLabel: 'Dodaj wiersz',
      columns: [
        { key: 'nazwa', label: 'Nazwa' },
        { key: 'ocena', label: 'Ocena' },
        { key: 'freeCancel', label: 'Bezpłatne odwołanie', type: 'yesno' },
        { key: 'lokalizacja', label: 'Lokalizacja' },
        { key: 'cena', label: 'Cena', type: 'number', money: true }
      ],
      checkable: true, contributes: true
    },
    atrakcje: {
      title: 'Atrakcje', addLabel: 'Dodaj wiersz',
      columns: [
        { key: 'nazwa', label: 'Nazwa' },
        { key: 'kategoria', label: 'Kategoria' },
        { key: 'miejsce', label: 'Miejsce' },
        { key: 'czas', label: 'Czas trwania' },
        { key: 'cena', label: 'Cena', type: 'number', money: true }
      ],
      checkable: true, contributes: true
    },
    restauracje: {
      title: 'Restauracje', addLabel: 'Dodaj wiersz',
      columns: [
        { key: 'nazwa', label: 'Nazwa' },
        { key: 'lokalizacja', label: 'Lokalizacja' },
        { key: 'kuchnia', label: 'Rodzaj kuchni' },
        { key: 'oceny', label: 'Oceny' },
        { key: 'cena', label: 'Cena', type: 'number', money: true }
      ],
      checkable: true, contributes: true
    },
    miejscowki: {
      title: 'Miejscówki', addLabel: 'Dodaj wiersz',
      columns: [
        { key: 'nazwa', label: 'Nazwa' },
        { key: 'kategoria', label: 'Kategoria' },
        { key: 'lokalizacja', label: 'Lokalizacja' },
        { key: 'walory', label: 'Walory' }
      ],
      checkable: false, contributes: false
    }
  };

  function genId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function escapeHtml(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }
  function money(n){
    return (Number(n) || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getTrip(){ return typeof activeTripObj === 'function' ? activeTripObj() : null; }

  function ensureTables(trip){
    if(!trip) return;
    trip.tables = trip.tables || {};
    trip.tableNames = trip.tableNames || {};
    TABLE_ORDER.forEach(k => {
      if(!Array.isArray(trip.tables[k])) trip.tables[k] = [];
      if(!trip.tableNames[k]) trip.tableNames[k] = TABLE_DEFS[k].title;
    });
    if(trip.tripBudget == null && trip.budget != null && trip.budget !== '') trip.tripBudget = Number(trip.budget) || '';
  }

  function priceKeyOf(def){
    const c = def.columns.find(c => c.money);
    return c ? c.key : null;
  }
  function sumForTable(rows, def){
    if(!def.contributes) return 0;
    const pk = priceKeyOf(def);
    if(!pk) return 0;
    return rows.reduce((s, r) => s + (Number(r[pk]) || 0), 0);
  }
  function paidForTable(rows, def){
    if(!def.contributes) return 0;
    const pk = priceKeyOf(def);
    if(!pk) return 0;
    return rows.filter(r => r.checked).reduce((s, r) => s + (Number(r[pk]) || 0), 0);
  }
  function calcTripTotal(trip){
    ensureTables(trip);
    let total = 0;
    TABLE_ORDER.forEach(k => {
      const def = TABLE_DEFS[k];
      if(!def.contributes) return;
      total += sumForTable(trip.tables[k] || [], def);
    });
    return total;
  }
  function calcTripPaid(trip){
    ensureTables(trip);
    let total = 0;
    TABLE_ORDER.forEach(k => {
      const def = TABLE_DEFS[k];
      if(!def.contributes) return;
      total += paidForTable(trip.tables[k] || [], def);
    });
    return total;
  }
  function travelersOf(trip){
    const n = Number(trip && trip.travelers);
    return n > 0 ? n : 1;
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

  function save(){
    if(typeof window.saveTrips === 'function') window.saveTrips();
  }

  window.updateTripBudget = function(val){
    const t = getTrip(); if(!t) return;
    t.tripBudget = val === '' ? '' : Number(val);
    save();
    renderSummary();
  };

  window.updateTripTableName = function(key, val){
    const t = getTrip(); if(!t) return;
    t.tableNames = t.tableNames || {};
    t.tableNames[key] = val;
    save();
    const summaryLabel = document.querySelector(`#trip-tables-summary .research-sum-row[data-key="${key}"] .research-sum-name`);
    if(summaryLabel) summaryLabel.textContent = val;
  };

  window.addTripTableRow = function(key){
    const t = getTrip(); if(!t) return;
    const def = TABLE_DEFS[key];
    const row = { id: genId(), checked: false };
    def.columns.forEach(c => row[c.key] = '');
    if(def.grouped) row.groupId = row.id;
    t.tables[key].push(row);
    const cat = TABLE_TO_CAT[key];
    if(cat){
      if(!Array.isArray(t.planPoints)) t.planPoints = [];
      t.planPoints.push({
        id: row.id, name: '', coords: null, categoryKey: cat,
        cols: {}, comments: [], done: false, baseCardId: null
      });
    }
    save();
    renderTables();
    renderSummary();
  };

  window.addTripFlightLeg = function(groupId){
    const t = getTrip(); if(!t) return;
    const def = TABLE_DEFS.loty;
    const row = { id: genId(), checked: false, groupId };
    def.columns.forEach(c => row[c.key] = '');
    const rows = t.tables.loty;
    let lastIdx = -1;
    rows.forEach((r, i) => { if((r.groupId || r.id) === groupId) lastIdx = i; });
    if(lastIdx < 0) rows.push(row);
    else rows.splice(lastIdx + 1, 0, row);
    save();
    renderTables();
    renderSummary();
  };

  window.updateTripTableRow = function(key, rowId, field, val){
    const t = getTrip(); if(!t) return;
    const row = t.tables[key].find(r => r.id === rowId);
    if(!row) return;
    const col = TABLE_DEFS[key].columns.find(c => c.key === field);
    if(col && col.type === 'number') row[field] = val === '' ? '' : Number(val);
    else row[field] = val;
    save();
    if(col && col.money){
      updateTableSum(key);
      renderSummary();
    }
    if(field === 'nazwa' && typeof window.syncTripPointNameFromRow === 'function'){
      window.syncTripPointNameFromRow(rowId, val);
    }
  };

  window.toggleTripTableCheck = function(key, rowId, checked){
    const t = getTrip(); if(!t) return;
    const row = t.tables[key].find(r => r.id === rowId);
    if(!row) return;
    row.checked = !!checked;
    save();
    updateTableSum(key);
    renderSummary();
  };

  window.removeTripTableRow = function(key, rowId){
    const t = getTrip(); if(!t) return;
    if(!confirm('Usunąć ten punkt? Zniknie z tabeli i z planów dni, w których był użyty.')) return;
    t.tables[key] = t.tables[key].filter(r => r.id !== rowId);
    save();
    renderTables();
    renderSummary();
    if(typeof window.removeTripPointFromRow === 'function'){
      window.removeTripPointFromRow(rowId);
    }
  };

  function updateTableSum(key){
    const t = getTrip(); if(!t) return;
    const el = document.getElementById(`trip-sum-${key}`);
    if(el) el.textContent = money(sumForTable(t.tables[key] || [], TABLE_DEFS[key])) + ' zł';
    const paidEl = document.getElementById(`trip-paid-${key}`);
    if(paidEl) paidEl.textContent = money(paidForTable(t.tables[key] || [], TABLE_DEFS[key])) + ' zł';
  }

  function renderTable(key, trip){
    const def = TABLE_DEFS[key];
    const rows = trip.tables[key] || [];
    const name = trip.tableNames?.[key] || def.title;
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
        group.forEach((row, ri) => {
          bodyHtml += renderRow(row, key, def);
          if(ri < group.length - 1){
            bodyHtml += `<tr class="research-row-arrow"><td colspan="${colspan}"><span class="arrow-marker">↓</span></td></tr>`;
          }
        });
        const groupId = group[0].groupId || group[0].id;
        bodyHtml += `<tr class="research-row-groupend"><td colspan="${colspan}">
          <button type="button" class="research-mini-btn" onclick="addTripFlightLeg('${groupId}')">+ Przesiadka</button>
        </td></tr>`;
      });
    } else {
      bodyHtml = rows.map(row => renderRow(row, key, def)).join('');
    }

    const addBtnHtml = def.mapOnly
      ? '<span class="research-add-hint">Wiersze pojawiają się po dodaniu pinu w zakładce Mapa.</span>'
      : `<button type="button" class="research-add-btn" onclick="addTripTableRow('${key}')">+ ${escapeHtml(def.addLabel)}</button>`;

    return `<section class="research-table-section research-theme-${key}" data-table="${key}">
      <header class="research-table-head">
        <input type="text" class="research-table-name" value="${escapeAttr(name)}" oninput="updateTripTableName('${key}', this.value)">
        <span class="research-table-sum" ${def.contributes ? '' : 'hidden'}>Suma: <b id="trip-sum-${key}">${money(sumForTable(rows, def))} zł</b>${def.contributes ? ` · zapłacone: <b id="trip-paid-${key}">${money(paidForTable(rows, def))} zł</b>` : ''}</span>
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
      <div class="research-table-actions">${addBtnHtml}</div>
    </section>`;
  }

  function renderRow(row, key, def){
    const checkable = def.checkable;
    const cells = def.columns.map(c => {
      const val = row[c.key] == null ? '' : row[c.key];
      const label = escapeAttr(c.label);
      if(c.type === 'yesno'){
        const optSel = v => v === val ? 'selected' : '';
        return `<td data-label="${label}"><select class="research-cell-select" onchange="updateTripTableRow('${key}','${row.id}','${c.key}', this.value)">
          <option value="" ${optSel('')}>—</option>
          <option value="tak" ${optSel('tak')}>Tak</option>
          <option value="nie" ${optSel('nie')}>Nie</option>
        </select></td>`;
      }
      if(c.type === 'number'){
        return `<td data-label="${label}"><input class="research-cell-input" type="number" step="0.01" min="0" value="${escapeAttr(val)}" oninput="updateTripTableRow('${key}','${row.id}','${c.key}', this.value)"></td>`;
      }
      return `<td data-label="${label}"><textarea class="research-cell-textarea" rows="1" oninput="updateTripTableRow('${key}','${row.id}','${c.key}', this.value); autosizeResearchCell(this)">${escapeHtml(val)}</textarea></td>`;
    }).join('');
    return `<tr data-row="${row.id}">
      ${checkable ? `<td class="research-check-col" data-label="Zapłacone"><input type="checkbox" class="research-check" ${row.checked ? 'checked' : ''} onchange="toggleTripTableCheck('${key}','${row.id}', this.checked)" title="Zaznacz jako opłacone"></td>` : ''}
      ${cells}
      <td class="research-del-col"><button type="button" class="research-row-del" title="Usuń wiersz" onclick="removeTripTableRow('${key}','${row.id}')">×</button></td>
    </tr>`;
  }

  function renderTables(){
    const t = getTrip(); if(!t) return;
    ensureTables(t);
    const cont = document.getElementById('trip-tables');
    if(!cont) return;
    cont.innerHTML = TABLE_ORDER.map(k => renderTable(k, t)).join('');
    if(typeof window.autosizeAllResearchCells === 'function'){
      requestAnimationFrame(window.autosizeAllResearchCells);
    } else {
      requestAnimationFrame(() => {
        document.querySelectorAll('#trip-tables .research-cell-textarea').forEach(ta => {
          ta.style.height = 'auto';
          ta.style.height = Math.max(36, ta.scrollHeight) + 'px';
        });
      });
    }
  }

  function renderSummary(){
    const t = getTrip(); if(!t) return;
    const el = document.getElementById('trip-tables-summary');
    if(!el) return;
    const travelers = travelersOf(t);
    const showPerPerson = travelers > 1;
    const rows = TABLE_ORDER
      .filter(k => TABLE_DEFS[k].contributes)
      .map(k => {
        const def = TABLE_DEFS[k];
        const sum = sumForTable(t.tables[k] || [], def);
        const paid = paidForTable(t.tables[k] || [], def);
        const name = t.tableNames?.[k] || def.title;
        const perCell = showPerPerson ? `<td class="research-sum-perperson-cell">${money(sum / travelers)} zł</td>` : '';
        return `<tr class="research-sum-row research-theme-${k}" data-key="${k}">
          <td class="research-sum-name">${escapeHtml(name)}</td>
          <td class="research-sum-val">${money(sum)} zł</td>
          <td class="research-sum-paid">${money(paid)} zł</td>
          ${perCell}
        </tr>`;
      }).join('');
    const total = calcTripTotal(t);
    const paidTotal = calcTripPaid(t);
    const remaining = total - paidTotal;
    const budget = Number(t.tripBudget) || 0;
    const delta = budget - total;
    const budgetHtml = budget
      ? (delta >= 0
        ? `<div class="research-delta ok">W budżecie — rezerwa ${money(delta)} zł</div>`
        : `<div class="research-delta over">Przekroczono budżet o ${money(-delta)} zł</div>`)
      : '';
    const totalPerCell = showPerPerson ? `<td class="research-sum-perperson-cell">${money(total / travelers)} zł</td>` : '';
    const remainingPer = showPerPerson ? `<td class="research-sum-perperson-cell">${money(remaining / travelers)} zł</td>` : '';
    const emptyExtra = showPerPerson ? '<td></td>' : '';
    el.innerHTML = `
      <h3>Podsumowanie</h3>
      <table class="research-summary-table trip-summary-table">
        <thead>
          <tr>
            <th></th>
            <th>Wychodzi</th>
            <th>Zapłacone</th>
            ${showPerPerson ? `<th>Na osobę (${travelers})</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="research-sum-total"><td>Razem</td><td>${money(total)} zł</td><td>${money(paidTotal)} zł</td>${totalPerCell}</tr>
          <tr class="research-sum-remaining"><td>Do opłacenia</td><td>${money(remaining)} zł</td><td></td>${remainingPer}</tr>
          ${budget ? `<tr class="research-sum-budget"><td>Budżet</td><td>${money(budget)} zł</td><td></td>${emptyExtra}</tr>` : ''}
        </tbody>
      </table>
      ${budgetHtml}
    `;
    TABLE_ORDER.forEach(updateTableSum);
  }

  window.renderTripTables = function(){
    const t = getTrip(); if(!t) return;
    ensureTables(t);
    const budgetInput = document.getElementById('trip-budget-input');
    if(budgetInput) budgetInput.value = (t.tripBudget === '' || t.tripBudget == null) ? '' : t.tripBudget;
    renderTables();
    renderSummary();
  };

  const _origSelectPlanDay = window.selectPlanDay;
  window.selectPlanDay = function(day){
    if(typeof _origSelectPlanDay === 'function') _origSelectPlanDay(day);
    if(typeof window.setTripViewPanel !== 'function') return;
    if(day === 'all') window.setTripViewPanel('calendar');
    else window.setTripViewPanel('day');
  };

  const CAT_TO_TABLE = { attraction: 'atrakcje', restaurant: 'restauracje', place: 'miejscowki', apartment: 'apartamenty' };
  const TABLE_TO_CAT = { atrakcje: 'attraction', restauracje: 'restaurant', miejscowki: 'place', apartamenty: 'apartment' };
  window.TRIP_TABLE_TO_CAT = TABLE_TO_CAT;

  // Jedyne źródło prawdy o polach formularza "Nowy punkt" dla kategorii mapujących się na tabelę —
  // point-categories.js woła to, żeby formularz miał 1:1 te same pola co tabela (patrz TABLE_DEFS wyżej).
  window.getMapPointFormFields = function(categoryKey){
    const tableKey = CAT_TO_TABLE[categoryKey];
    if(!tableKey) return null;
    return TABLE_DEFS[tableKey].columns.filter(c => c.key !== 'nazwa');
  };

  function findRowByPointId(trip, pointId){
    ensureTables(trip);
    for(const key of TABLE_ORDER){
      const row = (trip.tables[key] || []).find(r => r.id === pointId);
      if(row) return { key, row };
    }
    return null;
  }

  window.syncTripPointNameFromRow = function(rowId, newName){
    const t = getTrip(); if(!t) return;
    const pts = t.planPoints || [];
    const p = pts.find(pp => pp.id === rowId);
    if(!p) return;
    if(p.name === newName) return;
    p.name = newName;
    if(typeof window.saveTrips === 'function') window.saveTrips();
  };

  window.removeTripPointFromRow = function(rowId){
    const t = getTrip(); if(!t) return;
    if(typeof window.pruneTripDayItemsForRow === 'function') window.pruneTripDayItemsForRow(rowId);
    if(!Array.isArray(t.planPoints)) return;
    const idx = t.planPoints.findIndex(p => p.id === rowId);
    if(idx < 0){
      if(typeof window.saveTrips === 'function') window.saveTrips();
      return;
    }
    t.planPoints.splice(idx, 1);
    if(typeof window.saveTrips === 'function') window.saveTrips();
    if(typeof window.refreshCurrentView === 'function' && document.querySelector('.tab-content.active')?.id === 'board-plan-tab'){
      const wrap = document.getElementById('board-plan-tab');
      if(wrap && !wrap.classList.contains('trip-view-tables')){
        if(typeof window.renderPlanCards === 'function') window.renderPlanCards();
      }
    }
  };

  function copyPointColsIntoRow(row, def, point){
    if(!point.cols) return;
    def.columns.forEach(c => {
      if(c.key === 'nazwa') return;
      const val = point.cols[c.key];
      if(val != null && val !== '') row[c.key] = val;
    });
  }

  function addRowForPoint(trip, point){
    const tableKey = CAT_TO_TABLE[point.categoryKey];
    if(!tableKey) return;
    ensureTables(trip);
    const def = TABLE_DEFS[tableKey];
    if((trip.tables[tableKey] || []).some(r => r.id === point.id)) return;
    const row = { id: point.id, checked: false };
    def.columns.forEach(c => row[c.key] = '');
    if('nazwa' in row) row.nazwa = point.name || '';
    copyPointColsIntoRow(row, def, point);
    trip.tables[tableKey].push(row);
  }

  // handlePlanMapClick is redefined in maps-routing.js to handle both string mode
  // (legacy: city / new-point-modal) and object mode { categoryKey, rowId } for
  // linking an existing table row's point coords. After the link, we refresh
  // trip tables so any name/coords change is reflected.
  const _origHandlePlanMapClick = window.handlePlanMapClick;
  window.handlePlanMapClick = function(latlng, mode){
    if(typeof _origHandlePlanMapClick === 'function') _origHandlePlanMapClick(latlng, mode);
    refreshTripTablesIfVisible();
  };

  function refreshTripTablesIfVisible(){
    if(document.querySelector('.tab-content.active')?.id === 'board-plan-tab' &&
       document.getElementById('board-plan-tab').classList.contains('trip-view-tables')){
      if(typeof window.renderTripTables === 'function') window.renderTripTables();
    }
  }

  const _origDeletePoolPoint = window.deletePoolPoint;
  window.deletePoolPoint = function(id){
    const trip = typeof activeTripObj === 'function' ? activeTripObj() : null;
    const beforeInfo = trip ? findRowByPointId(trip, id) : null;
    if(typeof _origDeletePoolPoint === 'function'){
      _origDeletePoolPoint(id);
    }
    if(!trip) return;
    const stillExists = (trip.planPoints || []).some(p => p.id === id);
    if(stillExists) return;
    if(beforeInfo){
      trip.tables[beforeInfo.key] = (trip.tables[beforeInfo.key] || []).filter(r => r.id !== id);
    }
    if(typeof window.pruneTripDayItemsForRow === 'function') window.pruneTripDayItemsForRow(id);
    if(typeof window.saveTrips === 'function') window.saveTrips();
    refreshTripTablesIfVisible();
  };

  const _origDeletePointFromPanel = window.deletePointFromPanel;
  window.deletePointFromPanel = function(btn){
    const trip = typeof activeTripObj === 'function' ? activeTripObj() : null;
    const card = btn.closest('.pt-card');
    const pointId = card ? card.dataset.pointId : null;
    const beforeInfo = (trip && pointId) ? findRowByPointId(trip, pointId) : null;
    if(typeof _origDeletePointFromPanel === 'function'){
      _origDeletePointFromPanel(btn);
    }
    if(!trip || !pointId) return;
    const stillExists = (trip.planPoints || []).some(p => p.id === pointId);
    if(stillExists) return;
    if(beforeInfo){
      trip.tables[beforeInfo.key] = (trip.tables[beforeInfo.key] || []).filter(r => r.id !== pointId);
    }
    if(typeof window.pruneTripDayItemsForRow === 'function') window.pruneTripDayItemsForRow(pointId);
    if(typeof window.saveTrips === 'function') window.saveTrips();
    refreshTripTablesIfVisible();
  };

  const _origSavePointEditFromPanel = window.savePointEditFromPanel;
  window.savePointEditFromPanel = function(btn){
    const trip = typeof activeTripObj === 'function' ? activeTripObj() : null;
    const card = btn.closest('.pt-card');
    const pointId = card ? card.dataset.pointId : null;
    if(typeof _origSavePointEditFromPanel === 'function'){
      _origSavePointEditFromPanel(btn);
    }
    if(!trip || !pointId) return;
    const point = (trip.planPoints || []).find(p => p.id === pointId);
    if(!point) return;
    const info = findRowByPointId(trip, pointId);
    if(!info) return;
    info.row.nazwa = point.name;
    copyPointColsIntoRow(info.row, TABLE_DEFS[info.key], point);
    if(typeof window.saveTrips === 'function') window.saveTrips();
    refreshTripTablesIfVisible();
  };
})();

