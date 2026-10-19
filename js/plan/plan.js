
        let planSelectedDay = 'all';

        let planCalRef = null;

        const PLAN_DAY_COLORS = ['#c02858','#2a6496','#f0a500','#2d8a5e','#d97706','#6b4c9a','#0891b2','#be185d','#4d7c0f','#9333ea','#0e7490','#b45309'];

        function planDayColor(i) { return PLAN_DAY_COLORS[((i % PLAN_DAY_COLORS.length) + PLAN_DAY_COLORS.length) % PLAN_DAY_COLORS.length]; }

        function planMonthKey(y, m) { return y * 12 + m; }

        function planTripMonthBounds(trip) {
            const s = new Date(trip.startDate), e = new Date(trip.endDate);
            return { min: { y: s.getFullYear(), m: s.getMonth() }, max: { y: e.getFullYear(), m: e.getMonth() } };
        }

        function planDayIndexForDate(trip, date) {
            const s = new Date(trip.startDate); s.setHours(0,0,0,0);
            const d = new Date(date); d.setHours(0,0,0,0);
            const diff = Math.round((d - s) / 86400000);
            const total = calculateDays(trip.startDate, trip.endDate);
            return (diff >= 0 && diff < total) ? diff : -1;
        }


        function planMakeDot(color) {
            return L.divIcon({
                html: `<div style="width:18px;height:18px;background:${color};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
                iconSize: [18, 18], iconAnchor: [9, 9], className: ''
            });
        }

        window.selectPlanDay = function(d) { planSelectedDay = d; renderPlanCards(); };

        window.updateDayMeta = function(day, field, val) {
            const trip = window.trips.find(t => t.id === currentActiveTripId);
            if (!trip.dayMeta) trip.dayMeta = {};
            if (!trip.dayMeta[day]) trip.dayMeta[day] = {};
            trip.dayMeta[day][field] = val;
            window.saveTrips();
        };

        window.planCalShift = function(delta) {
            const trip = activeTripObj(); if (!trip) return;
            const b = planTripMonthBounds(trip);
            const key = planMonthKey(planCalRef.y, planCalRef.m) + delta;
            if (key < planMonthKey(b.min.y, b.min.m) || key > planMonthKey(b.max.y, b.max.m)) return;
            planCalRef = { y: Math.floor(key / 12), m: ((key % 12) + 12) % 12 };
            renderPlanCards();
        };

        function renderPlanCalendar(trip) {
            const b = planTripMonthBounds(trip);
            const y = planCalRef.y, m = planCalRef.m;
            const monthName = new Date(y, m, 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
            const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // poniedziałek = 0
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const curKey = planMonthKey(y, m);
            const atMin = curKey <= planMonthKey(b.min.y, b.min.m);
            const atMax = curKey >= planMonthKey(b.max.y, b.max.m);
            const dayMeta = trip.dayMeta || {};

            let cells = '';
            for (let i = 0; i < firstDow; i++) cells += `<div class="pcal-cell empty"></div>`;
            for (let d = 1; d <= daysInMonth; d++) {
                const di = planDayIndexForDate(trip, new Date(y, m, d));
                if (di < 0) { cells += `<div class="pcal-cell out"><span class="pcal-dnum">${d}</span></div>`; continue; }
                const col = planDayColor(di);
                const cnt = ((trip.plan && trip.plan.days && trip.plan.days[di] && trip.plan.days[di].items) || []).length;
                const title = ((dayMeta[di] && dayMeta[di].title) || '').trim();
                cells += `<button class="pcal-cell in" style="--dc:${col};" onclick="selectPlanDay(${di})">
                    <span class="pcal-top"><span class="pcal-dnum">${d}</span><span class="pcal-daydot"></span></span>
                    <span class="pcal-daylabel">Dzień ${di + 1}</span>
                    ${title ? `<span class="pcal-title">${htmlEsc(title)}</span>` : ''}
                    ${cnt ? `<span class="pcal-cnt">${cnt}</span>` : ''}
                </button>`;
            }
            const wd = ['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(w => `<div class="pcal-wd">${w}</div>`).join('');
            return `
                <div class="plan-cal-head">
                    <div class="pcal-nav">
                        <button class="pcal-arrow" ${atMin ? 'disabled' : ''} onclick="planCalShift(-1)" aria-label="Poprzedni miesiąc">‹</button>
                        <span class="pcal-month">${monthName}</span>
                        <button class="pcal-arrow" ${atMax ? 'disabled' : ''} onclick="planCalShift(1)" aria-label="Następny miesiąc">›</button>
                    </div>
                </div>
                <div class="pcal-grid">${wd}${cells}</div>`;
        }


        window.renderPlanCards = function() {
            const container = document.getElementById('plan-board-container');
            const trip = activeTripObj();
            if (!trip) return;
            if (migrateToUnifiedPointModel(trip)) window.saveTrips();

            const dayCount = calculateDays(trip.startDate, trip.endDate);
            if (planSelectedDay !== 'all' && (planSelectedDay < 0 || planSelectedDay >= dayCount)) planSelectedDay = 'all';

            const b = planTripMonthBounds(trip);
            if (!planCalRef) planCalRef = { y: b.min.y, m: b.min.m };
            const minK = planMonthKey(b.min.y, b.min.m), maxK = planMonthKey(b.max.y, b.max.m);
            const ck = Math.max(minK, Math.min(maxK, planMonthKey(planCalRef.y, planCalRef.m)));
            planCalRef = { y: Math.floor(ck / 12), m: ((ck % 12) + 12) % 12 };

            if (planSelectedDay === 'all') {
                container.innerHTML = `<div class="plan-calendar">${renderPlanCalendar(trip)}</div>`;
                return;
            }

            window.renderTripDayView(planSelectedDay);
        };


        window.openTripMapModal = function() {
            const trip = activeTripObj(); if (!trip) return;
            document.querySelectorAll('.plan-map-backdrop').forEach(el => el.remove());
            const bd = document.createElement('div');
            bd.className = 'plan-map-backdrop';
            bd.innerHTML = `<div class="plan-map-card" role="dialog" aria-modal="true" aria-label="Mapa podróży">
                <div class="pmm-head">
                    <h3>Mapa podróży</h3>
                    <button type="button" class="pmm-close" aria-label="Wróć do tabel">×</button>
                </div>
                <div class="pmm-toolbar">
                    <button type="button" id="trip-map-add-btn" class="tmm-add-btn" onclick="openTripMapAddPicker()">＋ Dodaj</button>
                </div>
                <div class="pmm-map pg-map" id="pg-map"></div>
            </div>`;
            const close = () => {
                if (typeof window.closeStrayPointPanels === 'function') window.closeStrayPointPanels();
                if (typeof destroyPlanMap === 'function') destroyPlanMap();
                if (typeof planMapContext !== 'undefined') planMapContext = null;
                if (typeof planMapClickMode !== 'undefined') planMapClickMode = false;
                bd.remove();
                document.removeEventListener('keydown', onKey);
                document.querySelectorAll('.tmm-picker-backdrop').forEach(el => el.remove());
            };
            const onKey = e => { if (e.key === 'Escape') close(); };
            bd.addEventListener('click', e => { if (e.target === bd) close(); });
            bd.querySelector('.pmm-close').addEventListener('click', close);
            document.addEventListener('keydown', onKey);
            document.body.appendChild(bd);
            if (typeof buildGeneralMap === 'function') buildGeneralMap();
        };

        window.openTripMapAddPicker = function() {
            const trip = activeTripObj(); if (!trip) return;
            if (planMapClickMode) {
                planMapClickMode = false;
                if (typeof applyPlanMapMode === 'function') applyPlanMapMode();
                return;
            }
            document.querySelectorAll('.tmm-picker-backdrop').forEach(el => el.remove());
            const excludedFromMap = new Set(['city', 'apartment']);
            const cats = allPointCategories(trip).filter(cat => !excludedFromMap.has(cat.key));
            const rows = cats.map(cat => `<button type="button" class="tmm-picker-row" data-cat="${cat.key}" style="--cat:${cat.color};">
                <span class="tmm-picker-dot" aria-hidden="true"></span>
                <span class="tmm-picker-label">${htmlEsc(cat.title)}</span>
                <span class="tmm-picker-chev" aria-hidden="true">›</span>
            </button>`).join('');
            const bd = document.createElement('div');
            bd.className = 'tmm-picker-backdrop';
            bd.innerHTML = `<div class="tmm-picker-card" role="dialog" aria-modal="true" aria-label="Wybierz kategorię">
                <div class="tmm-picker-head">
                    <h3>Co dodać?</h3>
                    <button type="button" class="qr-close" data-close aria-label="Zamknij">×</button>
                </div>
                <div class="tmm-picker-list">${rows}</div>
            </div>`;
            const close = () => bd.remove();
            bd.addEventListener('click', e => { if (e.target === bd) close(); });
            bd.querySelector('[data-close]').addEventListener('click', close);
            bd.querySelectorAll('.tmm-picker-row').forEach(btn => {
                btn.addEventListener('click', () => {
                    const key = btn.dataset.cat;
                    close();
                    openTripMapRowPicker(key);
                });
            });
            document.body.appendChild(bd);
        };

        // Wiersz listy wyboru punktu (wspólny dla mapy podróży i mapy researchu).
        window.tmmPickerPointRowHtml = function(rowId, name, color, hasCoords) {
            return `<button type="button" class="tmm-picker-row" data-row="${attrEsc(rowId)}" data-name="${attrEsc(name.toLowerCase())}" style="--cat:${color};">
                <span class="tmm-picker-dot" aria-hidden="true"></span>
                <span class="tmm-picker-text">
                    <span class="tmm-picker-label">${htmlEsc(name)}</span>
                    ${hasCoords ? '<span class="tmm-picker-note">Już na mapie — wybranie przestawi pin</span>' : ''}
                </span>
                <span class="tmm-picker-chev" aria-hidden="true">›</span>
            </button>`;
        };

        window.tmmPickerSearchHtml = function(count) {
            return count > 0 ? `<div class="tmm-picker-search"><input type="search" placeholder="Szukaj po nazwie…" aria-label="Szukaj punktu po nazwie" autocomplete="off"></div>` : '';
        };

        // Filtruje wiersze listy po wpisanej nazwie; Enter wybiera jedyny/pierwszy pasujący.
        window.attachTmmPickerSearch = function(bd) {
            const input = bd.querySelector('.tmm-picker-search input');
            const list = bd.querySelector('.tmm-picker-list');
            if (!input || !list) return;
            const rows = Array.from(list.querySelectorAll('.tmm-picker-row[data-row]'));
            const empty = document.createElement('p');
            empty.className = 'tmm-picker-nomatch';
            empty.textContent = 'Brak punktów o tej nazwie.';
            empty.hidden = true;
            list.appendChild(empty);
            input.addEventListener('input', () => {
                const q = input.value.trim().toLowerCase();
                let shown = 0;
                rows.forEach(r => { const ok = !q || r.dataset.name.includes(q); r.hidden = !ok; if (ok) shown++; });
                empty.hidden = shown > 0;
                list.scrollTop = 0;
            });
            input.addEventListener('keydown', e => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const first = rows.find(r => !r.hidden);
                if (first) first.click();
            });
            if (window.matchMedia('(hover: hover)').matches) setTimeout(() => input.focus(), 30);
        };

        function openTripMapRowPicker(categoryKey) {
            const trip = activeTripObj(); if (!trip) return;
            const CAT_TO_TABLE = { attraction:'atrakcje', restaurant:'restauracje', place:'miejscowki', apartment:'apartamenty' };
            const tableKey = CAT_TO_TABLE[categoryKey];
            if (!tableKey) {
                // Non-table-backed category (e.g. city) — fall back to legacy click mode.
                planMapClickMode = categoryKey;
                if (typeof applyPlanMapMode === 'function') applyPlanMapMode();
                return;
            }
            const cat = categoryByKey(trip, categoryKey);
            const tableRows = (trip.tables && trip.tables[tableKey]) || [];
            const rowsHtml = tableRows.length ? tableRows.map(r => {
                const point = (trip.planPoints || []).find(p => p.id === r.id);
                const hasCoords = !!(point && point.coords && point.coords.length === 2);
                const name = (r.nazwa || '').trim() || '(bez nazwy)';
                return window.tmmPickerPointRowHtml(r.id, name, cat.color, hasCoords);
            }).join('') : `<p class="tmm-picker-empty" style="padding:16px;color:var(--ink-muted);">Brak wierszy w tabeli „${htmlEsc(cat.title)}". Najpierw dodaj wiersz w tabeli.</p>`;

            const bd = document.createElement('div');
            bd.className = 'tmm-picker-backdrop';
            bd.innerHTML = `<div class="tmm-picker-card" role="dialog" aria-modal="true" aria-label="Wybierz punkt">
                <div class="tmm-picker-head">
                    <h3>Wybierz ${htmlEsc((cat.singular || cat.title).toLowerCase())}</h3>
                    <button type="button" class="qr-close" data-close aria-label="Zamknij">×</button>
                </div>
                ${window.tmmPickerSearchHtml(tableRows.length)}
                <div class="tmm-picker-list">${rowsHtml}</div>
            </div>`;
            const close = () => bd.remove();
            bd.addEventListener('click', e => { if (e.target === bd) close(); });
            bd.querySelector('[data-close]').addEventListener('click', close);
            bd.querySelectorAll('.tmm-picker-row[data-row]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const rowId = btn.dataset.row;
                    close();
                    planMapClickMode = { categoryKey, rowId };
                    if (typeof applyPlanMapMode === 'function') applyPlanMapMode();
                });
            });
            document.body.appendChild(bd);
            window.attachTmmPickerSearch(bd);
        }
        window.openTripMapRowPicker = openTripMapRowPicker;

        window.openCitySearchModal = function(onFound) {
        window.closeStrayPointPanels();
        const bd = document.createElement('div');
        bd.className = 'adp-backdrop';
    
        bd.innerHTML = `<div class="adp-card" role="dialog" aria-modal="true" style="max-width: 420px; padding: 24px;">
            <div class="adp-head" style="margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 1.15rem; color: var(--ink);">Szukaj miasta</h3>
                <button class="qr-close" onclick="this.closest('.adp-backdrop').remove()">×</button>
            </div>
            <div style="display:flex; gap:10px; margin-bottom: 12px;">
                <input type="text" id="city-search-input" placeholder="Wpisz nazwę miasta (np. Rzym)..." style="flex:1; padding: 10px 14px; border-radius: var(--radius); border: 1px solid var(--border-mid); background: var(--bg); color: var(--ink); font-family: var(--font); outline: none;">
                <button class="btn btn-primary" id="city-search-btn">Szukaj</button>
            </div>
            <div id="city-search-result" style="min-height: 24px; font-size: 0.85rem; font-weight: 600; margin-bottom: 20px;"></div>
            <div style="display:flex; justify-content:flex-end; gap: 10px;">
                <button class="btn btn-secondary" onclick="this.closest('.adp-backdrop').remove()">Anuluj</button>
                <button class="btn btn-primary" id="city-search-next" disabled>Dalej</button>
            </div>
        </div>`;
        document.body.appendChild(bd);

        const input = bd.querySelector('#city-search-input');
        const btnSearch = bd.querySelector('#city-search-btn');
        const btnNext = bd.querySelector('#city-search-next');
        const resDiv = bd.querySelector('#city-search-result');
    
        let foundCoords = null;
        let foundName = '';

        const doSearch = async () => {
            const val = input.value.trim();
            if (!val) return;
        
            btnSearch.disabled = true;
            resDiv.innerHTML = 'Szukam...';
            resDiv.style.color = 'var(--ink-muted)';
            btnNext.disabled = true;
        

            const coords = await getCoordinates(val); 
            btnSearch.disabled = false;
        
            if (coords) {
                foundCoords = coords;
                foundName = val;
                resDiv.innerHTML = `Znaleziono: ${val}`;
                resDiv.style.color = 'var(--success)';
                btnNext.disabled = false;
            } else {
                resDiv.innerHTML = `Nie znaleziono lokalizacji. Spróbuj inaczej.`;
                resDiv.style.color = 'var(--danger)';
            }
        };

        btnSearch.addEventListener('click', doSearch);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    
        input.addEventListener('focus', () => input.style.borderColor = 'var(--primary)');
        input.addEventListener('blur', () => input.style.borderColor = 'var(--border-mid)');

        btnNext.addEventListener('click', () => {
            bd.remove();
            if (typeof onFound === 'function') {
                window.openNewPointModal('city', foundName, ({ name, cols }) => onFound(foundCoords, name, cols));
                return;
            }
            window.openNewPointModal('city', foundName, ({ name, cols }) => {
                const trip = activeTripObj();
                if (!trip) return;
                if (!trip.planPoints) trip.planPoints = [];

                const point = { id: generateId(), name, coords: foundCoords, categoryKey: 'city', cols };
                trip.planPoints.push(point);
                window.saveTrips();
                renderPlanCards();
            });
        });

        setTimeout(() => input.focus(), 30);
    };
