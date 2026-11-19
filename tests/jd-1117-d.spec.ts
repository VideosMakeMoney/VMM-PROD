import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

test.describe('PR D — Photo FAQ Contact selon maquettes 16:9 et 9:16 (FR + EN)', () => {
  // 1. Présence de la photo dans dist/ pour /contact/ et /en/contact/
  test('[PR-D #1] Photo présente dans dist/ pour /contact/ et /en/contact/ (picture, alt non vide, webp + jpg)', async () => {
    for (const [lang, pagePath, expectedAlt] of [
      ['fr', join(ROOT, 'dist', 'contact', 'index.html'), 'JD au studio de VMM Productions'],
      ['en', join(ROOT, 'dist', 'en', 'contact', 'index.html'), 'JD in the VMM Productions studio'],
    ] as const) {
      expect(existsSync(pagePath), `Le fichier ${pagePath} doit exister`).toBe(true);
      const html = readFileSync(pagePath, 'utf8');

      // Balise picture présente dans .faq-photo-wrap
      expect(html).toMatch(/<div class="faq-photo-wrap"[^>]*><picture>/);

      // Balise picture présente dans .faq-photo-top pour mobile
      expect(html).toMatch(/<div class="faq-photo-top"[^>]*><picture>/);

      // Sources webp et jpg présentes
      expect(html).toContain('faq-jd.webp');
      expect(html).toContain('faq-jd.jpg');

      // Alt non vide et exact
      expect(html).toContain(`alt="${expectedAlt}"`);
    }
  });

  // 2. Desktop 16:9 (1920x1080 et 1366x768) : disposition 2 colonnes
  test('[PR-D #2] Desktop 16:9 (1920x1080 et 1366x768) : photo à droite, accordéons à gauche, pas de chevauchement, ratio préservé', async ({ page }) => {
    const viewport = page.viewportSize();
    test.skip(!viewport || viewport.width < 900, 'Test desktop seulement (>= 900px)');

    for (const url of ['/contact/', '/en/contact/']) {
      await page.goto(url);

      const faqSection = page.locator('section[aria-labelledby="faq-title"]');
      await expect(faqSection).toBeVisible();

      const topPhoto = faqSection.locator('.faq-photo-top');
      await expect(topPhoto).toBeHidden(); // display: none sur desktop

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

      // Aucun chevauchement avec le visage de JD ou la photo
      const overlapX = Math.max(0, Math.min(contentBox.x + contentBox.width, photoBox.x + photoBox.width) - Math.max(contentBox.x, photoBox.x));
      expect(overlapX, 'Aucun chevauchement entre les accordéons et la photo de JD').toBe(0);

      // Ratio d'aspect préservé à ± 2 % (941 / 1672 = 0.562799...)
      const renderedRatio = photoBox.width / photoBox.height;
      const expectedRatio = 941 / 1672;
      const diffRatio = Math.abs(renderedRatio - expectedRatio) / expectedRatio;
      expect(diffRatio, `Le ratio rendu (${renderedRatio}) doit être à ± 2 % du ratio original (${expectedRatio})`).toBeLessThan(0.02);
    }
  });

  // 3. Mobile 9:16 (390x844, 390x664, 360x740) : ordre vertical enseigne -> titre -> accordéons -> JD, pas de débordement horizontal
  test('[PR-D #3] Mobile 9:16 : ordre vertical enseigne en haut -> titre -> accordéons -> JD en bas, pas de défilement horizontal', async ({ page }) => {
    const viewport = page.viewportSize();
    test.skip(!viewport || viewport.width >= 900, 'Test mobile seulement (< 900px)');

    for (const url of ['/contact/', '/en/contact/']) {
      await page.goto(url);

      const faqSection = page.locator('section[aria-labelledby="faq-title"]');
      await expect(faqSection).toBeVisible();

      const enseigne = faqSection.locator('.faq-photo-top');
      await expect(enseigne).toBeVisible();

      const titre = faqSection.locator('#faq-title');
      await expect(titre).toBeVisible();

      const accordeons = faqSection.locator('.faq-content details').first();
      await expect(accordeons).toBeVisible();

      const jd = faqSection.locator('.faq-photo-wrap');
      await expect(jd).toBeVisible();

      const enseigneBox = (await enseigne.boundingBox())!;
      const titreBox = (await titre.boundingBox())!;
      const accordeonsBox = (await accordeons.boundingBox())!;
      const jdBox = (await jd.boundingBox())!;

      // Ordre vertical : rect(enseigne).bottom <= rect(titre).top <= rect(accordéons).top <= rect(JD).top
      expect(enseigneBox.y + enseigneBox.height, `L'enseigne VMM (${enseigneBox.y + enseigneBox.height}) doit précéder le titre FAQ (${titreBox.y})`).toBeLessThanOrEqual(titreBox.y + 2);
      expect(titreBox.y + titreBox.height, `Le titre FAQ (${titreBox.y + titreBox.height}) doit précéder les accordéons (${accordeonsBox.y})`).toBeLessThanOrEqual(accordeonsBox.y + 2);
      expect(accordeonsBox.y, `Les accordéons (${accordeonsBox.y}) doivent précéder la photo JD (${jdBox.y})`).toBeLessThanOrEqual(jdBox.y + 2);

      // Pas de défilement horizontal
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow, 'La page ne doit pas avoir de défilement horizontal sur mobile').toBe(false);
    }
  });

  // 4. Accordéons ouverts : réponses lisibles (contraste >= 4.5:1), pas de débordement ni de chevauchement sur JD
  test('[PR-D #4] Accordéons ouverts : réponse lisible (contraste >= 4.5:1), pas de chevauchement sur JD, défilement fluide', async ({ page }) => {
    for (const url of ['/contact/', '/en/contact/']) {
      await page.goto(url);

      const faqSection = page.locator('section[aria-labelledby="faq-title"]');
      const detailsList = faqSection.locator('.faq-content details');
      const count = await detailsList.count();
      expect(count).toBe(4);

      const jd = faqSection.locator('.faq-photo-wrap');

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
          // Fond sombre VMM #0d0917 -> rgb(13, 9, 23)
          const l1 = lum(textRgb[0], textRgb[1], textRgb[2]);
          const l2 = lum(13, 9, 23);
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        });
        expect(contrastRatio, 'Le contraste de la réponse de FAQ doit être >= 4.5:1').toBeGreaterThanOrEqual(4.5);

        // Vérification d'absence de chevauchement avec la photo de JD
        const viewport = page.viewportSize();
        if (viewport && viewport.width >= 900) {
          // Desktop : pas de chevauchement horizontal
          const itemBox = (await item.boundingBox())!;
          const jdBox = (await jd.boundingBox())!;
          expect(itemBox.x + itemBox.width, 'L accordéon ouvert ne doit pas chevaucher la photo sur desktop').toBeLessThanOrEqual(jdBox.x + 2);
        } else {
          // Mobile : accordéon ouvert reste au-dessus de la photo de JD
          const itemBox = (await item.boundingBox())!;
          const jdBox = (await jd.boundingBox())!;
          expect(itemBox.y + itemBox.height, 'L accordéon ouvert ne doit pas chevaucher la photo sur mobile').toBeLessThanOrEqual(jdBox.y + 2);
        }

        // Fermer l'accordéon pour le test suivant
        await summary.click();
      }
    }
  });

  // 5. Parité FR / EN
  test('[PR-D #5] Parité FR / EN : structure, nombre d accordéons (4) et attributs identiques', async ({ page }) => {
    await page.goto('/contact/');
    const frCount = await page.locator('section[aria-labelledby="faq-title"] .faq-content details').count();
    const frHasTop = await page.locator('.faq-photo-top').count();
    const frHasWrap = await page.locator('.faq-photo-wrap').count();

    await page.goto('/en/contact/');
    const enCount = await page.locator('section[aria-labelledby="faq-title"] .faq-content details').count();
    const enHasTop = await page.locator('.faq-photo-top').count();
    const enHasWrap = await page.locator('.faq-photo-wrap').count();

    expect(frCount).toBe(4);
    expect(enCount).toBe(4);
    expect(frHasTop).toBe(1);
    expect(enHasTop).toBe(1);
    expect(frHasWrap).toBe(1);
    expect(enHasWrap).toBe(1);
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

  test('[PR-D #7] Vidéo morte B7dWhLnxw08 : totalement absente de dist/ (HTML, XML, JSON-LD)', async () => {
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
});
