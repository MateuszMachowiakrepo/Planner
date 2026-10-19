        
        let editingId = null;


        const TRIP_VIEW_PANEL_KEY = 'plannerTripViewPanel';
        function loadTripViewPanel(){
            try { return localStorage.getItem(TRIP_VIEW_PANEL_KEY) || 'tables'; } catch(e){ return 'tables'; }
        }
        function saveTripViewPanel(panel){
            try { localStorage.setItem(TRIP_VIEW_PANEL_KEY, panel); } catch(e){}
        }
        function topOfPanel(panel){
            if (panel === 'tables' || panel === 'country' || panel === 'tickets') return panel;
            return 'calendar';
        }
        window.setTripViewPanel = function(panel){
            const known = ['tables', 'calendar', 'day', 'country', 'tickets'];
            if (!known.includes(panel)) panel = 'tables';
            const top = topOfPanel(panel);

            document.querySelectorAll('#board-plan-tab .trip-board-panel').forEach(p => {
                p.hidden = p.dataset.top !== top;
            });
            document.querySelectorAll('#board-plan-tab .trip-board-navbtn').forEach(b => {
                const on = b.dataset.top === top;
                b.classList.toggle('active', on);
                b.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            const toolbar = document.getElementById('trip-tables-toolbar');
            if (toolbar) toolbar.hidden = top !== 'tables';
            const wrap = document.getElementById('board-plan-tab');
            if (wrap) {
                wrap.classList.remove('trip-view-tables', 'trip-view-calendar', 'trip-view-day', 'trip-view-country', 'trip-view-tickets');
                wrap.classList.add('trip-view-' + panel);
            }
            saveTripViewPanel(panel);

            if (panel === 'country') {
                if (typeof window.renderCountrySheet === 'function') {
                    window.renderCountrySheet('trip-country', () => window.trips.find(t => t.id === currentActiveTripId), () => window.saveTrips());
                }
                return;
            }
            if (panel === 'tables') {
                if (typeof window.renderTripTables === 'function') window.renderTripTables();
                return;
            }
            if (panel === 'tickets') {
                if (typeof window.renderTripTickets === 'function') window.renderTripTickets();
                return;
            }
            if (panel === 'day') {
                if (typeof planSelectedDay !== 'undefined' && planSelectedDay === 'all') planSelectedDay = 0;
            } else {
                if (typeof planSelectedDay !== 'undefined') planSelectedDay = 'all';
            }
            if (typeof renderPlanCards === 'function') renderPlanCards();
        };

        window.setTripTopPanel = function(top){
            if (top === 'tables' || top === 'country' || top === 'tickets') {
                window.setTripViewPanel(top);
            } else {
                const dayActive = (typeof planSelectedDay === 'number');
                window.setTripViewPanel(dayActive ? 'day' : 'calendar');
            }
        };

        function renderTripBoard(){
            setTripViewPanel(loadTripViewPanel());
        }

        window.openTripBoard = function(tripId, fromTab) {
            if (fromTab) originTab = fromTab;
            currentActiveTripId = tripId;
            planSelectedDay = 'all';
            planCalRef = null;
            planMapClickMode = false;
            const trip = window.trips.find(t => t.id === tripId);
            if (!trip) return;
            document.getElementById('plan-trip-title').innerText = trip.name;
            window.showMainTab('board-plan');
            renderTripBoard();
        };

        function isArchived(trip) { const today = new Date(); today.setHours(0, 0, 0, 0); return new Date(trip.endDate) < today; }


        function renderTrips() {
            const container = document.getElementById('trips-container');
            const activeTrips = window.trips.filter(t => !isArchived(t)).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            if (!activeTrips.length) return container.innerHTML = `<div class="empty-state"><p>Brak zaplanowanych podróży.</p><button class="btn btn-primary" style="margin-top:20px;" onclick="showMainTab('add')">Dodaj pierwszą podróż</button></div>`;
            container.innerHTML = activeTrips.map(t => renderTripItem(t)).join('');
        }


        function renderArchive() {
            const container = document.getElementById('archive-container');
            const archivedTrips = window.trips.filter(t => isArchived(t)).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
            if (!archivedTrips.length) return container.innerHTML = `<div class="empty-state"><p>Brak archiwalnych podróży.</p></div>`;
            container.innerHTML = archivedTrips.map(t => renderTripItem(t, true)).join('');
        }


function renderTripItem(trip, archived = false) {
    const days = calculateDays(trip.startDate, trip.endDate);
    const daysLabel = `${days} ${days === 1 ? 'dzień' : (days < 5 ? 'dni' : 'dni')}`;
    const origin = archived ? 'archive' : 'list';
    return `
        <div class="trip-card${archived ? ' trip-card-archived' : ''}" role="button" tabindex="0" onclick="openTripBoard('${trip.id}','${origin}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openTripBoard('${trip.id}','${origin}');}">
            <div class="trip-card-main">
                <div class="trip-card-name">${htmlEsc(trip.name)}</div>
                <div class="trip-card-dest">${htmlEsc(trip.destination || '')}</div>
            </div>
            <div class="trip-card-meta">
                <span class="trip-card-dates">${formatDate(trip.startDate)} — ${formatDate(trip.endDate)}</span>
                <span class="trip-card-days">${daysLabel}</span>
                ${archived ? '<span class="trip-card-tag">Archiwum</span>' : ''}
            </div>
            <div class="trip-card-actions" onclick="event.stopPropagation()">
                <button type="button" class="trip-card-mini" onclick="editTrip('${trip.id}')">Edytuj</button>
                <button type="button" class="trip-card-mini trip-card-mini-danger" onclick="deleteTrip('${trip.id}')">Usuń</button>
            </div>
        </div>
    `;
}


       document.getElementById('trip-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.querySelector('#trip-form button');
    const originalBtnText = submitBtn.textContent;
    const destInput = document.getElementById('destination').value;

    submitBtn.textContent = 'Zapisywanie lokalizacji...';
    submitBtn.disabled = true;

    const existingTrip = editingId ? window.trips.find(t => t.id === editingId) : null;
    const imp = (!existingTrip && window.pendingResearchImport) ? window.pendingResearchImport : null;

    let coords = null;
    if (existingTrip && existingTrip.destination === destInput && existingTrip.coords) {
        coords = existingTrip.coords;
    } else {
        coords = await getCoordinates(destInput);
    }

    const tripData = {
    id: editingId || generateId(),
    name: document.getElementById('trip-name').value,
    destination: destInput,
    coords: coords,
    startDate: document.getElementById('start-date').value,
    endDate: document.getElementById('end-date').value,
    budget: document.getElementById('budget').value,
    travelers: document.getElementById('travelers').value,
    type: document.getElementById('trip-type').value,
    transport: document.getElementById('transport').value,
    notes: document.getElementById('notes').value,
    additionalCities: existingTrip ? (existingTrip.additionalCities || []) : [],
    additionalCitiesCoords: existingTrip ? (existingTrip.additionalCitiesCoords || {}) : {},
    plans: existingTrip ? (existingTrip.plans || []) : [],
    planPoints: existingTrip ? (existingTrip.planPoints || []) : (imp && Array.isArray(imp.planPoints) ? imp.planPoints : []),
    plan: existingTrip ? (existingTrip.plan || {}) : (imp && imp.plan ? imp.plan : {}),
    dayMeta: existingTrip ? (existingTrip.dayMeta || {}) : (imp && imp.dayMeta ? imp.dayMeta : {}),
    tables: existingTrip ? (existingTrip.tables || {}) : (imp ? imp.tables : {}),
    tableNames: existingTrip ? (existingTrip.tableNames || {}) : (imp ? imp.tableNames : {}),
    tripBudget: existingTrip ? (existingTrip.tripBudget != null ? existingTrip.tripBudget : '') : (imp && imp.budget != null ? imp.budget : ''),
    countryInfo: existingTrip ? (existingTrip.countryInfo || {}) : (imp && imp.countryInfo ? imp.countryInfo : {}),
};
    if (imp) window.pendingResearchImport = null;

    if (editingId) { 
        window.trips = window.trips.map(t => t.id === editingId ? tripData : t); 
        editingId = null; 
    } else { 
        window.trips.push(tripData); 
    }
    
    window.saveTrips();
    if (imp && imp.boardId && typeof window.removeResearchBoardAfterImport === 'function') {
        window.removeResearchBoardAfterImport(imp.boardId);
    }
    this.reset();
    document.getElementById('travelers').value = '1';

    submitBtn.textContent = 'Zapisz podróż';
    submitBtn.disabled = false;
    window.showMainTab('list');
    });


        function editTrip(id) {
            const trip = window.trips.find(t => t.id === id); if (!trip) return;
            editingId = id;
            document.getElementById('trip-name').value = trip.name; document.getElementById('destination').value = trip.destination;
            document.getElementById('start-date').value = trip.startDate; document.getElementById('end-date').value = trip.endDate;
            document.getElementById('budget').value = trip.budget || ''; document.getElementById('travelers').value = trip.travelers;
            document.getElementById('trip-type').value = trip.type; document.getElementById('transport').value = trip.transport;
            document.getElementById('notes').value = trip.notes || '';
            window.showMainTab('add'); document.querySelector('#trip-form button').textContent = 'Zaktualizuj podróż';
        }


        function deleteTrip(id) { if (confirm('Usunąć tę podróż?')) { window.trips = window.trips.filter(t => t.id !== id); window.saveTrips(); renderTrips(); } }
