import { test, expect } from '@playwright/test';

/**
 * PR K — Contact, section « Questions fréquentes » (Natasha, 21 nov. 2026) :
 * sur ordinateur (≥ 900 px), le bloc titre + questions est centré dans l'espace vide
 * entre le bord gauche de l'écran et la photo de JD, et non collé à gauche ni centré dans l'écran.
 * Aucun texte ne change ; mobile inchangé.
 */
const PAGES = [
  { lang: 'FR', path: '/contact/' },
  { lang: 'EN', path: '/en/contact/' },
];

for (const p of PAGES) {
  test(`[PR-K #1] ${p.lang} ordinateur : FAQ centrée dans l'espace à gauche de la photo`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('desktop'), 'Réservé à l’ordinateur');
    await page.goto(p.path, { waitUntil: 'networkidle' });
    await page.locator('.section-faq--photo').scrollIntoViewIfNeeded();
    const m = await page.evaluate(() => {
      const c = document.querySelector('.section-faq--photo .faq-content')!.getBoundingClientRect();
      const ph = document.querySelector('.section-faq--photo .faq-photo-wrap')!.getBoundingClientRect();
      return { left: c.left, right: c.right, photoLeft: ph.left, vw: window.innerWidth };
    });
    const gaucheEspace = m.left;
    const droiteEspace = m.photoLeft - m.right;
    expect(droiteEspace, 'le bloc ne touche pas la photo').toBeGreaterThanOrEqual(16);
    expect(Math.abs(gaucheEspace - droiteEspace), `marges ${gaucheEspace} / ${droiteEspace}`).toBeLessThanOrEqual(2);
    // Pas centré dans l'écran
    expect(Math.abs((m.left + m.right) / 2 - m.vw / 2)).toBeGreaterThan(50);
  });
}

test('[PR-K #2] Largeur intermédiaire 900×700 et 1024×768 : FAQ centrée, sans chevaucher la photo', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', 'Une seule fois');
  for (const [width, height] of [[900, 700], [1024, 768]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto('/contact/', { waitUntil: 'networkidle' });
    const m = await page.evaluate(() => {
      const c = document.querySelector('.section-faq--photo .faq-content')!.getBoundingClientRect();
      const ph = document.querySelector('.section-faq--photo .faq-photo-wrap')!.getBoundingClientRect();
      return { left: c.left, right: c.right, photoLeft: ph.left };
    });
    expect(m.left).toBeGreaterThanOrEqual(16);
    expect(m.right).toBeLessThanOrEqual(m.photoLeft - 16);
    expect(Math.abs(m.left - (m.photoLeft - m.right))).toBeLessThanOrEqual(2);
    await page.close();
  }
});
