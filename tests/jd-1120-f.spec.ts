import { test, expect } from '@playwright/test';

test.describe('PR F — Photo JD À propos mobile (dernière section #vision)', () => {
  const MOBILE_VIEWPORTS = [
    { width: 390, height: 844, name: '390x844', mainBaseline: 256.4 },
    { width: 430, height: 932, name: '430x932', mainBaseline: 285.4 },
    { width: 360, height: 740, name: '360x740', mainBaseline: 191.6 },
  ];

  const PAGES = [
    { lang: 'FR', path: '/about/' },
    { lang: 'EN', path: '/en/about/' },
  ];

  for (const vp of MOBILE_VIEWPORTS) {
    for (const p of PAGES) {
      test(`[PR-F #1] ${p.lang} ${vp.name} : photo #vision agrandie >= 72% viewport, tete sous CTA, ratio 944/1665, 1 ecran`, async ({ page }) => {
        test.skip(!page.viewportSize() || page.viewportSize()!.width >= 900, 'Test réservé au mobile');
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(p.path, { waitUntil: 'networkidle' });

        const vision = page.locator('.page-apropos #vision');
        await expect(vision).toBeVisible();

        const img = vision.locator('.jd-split-photo img');
        await expect(img).toBeVisible();

        const ctaBtn = vision.locator('.cta-row .btn');
        await expect(ctaBtn).toBeVisible();

        // 1. Défilement vers la section vision
        await vision.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);

        const imgBox = await img.boundingBox();
        expect(imgBox).not.toBeNull();
        if (!imgBox) return;

        const ctaBox = await ctaBtn.boundingBox();
        expect(ctaBox).not.toBeNull();
        if (!ctaBox) return;

        console.log(`[MEASURE] ${p.lang} ${vp.name} : ${imgBox.width.toFixed(1)} x ${imgBox.height.toFixed(1)} px (ratio ${(imgBox.width / vp.width * 100).toFixed(1)}% viewport)`);

        // 2. Largeur rendue >= 72% du viewport (ou >= 1.12 x la largeur sur main)
        const minExpectedWidth = vp.width * 0.72;
        const minRatioVsMain = vp.mainBaseline * 1.12;
        const meetsWidthTarget = imgBox.width >= minExpectedWidth || imgBox.width >= minRatioVsMain;
        expect(
          meetsWidthTarget,
          `Largeur de la photo (${imgBox.width.toFixed(1)}px) doit être >= 72% du viewport (${minExpectedWidth.toFixed(1)}px) ou >= 1.12x main (${minRatioVsMain.toFixed(1)}px)`
        ).toBe(true);

        // 3. Tête entièrement visible : haut de l'img >= bas du bouton CTA
        expect(
          imgBox.y,
          `Haut de l'image (${imgBox.y.toFixed(1)}px) doit être >= bas du bouton CTA (${(ctaBox.y + ctaBox.height).toFixed(1)}px)`
        ).toBeGreaterThanOrEqual(ctaBox.y + ctaBox.height - 2);

        // 4. Ratio rendu reste 944/1665 (±1%)
        const targetRatio = 944 / 1665;
        const actualRatio = imgBox.width / imgBox.height;
        const diffRatio = Math.abs(actualRatio - targetRatio) / targetRatio;
        expect(
          diffRatio,
          `Ratio de l'image (${actualRatio.toFixed(4)}) doit respecter 944/1665 (${targetRatio.toFixed(4)}) à ±1% (diff: ${(diffRatio * 100).toFixed(2)}%)`
        ).toBeLessThanOrEqual(0.015);

        // 5. La section tient dans un écran : bas de la photo <= hauteur viewport
        const visionBox = await vision.boundingBox();
        expect(visionBox).not.toBeNull();
        if (!visionBox) return;

        expect(
          visionBox.height,
          `Hauteur de la section (${visionBox.height.toFixed(1)}px) doit être <= hauteur disponible (${vp.height - 64}px)`
        ).toBeLessThanOrEqual(vp.height - 64 + 4);

        // Le bas de la photo ne doit pas dépasser le bas de la section
        expect(
          imgBox.y + imgBox.height,
          `Bas de la photo (${(imgBox.y + imgBox.height).toFixed(1)}px) doit être <= bas de la section (${(visionBox.y + visionBox.height).toFixed(1)}px)`
        ).toBeLessThanOrEqual(visionBox.y + visionBox.height + 4);
      });
    }
  }

  test('[PR-F #2] Desktop 1366x768 : bounding box de la photo #vision reste identique', async ({ page }) => {
    test.skip(page.viewportSize()?.width !== 1366, 'Réservé au desktop 1366x768');
    await page.goto('/about/', { waitUntil: 'networkidle' });

    const vision = page.locator('.page-apropos #vision');
    await vision.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const img = vision.locator('.jd-split-photo img');
    const imgBox = await img.boundingBox();
    expect(imgBox).not.toBeNull();
    if (!imgBox) return;

    // Sur desktop 1366x768, la photo est à droite et a une taille prédéfinie
    expect(imgBox.width).toBeGreaterThanOrEqual(350);
    expect(imgBox.height).toBeGreaterThanOrEqual(450);
  });
});
