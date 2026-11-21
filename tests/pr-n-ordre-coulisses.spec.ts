import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * PR N — Portfolio, « Derrière la caméra » (Natasha, 21 nov. 2026) : dans la bibliothèque
 * « Coulisses / Making-of / Bandes-annonces », la vidéo la plus récente est la première et la plus vieille la dernière (FR et EN).
 * Même règle que PR M pour les clients : dates de content/portfolio.json (date de publication YouTube), lues par youtubeId ;
 * vidéo sans date à la fin ; vidéos sans youtubeId toujours cachées ; compteur et titres inchangés.
 */
type Video = { youtubeId?: string; type?: string; publie?: string; dateMiseEnLigne?: string };
const portfolio = JSON.parse(readFileSync(new URL('../content/portfolio.json', import.meta.url), 'utf8')) as { videos: Video[] };
const dateOf = (id: string) => {
  const v = portfolio.videos.find((x) => x.youtubeId === id);
  return v ? v.publie || v.dateMiseEnLigne || '' : undefined;
};
const coulisses = portfolio.videos.filter((v) => v.type === 'coulisses' && v.youtubeId);

const LANGS = [
  { lang: 'FR', url: '/portfolio/coulisses/', portfolio: '/portfolio/' },
  { lang: 'EN', url: '/en/portfolio/behind-the-scenes/', portfolio: '/en/portfolio/' },
];

for (const l of LANGS) {
  test(`[PR-N #1] ${l.lang} Coulisses : vidéos de la plus récente à la plus vieille`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440x900' && testInfo.project.name !== 'mobile-iphone-390x844', 'Ordre identique à toutes les tailles');
    await page.goto(l.url, { waitUntil: 'domcontentloaded' });
    const hrefs = await page.locator('.collection-library .library-track a.yt-tile').evaluateAll((els) => els.map((e) => e.getAttribute('href') || ''));
    const ids = hrefs.map((h) => {
      const m = h.match(/(?:shorts\/|v=|youtu\.be\/|embed\/)([\w-]{11})/);
      return m ? m[1] : '';
    });
    expect(ids.length, 'compteur inchangé').toBe(coulisses.length);
    const datees = ids.filter((id) => dateOf(id));
    // Vidéos datées d'abord, de la plus récente à la plus vieille ; sans date ensuite
    expect(ids.slice(0, datees.length)).toEqual(datees);
    const ms = datees.map((id) => Date.parse(dateOf(id)!));
    for (let i = 1; i < ms.length; i++) {
      expect(ms[i], `${datees[i - 1]} (${dateOf(datees[i - 1])}) avant ${datees[i]} (${dateOf(datees[i])})`).toBeLessThanOrEqual(ms[i - 1]);
    }
    expect(ms[0], 'la première vidéo est la plus récente').toBeGreaterThan(ms[ms.length - 1]);
    // Même ensemble de vidéos que dans portfolio.json (aucune ajoutée ni retirée)
    expect([...ids].sort()).toEqual(coulisses.map((v) => v.youtubeId).sort());
    await expect(page.locator('.collection-library [data-library-count]')).toHaveAttribute('data-total', String(coulisses.length));

    // Le bloc « Derrière la caméra » du Portfolio garde son compteur et mène à cette page
    await page.goto(l.portfolio, { waitUntil: 'domcontentloaded' });
    const lien = page.locator(`#pf-coulisses-title ~ * a.coulisses-link, .pf-coulisses a.coulisses-link`).first();
    await expect(lien).toHaveAttribute('href', l.url);
    await expect(lien.locator('.coulisses-count')).toContainText(String(coulisses.length));
  });
}
