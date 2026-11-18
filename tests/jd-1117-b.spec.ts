import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

test.describe('Ajustements JD du 17 nov. 2026 — PR B : À propos + Accueil p5', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Point 1 — À propos p. 2 et 3, mobile (9:16) : photos de JD et Renaud
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #1] Mobile WebKit & Chromium : Photos JD et Renaud visibles, largeur >= 250px et sans déformation (FR + EN)', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.startsWith('mobile');
    test.skip(!isMobile, 'Test spécifique au layout mobile (9:16)');

    for (const path of ['/about/', '/en/about/']) {
      await page.goto(path);

      // Section 1 : Jean-David (#jd)
      const jdImg = page.locator('#jd .person-photo img');
      await expect(jdImg, `Photo JD doit être visible sur ${path}`).toBeVisible();
      const jdBox = await jdImg.boundingBox();
      expect(jdBox, `Bounding box de la photo JD sur ${path} doit exister`).not.toBeNull();
      expect(jdBox!.width, `Largeur photo JD sur ${path} (${testInfo.project.name}) >= 250px`).toBeGreaterThanOrEqual(250);
      expect(jdBox!.height, `Hauteur photo JD sur ${path} (${testInfo.project.name}) >= 250px`).toBeGreaterThanOrEqual(250);

      const jdMetrics = await jdImg.evaluate((img: HTMLImageElement) => {
        const style = window.getComputedStyle(img);
        return {
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          objectFit: style.objectFit,
          renderedRatio: img.offsetWidth / img.offsetHeight,
        };
      });
      expect(jdMetrics.naturalWidth).toBeGreaterThan(0);
      expect(jdMetrics.naturalHeight).toBeGreaterThan(0);
      expect(jdMetrics.objectFit).toBe('cover');
      // Cadre presque carré (environ 1:1, tolérance ratio entre 0.80 et 1.25)
      expect(jdMetrics.renderedRatio).toBeGreaterThanOrEqual(0.80);
      expect(jdMetrics.renderedRatio).toBeLessThanOrEqual(1.25);

      // Section 2 : Renaud (#renaud)
      const renaudImg = page.locator('#renaud .person-photo img');
      await expect(renaudImg, `Photo Renaud doit être visible sur ${path}`).toBeVisible();
      const renaudBox = await renaudImg.boundingBox();
      expect(renaudBox, `Bounding box de la photo Renaud sur ${path} doit exister`).not.toBeNull();
      expect(renaudBox!.width, `Largeur photo Renaud sur ${path} (${testInfo.project.name}) >= 250px`).toBeGreaterThanOrEqual(250);
      expect(renaudBox!.height, `Hauteur photo Renaud sur ${path} (${testInfo.project.name}) >= 250px`).toBeGreaterThanOrEqual(250);

      const renaudMetrics = await renaudImg.evaluate((img: HTMLImageElement) => {
        const style = window.getComputedStyle(img);
        return {
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          objectFit: style.objectFit,
          renderedRatio: img.offsetWidth / img.offsetHeight,
        };
      });
      expect(renaudMetrics.naturalWidth).toBeGreaterThan(0);
      expect(renaudMetrics.naturalHeight).toBeGreaterThan(0);
      expect(renaudMetrics.objectFit).toBe('cover');
      expect(renaudMetrics.renderedRatio).toBeGreaterThanOrEqual(0.80);
      expect(renaudMetrics.renderedRatio).toBeLessThanOrEqual(1.25);
    }
  });

  test('[JD-1117 #1] Desktop 1366×768 & 1920×1080 : Photos JD et Renaud restent identiques au desktop (FR + EN)', async ({
    page,
  }, testInfo) => {
    const isDesktop = testInfo.project.name.startsWith('desktop');
    test.skip(!isDesktop, 'Test spécifique au layout desktop (16:9)');

    for (const path of ['/about/', '/en/about/']) {
      await page.goto(path);
      const jdImg = page.locator('#jd .person-photo img');
      await expect(jdImg).toBeVisible();
      const jdBox = await jdImg.boundingBox();
      expect(jdBox).not.toBeNull();
      expect(jdBox!.width).toBeGreaterThanOrEqual(300);

      const renaudImg = page.locator('#renaud .person-photo img');
      await expect(renaudImg).toBeVisible();
      const renaudBox = await renaudImg.boundingBox();
      expect(renaudBox).not.toBeNull();
      expect(renaudBox!.width).toBeGreaterThanOrEqual(300);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Point 2 — À propos, section « Derrière chaque image, il y a des gens. »
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #2] Mobile : Haut de la photo sous le bouton, sans rognage du haut du sujet (FR + EN)', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.startsWith('mobile');
    test.skip(!isMobile, 'Test spécifique au layout mobile (9:16)');

    for (const path of ['/about/', '/en/about/']) {
      await page.goto(path);

      const visionSec = page.locator('#vision.jd-photo-split');
      await expect(visionSec).toBeVisible();

      const btn = visionSec.locator('.cta-row .btn');
      await expect(btn).toBeVisible();
      const btnBox = await btn.boundingBox();
      expect(btnBox).not.toBeNull();

      const img = visionSec.locator('.jd-split-photo img');
      await expect(img).toBeVisible();
      const imgBox = await img.boundingBox();
      expect(imgBox).not.toBeNull();
      expect(imgBox!.width).toBeGreaterThan(100);
      expect(imgBox!.height).toBeGreaterThan(200);

      // Le haut de l'image affichée se trouve sous le bas du bouton
      expect(
        imgBox!.y,
        `Le haut de la photo (${imgBox!.y}px) doit être sous le bouton (${btnBox!.y + btnBox!.height}px)`
      ).toBeGreaterThanOrEqual(btnBox!.y + btnBox!.height - 4);

      // Vérification que le haut de l'image source n'est pas rogné (pas de margin-top négatif ni object-position qui coupe le haut)
      const imgDetails = await img.evaluate((el: HTMLImageElement) => {
        const style = window.getComputedStyle(el);
        return {
          objectFit: style.objectFit,
          objectPosition: style.objectPosition,
          marginTop: parseFloat(style.marginTop) || 0,
        };
      });

      expect(imgDetails.marginTop, 'Pas de margin-top négatif qui repousse la tête au-delà du conteneur').toBeGreaterThanOrEqual(0);
      // object-position ne doit pas être décalé vers le bas pour rogner le haut (y ne doit pas être négatif)
      expect(imgDetails.objectFit).toBe('contain');
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Point 3 — Coulisses : Suppression définitive des photos 02 à 05
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #3] Coulisses : Fichiers 02 à 05 supprimés du repo et de dist/, total = 14 photos (FR + EN)', async ({
    page,
  }) => {
    const COULISSES_DIR = join(ROOT, 'static', 'img', 'coulisses');
    const DIST_COULISSES_DIR = join(ROOT, 'dist', 'img', 'coulisses');

    // Vérification de la suppression des fichiers sources dans static/
    for (const num of ['02', '03', '04', '05']) {
      const fullWebp = join(COULISSES_DIR, `coulisses-${num}.webp`);
      const smallWebp = join(COULISSES_DIR, `coulisses-${num}-576.webp`);
      expect(existsSync(fullWebp), `static/img/coulisses/coulisses-${num}.webp ne doit plus exister`).toBe(false);
      expect(existsSync(smallWebp), `static/img/coulisses/coulisses-${num}-576.webp ne doit plus exister`).toBe(false);

      if (existsSync(DIST_COULISSES_DIR)) {
        const distFull = join(DIST_COULISSES_DIR, `coulisses-${num}.webp`);
        const distSmall = join(DIST_COULISSES_DIR, `coulisses-${num}-576.webp`);
        expect(existsSync(distFull), `dist/img/coulisses/coulisses-${num}.webp ne doit plus exister`).toBe(false);
        expect(existsSync(distSmall), `dist/img/coulisses/coulisses-${num}-576.webp ne doit plus exister`).toBe(false);
      }
    }

    // coulisses-01 doit TOUJOURS exister (en attente de confirmation JD)
    expect(existsSync(join(COULISSES_DIR, 'coulisses-01.webp')), 'coulisses-01.webp doit être préservé').toBe(true);

    // Vérification sur les pages /about/ et /en/about/
    for (const path of ['/about/', '/en/about/']) {
      await page.goto(path);

      const html = await page.content();
      for (const num of ['02', '03', '04', '05']) {
        expect(html, `${path} ne doit pas contenir coulisses-${num}`).not.toContain(`coulisses-${num}`);
      }

      // Nombre total de vignettes dans la grille
      const thumbs = page.locator('.coulisses-grid li');
      const count = await thumbs.count();
      expect(count, `Nombre de photos dans la grille sur ${path} doit être de 14`).toBe(14);

      // Visionneuse data-total
      const viewer = page.locator('[data-photo-viewer]');
      await expect(viewer).toHaveAttribute('data-total', '14');

      // Vérification des alt text « photo X sur 14 » ou « photo X of 14 »
      const isEn = path.includes('/en/');
      const expectedAltRegex = isEn ? /photo \d+ of 14/ : /photo \d+ sur 14/;
      const firstImgAlt = await page.locator('.coulisses-grid li:first-child img').getAttribute('alt');
      expect(firstImgAlt).toMatch(expectedAltRegex);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Point 5 — Accueil p. 5 : Rapprochement & agrandissement photo JD + uniformisation bouton
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #5] Desktop 16:9 : JD agrandi (>= 90% hauteur section), écart horizontal avec texte <= 40px (FR + EN)', async ({
    page,
  }, testInfo) => {
    const isDesktop = testInfo.project.name.startsWith('desktop');
    test.skip(!isDesktop, 'Test spécifique au layout desktop 16:9');

    for (const path of ['/', '/en/']) {
      await page.goto(path);

      const contactSec = page.locator('#contact');
      await expect(contactSec).toBeVisible();
      const secBox = await contactSec.boundingBox();
      expect(secBox).not.toBeNull();

      const img = contactSec.locator('.home-contact-photo img');
      await expect(img).toBeVisible();
      const imgBox = await img.boundingBox();
      expect(imgBox).not.toBeNull();

      const text = contactSec.locator('.home-split-text');
      await expect(text).toBeVisible();
      const textBox = await text.boundingBox();
      expect(textBox).not.toBeNull();

      // (a) Hauteur photo >= 90% de la hauteur de la section
      const photoHeightRatio = imgBox!.height / secBox!.height;
      expect(
        photoHeightRatio,
        `Hauteur photo (${imgBox!.height}px) sur section (${secBox!.height}px) doit être >= 90% sur ${path} (${testInfo.project.name})`
      ).toBeGreaterThanOrEqual(0.90);

      // (a) Écart horizontal entre bord droit visible du sujet et début du texte <= 40px
      const imgRight = imgBox!.x + imgBox!.width;
      const textLeft = textBox!.x;
      const gap = Math.abs(textLeft - imgRight);
      expect(
        gap,
        `Écart horizontal (|${textLeft} - ${imgRight}| = ${gap.toFixed(1)}px) doit être <= 40px sur ${path} (${testInfo.project.name})`
      ).toBeLessThanOrEqual(40);
    }
  });

  test('[JD-1117 #5] Toutes résolutions : Bouton CONTACTEZ-NOUS de taille et police uniformes avec bouton héros (FR + EN)', async ({
    page,
  }, testInfo) => {
    for (const path of ['/', '/en/']) {
      await page.goto(path);

      const heroBtn = page.locator('.hero .hero-cta');
      await expect(heroBtn).toBeVisible();
      const heroMetrics = await heroBtn.evaluate((el: HTMLElement) => {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { height: Math.round(r.height), fontSize: parseFloat(s.fontSize) };
      });

      const contactBtn = page.locator('#contact .cta-row .btn');
      await expect(contactBtn).toBeVisible();
      const contactMetrics = await contactBtn.evaluate((el: HTMLElement) => {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { height: Math.round(r.height), fontSize: parseFloat(s.fontSize) };
      });

      // Bouton uniformisé à ±2 px de la hauteur et taille de police du bouton héros
      expect(
        Math.abs(contactMetrics.height - heroMetrics.height),
        `Hauteur bouton contact (${contactMetrics.height}px) vs héros (${heroMetrics.height}px) sur ${path} (${testInfo.project.name}) à ±2px`
      ).toBeLessThanOrEqual(2);

      expect(
        Math.abs(contactMetrics.fontSize - heroMetrics.fontSize),
        `Taille de police contact (${contactMetrics.fontSize}px) vs héros (${heroMetrics.fontSize}px) sur ${path} (${testInfo.project.name}) à ±2px`
      ).toBeLessThanOrEqual(2);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Point 13 — Parité et étanchéité linguistique FR / EN
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #13] Étanchéité linguistique : aucun texte FR dans les pages EN et aucun texte EN dans les pages FR', async ({
    page,
  }) => {
    // Vérification sur /about/ vs /en/about/
    await page.goto('/about/');
    const frAboutContent = await page.content();
    expect(frAboutContent).toContain('Fondateur / Vidéaste');
    expect(frAboutContent).toContain('Caméraman');
    expect(frAboutContent).toContain('Coulisses');
    expect(frAboutContent).not.toContain('Founder / Videographer');
    expect(frAboutContent).not.toContain('Behind the scenes');

    await page.goto('/en/about/');
    const enAboutContent = await page.content();
    expect(enAboutContent).toContain('Founder / Videographer');
    expect(enAboutContent).toContain('Camera operator');
    expect(enAboutContent).toContain('Behind the scenes');
    expect(enAboutContent).not.toContain('Fondateur / Vidéaste');
    expect(enAboutContent).not.toContain('Coulisses de tournage');

    // Vérification sur / vs /en/
    await page.goto('/');
    const frHomeContent = await page.content();
    expect(frHomeContent).toContain('CONTACTEZ-NOUS');
    expect(frHomeContent).not.toContain('CONTACT US');

    await page.goto('/en/');
    const enHomeContent = await page.content();
    expect(enHomeContent).toContain('CONTACT US');
    expect(enHomeContent).not.toContain('CONTACTEZ-NOUS');
  });
});
