(function(){
  const STORAGE_KEY = 'plannerCalendarSource';
  const input = () => document.getElementById('tools-cal-input');
  const embed = () => document.getElementById('tools-cal-embed');
  const modal = () => document.getElementById('tools-cal-modal');
  const status = () => document.getElementById('tools-cal-status');

  function buildEmbedSrc(raw){
    const val = (raw || '').trim();
    if(!val) return null;
    const tz = 'Europe%2FWarsaw';
    const toEmbed = (src) => `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(src)}&ctz=${tz}`;
    if(/^https?:\/\//i.test(val)){
      try {
        const u = new URL(val);
        if(/(^|\.)google\.com$/i.test(u.hostname) && /\/calendar\//i.test(u.pathname)){
          if(/\/calendar\/embed/i.test(u.pathname)) return val;
          const srcParam = u.searchParams.get('src');
          if(srcParam) return toEmbed(srcParam);
          const cid = u.searchParams.get('cid');
          if(cid){
            let decoded = cid;
            try { decoded = atob(cid.replace(/-/g,'+').replace(/_/g,'/')); } catch(e){}
            return toEmbed(decoded);
          }
        }
        return val;
      } catch(e){ return val; }
    }
    return toEmbed(val);
  }

  function renderEmbed(src){
    const box = embed();
    if(!box) return;
    if(!src){ box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = `<iframe src="${src}" style="border:0;width:100%;height:100%;min-height:420px;border-radius:6px" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
  }

  function readSaved(){
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch(e){ return ''; }
  }

  function syncStatus(){
    const s = status();
    if(!s) return;
    const hasSaved = !!readSaved();
    if(hasSaved){ s.textContent = 'Zapisany'; s.setAttribute('data-status', 'draft'); }
    else { s.textContent = 'Do konfiguracji'; s.setAttribute('data-status', 'setup'); }
  }

  function onKeydown(e){
    if(e.key === 'Escape') window.closeCalendarModal();
  }

  window.openCalendarModal = function(){
    const m = modal();
    if(!m) return;
    const saved = readSaved();
    const i = input();
    if(i && !i.value) i.value = saved;
    renderEmbed(buildEmbedSrc(saved));
    m.hidden = false;
    document.body.classList.add('tools-cal-modal-open');
    document.addEventListener('keydown', onKeydown);
  };

  window.openCalendarInNewWindow = window.openCalendarModal;

  window.closeCalendarModal = function(){
    const m = modal();
    if(!m) return;
    m.hidden = true;
    document.body.classList.remove('tools-cal-modal-open');
    document.removeEventListener('keydown', onKeydown);
  };

  window.saveCalendarSource = function(raw){
    const src = buildEmbedSrc(raw);
    try { localStorage.setItem(STORAGE_KEY, (raw || '').trim()); } catch(e){}
    renderEmbed(src);
    syncStatus();
  };

  window.clearCalendarSource = function(){
    try { localStorage.removeItem(STORAGE_KEY); } catch(e){}
    const i = input();
    if(i) i.value = '';
    renderEmbed(null);
    syncStatus();
  };

  function hydrate(){
    syncStatus();
    const btn = document.getElementById('tools-cal-toggle');
    if(btn){
      btn.onclick = null;
      btn.addEventListener('click', window.openCalendarModal);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }

})();
