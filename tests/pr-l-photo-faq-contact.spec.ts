import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';

/**
 * PR L — Contact, section « Questions fréquentes » (demande de Max, 21 nov. 2026) :
 * la photo de JD est remplacée par la nouvelle (JD assis au studio, devant le logo VMM Productions,
 * original reçu en 1536×2048 portrait, ratio 3:4). Mêmes noms de fichiers faq-jd(-720|-470).(webp|jpg).
 * Échoue sur main : l'ancienne photo est en 941×1672 (ratio 0,563).
 */
const PAGES = [
  { lang: 'FR', path: '/contact/' },
  { lang: 'EN', path: '/en/contact/' },
];
const PROJETS = ['desktop-1440x900', 'mobile-iphone-390x844'];
const RATIO = 768 / 1024;
// Empreintes SHA-256 des 6 dérivés de la nouvelle photo (static/img/faq-jd*)
const HASHES = new Set<string>([
  'bab3318be94067f8d5d023aa914aaaddc70332b23b6e25cf93dd500c54ad6046', // faq-jd.jpg
  '868e3b55a04f7fd7ac02afd65c550300d2f2b72de572eb7b3ca82fa55990656e', // faq-jd.webp
  'f62f7b1278d74b4cd1709d9d558477ab7311a945a94e9987aa4c83506467c7ac', // faq-jd-720.jpg
  '98f071dde315a40c9deac6a1d3ebd7fd523b897e513e62cc0507ccb211acfd95', // faq-jd-720.webp
  'f0139fb96a557beb60022b71df19d7e7a6bad3e8ae225cd18f3ab52393f63de4', // faq-jd-470.jpg
  '99d527ee81ee642468cf3c0ea401a6b7aba146f71d56b99f9e1fc2d12fcd0b5a', // faq-jd-470.webp
]);

for (const p of PAGES) {
  test(`[PR-L #1] ${p.lang} : la section FAQ charge la nouvelle photo de JD`, async ({ page }, testInfo) => {
    test.skip(!PROJETS.includes(testInfo.project.name), 'Ordinateur 1440×900 et mobile 390×844');
    await page.goto(p.path, { waitUntil: 'networkidle' });
    const img = page.locator('.section-faq--photo .faq-photo-wrap img');
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    const m = await img.evaluate((el: HTMLImageElement) => ({ w: el.naturalWidth, h: el.naturalHeight, src: el.currentSrc }));
    expect(m.src, 'image servie depuis faq-jd').toMatch(/\/img\/faq-jd(-720|-470)?\.(webp|jpg)$/);
    expect(Math.abs(m.w / m.h - RATIO), `ratio naturel ${m.w}×${m.h}`).toBeLessThan(0.01);
    const res = await page.request.get(m.src);
    expect(res.ok()).toBe(true);
    const hash = createHash('sha256').update(await res.body()).digest('hex');
    expect(HASHES.has(hash), `empreinte ${hash} de ${m.src}`).toBe(true);
  });
}
