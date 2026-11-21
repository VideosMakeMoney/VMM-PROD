import { test, expect, Page } from '@playwright/test';

// PR I — GEO : ville dans l'adresse, FAQPage = accordéons visibles, llms.txt (désambiguïsation + Google Business).
// Le formulaire n'est jamais soumis : tout POST est intercepté et bloqué.
const blockPosts = async (page: Page) => {
  await page.route('**/*', (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()));
};

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

const graphOf = async (page: Page) => {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.flatMap((b) => {
    const j = JSON.parse(b);
    return j['@graph'] || [j];
  });
};

const CASES = [
  { lang: 'FR', home: '/', contact: '/contact/' },
  { lang: 'EN', home: '/en/', contact: '/en/contact/' },
];

test.describe('PR I — GEO', () => {
  for (const c of CASES) {
    for (const path of [c.home, c.contact]) {
      test(`[PR-I] ${c.lang} ${path} : adresse de l'entreprise à Sainte-Thérèse`, async ({ page }) => {
        await blockPosts(page);
        await page.goto(path);
        const graph = await graphOf(page);
        const biz = graph.find((n: any) => n['@type'] === 'ProfessionalService');
        expect(biz, 'JSON-LD ProfessionalService manquant').toBeDefined();
        expect(biz.address['@type']).toBe('PostalAddress');
        expect(biz.address.addressLocality).toBe('Sainte-Thérèse');
        expect(biz.address.addressRegion).toBe('QC');
        expect(biz.address.addressCountry).toBe('CA');
        expect(biz.address.streetAddress).toBeUndefined();
        expect(biz.address.postalCode).toBeUndefined();
      });
    }

    test(`[PR-I] ${c.lang} ${c.contact} : FAQPage identique aux accordéons visibles`, async ({ page }) => {
      await blockPosts(page);
      await page.goto(c.contact);
      const items = page.locator('[aria-labelledby="faq-title"] details');
      const n = await items.count();
      expect(n).toBe(4);
      const graph = await graphOf(page);
      const faq = graph.find((x: any) => x['@type'] === 'FAQPage');
      expect(faq, 'FAQPage manquante').toBeDefined();
      expect(faq.mainEntity.length).toBe(n);
      for (let i = 0; i < n; i++) {
        const d = items.nth(i);
        const q = norm((await d.locator('summary').textContent()) || '');
        const r = norm((await d.locator('p').first().textContent()) || '');
        expect(norm(faq.mainEntity[i].name)).toBe(q);
        expect(norm(faq.mainEntity[i].acceptedAnswer.text)).toBe(r);
      }
    });
  }

  test('[PR-I] /llms.txt : désambiguïsation FR et EN, fiche Google Business', async ({ request }) => {
    const res = await request.get('/llms.txt');
    expect(res.status()).toBe(200);
    const txt = await res.text();
    expect(txt).toContain('Sainte-Thérèse');
    expect(txt).toContain('https://share.google/Q1kfklKWv8FgykyCD');
    expect(txt).toContain(
      "VMM Productions (Videos Make Money) est une entreprise de production vidéo basée à Sainte-Thérèse, au Québec, qui sert le Grand Montréal et les Laurentides. Elle n'a aucun lien avec les autres entreprises nommées VMM ou VMM Productions (ex. aux États-Unis) ni avec le domaine vmmproductions.com. Site officiel : https://videosmakemoney.ca",
    );
    expect(txt).toMatch(/is a video production company based in Sainte-Thérèse, Quebec[^\n]*vmmproductions\.com[^\n]*https:\/\/videosmakemoney\.ca/);
  });
});
