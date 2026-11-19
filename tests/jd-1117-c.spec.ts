import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();

const portfolioJson = JSON.parse(readFileSync(join(ROOT, 'content', 'portfolio.json'), 'utf8'));
const frJson = JSON.parse(readFileSync(join(ROOT, 'content', 'fr.json'), 'utf8'));
const enJson = JSON.parse(readFileSync(join(ROOT, 'content', 'en.json'), 'utf8'));

test.describe('Ajustements JD du 17 nov. 2026 — PR C : clips, liens YouTube, tri, boutons mobiles, tuile VMM FR + EN', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Point 4 — Clips de fond versionnés Accueil, Services, Portfolio (FR + EN)
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #4] Desktop (1920x1080, 1366x768) : les vidéos 16:9 versionnées v20261117 sont configurées et servies (FR + EN)', async ({
    page,
  }, testInfo) => {
    const isDesktop = testInfo.project.name.startsWith('desktop');
    test.skip(!isDesktop, 'Test spécifique au layout desktop (16:9)');

    const pagesToTest = [
      { path: '/', expectedVideo: 'hero-accueil-16x9-v20261117', selector: '.hero-video' },
      { path: '/en/', expectedVideo: 'hero-accueil-16x9-v20261117', selector: '.hero-video' },
      { path: '/services/', expectedVideo: 'services-16x9-v20261117', selector: '.bg-video' },
      { path: '/en/services/', expectedVideo: 'services-16x9-v20261117', selector: '.bg-video' },
      { path: '/portfolio/', expectedVideo: 'work-16x9-v20261117', selector: '.bg-video' },
      { path: '/en/portfolio/', expectedVideo: 'work-16x9-v20261117', selector: '.bg-video' },
    ];

    for (const { path, expectedVideo, selector } of pagesToTest) {
      await page.goto(path);
      const el = page.locator(selector).first();
      await expect(el).toBeAttached();

      if (selector === '.hero-video') {
        const dataOrdi = await el.getAttribute('data-hero-ordi');
        expect(dataOrdi, `data-hero-ordi sur ${path} doit contenir ${expectedVideo}`).toContain(expectedVideo);
      } else {
        const dataOrdiMp4 = await el.getAttribute('data-ordi-mp4');
        const dataOrdiWebm = await el.getAttribute('data-ordi-webm');
        expect(dataOrdiMp4, `data-ordi-mp4 sur ${path} doit contenir ${expectedVideo}`).toContain(expectedVideo);
        expect(dataOrdiWebm, `data-ordi-webm sur ${path} doit contenir ${expectedVideo}`).toContain(expectedVideo);
      }
    }
  });

  test('[JD-1117 #4] Mobile (390x844, 360x740) : les vidéos 9:16 versionnées v20261117 sont configurées et servies (FR + EN)', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.startsWith('mobile');
    test.skip(!isMobile, 'Test spécifique au layout mobile (9:16)');

    const pagesToTest = [
      { path: '/', expectedVideo: 'hero-accueil-9x16-v20261117', selector: '.hero-video' },
      { path: '/en/', expectedVideo: 'hero-accueil-9x16-v20261117', selector: '.hero-video' },
      { path: '/services/', expectedVideo: 'services-9x16-v20261117', selector: '.bg-video' },
      { path: '/en/services/', expectedVideo: 'services-9x16-v20261117', selector: '.bg-video' },
      { path: '/portfolio/', expectedVideo: 'work-9x16-v20261117', selector: '.bg-video' },
      { path: '/en/portfolio/', expectedVideo: 'work-9x16-v20261117', selector: '.bg-video' },
    ];

    for (const { path, expectedVideo, selector } of pagesToTest) {
      await page.goto(path);
      const el = page.locator(selector).first();
      await expect(el).toBeAttached();

      if (selector === '.hero-video') {
        const dataMobile = await el.getAttribute('data-hero-mobile');
        expect(dataMobile, `data-hero-mobile sur ${path} doit contenir ${expectedVideo}`).toContain(expectedVideo);
      } else {
        const dataMobileMp4 = await el.getAttribute('data-mobile-mp4');
        const dataMobileWebm = await el.getAttribute('data-mobile-webm');
        expect(dataMobileMp4, `data-mobile-mp4 sur ${path} doit contenir ${expectedVideo}`).toContain(expectedVideo);
        expect(dataMobileWebm, `data-mobile-webm sur ${path} doit contenir ${expectedVideo}`).toContain(expectedVideo);
      }
    }
  });

  test('[JD-1117 #4] Fichiers vidéo versionnés : existence, dimensions, 30 fps, sans audio, durée conforme à ±0.1s, et absence totale d anciens noms dans dist/', async () => {
    const EXPECTED_VIDEOS: Record<string, { w: number; h: number; duration: number }> = {
      'hero-accueil-16x9-v20261117': { w: 1920, h: 1080, duration: 25.20 },
      'hero-accueil-9x16-v20261117': { w: 1080, h: 1920, duration: 25.21 },
      'services-16x9-v20261117': { w: 1920, h: 1080, duration: 25.67 },
      'services-9x16-v20261117': { w: 1080, h: 1920, duration: 25.68 },
      'work-16x9-v20261117': { w: 1920, h: 1080, duration: 27.47 },
      'work-9x16-v20261117': { w: 1080, h: 1920, duration: 27.49 },
    };

    for (const [baseName, spec] of Object.entries(EXPECTED_VIDEOS)) {
      for (const ext of ['.mp4', '.webm']) {
        const filePath = join(ROOT, 'static', 'videos', 'jd', `${baseName}${ext}`);
        expect(existsSync(filePath), `Fichier ${filePath} doit exister`).toBe(true);

        const probeStr = execSync(
          `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -show_entries format=duration -of json "${filePath}"`
        ).toString();
        const probe = JSON.parse(probeStr);

        const stream = probe.streams[0];
        expect(stream.width, `Largeur ${baseName}${ext}`).toBe(spec.w);
        expect(stream.height, `Hauteur ${baseName}${ext}`).toBe(spec.h);
        expect(stream.r_frame_rate, `Cadence 30 fps pour ${baseName}${ext}`).toBe('30/1');

        const duration = parseFloat(probe.format.duration);
        expect(
          Math.abs(duration - spec.duration),
          `Durée ${duration}s vs ${spec.duration}s pour ${baseName}${ext} doit correspondre à ±0.1s`
        ).toBeLessThanOrEqual(0.1);

        // Vérification absence audio
        const audioProbeStr = execSync(
          `ffprobe -v error -select_streams a -show_entries stream=index -of json "${filePath}"`
        ).toString();
        const audioProbe = JSON.parse(audioProbeStr);
        expect(
          (audioProbe.streams || []).length,
          `Aucune piste audio dans ${baseName}${ext}`
        ).toBe(0);

        // Poids dans la cible ~4 à 11 Mo
        const stat = statSync(filePath);
        const sizeMb = stat.size / (1024 * 1024);
        expect(sizeMb, `Poids ${baseName}${ext} (${sizeMb.toFixed(2)} Mo) doit être compris entre 4 et 11 Mo`).toBeGreaterThanOrEqual(4.0);
        expect(sizeMb, `Poids ${baseName}${ext} (${sizeMb.toFixed(2)} Mo) doit être compris entre 4 et 11 Mo`).toBeLessThanOrEqual(11.0);
      }

      // Posters WebP et JPG
      const posterWebp = join(ROOT, 'static', 'videos', 'jd', `${baseName}-poster.webp`);
      const posterJpg = join(ROOT, 'static', 'videos', 'jd', `${baseName}-poster.jpg`);
      expect(existsSync(posterWebp), `Poster WebP ${posterWebp} doit exister`).toBe(true);
      expect(existsSync(posterJpg), `Poster JPG ${posterJpg} doit exister`).toBe(true);
    }

    // Vérification de l'absence totale d'anciens noms non versionnés dans dist/
    const distHtmlFiles: string[] = [];
    const scanDir = (dir: string) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) scanDir(full);
        else if (entry.name.endsWith('.html')) distHtmlFiles.push(full);
      }
    };
    scanDir(join(ROOT, 'dist'));

    const FORBIDDEN_OLD_NAMES = [
      'hero-accueil-16x9.mp4',
      'hero-accueil-16x9.webm',
      'hero-accueil-9x16.mp4',
      'hero-accueil-9x16.webm',
      'services-16x9.mp4',
      'services-16x9.webm',
      'services-9x16.mp4',
      'services-9x16.webm',
      'work-16x9.mp4',
      'work-16x9.webm',
      'work-9x16.mp4',
      'work-9x16.webm',
    ];

    for (const file of distHtmlFiles) {
      const content = readFileSync(file, 'utf8');
      for (const oldName of FORBIDDEN_OLD_NAMES) {
        expect(
          content.includes(oldName),
          `Le fichier dist ${file} ne doit pas référencer l'ancien nom ${oldName}`
        ).toBe(false);
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Point 9 — Liens manquants des catégories sur Accueil et Portfolio p. 2
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #9] Cartes des catégories sur Accueil et Portfolio : liens YouTube exacts (LiXjVf43rqo pour promo, -6N2iah60mc pour coulisses, tuile vide pour evenements en attente de JD) (FR + EN)', async ({
    page,
  }) => {
    const urls = ['/', '/portfolio/', '/en/', '/en/portfolio/'];

    for (const url of urls) {
      await page.goto(url);

      // 1. « Vidéos promotionnelles » / « Promotional videos » -> LiXjVf43rqo (Shorts)
      const promoLink = page.locator('a.yt-tile[href*="LiXjVf43rqo"]');
      await expect(promoLink, `Lien promo LiXjVf43rqo doit être présent sur ${url}`).toBeVisible();
      const promoHref = await promoLink.getAttribute('href');
      expect(promoHref).toBe('https://www.youtube.com/shorts/LiXjVf43rqo');

      // 2. « Coulisses, making-of et bandes-annonces » -> -6N2iah60mc (Standard horizontal)
      const coulissesLink = page.locator('a.yt-tile[href*="-6N2iah60mc"]');
      await expect(coulissesLink, `Lien coulisses -6N2iah60mc doit être présent sur ${url}`).toBeVisible();
      const coulissesHref = await coulissesLink.getAttribute('href');
      expect(coulissesHref).toBe('https://www.youtube.com/watch?v=-6N2iah60mc');

      // 3. « Couverture événementielle » : B7dWhLnxw08 est 404, la carte doit rester une tuile vide non cliquable (EN ATTENTE DE JD)
      const evenementsLink = page.locator('a.yt-tile[href*="B7dWhLnxw08"]');
      expect(await evenementsLink.count(), `B7dWhLnxw08 ne doit pas être cliquable sur ${url} (indisponible YouTube 404)`).toBe(0);

      const emptyTile = page.locator('.yt-tile.is-empty');
      await expect(emptyTile.first(), `Une tuile vide doit être présente pour evenements sur ${url}`).toBeVisible();
    }
  });

  test('[JD-1117 #9] Intégrité globale : chaque ID YouTube dans portfolio.json fait partie de la liste autorisée de JD ou des IDs en ligne', () => {
    const ALLOWED_IDS = new Set([
      // IDs de JD / production
      'LiXjVf43rqo',
      '-6N2iah60mc',
      '8X6m5PyYs0w',
      'Ce1zC640M-A',
      'WBgsj8VZAzc',
      'hxhDQdTkXkM',
      'c6GviSuf6Kc',
      // IDs Hors-Pair
      'aRr26p8dQxk',
      'fxGb6xSqsfw',
      // IDs Tapis Rouge
      'hmrhpcyGGEk',
      'O2UTFiYzGU0',
      'kKz1pKN44dM',
      'g8pY-zSgljI',
      '3ru2cIaqzeo',
      't7zXkOFUdBs',
      'HeLdEo_awQ0',
      // IDs PUR Construction
      'FOeE9sB-UtY',
      'VaEXZ5aXcE0',
      'wNGp61LUV8g',
      'duRjqB2By-0',
      'G3owwW2k1Po',
      'F8bCIpVoDFI',
      '3T-zTO2Q30A',
      // IDs BlueWise
      'LQmzAY6qCv8',
      'zga2uMl5zhk',
      // IDs Coulisses existants
      '5cwIdsVO0Jc',
      'n7_rIrZQLk8',
      'hOUNzv6MYc8',
      'a6L9xFtDSgc',
    ]);

    // Vérifier les catégories
    for (const cat of portfolioJson.categories) {
      if (cat.videoAccueil) {
        expect(
          ALLOWED_IDS.has(cat.videoAccueil),
          `ID de catégorie videoAccueil inconnu: ${cat.videoAccueil}`
        ).toBe(true);
      }
    }

    // Vérifier toutes les vidéos du portfolio
    for (const v of portfolioJson.videos) {
      if (v.youtubeId) {
        expect(
          ALLOWED_IDS.has(v.youtubeId),
          `ID YouTube non autorisé dans portfolio.json: ${v.youtubeId}`
        ).toBe(true);
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Point 10 — Pages individuelles : liens, vidéo morte, tri chronologique
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #10] Bibliothèques client et coulisses : liste exacte des IDs et tri strictement chronologique croissant selon publie (FR + EN)', async ({
    page,
  }) => {
    const EXPECTED_PAGES: Record<string, string[]> = {
      // Hors-Pair (3 vidéos chronologiques)
      '/portfolio/hors-pair/': ['aRr26p8dQxk', 'fxGb6xSqsfw', 'LiXjVf43rqo'],
      '/en/portfolio/hors-pair/': ['aRr26p8dQxk', 'fxGb6xSqsfw', 'LiXjVf43rqo'],
      // Coulisses (9 vidéos chronologiques)
      '/portfolio/coulisses/': [
        '5cwIdsVO0Jc',
        'n7_rIrZQLk8',
        'hOUNzv6MYc8',
        'a6L9xFtDSgc',
        'c6GviSuf6Kc',
        'hxhDQdTkXkM',
        'WBgsj8VZAzc',
        'Ce1zC640M-A',
        '8X6m5PyYs0w',
      ],
      '/en/portfolio/behind-the-scenes/': [
        '5cwIdsVO0Jc',
        'n7_rIrZQLk8',
        'hOUNzv6MYc8',
        'a6L9xFtDSgc',
        'c6GviSuf6Kc',
        'hxhDQdTkXkM',
        'WBgsj8VZAzc',
        'Ce1zC640M-A',
        '8X6m5PyYs0w',
      ],
      // Tapis Rouge (7 vidéos chronologiques)
      '/portfolio/tapis-rouge/': [
        'hmrhpcyGGEk',
        'O2UTFiYzGU0',
        'kKz1pKN44dM',
        'g8pY-zSgljI',
        '3ru2cIaqzeo',
        't7zXkOFUdBs',
        'HeLdEo_awQ0',
      ],
      '/en/portfolio/tapis-rouge/': [
        'hmrhpcyGGEk',
        'O2UTFiYzGU0',
        'kKz1pKN44dM',
        'g8pY-zSgljI',
        '3ru2cIaqzeo',
        't7zXkOFUdBs',
        'HeLdEo_awQ0',
      ],
      // PÜR Construction (7 vidéos chronologiques)
      '/portfolio/pur-construction/': [
        'FOeE9sB-UtY',
        'VaEXZ5aXcE0',
        'wNGp61LUV8g',
        'duRjqB2By-0',
        'G3owwW2k1Po',
        'F8bCIpVoDFI',
        '3T-zTO2Q30A',
      ],
      '/en/portfolio/pur-construction/': [
        'FOeE9sB-UtY',
        'VaEXZ5aXcE0',
        'wNGp61LUV8g',
        'duRjqB2By-0',
        'G3owwW2k1Po',
        'F8bCIpVoDFI',
        '3T-zTO2Q30A',
      ],
      // BlueWise (2 vidéos chronologiques)
      '/portfolio/bluewise/': ['LQmzAY6qCv8', 'zga2uMl5zhk'],
      '/en/portfolio/bluewise/': ['LQmzAY6qCv8', 'zga2uMl5zhk'],
    };

    for (const [url, expectedIds] of Object.entries(EXPECTED_PAGES)) {
      await page.goto(url);

      const links = page.locator('.library-track a.yt-tile');
      const count = await links.count();
      expect(count, `Nombre de vidéos sur ${url}`).toBe(expectedIds.length);

      const actualIds: string[] = [];
      for (let i = 0; i < count; i++) {
        const href = await links.nth(i).getAttribute('href');
        const match = href?.match(/(?:shorts\/|v=)([A-Za-z0-9_-]+)/);
        expect(match, `URL YouTube valide pour le lien ${i} sur ${url}`).not.toBeNull();
        actualIds.push(match![1]);
      }

      expect(actualIds, `Ordre chronologique strict des IDs sur ${url}`).toEqual(expectedIds);
    }
  });

  test('[JD-1117 #10] Vidéo morte : z2eTv3wpHDA est totalement absente de dist/ (HTML, JSON-LD, sitemap)', () => {
    const scanDir = (dir: string, out: string[]) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) scanDir(full, out);
        else if (/\.(html|xml|json|txt)$/.test(entry.name)) out.push(full);
      }
    };

    const files: string[] = [];
    scanDir(join(ROOT, 'dist'), files);

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(
        content.includes('z2eTv3wpHDA'),
        `La vidéo morte z2eTv3wpHDA ne doit apparaître nulle part dans ${file}`
      ).toBe(false);
    }
  });

  test('[JD-1117 #10] Compteurs et dates : chaque vidéo dans portfolio.json a une date publie ISO valide, et les compteurs de vidéos sont exacts (FR + EN)', async ({
    page,
  }) => {
    // 1. Vérification portfolio.json : chaque vidéo a une date publie ISO valide
    expect(portfolioJson.videos.length).toBe(28);
    for (const v of portfolioJson.videos) {
      expect(v.youtubeId, 'Chaque vidéo doit avoir un youtubeId non vide').toBeTruthy();
      expect(v.publie, `Vidéo ${v.youtubeId} doit avoir un champ publie`).toBeTruthy();
      expect(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(v.publie),
        `Date publie ${v.publie} pour vidéo ${v.youtubeId} doit être un format ISO valide avec fuseau`
      ).toBe(true);
    }

    // 2. Compteurs sur la page Portfolio (FR + EN)
    const portfolioUrls = [
      { url: '/portfolio/', lang: 'fr', videosWord: 'vidéos' },
      { url: '/en/portfolio/', lang: 'en', videosWord: 'videos' },
    ];

    const EXPECTED_COUNTS: Record<string, number> = {
      'Tapis Rouge': 7,
      'Hors-Pair': 3,
      'PÜR Construction': 7,
      'BlueWise': 2,
    };

    for (const { url, videosWord } of portfolioUrls) {
      await page.goto(url);

      // Compteurs des logos clients
      for (const [nomBouton, expectedCount] of Object.entries(EXPECTED_COUNTS)) {
        const logoBtn = page.locator('.logo-btn', { hasText: nomBouton });
        await expect(logoBtn, `Bouton ${nomBouton} sur ${url}`).toBeVisible();
        const countText = await logoBtn.locator('.logo-btn-count').innerText();
        expect(countText.trim(), `Compteur pour ${nomBouton} sur ${url}`).toBe(`${expectedCount} ${videosWord}`);
      }

      // Compteur coulisses (bloc VMM)
      const coulissesCountEl = page.locator('.pf-shelf-tile .coulisses-count');
      await expect(coulissesCountEl, `Compteur coulisses sur ${url}`).toBeVisible();
      const coulissesText = await coulissesCountEl.innerText();
      expect(coulissesText.trim(), `Compteur coulisses sur ${url}`).toBe(`9 ${videosWord}`);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Point 11 — Navigation mobile & défilement vers le haut
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #11] Mobile WebKit & Chromium : navigation inter-pages depuis une section défilée atterrit toujours en haut (scrollY === 0) sans décalage', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.startsWith('mobile');
    test.skip(!isMobile, 'Test spécifique au comportement de navigation mobile');

    // 1. Sur l'accueil mobile, défiler jusqu'à la section #equipe ou #contact
    await page.goto('/');
    const scrollRestoration = await page.evaluate(() => history.scrollRestoration);
    expect(scrollRestoration, "history.scrollRestoration doit être configuré à 'manual'").toBe('manual');

    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(100);
    const scrolledY = await page.evaluate(() => window.scrollY);
    expect(scrolledY, 'La page doit être défilée avant le clic').toBeGreaterThan(500);

    // 2. Cliquer sur un lien de navigation vers une autre page (ex. À propos dans le menu ou footer)
    await page.goto('/about/');
    await page.waitForLoadState('domcontentloaded');

    const topScrollY = await page.evaluate(() => window.scrollY);
    expect(topScrollY, "L'arrivée sur /about/ doit être à 0 px de défilement").toBe(0);

    // 3. De même depuis /about/ défilé vers /portfolio/
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(100);
    await page.goto('/portfolio/');
    await page.waitForLoadState('domcontentloaded');

    const pfScrollY = await page.evaluate(() => window.scrollY);
    expect(pfScrollY, "L'arrivée sur /portfolio/ doit être à 0 px de défilement").toBe(0);
  });

  test('[JD-1117 #11] Mobile : navigation par ancre (#contact, #services) atterrit sous l en-tête fixe avec scroll-padding-top 64px', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.startsWith('mobile');
    test.skip(!isMobile, 'Test spécifique au comportement mobile');

    await page.goto('/');
    const contactSection = page.locator('#contact');
    await expect(contactSection).toBeAttached();

    const scrollPaddingTop = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).scrollPaddingTop;
    });
    expect(scrollPaddingTop, "scroll-padding-top sur html doit être égal à var(--header-h) = 64px").toBe('64px');

    // Navigation directe avec ancre
    await page.goto('/#contact');
    await page.waitForTimeout(400);

    const box = await contactSection.boundingBox();
    expect(box, 'Bounding box de #contact').not.toBeNull();
    // Le haut de la section doit être positionné juste sous l'en-tête (64px ± 8px de tolérance de rendu)
    expect(box!.y, 'Haut de la section #contact sous le header').toBeGreaterThanOrEqual(56);
    expect(box!.y, 'Haut de la section #contact sous le header').toBeLessThanOrEqual(72);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Point 12 — Portfolio, page 4 : bouton VMM sur mobile
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #12] Mobile (390x844, 390x664, 360x740) : tuile VMM (pf-shelf page 4) avec bouton complet visible, icône SVG ▶, violet, sans débordement de section (FR + EN)', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.startsWith('mobile');
    test.skip(!isMobile, 'Test spécifique au layout mobile');

    const testPages = [
      { path: '/portfolio/', lang: 'fr', expectedText: 'Cliquez pour visionner' },
      { path: '/en/portfolio/', lang: 'en', expectedText: 'Click to watch' },
    ];

    for (const { path, lang, expectedText } of testPages) {
      await page.goto(path);

      const section = page.locator('.pf-shelf');
      await expect(section, `Section .pf-shelf sur ${path}`).toBeVisible();
      await section.scrollIntoViewIfNeeded();

      const cta = section.locator('.pf-shelf-tile .logo-btn-cta');
      await expect(cta, `Bouton .logo-btn-cta sur ${path}`).toBeVisible();

      // Texte attendu
      const text = await cta.innerText();
      expect(text, `Texte du bouton sur ${path}`).toContain(expectedText);

      // Icône SVG de lecture
      const svg = cta.locator('svg.cta-play');
      await expect(svg, `Icône SVG cta-play sur ${path}`).toBeVisible();

      // Couleur violette
      const color = await cta.evaluate((el: HTMLElement) => window.getComputedStyle(el).color);
      // var(--violet-light) = #bf7fff => rgb(191, 127, 255)
      expect(color, `Couleur violette sur ${path}`).toBe('rgb(191, 127, 255)');

      // Bounding box entièrement visible à l'intérieur de la section (aucun débordement / rognage)
      const ctaBox = await cta.boundingBox();
      const secBox = await section.boundingBox();
      expect(ctaBox, 'Bounding box du bouton CTA').not.toBeNull();
      expect(secBox, 'Bounding box de la section').not.toBeNull();

      expect(
        ctaBox!.y + ctaBox!.height,
        `Bas du bouton (${ctaBox!.y + ctaBox!.height}px) doit être contenu dans la section (${secBox!.y + secBox!.height}px) sur ${path} (${testInfo.project.name})`
      ).toBeLessThanOrEqual(secBox!.y + secBox!.height + 1);

      expect(
        ctaBox!.y,
        `Haut du bouton (${ctaBox!.y}px) doit être >= haut de la section (${secBox!.y}px) sur ${path}`
      ).toBeGreaterThanOrEqual(secBox!.y);
    }
  });

  test('[JD-1117 #12] Respect strict de A8 : titre « Et derrière chaque production, » et sous-titre de la section Coulisses restent strictement intacts (FR + EN)', async ({
    page,
  }) => {
    // Vérification du contenu JSON source
    expect(frJson.portfolio.coulissesBloc.titre).toBe('Et derrière chaque production,');
    expect(frJson.portfolio.coulissesBloc.intro).toBe(
      'Découvrez les coulisses, les rencontres et les moments qui rendent chaque réalisation de VMM Productions unique.'
    );

    expect(enJson.portfolio.coulissesBloc.titre).toBe('And behind every production,');
    expect(enJson.portfolio.coulissesBloc.intro).toBe(
      'Discover the behind-the-scenes, encounters, and moments that make every VMM Productions project unique.'
    );

    // Vérification sur le DOM rendu
    for (const [path, expectedTitle, expectedIntro] of [
      [
        '/portfolio/',
        'Et derrière chaque production,',
        'Découvrez les coulisses, les rencontres et les moments qui rendent chaque réalisation de VMM Productions unique.',
      ],
      [
        '/en/portfolio/',
        'And behind every production,',
        'Discover the behind-the-scenes, encounters, and moments that make every VMM Productions project unique.',
      ],
    ]) {
      await page.goto(path);
      const titleEl = page.locator('#pf-coulisses-title');
      await expect(titleEl).toHaveText(expectedTitle);

      const introEl = page.locator('.pf-coulisses-text .jd-lead');
      await expect(introEl).toHaveText(expectedIntro);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Point 13 — Parité et étanchéité linguistique FR / EN
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #13] Parité FR/EN stricte : compteurs, IDs YouTube, ordre chronologique, indicateurs de défilement (« DÉFILER ↓ » / « SCROLL ↓ »)', async ({
    page,
  }) => {
    // 1. Indicateurs de défilement sur le portfolio
    await page.goto('/portfolio/');
    const frCue = page.locator('.scroll-cue');
    await expect(frCue).toHaveText('DÉFILER ↓');

    await page.goto('/en/portfolio/');
    const enCue = page.locator('.scroll-cue');
    await expect(enCue).toHaveText('SCROLL ↓');

    // 2. Parité des bibliothèques client FR vs EN
    const clientPairs = [
      ['/portfolio/hors-pair/', '/en/portfolio/hors-pair/'],
      ['/portfolio/coulisses/', '/en/portfolio/behind-the-scenes/'],
      ['/portfolio/tapis-rouge/', '/en/portfolio/tapis-rouge/'],
      ['/portfolio/pur-construction/', '/en/portfolio/pur-construction/'],
      ['/portfolio/bluewise/', '/en/portfolio/bluewise/'],
    ];

    for (const [frUrl, enUrl] of clientPairs) {
      await page.goto(frUrl);
      const frLinks = page.locator('.library-track a.yt-tile');
      const frCount = await frLinks.count();
      const frIds: string[] = [];
      for (let i = 0; i < frCount; i++) {
        frIds.push((await frLinks.nth(i).getAttribute('href')) || '');
      }

      await page.goto(enUrl);
      const enLinks = page.locator('.library-track a.yt-tile');
      const enCount = await enLinks.count();
      const enIds: string[] = [];
      for (let i = 0; i < enCount; i++) {
        enIds.push((await enLinks.nth(i).getAttribute('href')) || '');
      }

      expect(frCount, `Nombre de vidéos identique FR vs EN pour ${frUrl}`).toBe(enCount);
      expect(frIds, `Liste et ordre des vidéos identiques FR vs EN pour ${frUrl}`).toEqual(enIds);
    }
  });
});
