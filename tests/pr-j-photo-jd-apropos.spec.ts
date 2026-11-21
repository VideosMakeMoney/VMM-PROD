import { test, expect } from '@playwright/test';

/**
 * PR J — À propos, écran 5 « Derrière chaque image, il y a des gens. » (JD, 21 nov. 2026) :
 * sur mobile, la photo de JD est agrandie comme sur la capture de JD : la casquette commence juste sous le bouton
 * « Donnons vie à votre vision → », le portrait est centré et occupe presque toute la largeur.
 * Sur ordinateur, rien ne change.
 */
const PAGES = [
  { lang: 'FR', path: '/about/' },
  { lang: 'EN', path: '/en/about/' },
];
const SUBJECT_TOP = 0.126; // bande transparente en haut du PNG détouré (210 px sur 1665)

for (const p of PAGES) {
  test(`[PR-J #1] ${p.lang} mobile : photo agrandie, casquette juste sous le bouton, centrée, dans un écran`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'), 'Test réservé au mobile');
    await page.goto(p.path, { waitUntil: 'networkidle' });
    const vision = page.locator('.page-apropos #vision');
    await vision.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const m = await page.evaluate((top) => {
      const sec = document.querySelector('#vision')!.getBoundingClientRect();
      const btn = document.querySelector('#vision .cta-row .btn')!.getBoundingClientRect();
      const zone = document.querySelector('#vision .jd-split-photo')!.getBoundingClientRect();
      const img = document.querySelector('#vision .jd-split-photo img') as HTMLImageElement;
      const r = img.getBoundingClientRect();
      return {
        vw: window.innerWidth,
        vh: window.innerHeight,
        secTop: sec.top,
        secBottom: sec.bottom,
        btnBottom: btn.bottom,
        zoneBottom: zone.bottom,
        subjectTop: r.top + r.height * top,
        imgLeft: r.left,
        imgRight: r.right,
        imgWidth: r.width,
        loaded: img.complete && img.naturalWidth > 0,
      };
    }, SUBJECT_TOP);
    expect(m.loaded, 'photo chargée').toBe(true);
    // Agrandie : au moins 76 % de la largeur de l'écran (avant : 56 % à 375×667, 70 % à 360×740)
    expect(m.imgWidth, `largeur ${m.imgWidth}px`).toBeGreaterThanOrEqual(m.vw * 0.76 - 1);
    expect(m.imgWidth).toBeLessThanOrEqual(m.vw + 1);
    // Centrée
    expect(Math.abs((m.imgLeft + m.imgRight) / 2 - m.vw / 2)).toBeLessThanOrEqual(2);
    // Casquette entière, juste sous le bouton (écart de 4 à 24 px)
    expect(m.subjectTop - m.btnBottom, 'écart bouton → casquette').toBeGreaterThanOrEqual(4);
    expect(m.subjectTop - m.btnBottom, 'écart bouton → casquette').toBeLessThanOrEqual(24);
    // La section et la zone photo tiennent dans un écran
    expect(m.zoneBottom).toBeLessThanOrEqual(m.secBottom + 1);
    expect(m.secBottom - m.secTop).toBeLessThanOrEqual(m.vh);
  });
}

test('[PR-J #2] Ordinateur : la photo de JD garde sa taille et sa position', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', 'Réservé à 1440×900');
  await page.goto('/about/', { waitUntil: 'networkidle' });
  const vision = page.locator('.page-apropos #vision');
  await vision.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const box = (await vision.locator('.jd-split-photo img').boundingBox())!;
  const sec = (await vision.boundingBox())!;
  // Mesures sur main avant la PR J (1440×900) : 625 × 828 px, à droite
  expect(Math.abs(box.width - 625)).toBeLessThanOrEqual(2);
  expect(Math.abs(box.height - 828)).toBeLessThanOrEqual(2);
  expect(Math.abs(box.x - 811)).toBeLessThanOrEqual(2);
  expect(box.y - sec.y).toBeLessThanOrEqual(16);
});
