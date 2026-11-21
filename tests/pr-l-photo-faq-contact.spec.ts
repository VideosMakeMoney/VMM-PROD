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
  '4cec3eefccdae10aff4eaaf9c8e05de73e6127237123313a23be919c523895fa', // faq-jd.jpg
  '121f44dbc313da3a698c28074ce8b52184e8e1977ccf665ddc061b945c0a7bbf', // faq-jd.webp
  '48f01f83ee258e30f617b545f529cec24fad1ad1b1d6c66c4ce47ebaba48df20', // faq-jd-720.jpg
  '34f559561a7d853675cf74cec5ecb2e3874ebc18b8b6d1e78c178d4a05427344', // faq-jd-720.webp
  '7bd1b710290970bf8f6ef3a215dcd1fdfcfbd4a7edf6c4e3831f311da3377c40', // faq-jd-470.jpg
  '399739b01509afcac668e2d7b5cdc1092430848ef2967df4a6265a5e2ac45689', // faq-jd-470.webp
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
