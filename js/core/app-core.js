        window.trips = [];

        window.globalBaseData = { folders: [], cardsList: [] };

        window.research = [];

        let currentActiveTripId = null;

        let originTab = 'list';


        function generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        }


        window.showMainTab = function(tabName) {

            if (typeof window.closeStrayPointPanels === 'function') window.closeStrayPointPanels();

            const mainTabs = ['home', 'add', 'list', 'archive', 'stats', 'tools', 'research'];
            if (mainTabs.includes(tabName)) {
                currentActiveTripId = null;
            }

            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            const target = document.getElementById(`${tabName}-tab`);
            if(target) target.classList.add('active');
            
            const homeBtn = document.getElementById('btn-back-home');
            if(tabName === 'home') homeBtn.style.display = 'none';
            else homeBtn.style.display = 'flex';

            window.refreshCurrentView();

            try {
                sessionStorage.setItem('plannerLastView', JSON.stringify({ tab: tabName, tripId: currentActiveTripId, originTab }));
            } catch (e) {}
        }

        window.restoreLastView = function() {
            if (typeof window.consumeTodayShortcut === 'function' && window.consumeTodayShortcut()) return true;
            let saved = null;
            try { saved = JSON.parse(sessionStorage.getItem('plannerLastView') || 'null'); } catch (e) {}
            if (!saved || !saved.tab || saved.tab === 'home') return false;

            if (saved.tab === 'board-plan') {
                if (typeof window.openTripBoard !== 'function' || !(window.trips || []).some(t => t.id === saved.tripId)) return false;
                window.openTripBoard(saved.tripId, saved.originTab || 'list');
                return true;
            }

            const mainTabs = ['add', 'list', 'archive', 'stats', 'tools', 'research'];
            if (mainTabs.includes(saved.tab)) {
                window.showMainTab(saved.tab);
                return true;
            }
            return false;
        };


        window.refreshCurrentView = function() {
            const activeTab = document.querySelector('.tab-content.active');
            if (!activeTab) return;
            const tabId = activeTab.id.replace('-tab', '');
            if (tabId === 'home' && typeof window.renderHomeToday === 'function') window.renderHomeToday();
            if (tabId === 'list') renderTrips();
            if (tabId === 'archive') renderArchive();
            if (tabId === 'stats') { buildMapAddControls(); buildMapFilterControls(); initStatsMap(); }
            if (tabId === 'board-plan') {
                const panel = (function(){ try { return localStorage.getItem('plannerTripViewPanel') || 'tables'; } catch(e){ return 'tables'; } })();
                if (typeof window.setTripViewPanel === 'function') window.setTripViewPanel(panel);
                else if (typeof renderPlanCards === 'function' && panel === 'plan') renderPlanCards();
            }
            if (tabId === 'research' && typeof window.renderResearch === 'function') window.renderResearch();        }


        function formatDate(dateStr) { return new Date(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }); }

        function calculateDays(start, end) { return Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1; }

        function getTypeEmoji() { return ''; }

        function getTransportEmoji() { return ''; }


        function attrEsc(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }

        function htmlEsc(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

        window.openTypeChooser = function(title, sub, options, onPick) {
            const bd = document.createElement('div');
            bd.className = 'chooser-backdrop';
            bd.innerHTML = `<div class="chooser-card" role="dialog" aria-modal="true">
                <button type="button" class="qr-close chooser-close" data-cancel aria-label="Zamknij">×</button>
                <h3>${htmlEsc(title)}</h3><p class="sub">${htmlEsc(sub)}</p>
                <div class="chooser-grid">${options.map((o,i)=>`<button class="chooser-opt" data-i="${i}" style="--th:${o.th};--th-soft:${o.soft};--th-ink:${o.ink};"><span class="co-emoji">${o.emoji}</span>${htmlEsc(o.label)}</button>`).join('')}</div>
            </div>`;
            const close = () => { bd.remove(); };
            bd.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', close));
            bd.querySelectorAll('.chooser-opt').forEach(btn => btn.addEventListener('click', () => { const o = options[+btn.dataset.i]; close(); onPick(o.key); }));
            document.body.appendChild(bd);
        };


        window.openListTabCreator = function(scope, onCreate){
            const existing = (scope === 'trip' ? allTripTypes() : glAllTypes()).map(t => t.key);
            const wantsCols = scope === 'trip';
            const bd = document.createElement('div');
            bd.className = 'chooser-backdrop';
            bd.innerHTML = `<div class="chooser-card" role="dialog" aria-modal="true">
                <h3>Nowa zakładka listy</h3>
                <p class="sub">Uzupełnij wszystkie pola, aby dodać zakładkę.</p>
                <form class="tab-creator" autocomplete="off">
                    <label class="tc-field"><span>Tytuł zakładki</span><input type="text" name="title" maxlength="24" placeholder="np. Plaże" required></label>
                    ${wantsCols ? `<div class="tc-cols">
                        <label class="tc-field"><span>Kolumna 1</span><input type="text" name="c0" maxlength="20" required></label>
                        <label class="tc-field"><span>Kolumna 2</span><input type="text" name="c1" maxlength="20" required></label>
                        <label class="tc-field"><span>Kolumna 3</span><input type="text" name="c2" maxlength="20" required></label>
                        <label class="tc-field"><span>Kolumna 4</span><input type="text" name="c3" maxlength="20" required></label>
                    </div>` : ''}
                    <div class="tc-row">
                        <label class="tc-field tc-emoji-field"><span>Główna emotka</span><input type="text" name="emoji" maxlength="4" placeholder="📋" required></label>
                        <label class="tc-field tc-color-field"><span>Kolor</span><input type="color" name="color" value="#2a6496"></label>
                        <div class="tc-preview"><span class="tc-prev-chip"><span class="tc-prev-emoji">📋</span><span class="tc-prev-name">Zakładka</span></span></div>
                    </div>
                    <p class="tc-error" hidden></p>
                    <div class="tc-actions">
                        <button type="button" class="btn btn-secondary btn-sm" data-cancel>Anuluj</button>
                        <button type="submit" class="btn btn-primary btn-sm" data-submit disabled>Dodaj zakładkę</button>
                    </div>
                </form>
            </div>`;
            const form = bd.querySelector('form');
            const val = n => form.elements[n].value;
            const submit = form.querySelector('[data-submit]');
            const errEl = form.querySelector('.tc-error');
            const prevEmoji = form.querySelector('.tc-prev-emoji');
            const prevName = form.querySelector('.tc-prev-name');
            const prevChip = form.querySelector('.tc-prev-chip');
            const close = () => { bd.remove(); };
            const read = () => ({
                title: val('title').trim(),
                cols: wantsCols ? [val('c0').trim(), val('c1').trim(), val('c2').trim(), val('c3').trim()] : [],
                emoji: val('emoji').trim(),
                color: val('color')
            });
            const validate = () => {
                const f = read();
                const filled = f.title && (!wantsCols || f.cols.every(c => c)) && f.emoji;
                let msg = '';
                if (filled && /['"\\<>]/.test(f.title)) msg = 'Tytuł nie może zawierać znaków \' " \\ < >.';
                else if (filled && existing.some(k => k.toLowerCase() === f.title.toLowerCase())) msg = 'Zakładka o tej nazwie już istnieje.';
                submit.disabled = !filled || !!msg;
                errEl.hidden = !msg; errEl.textContent = msg;
                prevEmoji.textContent = f.emoji || '📋';
                prevName.textContent = f.title || 'Zakładka';
                const th = themeFromColor(f.color);
                prevChip.style.background = th.soft; prevChip.style.color = th.ink; prevChip.style.borderColor = th.th;
                return f;
            };
            form.addEventListener('input', validate);
            form.querySelector('[data-cancel]').addEventListener('click', close);
            form.addEventListener('submit', e => {
                e.preventDefault();
                const f = validate();
                if (submit.disabled) return;
                const def = Object.assign({ key: f.title, emoji: f.emoji, cols: f.cols, custom: true }, themeFromColor(f.color));
                close(); onCreate(def);
            });
            document.body.appendChild(bd);
            validate();
            setTimeout(() => form.elements['title'].focus(), 30);
        };

        function themeFromColor(hex){
            const m = String(hex || '#2a6496').replace('#','');
            let r = 42, g = 100, b = 150;
            if (/^[0-9a-fA-F]{6}$/.test(m)) { r = parseInt(m.slice(0,2),16); g = parseInt(m.slice(2,4),16); b = parseInt(m.slice(4,6),16); }
            return { th: `#${m}`, soft: `rgba(${r},${g},${b},0.13)`, ink: `#${m}` };
        }

        function activeTripObj(){ return window.trips.find(t => t.id === currentActiveTripId); }
