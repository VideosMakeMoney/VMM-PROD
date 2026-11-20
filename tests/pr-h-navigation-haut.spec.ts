import { test, expect, Page } from '@playwright/test';

// PR H — Les boutons du bas de page qui mènent à la page suivante (Services → Portfolio, Portfolio → À propos,
// À propos → Contact, Accueil → Contact) doivent ouvrir la nouvelle page EN HAUT, pas en bas, même si le navigateur
// fait sauter la page vers le bas pendant le chargement (aimantation scroll-snap sur iPhone).
// Le formulaire n'est jamais soumis : tout POST est intercepté et bloqué.
const blockPosts = async (page: Page) => {
  await page.route('**/*', (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()));
};

const CASES = [
  { from: '/', to: '/contact/' },
  { from: '/services/', to: '/portfolio/' },
  { from: '/portfolio/', to: '/about/' },
  { from: '/about/', to: '/contact/' },
  { from: '/en/', to: '/en/contact/' },
  { from: '/en/services/', to: '/en/portfolio/' },
  { from: '/en/portfolio/', to: '/en/about/' },
  { from: '/en/about/', to: '/en/contact/' },
];

// Laisse le défilement (aimantation, chargements tardifs) se stabiliser : 3 lectures identiques de suite.
const settledScrollY = async (page: Page) => {
  let last = -1;
  let same = 0;
  for (let i = 0; i < 40 && same < 3; i++) {
    await page.waitForTimeout(150);
    const y = await page.evaluate(() => Math.round(window.scrollY));
    same = y === last ? same + 1 : 0;
    last = y;
  }
  return last;
};

test.describe('PR H — bouton « page suivante » : la nouvelle page s\'ouvre en haut', () => {
  for (const c of CASES) {
    test(`[PR-H] ${c.from} → ${c.to} : bouton du bas, arrivée en haut de page`, async ({ page }) => {
      await blockPosts(page);
      await page.goto(c.from);
      await page.waitForLoadState('load');

      // Le visiteur descend jusqu'en bas de la page
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await settledScrollY(page);

      const cta = page.locator(`main a.btn[href="${c.to}"]`).last();
      await cta.scrollIntoViewIfNeeded();
      await settledScrollY(page);
      const before = await page.evaluate(() => window.scrollY);
      expect(before, 'le bouton est bien en bas de la page de départ').toBeGreaterThan(300);

      await Promise.all([page.waitForURL((u) => u.pathname === c.to, { waitUntil: 'domcontentloaded' }), cta.click()]);
      // Sur iPhone, l'aimantation (scroll-snap) peut renvoyer la page d'arrivée vers le bas pendant son chargement,
      // sans aucun geste du visiteur. On reproduit ce saut (défilement programmé, sans toucher ni molette) :
      // la page doit revenir d'elle-même en haut.
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForLoadState('load');
      const y = await settledScrollY(page);

      // Arrivée en haut : défilement nul, ou au plus le premier arrêt d'aimantation (1re section sous l'en-tête),
      // marge de 2 px ; titre principal visible dans le premier écran.
      const top = await page.evaluate(() => {
        const first = document.querySelector('main > section') as HTMLElement | null;
        const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
        return first ? Math.max(0, Math.round(first.getBoundingClientRect().top + window.scrollY - pad)) : 0;
      });
      expect(y, `${c.to} doit s'ouvrir en haut (scrollY = ${y}, haut attendu = ${top})`).toBeLessThanOrEqual(top + 2);
      const h1 = await page.locator('h1').first().boundingBox();
      const vh = page.viewportSize()!.height;
      expect(h1, 'le titre H1 existe').not.toBeNull();
      expect(h1!.y + h1!.height, 'le H1 est dans le premier écran').toBeLessThanOrEqual(vh);
      expect(h1!.y, 'le H1 n\'est pas au-dessus de l\'écran').toBeGreaterThanOrEqual(0);
    });
  }
});
