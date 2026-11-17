import { test, expect } from '@playwright/test';
import { PAGES, PageDefinition } from './helpers';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', file), 'utf8'));

const site = readJson('site.json');
const frContent = readJson('fr.json');
const enContent = readJson('en.json');
const portfolio = readJson('portfolio.json');

const contentByLang = {
  fr: frContent,
  en: enContent,
};

test.describe('1. Balises SEO de chaque page (FR et EN)', () => {
  for (const pageDef of PAGES) {
    test(`Balises SEO : ${pageDef.name} (${pageDef.url})`, async ({ page }) => {
      await page.goto(pageDef.url);

      // 1.1 <title> présent, non vide, <= 60 caractères (DOM décodé) ou conforme au contenu source
      const title = await page.title();
      expect(title, `Le titre de ${pageDef.url} doit être présent`).toBeTruthy();
      expect(title.trim().length, `Le titre de ${pageDef.url} ne doit pas être vide`).toBeGreaterThan(0);
      expect(
        title.length,
        `Le titre de ${pageDef.url} (${title}) a une longueur de ${title.length} caractères, attendu <= 60`
      ).toBeLessThanOrEqual(60);

      // Vérification de conformité avec les fichiers content/*.json
      const L = contentByLang[pageDef.lang];
      if (pageDef.type === 'client' && pageDef.clientSlug) {
        const client = portfolio.clients.find((c: any) => (c.slug || c.nom.toLowerCase()) === pageDef.clientSlug);
        if (client) {
          const expectedTitleTemplate = L.portfolio.clientSeoTitre;
          const expectedTitle = expectedTitleTemplate.replace('{client}', client.nom);
          expect(title).toBe(expectedTitle);
        }
      } else if (pageDef.type in L.seo) {
        expect(title).toBe(L.seo[pageDef.type].title);
      }

      // 1.2 <meta name="description"> présent, non vide, <= 160 caractères
      const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
      expect(metaDescription, `La meta description de ${pageDef.url} doit être présente`).toBeTruthy();
      expect(metaDescription!.trim().length, `La meta description de ${pageDef.url} ne doit pas être vide`).toBeGreaterThan(0);
      expect(
        metaDescription!.length,
        `La meta description de ${pageDef.url} (${metaDescription!.length} car.) dépasse 160 caractères`
      ).toBeLessThanOrEqual(160);

      // 1.3 Canonical : <link rel="canonical"> présent et pointant vers https://videosmakemoney.ca/...
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical, `La balise canonical de ${pageDef.url} doit être présente`).toBeTruthy();
      expect(canonical).toMatch(/^https:\/\/videosmakemoney\.ca\//);
      expect(canonical).toBe(`https://videosmakemoney.ca${pageDef.url}`);

      // 1.4 hreflang : balises fr-CA, en-CA et x-default sur toutes les pages indexables
      const hreflangFr = await page.locator('link[rel="alternate"][hreflang="fr-CA"]').getAttribute('href');
      const hreflangEn = await page.locator('link[rel="alternate"][hreflang="en-CA"]').getAttribute('href');
      const hreflangDef = await page.locator('link[rel="alternate"][hreflang="x-default"]').getAttribute('href');

      expect(hreflangFr, `hreflang="fr-CA" manquant sur ${pageDef.url}`).toBeTruthy();
      expect(hreflangEn, `hreflang="en-CA" manquant sur ${pageDef.url}`).toBeTruthy();
      expect(hreflangDef, `hreflang="x-default" manquant sur ${pageDef.url}`).toBeTruthy();

      expect(hreflangFr).toMatch(/^https:\/\/videosmakemoney\.ca\//);
      expect(hreflangEn).toMatch(/^https:\/\/videosmakemoney\.ca\//);
      expect(hreflangDef).toMatch(/^https:\/\/videosmakemoney\.ca\//);

      // x-default doit pointer vers la version française
      expect(hreflangDef).toBe(hreflangFr);

      // Déduction de l'URL alterne correspondante
      if (pageDef.lang === 'fr') {
        expect(hreflangFr).toBe(`https://videosmakemoney.ca${pageDef.url}`);
        expect(hreflangEn).toBe(`https://videosmakemoney.ca/en${pageDef.url === '/' ? '/' : pageDef.url}`);
      } else {
        const frPath = pageDef.url.replace(/^\/en/, '') || '/';
        expect(hreflangFr).toBe(`https://videosmakemoney.ca${frPath}`);
        expect(hreflangEn).toBe(`https://videosmakemoney.ca${pageDef.url}`);
      }
    });
  }
});

test.describe('2. Données structurées JSON-LD', () => {
  for (const pageDef of PAGES) {
    test(`JSON-LD valide : ${pageDef.name} (${pageDef.url})`, async ({ page }) => {
      await page.goto(pageDef.url);

      const jsonLdLocator = page.locator('script[type="application/ld+json"]');
      await expect(jsonLdLocator, `Script JSON-LD manquant sur ${pageDef.url}`).toHaveCount(1);

      const rawContent = await jsonLdLocator.textContent();
      expect(rawContent).toBeTruthy();

      let json: any;
      expect(() => {
        json = JSON.parse(rawContent!);
      }, `Syntaxe JSON invalide sur ${pageDef.url}`).not.toThrow();

      expect(json['@context']).toBe('https://schema.org');
      expect(Array.isArray(json['@graph'])).toBe(true);

      const graph = json['@graph'];

      // Toutes les pages indexables ont ProfessionalService (ou LocalBusiness) et WebSite
      const business = graph.find((item: any) => item['@type'] === 'ProfessionalService' || item['@type'] === 'LocalBusiness');
      expect(business, `ProfessionalService ou LocalBusiness manquant dans le JSON-LD de ${pageDef.url}`).toBeDefined();
      expect(business.name).toBe('VMM Productions');
      expect(business.url).toBe('https://videosmakemoney.ca/');

      const website = graph.find((item: any) => item['@type'] === 'WebSite');
      expect(website, `WebSite manquant dans le JSON-LD de ${pageDef.url}`).toBeDefined();
      expect(website.name).toBe('VMM Productions');
      expect(website.url).toBe('https://videosmakemoney.ca/');

      // Vérifications spécifiques par type de page
      if (pageDef.type === 'accueil') {
        // Accueil : LocalBusiness ou ProfessionalService, WebSite, Person (JD, Renaud)
        const persons = graph.filter((item: any) => item['@type'] === 'Person');
        expect(persons.length, 'Au moins 2 personnes (JD, Renaud) attendues sur l accueil').toBeGreaterThanOrEqual(2);

        const jd = persons.find((p: any) => p['@id']?.includes('#jd') || p.alternateName === 'JD' || p.name?.includes('Jean-David'));
        const renaud = persons.find((p: any) => p['@id']?.includes('#renaud') || p.name?.includes('Renaud'));

        expect(jd, 'Person JD manquante sur l accueil').toBeDefined();
        expect(renaud, 'Person Renaud manquante sur l accueil').toBeDefined();
      }

      if (pageDef.type === 'services') {
        // Services : Service schema pour les offres
        const services = graph.filter((item: any) => item['@type'] === 'Service');
        expect(services.length, 'Au moins une offre de Service attendue dans le schema').toBeGreaterThan(0);

        for (const s of services) {
          expect(s.name, 'Nom de service requis').toBeTruthy();
          expect(s.serviceType, 'serviceType requis').toBeTruthy();
          expect(s.description, 'description de service requise').toBeTruthy();
          expect(s.provider, 'provider requis pour chaque Service').toBeDefined();
        }
      }

      if (pageDef.type === 'portfolio' || pageDef.type === 'client') {
        // Portfolio et pages clients : VideoObject pour les vidéos avec uploadDate/dateMiseEnLigne
        const videoObjects = graph.filter((item: any) => item['@type'] === 'VideoObject');

        // Toute balise VideoObject présente DOIT respecter le standard Google (notamment uploadDate)
        for (const vo of videoObjects) {
          expect(vo.name, 'Nom de VideoObject requis').toBeTruthy();
          expect(vo.description, 'Description de VideoObject requise').toBeTruthy();
          expect(vo.thumbnailUrl, 'thumbnailUrl de VideoObject requis').toBeTruthy();
          expect(vo.embedUrl, 'embedUrl de VideoObject requis').toBeTruthy();
          expect(vo.uploadDate, 'uploadDate requis par Google sur tout VideoObject').toBeTruthy();
          expect(vo.uploadDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }

        // Vérification de concordance avec portfolio.json : les vidéos qui ont une dateMiseEnLigne doivent avoir leur VideoObject
        let expectedVideos: any[] = [];
        if (pageDef.type === 'portfolio') {
          // Sur la page portfolio principale, build.mjs passe portfolioVideos() (les vidéos de catégories)
          expectedVideos = (portfolio.categories || [])
            .map((cat: any) => portfolio.videos.find((v: any) => v.youtubeId === cat.video))
            .filter((v: any) => v && v.youtubeId && v.dateMiseEnLigne);
        } else if (pageDef.clientSlug) {
          const client = portfolio.clients.find((c: any) => (c.slug || c.nom.toLowerCase()) === pageDef.clientSlug);
          if (client) {
            expectedVideos = portfolio.videos.filter(
              (v: any) => (v.client === client.nom || v.client === client.slug) && v.type !== 'coulisses' && v.youtubeId && v.dateMiseEnLigne
            );
          }
        }

        for (const expected of expectedVideos) {
          const found = videoObjects.find((vo: any) => vo['@id']?.includes(expected.youtubeId));
          expect(found, `VideoObject pour la vidéo ${expected.youtubeId} avec dateMiseEnLigne (${expected.dateMiseEnLigne}) manquant`).toBeDefined();
        }
      }

      if (pageDef.type === 'apropos') {
        // À propos : Person pour JD et Renaud
        const persons = graph.filter((item: any) => item['@type'] === 'Person');
        expect(persons.length, 'JD et Renaud attendus sur la page À propos').toBeGreaterThanOrEqual(2);

        const jd = persons.find((p: any) => p['@id']?.includes('#jd') || p.alternateName === 'JD' || p.name?.includes('Jean-David'));
        const renaud = persons.find((p: any) => p['@id']?.includes('#renaud') || p.name?.includes('Renaud'));

        expect(jd, 'Person JD manquante sur À propos').toBeDefined();
        expect(renaud, 'Person Renaud manquante sur À propos').toBeDefined();
        expect(jd.jobTitle).toBeTruthy();
        expect(renaud.jobTitle).toBeTruthy();
      }

      if (pageDef.type === 'contact') {
        // Contact : FAQPage avec questions/réponses conformes
        if (pageDef.lang === 'fr') {
          const faqPage = graph.find((item: any) => item['@type'] === 'FAQPage');
          expect(faqPage, 'FAQPage manquante sur la page Contact FR').toBeDefined();
          expect(Array.isArray(faqPage.mainEntity)).toBe(true);
          expect(faqPage.mainEntity.length).toBeGreaterThan(0);

          for (const qa of faqPage.mainEntity) {
            expect(qa['@type']).toBe('Question');
            expect(qa.name, 'Question FAQ manquante').toBeTruthy();
            expect(qa.acceptedAnswer, 'acceptedAnswer manquant').toBeDefined();
            expect(qa.acceptedAnswer['@type']).toBe('Answer');
            expect(qa.acceptedAnswer.text, 'Texte de réponse FAQ manquant').toBeTruthy();
            expect(qa.acceptedAnswer.text).not.toContain('[À CONFIRMER');
          }
        } else {
          // Sur la page EN : s'il y a des réponses FAQ confirmées, FAQPage doit être présent
          // Si toutes les réponses sont des placeholders [TO CONFIRM], le site ne doit pas générer un FAQPage avec des placeholders
          const faqPage = graph.find((item: any) => item['@type'] === 'FAQPage');
          if (faqPage) {
            for (const qa of faqPage.mainEntity) {
              expect(qa.acceptedAnswer.text).not.toContain('[TO CONFIRM');
            }
          }
        }
      }
    });
  }
});

test.describe('3. Fichiers sitemap.xml et robots.txt', () => {
  test('/sitemap.xml est accessible (200), valide XML, et contient les URLs FR et EN', async ({ request, page }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);

    const xmlText = await response.text();
    expect(xmlText).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xmlText).toContain('<urlset');
    expect(xmlText).toContain('</urlset>');

    // Validation XML via le parseur DOM du navigateur
    const parseResult = await page.evaluate((xml) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      const parserError = doc.querySelector('parsererror');
      return {
        isValid: !parserError,
        error: parserError ? parserError.textContent : null,
      };
    }, xmlText);

    expect(parseResult.isValid, `Erreur XML dans /sitemap.xml: ${parseResult.error}`).toBe(true);

    // Vérification de la présence de toutes les URLs FR et EN de PAGES
    for (const pageDef of PAGES) {
      const expectedUrl = `https://videosmakemoney.ca${pageDef.url}`;
      expect(xmlText, `L URL ${expectedUrl} doit être présente dans /sitemap.xml`).toContain(`<loc>${expectedUrl}</loc>`);
    }

    // Vérification des alternate links hreflang dans sitemap.xml
    expect(xmlText).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xmlText).toContain('hreflang="fr-CA"');
    expect(xmlText).toContain('hreflang="en-CA"');
    expect(xmlText).toContain('hreflang="x-default"');

    // Vérification de l'intégration vidéo conditionnelle :
    // Toute entrée <video:video> doit obligatoirement avoir une publication_date (uploadDate)
    const videoMatches = xmlText.match(/<video:video>([\s\S]*?)<\/video:video>/g) || [];
    for (const vBlock of videoMatches) {
      expect(vBlock).toContain('<video:thumbnail_loc>');
      expect(vBlock).toContain('<video:title>');
      expect(vBlock).toContain('<video:description>');
      expect(vBlock).toContain('<video:player_loc>');
      expect(vBlock).toContain('<video:publication_date>');
    }
  });

  test('/robots.txt est accessible (200) et référence le sitemap', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);

    const robotsTxt = await response.text();
    expect(robotsTxt).toContain('User-agent: *');
    expect(robotsTxt).toContain('Sitemap: https://videosmakemoney.ca/sitemap.xml');
  });
});

test.describe('4. Pas de noindex en production vs comportement par défaut (démo)', () => {
  test('Mode production (VMM_ALLOW_INDEX="true") : Allow: / et aucun noindex sur les pages indexables', async ({ request, page }) => {
    // 1. /robots.txt en production
    const robotsRes = await request.get('/robots.txt');
    const robotsTxt = await robotsRes.text();

    expect(robotsTxt, 'En production, robots.txt doit contenir Allow: /').toContain('Allow: /');
    expect(robotsTxt, 'En production, robots.txt ne doit pas contenir Disallow: /').not.toContain('Disallow: /');
    expect(robotsTxt).toContain('Sitemap: https://videosmakemoney.ca/sitemap.xml');

    // 2. Aucune page indexable ne doit contenir <meta name="robots" content="noindex...">
    for (const pageDef of PAGES) {
      await page.goto(pageDef.url);
      const robotsMeta = await page.locator('meta[name="robots"]').count();
      if (robotsMeta > 0) {
        const content = await page.locator('meta[name="robots"]').getAttribute('content');
        expect(content || '', `La page indexable ${pageDef.name} (${pageDef.url}) ne doit pas avoir de noindex en production`).not.toContain('noindex');
      }
    }
  });

  test('Mécanisme de protection démo (ALLOW_INDEX désactivé sans VMM_ALLOW_INDEX=true)', () => {
    // Vérification unitaire de la logique de build.mjs
    const buildCode = fs.readFileSync(path.join(ROOT, 'build.mjs'), 'utf8');
    expect(buildCode).toContain("process.env.VMM_ALLOW_INDEX === 'true'");
    expect(buildCode).toContain('Disallow: /');
  });
});
