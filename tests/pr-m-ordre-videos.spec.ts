import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * PR M — Portfolio, « Chaque entreprise. Son univers. » (Natasha, 21 nov. 2026) :
 * dans les bibliothèques des 4 clients, la vidéo la plus récente est la première et la plus vieille la dernière (FR et EN).
 * Les dates viennent de content/portfolio.json (date de publication YouTube), lues par youtubeId.
 * Les compteurs et les vidéos affichées ne changent pas.
 */
type Video = { youtubeId?: string; client?: string; type?: string; publie?: string; dateMiseEnLigne?: string };
const portfolio = JSON.parse(readFileSync(new URL('../content/portfolio.json', import.meta.url), 'utf8')) as { videos: Video[] };
const dateOf = (id: string) => {
  const v = portfolio.videos.find((x) => x.youtubeId === id);
  return v ? v.publie || v.dateMiseEnLigne || '' : undefined;
};

const CLIENTS = [
  { nom: 'Tapis Rouge', slug: 'tapis-rouge', total: 9 },
  { nom: 'Installations Hors-Pair', slug: 'hors-pair', total: 3 },
  { nom: 'PUR Construction', slug: 'pur-construction', total: 7 },
  { nom: 'BlueWise', slug: 'bluewise', total: 2 },
];
const LANGS = [
  { lang: 'FR', prefix: '/portfolio/' },
  { lang: 'EN', prefix: '/en/portfolio/' },
];

for (const l of LANGS) {
  for (const c of CLIENTS) {
    test(`[PR-M #1] ${l.lang} ${c.nom} : vidéos de la plus récente à la plus vieille`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop-1440x900' && testInfo.project.name !== 'mobile-iphone-390x844', 'Ordre identique à toutes les tailles');
      await page.goto(`${l.prefix}${c.slug}/`, { waitUntil: 'domcontentloaded' });
      const hrefs = await page.locator('.collection-library .library-track a.yt-tile').evaluateAll((els) => els.map((e) => e.getAttribute('href') || ''));
      const ids = hrefs.map((h) => {
        const m = h.match(/(?:shorts\/|v=|youtu\.be\/|embed\/)([\w-]{11})/);
        return m ? m[1] : '';
      });
      expect(ids.length, 'compteur inchangé').toBe(c.total);
      const dates = ids.map((id) => dateOf(id));
      for (const [i, d] of dates.entries()) expect(d, `date connue pour ${ids[i]}`).toBeTruthy();
      const ms = dates.map((d) => Date.parse(d!));
      for (let i = 1; i < ms.length; i++) {
        expect(ms[i], `${ids[i - 1]} (${dates[i - 1]}) avant ${ids[i]} (${dates[i]})`).toBeLessThanOrEqual(ms[i - 1]);
      }
      // Même ensemble de vidéos que dans portfolio.json (aucune ajoutée ni retirée)
      const attendu = portfolio.videos.filter((v) => v.type !== 'coulisses' && v.client === c.nom && v.youtubeId).map((v) => v.youtubeId).sort();
      expect([...ids].sort()).toEqual(attendu);
      await expect(page.locator('.collection-library [data-library-count]')).toHaveAttribute('data-total', String(c.total));
    });
  }
}
