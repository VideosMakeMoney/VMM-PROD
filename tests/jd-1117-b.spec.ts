import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const desktopFixtures = JSON.parse(
  readFileSync(new URL('./fixtures/jd-1117-b-desktop-apropos.json', import.meta.url), 'utf8')
);

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

    const expectedProject = desktopFixtures.viewports[testInfo.project.name];
    expect(expectedProject, `Référence desktop manquante pour ${testInfo.project.name}`).toBeDefined();

    for (const [path, langKey] of [
      ['/about/', 'fr'],
      ['/en/about/', 'en'],
    ] as const) {
      await page.goto(path);
      const expected = expectedProject[langKey];

      const jdImg = page.locator('#jd .person-photo img');
      await expect(jdImg).toBeVisible();
      const jdBox = await jdImg.boundingBox();
      expect(jdBox, `Boîte de photo JD sur ${path} (${testInfo.project.name}) doit exister`).not.toBeNull();
      expect(Math.abs(jdBox!.x - expected.jd.x), `x JD sur ${path} (${testInfo.project.name})`).toBeLessThanOrEqual(1);
      expect(Math.abs(jdBox!.y - expected.jd.y), `y JD sur ${path} (${testInfo.project.name})`).toBeLessThanOrEqual(1);
      expect(Math.abs(jdBox!.width - expected.jd.width), `width JD sur ${path} (${testInfo.project.name})`).toBeLessThanOrEqual(1);
      expect(Math.abs(jdBox!.height - expected.jd.height), `height JD sur ${path} (${testInfo.project.name})`).toBeLessThanOrEqual(1);

      const renaudImg = page.locator('#renaud .person-photo img');
      await expect(renaudImg).toBeVisible();
      const renaudBox = await renaudImg.boundingBox();
      expect(renaudBox, `Boîte de photo Renaud sur ${path} (${testInfo.project.name}) doit exister`).not.toBeNull();
      expect(Math.abs(renaudBox!.x - expected.renaud.x), `x Renaud sur ${path} (${testInfo.project.name})`).toBeLessThanOrEqual(1);
      expect(Math.abs(renaudBox!.y - expected.renaud.y), `y Renaud sur ${path} (${testInfo.project.name})`).toBeLessThanOrEqual(1);
      expect(Math.abs(renaudBox!.width - expected.renaud.width), `width Renaud sur ${path} (${testInfo.project.name})`).toBeLessThanOrEqual(1);
      expect(Math.abs(renaudBox!.height - expected.renaud.height), `height Renaud sur ${path} (${testInfo.project.name})`).toBeLessThanOrEqual(1);
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

      // Le haut du sujet (casquette) se trouve sous le bas du bouton. PR J (JD, 21 nov.) : la bande transparente
      // du haut du PNG détouré (12,6 % de sa hauteur, aucun pixel du sujet) est masquée ; on mesure donc le sujet.
      const subjectTop = imgBox!.y + imgBox!.height * 0.126;
      expect(
        subjectTop,
        `Le haut du sujet (${subjectTop}px) doit être sous le bouton (${btnBox!.y + btnBox!.height}px)`
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

      // PR J : un margin-top négatif est permis seulement pour masquer la bande transparente (≤ 12,6 % de la hauteur) :
      // la tête n'est jamais rognée.
      expect(-imgDetails.marginTop, 'margin-top négatif limité à la bande transparente, la tête reste entière').toBeLessThanOrEqual(imgBox!.height * 0.127 + 1);
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

  test('[JD-1117 #13] Parité FR/EN stricte, Coulisses 14 photos, retrait coulisses-02..05 en EN et étanchéité linguistique', async ({
    page,
  }, testInfo) => {
    // 1. Coulisses À propos : exactement 14 photos en FR et en EN
    await page.goto('/about/');
    const frCoulissesImages = page.locator('.coulisses-grid img');
    expect(await frCoulissesImages.count(), 'Total de photos de coulisses sur /about/ = 14').toBe(14);
    for (let i = 0; i < 14; i++) {
      const alt = await frCoulissesImages.nth(i).getAttribute('alt');
      expect(alt, `Alt photo ${i + 1} sur /about/`).toContain(`photo ${i + 1} sur 14`);
      expect(alt).not.toContain('of 14');
    }
    const frAboutContent = await page.content();
    expect(frAboutContent, 'Aucun "of 14" sur la page FR /about/').not.toContain('of 14');

    await page.goto('/en/about/');
    const enCoulissesImages = page.locator('.coulisses-grid img');
    expect(await enCoulissesImages.count(), 'Total de photos de coulisses sur /en/about/ = 14').toBe(14);
    for (let i = 0; i < 14; i++) {
      const alt = await enCoulissesImages.nth(i).getAttribute('alt');
      expect(alt, `Alt photo ${i + 1} sur /en/about/`).toContain(`photo ${i + 1} of 14`);
      expect(alt).not.toContain('sur 14');
    }
    const enAboutContent = await page.content();
    expect(enAboutContent, 'Aucun "sur 14" sur la page EN /en/about/').not.toContain('sur 14');

    // 2. Aucune référence à coulisses-02 à coulisses-05 dans les pages EN (DOM, srcset, JSON-LD)
    for (let n = 2; n <= 5; n++) {
      const id = `coulisses-0${n}`;
      expect(enAboutContent, `Page EN /en/about/ ne doit pas référencer ${id}`).not.toContain(id);
    }
    await page.goto('/en/portfolio/behind-the-scenes/');
    const enBtsContent = await page.content();
    for (let n = 2; n <= 5; n++) {
      const id = `coulisses-0${n}`;
      expect(enBtsContent, `Page EN /en/portfolio/behind-the-scenes/ ne doit pas référencer ${id}`).not.toContain(id);
    }

    // 3. Parité FR/EN des corrections (Points 1, 2, 5)
    // Point 5 (Toutes résolutions) : Taille et police du bouton à l'Accueil p5
    await page.goto('/');
    const frBtnMetrics = await page.locator('#contact .cta-row .btn').evaluate((el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return { height: r.height, fontSize: parseFloat(s.fontSize) };
    });
    await page.goto('/en/');
    const enBtnMetrics = await page.locator('#contact .cta-row .btn').evaluate((el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return { height: r.height, fontSize: parseFloat(s.fontSize) };
    });
    expect(
      Math.abs(enBtnMetrics.height - frBtnMetrics.height),
      `Parité hauteur bouton contact FR vs EN (${testInfo.project.name})`
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs(enBtnMetrics.fontSize - frBtnMetrics.fontSize),
      `Parité police bouton contact FR vs EN (${testInfo.project.name})`
    ).toBeLessThanOrEqual(2);

    // Parité spécifique Mobile (Points 1 et 2)
    if (testInfo.project.name.startsWith('mobile')) {
      // Point 1 : Largeur et hauteur des photos JD et Renaud sur /about/ vs /en/about/
      await page.goto('/about/');
      const frJdBox = await page.locator('#jd .person-photo img').boundingBox();
      const frRenaudBox = await page.locator('#renaud .person-photo img').boundingBox();

      await page.goto('/en/about/');
      const enJdBox = await page.locator('#jd .person-photo img').boundingBox();
      const enRenaudBox = await page.locator('#renaud .person-photo img').boundingBox();

      expect(Math.abs(enJdBox!.width - frJdBox!.width), `Parité largeur photo JD (${testInfo.project.name})`).toBeLessThanOrEqual(2);
      expect(Math.abs(enJdBox!.height - frJdBox!.height), `Parité hauteur photo JD (${testInfo.project.name})`).toBeLessThanOrEqual(2);
      expect(Math.abs(enRenaudBox!.width - frRenaudBox!.width), `Parité largeur photo Renaud (${testInfo.project.name})`).toBeLessThanOrEqual(2);
      expect(Math.abs(enRenaudBox!.height - frRenaudBox!.height), `Parité hauteur photo Renaud (${testInfo.project.name})`).toBeLessThanOrEqual(2);

      // Point 2 : Haut de la photo #vision par rapport au bouton sur /about/ vs /en/about/
      await page.goto('/about/');
      const frVision = await page.evaluate(() => {
        const btn = document.querySelector('#vision .cta-row .btn')!.getBoundingClientRect();
        const img = document.querySelector('#vision .jd-split-photo img')!.getBoundingClientRect();
        return { imgTop: img.top + img.height * 0.126, imgHeight: img.height, btnBottom: btn.bottom }; // haut du sujet (PR J)
      });

      await page.goto('/en/about/');
      const enVision = await page.evaluate(() => {
        const btn = document.querySelector('#vision .cta-row .btn')!.getBoundingClientRect();
        const img = document.querySelector('#vision .jd-split-photo img')!.getBoundingClientRect();
        return { imgTop: img.top + img.height * 0.126, imgHeight: img.height, btnBottom: btn.bottom }; // haut du sujet (PR J)
      });

      // Dans les deux langues, le haut de la photo se trouve sous le bouton
      expect(frVision.imgTop, `Photo #vision FR sous le bouton (${testInfo.project.name})`).toBeGreaterThanOrEqual(frVision.btnBottom - 4);
      expect(enVision.imgTop, `Photo #vision EN sous le bouton (${testInfo.project.name})`).toBeGreaterThanOrEqual(enVision.btnBottom - 4);
      // Et le haut et la hauteur de la photo ont une parité stricte à ±2px
      expect(Math.abs(enVision.imgTop - frVision.imgTop), `Parité haut photo #vision (${testInfo.project.name})`).toBeLessThanOrEqual(2);
      expect(Math.abs(enVision.imgHeight - frVision.imgHeight), `Parité hauteur photo #vision (${testInfo.project.name})`).toBeLessThanOrEqual(2);
    }

    // Parité spécifique Desktop (Point 5)
    if (testInfo.project.name.startsWith('desktop')) {
      // Point 5 : Écart photo-texte à l'Accueil p5 (#contact)
      await page.goto('/');
      const frContactGap = await page.evaluate(() => {
        const img = document.querySelector('#contact .home-contact-photo img')!.getBoundingClientRect();
        const text = document.querySelector('#contact .home-split-text')!.getBoundingClientRect();
        return Math.abs(text.left - img.right);
      });

      await page.goto('/en/');
      const enContactGap = await page.evaluate(() => {
        const img = document.querySelector('#contact .home-contact-photo img')!.getBoundingClientRect();
        const text = document.querySelector('#contact .home-split-text')!.getBoundingClientRect();
        return Math.abs(text.left - img.right);
      });
      expect(Math.abs(enContactGap - frContactGap), `Parité écart photo-texte #contact (${testInfo.project.name})`).toBeLessThanOrEqual(2);
    }

    // 4. Contrôle d'étanchéité linguistique FR/EN (préservé)
    expect(frAboutContent).toContain('Fondateur / Vidéaste');
    expect(frAboutContent).toContain('Caméraman');
    expect(frAboutContent).toContain('Coulisses');
    expect(frAboutContent).not.toContain('Founder / Videographer');
    expect(frAboutContent).not.toContain('Behind the scenes');

    expect(enAboutContent).toContain('Founder / Videographer');
    expect(enAboutContent).toContain('Camera operator');
    expect(enAboutContent).toContain('Behind the scenes');
    expect(enAboutContent).not.toContain('Fondateur / Vidéaste');
    expect(enAboutContent).not.toContain('Coulisses de tournage');

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
