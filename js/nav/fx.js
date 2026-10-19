(function(){
  const CURRENCIES = ['EUR','PLN','USD','GBP','CHF','CZK','HUF','SEK','NOK','DKK','JPY','TRY','RON','BGN','HRK'];
  const PREF_KEY = 'plannerFxPrefs';
  const RATE_CACHE_KEY = 'plannerFxRates';
  const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const DEFAULT_PREFS = { from: 'EUR', to: 'PLN', amount: 100 };

  const $ = id => document.getElementById(id);

  function loadPrefs(){
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if(!raw) return { ...DEFAULT_PREFS };
      const p = JSON.parse(raw);
      return {
        from: CURRENCIES.includes(p.from) ? p.from : DEFAULT_PREFS.from,
        to: CURRENCIES.includes(p.to) ? p.to : DEFAULT_PREFS.to,
        amount: Number.isFinite(Number(p.amount)) ? Number(p.amount) : DEFAULT_PREFS.amount
      };
    } catch(e){ return { ...DEFAULT_PREFS }; }
  }

  function savePrefs(prefs){
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch(e){}
  }

  function loadCache(base){
    try {
      const raw = localStorage.getItem(RATE_CACHE_KEY + ':' + base);
      if(!raw) return null;
      const entry = JSON.parse(raw);
      if(Date.now() - entry.ts > CACHE_TTL_MS) return null;
      return entry;
    } catch(e){ return null; }
  }

  function saveCache(base, rates, date, source){
    try {
      localStorage.setItem(RATE_CACHE_KEY + ':' + base, JSON.stringify({ ts: Date.now(), rates, date, base, source }));
    } catch(e){}
  }

  async function fetchFromFrankfurter(base){
    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if(!data || !data.rates) throw new Error('brak danych');
    return { rates: { ...data.rates, [base]: 1 }, date: data.date || null, source: 'Frankfurter (ECB)' };
  }

  async function fetchFromErApi(base){
    const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if(!data || !data.rates) throw new Error('brak danych');
    const dateStr = data.time_last_update_utc ? new Date(data.time_last_update_utc).toISOString().slice(0, 10) : null;
    return { rates: { ...data.rates, [base]: 1 }, date: dateStr, source: 'open.er-api.com' };
  }

  async function fetchRates(base){
    const cached = loadCache(base);
    if(cached) return cached;
    let result;
    try {
      result = await fetchFromFrankfurter(base);
    } catch(primaryErr){
      try {
        result = await fetchFromErApi(base);
      } catch(fallbackErr){
        throw new Error(primaryErr.message + ' / fallback: ' + fallbackErr.message);
      }
    }
    const entry = { ts: Date.now(), rates: result.rates, date: result.date, base, source: result.source };
    saveCache(base, entry.rates, entry.date, entry.source);
    return entry;
  }

  function populateSelect(sel, selected){
    if(!sel) return;
    sel.innerHTML = CURRENCIES.map(c => `<option value="${c}"${c === selected ? ' selected' : ''}>${c}</option>`).join('');
  }

  function formatAmount(n, currency){
    if(!Number.isFinite(n)) return '—';
    try {
      return n.toLocaleString('pl-PL', { style: 'currency', currency, maximumFractionDigits: 2 });
    } catch(e){
      return n.toLocaleString('pl-PL', { maximumFractionDigits: 2 }) + ' ' + currency;
    }
  }

  function statusText(entry){
    const src = (entry && entry.source) || 'Frankfurter (ECB)';
    if(!entry || !entry.date) return `Źródło: ${src}.`;
    return `Kurs z ${entry.date} · źródło: ${src}.`;
  }

  let convertToken = 0;

  function createController(ids){
    async function convert(){
      const amountEl = $(ids.amount);
      const fromEl = $(ids.from);
      const toEl = $(ids.to);
      const outEl = $(ids.resultAmount);
      const metaEl = $(ids.resultMeta);
      if(!amountEl || !fromEl || !toEl) return;

      const amount = Number(amountEl.value);
      const from = fromEl.value;
      const to = toEl.value;
      savePrefs({ from, to, amount });

      if(!Number.isFinite(amount) || amount < 0){
        if(outEl) outEl.textContent = '—';
        if(metaEl) metaEl.textContent = 'Podaj nieujemną kwotę.';
        return;
      }
      if(from === to){
        if(outEl) outEl.textContent = formatAmount(amount, to);
        if(metaEl) metaEl.textContent = 'Ta sama waluta — kurs 1,00.';
        return;
      }

      const myToken = ++convertToken;
      if(metaEl) metaEl.textContent = 'Pobieram kurs…';
      if(outEl) outEl.textContent = '…';
      try {
        const entry = await fetchRates(from);
        if(myToken !== convertToken) return;
        const rate = entry.rates[to];
        if(!Number.isFinite(rate)) throw new Error('brak pary ' + from + '→' + to);
        const converted = amount * rate;
        if(outEl) outEl.textContent = formatAmount(converted, to);
        if(metaEl){
          const rateFmt = rate.toLocaleString('pl-PL', { maximumFractionDigits: 4 });
          metaEl.textContent = `1 ${from} = ${rateFmt} ${to} · ${statusText(entry)}`;
        }
      } catch(err){
        if(myToken !== convertToken) return;
        if(outEl) outEl.textContent = '—';
        if(metaEl) metaEl.textContent = 'Nie udało się pobrać kursu (' + (err.message || 'błąd sieci') + ').';
      }
    }

    function swap(){
      const fromEl = $(ids.from);
      const toEl = $(ids.to);
      if(!fromEl || !toEl) return;
      const a = fromEl.value;
      fromEl.value = toEl.value;
      toEl.value = a;
      convert();
    }

    function hydrate(){
      const fromEl = $(ids.from);
      const toEl = $(ids.to);
      if(!fromEl || !toEl) return;
      const prefs = loadPrefs();
      populateSelect(fromEl, prefs.from);
      populateSelect(toEl, prefs.to);
      const amountEl = $(ids.amount);
      if(amountEl && amountEl.value === '') amountEl.value = prefs.amount;
      convert();
    }

    return { convert, swap, hydrate };
  }

  const toolsController = createController({
    amount: 'tools-fx-amount',
    from: 'tools-fx-from',
    to: 'tools-fx-to',
    resultAmount: 'tools-fx-result-amount',
    resultMeta: 'tools-fx-result-meta'
  });

  window.runFxConvert = toolsController.convert;
  window.swapFxCurrencies = toolsController.swap;

  function hydrateTools(){
    const amountEl = $('tools-fx-amount');
    if(amountEl){
      const prefs = loadPrefs();
      if(Number(amountEl.value) === 100 && prefs.amount !== 100) amountEl.value = prefs.amount;
    }
    toolsController.hydrate();
  }

  // ── Popover kantoru dla tabelek (Research / Podróż) ──────────────────────
  let popoverEl = null;
  let popoverController = null;
  let popoverAnchorBtn = null;

  function buildPopover(){
    const el = document.createElement('div');
    el.className = 'fx-popover';
    el.id = 'fx-popover';
    el.innerHTML = `
      <div class="fx-popover-head">
        <span class="fx-popover-title">Kantor</span>
        <button type="button" class="fx-popover-close" aria-label="Zamknij">×</button>
      </div>
      <div class="tools-fx-panel">
        <form class="tools-fx-form" onsubmit="event.preventDefault();">
          <div class="tools-fx-row">
            <label class="tools-fx-field">
              <span class="tools-fx-label">Kwota</span>
              <input type="number" step="0.01" min="0" id="fxpop-amount" class="tools-input tools-fx-input" value="100">
            </label>
            <label class="tools-fx-field">
              <span class="tools-fx-label">Z</span>
              <select id="fxpop-from" class="tools-input tools-fx-select"></select>
            </label>
            <button type="button" class="tools-fx-swap" id="fxpop-swap" aria-label="Zamień waluty miejscami">⇄</button>
            <label class="tools-fx-field">
              <span class="tools-fx-label">Na</span>
              <select id="fxpop-to" class="tools-input tools-fx-select"></select>
            </label>
          </div>
        </form>
        <div class="tools-fx-result" aria-live="polite">
          <span class="tools-fx-result-amount" id="fxpop-result-amount">—</span>
          <span class="tools-fx-result-meta" id="fxpop-result-meta">Ładuję kurs…</span>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    const controller = createController({
      amount: 'fxpop-amount',
      from: 'fxpop-from',
      to: 'fxpop-to',
      resultAmount: 'fxpop-result-amount',
      resultMeta: 'fxpop-result-meta'
    });

    el.querySelector('.fx-popover-close').addEventListener('click', closeFxPopover);
    $('fxpop-amount').addEventListener('input', controller.convert);
    $('fxpop-from').addEventListener('change', controller.convert);
    $('fxpop-to').addEventListener('change', controller.convert);
    $('fxpop-swap').addEventListener('click', controller.swap);

    return { el, controller };
  }

  function positionPopover(el, btn){
    const margin = 12;
    const rect = btn.getBoundingClientRect();
    const width = el.offsetWidth || 340;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    let top = rect.bottom + 8;
    const height = el.offsetHeight || 160;
    if(top + height > window.innerHeight - margin){
      top = Math.max(margin, rect.top - 8 - height);
    }
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  function handleOutsideClick(e){
    if(!popoverEl) return;
    if(popoverEl.contains(e.target)) return;
    if(popoverAnchorBtn && popoverAnchorBtn.contains(e.target)) return;
    closeFxPopover();
  }

  function handleEscape(e){
    if(e.key === 'Escape') closeFxPopover();
  }

  function handleReposition(){
    if(popoverEl && popoverEl.classList.contains('open') && popoverAnchorBtn){
      positionPopover(popoverEl, popoverAnchorBtn);
    }
  }

  function closeFxPopover(){
    if(popoverEl) popoverEl.classList.remove('open');
    popoverAnchorBtn = null;
    document.removeEventListener('mousedown', handleOutsideClick, true);
    document.removeEventListener('keydown', handleEscape, true);
    window.removeEventListener('resize', handleReposition);
    window.removeEventListener('scroll', handleReposition, true);
  }

  window.toggleFxPopover = function(btn){
    if(!popoverEl){
      const built = buildPopover();
      popoverEl = built.el;
      popoverController = built.controller;
    }
    if(popoverEl.classList.contains('open') && popoverAnchorBtn === btn){
      closeFxPopover();
      return;
    }
    popoverAnchorBtn = btn;
    const prefs = loadPrefs();
    populateSelect($('fxpop-from'), prefs.from);
    populateSelect($('fxpop-to'), prefs.to);
    const amountEl = $('fxpop-amount');
    if(amountEl) amountEl.value = prefs.amount;

    popoverEl.classList.add('open');
    positionPopover(popoverEl, btn);
    popoverController.convert();

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('keydown', handleEscape, true);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', hydrateTools);
  } else {
    hydrateTools();
  }
})();
