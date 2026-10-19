
        const CITY_KINDS = ['Stolica','Miasto','Zabytkowe miasto','Nadmorskie','Wioska','Mniejsze miasto'];
        const PLACE_KINDS = ['Wodospad','Wyspa','Jezioro','Park','Widok','Zabudowa','Atrakcja','Zabytek','Ścieżka','Plaża','Hotel'];
        const ATTRACTION_KINDS = ['Muzeum','Park rozrywki','Wycieczka','Zamek','Twierdza','Natura'];
        const CUISINE_KINDS = ['Śniadanie','Kawiarnia','Drinki','Sery','Tapas','Lokalna','Włoska','Azjatycka','Indyjska','Amerykańska','Meksykańska','Polska','Inna'];

        const BUILTIN_POINT_CATEGORIES = [
            { key:'city',       builtin:true, removable:false,
              title:'Miasta',      singular:'Miasto',      addLabel:'miasto',      emoji:'', color:'#2563eb',
              cols:['Rodzaj','Landmark','Odległość'],      colOptions:[CITY_KINDS, null, null],          countsInStats:true },

            { key:'place',      builtin:true, removable:false,
              title:'Miejsca',     singular:'Miejsce',     addLabel:'miejsce',     emoji:'', color:'#0d9488',
              cols:['Lokalizacja','Rodzaj','Walory'],      colOptions:[null, PLACE_KINDS, null],         countsInStats:false },

            { key:'attraction', builtin:true, removable:false,
              title:'Atrakcje',    singular:'Atrakcja',    addLabel:'atrakcję',    emoji:'', color:'#c026d3',
              cols:['Lokalizacja','Cena','Kategoria','Czas'], colOptions:[null, null, ATTRACTION_KINDS, null], countsInStats:false },

            { key:'restaurant', builtin:true, removable:false,
              title:'Restauracje', singular:'Restauracja', addLabel:'restaurację', emoji:'', color:'#ea580c',
              cols:['Miasto','Kuchnia','Cena','Ocena'],    colOptions:[null, CUISINE_KINDS, null, null], countsInStats:false },

            { key:'apartment',  builtin:true, removable:false,
              title:'Apartamenty', singular:'Apartament',   addLabel:'apartament',  emoji:'', color:'#2d8a5e',
              cols:['Lokalizacja','Ocena','Cena'],          colOptions:[null, null, null],                countsInStats:false },
        ];

        function customPointCategories(trip) {
            if (!trip) return [];
            if (!Array.isArray(trip.customPointCategories)) trip.customPointCategories = [];
            return trip.customPointCategories;
        }

        function allPointCategories(trip) { return BUILTIN_POINT_CATEGORIES.concat(customPointCategories(trip)); }

        function categoryByKey(trip, key) { return allPointCategories(trip).find(c => c.key === key) || BUILTIN_POINT_CATEGORIES[0]; }

        function poolPointsForCategory(trip, key) { return (trip.planPoints || []).filter(p => p.categoryKey === key); }

        function colOptionsHtml(options, currentValue) {
            const cur = currentValue == null ? '' : String(currentValue);
            const known = options.includes(cur);
            let html = `<option value="">— wybierz —</option>`;
            if (cur && !known) html += `<option value="${attrEsc(cur)}" selected>${htmlEsc(cur)}</option>`;
            html += options.map(o => `<option value="${attrEsc(o)}"${o === cur ? ' selected' : ''}>${htmlEsc(o)}</option>`).join('');
            return html;
        }

        function mergeCategoryByTitleIntoBuiltin(trip, title, builtinKey) {
            const idx = customPointCategories(trip).findIndex(c => c.title === title);
            if (idx === -1) return false;
            const oldKey = trip.customPointCategories[idx].key;
            (trip.planPoints || []).forEach(p => { if (p.categoryKey === oldKey) p.categoryKey = builtinKey; });
            if (trip.dayPoints && typeof trip.dayPoints === 'object') {
                Object.keys(trip.dayPoints).forEach(day => {
                    (trip.dayPoints[day] || []).forEach(dp => { if (dp.categoryKey === oldKey) dp.categoryKey = builtinKey; });
                });
            }
            trip.customPointCategories.splice(idx, 1);
            return true;
        }

        function migrateToUnifiedPointModel(trip) {
            if (trip.pointsModelVersion >= 5) return false;

            if (!trip.pointsModelVersion || trip.pointsModelVersion < 3) {

            if (!trip.pointsModelVersion || trip.pointsModelVersion < 2) {
                if (!Array.isArray(trip.planPoints)) trip.planPoints = [];
                trip.planPoints.forEach(p => {
                    if (p.categoryKey === undefined) {
                        if (p.source === 'map') p.categoryKey = 'place';
                        else if (p.source === 'restaurant') p.categoryKey = 'restaurant';
                        else p.categoryKey = 'city';
                    }
                    delete p.source;
                    if (!p.cols || typeof p.cols !== 'object') p.cols = {};
                    if (!Array.isArray(p.comments)) p.comments = [];
                });

                if (trip.listData) {
                    const OLD_TO_BUILTIN = { 'Miasta':'city', 'Atrakcje':'attraction', 'Restauracje':'restaurant', 'Miejscówki':'place' };
                    const DEFAULT_EXTRA = {
                        'Inne': { cols:['Szczegóły'], emoji:'📌', color:'#64748b' },
                    };
                    Object.keys(trip.listData).forEach(oldKey => {
                        const rows = trip.listData[oldKey] || [];
                        let categoryKey = OLD_TO_BUILTIN[oldKey];
                        if (!categoryKey) {
                            if (!rows.length) return;
                            const customDef = (trip.customListTypes || []).find(t => t.key === oldKey);
                            let cols, title, emoji, color;
                            if (DEFAULT_EXTRA[oldKey]) { cols = DEFAULT_EXTRA[oldKey].cols; title = oldKey; emoji = DEFAULT_EXTRA[oldKey].emoji; color = DEFAULT_EXTRA[oldKey].color; }
                            else if (customDef) { cols = (customDef.cols || []).slice(1); title = customDef.key; emoji = customDef.emoji; color = customDef.th; }
                            else { cols = []; title = oldKey; emoji = '📋'; color = '#64748b'; }
                            categoryKey = 'k_' + generateId();
                            customPointCategories(trip).push({ key:categoryKey, builtin:false, removable:true, title, singular:title, addLabel:title.toLowerCase(), emoji, color, cols, countsInStats:false });
                        }
                        rows.forEach(r => {
                            const name = (r.col0 || '').trim();
                            const cols = {};
                            let i = 0;
                            while (r['col' + (i + 1)] !== undefined) { cols['col' + i] = r['col' + (i + 1)]; i++; }
                            const comments = (r.comment && r.comment.trim()) ? [{ id: generateId(), text: r.comment, ts: Date.now() }] : [];
                            trip.planPoints.push({ id: r.id || generateId(), name, coords: null, categoryKey, done: !!r.done, cols, comments });
                        });
                    });
                    delete trip.listData;
                    delete trip.customListTypes;
                }

                if (trip.dayPoints && typeof trip.dayPoints === 'object') {
                    Object.keys(trip.dayPoints).forEach(day => {
                        (trip.dayPoints[day] || []).forEach(dp => {
                            if (dp.categoryKey === undefined) dp.categoryKey = dp.kind;
                            delete dp.kind;
                            if (dp.time === undefined) dp.time = null;
                        });
                    });
                }
            }

            mergeCategoryByTitleIntoBuiltin(trip, 'Miejscówki', 'place');

            }

            if (!trip.pointsModelVersion || trip.pointsModelVersion < 4) {
                (trip.planPoints || []).forEach(p => {
                    if (p.categoryKey === 'attraction' && p.cols && p.cols.col2 !== undefined) {
                        p.cols.col3 = p.cols.col2;
                        delete p.cols.col2;
                    }
                });
            }

            if (!trip.pointsModelVersion || trip.pointsModelVersion < 5) {
                (trip.planPoints || []).forEach(p => { if (p.baseCardId === undefined) p.baseCardId = null; });
            }

            trip.pointsModelVersion = 5;
            return true;
        }


        window.openPointCategoryCreator = function(onCreate) {
            window.closeStrayPointPanels();
            const trip = activeTripObj();
            const existing = allPointCategories(trip).map(c => c.title.toLowerCase());
            const bd = document.createElement('div');
            bd.className = 'chooser-backdrop';
            bd.innerHTML = `<div class="chooser-card" role="dialog" aria-modal="true">
                <h3>Nowa kategoria punktów</h3>
                <p class="sub">Uzupełnij pola, aby dodać kategorię.</p>
                <form class="tab-creator" autocomplete="off">
                    <label class="tc-field"><span>Nazwa grupy</span><input type="text" name="title" maxlength="24" placeholder="np. Plaże" required></label>
                    <label class="tc-field"><span>Forma pojedyncza</span><input type="text" name="singular" maxlength="24" placeholder="np. Plaża"></label>
                    <label class="tc-field"><span>Forma biernika do „Dodaj …"</span><input type="text" name="addLabel" maxlength="24" placeholder="np. plażę"></label>
                    <div class="cc-cols" id="cc-cols">
                        <label class="tc-field cc-col-row"><span>Kolumna 1</span><input type="text" name="col0" maxlength="20"></label>
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm cc-col-add" id="cc-col-add">Dodaj kolumnę</button>
                    <div class="tc-row">
                        <label class="tc-field tc-emoji-field"><span>Emotka</span><input type="text" name="emoji" maxlength="4" placeholder="🏖️" required></label>
                        <label class="tc-field tc-color-field"><span>Kolor</span><input type="color" name="color" value="#0891b2"></label>
                        <div class="tc-preview"><span class="tc-prev-chip"><span class="tc-prev-emoji">🏖️</span><span class="tc-prev-name">Kategoria</span></span></div>
                    </div>
                    <p class="tc-error" hidden></p>
                    <div class="tc-actions">
                        <button type="button" class="btn btn-secondary btn-sm" data-cancel>Anuluj</button>
                        <button type="submit" class="btn btn-primary btn-sm" data-submit disabled>Dodaj kategorię</button>
                    </div>
                </form>
            </div>`;
            const form = bd.querySelector('form');
            const colsWrap = form.querySelector('#cc-cols');
            const addColBtn = form.querySelector('#cc-col-add');
            const MAX_COLS = 8;

            function renumberCols() {
                Array.from(colsWrap.children).forEach((label, i) => {
                    const span = label.querySelector('span');
                    if (span) span.textContent = 'Kolumna ' + (i + 1);
                });
                addColBtn.disabled = colsWrap.children.length >= MAX_COLS;
            }
            function addColField() {
                if (colsWrap.children.length >= MAX_COLS) return;
                const label = document.createElement('label');
                label.className = 'tc-field cc-col-row';
                label.innerHTML = `<span></span><input type="text" name="col${colsWrap.children.length}" maxlength="20"><button type="button" class="cc-col-remove" aria-label="Usuń kolumnę">×</button>`;
                colsWrap.appendChild(label);
                label.querySelector('.cc-col-remove').addEventListener('click', () => { label.remove(); renumberCols(); validate(); });
                renumberCols();
                validate();
            }
            addColBtn.addEventListener('click', addColField);
            renumberCols();

            const submit = form.querySelector('[data-submit]');
            const errEl = form.querySelector('.tc-error');
            const prevEmoji = form.querySelector('.tc-prev-emoji');
            const prevName = form.querySelector('.tc-prev-name');
            const prevChip = form.querySelector('.tc-prev-chip');
            const titleInput = form.elements['title'];
            const singularInput = form.elements['singular'];
            const addLabelInput = form.elements['addLabel'];
            const close = () => { bd.remove(); };

            function readColsRaw() { return Array.from(colsWrap.querySelectorAll('input[type="text"]')).map(i => i.value.trim()); }
            function read() {
                const title = titleInput.value.trim();
                return {
                    title,
                    singular: singularInput.value.trim() || title,
                    addLabel: addLabelInput.value.trim() || title,
                    cols: readColsRaw(),
                    emoji: form.elements['emoji'].value.trim(),
                    color: form.elements['color'].value
                };
            }
            function validate() {
                singularInput.placeholder = titleInput.value.trim() || 'np. Plaża';
                const f = read();
                const colsValid = f.cols.length > 0 && f.cols.every(c => c);
                const filled = f.title && colsValid && f.emoji;
                let msg = '';
                if (filled && /['"\\<>]/.test(f.title)) msg = 'Nazwa nie może zawierać znaków \' " \\ < >.';
                else if (filled && existing.includes(f.title.toLowerCase())) msg = 'Kategoria o tej nazwie już istnieje.';
                submit.disabled = !filled || !!msg;
                errEl.hidden = !msg; errEl.textContent = msg;
                prevEmoji.textContent = f.emoji || '📋';
                prevName.textContent = f.title || 'Kategoria';
                const th = themeFromColor(f.color);
                prevChip.style.background = th.soft; prevChip.style.color = th.ink; prevChip.style.borderColor = th.th;
                return f;
            }
            form.addEventListener('input', validate);
            form.querySelector('[data-cancel]').addEventListener('click', close);
            form.addEventListener('submit', e => {
                e.preventDefault();
                const f = validate();
                if (submit.disabled) return;
                const def = { key: 'k_' + generateId(), builtin:false, removable:true, title:f.title, singular:f.singular, addLabel:f.addLabel, emoji:f.emoji, color:f.color, cols:f.cols, countsInStats:false };
                customPointCategories(trip).push(def);
                window.saveTrips();
                close();
                if (typeof onCreate === 'function') onCreate(def);
            });
            document.body.appendChild(bd);
            validate();
            setTimeout(() => titleInput.focus(), 30);
        };

        window.removePointCategory = function(key) {
            const trip = activeTripObj(); if (!trip) return;
            const cat = categoryByKey(trip, key);
            if (cat.builtin) return;
            const count = poolPointsForCategory(trip, key).length;
            const msg = count
                ? `Usunąć kategorię „${cat.title}" razem z ${count} ${count === 1 ? 'punktem' : 'punktami'} (znikną też z mapy)?`
                : `Usunąć kategorię „${cat.title}"?`;
            if (!confirm(msg)) return;
            trip.customPointCategories = customPointCategories(trip).filter(c => c.key !== key);
            trip.planPoints = (trip.planPoints || []).filter(p => p.categoryKey !== key);
            window.saveTrips();
            window.refreshCurrentView();
        };

        // Pola formularza: gdy kategoria mapuje się na tabelę podróży (Atrakcje/Restauracje/Miejscówki/
        // Apartamenty), pola BIORĄ SIĘ z definicji kolumn tej tabeli (window.getMapPointFormFields z
        // trip-tables.js) — więc formularz i tabela mają zawsze te same pola, bez ręcznego tłumaczenia.
        // Dla kategorii bez tabeli (np. 'city') używane są własne `cols`/`colOptions` kategorii.
        function newPointFormFields(categoryKey, cat){
            const tableFields = (typeof window.getMapPointFormFields === 'function') ? window.getMapPointFormFields(categoryKey) : null;
            if(tableFields) return tableFields;
            return (cat.cols || []).map((label, i) => ({ key: 'col' + i, label, options: cat.colOptions && cat.colOptions[i] }));
        }

        function pointFormFieldHtml(field, value, namePrefix){
            const name = namePrefix + field.key;
            if(field.options){
                return `<label class="tc-field"><span>${htmlEsc(field.label)}</span><select name="${name}">${colOptionsHtml(field.options, value)}</select></label>`;
            }
            if(field.type === 'yesno'){
                const v = value == null ? '' : String(value);
                return `<label class="tc-field"><span>${htmlEsc(field.label)}</span><select name="${name}">
                    <option value="" ${v === '' ? 'selected' : ''}>—</option>
                    <option value="tak" ${v === 'tak' ? 'selected' : ''}>Tak</option>
                    <option value="nie" ${v === 'nie' ? 'selected' : ''}>Nie</option>
                </select></label>`;
            }
            if(field.type === 'number'){
                return `<label class="tc-field"><span>${htmlEsc(field.label)}</span><input type="number" step="0.01" min="0" name="${name}" value="${attrEsc(value)}"></label>`;
            }
            return `<label class="tc-field"><span>${htmlEsc(field.label)}</span><input type="text" name="${name}" maxlength="60" value="${attrEsc(value)}"></label>`;
        }

        window.openNewPointModal = function(categoryKey, initialName, onSubmit) {
            window.closeStrayPointPanels();
            const trip = activeTripObj();
            const cat = categoryByKey(trip, categoryKey);
            const fields = newPointFormFields(categoryKey, cat);
            const bd = document.createElement('div');
            bd.className = 'adp-backdrop';
            const colsHtml = fields.map(f => pointFormFieldHtml(f, '', '')).join('');
            bd.innerHTML = `<div class="adp-card" role="dialog" aria-modal="true">
                <div class="adp-head"><h3>Nowy punkt — ${htmlEsc(cat.title)}</h3><button class="qr-close" data-cancel aria-label="Zamknij">×</button></div>
                <form class="pt-edit-form" onsubmit="return false;">
                    <label class="tc-field"><span>Nazwa</span><input type="text" name="name" required value="${attrEsc(initialName || '')}"></label>
                    ${colsHtml}
                    <div class="tc-actions">
                        <button type="button" class="btn btn-secondary btn-sm" data-cancel>Anuluj</button>
                        <button type="button" class="btn btn-primary btn-sm" data-submit>Dodaj punkt</button>
                    </div>
                </form>
            </div>`;
            document.body.appendChild(bd);
            const form = bd.querySelector('form');
            const close = () => { bd.remove(); };
            bd.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', close));
            form.querySelector('[data-submit]').addEventListener('click', () => {
                const name = form.elements['name'].value.trim();
                if (!name) return;
                const cols = {};
                fields.forEach(f => { cols[f.key] = form.elements[f.key].value; });
                close();
                onSubmit({ name, cols });
            });
            setTimeout(() => form.elements['name'].focus(), 30);
        };

        function pointFieldsHtml(cat, point) {
            const fields = newPointFormFields(point.categoryKey, cat);
            const cols = point.cols || {};
            const items = fields.map(f => {
                const val = cols[f.key];
                if (val == null || String(val).trim() === '') return '';
                const display = f.type === 'yesno' ? (val === 'tak' ? 'Tak' : val === 'nie' ? 'Nie' : val) : val;
                return `<div class="pt-field"><span class="pt-field-label">${htmlEsc(f.label)}</span><span class="pt-field-value">${htmlEsc(display)}</span></div>`;
            }).join('');
            return items ? `<div class="pt-fields">${items}</div>` : '';
        }

        function pointDetailHtml(point) {
            const trip = activeTripObj();
            const cat = categoryByKey(trip, point.categoryKey);

            const kindBadge = `<span class="pt-kind-badge">${cat.emoji} ${htmlEsc(cat.singular || cat.title)}</span>`;
            const noCoordsBadge = (!point.coords || point.coords.length !== 2)
                ? `<span class="pt-kind-badge" style="--cat:#94a3b8;">Brak lokalizacji</span>` : '';

            const fieldsHtml = pointFieldsHtml(cat, point);

            return `<div class="pt-card" style="--cat:${cat.color};" data-point-id="${point.id}">
                <div class="pt-head">
                    <span class="pt-name">${htmlEsc(point.name)}</span>
                    <button class="pt-close" onclick="closePointPanelFromBtn(this)" aria-label="Zamknij">×</button>
                </div>
                <div class="pt-badges">${kindBadge}${noCoordsBadge}</div>
                ${fieldsHtml}
                <div class="pt-actions">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="openPointEditFromPanel(this)">✏️ Edytuj</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="deletePointFromPanel(this)">Usuń</button>
                </div>
            </div>`;
        }

        function pointEditHtml(point) {
            const trip = activeTripObj();
            const cat = categoryByKey(trip, point.categoryKey);
            const cols = point.cols || {};
            const fields = newPointFormFields(point.categoryKey, cat);
            const colsHtml = fields.map(f => pointFormFieldHtml(f, cols[f.key], 'pt-col-')).join('');

            return `<div class="pt-card" style="--cat:${cat.color};" data-point-id="${point.id}">
                <div class="pt-head">
                    <span class="pt-name">Edycja</span>
                    <button class="pt-close" onclick="cancelPointEditFromPanel(this)" aria-label="Zamknij">×</button>
                </div>
                <form class="pt-edit-form" onsubmit="return false;">
                    <label class="tc-field"><span>Nazwa</span><input type="text" name="pt-name" value="${attrEsc(point.name)}" required></label>
                    ${colsHtml}
                    <div class="pt-actions">
                        <button type="button" class="btn btn-primary btn-sm" onclick="savePointEditFromPanel(this)">Zapisz</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="cancelPointEditFromPanel(this)">Anuluj</button>
                    </div>
                </form>
            </div>`;
        }

        function pointPanelCtxFromEl(el) {
            const card = el.closest('.pt-card');
            if (!card) return null;
            return { pointId: card.dataset.pointId };
        }

        function resolvePanelObjects(ctx) {
            const trip = activeTripObj(); if (!trip) return null;
            const point = (trip.planPoints || []).find(p => p.id === ctx.pointId) || null;
            if (!point) return null;
            return { trip, point };
        }

        function swapPointPanelContent(el, html) {
            const card = el.closest('.pt-card'); if (!card) return;
            const temp = document.createElement('div'); temp.innerHTML = html;
            const fresh = temp.firstElementChild;
            card.replaceWith(fresh);
        }

        function closeAnyPointPanel(el) {
            const floating = el.closest('.pt-floating');
            if (floating) { if (floating._close) floating._close(); else floating.remove(); return; }
            if (typeof planMapInstance !== 'undefined' && planMapInstance) { try { planMapInstance.closePopup(); } catch (e) {} }
        }

        window.closePointPanelFromBtn = function(btn) { closeAnyPointPanel(btn); };

        window.closeStrayPointPanels = function() {
            const floating = document.querySelector('.pt-floating');
            if (floating) { if (floating._close) floating._close(); else floating.remove(); }
        };

        window.deletePointFromPanel = function(btn) {
            const ctx = pointPanelCtxFromEl(btn); if (!ctx) return;
            const res = resolvePanelObjects(ctx); if (!res) return;
            const { trip, point } = res;
            const CAT_TO_TABLE = { attraction:'atrakcje', restaurant:'restauracje', place:'miejscowki', apartment:'apartamenty' };
            const rowBacked = !!CAT_TO_TABLE[point.categoryKey];
            if (rowBacked) {
                if (!confirm('Usunąć pin z mapy? Wiersz w tabeli zostanie zachowany.')) return;
                point.coords = null;
                window.saveTrips();
                if (typeof planMapRefresh === 'function') planMapRefresh();
                closeAnyPointPanel(btn);
                window.refreshCurrentView();
                return;
            }
            if (!confirm('Usunąć ten punkt? Zniknie z mapy, z tabeli i z planów dni, w których był użyty.')) return;
            trip.planPoints = (trip.planPoints || []).filter(p => p.id !== point.id);
            window.saveTrips();
            if (typeof planMapRefresh === 'function') planMapRefresh();
            closeAnyPointPanel(btn);
            window.refreshCurrentView();
        };

        window.openPointEditFromPanel = function(btn) {
            const ctx = pointPanelCtxFromEl(btn); if (!ctx) return;
            const res = resolvePanelObjects(ctx); if (!res) return;
            swapPointPanelContent(btn, pointEditHtml(res.point));
        };

        window.cancelPointEditFromPanel = function(btn) {
            const ctx = pointPanelCtxFromEl(btn); if (!ctx) return;
            const res = resolvePanelObjects(ctx); if (!res) return;
            swapPointPanelContent(btn, pointDetailHtml(res.point));
        };

        window.savePointEditFromPanel = function(btn) {
            const form = btn.closest('.pt-edit-form');
            const ctx = pointPanelCtxFromEl(btn); if (!ctx) return;
            const res = resolvePanelObjects(ctx); if (!res) return;
            const { trip, point } = res;
            const cat = categoryByKey(trip, point.categoryKey);
            const nameInput = form.querySelector('[name="pt-name"]');
            const newName = nameInput ? nameInput.value.trim() : '';
            if (!newName) return;

            point.name = newName;
            if (!point.cols) point.cols = {};
            newPointFormFields(point.categoryKey, cat).forEach(f => {
                const inp = form.querySelector(`[name="pt-col-${f.key}"]`);
                if (inp) point.cols[f.key] = inp.value;
            });
            window.saveTrips();
            if (typeof planMapRefresh === 'function') planMapRefresh();
            swapPointPanelContent(btn, pointDetailHtml(point));
            window.refreshCurrentView();
        };

        window.deletePoolPoint = function(id) {
            const trip = activeTripObj(); if (!trip) return;
            const point = (trip.planPoints || []).find(p => p.id === id);
            const CAT_TO_TABLE = { attraction:'atrakcje', restaurant:'restauracje', place:'miejscowki', apartment:'apartamenty' };
            const rowBacked = point && !!CAT_TO_TABLE[point.categoryKey];
            if (rowBacked) {
                if (!confirm('Usunąć pin z mapy? Wiersz w tabeli zostanie zachowany.')) return;
                point.coords = null;
                window.saveTrips();
                if (typeof planMapRefresh === 'function') planMapRefresh();
                window.refreshCurrentView();
                return;
            }
            if (!confirm('Usunąć ten punkt? Zniknie z mapy, z tabeli i z planów dni, w których był użyty.')) return;
            trip.planPoints = (trip.planPoints || []).filter(p => p.id !== id);
            window.saveTrips();
            if (typeof planMapRefresh === 'function') planMapRefresh();
            window.refreshCurrentView();
        };
        window.savePointEdit = window.savePointEditFromPanel;

        const PT_FLOATING_GAP = 14;
        function positionFloatingPanel(pop, anchorEl) {
            const r = anchorEl.getBoundingClientRect();
            const pw = pop.offsetWidth || 300;
            const ph = pop.offsetHeight || 200;
            const viewportRight = window.scrollX + window.innerWidth;
            const spaceRight = viewportRight - (r.right + window.scrollX);
            const placeLeft = spaceRight < pw + PT_FLOATING_GAP + 8 && (r.left + window.scrollX) > pw + PT_FLOATING_GAP + 8;

            let left = placeLeft ? (r.left + window.scrollX - PT_FLOATING_GAP - pw) : (r.right + window.scrollX + PT_FLOATING_GAP);
            left = Math.max(8 + window.scrollX, Math.min(left, viewportRight - pw - 8));

            let top = r.top + window.scrollY + r.height / 2 - ph / 2;
            top = Math.max(8 + window.scrollY, Math.min(top, window.scrollY + window.innerHeight - ph - 8));

            pop.style.left = left + 'px';
            pop.style.top = top + 'px';
            pop.classList.toggle('pt-floating-left', placeLeft);

            const arrow = pop.querySelector('.pt-arrow');
            if (arrow) {
                const anchorMidY = r.top + window.scrollY + r.height / 2;
                const arrowTop = Math.max(16, Math.min(ph - 16, anchorMidY - top));
                arrow.style.top = arrowTop + 'px';
            }
        }

        window.openPointDetailPanel = function(point, ctx, anchorEl) {
            const existing = document.querySelector('.pt-floating');
            if (existing) { const wasSame = existing._anchor === anchorEl; existing._close(); if (wasSame) return; }
            const pop = document.createElement('div');
            pop.className = 'pt-floating';
            pop.innerHTML = `<div class="pt-arrow"></div>${pointDetailHtml(point)}`;
            document.body.appendChild(pop);
            pop._anchor = anchorEl;
            positionFloatingPanel(pop, anchorEl);
            pop._close = () => { pop.remove(); };
        };
