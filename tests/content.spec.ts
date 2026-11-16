import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PAGES, PageDefinition } from './helpers';

// Chargement des dictionnaires et données de contenu
const fr = JSON.parse(readFileSync(new URL('../content/fr.json', import.meta.url), 'utf8'));
const en = JSON.parse(readFileSync(new URL('../content/en.json', import.meta.url), 'utf8'));
const site = JSON.parse(readFileSync(new URL('../content/site.json', import.meta.url), 'utf8'));
const portfolio = JSON.parse(readFileSync(new URL('../content/portfolio.json', import.meta.url), 'utf8'));

// Utilitaires de drapeaux et de données portfolio
const shown = (x: any) => !x?.drapeau || site.drapeaux?.[x.drapeau] === true;
const CLIENTS = (portfolio.clients || []).filter(shown);
const VIDEOS = (portfolio.videos || []).filter(shown);

function clientVideos(client: any): any[] {
  return VIDEOS.filter((v: any) => v.client === client.slug || v.client === client.nom);
}

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*([^*]+)\*/g, '$1') // Supprime la syntaxe markdown *mot en violet*
    .replace(/<[^>]+>/g, ' ')      // Supprime les balises HTML éventuelles
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/’/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ROUTES: Record<string, { fr: string; en: string }> = {
  accueil: { fr: '/', en: '/en/' },
  services: { fr: '/services/', en: '/en/services/' },
  portfolio: { fr: '/portfolio/', en: '/en/portfolio/' },
  apropos: { fr: '/about/', en: '/en/about/' },
  contact: { fr: '/contact/', en: '/en/contact/' },
};

function getCounterpartUrl(p: PageDefinition): string {
  if (p.type === 'accueil') return p.lang === 'fr' ? '/en/' : '/';
  if (p.type === 'services') return p.lang === 'fr' ? '/en/services/' : '/services/';
  if (p.type === 'portfolio') return p.lang === 'fr' ? '/en/portfolio/' : '/portfolio/';
  if (p.type === 'apropos') return p.lang === 'fr' ? '/en/about/' : '/about/';
  if (p.type === 'contact') return p.lang === 'fr' ? '/en/contact/' : '/contact/';
  if (p.type === 'client' && p.clientSlug) {
    return p.lang === 'fr'
      ? `/en/portfolio/${p.clientSlug}/`
      : `/portfolio/${p.clientSlug}/`;
  }
  return p.lang === 'fr' ? '/en/' : '/';
}

/* =========================================================================
   SUITE 1 : Navigation d'en-tête et bascule de langue (Spécification point 4)
   ========================================================================= */
test.describe('Bloc 3 - Navigation d\'en-tête et bascule linguistique', () => {
  for (const pageDef of PAGES) {
    test(`[${pageDef.lang.toUpperCase()}] Navigation et bascule de langue sur ${pageDef.name}`, async ({ page }) => {
      await page.goto(pageDef.url);
      const dict = pageDef.lang === 'fr' ? fr : en;

      // 1. Vérification des 5 liens du menu d'en-tête (hors bouton CTA d'en-tête)
      const expectedNavLinks = [
        { key: 'accueil', text: dict.nav.accueil, href: ROUTES.accueil[pageDef.lang] },
        { key: 'services', text: dict.nav.services, href: ROUTES.services[pageDef.lang] },
        { key: 'portfolio', text: dict.nav.portfolio, href: ROUTES.portfolio[pageDef.lang] },
        { key: 'apropos', text: dict.nav.apropos, href: ROUTES.apropos[pageDef.lang] },
        { key: 'contact', text: dict.nav.contact, href: ROUTES.contact[pageDef.lang] },
      ];

      for (const item of expectedNavLinks) {
        const linkLocator = page.locator(`#menu a:not(.btn-header-cta)[href="${item.href}"]`);
        await expect(linkLocator).toHaveCount(1);
        const linkText = await linkLocator.textContent();
        expect(normalizeText(linkText || '')).toBe(normalizeText(item.text));

        // Vérifie aria-current="page" sur la page active
        if (pageDef.type === item.key) {
          await expect(linkLocator).toHaveAttribute('aria-current', 'page');
        }
      }

      // 2. Vérification du bouton de bascule de langue (.lang-switch)
      const switchLocator = page.locator('#menu a.lang-switch');
      await expect(switchLocator).toHaveCount(1);
      const switchText = await switchLocator.textContent();
      expect(normalizeText(switchText || '')).toBe(dict.nav.autreLangue);

      const expectedCounterpartUrl = getCounterpartUrl(pageDef);
      await expect(switchLocator).toHaveAttribute('href', expectedCounterpartUrl);
      const label = await switchLocator.getAttribute('aria-label');
      expect(label).toContain(dict.nav.autreLangueNom);
    });
  }
});

/* =========================================================================
   SUITE 2 : Description SEO et résumé des héros (Spécification point 3)
   Le héros de chaque page (sauf l'accueil) affiche sa propre description SEO
   ========================================================================= */
test.describe('Bloc 3 - Description SEO et spécificité du héros', () => {
  const HERO_PAGES = PAGES.filter((p) =>
    ['services', 'portfolio', 'apropos', 'contact'].includes(p.type)
  );

  for (const pageDef of HERO_PAGES) {
    test(`[${pageDef.lang.toUpperCase()}] Description SEO spécifique du héros sur ${pageDef.name}`, async ({ page }) => {
      await page.goto(pageDef.url);
      const dict = pageDef.lang === 'fr' ? fr : en;
      const servicesResume = normalizeText(dict.seo.services.resume);

      const summaryLocator = page.locator('.page-summary').first();
      await expect(summaryLocator).toBeVisible();
      const summaryText = normalizeText(await summaryLocator.innerText());

      if (pageDef.type === 'services') {
        expect(summaryText).toBe(servicesResume);
      } else if (pageDef.type === 'portfolio') {
        // Détection de la régression PR24 (le héros FR de portfolio affiche la description SEO de services)
        test.fixme(
          pageDef.lang === 'fr',
          'Régression connue sur main (PR24) : Le héros de portfolio-fr affiche la description SEO de Services au lieu de sa propre description'
        );
        expect(summaryText).toBe(normalizeText(dict.seo.portfolio.resume));
        expect(summaryText).not.toContain(servicesResume);
      } else if (pageDef.type === 'apropos') {
        test.fixme(
          pageDef.lang === 'fr',
          'Régression connue sur main (PR24) : Le héros de apropos-fr affiche la description SEO de Services au lieu de sa propre description'
        );
        expect(summaryText).toBe(normalizeText(dict.seo.apropos.resume));
        expect(summaryText).not.toContain(servicesResume);
      } else if (pageDef.type === 'contact') {
        test.fixme(
          pageDef.lang === 'fr',
          'Régression connue sur main (PR24) : Le héros de contact-fr affiche la description SEO de Services au lieu de sa propre description'
        );
        expect(summaryText).toBe(normalizeText(dict.seo.contact.resume));
        expect(summaryText).not.toContain(servicesResume);
      }
    });
  }
});

/* =========================================================================
   SUITE 3 : Textes visibles importants (h1, h2, boutons, pied)
   ========================================================================= */
test.describe('Bloc 3 - Textes visibles importants (h1, h2, boutons, pied)', () => {
  for (const pageDef of PAGES) {
    test(`[${pageDef.lang.toUpperCase()}] Textes visibles majeurs sur ${pageDef.name}`, async ({ page }) => {
      await page.goto(pageDef.url);
      const dict = pageDef.lang === 'fr' ? fr : en;

      // 1. Titre H1
      const h1Locator = page.locator('h1').first();
      await expect(h1Locator).toBeAttached();
      const h1FullText = normalizeText(await h1Locator.innerText()).toLowerCase();

      if (pageDef.type === 'accueil') {
        const expectedHeroTitle = normalizeText(dict.hero.titre).toLowerCase().replace(/[^a-z0-9]/g, '');
        expect(h1FullText.replace(/[^a-z0-9]/g, '')).toContain(expectedHeroTitle);

        const A = (dict as any).accueilJD || (dict as any).accueil || dict;
        // Textes du héros
        const expectedHeroSignature = A.hero?.signature || dict.hero?.signature || dict.hero?.sousTitre;
        const heroSub = normalizeText(await page.locator('.hero-sub').innerText()).toLowerCase();
        expect(heroSub).toBe(normalizeText(expectedHeroSignature).toLowerCase());

        const heroText = normalizeText(await page.locator('.hero-text').innerText()).toLowerCase();
        expect(heroText).toBe(normalizeText(dict.hero.texte).toLowerCase());

        // Bouton héros
        const expectedHeroBtn = A.hero?.bouton || dict.hero?.bouton;
        const heroBtn = normalizeText(await page.locator('.hero-content a.btn').first().innerText()).toLowerCase();
        expect(heroBtn).toBe(normalizeText(expectedHeroBtn).toLowerCase());

        // Titres h2 des sections
        const expectedPFTitre = A.portfolio?.titre || dict.accueil?.portfolio?.titre || dict.creons?.titre;
        const expectedEqTitre = A.equipe?.titre || dict.accueil?.equipe?.titre || dict.equipe?.titre;
        const expectedSvcTitre = A.services?.titre || dict.accueil?.services?.titre || dict.services?.titre;
        const expectedCtcTitre = A.contact?.titre || dict.accueil?.contact?.titre || dict.contact?.titre;

        const h2Texts = await page.locator('main h2').allInnerTexts();
        const normalizedH2s = h2Texts.map((t) => normalizeText(t).toLowerCase());

        expect(normalizedH2s.some((t) => t.includes(normalizeText(expectedPFTitre).toLowerCase()))).toBe(true);
        expect(normalizedH2s.some((t) => t.includes(normalizeText(expectedEqTitre).toLowerCase()))).toBe(true);
        expect(normalizedH2s.some((t) => t.includes(normalizeText(expectedSvcTitre).toLowerCase()))).toBe(true);
        expect(normalizedH2s.some((t) => t.includes(normalizeText(expectedCtcTitre).toLowerCase()))).toBe(true);
      } else if (pageDef.type === 'services') {
        expect(h1FullText).toContain(normalizeText(dict.services.titre).toLowerCase());

        // Titre vision
        const visionH2 = normalizeText(await page.locator('.vision-title').innerText()).toLowerCase();
        expect(visionH2).toBe(normalizeText(dict.services.vision.titre).toLowerCase());
      } else if (pageDef.type === 'portfolio') {
        expect(h1FullText).toContain(normalizeText(dict.portfolio.heroTitre).toLowerCase());
      } else if (pageDef.type === 'client') {
        const client = CLIENTS.find(
          (c: any) => (c.slug || c.nom.toLowerCase().replace(/[^a-z0-9]+/g, '-')) === pageDef.clientSlug
        );
        expect(client).toBeDefined();
        const clientTitle = client.nomHero || client.nom;
        expect(h1FullText).toContain(normalizeText(clientTitle).toLowerCase());
      } else if (pageDef.type === 'apropos') {
        expect(h1FullText).toContain(normalizeText(dict.apropos.titre).toLowerCase());
      } else if (pageDef.type === 'contact') {
        expect(h1FullText).toContain(normalizeText(dict.contact.titre).toLowerCase());
      }

      // Pied de page commun
      const footer = page.locator('.site-footer');
      await expect(footer).toBeVisible();
      const footerText = normalizeText(await footer.innerText()).toLowerCase();
      expect(footerText).toContain(normalizeText(dict.pied.droits).toLowerCase());
      expect(footerText).toContain(normalizeText(dict.contact.suivre).toLowerCase());
    });
  }
});

/* =========================================================================
   SUITE 4 : Intégrité du contenu et placeholders conformes (Point 2)
   ========================================================================= */
test.describe('Bloc 3 - Intégrité du contenu et conformité des placeholders (.tbc)', () => {
  for (const pageDef of PAGES) {
    test(`[${pageDef.lang.toUpperCase()}] Absence de texte parasite ou placeholder non conforme sur ${pageDef.name}`, async ({ page }) => {
      await page.goto(pageDef.url);

      const bodyText = (await page.locator('body').textContent()) || '';

      // 1. Aucun mot-clé interdit (maquette, débogage, erreur de template)
      const forbiddenPatterns = [
        /\bLorem\s+ipsum\b/i,
        /\bTODO\b/i,
        /\bFIXME\b/i,
        /\bundefined\b/i,
        /\bnull\b/i,
        /\bNaN\b/i,
        /\{\{[^}]+\}\}/, // balises de template moustache non résolues
      ];

      for (const pattern of forbiddenPatterns) {
        expect(
          bodyText,
          `Texte interdit détecté par ${pattern} sur la page ${pageDef.name}`
        ).not.toMatch(pattern);
      }

      // 2. Traitement strict des éléments masqués .tbc
      const tbcElements = page.locator('.tbc');
      const tbcCount = await tbcElements.count();

      for (let i = 0; i < tbcCount; i++) {
        const el = tbcElements.nth(i);
        await expect(
          el,
          `L'élément .tbc #${i} sur ${pageDef.name} ne doit pas être visible pour les utilisateurs`
        ).toBeHidden();

        const rawText = (await el.innerText()).trim();
        if (rawText.length > 0) {
          expect(
            rawText,
            `L'élément .tbc sur ${pageDef.name} doit suivre le format de brouillon [À CONFIRMER...] ou [Note...]`
          ).toMatch(/^\[.+\]$/s);
        }
      }
    });
  }
});
