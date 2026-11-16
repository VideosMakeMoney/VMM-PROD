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
const clientVideos = (c: any) => portfolio.videos.filter((v: any) => v.type !== 'coulisses' && v.client === c.nom);
const CLIENTS = portfolio.clients.filter((c: any) => clientVideos(c).length);

// Normalise les chaînes de caractères pour comparaison (nettoie les espaces multiples, retours à la ligne et balises)
function normalizeText(s: string): string {
  if (!s) return '';
  return s
    .replace(/\*([^*]+)\*/g, '$1') // Supprime la syntaxe markdown *mot en violet*
    .replace(/<[^>]+>/g, ' ')      // Supprime les balises HTML éventuelles
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Routes du site par langue
const ROUTES: Record<string, { fr: string; en: string }> = {
  accueil: { fr: '/', en: '/en/' },
  services: { fr: '/services/', en: '/en/services/' },
  portfolio: { fr: '/portfolio/', en: '/en/portfolio/' },
  apropos: { fr: '/about/', en: '/en/about/' },
  contact: { fr: '/contact/', en: '/en/contact/' },
};

// Calcule l'URL équivalente dans l'autre langue
function getCounterpartUrl(pageDef: PageDefinition): string {
  if (pageDef.type === 'client' && pageDef.clientSlug) {
    return pageDef.lang === 'fr'
      ? `/en/portfolio/${pageDef.clientSlug}/`
      : `/portfolio/${pageDef.clientSlug}/`;
  }
  const route = ROUTES[pageDef.type];
  if (route) {
    return pageDef.lang === 'fr' ? route.en : route.fr;
  }
  return pageDef.lang === 'fr' ? '/en/' : '/';
}

/* =========================================================================
   SUITE 1 : Navigation d'en-tête et bascule de langue (Spécification point 4)
   ========================================================================= */
test.describe('Bloc 3 - Navigation d\'en-tête et bascule linguistique', () => {
  for (const pageDef of PAGES) {
    test(`[${pageDef.lang.toUpperCase()}] Navigation et bascule de langue sur ${pageDef.name}`, async ({ page, request }) => {
      await page.goto(pageDef.url);
      const dict = pageDef.lang === 'fr' ? fr : en;

      // 1. Vérification des 5 liens du menu d'en-tête
      const expectedNavLinks = [
        { key: 'accueil', text: dict.nav.accueil, href: ROUTES.accueil[pageDef.lang] },
        { key: 'services', text: dict.nav.services, href: ROUTES.services[pageDef.lang] },
        { key: 'portfolio', text: dict.nav.portfolio, href: ROUTES.portfolio[pageDef.lang] },
        { key: 'apropos', text: dict.nav.apropos, href: ROUTES.apropos[pageDef.lang] },
        { key: 'contact', text: dict.nav.contact, href: ROUTES.contact[pageDef.lang] },
      ];

      for (const item of expectedNavLinks) {
        const linkLocator = page.locator(`#menu a[href="${item.href}"]`);
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
      await expect(switchLocator).toHaveAttribute('aria-label', dict.nav.autreLangueNom);

      // 3. Vérification de la validité de la cible de bascule (HTTP 200)
      const counterpartRes = await request.get(expectedCounterpartUrl);
      expect(counterpartRes.status()).toBe(200);
    });
  }
});

/* =========================================================================
   SUITE 2 : Description SEO et résumé des héros (Spécification point 3)
   ========================================================================= */
test.describe('Bloc 3 - Description SEO et spécificité du héros', () => {
  for (const pageDef of PAGES) {
    test(`[${pageDef.lang.toUpperCase()}] Description SEO spécifique du héros sur ${pageDef.name}`, async ({ page }) => {
      await page.goto(pageDef.url);
      const dict = pageDef.lang === 'fr' ? fr : en;
      const servicesResume = normalizeText(dict.seo.services.resume);

      if (pageDef.type === 'accueil') {
        const summaryLocator = page.locator('.page-summary');
        await expect(summaryLocator).toHaveCount(1);
        const summaryText = normalizeText(await summaryLocator.innerText());
        expect(summaryText).toBe(normalizeText(dict.seo.accueil.resume));
      } else if (pageDef.type === 'services') {
        // Services affiche son résumé et son intro propre
        const summaryLocator = page.locator('.page-summary');
        await expect(summaryLocator).toHaveCount(1);
        const summaryText = normalizeText(await summaryLocator.innerText());
        expect(summaryText).toBe(servicesResume);

        const heroIntroLocator = page.locator('.hero-intro');
        await expect(heroIntroLocator).toHaveCount(1);
        const introText = normalizeText(await heroIntroLocator.innerText());
        expect(introText).toBe(normalizeText(dict.services.hero.intro));
      } else if (pageDef.type === 'portfolio') {
        const summaryLocator = page.locator('.page-summary');
        await expect(summaryLocator).toHaveCount(1);
        const summaryText = normalizeText(await summaryLocator.innerText());
        expect(summaryText).toBe(normalizeText(dict.seo.portfolio.resume));
        // NE DOIT PAS contenir la description/résumé de Services
        expect(summaryText).not.toContain(servicesResume);
      } else if (pageDef.type === 'apropos') {
        const summaryLocator = page.locator('.page-summary');
        await expect(summaryLocator).toHaveCount(1);
        const summaryText = normalizeText(await summaryLocator.innerText());
        expect(summaryText).toBe(normalizeText(dict.seo.apropos.resume));
        // NE DOIT PAS contenir la description/résumé de Services
        expect(summaryText).not.toContain(servicesResume);
      } else if (pageDef.type === 'contact') {
        const summaryLocator = page.locator('.page-summary');
        await expect(summaryLocator).toHaveCount(1);
        const summaryText = normalizeText(await summaryLocator.innerText());
        expect(summaryText).toBe(normalizeText(dict.seo.contact.resume));
        // NE DOIT PAS contenir la description/résumé de Services
        expect(summaryText).not.toContain(servicesResume);
      } else if (pageDef.type === 'client') {
        const client = CLIENTS.find(
          (c: any) => (c.slug || c.nom.toLowerCase().replace(/[^a-z0-9]+/g, '-')) === pageDef.clientSlug
        );
        expect(client).toBeDefined();

        const count = clientVideos(client).length;
        const countStr = `${count} ${count > 1 ? dict.portfolio.videos : dict.portfolio.video}`;
        const expectedResume = normalizeText(
          dict.portfolio.clientResume.replace('{n}', countStr).replace('{client}', client.nom)
        );

        const summaryLocator = page.locator('.page-summary');
        await expect(summaryLocator).toHaveCount(1);
        const summaryText = normalizeText(await summaryLocator.innerText());
        expect(summaryText).toBe(expectedResume);

        // NE DOIT PAS contenir la description/résumé de Services
        expect(summaryText).not.toContain(servicesResume);
      }
    });
  }
});

/* =========================================================================
   SUITE 3 : Textes visibles importants (Titres, boutons, pied) (Point 1)
   ========================================================================= */
test.describe('Bloc 3 - Textes visibles importants (h1, h2, boutons, pied)', () => {
  for (const pageDef of PAGES) {
    test(`[${pageDef.lang.toUpperCase()}] Textes visibles majeurs sur ${pageDef.name}`, async ({ page }) => {
      await page.goto(pageDef.url);
      const dict = pageDef.lang === 'fr' ? fr : en;

      // 1. Titre H1 et sous-titre .h1-sub
      const h1Locator = page.locator('h1').first();
      await expect(h1Locator).toBeVisible();
      const h1FullText = normalizeText(await h1Locator.innerText());

      const h1SubLocator = page.locator('h1 .h1-sub');
      await expect(h1SubLocator).toHaveCount(1);
      const h1SubText = normalizeText(await h1SubLocator.innerText());

      // 2. Vérifications spécifiques par type de page
      if (pageDef.type === 'accueil') {
        expect(h1FullText).toContain(normalizeText(dict.hero.titre));
        expect(h1SubText).toBe(normalizeText(dict.seo.accueil.h1));

        // Textes du héros
        const heroSub = normalizeText(await page.locator('.hero-sub').innerText());
        expect(heroSub).toBe(normalizeText(dict.hero.sousTitre));

        const heroText = normalizeText(await page.locator('.hero-text').innerText());
        expect(heroText).toBe(normalizeText(dict.hero.texte));

        // Bouton héros
        const heroBtn = normalizeText(await page.locator('.hero-content a.btn').innerText());
        expect(heroBtn).toBe(normalizeText(dict.hero.bouton));

        // Titres h2 des sections
        expect(normalizeText(await page.locator('#creons-title').innerText())).toBe(normalizeText(dict.creons.titre));
        expect(normalizeText(await page.locator('#equipe-title').innerText())).toBe(normalizeText(dict.equipe.titre));
        expect(normalizeText(await page.locator('#realisations-title').innerText())).toBe(normalizeText(dict.realisations.titre));
        expect(normalizeText(await page.locator('#contact-title').innerText())).toBe(normalizeText(dict.contact.titre));
        expect(normalizeText(await page.locator('#avis-title').innerText())).toBe(normalizeText(dict.avis.titre));

        // Boutons CTA des sections
        expect(normalizeText(await page.locator('#creations .cta-row a.btn').innerText())).toBe(normalizeText(dict.creons.bouton));
        expect(normalizeText(await page.locator('#equipe .cta-row a.btn').innerText())).toBe(normalizeText(dict.equipe.bouton));
        expect(normalizeText(await page.locator('#realisations .cta-row a.btn').innerText())).toBe(normalizeText(dict.realisations.bouton));
        expect(normalizeText(await page.locator('#contact button[type="submit"]').innerText())).toBe(normalizeText(dict.contact.champs.envoyer));
      } else if (pageDef.type === 'services') {
        const expectedH1Main = normalizeText(`${dict.services.hero.ligne1} ${dict.services.hero.ligne2}`);
        expect(h1FullText).toContain(expectedH1Main);
        expect(h1SubText).toBe(normalizeText(dict.seo.services.h1));

        // Titres h2 des sections de services
        expect(normalizeText(await page.locator('#vision-title').innerText())).toBe(normalizeText(dict.services.vision.titre));
        expect(normalizeText(await page.locator('#svc-1').innerText())).toBe(normalizeText(dict.services.groupes[0].titre));
        expect(normalizeText(await page.locator('#svc-2').innerText())).toBe(normalizeText(dict.services.groupes[1].titre));
        expect(normalizeText(await page.locator('#svc-3').innerText())).toBe(normalizeText(dict.services.groupes[2].titre));

        // Sections conditionnées par drapeau dans site.json
        if (shown(dict.services.camera)) {
          expect(normalizeText(await page.locator('#camera-title').innerText())).toBe(normalizeText(dict.services.camera.titre));
        }
        if (shown(dict.services.fin)) {
          expect(normalizeText(await page.locator('#fin-title').innerText())).toBe(normalizeText(dict.services.fin.titre));
          expect(normalizeText(await page.locator('.jd-end .cta-row a.btn').innerText())).toBe(normalizeText(dict.services.fin.bouton));
        }
      } else if (pageDef.type === 'portfolio') {
        expect(h1FullText).toContain(normalizeText(dict.portfolio.titre));
        expect(h1SubText).toBe(normalizeText(dict.seo.portfolio.h1));

        // Titres h2
        expect(normalizeText(await page.locator('#clients-title').innerText())).toBe(normalizeText(dict.portfolio.parClientTitre));
        expect(normalizeText(await page.locator('#vedettes-title').innerText())).toBe(normalizeText(dict.portfolio.vedettesTitre));
        expect(normalizeText(await page.locator('#coulisses-title').innerText())).toBe(normalizeText(dict.portfolio.coulissesTitre));

        // Bouton vers À propos
        expect(normalizeText(await page.locator('section[aria-labelledby="coulisses-title"] .cta-row a.btn').innerText())).toBe(normalizeText(dict.portfolio.bouton));
      } else if (pageDef.type === 'client') {
        const client = CLIENTS.find(
          (c: any) => (c.slug || c.nom.toLowerCase().replace(/[^a-z0-9]+/g, '-')) === pageDef.clientSlug
        );
        expect(client).toBeDefined();

        expect(h1FullText).toContain(normalizeText(client.nom));
        const expectedH1Sub = normalizeText(dict.portfolio.clientH1.replaceAll('{client}', client.nom));
        expect(h1SubText).toBe(expectedH1Sub);

        // Bouton retour
        const backBtn = page.locator('.btn-back').first();
        expect(normalizeText(await backBtn.innerText())).toBe(normalizeText(dict.portfolio.retour));
      } else if (pageDef.type === 'apropos') {
        expect(h1FullText).toContain(normalizeText(dict.apropos.titre));
        expect(h1SubText).toBe(normalizeText(dict.seo.apropos.h1));

        // Titres h2
        expect(normalizeText(await page.locator('#visages-title').innerText())).toBe(normalizeText(dict.apropos.vision.titre));
        expect(normalizeText(await page.locator('#jd-title').innerText())).toBe(normalizeText(dict.apropos.membres[0].titre));
        expect(normalizeText(await page.locator('#renaud-title').innerText())).toBe(normalizeText(dict.apropos.membres[1].titre));
        expect(normalizeText(await page.locator('#gens-title').innerText())).toBe(normalizeText(dict.apropos.fin.titre));

        // Bouton CTA vers contact
        expect(normalizeText(await page.locator('.jd-closing .cta-row a.btn').innerText())).toBe(normalizeText(dict.apropos.fin.bouton));
      } else if (pageDef.type === 'contact') {
        expect(h1FullText).toContain(normalizeText(dict.contact.titre));
        expect(h1SubText).toBe(normalizeText(dict.seo.contact.h1));

        // FAQ
        expect(normalizeText(await page.locator('#faq-title').innerText())).toBe(normalizeText(dict.faq.titre));

        // Bouton soumettre
        expect(normalizeText(await page.locator('form.contact-form button[type="submit"]').innerText())).toBe(normalizeText(dict.contact.champs.envoyer));
      }

      // 3. Pied de page commun
      const footer = page.locator('.site-footer');
      await expect(footer).toBeVisible();
      const footerText = normalizeText(await footer.innerText());
      expect(footerText).toContain(normalizeText(dict.contact.zone));
      expect(footerText).toContain(normalizeText(dict.pied.droits));
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
        /\bundefined\b/,
        /\bNaN\b/,
      ];

      for (const pattern of forbiddenPatterns) {
        expect(bodyText).not.toMatch(pattern);
      }

      // 2. Tous les éléments avec classe .tbc doivent contenir un placeholder légitime [À CONFIRMER...] ou [TO CONFIRM...]
      const tbcElements = page.locator('.tbc');
      const count = await tbcElements.count();
      for (let i = 0; i < count; i++) {
        const text = await tbcElements.nth(i).textContent();
        expect(normalizeText(text || '')).toMatch(/^\[(?:À CONFIRMER|TO CONFIRM)/);
      }

      // 3. Aucun placeholder [À CONFIRMER...] ou [TO CONFIRM...] ne doit subsister sans balise .tbc
      const unwrappedPlaceholders = await page.evaluate(() => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        // Supprime tous les éléments légitimes .tbc du clone
        clone.querySelectorAll('.tbc').forEach((el) => el.remove());
        // Supprime les scripts et styles
        clone.querySelectorAll('script, style').forEach((el) => el.remove());
        const text = clone.textContent || '';
        const matches = text.match(/\[(?:À CONFIRMER|TO CONFIRM)[^\]]*\]/g);
        return matches || [];
      });

      expect(unwrappedPlaceholders).toEqual([]);
    });
  }
});
