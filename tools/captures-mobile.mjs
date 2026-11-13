// tools/captures-mobile.mjs : captures avant/après des sections mobiles (hors dist, non déployé).
// Usage : PW=… BASE=http://localhost:8001 PREFIX=avant OUT=docs/qa/2026-11-13-mobile node tools/captures-mobile.mjs
import { createRequire } from 'node:module';
import { mkdirSync, statSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'https://videosmakemoney.ca';
const PREFIX = process.env.PREFIX || 'avant';
const OUT = process.env.OUT || 'docs/qa/2026-11-13-mobile';
mkdirSync(OUT, { recursive: true });
const VPS = [[360, 740], [390, 844], [430, 932], [390, 664]];
// page → [nom, sélecteur de section ou 'FIN' (scroll max)]
const PLAN = {
  '/': [['accueil-1-hero', 'main > :nth-child(1)'], ['accueil-2-portfolio', '#portfolio-accueil'], ['accueil-3-equipe', '#equipe'], ['accueil-4-services', '#services-accueil'], ['accueil-fin', 'FIN']],
  '/services/': [['services-1-hero', 'main > :nth-child(1)']],
  '/portfolio/': [['portfolio-1-hero', 'main > :nth-child(1)'], ['portfolio-2-categories', '#realisons'], ['portfolio-3-honneur', '.pf-honneur'], ['portfolio-4-coulisses', '.pf-coulisses'], ['portfolio-fin', 'FIN']],
  '/portfolio/tapis-rouge/': [['client-tapis-rouge', 'main > :nth-child(1)']],
  '/about/': [['apropos-1-hero', 'main > :nth-child(1)'], ['apropos-3-jd', 'section#jd']],
  '/contact/': [['contact-1-coordonnees', '.page-contact .contact-info'], ['contact-2-formulaire', '.page-contact .contact-form']],
};
const browser = await chromium.launch();
for (const [W, H] of VPS) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-CA' });
  for (const [path, shots] of Object.entries(PLAN)) {
    const pg = await ctx.newPage();
    await pg.goto(BASE + path, { waitUntil: 'load' }); await pg.waitForTimeout(3000);
    for (const [name, sel] of shots) {
      await pg.evaluate((sel) => {
        document.documentElement.style.scrollSnapType = 'none';
        if (sel === 'FIN') { scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); return; }
        const hdr = document.querySelector('.site-header').getBoundingClientRect().height;
        const s = document.querySelector(sel); if (!s) return;
        scrollTo({ top: Math.max(0, s.getBoundingClientRect().top + scrollY - hdr), behavior: 'instant' });
      }, sel);
      await pg.waitForTimeout(1900);
      const file = `${OUT}/${PREFIX}-${name}-${W}x${H}.jpg`;
      for (const q of [70, 55, 42, 32]) { await pg.screenshot({ path: file, type: 'jpeg', quality: q }); if (statSync(file).size <= 150 * 1024) break; }
    }
    await pg.close();
  }
  await ctx.close();
}
await browser.close();
console.log('captures OK');
