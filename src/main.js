// Amélioration progressive : tout le contenu est lisible sans ce fichier.
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // « Réduire les animations » : seulement l'image fixe du logo, sans télécharger la vidéo
  if (reduced) document.querySelector('.logo-spin')?.remove();

  // Menu mobile
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('menu');
  const setMenu = (open) => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? toggle.dataset.close : toggle.dataset.open;
  };
  toggle?.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav?.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

  // Vidéo du bandeau : pause/lecture, et pas de lecture auto si « réduire les animations »
  const heroVideo = document.querySelector('.hero-video');
  const heroToggle = document.querySelector('.hero-toggle');
  if (heroVideo && heroToggle) {
    const sync = () => {
      const paused = heroVideo.paused;
      heroToggle.setAttribute('aria-pressed', String(paused));
      heroToggle.setAttribute('aria-label', paused ? heroToggle.dataset.play : heroToggle.dataset.pause);
      heroToggle.firstElementChild.textContent = paused ? '▶' : '❚❚';
    };
    if (reduced) heroVideo.pause();
    heroVideo.addEventListener('play', sync);
    heroVideo.addEventListener('pause', sync);
    heroToggle.addEventListener('click', () => (heroVideo.paused ? heroVideo.play() : heroVideo.pause()));
    // Si le fichier vidéo manque, on garde le fond dégradé.
    heroVideo.addEventListener('error', () => { heroVideo.remove(); heroToggle.remove(); }, true);
    sync();
  }

  // Défilement fluide (Lenis) synchronisé avec GSAP ScrollTrigger
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1 });
    if (window.gsap && window.ScrollTrigger) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add((time) => lenis.raf(time * 1000));
      window.gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  // « Nous contacter ↓ » et le lien Contact du menu défilent jusqu'au formulaire
  document.querySelectorAll('[data-scroll-contact]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const target = document.getElementById('contact');
      if (!target) return; // autre page : on suit le lien vers l'accueil
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -64 });
      else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      history.replaceState(null, '', '#contact');
      setTimeout(() => target.querySelector('input:not([type=hidden])')?.focus({ preventScroll: true }), reduced ? 0 : 900);
    });
  });

  // Apparitions au défilement : fade-in .8s cubic-bezier(.16,1,.3,1)
  if (!reduced && window.gsap && window.ScrollTrigger) {
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    const ease = 'expo.out';
    gsap.set('[data-reveal]', { opacity: 0, y: 24 });
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 90%',
      once: true,
      onEnter: (els) => {
        els.forEach((el) => el.classList.add('is-visible'));
        gsap.to(els, { opacity: 1, y: 0, duration: 0.8, ease, stagger: 0.08, overwrite: true });
      },
    });
  }

  // Formulaire Netlify : envoi sans recharger la page (sans JS, POST classique vers /merci/)
  document.querySelectorAll('form[data-netlify]').forEach((form) => {
    const status = form.querySelector('.form-status');
    const button = form.querySelector('button[type=submit]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const label = button.textContent;
      button.disabled = true;
      button.textContent = form.dataset.sending;
      status.className = 'form-status';
      try {
        const res = await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form)).toString(),
        });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        status.textContent = form.dataset.success;
        status.classList.add('ok');
      } catch {
        status.textContent = form.dataset.error;
        status.classList.add('err');
      } finally {
        button.disabled = false;
        button.textContent = label;
      }
    });
  });

  if (reduced || !window.gsap) document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));

  // Caméra qui se démonte (Services) : sur ordi, la vidéo suit le défilement ;
  // sur mobile ou avec « réduire les animations », simple lecture en boucle.
  // Rien n'est téléchargé avant que la section approche de l'écran.
  const scrub = document.querySelector('[data-scrub]');
  const camVideo = scrub?.querySelector('video');
  if (scrub && camVideo) {
    const desktop = window.matchMedia('(min-width: 768px)');
    let near = false;
    let mode = null;
    let target = 0;
    let shown = 0;
    let ticking = false;

    const progress = () => {
      const r = scrub.getBoundingClientRect();
      const run = r.height - window.innerHeight;
      return run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 0;
    };
    const step = () => {
      ticking = false;
      const d = camVideo.duration;
      if (mode !== 'scrub' || !d) return;
      target = progress() * (d - 0.05);
      shown += (target - shown) * 0.25;
      if (Math.abs(target - shown) < 0.01) shown = target;
      if (Math.abs(camVideo.currentTime - shown) > 0.005) camVideo.currentTime = shown;
      if (shown !== target) request();
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(step); } };

    const apply = () => {
      const next = desktop.matches && !reduced ? 'scrub' : 'loop';
      if (next !== mode) {
        mode = next;
        scrub.classList.toggle('is-scrub', mode === 'scrub');
        camVideo.loop = mode === 'loop';
        camVideo.autoplay = mode === 'loop';
        if (mode === 'scrub') camVideo.pause();
      }
      if (!near) return;
      if (camVideo.preload !== 'auto') { camVideo.preload = 'auto'; camVideo.load(); }
      if (mode === 'loop') camVideo.play().catch(() => {});
      else request();
    };

    // Après le chargement de la page, pour ne pas lui voler de bande passante
    const watch = () => new IntersectionObserver((entries) => {
      near = entries[0].isIntersecting;
      if (near) apply();
      else if (mode === 'loop') camVideo.pause();
    }, { rootMargin: '50% 0px' }).observe(scrub);
    if (document.readyState === 'complete') watch();
    else window.addEventListener('load', watch, { once: true });

    window.addEventListener('scroll', () => { if (mode === 'scrub' && near) request(); }, { passive: true });
    camVideo.addEventListener('loadedmetadata', () => { shown = progress() * camVideo.duration; request(); });
    desktop.addEventListener('change', apply);
    apply();
  }

  // Lightbox vidéo (l'iframe YouTube n'est chargé qu'à l'ouverture)
  const dialog = document.querySelector('.lightbox');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const frame = dialog.querySelector('.lightbox-frame');
  const missing = dialog.querySelector('.lightbox-missing');
  let opener = null;

  const close = () => dialog.close();
  dialog.addEventListener('close', () => {
    frame.replaceChildren();
    lenis?.start();
    opener?.focus();
  });
  dialog.querySelector('.lightbox-close').addEventListener('click', close);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });

  document.querySelectorAll('[data-video]').forEach((tile) => {
    tile.addEventListener('click', (e) => {
      e.preventDefault();
      opener = tile;
      const id = tile.dataset.video;
      frame.classList.toggle('vertical', tile.dataset.vertical === '1');
      frame.replaceChildren();
      missing.hidden = Boolean(id);
      if (id) {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
        iframe.title = tile.getAttribute('aria-label') || 'Vidéo';
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        iframe.allowFullscreen = true;
        frame.append(iframe);
      }
      lenis?.stop();
      dialog.showModal();
    });
  });
})();
