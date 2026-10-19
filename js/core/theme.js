// Motyw jasny/ciemny. Ładowany synchronicznie w <head>, żeby ustawić data-theme przed
// pierwszym malowaniem (bez mignięcia jasnego motywu). Wybór pamiętany per urządzenie.
(function(){
  const KEY = 'plannerTheme';
  const THEME_COLORS = { light: '#0f6e6a', dark: '#1c1917' };

  function load(){
    try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch(e){ return 'light'; }
  }

  function apply(theme){
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content', THEME_COLORS[theme]);
    const btn = document.getElementById('btn-theme');
    if(btn){
      const dark = theme === 'dark';
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.setAttribute('aria-label', dark ? 'Włącz jasny motyw' : 'Włącz ciemny motyw');
      btn.title = dark ? 'Jasny motyw' : 'Ciemny motyw';
    }
  }

  window.toggleTheme = function(){
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch(e){}
    apply(next);
  };

  apply(load());
  document.addEventListener('DOMContentLoaded', () => apply(load()));
})();
