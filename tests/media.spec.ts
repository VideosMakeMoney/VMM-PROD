import { test, expect } from '@playwright/test';
import { PAGES } from './helpers';
import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve('dist');

test.describe('Vérification par page : médias, liens, absence de 404 et absence d\'erreurs console', () => {
  for (const pageDef of PAGES) {
    test(`page ${pageDef.name} (${pageDef.url})`, async ({ page, request }) => {
      const badResponses: { url: string; status: number }[] = [];
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      // 1. Écoute des requêtes 404 / 500
      page.on('response', (res) => {
        const status = res.status();
        if (status === 404 || status >= 500) {
          badResponses.push({ url: res.url(), status });
        }
      });

      // 2. Écoute des erreurs console
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // 2b. Écoute des exceptions non capturées
      page.on('pageerror', (err) => {
        pageErrors.push(err.message);
      });

      await page.goto(pageDef.url);
      await page.waitForLoadState('networkidle');

      // Vérification 1 & 2
      expect(badResponses, `Requêtes 404/500 sur ${pageDef.url}`).toEqual([]);
      expect(consoleErrors, `Erreurs console sur ${pageDef.url}`).toEqual([]);
      expect(pageErrors, `Page errors sur ${pageDef.url}`).toEqual([]);

      // 3. Vidéos et posters
      const videos = await page.locator('video').all();
      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        const className = await v.evaluate((el) => el.className);
        const isMuted = await v.evaluate((el: HTMLVideoElement) => el.muted || el.hasAttribute('muted'));
        const playsinline = await v.evaluate((el) => el.hasAttribute('playsinline'));
        const loop = await v.evaluate((el: HTMLVideoElement) => el.loop || el.hasAttribute('loop'));
        const poster = await v.evaluate((el: HTMLVideoElement) => {
          if (el.getAttribute('poster') || el.poster) return el.getAttribute('poster') || el.poster;
          const container = el.closest('.hero-media, .hero, .bg-video, .camera-stage') || el.parentElement;
          const img = container?.querySelector('picture img, img.hero-poster, .bg-video-poster img') as HTMLImageElement;
          return img?.getAttribute('src') || img?.src || '';
        });

        expect(isMuted, `Vidéo [${i}] (${className}) sur ${pageDef.url} doit être muted`).toBe(true);
        expect(playsinline, `Vidéo [${i}] (${className}) sur ${pageDef.url} doit avoir playsinline`).toBe(true);
        if (className.includes('bg-video') || className.includes('camera-video')) {
          expect(loop, `Vidéo [${i}] (${className}) sur ${pageDef.url} doit être en boucle (loop)`).toBe(true);
        }

        expect(poster, `Vidéo [${i}] (${className}) sur ${pageDef.url} doit avoir un poster`).toBeTruthy();
        const posterPath = new URL(poster, 'http://localhost:8080').pathname;
        const diskFile = path.join(DIST_DIR, posterPath);
        expect(fs.existsSync(diskFile), `Fichier poster ${posterPath} absent de dist/`).toBe(true);
        expect(fs.statSync(diskFile).size, `Fichier poster ${posterPath} est vide`).toBeGreaterThan(0);
      }

      // 4. Titre animé / logo 3D : absence de rectangle noir
      const logoSpin = page.locator('.logo-spin');
      if (await logoSpin.count() > 0) {
        const bg = await logoSpin.first().evaluate((el) => window.getComputedStyle(el).backgroundColor);
        expect(bg, `Logo 3D sur ${pageDef.url} ne doit pas avoir un fond noir opaque`).not.toBe('rgb(0, 0, 0)');
        expect(bg, `Logo 3D sur ${pageDef.url} doit avoir un fond transparent`).toBe('rgba(0, 0, 0, 0)');

        const faces = await page.locator('.logo-face').all();
        for (const face of faces) {
          const faceBg = await face.evaluate((el) => window.getComputedStyle(el).backgroundColor);
          expect(faceBg).toBe('rgba(0, 0, 0, 0)');
        }
      }

      const titles = await page.locator('.hero-title, .hero-stack, .hero-word, .accent').all();
      for (const titleEl of titles) {
        const titleBg = await titleEl.evaluate((el) => window.getComputedStyle(el).backgroundColor);
        expect(titleBg, `Titre sur ${pageDef.url} ne doit pas avoir un fond noir opaque`).not.toBe('rgb(0, 0, 0)');
      }

      const cameraVideo = page.locator('.camera-video');
      if (await cameraVideo.count() > 0) {
        const camBlend = await cameraVideo.first().evaluate((el) => window.getComputedStyle(el).mixBlendMode);
        expect(camBlend, `mix-blend-mode de camera-video doit être lighten`).toBe('lighten');
      }

      // 5. Liens internes tous valides (status 200) et miniatures YouTube
      const anchors = await page.locator('a[href]').all();
      const verifiedPaths = new Set<string>();
      for (const a of anchors) {
        const href = await a.getAttribute('href');
        if (!href) continue;

        if (href.startsWith('#')) {
          const anchorId = href.slice(1);
          if (anchorId) {
            const targetEl = page.locator(`#${anchorId}`);
            expect(await targetEl.count(), `Ancre ${href} non trouvée sur ${pageDef.url}`).toBeGreaterThan(0);
          }
        } else if (href.startsWith('/') && !href.startsWith('//')) {
          const [cleanPath] = href.split('#');
          if (!verifiedPaths.has(cleanPath)) {
            verifiedPaths.add(cleanPath);
            const res = await request.get(cleanPath);
            expect(res.status(), `Lien ${href} sur ${pageDef.url} doit retourner 200`).toBe(200);
          }
        }
      }

      const videoTiles = await page.locator('a[data-video], a.tile').all();
      for (const tile of videoTiles) {
        const href = await tile.getAttribute('href');
        const videoId = await tile.getAttribute('data-video');

        if (href) {
          const isWatch = href.startsWith('https://www.youtube.com/watch?v=');
          const isShorts = href.startsWith('https://www.youtube.com/shorts/');
          expect(isWatch || isShorts, `Lien YouTube invalide sur ${pageDef.url}: ${href}`).toBe(true);
        }

        if (videoId !== null) {
          expect(videoId.length, `data-video vide sur ${pageDef.url}`).toBeGreaterThan(0);
        }

        const img = tile.locator('img');
        if (await img.count() > 0) {
          const src = await img.getAttribute('src');
          expect(src, `Miniature YouTube invalide sur ${pageDef.url}: ${src}`).toMatch(/^https:\/\/i\.ytimg\.com\//);
        }
      }
    });
  }
});

test.describe('Fichiers lourds et optimisation des médias publics', () => {
  test('aucun fichier public > 5 Mo et fichiers PNG/MP4 optimisés dans static/ et dist/', async () => {
    const MAX_FILE_SIZE = 5 * 1000 * 1000; // 5 Mo
    const baselineHeavyFiles = new Set([
      'videos/jd/hero-accueil-16x9.mp4',
      'videos/jd/hero-accueil-16x9.webm',
      'videos/jd/hero-accueil-9x16.mp4',
      'videos/jd/hero-accueil-9x16.webm',
      'videos/jd/hero-ordi.mp4',
      'videos/jd/portfolio-hero-mobile.webm',
      'videos/jd/portfolio-hero-ordi.mp4',
      'videos/jd/portfolio-hero-ordi.webm',
      'videos/jd/services-9x16-ancien.webm',
      'videos/jd/work-16x9.mp4',
      'videos/jd/work-9x16-ancien.webm',
      'videos/jd/work-9x16.mp4',
      'videos/jd/work-9x16.webm',
      'videos/vmm-camera-scroll.webm',
    ]);

    const heavyFiles: { file: string; size: number }[] = [];
    const nonOptimizedPng: { file: string; size: number }[] = [];
    const nonOptimizedMp4: { file: string; size: number }[] = [];

    const dirs = ['static', 'dist'];

    for (const dir of dirs) {
      const fullDir = path.resolve(dir);
      if (!fs.existsSync(fullDir)) continue;

      const scanDir = (currentDir: string) => {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullEntry = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullEntry);
          } else if (entry.isFile()) {
            const relPath = path.normalize(path.relative(path.resolve('.'), fullEntry));
            const cleanRel = relPath.replace(/\\/g, '/').replace(/^(?:static|dist)\//, '');

            if (baselineHeavyFiles.has(cleanRel)) {
              continue;
            }

            const stat = fs.statSync(fullEntry);
            const ext = path.extname(entry.name).toLowerCase();

            if (stat.size > MAX_FILE_SIZE) {
              heavyFiles.push({ file: relPath, size: stat.size });
            }

            if (ext === '.png' && stat.size > 1.5 * 1024 * 1024) {
              nonOptimizedPng.push({ file: relPath, size: stat.size });
            }

            if (ext === '.mp4' && stat.size > MAX_FILE_SIZE) {
              nonOptimizedMp4.push({ file: relPath, size: stat.size });
            }
          }
        }
      };
      scanDir(fullDir);
    }

    expect(heavyFiles, `Fichiers non autorisés > 5 Mo trouvés dans static/ et dist/`).toEqual([]);
    expect(nonOptimizedPng, `Fichiers PNG non optimisés (> 1.5 Mo) trouvés`).toEqual([]);
    expect(nonOptimizedMp4, `Fichiers MP4 non optimisés (> 5 Mo) trouvés`).toEqual([]);
  });
});
