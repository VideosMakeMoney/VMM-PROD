import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const load = (l: string) => JSON.parse(readFileSync(join(process.cwd(), 'content', `${l}.json`), 'utf8'));
const fr = load('fr');
const en = load('en');

// PR G — doublon « Grand Montréal et les Laurentides » sur /contact et /en/contact.
// Le formulaire n'est jamais soumis : tout POST est intercepté et bloqué.
const blockPosts = async (page: Page) => {
  await page.route('**/*', (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()));
};

const count = (text: string, needle: string) => text.split(needle).length - 1;

const CASES = [
  { lang: 'FR', path: '/contact/', home: '/', L: fr as any, phrase: 'Grand Montréal et les Laurentides', court: 'Écrivez-nous, sans engagement.' },
  { lang: 'EN', path: '/en/contact/', home: '/en/', L: en as any, phrase: 'Greater Montreal and the Laurentians', court: 'Write to us, no strings attached.' },
];

test.describe('PR G — doublon texte Contact', () => {
  for (const c of CASES) {
    test(`[PR-G] ${c.lang} ${c.path} : phrase de zone une seule fois dans l'intro, résumé SEO intact`, async ({ page }) => {
      await blockPosts(page);
      await page.goto(c.path);
      const intro = page.locator('section.page-contact .contact-info');
      await expect(intro).toBeVisible();
      const txt = (await intro.innerText()).replace(/\s+/g, ' ');
      expect(count(txt, c.phrase)).toBe(1);
      expect(txt).toContain(c.L.seo.contact.resume);
      await expect(intro.locator('p.intro')).toHaveText(c.court);
      expect(c.L.contact.texteCourt).toBe(c.court);
    });

    test(`[PR-G] ${c.lang} ${c.home} : section Contact de l'Accueil inchangée`, async ({ page }) => {
      await blockPosts(page);
      await page.goto(c.home);
      const lead = page.locator('section#contact .jd-lead');
      await expect(lead).toHaveText(c.L.accueilJD.contact.texte);
    });
  }
});
