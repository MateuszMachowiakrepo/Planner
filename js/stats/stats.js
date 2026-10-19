
        let mapFilterState = {
            categories: new Set(),   
            tripId: '',
            onlyManual: false,       
            search: ''               
        };

        function generalMapPoints() {
            if (!window.globalBaseData) return [];
            if (!window.globalBaseData.generalMapPoints) window.globalBaseData.generalMapPoints = [];
            return window.globalBaseData.generalMapPoints;
        }

        function buildMapFilterControls() {
            const trips = (window.trips || []);

            const catKeys = new Set();
            trips.forEach(t => (t.planPoints || []).forEach(p => {
                if (p.coords && p.coords.length === 2) catKeys.add(p.categoryKey);
            }));
            generalMapPoints().forEach(p => { if (p.coords && p.coords.length === 2) catKeys.add(p.categoryKey); });
            mapFilterState.categories = new Set();

            const catBox = document.getElementById('map-filter-categories');
            catBox.innerHTML = '';
            catKeys.forEach(key => {
                const t = trips.find(tr => (tr.planPoints || []).some(p => p.categoryKey === key)) || trips[0];
                const cat = categoryByKey(t, key);
                const pill = document.createElement('button');
                pill.type = 'button';
                pill.dataset.key = key;
                pill.className = 'map-filter-pill';
                pill.dataset.active = mapFilterState.categories.has(key) ? '1' : '0';
                pill.style.setProperty('--pc', 'var(--primary)');
                pill.innerHTML = `${cat.emoji} ${htmlEsc(cat.title)}`;
                pill.onclick = () => toggleMapCategory(key, pill);
                catBox.appendChild(pill);
            });
            if (!catKeys.size) catBox.innerHTML = '<p class="qr-empty" style="margin:0;">Brak zaliczonych punktów.</p>';

            const sel = document.getElementById('map-filter-trip');
            sel.innerHTML = '<option value="">Wszystkie podróże</option>' +
                trips.map(t => `<option value="${t.id}">${htmlEsc(t.name || t.destination || 'Podróż')}</option>`).join('');
            sel.value = mapFilterState.tripId || '';

            const manualCb = document.getElementById('map-filter-manual-only');
            if (manualCb) manualCb.checked = mapFilterState.onlyManual;
        }

        function toggleMapCategory(key, pill) {
            if (mapFilterState.categories.has(key)) {
                mapFilterState.categories.delete(key);
                pill.dataset.active = '0';
            } else {
                mapFilterState.categories.add(key);
                pill.dataset.active = '1';
            }
            initStatsMap();
        }

        window.applyMapManualOnlyFilter = function(checked) {
            mapFilterState.onlyManual = checked;
            initStatsMap();
        };

        window.applyMapSearch = function(value) {
            mapFilterState.search = (value || '').trim().toLowerCase();
            initStatsMap();
        };

        window.toggleMapFilterPanel = function() {
            document.getElementById('map-filter-panel').classList.toggle('open');
        };

        window.applyMapFilters = function() {
            mapFilterState.tripId = document.getElementById('map-filter-trip').value || '';
            initStatsMap();
        };

        let statsMapClickMode = false;

        window.toggleMapAddPanel = function() {
            document.getElementById('map-add-panel').classList.toggle('open');
            buildMapAddControls();
        };

        function buildMapAddControls() {
            const box = document.getElementById('map-add-categories');
            if (!box) return;
            box.innerHTML = BUILTIN_POINT_CATEGORIES.map(cat =>
                `<button type="button" class="plan-mapmode-btn" style="--cat:${cat.color};" data-cat="${cat.key}" onclick="handleMapAddCategoryClick('${cat.key}')">${cat.emoji} Dodaj ${htmlEsc(cat.addLabel)}</button>`
            ).join('');
            applyStatsMapMode();
        }

        function applyStatsMapMode() {
            document.querySelectorAll('#map-add-categories .plan-mapmode-btn').forEach(btn => {
                btn.classList.toggle('active', statsMapClickMode === btn.dataset.cat);
            });
            const mapEl = document.getElementById('map-container');
            if (mapEl) mapEl.style.cursor = statsMapClickMode ? 'crosshair' : '';
            const hint = document.getElementById('map-add-hint');
            if (hint) hint.style.display = statsMapClickMode ? 'block' : 'none';
        }

        window.handleMapAddCategoryClick = function(key) {
            if (key === 'city') {
                statsMapClickMode = false; applyStatsMapMode();
                openCitySearchModal((coords, name, cols) => addGeneralMapPoint(name, coords, 'city', cols));
                return;
            }
            statsMapClickMode = (statsMapClickMode === key) ? false : key;
            applyStatsMapMode();
        };

        function handleStatsMapClick(latlng, categoryKey) {
            window.openNewPointModal(categoryKey, '', ({ name, cols }) => {
                addGeneralMapPoint(name, [latlng.lat, latlng.lng], categoryKey, cols);
            });
        }

        function addGeneralMapPoint(name, coords, categoryKey, cols) {
            const point = { id: generateId(), name, coords, categoryKey, cols: cols || {} };
            generalMapPoints().push(point);
            window.saveGlobalBase();
            statsMapClickMode = false; applyStatsMapMode();
            buildMapFilterControls();
            initStatsMap();
        }

        window.deleteGeneralMapPoint = function(id) {
            if (!confirm('Usunąć ten punkt z mapy ogólnej?')) return;
            window.globalBaseData.generalMapPoints = generalMapPoints().filter(p => p.id !== id);
            window.saveGlobalBase();
            const floating = document.querySelector('.pt-floating');
            if (floating && floating._close) floating._close(true);
            buildMapFilterControls();
            initStatsMap();
        };

        function generalPointDetailHtml(p) {
            const cat = categoryByKey(null, p.categoryKey);
            const fieldsHtml = (cat.cols || []).map((label, i) => {
                const val = (p.cols || {})['col' + i];
                if (val == null || String(val).trim() === '') return '';
                return `<div class="pt-field"><span class="pt-field-label">${htmlEsc(label)}</span><span class="pt-field-value">${htmlEsc(val)}</span></div>`;
            }).join('');
            return `<div class="pt-card" style="--cat:${cat.color};" data-point-id="${p.id}">
                <div class="pt-head">
                    <span class="pt-name">${cat.emoji} ${htmlEsc(p.name)}</span>
                    <button class="pt-close" onclick="this.closest('.pt-floating')._close()" aria-label="Zamknij">×</button>
                </div>
                <div class="pt-badges"><span class="pt-kind-badge">${cat.emoji} ${htmlEsc(cat.singular || cat.title)}</span><span class="pt-kind-badge">Dodane ręcznie</span></div>
                ${fieldsHtml ? `<div class="pt-fields">${fieldsHtml}</div>` : ''}
                <div class="pt-actions">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="openGeneralPointEditFromPanel(this)">✏️ Edytuj</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="deleteGeneralMapPoint('${p.id}')">🗑️ Usuń</button>
                </div>
            </div>`;
        }

        function generalPointEditHtml(p) {
            const cat = categoryByKey(null, p.categoryKey);
            const cols = p.cols || {};
            const colsHtml = (cat.cols && cat.cols.length) ? cat.cols.map((label, i) => {
                const opts = cat.colOptions && cat.colOptions[i];
                const field = opts
                    ? `<select name="gp-col${i}">${colOptionsHtml(opts, cols['col' + i])}</select>`
                    : `<input type="text" name="gp-col${i}" value="${attrEsc(cols['col' + i])}">`;
                return `<label class="tc-field"><span>${htmlEsc(label)}</span>${field}</label>`;
            }).join('') : '';
            return `<div class="pt-card" style="--cat:${cat.color};" data-point-id="${p.id}">
                <div class="pt-head">
                    <span class="pt-name">✏️ Edycja</span>
                    <button class="pt-close" onclick="cancelGeneralPointEdit(this)" aria-label="Zamknij">×</button>
                </div>
                <form class="pt-edit-form" onsubmit="return false;">
                    <label class="tc-field"><span>Nazwa</span><input type="text" name="gp-name" value="${attrEsc(p.name)}" required></label>
                    ${colsHtml}
                    <div class="pt-actions">
                        <button type="button" class="btn btn-primary btn-sm" onclick="saveGeneralPointEdit(this)">💾 Zapisz</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="cancelGeneralPointEdit(this)">Anuluj</button>
                    </div>
                </form>
            </div>`;
        }

        window.openGeneralPointEditFromPanel = function(btn) {
            const card = btn.closest('.pt-card'); if (!card) return;
            const p = generalMapPoints().find(x => x.id === card.dataset.pointId); if (!p) return;
            swapPointPanelContent(btn, generalPointEditHtml(p));
        };

        window.cancelGeneralPointEdit = function(btn) {
            const card = btn.closest('.pt-card'); if (!card) return;
            const p = generalMapPoints().find(x => x.id === card.dataset.pointId); if (!p) return;
            swapPointPanelContent(btn, generalPointDetailHtml(p));
        };

        window.saveGeneralPointEdit = function(btn) {
            const card = btn.closest('.pt-card'); if (!card) return;
            const p = generalMapPoints().find(x => x.id === card.dataset.pointId); if (!p) return;
            const form = card.querySelector('form');
            const cat = categoryByKey(null, p.categoryKey);
            const name = form.elements['gp-name'].value.trim();
            if (name) p.name = name;
            if (cat.cols && cat.cols.length) {
                p.cols = p.cols || {};
                cat.cols.forEach((_, i) => { p.cols['col' + i] = form.elements['gp-col' + i].value; });
            }
            window.saveGlobalBase();
            swapPointPanelContent(btn, generalPointDetailHtml(p));
            buildMapFilterControls();
            initStatsMap();
        };

        function openGeneralPointPanel(p, anchorEl) {
            const existing = document.querySelector('.pt-floating');
            if (existing) { const same = existing._anchor === anchorEl; existing._close(); if (same) return; }
            const pop = document.createElement('div');
            pop.className = 'pt-floating';
            pop.innerHTML = `<div class="pt-arrow"></div>${generalPointDetailHtml(p)}`;
            document.body.appendChild(pop);
            pop._anchor = anchorEl;
            positionFloatingPanel(pop, anchorEl);
            pop._close = () => { pop.remove(); };
        }

        let statsMapFocus = null;
        function focusGeneralMapMarker(map, marker, openPanelFn) {
            const anchorEl = marker.getElement();
            if (!anchorEl) return;
            const existing = document.querySelector('.pt-floating');
            if (existing && existing._anchor === anchorEl) { existing._close(); return; }
            if (existing && existing._close) existing._close(true);
            if (!statsMapFocus || statsMapFocus.map !== map) {
                try { statsMapFocus = { map, view: { center: map.getCenter(), zoom: map.getZoom() } }; } catch (e) { statsMapFocus = null; }
            }
            const targetZoom = Math.min(14, map.getMaxZoom() || 14);
            map.flyTo(marker.getLatLng(), targetZoom, { animate: true, duration: 0.7 });
            map.once('moveend', () => {
                openPanelFn(anchorEl);
                const pop = document.querySelector('.pt-floating');
                if (!pop) return;
                const origClose = pop._close;
                pop._close = (skipReturnZoom) => {
                    origClose();
                    if (!skipReturnZoom && statsMapFocus && statsMapFocus.map === map && mapInstance === map) {
                        try { map.flyTo(statsMapFocus.view.center, statsMapFocus.view.zoom, { animate: true, duration: 0.7 }); } catch (e) {}
                    }
                    if (!skipReturnZoom) statsMapFocus = null;
                };
            });
        }

        let mapInstance = null;

        let leafletMarkers = [];

        window.initStatsMap = function() {
            const mapEl = document.getElementById('map-container');
            if (!mapEl) return;

            const nameMatches = (name) => !mapFilterState.search || String(name || '').toLowerCase().includes(mapFilterState.search);

            const markersData = [];
            if (!mapFilterState.onlyManual) {
                (window.trips || []).forEach(t => {
                    if (mapFilterState.tripId && t.id !== mapFilterState.tripId) return;
                    if (typeof migrateToUnifiedPointModel === 'function') migrateToUnifiedPointModel(t);
                    (t.planPoints || []).forEach(p => {
                        if (!p.coords || p.coords.length !== 2) return;
                        if (mapFilterState.categories.size && !mapFilterState.categories.has(p.categoryKey)) return;
                        if (!nameMatches(p.name)) return;
                        const cat = categoryByKey(t, p.categoryKey);
                        markersData.push({
                            coords: p.coords, color: cat.color, kind: 'trip', point: p, tripId: t.id
                        });
                    });
                });
            }

            if (mapFilterState.onlyManual || !mapFilterState.tripId) {
                generalMapPoints().forEach(p => {
                    if (!p.coords || p.coords.length !== 2) return;
                    if (mapFilterState.categories.size && !mapFilterState.categories.has(p.categoryKey)) return;
                    if (!nameMatches(p.name)) return;
                    const cat = categoryByKey(null, p.categoryKey);
                    markersData.push({ coords: p.coords, color: cat.color, kind: 'manual', point: p });
                });
            }

            let preservedView = null;
            if (statsMapFocus && mapInstance && statsMapFocus.map === mapInstance) {
                preservedView = statsMapFocus.view;
                statsMapFocus = null;
            } else if (mapInstance) {
                try { preservedView = { center: mapInstance.getCenter(), zoom: mapInstance.getZoom() }; } catch (e) { preservedView = null; }
            }

            if (mapInstance) { try { mapInstance.remove(); } catch (e) {} mapInstance = null; }
            leafletMarkers = [];
            mapEl.innerHTML = '';
            const leafletDiv = document.createElement('div');
            leafletDiv.style.cssText = 'width:100%; height:100%; border-radius:var(--radius-lg); overflow:hidden;';
            mapEl.appendChild(leafletDiv);

            const centerCoords = preservedView ? preservedView.center : (markersData.length > 0 ? markersData[0].coords : [20, 0]);
            const zoom = preservedView ? preservedView.zoom : (markersData.length > 0 ? 4 : 2);
            mapInstance = L.map(leafletDiv, { zoomControl: true, scrollWheelZoom: true }).setView(centerCoords, zoom);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19
            }).addTo(mapInstance);

            markersData.forEach(m => {
                const icon = L.divIcon({
                    html: `<div style="width:16px;height:16px;background:${m.color};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.25);"></div>`,
                    iconSize: [16, 16], iconAnchor: [8, 8], className: ''
                });
                const marker = L.marker(m.coords, { icon }).addTo(mapInstance);
                marker.on('click', () => {
                    if (m.kind === 'trip') {
                        focusGeneralMapMarker(mapInstance, marker, (anchorEl) => {
                            currentActiveTripId = m.tripId;
                            window.openPointDetailPanel(m.point, { inDay: null, dp: null, generalMap: true }, anchorEl);
                        });
                    } else {
                        focusGeneralMapMarker(mapInstance, marker, (anchorEl) => openGeneralPointPanel(m.point, anchorEl));
                    }
                });
                leafletMarkers.push(marker);
            });

            mapInstance.on('click', e => { if (statsMapClickMode) handleStatsMapClick(e.latlng, statsMapClickMode); });

            if (!preservedView && markersData.length > 1) {
                const group = L.featureGroup(leafletMarkers);
                mapInstance.fitBounds(group.getBounds().pad(0.2));
            }
            if (markersData.length === 0) {
                mapEl.insertAdjacentHTML('beforeend', '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--ink-muted);font-weight:600;pointer-events:none;text-align:center;padding:20px;">Brak punktów dla wybranych filtrów.</div>');
            }

            applyStatsMapMode();
            setTimeout(() => { if (mapInstance) mapInstance.invalidateSize(); }, 200);
        };

        const geocodeCache = {};

        async function getCoordinates(destination) {
            if (!destination) return null;
            if (geocodeCache[destination] !== undefined) return geocodeCache[destination];

            try {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const contactEmail = (window.APP_CONFIG && window.APP_CONFIG.nominatimEmail) || '';

                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=1${contactEmail ? '&email=' + encodeURIComponent(contactEmail) : ''}`,
                    { headers: { 'Accept-Language': 'pl' } }
                );

                if (!response.ok) {
                    console.error(`Błąd API Nominatim: ${response.status} ${response.statusText}`);
                    return null;
                }

                const data = await response.json();
                if (data && data.length > 0) {
                    const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                    geocodeCache[destination] = coords;
                    return coords;
                }
            } catch (error) {
                console.error("Błąd sieci/CORS pobierania współrzędnych dla:", destination, error);
            }

            geocodeCache[destination] = null;
            return null;
        }
