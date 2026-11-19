import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

test.describe('PR D — Photo FAQ Contact selon maquettes 16:9 et 9:16 (FR + EN)', () => {
  // 1. Présence de la photo dans dist/ pour /contact/ et /en/contact/ (1 seule balise picture, plus de faq-photo-top)
  test('[PR-D #1] Photo présente dans dist/ pour /contact/ et /en/contact/ (1 seule balise picture, alt non vide, webp + jpg, plus de faq-photo-top)', async () => {
    for (const [lang, pagePath, expectedAlt] of [
      ['fr', join(ROOT, 'dist', 'contact', 'index.html'), 'JD au studio de VMM Productions'],
      ['en', join(ROOT, 'dist', 'en', 'contact', 'index.html'), 'JD in the VMM Productions studio'],
    ] as const) {
      expect(existsSync(pagePath), `Le fichier ${pagePath} doit exister`).toBe(true);
      const html = readFileSync(pagePath, 'utf8');

      // Balise picture présente dans .faq-photo-wrap
      expect(html).toMatch(/<div class="faq-photo-wrap"[^>]*><picture>/);

      // Plus de .faq-photo-top : une seule balise picture dans toute la section FAQ
      expect(html).not.toContain('faq-photo-top');
      const faqSectionMatch = html.match(/<section[^>]*section-faq[\s\S]*?<\/section>/);
      expect(faqSectionMatch).not.toBeNull();
      const pictureCount = (faqSectionMatch![0].match(/<picture>/g) || []).length;
      expect(pictureCount, 'Il doit y avoir exactement une seule balise picture dans la section FAQ').toBe(1);

      // Voile sombre présent pour le contraste
      expect(html).toContain('class="faq-veil"');

      // Sources webp et jpg présentes (470, 720, 941)
      expect(html).toContain('faq-jd.webp');
      expect(html).toContain('faq-jd.jpg');
      expect(html).toContain('faq-jd-720.webp');
      expect(html).toContain('faq-jd-470.webp');

      // Alt non vide et exact
      expect(html).toContain(`alt="${expectedAlt}"`);
    }
  });

  // 2. Desktop 16:9 (1920x1080, 1536x864, 1440x900, 1366x768, 1280x720) : disposition 2 colonnes, pleine hauteur
  test('[PR-D #2] Desktop 16:9 : photo à droite pleine hauteur (>= 98 %), accordéons à gauche, pas de chevauchement horizontal', async ({ page }) => {
    const viewport = page.viewportSize();
    test.skip(!viewport || viewport.width < 900, 'Test desktop seulement (>= 900px)');

    for (const url of ['/contact/', '/en/contact/']) {
      await page.goto(url);

      const faqSection = page.locator('section[aria-labelledby="faq-title"]');
      await expect(faqSection).toBeVisible();

      // Pas de faq-photo-top dans le DOM
      const topPhoto = faqSection.locator('.faq-photo-top');
      expect(await topPhoto.count()).toBe(0);

      const content = faqSection.locator('.faq-content');
      await expect(content).toBeVisible();

      const photoWrap = faqSection.locator('.faq-photo-wrap');
      await expect(photoWrap).toBeVisible();

      const photoImg = photoWrap.locator('img');
      await expect(photoImg).toBeVisible();

      const sectionBox = (await faqSection.boundingBox())!;
      const contentBox = (await content.boundingBox())!;
      const photoBox = (await photoImg.boundingBox())!;

      // Photo à droite des accordéons (centre X de la photo > centre X de la section)
      const photoCenterX = photoBox.x + photoBox.width / 2;
      const sectionCenterX = sectionBox.x + sectionBox.width / 2;
      expect(photoCenterX, `Le centre X de la photo (${photoCenterX}) doit être à droite du centre de la section (${sectionCenterX})`).toBeGreaterThan(sectionCenterX);

      // Accordéons à gauche (contentBox.x + contentBox.width <= photoBox.x)
      expect(contentBox.x + contentBox.width, 'Les accordéons doivent être à gauche de la photo sans chevauchement horizontal').toBeLessThanOrEqual(photoBox.x + 2);

      // Aucun chevauchement avec la photo
      const overlapX = Math.max(0, Math.min(contentBox.x + contentBox.width, photoBox.x + photoBox.width) - Math.max(contentBox.x, photoBox.x));
      expect(overlapX, 'Aucun chevauchement horizontal entre les accordéons et la photo de JD').toBe(0);

      // Pleine hauteur de la section : photoBox.height >= 98 % de sectionBox.height
      const heightRatio = photoBox.height / sectionBox.height;
      expect(heightRatio, `La photo (${photoBox.height}px) doit occuper au moins 98 % de la section (${sectionBox.height}px)`).toBeGreaterThanOrEqual(0.98);
    }
  });

  // 3. Mobile 9:16 (390x844, 390x664, 360x740, 430x932) : 1 seule image en fond, enseigne en haut, JD en bas, pas de chevauchement, pas de vide noir
  test('[PR-D #3] Mobile 9:16 : 1 seule image en fond pleine largeur, enseigne en haut, JD en bas au complet, visage non chevauché, pas de vide noir', async ({ page }) => {
    const viewport = page.viewportSize();
    test.skip(!viewport || viewport.width >= 900, 'Test mobile seulement (< 900px)');

    for (const url of ['/contact/', '/en/contact/']) {
      await page.goto(url);

      const faqSection = page.locator('section[aria-labelledby="faq-title"]');
      await expect(faqSection).toBeVisible();

      // Une seule photo dans la section FAQ (plus de .faq-photo-top)
      expect(await faqSection.locator('.faq-photo-top').count()).toBe(0);
      expect(await faqSection.locator('.faq-photo-wrap').count()).toBe(1);

      const titre = faqSection.locator('#faq-title');
      await expect(titre).toBeVisible();

      const accordeons = faqSection.locator('.faq-content details');
      expect(await accordeons.count()).toBe(4);

      const photoImg = faqSection.locator('.faq-photo-wrap img');
      await expect(photoImg).toBeVisible();

      const secBox = (await faqSection.boundingBox())!;
      const titreBox = (await titre.boundingBox())!;
      const lastDetailsBox = (await accordeons.last().boundingBox())!;

      // Calcul des coordonnées rendues de l'image (source 941x1672 avec object-fit: cover, object-position: center bottom)
      // Proportions relatives dans l'image source (largeur 941, hauteur 1672px) :
      // - Casquette haut = 800px (47.85%)
      // - Visage haut = 880px (52.63%), bas = 1140px (68.18%)
      // - Pupitre bas = 1500px (89.71%)
      const scale = Math.max(secBox.width / 941, secBox.height / 1672);
      const capTop = secBox.y + secBox.height - (1672 - 800) * scale;
      const faceTop = secBox.y + secBox.height - (1672 - 880) * scale;
      const faceBottom = secBox.y + secBox.height - (1672 - 1140) * scale;
      const deskBottom = secBox.y + secBox.height - (1672 - 1500) * scale;

      // 1. Hauteur de la section FAQ fermée = exactement un écran utile (<= viewport.height)
      expect(secBox.height, `La section FAQ fermée (${secBox.height}px) doit tenir dans l'écran mobile (${viewport.height}px)`).toBeLessThanOrEqual(viewport.height);

      // 2. Le visage entier de JD et son pupitre sont visibles dans la section
      expect(faceTop, 'Le haut du visage de JD doit être dans la section').toBeGreaterThanOrEqual(secBox.y);
      expect(faceBottom, 'Le bas du visage de JD doit être dans la section').toBeLessThanOrEqual(secBox.y + secBox.height);
      expect(deskBottom, 'Le pupitre de JD doit être dans la section').toBeLessThanOrEqual(secBox.y + secBox.height + 5);

      // 3. Les accordéons fermés ne chevauchent pas la casquette ou le visage de JD
      const closedContentBottom = lastDetailsBox.y + lastDetailsBox.height;
      expect(closedContentBottom, `Le contenu fermé (${closedContentBottom}) ne doit pas chevaucher la casquette de JD (${capTop})`).toBeLessThanOrEqual(capTop + 5);

      // 4. Pas de vide noir sous la section : écart avec le footer <= 24px
      const footer = page.locator('footer');
      const footerBox = (await footer.boundingBox())!;
      const gapToFooter = footerBox.y - (secBox.y + secBox.height);
      expect(gapToFooter, `L'écart entre la section FAQ et le footer (${gapToFooter}px) doit être <= 24px`).toBeLessThanOrEqual(24);

      // 5. Pas de défilement horizontal
      const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(hasHorizontalOverflow, 'La page ne doit pas avoir de défilement horizontal sur mobile').toBe(false);

      // 6. Typographie et cibles tactiles : texte >= 14px, cibles >= 44px
      const summaries = faqSection.locator('.faq-content summary');
      const sumCount = await summaries.count();
      for (let s = 0; s < sumCount; s++) {
        const sumBox = (await summaries.nth(s).boundingBox())!;
        expect(sumBox.height, `La cible tactile de chaque question doit être >= 44px (reçu ${sumBox.height}px)`).toBeGreaterThanOrEqual(43.5);
        const fontSize = await summaries.nth(s).evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
        expect(fontSize, `La taille de police de la question doit être >= 14px (reçu ${fontSize}px)`).toBeGreaterThanOrEqual(13.9);
      }
    }
  });

  // 4. Accordéons ouverts : réponses lisibles (contraste >= 4.5:1), pas de chevauchement sur JD
  test('[PR-D #4] Accordéons ouverts : réponse lisible (contraste >= 4.5:1), pas de chevauchement sur le visage de JD, défilement fluide', async ({ page }) => {
    for (const url of ['/contact/', '/en/contact/']) {
      await page.goto(url);

      const faqSection = page.locator('section[aria-labelledby="faq-title"]');
      const detailsList = faqSection.locator('.faq-content details');
      const count = await detailsList.count();
      expect(count).toBe(4);

      const viewport = page.viewportSize();
      const isMobile = viewport && viewport.width < 900;
      const photoImg = faqSection.locator('.faq-photo-wrap img');

      for (let i = 0; i < count; i++) {
        const item = detailsList.nth(i);
        const summary = item.locator('summary');
        await summary.click();

        await expect(item).toHaveAttribute('open', '');
        const paragraph = item.locator('p').first();
        await expect(paragraph).toBeVisible();

        // Vérification de contraste texte / fond (>= 4.5:1)
        const contrastRatio = await paragraph.evaluate((el) => {
          function lum(r: number, g: number, b: number) {
            const a = [r, g, b].map((v) => {
              v /= 255;
              return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            });
            return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
          }
          const textRgb = window.getComputedStyle(el).color.match(/\d+/g)!.map(Number);
          const l1 = lum(textRgb[0], textRgb[1], textRgb[2]);
          const l2 = lum(13, 9, 23); // #0d0917
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        });
        expect(contrastRatio, 'Le contraste de la réponse de FAQ doit être >= 4.5:1').toBeGreaterThanOrEqual(4.5);

        // Vérification d'absence de chevauchement avec le visage de JD
        if (isMobile) {
          // Mobile : l'élément ouvert ne doit jamais descendre sur le visage de JD
          const secBox = (await faqSection.boundingBox())!;
          const scale = Math.max(secBox.width / 941, secBox.height / 1672);
          const imgFaceTop = secBox.y + secBox.height - (1672 - 880) * scale;
          const itemBox = (await item.boundingBox())!;
          expect(itemBox.y + itemBox.height, `L accordéon ouvert (${itemBox.y + itemBox.height}) ne doit pas chevaucher le visage de JD (${imgFaceTop})`).toBeLessThanOrEqual(imgFaceTop + 5);
        } else {
          // Desktop : pas de chevauchement horizontal
          const photoBox = (await photoImg.boundingBox())!;
          const itemBox = (await item.boundingBox())!;
          expect(itemBox.x + itemBox.width, 'L accordéon ouvert ne doit pas chevaucher la photo sur desktop').toBeLessThanOrEqual(photoBox.x + 2);
        }

        // Fermer l'accordéon pour le test suivant
        await summary.click();
      }
    }
  });

  // 5. Parité FR / EN
  test('[PR-D #5] Parité FR / EN : structure, nombre d accordéons (4) et 1 seule image fond sans .faq-photo-top', async ({ page }) => {
    await page.goto('/contact/');
    const frCount = await page.locator('section[aria-labelledby="faq-title"] .faq-content details').count();
    const frHasTop = await page.locator('.faq-photo-top').count();
    const frHasWrap = await page.locator('.faq-photo-wrap').count();
    const frHasVeil = await page.locator('.faq-veil').count();

    await page.goto('/en/contact/');
    const enCount = await page.locator('section[aria-labelledby="faq-title"] .faq-content details').count();
    const enHasTop = await page.locator('.faq-photo-top').count();
    const enHasWrap = await page.locator('.faq-photo-wrap').count();
    const enHasVeil = await page.locator('.faq-veil').count();

    expect(frCount).toBe(4);
    expect(enCount).toBe(4);
    expect(frHasTop).toBe(0);
    expect(enHasTop).toBe(0);
    expect(frHasWrap).toBe(1);
    expect(enHasWrap).toBe(1);
    expect(frHasVeil).toBe(1);
    expect(enHasVeil).toBe(1);
  });

  // =========================================================================
  // AJOUT PR D — Liens JD (Événements 1NpXK1wLSl8 & Tapis Rouge 9 vidéos)
  // =========================================================================

  test('[PR-D #6] Tuile Événements : cliquable sur Accueil et Portfolio (FR + EN), pointe vers 1NpXK1wLSl8, miniature cat-evenements conservée, plus d état is-empty', async ({ page }) => {
    const PAGES = [
      { url: '/', cardSelector: '.hp-cards a.yt-tile.hp-card[href*="1NpXK1wLSl8"]', expectedLabel: 'Couverture événementielle' },
      { url: '/en/', cardSelector: '.hp-cards a.yt-tile.hp-card[href*="1NpXK1wLSl8"]', expectedLabel: 'Event coverage' },
      { url: '/portfolio/', cardSelector: '.pf-cat-grid a.yt-tile.pf-cat[href*="1NpXK1wLSl8"]', expectedLabel: 'Couverture événementielle' },
      { url: '/en/portfolio/', cardSelector: '.pf-cat-grid a.yt-tile.pf-cat[href*="1NpXK1wLSl8"]', expectedLabel: 'Event coverage' },
    ];

    for (const { url, cardSelector, expectedLabel } of PAGES) {
      await page.goto(url);

      // La tuile Événements existe et est un lien cliquable <a> vers 1NpXK1wLSl8
      const tileLink = page.locator(cardSelector);
      await expect(tileLink, `La tuile Événements doit être un lien cliquable sur ${url}`).toBeVisible();
      await expect(tileLink).toHaveAttribute('href', 'https://www.youtube.com/shorts/1NpXK1wLSl8');
      await expect(tileLink).toHaveAttribute('target', '_blank');
      await expect(tileLink).toHaveAttribute('rel', 'noopener');

      // Le libellé exact de la catégorie est affiché
      const label = tileLink.locator('.yt-tile-label');
      await expect(label).toHaveText(expectedLabel);

      // La miniature personnalisée cat-evenements est conservée
      const img = tileLink.locator('picture img');
      await expect(img).toBeVisible();
      await expect(img).toHaveAttribute('src', '/img/portfolio/cat-evenements.jpg');

      // Bouton play présent
      const playIcon = tileLink.locator('.play');
      await expect(playIcon).toBeVisible();

      // Plus aucun état « is-empty » sur la page pour les cartes de catégories
      const emptyCatTiles = page.locator('.hp-cards .yt-tile.is-empty, .pf-cat-grid .yt-tile.is-empty');
      expect(await emptyCatTiles.count(), `Aucune tuile de catégorie ne doit être is-empty sur ${url}`).toBe(0);
    }
  });

  // 7. Garde-fou de régression (déjà passant sur commit initial ff18994) : absence totale de la vidéo morte B7dWhLnxw08
  test('[PR-D #7] Vidéo morte B7dWhLnxw08 : totalement absente de dist/ (HTML, XML, JSON-LD) [garde-fou]', async () => {
    const DEAD_ID = 'B7dWhLnxw08';
    const { readdirSync, statSync } = await import('fs');

    function checkDir(dir: string) {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          checkDir(fullPath);
        } else if (/\.(html|xml|json|txt)$/.test(entry)) {
          const content = readFileSync(fullPath, 'utf8');
          expect(content.includes(DEAD_ID), `Le fichier ${fullPath} ne doit pas contenir ${DEAD_ID}`).toBe(false);
        }
      }
    }

    checkDir(join(ROOT, 'dist'));
  });

  test('[PR-D #8] Page Tapis Rouge (FR + EN) : 9 vidéos visibles dans la bibliothèque, contient 1NpXK1wLSl8 et u_HK2iiuUnw, ordre chronologique publie respecté, compteur 01 / 09', async ({ page }) => {
    const EXPECTED_IDS = [
      'hmrhpcyGGEk', // 2026-07-16
      'O2UTFiYzGU0', // 2026-07-21
      'kKz1pKN44dM', // 2026-07-27
      'g8pY-zSgljI', // 2026-08-08
      '3ru2cIaqzeo', // 2026-08-10
      't7zXkOFUdBs', // 2026-08-13
      'HeLdEo_awQ0', // 2026-08-16
      '1NpXK1wLSl8', // 2026-11-18T07:25:33-08:00
      'u_HK2iiuUnw', // 2026-11-18T07:31:48-08:00
    ];

    for (const [url, expectedCountText, expectedSr] of [
      ['/portfolio/tapis-rouge/', '9 vidéos', 'Vidéo 1 sur 9'],
      ['/en/portfolio/tapis-rouge/', '9 videos', 'Video 1 of 9'],
    ] as const) {
      await page.goto(url);

      // Compteur bibliothèque
      const counter = page.locator('.library-count');
      await expect(counter).toBeVisible();
      await expect(counter).toHaveAttribute('data-total', '9');
      await expect(counter.locator('[data-library-index]')).toHaveText('01');
      await expect(counter).toContainText('/ 09');
      await expect(counter.locator('.visually-hidden')).toHaveText(expectedSr);

      // 9 liens vidéo dans la bibliothèque
      const links = page.locator('.library-track a[href*="youtu"]');
      await expect(links).toHaveCount(9);

      // Extraction des 9 IDs vidéo dans l'ordre du DOM
      const renderedIds = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.library-track a[href*="youtu"]'))
          .map((el) => {
            const href = el.getAttribute('href') || '';
            const match = href.match(/(?:shorts\/|v=)([a-zA-Z0-9_-]{11})/);
            return match ? match[1] : '';
          })
          .filter(Boolean);
      });

      expect(renderedIds, `Ordre chronologique strict des 9 vidéos Tapis Rouge sur ${url}`).toEqual(EXPECTED_IDS);
      expect(renderedIds).toContain('1NpXK1wLSl8');
      expect(renderedIds).toContain('u_HK2iiuUnw');
    }

    // Bouton logo Tapis Rouge sur la page Portfolio (FR + EN) affiche bien 9 vidéos
    for (const [pfUrl, expectedText] of [
      ['/portfolio/', '9 vidéos'],
      ['/en/portfolio/', '9 videos'],
    ] as const) {
      await page.goto(pfUrl);
      const trCount = page.locator('.logo-btn[href*="tapis-rouge"] .logo-btn-count');
      await expect(trCount).toHaveText(expectedText);
    }
  });

  // 9. Étanchéité CSS : les pages de zones SEO ne reçoivent aucune règle de photo FAQ
  test('[PR-D #9] Pages de zones SEO : la section FAQ ne contient ni photo ni déformation CSS (max-width 52rem, padding normal)', async ({ page }) => {
    for (const url of ['/production-video-saint-jerome/', '/en/video-production-saint-jerome/']) {
      await page.goto(url);
      const faqSec = page.locator('section[aria-labelledby="zone-faq"]');
      await expect(faqSec).toBeVisible();

      // Pas de photo wrap ni de photo top
      expect(await faqSec.locator('.faq-photo-wrap').count()).toBe(0);
      expect(await faqSec.locator('.faq-photo-top').count()).toBe(0);
      expect(await faqSec.locator('.faq-veil').count()).toBe(0);

      // Pas de classe section-faq--photo ou faq-with-photo
      const className = (await faqSec.getAttribute('class')) || '';
      expect(className).not.toContain('section-faq--photo');
      expect(className).not.toContain('faq-with-photo');

      // Le conteneur .faq a un padding raisonnable (pas les 310px / 720px)
      const faqContainer = faqSec.locator('.faq');
      const paddingTop = await faqContainer.evaluate((el) => parseFloat(window.getComputedStyle(el).paddingTop));
      expect(paddingTop, `Le padding-top de la FAQ sur ${url} doit être normal (< 50px)`).toBeLessThan(50);
    }
  });
});
