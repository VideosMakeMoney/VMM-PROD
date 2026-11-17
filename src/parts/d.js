// Partie D (JD, courriel du 2026-11-15, modifications #3 et #4) : carrousels mobiles, version française seulement.
// Accueil écran 2 et Portfolio écran 2 (4 catégories), Portfolio écran 3 (logos des entreprises).
// Amélioration progressive : sans JavaScript, la grille actuelle reste (vignettes, titres et liens dans le HTML).
// Le JavaScript ajoute les flèches ‹ ›, les points et le titre de la vignette sélectionnée ; la mise en carrousel
// n'existe qu'en CSS sous 900 px (src/parts/d.css). Sur ordinateur, ces ajouts sont masqués et rien ne change.
// Boucle : la vignette 1 a ses deux voisines visibles, comme sur les maquettes de JD.
(() => {
  if (!/^fr/i.test(document.documentElement.lang)) return;
  const mq = window.matchMedia('(max-width: 899px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LISTS = [
    { sel: '.home-portfolio .hp-cards', kind: 'cats', nom: 'Catégories' },
    { sel: '.pf-cats .pf-cat-grid', kind: 'cats', nom: 'Catégories' },
    { sel: '.pf-honneur .logo-grid', kind: 'logos', nom: 'Entreprises' },
  ];
  const chevron = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;

  LISTS.forEach(({ sel, kind, nom }) => {
    const list = document.querySelector(sel);
    if (!list) return;
    const items = [...list.children].filter((li) => li.tagName === 'LI');
    const n = items.length;
    if (n < 2) return;
    const labelOf = (li) => (li.querySelector('.yt-tile-label')?.textContent || '').trim();

    // Structure : [‹ liste ›], points, titre (catégories) ou nom + nombre + « Cliquez pour visionner » (logos)
    const wrap = document.createElement('div');
    wrap.className = `jd-car jd-car-${kind}`;
    list.before(wrap);
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'jd-car-arrow is-prev';
    prev.setAttribute('aria-label', 'Précédent');
    prev.innerHTML = chevron('m15 18-6-6 6-6');
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'jd-car-arrow is-next';
    next.setAttribute('aria-label', 'Suivant');
    next.innerHTML = chevron('m9 18 6-6-6-6');
    wrap.append(prev, list, next);
    list.classList.add('jd-car-list');
    if (!list.id) list.id = `jd-car-${kind}-${Math.random().toString(36).slice(2, 7)}`;
    prev.setAttribute('aria-controls', list.id);
    next.setAttribute('aria-controls', list.id);

    const dots = document.createElement('div');
    dots.className = 'jd-car-dots';
    const dotBtns = items.map((li, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'jd-car-dot';
      const name = kind === 'logos' ? (li.querySelector('.logo-btn-text strong')?.textContent || '').trim() : labelOf(li);
      b.setAttribute('aria-label', `${name || `Élément ${i + 1}`} (${i + 1} sur ${n})`);
      b.setAttribute('aria-controls', list.id);
      b.addEventListener('click', () => show(i));
      dots.append(b);
      return b;
    });
    const info = document.createElement('div');
    info.className = 'jd-car-info';
    info.setAttribute('aria-live', 'polite');
    wrap.after(dots, info);

    let current = 0;
    const pos = (i) => {
      let d = (i - current + n) % n;
      if (d > n / 2) d -= n;
      return d;
    };
    const active = () => mq.matches;
    const show = (i, focusLink = false) => {
      current = (i + n) % n;
      items.forEach((li, k) => {
        const d = pos(k);
        li.dataset.carPos = String(Math.max(-2, Math.min(2, d)));
        const on = d === 0;
        li.classList.toggle('is-current', on);
        if (active()) {
          li.setAttribute('aria-hidden', on ? 'false' : 'true');
          li.querySelectorAll('a, button').forEach((el) => (on ? el.removeAttribute('tabindex') : el.setAttribute('tabindex', '-1')));
        }
      });
      dotBtns.forEach((b, k) => (k === current ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
      const li = items[current];
      if (kind === 'logos') {
        const txt = li.querySelector('.logo-btn-text');
        info.innerHTML = txt ? txt.innerHTML : '';
      } else {
        info.innerHTML = '';
        const p = document.createElement('p');
        p.className = 'jd-car-title';
        p.textContent = labelOf(li);
        info.append(p);
      }
      if (focusLink) li.querySelector('a')?.focus({ preventScroll: true });
    };
    const go = (dir) => show(current + dir);
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));

    // Clavier : ← → quand la liste (ou la vignette centrale) a le focus
    list.addEventListener('keydown', (e) => {
      if (!active()) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const inLink = e.target !== list;
        go(e.key === 'ArrowRight' ? 1 : -1);
        if (inLink) items[current].querySelector('a')?.focus({ preventScroll: true });
      }
    });

    // Glissement (doigt ou souris) : 40 px à l'horizontale ; le défilement vertical de la page reste libre (touch-action: pan-y)
    let x0 = null, y0 = 0, swiped = false;
    list.addEventListener('pointerdown', (e) => {
      if (!active() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      x0 = e.clientX; y0 = e.clientY; swiped = false;
    });
    list.addEventListener('pointermove', (e) => {
      if (x0 === null || swiped) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) { swiped = true; x0 = null; go(dx < 0 ? 1 : -1); }
    });
    const end = () => { x0 = null; };
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);
    list.addEventListener('dragstart', (e) => { if (active()) e.preventDefault(); });
    // Un glissement n'ouvre pas la vidéo ; un toucher sur une voisine la fait venir au centre
    list.addEventListener('click', (e) => {
      if (!active()) return;
      if (swiped) { e.preventDefault(); e.stopPropagation(); swiped = false; return; }
      const li = e.target.closest('li');
      if (li && items.includes(li) && !li.classList.contains('is-current')) { e.preventDefault(); e.stopPropagation(); show(items.indexOf(li)); }
    }, true);

    // Accessibilité selon l'écran : sur ordinateur, la liste reprend son comportement d'origine
    const sync = () => {
      if (active()) {
        list.setAttribute('tabindex', '0');
        list.setAttribute('aria-roledescription', 'carrousel');
        list.setAttribute('aria-label', nom);
        show(current);
      } else {
        list.removeAttribute('tabindex');
        list.removeAttribute('aria-roledescription');
        list.removeAttribute('aria-label');
        items.forEach((li) => { li.removeAttribute('aria-hidden'); li.querySelectorAll('[tabindex="-1"]').forEach((el) => el.removeAttribute('tabindex')); });
      }
    };
    mq.addEventListener('change', sync);
    sync();
    show(0);
    if (reduced) wrap.classList.add('is-reduced');
  });
})();
