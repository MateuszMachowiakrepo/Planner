(function(){
  // Ściągawka „O kraju" — wspólny formularz dla tablicy researchu i podróży.
  // Dane trzymane w obj.countryInfo = { pole: tekst }.

  const FACTS = [
    { key: 'kraj',       label: 'Kraj',                 ph: 'np. Portugalia' },
    { key: 'waluta',     label: 'Waluta',               ph: 'np. EUR' },
    { key: 'jezyk',      label: 'Język',                ph: 'np. portugalski, angielski OK' },
    { key: 'czas',       label: 'Strefa czasowa',       ph: 'np. −1h względem Polski' },
    { key: 'gniazdka',   label: 'Gniazdka / napięcie',  ph: 'np. typ F, 230V' },
    { key: 'alarm',      label: 'Numer alarmowy',       ph: 'np. 112' },
    { key: 'ruch',       label: 'Ruch drogowy',         ph: 'np. prawostronny' },
    { key: 'dokumenty',  label: 'Dokumenty / wiza',     ph: 'np. dowód osobisty wystarczy' },
    { key: 'platnosci',  label: 'Płatności',            ph: 'np. karta prawie wszędzie' },
    { key: 'napiwki',    label: 'Napiwki',              ph: 'np. 5–10%, nieobowiązkowe' },
    { key: 'woda',       label: 'Woda z kranu',         ph: 'np. pitna' },
    { key: 'internet',   label: 'Internet / roaming',   ph: 'np. roaming UE' }
  ];

  const NOTES = [
    { key: 'jedzenie',       label: 'Jedzenie',                 ph: 'Co warto zjeść, lokalne specjały, godziny posiłków…' },
    { key: 'ludzie',         label: 'Ludzie i kultura',         ph: 'Jacy są mieszkańcy, nastawienie do turystów, styl życia…' },
    { key: 'zwyczaje',       label: 'Zwyczaje — czego unikać',  ph: 'Savoir-vivre, ubiór w świątyniach, gesty, tematy tabu…' },
    { key: 'bezpieczenstwo', label: 'Bezpieczeństwo',           ph: 'Kieszonkowcy, oszustwa na turystów, rejony do omijania…' },
    { key: 'transport',      label: 'Transport na miejscu',     ph: 'Metro, bilety, taxi/Uber, wynajem auta…' },
    { key: 'ceny',           label: 'Ceny',                     ph: 'Kawa, obiad, bilet komunikacji, piwo…' },
    { key: 'zwroty',         label: 'Przydatne zwroty',         ph: 'Dzień dobry, dziękuję, ile kosztuje…' },
    { key: 'inne',           label: 'Inne notatki',             ph: '' }
  ];

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function autosize(ta){
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 2 + 'px';
  }

  // container: element lub id; getObj: funkcja zwracająca aktualny obiekt (tablica/podróż); save: zapis
  window.renderCountrySheet = function(container, getObj, save){
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    const obj = getObj();
    if(!el || !obj) return;
    const info = obj.countryInfo || {};

    el.innerHTML = `<div class="country-sheet">
      <section class="country-section">
        <h3 class="country-section-title">Najważniejsze</h3>
        <div class="country-facts">
          ${FACTS.map(f => `<label class="country-field">
            <span class="country-label">${f.label}</span>
            <input type="text" class="tools-input" data-key="${f.key}" value="${esc(info[f.key])}" placeholder="${esc(f.ph)}" autocomplete="off">
          </label>`).join('')}
        </div>
      </section>
      <section class="country-section">
        <h3 class="country-section-title">Opis</h3>
        <div class="country-notes">
          ${NOTES.map(n => `<label class="country-field">
            <span class="country-label">${n.label}</span>
            <textarea class="tools-input country-textarea" data-key="${n.key}" rows="3" placeholder="${esc(n.ph)}">${esc(info[n.key])}</textarea>
          </label>`).join('')}
        </div>
      </section>
    </div>`;

    el.querySelectorAll('.country-textarea').forEach(autosize);
    el.oninput = function(e){
      const key = e.target && e.target.dataset ? e.target.dataset.key : null;
      if(!key) return;
      const o = getObj();
      if(!o) return;
      o.countryInfo = o.countryInfo || {};
      o.countryInfo[key] = e.target.value;
      if(e.target.tagName === 'TEXTAREA') autosize(e.target);
      if(typeof save === 'function') save();
    };
  };
})();
