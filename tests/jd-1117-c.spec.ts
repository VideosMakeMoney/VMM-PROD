import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import ffprobeStatic from 'ffprobe-static';

const ROOT = process.cwd();

// Charger les fichiers de contenu
const frJson = JSON.parse(readFileSync(join(ROOT, 'content', 'fr.json'), 'utf8'));
const enJson = JSON.parse(readFileSync(join(ROOT, 'content', 'en.json'), 'utf8'));
const portfolio = JSON.parse(readFileSync(join(ROOT, 'content', 'portfolio.json'), 'utf8'));
const clips = JSON.parse(readFileSync(join(ROOT, 'content', 'clips.json'), 'utf8'));
const site = JSON.parse(readFileSync(join(ROOT, 'content', 'site.json'), 'utf8'));

test.describe('Ajustements JD du 17 nov. 2026 — PR C : clips, liens YouTube, tri, boutons mobiles, tuile VMM FR + EN', () => {

  // =========================================================================
  // POINT 4 — Clips de fond et posters versionnés (Accueil, Services, Portfolio)
  // =========================================================================

  test('[JD-1117 #4] Desktop (1920x1080, 1366x768) : les vidéos 16:9 versionnées v20261117 sont configurées et servies (FR + EN)', async ({ page }) => {
    test.skip(!!page.viewportSize() && page.viewportSize()!.width < 900, 'Test réservé au desktop');
    for (const path of ['/', '/en/', '/services/', '/en/services/', '/portfolio/', '/en/portfolio/']) {
      await page.goto(path);
      const isAccueil = path === '/' || path === '/en/';
      const isServices = path.includes('/services/');

      let expectedBase = '';
      if (isAccueil) expectedBase = 'hero-accueil-16x9-v20261117';
      else if (isServices) expectedBase = 'services-16x9-v20261117';
      else expectedBase = 'work-16x9-v20261117';

      if (isAccueil) {
        const heroVideo = page.locator('video.hero-video');
        await expect(heroVideo).toHaveAttribute('data-hero-ordi', new RegExp(expectedBase));
      } else {
        const bgVideo = page.locator('[data-bg-video]').first();
        await expect(bgVideo).toHaveAttribute('data-ordi-mp4', new RegExp(expectedBase));
        await expect(bgVideo).toHaveAttribute('data-ordi-webm', new RegExp(expectedBase));
        await expect(bgVideo).toHaveAttribute('data-ordi-poster', new RegExp(`${expectedBase}-poster`));
      }
    }
  });

  test('[JD-1117 #4] Mobile (390x844, 360x740) : les vidéos 9:16 versionnées v20261117 sont configurées et servies (FR + EN)', async ({ page }) => {
    test.skip(!page.viewportSize() || page.viewportSize()!.width >= 900, 'Test réservé au mobile');
    for (const path of ['/', '/en/', '/services/', '/en/services/', '/portfolio/', '/en/portfolio/']) {
      await page.goto(path);
      const isAccueil = path === '/' || path === '/en/';
      const isServices = path.includes('/services/');

      let expectedBase = '';
      if (isAccueil) expectedBase = 'hero-accueil-9x16-v20261117';
      else if (isServices) expectedBase = 'services-9x16-v20261117';
      else expectedBase = 'work-9x16-v20261117';

      if (isAccueil) {
        const heroVideo = page.locator('video.hero-video');
        await expect(heroVideo).toHaveAttribute('data-hero-mobile', new RegExp(expectedBase));
      } else {
        const bgVideo = page.locator('[data-bg-video]').first();
        await expect(bgVideo).toHaveAttribute('data-mobile-mp4', new RegExp(expectedBase));
        await expect(bgVideo).toHaveAttribute('data-mobile-webm', new RegExp(expectedBase));
        await expect(bgVideo).toHaveAttribute('data-mobile-poster', new RegExp(`${expectedBase}-poster`));
      }
    }
  });

  test('[JD-1117 #4] Fichiers vidéo versionnés : existence, dimensions, 30 fps, sans audio, durée conforme à ±0.1s, posters YAVG > 20 et md5 distincts, et absence totale d anciens noms dans dist/', async () => {
    const ffprobe = ffprobeStatic?.path;
    expect(ffprobe && existsSync(ffprobe), 'ffprobe doit être disponible (ffprobe-static requis)').toBe(true);

    const EXPECTED_VIDEOS: Record<string, { w: number; h: number; duration: number }> = {
      'hero-accueil-16x9-v20261117': { w: 1920, h: 1080, duration: 25.20 },
      'hero-accueil-9x16-v20261117': { w: 1080, h: 1920, duration: 25.21 },
      'services-16x9-v20261117': { w: 1920, h: 1080, duration: 25.67 },
      'services-9x16-v20261117': { w: 1080, h: 1920, duration: 25.68 },
      'work-16x9-v20261117': { w: 1920, h: 1080, duration: 27.47 },
      'work-9x16-v20261117': { w: 1080, h: 1920, duration: 27.49 },
    };

    const webpHashes = new Map<string, string>();
    const jpgHashes = new Map<string, string>();

    for (const [baseName, spec] of Object.entries(EXPECTED_VIDEOS)) {
      for (const ext of ['.mp4', '.webm']) {
        const filePath = join(ROOT, 'static', 'videos', 'jd', `${baseName}${ext}`);
        expect(existsSync(filePath), `Fichier ${filePath} doit exister`).toBe(true);

        const probeStr = execSync(
          `"${ffprobe}" -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -show_entries format=duration -of json "${filePath}"`
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
          `"${ffprobe}" -v error -select_streams a -show_entries stream=index -of json "${filePath}"`
        ).toString();
        const audioProbe = JSON.parse(audioProbeStr);
        expect(
          (audioProbe.streams || []).length,
          `Aucune piste audio dans ${baseName}${ext}`
        ).toBe(0);

        // Poids dans la cible ~4 à 11 Mo
        const stat = statSync(filePath);
        expect(stat.size, `Poids de ${baseName}${ext} (${(stat.size / 1024 / 1024).toFixed(2)} Mo)`).toBeGreaterThan(4 * 1024 * 1024);
        expect(stat.size, `Poids de ${baseName}${ext} (${(stat.size / 1024 / 1024).toFixed(2)} Mo)`).toBeLessThan(11.5 * 1024 * 1024);
      }

      // Vérification des posters (WebP et JPG)
      for (const posterExt of ['.webp', '.jpg']) {
        const posterPath = join(ROOT, 'static', 'videos', 'jd', `${baseName}-poster${posterExt}`);
        expect(existsSync(posterPath), `Poster ${posterPath} doit exister`).toBe(true);

        // Vérification de la luminance YAVG via ffprobe lavfi signalstats
        const cleanPosterPath = posterPath.replace(/\\/g, '/');
        const probeYavg = execSync(
          `"${ffprobe}" -v error -f lavfi -i "movie=\\'${cleanPosterPath}\\',signalstats" -show_entries frame_tags=lavfi.signalstats.YAVG -of default=noprint_wrappers=1:nokey=1`
        ).toString().trim();
        const yavg = parseFloat(probeYavg);
        expect(yavg, `Luminance YAVG de ${baseName}-poster${posterExt} (${yavg}) doit être > 20 (non noire)`).toBeGreaterThan(20);

        // MD5 pour vérifier que chaque poster est distinct
        const buf = readFileSync(posterPath);
        const hash = crypto.createHash('md5').update(buf).digest('hex');
        if (posterExt === '.webp') webpHashes.set(baseName, hash);
        else jpgHashes.set(baseName, hash);
      }
    }

    // Tous les posters sont distincts (services != work != accueil, 16:9 != 9:16)
    expect(new Set(webpHashes.values()).size, 'Les 6 posters WebP doivent avoir des hash MD5 tous distincts').toBe(6);
    expect(new Set(jpgHashes.values()).size, 'Les 6 posters JPG doivent avoir des hash MD5 tous distincts').toBe(6);

    // Vérifier l'absence totale des anciens noms non versionnés dans dist/
    const FORBIDDEN_OLD_STRINGS = [
      'hero-accueil-16x9.mp4',
      'hero-accueil-9x16.mp4',
      'services-16x9.mp4',
      'services-9x16.mp4',
      'work-16x9.mp4',
      'work-9x16.mp4',
      'hero-accueil-16x9.webm',
      'hero-accueil-9x16.webm',
      'services-16x9.webm',
      'services-9x16.webm',
      'work-16x9.webm',
      'work-9x16.webm',
    ];

    const distFiles = [
      'index.html',
      'en/index.html',
      'services/index.html',
      'en/services/index.html',
      'portfolio/index.html',
      'en/portfolio/index.html',
    ];

    for (const df of distFiles) {
      const p = join(ROOT, 'dist', df);
      if (existsSync(p)) {
        const content = readFileSync(p, 'utf8');
        for (const oldStr of FORBIDDEN_OLD_STRINGS) {
          expect(content.includes(oldStr), `dist/${df} ne doit pas contenir l ancien nom ${oldStr}`).toBe(false);
        }
      }
    }
  });

  // =========================================================================
  // POINT 9 — Liens YouTube des cartes de catégories (Accueil & Portfolio p.2)
  // =========================================================================

  test('[JD-1117 #9] Cartes des catégories sur Accueil et Portfolio : liens YouTube exacts (LiXjVf43rqo pour promo, -6N2iah60mc pour coulisses, 1NpXK1wLSl8 pour evenements) (FR + EN)', async ({ page }) => {
    for (const path of ['/', '/en/', '/portfolio/', '/en/portfolio/']) {
      await page.goto(path);

      // Promo -> LiXjVf43rqo
      const promoLink = page.locator('a[href*="LiXjVf43rqo"]').first();
      await expect(promoLink).toBeVisible();
      await expect(promoLink).toHaveAttribute('href', 'https://www.youtube.com/shorts/LiXjVf43rqo');

      // Coulisses -> -6N2iah60mc
      const coulissesLink = page.locator('a[href*="-6N2iah60mc"]').first();
      await expect(coulissesLink).toBeVisible();
      await expect(coulissesLink).toHaveAttribute('href', 'https://www.youtube.com/watch?v=-6N2iah60mc');

      // Événements -> 1NpXK1wLSl8 (remplace B7dWhLnxw08 404, tuile redevenue cliquable)
      const evenementsLink = page.locator('a[href*="1NpXK1wLSl8"]').first();
      await expect(evenementsLink).toBeVisible();
      await expect(evenementsLink).toHaveAttribute('href', 'https://www.youtube.com/shorts/1NpXK1wLSl8');

      // Aucune tuile de catégorie vide / non cliquable
      const emptyCatTile = page.locator('.hp-cards .yt-tile.is-empty, .pf-cat-grid .yt-tile.is-empty');
      expect(await emptyCatTile.count()).toBe(0);

      // B7dWhLnxw08 ne doit JAMAIS apparaître nulle part
      const b7Link = page.locator('a[href*="B7dWhLnxw08"]');
      expect(await b7Link.count()).toBe(0);
    }
  });

  test('[JD-1117 #9] Intégrité globale : chaque ID YouTube dans portfolio.json fait partie de la liste autorisée de JD ou des IDs en ligne', async () => {
    const ALLOWED_IDS = new Set([
      // Coulisses (9)
      '5cwIdsVO0Jc', 'n7_rIrZQLk8', 'hOUNzv6MYc8', 'a6L9xFtDSgc',
      'c6GviSuf6Kc', 'hxhDQdTkXkM', 'WBgsj8VZAzc', 'Ce1zC640M-A', '8X6m5PyYs0w',
      // Hors-Pair (3)
      'aRr26p8dQxk', 'fxGb6xSqsfw', 'LiXjVf43rqo',
      // Tapis Rouge (9 — dont ajouts 1NpXK1wLSl8 et u_HK2iiuUnw)
      'hmrhpcyGGEk', 'O2UTFiYzGU0', 'kKz1pKN44dM', 'g8pY-zSgljI', '3ru2cIaqzeo', 't7zXkOFUdBs', 'HeLdEo_awQ0',
      '1NpXK1wLSl8', 'u_HK2iiuUnw',
      // PÜR Construction (7)
      'FOeE9sB-UtY', 'VaEXZ5aXcE0', 'wNGp61LUV8g', 'duRjqB2By-0', 'G3owwW2k1Po', 'F8bCIpVoDFI', '3T-zTO2Q30A',
      // BlueWise (2)
      'LQmzAY6qCv8', 'zga2uMl5zhk',
      // Catégories (Accueil & Portfolio)
      '-6N2iah60mc',
    ]);

    for (const v of portfolio.videos) {
      if (v.youtubeId) {
        expect(ALLOWED_IDS.has(v.youtubeId), `ID ${v.youtubeId} dans portfolio.videos doit être autorisé`).toBe(true);
      }
    }

    for (const cat of portfolio.categories) {
      if (cat.videoAccueil) {
        expect(ALLOWED_IDS.has(cat.videoAccueil), `ID ${cat.videoAccueil} dans category ${cat.id} doit être autorisé`).toBe(true);
      }
    }
  });

  // =========================================================================
  // POINT 10 — Bibliothèques client et coulisses, tri chronologique strict
  // =========================================================================

  test('[JD-1117 #10] Bibliothèques client et coulisses : liste exacte des IDs et tri strictement chronologique selon publie, décroissant pour les clients depuis PR M et pour coulisses depuis PR N (FR + EN)', async ({ page }) => {
    const EXPECTED_ORDERS: Record<string, { fr: string; en: string; ids: string[] }> = {
      coulisses: {
        fr: '/portfolio/coulisses/',
        en: '/en/portfolio/behind-the-scenes/',
        ids: [
          '5cwIdsVO0Jc', // 2026-06-01
          'n7_rIrZQLk8', // 2026-06-07
          'hOUNzv6MYc8', // 2026-06-19
          'a6L9xFtDSgc', // 2026-07-12
          'c6GviSuf6Kc', // 2026-09-02
          'hxhDQdTkXkM', // 2026-09-08
          'WBgsj8VZAzc', // 2026-09-28
          'Ce1zC640M-A', // 2026-09-29
          '8X6m5PyYs0w', // 2026-10-05
        ],
      },
      horsPair: {
        fr: '/portfolio/hors-pair/',
        en: '/en/portfolio/hors-pair/',
        ids: [
          'aRr26p8dQxk', // 2026-06-10
          'fxGb6xSqsfw', // 2026-06-11
          'LiXjVf43rqo', // 2026-09-20
        ],
      },
      tapisRouge: {
        fr: '/portfolio/tapis-rouge/',
        en: '/en/portfolio/tapis-rouge/',
        ids: [
          'hmrhpcyGGEk', // 2026-07-16
          'O2UTFiYzGU0', // 2026-07-21
          'kKz1pKN44dM', // 2026-07-27
          'g8pY-zSgljI', // 2026-08-08
          '3ru2cIaqzeo', // 2026-08-10
          't7zXkOFUdBs', // 2026-08-13
          'HeLdEo_awQ0', // 2026-08-16
          '1NpXK1wLSl8', // 2026-11-18T07:25:33-08:00
          'u_HK2iiuUnw', // 2026-11-18T07:31:48-08:00
        ],
      },
      purConstruction: {
        fr: '/portfolio/pur-construction/',
        en: '/en/portfolio/pur-construction/',
        ids: [
          'FOeE9sB-UtY', // 2026-04-01T16:45
          'VaEXZ5aXcE0', // 2026-04-01T16:55
          'wNGp61LUV8g', // 2026-04-01T17:00
          'duRjqB2By-0', // 2026-04-06T14:13
          'G3owwW2k1Po', // 2026-04-06T14:18
          'F8bCIpVoDFI', // 2026-04-16T19:01
          '3T-zTO2Q30A', // 2026-04-16T19:06
        ],
      },
      bluewise: {
        fr: '/portfolio/bluewise/',
        en: '/en/portfolio/bluewise/',
        ids: [
          'LQmzAY6qCv8', // 2026-05-31T13:25
          'zga2uMl5zhk', // 2026-05-31T13:30
        ],
      },
    };

    for (const info of Object.values(EXPECTED_ORDERS)) {
      for (const url of [info.fr, info.en]) {
        await page.goto(url);

        const pageYtLinks = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.library-track a[href*="youtu"]'))
            .map((el) => {
              const href = el.getAttribute('href') || '';
              const match = href.match(/(?:shorts\/|v=)([a-zA-Z0-9_-]{11})/);
              return match ? match[1] : '';
            })
            .filter(Boolean);
        });

        // PR M (2026-11-21) : bibliothèques clients de la plus récente à la plus vieille ; PR N : coulisses aussi.
        const attendu = [...info.ids].reverse();
        expect(pageYtLinks, `Ordre et contenu des IDs vidéo sur ${url}`).toEqual(attendu);
      }
    }
  });

  test('[JD-1117 #10] Vidéo morte : z2eTv3wpHDA est totalement absente du site et de dist/ (HTML, JSON-LD, sitemap)', async ({ page }) => {
    const DEAD_ID = 'z2eTv3wpHDA';

    // 1. Absence sur les pages en ligne (échec garanti sur main où z2eTv3wpHDA était présente dans coulisses)
    await page.goto('/portfolio/coulisses/');
    const deadInCoulisses = page.locator(`a[href*="${DEAD_ID}"]`);
    await expect(deadInCoulisses, `La vidéo morte ${DEAD_ID} ne doit pas apparaître dans /portfolio/coulisses/`).toHaveCount(0);

    const distFiles = [
      'sitemap.xml',
      'portfolio/coulisses/index.html',
      'en/portfolio/behind-the-scenes/index.html',
      'portfolio/index.html',
      'en/portfolio/index.html',
    ];

    for (const f of distFiles) {
      const p = join(ROOT, 'dist', f);
      if (existsSync(p)) {
        const content = readFileSync(p, 'utf8');
        expect(content.includes(DEAD_ID), `Le fichier dist/${f} ne doit pas contenir la vidéo morte ${DEAD_ID}`).toBe(false);
      }
    }
  });

  test('[JD-1117 #10] Compteurs et dates : chaque vidéo dans portfolio.json a une date publie ISO valide, et les compteurs de vidéos sont exacts (FR + EN)', async ({ page }) => {
    // 1. Validation de la présence de dates ISO réelles
    for (const v of portfolio.videos) {
      expect(v.publie, `Vidéo ${v.youtubeId || v.titre} doit avoir une date publie`).toBeDefined();
      expect(new Date(v.publie).toString(), `Date ${v.publie} doit être une date ISO valide`).not.toBe('Invalid Date');
    }

    // 2. Compteurs sur la page Portfolio (page 3 et page 4)
    for (const path of ['/portfolio/', '/en/portfolio/']) {
      await page.goto(path);

      // Coulisses étagère (p.4) -> 9 vidéos
      const coulissesCount = page.locator('.pf-shelf-tile .coulisses-count');
      await expect(coulissesCount).toContainText('9');

      // Tapis Rouge -> 9 vidéos
      const trCount = page.locator('.logo-btn[href*="tapis-rouge"] .logo-btn-count');
      await expect(trCount).toContainText('9');

      // Hors-Pair -> 3 vidéos
      const hpCount = page.locator('.logo-btn[href*="hors-pair"] .logo-btn-count');
      await expect(hpCount).toContainText('3');

      // PÜR Construction -> 7 vidéos
      const purCount = page.locator('.logo-btn[href*="pur-construction"] .logo-btn-count');
      await expect(purCount).toContainText('7');

      // BlueWise -> 2 vidéos
      const bwCount = page.locator('.logo-btn[href*="bluewise"] .logo-btn-count');
      await expect(bwCount).toContainText('2');
    }
  });

  // =========================================================================
  // POINT 11 — Navigation mobile par clics réels et restauration de scroll
  // =========================================================================

  test('[JD-1117 #11] Mobile (WebKit 390x844 & Chromium 360x740) : parcours par de VRAIS clics de tous les liens internes (sans ancre scrollY === 0, avec ancre cible entre 0 et 72px) (FR + EN)', async ({ page }) => {
    test.skip(!page.viewportSize() || page.viewportSize()!.width >= 900, 'Test réservé au mobile');

    // 1. Parcours des liens du menu mobile depuis le milieu de page
    const MENU_TESTS = [
      { start: '/', linkText: 'Services', expectedUrl: '/services/', hasAnchor: false },
      { start: '/', linkText: 'Portfolio', expectedUrl: '/portfolio/', hasAnchor: false },
      { start: '/', linkText: 'À propos', expectedUrl: '/a-propos/', hasAnchor: false },
      { start: '/', linkText: 'Contact', expectedUrl: '/contact/', hasAnchor: false },
      { start: '/en/', linkText: 'Services', expectedUrl: '/en/services/', hasAnchor: false },
      { start: '/en/', linkText: 'Portfolio', expectedUrl: '/en/portfolio/', hasAnchor: false },
      { start: '/en/', linkText: 'About', expectedUrl: '/en/about/', hasAnchor: false },
      { start: '/en/', linkText: 'Contact', expectedUrl: '/en/contact/', hasAnchor: false },
    ];

    for (const testCase of MENU_TESTS) {
      await page.goto(testCase.start, { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, 1200));
      await page.waitForTimeout(100);

      await page.click('.menu-toggle');
      await page.waitForSelector('#menu.open', { state: 'visible' });

      const link = page.locator(`#menu a:has-text("${testCase.linkText}")`).first();
      await link.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(200);

      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY, `Navigation depuis le milieu de ${testCase.start} vers ${testCase.expectedUrl} doit atterrir à scrollY === 0`).toBe(0);
    }

    // 2. Liens Contact et Zones en direct : sans ancre, arrivée à 0
    const DIRECT_PAGES = [
      '/contact/',
      '/en/contact/',
      '/production-video-laurentides/',
      '/en/video-production-laurentians/',
      '/production-video-rive-nord-montreal/',
      '/en/video-production-north-shore-montreal/',
    ];

    for (const p of DIRECT_PAGES) {
      await page.goto(p, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY, `Arrivée directe sur ${p} sans ancre doit être à scrollY === 0`).toBe(0);
    }

    // 3. CTA des héros par vrai clic depuis le milieu
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(100);
    await page.click('.hero-ctas a.hero-cta'); // Contact
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.scrollY), 'Clic sur CTA héro Contact depuis le milieu doit atterrir à 0').toBe(0);

    // 4. Tuile VMM p.4 vers coulisses par vrai clic depuis le milieu
    await page.goto('/portfolio/', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(100);
    const shelfTile = page.locator('.pf-shelf-tile');
    await shelfTile.scrollIntoViewIfNeeded();
    await shelfTile.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(200);
    expect(page.url()).toContain('/portfolio/coulisses/');
    expect(await page.evaluate(() => window.scrollY), 'Clic sur tuile VMM doit atterrir en haut (scrollY === 0) de coulisses').toBe(0);

    // 5. Logo client par vrai clic depuis le milieu
    await page.goto('/portfolio/', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(100);
    const trLogo = page.locator('.logo-btn[href*="tapis-rouge"]').first();
    await trLogo.scrollIntoViewIfNeeded();
    await trLogo.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(200);
    expect(page.url()).toContain('/portfolio/tapis-rouge/');
    expect(await page.evaluate(() => window.scrollY), 'Clic sur logo client doit atterrir en haut (scrollY === 0)').toBe(0);

    // 6. Pied de page (liens zones desservies) par vrai clic depuis le milieu
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(100);
    const footerLink = page.locator('footer a[href*="laurentides"]').first();
    await footerLink.scrollIntoViewIfNeeded();
    await footerLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(200);
    expect(page.url()).toContain('/production-video-laurentides/');
    expect(await page.evaluate(() => window.scrollY), 'Clic sur lien pied de page doit atterrir à 0').toBe(0);
    const footerZoneGap = await page.evaluate(() => {
      const header = document.querySelector('.site-header')!;
      const text = document.querySelector('.zone-hero .container > p.label') || document.querySelector('.zone-hero h1')!;
      const hRect = header.getBoundingClientRect();
      const tRect = text.getBoundingClientRect();
      return Math.round(tRect.top - hRect.bottom);
    });
    expect(footerZoneGap, `Écart sous l en-tête (${footerZoneGap}px) doit être >= 24px`).toBeGreaterThanOrEqual(24);

    // 7. Vrais clics sur liens d ancres internes (#svc-liste, #realisons) en FR et EN
    const ANCHOR_TESTS = [
      { url: '/services/', selector: 'a[href="#svc-liste"]', targetId: 'svc-liste' },
      { url: '/en/services/', selector: 'a[href="#svc-liste"]', targetId: 'svc-liste' },
      { url: '/portfolio/', selector: 'a.scroll-cue[href="#realisons"]', targetId: 'realisons' },
      { url: '/en/portfolio/', selector: 'a.scroll-cue[href="#realisons"]', targetId: 'realisons' },
    ];

    for (const at of ANCHOR_TESTS) {
      await page.goto(at.url, { waitUntil: 'networkidle' });
      await page.click(at.selector);
      await page.waitForTimeout(300);
      const top = await page.evaluate((id) => {
        const el = document.getElementById(id);
        return el ? Math.round(el.getBoundingClientRect().top) : -1;
      }, at.targetId);
      expect(top, `Haut de la cible ancre #${at.targetId} sur ${at.url} doit être entre 0 et 72px`).toBeGreaterThanOrEqual(0);
      expect(top, `Haut de la cible ancre #${at.targetId} sur ${at.url} doit être entre 0 et 72px`).toBeLessThanOrEqual(72);
    }
  });

  test('[JD-1117 #11] Desktop (1366x768) : le Retour restaure la position de défilement (±10 px)', async ({ page }) => {
    test.skip(page.viewportSize()?.width !== 1366, 'Test réservé au desktop 1366x768');

    await page.goto('/portfolio/', { waitUntil: 'networkidle' });
    // Défiler vers le bas (section entreprises à l'honneur)
    const trBtn = page.locator('.logo-btn[href*="tapis-rouge"]').first();
    await trBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const scrolledPos = await page.evaluate(() => window.scrollY);
    expect(scrolledPos).toBeGreaterThanOrEqual(1000);

    // Cliquer sur le logo Tapis Rouge
    await trBtn.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/portfolio/tapis-rouge/');

    // Retour arrière
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const restoredPos = await page.evaluate(() => window.scrollY);
    expect(
      Math.abs(restoredPos - scrolledPos),
      `Position restaurée (${restoredPos}px vs ${scrolledPos}px) doit correspondre à ±10px au Retour`
    ).toBeLessThanOrEqual(10);
  });

  test('[JD-1117 #11/zones] Pages de zones mobile (360x740, 390x844) : scrollY 0 et texte >= 24px sous l en-tête', async ({ page }) => {
    test.skip(!page.viewportSize() || page.viewportSize()!.width >= 900, 'Test réservé au mobile');
    for (const zonePath of ['/production-video-laurentides/', '/en/video-production-laurentians/']) {
      await page.goto(zonePath, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY, `Sur ${zonePath}, la page doit atterrir à scrollY === 0`).toBe(0);

      const gap = await page.evaluate(() => {
        const header = document.querySelector('.site-header')!;
        const heroText = document.querySelector('.zone-hero .container > p.label') || document.querySelector('.zone-hero h1')!;
        const hRect = header.getBoundingClientRect();
        const tRect = heroText.getBoundingClientRect();
        return Math.round(tRect.top - hRect.bottom);
      });
      expect(gap, `Sur ${zonePath}, l écart entre le bas de l en-tête et le premier texte du héros (${gap}px) doit être >= 24px`).toBeGreaterThanOrEqual(24);
    }
  });

  // =========================================================================
  // POINT 12 — Mobile seulement : tuile VMM dans la grille du Portfolio (p. 4)
  // =========================================================================

  test('[JD-1117 #12] Mobile (390x844, 390x664, 360x740) : tuile VMM p.4 avec libellé exact, bouton complet avec triangle ▶, couleur et graisse identiques aux logos, marge basse >= 8px, et h2 de même taille que main (FR + EN)', async ({ page }) => {
    test.skip(!page.viewportSize() || page.viewportSize()!.width >= 900, 'Test réservé au mobile');

    for (const path of ['/portfolio/', '/en/portfolio/']) {
      await page.goto(path);
      const isFr = path === '/portfolio/';

      const shelf = page.locator('.pf-shelf');
      await shelf.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);

      const vmmTile = shelf.locator('.pf-shelf-tile');
      await expect(vmmTile).toBeVisible();

      // Libellé exact
      const expectedText = isFr ? 'Cliquez pour visionner' : 'Click to watch';
      const cta = vmmTile.locator('.logo-btn-cta');
      await expect(cta).toBeVisible();
      await expect(cta).toContainText(expectedText);

      // Icône triangle ▶ présente et visible
      const playIcon = cta.locator('.cta-play');
      await expect(playIcon).toBeVisible();

      // Vérification des styles calculés (mêmes couleur et graisse 400 que sous les logos, h2 identique à main, marge >= 8px)
      const metrics = await page.evaluate(() => {
        const shelfEl = document.querySelector('.pf-shelf')!;
        const ctaEl = shelfEl.querySelector('.pf-shelf-tile .logo-btn-cta')!;
        const logoRefEl = document.querySelector('.pf-logos-shelf .logo-btn-cta') || document.querySelector('.logo-btn-cta')!;
        const h2El = shelfEl.querySelector('.pf-coulisses-text h2')!;

        const sRect = shelfEl.getBoundingClientRect();
        const cRect = ctaEl.getBoundingClientRect();
        const ctaStyle = window.getComputedStyle(ctaEl);
        const refStyle = window.getComputedStyle(logoRefEl);
        const h2Style = window.getComputedStyle(h2El);

        return {
          ctaWeight: ctaStyle.fontWeight,
          ctaColor: ctaStyle.color,
          refWeight: refStyle.fontWeight,
          refColor: refStyle.color,
          h2FontSize: h2Style.fontSize,
          bottomMargin: sRect.bottom - cRect.bottom,
          inViewport: cRect.bottom <= sRect.bottom,
        };
      });

      // Couleur et graisse identiques à celles sous les logos (gris var(--text-2), graisse 400)
      expect(metrics.ctaWeight, 'Graisse du bouton tuile VMM doit être 400 (identique aux logos)').toBe('400');
      expect(metrics.ctaColor, 'Couleur du bouton tuile VMM doit être identique à celle sous les logos').toBe(metrics.refColor);

      // Entièrement dans l écran avec au moins 8px de marge du bas
      expect(metrics.inViewport, 'Bouton doit être entièrement dans l écran').toBe(true);
      expect(metrics.bottomMargin, `Marge basse (${metrics.bottomMargin.toFixed(1)}px) doit être >= 8px`).toBeGreaterThanOrEqual(8);

      // Largeur de .pf-shelf-img (>= 90% de main dans chaque viewport, et >= 130px en 390x664)
      const imgWidth = await shelf.locator('.pf-shelf-img').evaluate((el) => el.getBoundingClientRect().width);
      const vp = page.viewportSize()!;
      let mainImgWidth = 0.42 * vp.width;
      if (vp.height <= 700) {
        mainImgWidth = Math.min(0.42 * vp.width, 0.22 * vp.height);
        expect(imgWidth, `En hauteur <= 700px (ex. 390x664), l image (${imgWidth.toFixed(1)}px) doit être >= 130px`).toBeGreaterThanOrEqual(130);
      } else {
        mainImgWidth = Math.min(0.42 * vp.width, 0.24 * vp.height);
      }
      expect(imgWidth, `Largeur de .pf-shelf-img (${imgWidth.toFixed(1)}px) doit être >= 90% de celle de main (${mainImgWidth.toFixed(1)}px)`).toBeGreaterThanOrEqual(0.9 * mainImgWidth);

      // Vérification de la taille du h2 A8 (identique à main)
      if (vp.height <= 700) {
        // max-height: 700px -> clamp(1.6rem, 9vw, 2.6rem)
        const expectedH2 = Math.min(Math.max(1.6 * 16, 0.09 * vp.width), 2.6 * 16);
        expect(parseFloat(metrics.h2FontSize), 'Taille du h2 A8 sur écran bas (<= 700px) doit être identique à main').toBeCloseTo(expectedH2, 0.5);
      } else {
        // clamp(1.7rem, 10.4vw, 3rem)
        const expectedH2 = Math.min(Math.max(1.7 * 16, 0.104 * vp.width), 3.0 * 16);
        expect(parseFloat(metrics.h2FontSize), 'Taille du h2 A8 sur mobile normal doit être identique à main').toBeCloseTo(expectedH2, 0.5);
      }
    }
  });

  test('[JD-1117 #12] Desktop (1366x768, 1920x1080) : tuile VMM p.4 identique à main (icône visible, bas du libellé à ±1 px de main)', async ({ page }) => {
    test.skip(!page.viewportSize() || page.viewportSize()!.width < 900, 'Test réservé au desktop');

    for (const path of ['/portfolio/', '/en/portfolio/']) {
      await page.goto(path);
      const shelf = page.locator('.pf-shelf');
      await shelf.scrollIntoViewIfNeeded();

      const ctaPlay = shelf.locator('.pf-shelf-tile .cta-play');
      await expect(ctaPlay).toBeVisible();
      const playDisplay = await ctaPlay.evaluate((el) => window.getComputedStyle(el).display);
      expect(playDisplay, 'Sur desktop, l icône .cta-play doit être visible (display: block/inline-block)').not.toBe('none');

      const ctaData = await shelf.evaluate((s) => {
        const ctaEl = s.querySelector('.pf-shelf-tile .logo-btn-cta')!;
        const cRect = ctaEl.getBoundingClientRect();
        const sRect = s.getBoundingClientRect();
        return {
          ctaBottomRelativeToShelf: Math.round(cRect.bottom - sRect.top),
        };
      });

      const vp = page.viewportSize()!;
      // En 1366x768 et 1920x1080, position du bas du libellé identique à main (±1 px)
      if (vp.width === 1366 && vp.height === 768) {
        expect(Math.abs(ctaData.ctaBottomRelativeToShelf - 579), 'Bas du libellé en 1366x768 doit être à ±1 px de main (579px)').toBeLessThanOrEqual(1);
      } else if (vp.width === 1920 && vp.height === 1080) {
        expect(Math.abs(ctaData.ctaBottomRelativeToShelf - 817), 'Bas du libellé en 1920x1080 doit être à ±1 px de main (817px)').toBeLessThanOrEqual(1);
      }
    }
  });

  // =========================================================================
  // POINT 6 — Accessibilité : aria-label de la carte -6N2iah60mc & videoAccueilVertical
  // =========================================================================

  test('[JD-1117 #6] Accessibilité : carte coulisses -6N2iah60mc a aria-label avec le libellé de catégorie et non «  1 », et videoAccueilVertical dans portfolio.json', async ({ page }) => {
    // 1. Validation de la propriété dans portfolio.json (pas d ID codé en dur dans build.mjs)
    const coulissesCat = portfolio.categories.find((c: any) => c.id === 'coulisses');
    expect(coulissesCat, 'Catégorie coulisses doit exister').toBeDefined();
    expect(coulissesCat.videoAccueilVertical, 'videoAccueilVertical doit valoir false pour coulisses').toBe(false);

    // 2. Validation du aria-label sur l Accueil (FR + EN)
    await page.goto('/');
    const tileFr = page.locator('a[href*="-6N2iah60mc"]').first();
    await expect(tileFr).toHaveAttribute('aria-label', 'Voir sur YouTube : Coulisses, making-of et bandes-annonces');

    await page.goto('/en/');
    const tileEn = page.locator('a[href*="-6N2iah60mc"]').first();
    await expect(tileEn).toHaveAttribute('aria-label', 'Watch on YouTube : Behind the scenes, making-of and trailers');

    // 3. Validation du aria-label sur le Portfolio p.2 (FR + EN)
    await page.goto('/portfolio/');
    const pfTileFr = page.locator('a.pf-cat[href*="-6N2iah60mc"]').first();
    await expect(pfTileFr).toHaveAttribute('aria-label', 'Voir sur YouTube : Coulisses et bandes-annonces');

    await page.goto('/en/portfolio/');
    const pfTileEn = page.locator('a.pf-cat[href*="-6N2iah60mc"]').first();
    await expect(pfTileEn).toHaveAttribute('aria-label', 'Watch on YouTube : Behind the scenes and trailers');
  });

  test('[JD-1117 #6/aria] Aucun aria-label dans dist/ ne contient « &amp;# » (pas de double échappement)', async () => {
    const htmlFiles = (readdirSync(join(ROOT, 'dist'), { recursive: true }) as string[])
      .filter((f) => typeof f === 'string' && f.endsWith('.html'))
      .map((f) => join(ROOT, 'dist', f));
    expect(htmlFiles.length).toBeGreaterThan(0);
    const doubleEscaped: string[] = [];
    for (const file of htmlFiles) {
      const content = readFileSync(file, 'utf-8');
      const matches = content.match(/aria-label="[^"]*&amp;#[^"]*"/g);
      if (matches) {
        doubleEscaped.push(`${file}: ${matches.join(', ')}`);
      }
    }
    expect(doubleEscaped, 'Aucun aria-label ne doit contenir &amp;#').toEqual([]);
  });

  // =========================================================================
  // POINT 13 — Parité linguistique et étanchéité FR/EN stricte
  // =========================================================================

  test('[JD-1117 #13] Parité FR/EN stricte : compteurs, IDs YouTube, ordre chronologique, indicateurs de défilement (« DÉFILER ↓ » / « SCROLL ↓ »)', async ({ page }) => {
    // 1. Vérification des compteurs réels sur les pages Portfolio FR et EN (échec garanti sur main où coulisses=5 et hors-pair=2)
    await page.goto('/portfolio/');
    const coulissesCountFr = page.locator('.pf-shelf-tile .coulisses-count');
    await expect(coulissesCountFr, 'Portfolio FR doit afficher 9 vidéos de coulisses').toContainText('9');
    const hpCountFr = page.locator('.logo-btn[href*="hors-pair"] .logo-btn-count');
    await expect(hpCountFr, 'Portfolio FR doit afficher 3 vidéos Hors-Pair').toContainText('3');

    await page.goto('/en/portfolio/');
    const coulissesCountEn = page.locator('.pf-shelf-tile .coulisses-count');
    await expect(coulissesCountEn, 'Portfolio EN doit afficher 9 vidéos de coulisses').toContainText('9');
    const hpCountEn = page.locator('.logo-btn[href*="hors-pair"] .logo-btn-count');
    await expect(hpCountEn, 'Portfolio EN doit afficher 3 vidéos Hors-Pair').toContainText('3');

    // 2. Indicateurs de défilement (« DÉFILER ↓ » vs « SCROLL ↓ »)
    const scrollCueFr = page.locator('.scroll-cue');
    await page.goto('/portfolio/');
    if (await scrollCueFr.count() > 0) {
      await expect(scrollCueFr.first()).toContainText('DÉFILER ↓');
    }

    await page.goto('/en/portfolio/');
    const scrollCueEn = page.locator('.scroll-cue');
    if (await scrollCueEn.count() > 0) {
      await expect(scrollCueEn.first()).toContainText('SCROLL ↓');
    }
  });

  // =========================================================================
  // GARDE-FOU A8 — Titre et sous-titre de la section Coulisses (Portfolio p. 4)
  // =========================================================================

  test('[JD-1117] garde A8 : titre « Et derrière chaque production, » et sous-titre de la section Coulisses restent strictement intacts (FR + EN)', async ({ page }) => {
    // FR
    await page.goto('/portfolio/');
    const shelfH2Fr = page.locator('#pf-coulisses-title');
    await expect(shelfH2Fr).toContainText('Et derrière chaque production,');
    const shelfIntroFr = page.locator('.pf-shelf .jd-lead');
    await expect(shelfIntroFr).toContainText('Découvrez les coulisses, les rencontres et les moments qui rendent chaque réalisation de VMM Productions unique.');

    // EN
    await page.goto('/en/portfolio/');
    const shelfH2En = page.locator('#pf-coulisses-title');
    await expect(shelfH2En).toContainText('And behind every production,');
    const shelfIntroEn = page.locator('.pf-shelf .jd-lead');
    await expect(shelfIntroEn).toContainText('Discover the behind-the-scenes, encounters, and moments that make every VMM Productions project unique.');
  });
});
