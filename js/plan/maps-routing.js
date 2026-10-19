
        let planMapInstance = null;   

        let planMapRefresh = null;    

        let planMapClickMode = false; 


        let planMapContext = null;

        let planMarkers = [];

        let planMapFocus = null; // {map, view:{center,zoom}} | null

        const PLAN_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        const PLAN_TILE_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

        function destroyPlanMap() {
            if (planMapInstance) { try { planMapInstance.remove(); } catch(e) {} planMapInstance = null; }
            planMarkers = [];
        }

        function capturePreservedMapView(context) {
            if (!planMapInstance || !planMapContext) return null;
            const same = planMapContext.type === context.type && planMapContext.day === context.day;
            if (!same) return null;
            try { return { center: planMapInstance.getCenter(), zoom: planMapInstance.getZoom() }; } catch (e) { return null; }
        }

        function focusMapOnMarker(map, marker, point, ctx) {
            const anchorEl = marker.getElement();
            if (!anchorEl) return;

            const existing = document.querySelector('.pt-floating');
            if (existing && existing._anchor === anchorEl) { existing._close(); return; } 
            if (existing && existing._close) existing._close(true);

            if (!planMapFocus || planMapFocus.map !== map) {
                try { planMapFocus = { map, view: { center: map.getCenter(), zoom: map.getZoom() } }; } catch (e) { planMapFocus = null; }
            }

            const targetZoom = Math.min(14, map.getMaxZoom() || 14);
            map.flyTo(marker.getLatLng(), targetZoom, { animate: true, duration: 0.7 });

            map.once('moveend', () => {
                window.openPointDetailPanel(point, ctx, anchorEl);
                const pop = document.querySelector('.pt-floating');
                if (!pop) return;
                const origClose = pop._close;
                pop._close = (skipReturnZoom) => {
                    origClose();
                    if (!skipReturnZoom && planMapFocus && planMapFocus.map === map && planMapInstance === map) {
                        try { map.flyTo(planMapFocus.view.center, planMapFocus.view.zoom, { animate: true, duration: 0.7 }); } catch (e) {}
                    }
                    if (!skipReturnZoom) planMapFocus = null;
                };
            });
        }

        function buildGeneralMap() {
            const div = document.getElementById('pg-map');
            if (!div) return;
            const trip = activeTripObj(); if (!trip) return;
            const points = (trip.planPoints || []).filter(p => p.coords && p.coords.length === 2);
            const preserved = capturePreservedMapView({ type: 'general' });
            destroyPlanMap();
            div.innerHTML = '';
            const center = preserved ? preserved.center : (points.length ? points[0].coords : (trip.coords || [20, 0]));
            const zoom = preserved ? preserved.zoom : (points.length ? 14 : (trip.coords ? 11 : 2));
            const map = L.map(div, { zoomControl: true, scrollWheelZoom: true }).setView(center, zoom);
            L.tileLayer(PLAN_TILE_URL, { attribution: PLAN_TILE_ATTR, maxZoom: 19 }).addTo(map);
            points.forEach(p => {
                const color = categoryByKey(trip, p.categoryKey).color;
                const marker = L.marker(p.coords, { icon: planMakeDot(color) }).addTo(map);
                marker.on('click', () => focusMapOnMarker(map, marker, p, { generalMap: true }));
                planMarkers.push(marker);
            });
            const fitToPoints = () => { if (planMarkers.length > 1) map.fitBounds(L.featureGroup(planMarkers).getBounds(), { padding: [30, 30], maxZoom: 15 }); };
            if (!preserved) fitToPoints();
            map.on('click', e => { if (planMapClickMode) window.handlePlanMapClick(e.latlng, planMapClickMode); });
            planMapInstance = map;
            planMapContext = { type: 'general' };
            planMapRefresh = buildGeneralMap;
            applyPlanMapMode();
            setTimeout(() => { if (planMapInstance !== map) return; map.invalidateSize(); if (!preserved) fitToPoints(); }, 180);
        }

        function applyPlanMapMode() {
            const modeKey = (planMapClickMode && typeof planMapClickMode === 'object') ? planMapClickMode.categoryKey : planMapClickMode;
            document.querySelectorAll('.plan-mapmode-btn[data-cat]').forEach(btn => {
                const key = btn.dataset.cat;
                const active = modeKey === key;
                btn.classList.toggle('active', active);
            });
            const mapEl = document.getElementById('pg-map');
            if (mapEl) mapEl.style.cursor = planMapClickMode ? 'crosshair' : '';
            const addBtn = document.getElementById('trip-map-add-btn');
            if (addBtn) {
                if (planMapClickMode) {
                    const trip = (typeof activeTripObj === 'function') ? activeTripObj() : null;
                    const cat = trip ? categoryByKey(trip, modeKey) : null;
                    let label = cat ? `${cat.emoji} ${cat.title}` : 'Dodaj';
                    if (trip && planMapClickMode && typeof planMapClickMode === 'object' && planMapClickMode.rowId) {
                        const CAT_TO_TABLE = { attraction:'atrakcje', restaurant:'restauracje', place:'miejscowki', apartment:'apartamenty' };
                        const tk = CAT_TO_TABLE[modeKey];
                        const row = tk ? ((trip.tables && trip.tables[tk]) || []).find(r => r.id === planMapClickMode.rowId) : null;
                        const name = (row && row.nazwa || '').trim();
                        if (name) label = `${cat ? cat.emoji + ' ' : ''}${name}`;
                    }
                    addBtn.innerHTML = `Klikaj mapę: ${label} · Anuluj`;
                    addBtn.classList.add('active');
                } else {
                    addBtn.innerHTML = '＋ Dodaj';
                    addBtn.classList.remove('active');
                }
            }
        }

        window.handlePlanMapClick = function(latlng, mode) {
            const trip = activeTripObj(); if (!trip) return;
            if (!mode) return;

            // New: linking an existing table row's point.
            if (typeof mode === 'object') {
                const { categoryKey, rowId } = mode;
                if (!Array.isArray(trip.planPoints)) trip.planPoints = [];
                let point = trip.planPoints.find(p => p.id === rowId);
                const CAT_TO_TABLE = { attraction:'atrakcje', restaurant:'restauracje', place:'miejscowki', apartment:'apartamenty' };
                const tk = CAT_TO_TABLE[categoryKey];
                const row = tk ? ((trip.tables && trip.tables[tk]) || []).find(r => r.id === rowId) : null;
                if (!point) {
                    point = { id: rowId, name: (row && row.nazwa) || '', coords: null, categoryKey, cols: {}, comments: [], done: false, baseCardId: null };
                    trip.planPoints.push(point);
                } else if (row && row.nazwa) {
                    point.name = row.nazwa;
                }
                point.coords = [latlng.lat, latlng.lng];
                window.saveTrips();
                planMapClickMode = false;
                applyPlanMapMode();
                if (planMapRefresh) planMapRefresh();
                return;
            }

            // Legacy string mode: opens a new-point modal (used by city search flow).
            window.openNewPointModal(mode, '', ({ name, cols }) => {
                if (!trip.planPoints) trip.planPoints = [];
                const point = { id: generateId(), name, coords: [latlng.lat, latlng.lng], categoryKey: mode, cols };
                trip.planPoints.push(point);
                window.saveTrips();
                if (planMapRefresh) planMapRefresh();
                renderPlanCards();
            });
        };
