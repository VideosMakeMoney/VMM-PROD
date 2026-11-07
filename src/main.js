// Amélioration progressive : tout le contenu est lisible sans ce fichier.
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    // Le poster s'affiche d'abord ; la vidéo (une seule version : mobile ou ordi) est ajoutée après le chargement
    // de la page. Avec « réduire les animations », elle n'est jamais téléchargée et le poster reste.
    const loadHero = () => {
      if (reduced) { heroToggle.remove(); return; }
      const kind = window.matchMedia('(max-width: 767px)').matches ? 'heroMobile' : 'heroOrdi';
      let list = [];
      try { list = JSON.parse(heroVideo.dataset[kind] || '[]'); } catch {}
      heroVideo.replaceChildren(...list.map(({ src, type }) => Object.assign(document.createElement('source'), { src, type })));
      heroVideo.preload = 'auto';
      heroVideo.addEventListener('playing', () => heroVideo.classList.add('is-playing'), { once: true });
      heroVideo.load();
      heroVideo.play().catch(() => sync());
    };
    if (document.readyState === 'complete') loadHero();
    else window.addEventListener('load', loadHero, { once: true });
    heroVideo.addEventListener('play', sync);
    heroVideo.addEventListener('pause', sync);
    heroToggle.addEventListener('click', () => (heroVideo.paused ? heroVideo.play() : heroVideo.pause()));
    // Si le fichier vidéo manque, on garde le fond dégradé.
    heroVideo.addEventListener('error', () => { heroVideo.remove(); heroToggle.remove(); }, true);
    sync();
  }

  let lenis = null;

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

  // Animations (GSAP, ScrollTrigger, Lenis) : chargées seulement après l'affichage de la page, pour ne pas retarder
  // l'image principale (LCP). Ce qui est déjà à l'écran à ce moment-là reste affiché tel quel ; le reste apparaît au défilement.
  const showAll = () => document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
  const loadScript = (src) => new Promise((ok, ko) => document.head.append(Object.assign(document.createElement('script'), { src, onload: ok, onerror: ko })));
  const startMotion = () => {
    const vendor = '/vendor/';
    Promise.all([loadScript(`${vendor}gsap.min.js`), loadScript(`${vendor}lenis.min.js`)])
      .then(() => loadScript(`${vendor}ScrollTrigger.min.js`))
      .then(() => {
        if (window.Lenis) {
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
        if (!window.gsap || !window.ScrollTrigger) return showAll();
        const { gsap, ScrollTrigger } = window;
        gsap.registerPlugin(ScrollTrigger);
        const ease = 'expo.out';
        // Déjà à l'écran : affiché sans animation (pas de disparition puis réapparition)
        const inView = (el) => el.getBoundingClientRect().top < window.innerHeight;
        document.querySelectorAll('[data-reveal]').forEach((el) => { if (inView(el)) el.classList.add('is-visible'); });
        // Services et À propos (maquettes de JD) : 20 px, 600 ms, léger décalage entre les cartes
        const jd = gsap.utils.toArray('.jd-screen [data-reveal]').filter((el) => !el.classList.contains('is-visible'));
        const other = gsap.utils.toArray('[data-reveal]:not(.jd-screen [data-reveal])').filter((el) => !el.classList.contains('is-visible'));
        if (other.length) gsap.set(other, { opacity: 0, y: 24 });
        if (jd.length) gsap.set(jd, { opacity: 0, y: 20 });
        if (jd.length) ScrollTrigger.batch(jd, {
          start: 'top 90%',
          once: true,
          onEnter: (els) => {
            els.forEach((el) => el.classList.add('is-visible'));
            gsap.to(els, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.12, overwrite: true });
          },
        });
        if (other.length) ScrollTrigger.batch(other, {
          start: 'top 90%',
          once: true,
          onEnter: (els) => {
            els.forEach((el) => el.classList.add('is-visible'));
            gsap.to(els, { opacity: 1, y: 0, duration: 0.8, ease, stagger: 0.08, overwrite: true });
          },
        });
      })
      .catch(showAll);
  };
  if (reduced) showAll();
  else {
    const later = () => ('requestIdleCallback' in window ? requestIdleCallback(startMotion, { timeout: 1500 }) : setTimeout(startMotion, 200));
    if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });
  }

  // Clips de fond de JD : chaque appareil ne télécharge que sa version (mobile ou ordi), seulement quand la
  // section approche ; avec « réduire les animations », le poster reste seul et rien n'est téléchargé.
  const bgVideos = document.querySelectorAll('[data-bg-video]');
  // Bouton pause des bandeaux plein écran (Services, À propos) : la vidéo reste arrêtée jusqu'au prochain clic
  document.querySelectorAll('[data-bg-toggle]').forEach((btn) => {
    const box = btn.parentElement.querySelector('[data-bg-video]');
    if (!box) return btn.remove();
    if (reduced) return btn.remove(); // poster seul : rien à mettre en pause
    const sync = () => {
      const paused = box.dataset.paused === '1';
      btn.setAttribute('aria-pressed', String(paused));
      btn.setAttribute('aria-label', paused ? btn.dataset.play : btn.dataset.pause);
      btn.firstElementChild.textContent = paused ? '▶' : '❚❚';
    };
    btn.addEventListener('click', () => {
      const paused = box.dataset.paused !== '1';
      box.dataset.paused = paused ? '1' : '';
      box.querySelectorAll('video').forEach((v) => (paused ? v.pause() : v.play().catch(() => {})));
      sync();
    });
    sync();
  });
  const wide = window.matchMedia('(min-width: 768px)');
  // Le bon poster pour l'appareil, même quand la vidéo n'est jamais chargée
  const bgPosters = () => bgVideos.forEach((box) => { box.querySelector('.bg-video-media').poster = box.dataset[`${wide.matches ? 'ordi' : 'mobile'}Poster`]; });
  bgPosters();
  if (reduced) wide.addEventListener('change', bgPosters);
  if (bgVideos.length && !reduced) {
    const sourcesOf = (box, kind) => [
      Object.assign(document.createElement('source'), { src: box.dataset[`${kind}Webm`], type: 'video/webm' }),
      Object.assign(document.createElement('source'), { src: box.dataset[`${kind}Mp4`], type: 'video/mp4' }),
    ];
    // Fond flou (clip 9:16 sur ordi) : la même vidéo, chargée seulement sur ordi et calée sur le clip net
    const blurOf = (box) => (wide.matches ? box.querySelector('.bg-video-blur') : null);
    const setup = (box) => {
      const video = box.querySelector('.bg-video-media');
      const kind = wide.matches ? 'ordi' : 'mobile';
      if (box.dataset.loaded === kind) return;
      box.dataset.loaded = kind;
      video.poster = box.dataset[`${kind}Poster`];
      video.replaceChildren(...sourcesOf(box, kind));
      video.load();
      video.preload = 'auto';
      const blur = blurOf(box);
      if (blur && !blur.dataset.loaded) {
        blur.dataset.loaded = '1';
        blur.replaceChildren(...sourcesOf(box, kind));
        blur.load();
        blur.preload = 'auto';
        const sync = () => { if (Math.abs(blur.currentTime - video.currentTime) > 0.25) blur.currentTime = video.currentTime; };
        video.addEventListener('playing', sync);
        video.addEventListener('seeked', sync);
        video.addEventListener('timeupdate', sync);
      }
    };
    const play = (box) => box.dataset.paused !== '1' && [box.querySelector('.bg-video-media'), blurOf(box)].forEach((v) => v?.play().catch(() => {}));
    const pause = (box) => box.querySelectorAll('video').forEach((v) => v.pause());
    const io = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) { setup(target); play(target); }
        else if (target.dataset.loaded) pause(target);
      });
    }, { rootMargin: '50% 0px' });
    const start = () => bgVideos.forEach((box) => io.observe(box));
    // Services et Portfolio : aucune vidéo (webm/mp4) n'est téléchargée au chargement de la page ; le poster
    // s'affiche et le clip ne se charge qu'au premier défilement (ou toucher, clic, touche du clavier).
    const onScroll = /\bpage-(services|portfolio)\b/.test(document.body.className);
    const afterInteraction = () => {
      const events = ['scroll', 'wheel', 'touchstart', 'pointerdown', 'keydown'];
      const go = () => { events.forEach((e) => window.removeEventListener(e, go)); start(); };
      events.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));
    };
    const begin = onScroll ? afterInteraction : start;
    if (document.readyState === 'complete') begin();
    else window.addEventListener('load', begin, { once: true });
    // Passage mobile ↔ ordi : on recharge seulement les clips déjà commencés
    wide.addEventListener('change', () => bgVideos.forEach((box) => {
      if (!box.dataset.loaded) return;
      setup(box);
      if (!wide.matches) box.querySelector('.bg-video-blur')?.pause();
      play(box);
    }));
  }

  // Caméra qui se démonte (Services) : sur ordi, la vidéo « scroll » suit exactement le défilement
  // (pas de lecture auto) ; sur mobile ou avec « réduire les animations », la boucle joue toute seule.
  // Rien n'est téléchargé avant que la section approche de l'écran.
  const scrub = document.querySelector('[data-scrub]');
  const camVideo = scrub?.querySelector('video');
  if (scrub && camVideo) {
    // Deux vidéos : « scroll » (ordi, suit le défilement) et la boucle (mobile, animations réduites)
    const [webmSource, mp4Source] = camVideo.querySelectorAll('source');
    const sources = {
      loop: [webmSource.getAttribute('src'), mp4Source.getAttribute('src')],
      scrub: [camVideo.dataset.scrollWebm, camVideo.dataset.scrollMp4],
    };
    let loaded = null;
    const desktop = window.matchMedia('(min-width: 768px)');
    let near = false;
    let mode = null;
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
      // Position de la vidéo = position du défilement (0 % assemblée, 100 % démontée)
      const target = progress() * (d - 0.04);
      if (Math.abs(camVideo.currentTime - target) > 0.005) camVideo.currentTime = target;
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(step); } };

    const apply = () => {
      const next = desktop.matches && !reduced ? 'scrub' : 'loop';
      if (next !== mode) {
        mode = next;
        scrub.classList.toggle('is-scrub', mode === 'scrub');
        camVideo.loop = mode === 'loop';
        camVideo.autoplay = mode === 'loop';
        if (mode === 'scrub' && !camVideo.paused) camVideo.pause();
      }
      if (!near) return;
      if (loaded !== mode) {
        loaded = mode;
        [webmSource.src, mp4Source.src] = sources[mode];
        // preload après load() : sinon le navigateur commence par télécharger l'ancienne source
        camVideo.load();
        camVideo.preload = 'auto';
      }
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
    camVideo.addEventListener('loadedmetadata', request);
    // Si un seek est en cours, la dernière position demandée est rattrapée dès qu'il se termine
    camVideo.addEventListener('seeked', () => { if (mode === 'scrub') request(); });
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

// Bibliothèque des pages client et Coulisses : flèches ‹ › qui avancent d'une miniature, compteur « 01 / N ».
(() => {
  document.querySelectorAll('[data-library]').forEach((row) => {
    const track = row.querySelector('.library-track');
    const prev = row.querySelector('[data-library-prev]');
    const next = row.querySelector('[data-library-next]');
    if (!track || !prev || !next) return;
    const count = row.parentElement.querySelector('[data-library-count]');
    const index = count?.querySelector('[data-library-index]');
    const sr = count?.querySelector('[data-library-sr]');
    const items = () => [...track.children];
    const itemStep = () => {
      const [a, b] = items();
      return a && b ? b.offsetLeft - a.offsetLeft : Math.max(track.clientWidth, 160);
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const go = (dir) => track.scrollBy({ left: dir * itemStep(), behavior: reduced ? 'auto' : 'smooth' });
    const update = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
      row.classList.toggle('is-static', max <= 0);
      if (count) {
        const total = Number(count.dataset.total) || items().length;
        const i = Math.min(total, Math.round(track.scrollLeft / (itemStep() || 1)) + 1);
        index.textContent = String(i).padStart(2, '0');
        sr.textContent = count.dataset.label.replace('{i}', i).replace('{n}', total);
      }
    };
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });
})();
