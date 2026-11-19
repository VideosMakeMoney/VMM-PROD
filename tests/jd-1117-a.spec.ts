import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildContactHtml } from '../build.mjs';

const ROOT = process.cwd();

test.describe('Ajustements JD du 17 nov. 2026 — PR A : Contact', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Point 8 — Formulaire de contact Netlify
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #8] Build dist/ : Correspondance exacte des champs statiques et des clés fetch, budget input[type=text] (FR + EN)', async () => {
    const frPath = join(ROOT, 'dist', 'contact', 'index.html');
    const enPath = join(ROOT, 'dist', 'en', 'contact', 'index.html');

    expect(existsSync(frPath), 'dist/contact/index.html doit exister').toBe(true);
    expect(existsSync(enPath), 'dist/en/contact/index.html doit exister').toBe(true);

    const frHtml = readFileSync(frPath, 'utf8');
    const enHtml = readFileSync(enPath, 'utf8');

    // Ensemble exact des clés que le client envoie par FormData / URLSearchParams
    const EXPECTED_KEYS = ['bot-field', 'budget', 'company', 'email', 'form-name', 'langue', 'message', 'name'];

    for (const [lang, html] of [['fr', frHtml], ['en', enHtml]] as const) {
      const formMatch = html.match(/<form[^>]+name="contact"[^>]*>([\s\S]*?)<\/form>/);
      expect(formMatch, `Le formulaire contact doit être présent en ${lang}`).not.toBeNull();
      const formTag = formMatch![0];
      const formInner = formMatch![1];

      // Formulaire Netlify complet
      expect(formTag).toContain('name="contact"');
      expect(formTag).toContain('data-netlify="true"');
      expect(formTag).toContain('netlify-honeypot="bot-field"');

      // Extraction de TOUS les noms de champs statiques du formulaire
      const fieldNames = Array.from(formInner.matchAll(/\bname="([^"]+)"/g))
        .map((m) => m[1])
        .sort();

      // Vérification : chaque champ du form statique correspond exactement aux clés du fetch (aucun champ ajouté seulement en JS)
      expect(fieldNames).toEqual(EXPECTED_KEYS);

      // Point 6 : budget doit être un input[type="text"], PAS un select
      expect(formInner).toMatch(/<input[^>]+name="budget"[^>]*type="text"/);
      expect(formInner).not.toMatch(/<select[^>]+name="budget"/);

      // Actions /merci/ et /en/thanks/
      if (lang === 'fr') {
        expect(formTag).toContain('action="/merci/"');
      } else {
        expect(formTag).toContain('action="/en/thanks/"');
      }
    }
  });

  test('[JD-1117 #8] Soumission POST (page.route 200, 500, abort) : Vérification stricte du body complet et des messages de statut (FR)', async ({ page }) => {
    // 1. Cas réponse 200 : vérification exhaustive du body POST
    let interceptedRequest: { url: string; method: string; headers: Record<string, string>; postData: string | null } | null = null;

    await page.route('/', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        interceptedRequest = {
          url: req.url(),
          method: req.method(),
          headers: req.headers(),
          postData: req.postData(),
        };
        await route.fulfill({ status: 200, contentType: 'text/html', body: 'OK' });
      } else {
        await route.continue();
      }
    });

    await page.goto('/contact/');

    const form = page.locator('form.contact-form');
    await expect(form).toBeVisible();

    // Remplissage de TOUS les champs, y compris budget en texte libre (« 5 000 $ »)
    await form.locator('input[name="name"]').fill('Jean-David Hanson');
    await form.locator('input[name="email"]').fill('jd@videosmakemoney.ca');
    await form.locator('input[name="company"]').fill('VMM Productions Inc');
    await form.locator('input[name="budget"]').fill('5 000 $');
    await form.locator('textarea[name="message"]').fill('Projet de test complet de régression');

    await form.locator('button[type="submit"]').click();

    expect(interceptedRequest).not.toBeNull();
    expect(interceptedRequest!.method).toBe('POST');
    expect(new URL(interceptedRequest!.url).pathname).toBe('/');
    expect(interceptedRequest!.headers['content-type']).toContain('application/x-www-form-urlencoded');

    const params = new URLSearchParams(interceptedRequest!.postData || '');
    const receivedKeys = Array.from(params.keys()).sort();
    expect(receivedKeys).toEqual(['bot-field', 'budget', 'company', 'email', 'form-name', 'langue', 'message', 'name']);
    expect(params.get('form-name')).toBe('contact');
    expect(params.get('langue')).toBe('fr');
    expect(params.get('bot-field')).toBe('');
    expect(params.get('name')).toBe('Jean-David Hanson');
    expect(params.get('email')).toBe('jd@videosmakemoney.ca');
    expect(params.get('company')).toBe('VMM Productions Inc');
    expect(params.get('budget')).toBe('5 000 $');
    expect(params.get('message')).toBe('Projet de test complet de régression');

    // Message de succès affiché
    const status = form.locator('.form-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/ok/);
    await expect(status).toContainText('Merci ! Votre message est bien parti');

    // 2. Cas réponse 500 : affichage du message d'erreur
    await page.unroute('/');
    await page.route('/', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        await route.fulfill({ status: 500, contentType: 'text/plain', body: 'Internal Server Error' });
      } else {
        await route.continue();
      }
    });

    await page.goto('/contact/');
    const form500 = page.locator('form.contact-form');
    await form500.locator('input[name="name"]').fill('Jean-David Test 500');
    await form500.locator('input[name="email"]').fill('jd@test.ca');
    await form500.locator('input[name="budget"]').fill('5 000 $');
    await form500.locator('textarea[name="message"]').fill('Test 500');
    await form500.locator('button[type="submit"]').click();

    const status500 = form500.locator('.form-status');
    await expect(status500).toBeVisible();
    await expect(status500).toHaveClass(/err/);
    await expect(status500).toContainText("L'envoi n'a pas fonctionné. Réessayez, ou écrivez-nous directement à jeandavid@videosmakemoney.ca.");

    // 3. Cas réseau coupé (route.abort) : affichage du message d'erreur
    await page.unroute('/');
    await page.route('/', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });

    await page.goto('/contact/');
    const formAbort = page.locator('form.contact-form');
    await formAbort.locator('input[name="name"]').fill('Jean-David Test Abort');
    await formAbort.locator('input[name="email"]').fill('jd@test.ca');
    await formAbort.locator('input[name="budget"]').fill('5 000 $');
    await formAbort.locator('textarea[name="message"]').fill('Test coupure réseau');
    await formAbort.locator('button[type="submit"]').click();

    const statusAbort = formAbort.locator('.form-status');
    await expect(statusAbort).toBeVisible();
    await expect(statusAbort).toHaveClass(/err/);
    await expect(statusAbort).toContainText("L'envoi n'a pas fonctionné. Réessayez, ou écrivez-nous directement à jeandavid@videosmakemoney.ca.");
  });

  test('[JD-1117 #8] Soumission POST (page.route 200, 500, abort) : Vérification stricte du body complet et des messages de statut (EN)', async ({ page }) => {
    // 1. Cas réponse 200 : vérification exhaustive du body POST en EN
    let interceptedRequest: { url: string; method: string; headers: Record<string, string>; postData: string | null } | null = null;

    await page.route('/', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        interceptedRequest = {
          url: req.url(),
          method: req.method(),
          headers: req.headers(),
          postData: req.postData(),
        };
        await route.fulfill({ status: 200, contentType: 'text/html', body: 'OK' });
      } else {
        await route.continue();
      }
    });

    await page.goto('/en/contact/');

    const form = page.locator('form.contact-form');
    await expect(form).toBeVisible();

    // Remplissage de TOUS les champs en anglais
    await form.locator('input[name="name"]').fill('JD English Client');
    await form.locator('input[name="email"]').fill('jd@test.ca');
    await form.locator('input[name="company"]').fill('VMM Global Productions');
    await form.locator('input[name="budget"]').fill('$5,000');
    await form.locator('textarea[name="message"]').fill('Complete automated regression test in English');

    await form.locator('button[type="submit"]').click();

    expect(interceptedRequest).not.toBeNull();
    expect(interceptedRequest!.method).toBe('POST');
    expect(new URL(interceptedRequest!.url).pathname).toBe('/');
    expect(interceptedRequest!.headers['content-type']).toContain('application/x-www-form-urlencoded');

    const params = new URLSearchParams(interceptedRequest!.postData || '');
    const receivedKeys = Array.from(params.keys()).sort();
    expect(receivedKeys).toEqual(['bot-field', 'budget', 'company', 'email', 'form-name', 'langue', 'message', 'name']);
    expect(params.get('form-name')).toBe('contact');
    expect(params.get('langue')).toBe('en');
    expect(params.get('bot-field')).toBe('');
    expect(params.get('name')).toBe('JD English Client');
    expect(params.get('email')).toBe('jd@test.ca');
    expect(params.get('company')).toBe('VMM Global Productions');
    expect(params.get('budget')).toBe('$5,000');
    expect(params.get('message')).toBe('Complete automated regression test in English');

    const status = form.locator('.form-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/ok/);
    await expect(status).toContainText('Thank you! Your message is on its way');

    // 2. Cas réponse 500
    await page.unroute('/');
    await page.route('/', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        await route.fulfill({ status: 500, contentType: 'text/plain', body: 'Internal Server Error' });
      } else {
        await route.continue();
      }
    });

    await page.goto('/en/contact/');
    const form500 = page.locator('form.contact-form');
    await form500.locator('input[name="name"]').fill('JD 500 Test');
    await form500.locator('input[name="email"]').fill('jd@test.ca');
    await form500.locator('input[name="budget"]').fill('$5,000');
    await form500.locator('textarea[name="message"]').fill('Test 500 EN');
    await form500.locator('button[type="submit"]').click();

    const status500 = form500.locator('.form-status');
    await expect(status500).toBeVisible();
    await expect(status500).toHaveClass(/err/);
    await expect(status500).toContainText('Sending failed. Please try again, or email us directly at jeandavid@videosmakemoney.ca.');

    // 3. Cas réseau coupé (abort)
    await page.unroute('/');
    await page.route('/', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });

    await page.goto('/en/contact/');
    const formAbort = page.locator('form.contact-form');
    await formAbort.locator('input[name="name"]').fill('JD Abort Test');
    await formAbort.locator('input[name="email"]').fill('jd@test.ca');
    await formAbort.locator('input[name="budget"]').fill('$5,000');
    await formAbort.locator('textarea[name="message"]').fill('Test abort EN');
    await formAbort.locator('button[type="submit"]').click();

    const statusAbort = formAbort.locator('.form-status');
    await expect(statusAbort).toBeVisible();
    await expect(statusAbort).toHaveClass(/err/);
    await expect(statusAbort).toContainText('Sending failed. Please try again, or email us directly at jeandavid@videosmakemoney.ca.');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Point 6 — « Fourchette de budget » devient un champ texte libre
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #6] Budget texte libre : Champ input[type=text] éditable sans aucun select (FR)', async ({ page }) => {
    await page.goto('/contact/');

    const form = page.locator('form.contact-form');
    // Aucun <select> dans le formulaire
    await expect(form.locator('select')).toHaveCount(0);

    // Champ budget texte libre avec autocomplete="off"
    const budgetInput = form.locator('input[name="budget"]');
    await expect(budgetInput).toBeVisible();
    await expect(budgetInput).toHaveAttribute('type', 'text');
    await expect(budgetInput).toHaveAttribute('autocomplete', 'off');

    // Libellé conservé
    const budgetId = await budgetInput.getAttribute('id');
    const budgetLabel = form.locator(`label[for="${budgetId}"]`);
    await expect(budgetLabel).toHaveText('Fourchette de budget');

    // Saisie libre possible
    await budgetInput.fill('5 000 $');
    await expect(budgetInput).toHaveValue('5 000 $');
  });

  test('[JD-1117 #6] Budget texte libre : Champ input[type=text] éditable sans aucun select (EN)', async ({ page }) => {
    await page.goto('/en/contact/');

    const form = page.locator('form.contact-form');
    await expect(form.locator('select')).toHaveCount(0);

    const budgetInput = form.locator('input[name="budget"]');
    await expect(budgetInput).toBeVisible();
    await expect(budgetInput).toHaveAttribute('type', 'text');
    await expect(budgetInput).toHaveAttribute('autocomplete', 'off');

    const budgetId = await budgetInput.getAttribute('id');
    const budgetLabel = form.locator(`label[for="${budgetId}"]`);
    await expect(budgetLabel).toHaveText('Budget range');

    await budgetInput.fill('$10,000 - $15,000');
    await expect(budgetInput).toHaveValue('$10,000 - $15,000');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Point 7 — Photo FAQ : dérivés optimisés, srcset responsive et rendu
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #7] Photo FAQ : Présence des fichiers dérivés optimisés WebP/JPG en 941, 720 et 470 px', async () => {
    const requiredFiles = [
      'static/img/faq-jd.webp',
      'static/img/faq-jd.jpg',
      'static/img/faq-jd-720.webp',
      'static/img/faq-jd-720.jpg',
      'static/img/faq-jd-470.webp',
      'static/img/faq-jd-470.jpg',
    ];

    for (const relPath of requiredFiles) {
      const fullPath = join(ROOT, relPath);
      expect(existsSync(fullPath), `Le fichier ${relPath} doit exister`).toBe(true);
      const stat = statSync(fullPath);
      expect(stat.size, `Le fichier ${relPath} ne doit pas être vide`).toBeGreaterThan(1000);
      expect(stat.size, `Le fichier ${relPath} doit faire moins de 300 Ko`).toBeLessThan(300 * 1024);
    }
  });

  test('[JD-1117 #7] Srcset responsive : Le <picture> FAQ liste les 3 largeurs (470w, 720w, 941w) en WebP et JPG (FR + EN)', async () => {
    for (const lang of ['fr', 'en'] as const) {
      const html = buildContactHtml(lang, { faqPhoto: true });
      expect(html, `La classe faq-with-photo doit être présente en ${lang}`).toContain('faq-with-photo');
      expect(html, `Le conteneur faq-photo-wrap doit être présent en ${lang}`).toContain('faq-photo-wrap');

      // Ciblage strict du bloc FAQ photo pour éviter toute confusion avec le logo d'en-tête
      const faqMatch = html.match(/<div class="faq-photo-wrap"[^>]*>([\s\S]*?)<\/div>/);
      expect(faqMatch, `faq-photo-wrap manquant en ${lang}`).not.toBeNull();
      const faqWrapHtml = faqMatch![1];

      // Vérification du <source type="image/webp">
      const webpSource = faqWrapHtml.match(/<source[^>]+type="image\/webp"[^>]*>/);
      expect(webpSource, `Source WebP manquante en ${lang}`).not.toBeNull();
      expect(webpSource![0]).toContain('470w');
      expect(webpSource![0]).toContain('720w');
      expect(webpSource![0]).toContain('941w');
      expect(webpSource![0]).toContain('/img/faq-jd-470.webp');
      expect(webpSource![0]).toContain('/img/faq-jd-720.webp');
      expect(webpSource![0]).toContain('/img/faq-jd.webp');

      // Vérification du <source type="image/jpeg">
      const jpgSource = faqWrapHtml.match(/<source[^>]+type="image\/jpeg"[^>]*>/);
      expect(jpgSource, `Source JPEG manquante en ${lang}`).not.toBeNull();
      expect(jpgSource![0]).toContain('470w');
      expect(jpgSource![0]).toContain('720w');
      expect(jpgSource![0]).toContain('941w');
      expect(jpgSource![0]).toContain('/img/faq-jd-470.jpg');
      expect(jpgSource![0]).toContain('/img/faq-jd-720.jpg');
      expect(jpgSource![0]).toContain('/img/faq-jd.jpg');

      // Vérification de l'attribut sizes
      expect(webpSource![0]).toMatch(/sizes="[^"]*380px[^"]*100vw[^"]*"/);
      expect(jpgSource![0]).toMatch(/sizes="[^"]*380px[^"]*100vw[^"]*"/);

      // Vérification de la balise <img> de repli avec son propre srcset
      const imgTag = faqWrapHtml.match(/<img[^>]+src="\/img\/faq-jd\.jpg"[^>]*>/);
      expect(imgTag, `Balise <img> de repli manquante en ${lang}`).not.toBeNull();
      expect(imgTag![0]).toContain('srcset="');
      expect(imgTag![0]).toContain('470w');
      expect(imgTag![0]).toContain('720w');
      expect(imgTag![0]).toContain('941w');
    }
  });

  test('[JD-1117 #7] Rendu FAQ par défaut (drapeau true) : La photo FAQ est présente dans dist/ (FR + EN) et absente quand faqPhoto: false', async () => {
    // 1. Vérification dans dist/ (build statique sur disque : photo active par défaut avec maquettes JD)
    const frPath = join(ROOT, 'dist', 'contact', 'index.html');
    const enPath = join(ROOT, 'dist', 'en', 'contact', 'index.html');

    const frDistHtml = readFileSync(frPath, 'utf8');
    const enDistHtml = readFileSync(enPath, 'utf8');

    for (const [lang, html] of [['fr', frDistHtml], ['en', enDistHtml]] as const) {
      expect(html, `La photo FAQ doit être active par défaut dans dist/ en ${lang}`).toMatch(/<div[^>]+class="[^"]*faq-photo-wrap/);
      expect(html, `La classe faq-with-photo doit être présente par défaut dans dist/ en ${lang}`).toMatch(/<div[^>]+class="[^"]*faq-with-photo/);
      expect(html, `L'image faq-jd doit être référencée par défaut dans dist/ en ${lang}`).toContain('faq-jd');
    }

    // 2. Vérification via buildContactHtml(lang, { faqPhoto: false })
    for (const lang of ['fr', 'en'] as const) {
      const generatedHtml = buildContactHtml(lang, { faqPhoto: false });
      expect(generatedHtml).not.toMatch(/<div[^>]+class="[^"]*faq-photo-wrap/);
      expect(generatedHtml).not.toMatch(/<div[^>]+class="[^"]*faq-with-photo/);
      expect(generatedHtml).not.toMatch(/<div[^>]+class="[^"]*faq-photo-top/);
    }
  });

  test('[JD-1117 #7] Rendu FAQ réel (build avec drapeau allumé) : <picture> généré par build.mjs, alt, loading=lazy, ratio 941/1672 à ±1% et hauteur d\'écran respectée (FR + EN)', async ({ page }) => {
    const testPages = [
      { url: '/contact/', lang: 'fr' as const, expectedAlt: 'JD au studio de VMM Productions' },
      { url: '/en/contact/', lang: 'en' as const, expectedAlt: 'JD in the VMM Productions studio' },
    ];

    for (const { url, lang, expectedAlt } of testPages) {
      // Servir le HTML RÉELLEMENT généré par build.mjs avec l'option faqPhoto: true
      const htmlWithPhoto = buildContactHtml(lang, { faqPhoto: true });

      await page.route(url, async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: htmlWithPhoto });
        } else {
          await route.continue();
        }
      });

      await page.goto(url);

      const faqSection = page.locator('section[aria-labelledby="faq-title"]');
      await expect(faqSection).toBeVisible();

      const img = faqSection.locator('.faq-photo-wrap img');
      await expect(img).toBeVisible();

      // Attributs requis
      await expect(img).toHaveAttribute('alt', expectedAlt);
      await expect(img).toHaveAttribute('width', '941');
      await expect(img).toHaveAttribute('height', '1672');
      await expect(img).toHaveAttribute('loading', 'lazy');

      // Vérification du ratio d'aspect rendu (941/1672 = 0.562799... à ±1 %) sur desktop (>= 900px)
      const imgBox = await img.boundingBox();
      expect(imgBox).not.toBeNull();
      const viewport = page.viewportSize();
      if (imgBox && viewport && viewport.width >= 900) {
        const renderedRatio = imgBox.width / imgBox.height;
        const expectedRatio = 941 / 1672;
        const diffRatio = Math.abs(renderedRatio - expectedRatio) / expectedRatio;
        expect(diffRatio, `Le ratio rendu (${renderedRatio}) doit être à ±1 % de 941/1672 (${expectedRatio})`).toBeLessThan(0.01);
      }

      // Vérification de la hauteur de section (desktop tient dans l'écran <= hauteur, mobile >= 100svh selon maquettes JD)
      const sectionBox = await faqSection.boundingBox();
      expect(sectionBox).not.toBeNull();
      if (sectionBox && viewport) {
        if (viewport.width >= 900) {
          if (viewport.width === 1366 && viewport.height === 768) {
            expect(sectionBox.height, `La section FAQ (${sectionBox.height}px) doit tenir dans la hauteur desktop 1366x768 (768px)`).toBeLessThanOrEqual(768);
          } else if (viewport.height >= 720) {
            expect(sectionBox.height, `La section FAQ (${sectionBox.height}px) doit tenir dans la hauteur d'écran (${viewport.height}px)`).toBeLessThanOrEqual(viewport.height + 5);
          }
        } else {
          // Mobile (< 900px) : au moins la hauteur d'écran (min-height 100svh selon maquettes JD)
          expect(sectionBox.height, `La section FAQ (${sectionBox.height}px) doit être au moins de la hauteur d'écran mobile (${viewport.height}px)`).toBeGreaterThanOrEqual(viewport.height);
        }
      }

      await page.unroute(url);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Point 13 — Version anglaise : étanchéité linguistique stricte & parité des clés
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #13] Parité des clés de contenu : Chaque nouvelle clé de fr.json existe dans en.json et inversement', async () => {
    const fr = JSON.parse(readFileSync(join(ROOT, 'content', 'fr.json'), 'utf8'));
    const en = JSON.parse(readFileSync(join(ROOT, 'content', 'en.json'), 'utf8'));

    // Clés de faq.photo*
    const frFaqKeys = Object.keys(fr.faq).sort();
    const enFaqKeys = Object.keys(en.faq).sort();
    expect(frFaqKeys).toEqual(enFaqKeys);

    for (const key of ['photo', 'photoAlt', 'photoLargeur', 'photoHauteur']) {
      expect(fr.faq).toHaveProperty(key);
      expect(en.faq).toHaveProperty(key);
    }

    // Clés de contact.champs
    const frContactKeys = Object.keys(fr.contact.champs).sort();
    const enContactKeys = Object.keys(en.contact.champs).sort();
    expect(frContactKeys).toEqual(enContactKeys);
    expect(fr.contact.champs).toHaveProperty('budget');
    expect(en.contact.champs).toHaveProperty('budget');
  });

  test('[JD-1117 #13] Étanchéité linguistique stricte des nouveaux éléments de la PR A (budget, messages formulaire, alt photo)', async () => {
    const fr = JSON.parse(readFileSync(join(ROOT, 'content', 'fr.json'), 'utf8'));
    const en = JSON.parse(readFileSync(join(ROOT, 'content', 'en.json'), 'utf8'));

    // Éléments nouveaux FR introduits dans la PR A
    const frExclusiveTexts = [
      fr.contact.champs.budget, // « Fourchette de budget »
      fr.contact.champs.succes, // « Merci ! Votre message est bien parti... »
      fr.contact.champs.erreur, // « L'envoi n'a pas fonctionné... »
      fr.contact.champs.envoi,  // « Envoi en cours... »
      fr.faq.photoAlt,          // « JD au studio de VMM Productions »
    ];

    // Éléments nouveaux EN introduits dans la PR A
    const enExclusiveTexts = [
      en.contact.champs.budget, // « Budget range »
      en.contact.champs.succes, // « Thank you! Your message is on its way... »
      en.contact.champs.erreur, // « Sending failed... »
      en.contact.champs.envoi,  // « Sending... »
      en.faq.photoAlt,          // « JD in the VMM Productions studio »
    ];

    // 1. Contrôle des pages de production (dist/)
    const distFrHtml = readFileSync(join(ROOT, 'dist', 'contact', 'index.html'), 'utf8');
    const distEnHtml = readFileSync(join(ROOT, 'dist', 'en', 'contact', 'index.html'), 'utf8');

    for (const text of enExclusiveTexts) {
      expect(distFrHtml, `dist/contact/index.html ne doit contenir aucun texte EN: "${text}"`).not.toContain(text);
    }
    for (const text of frExclusiveTexts) {
      expect(distEnHtml, `dist/en/contact/index.html ne doit contenir aucun texte FR: "${text}"`).not.toContain(text);
    }

    // 2. Contrôle des pages générées avec photo FAQ activée
    const frWithPhotoHtml = buildContactHtml('fr', { faqPhoto: true });
    const enWithPhotoHtml = buildContactHtml('en', { faqPhoto: true });

    for (const text of enExclusiveTexts) {
      expect(frWithPhotoHtml, `buildContactHtml('fr') ne doit contenir aucun texte EN: "${text}"`).not.toContain(text);
    }
    for (const text of frExclusiveTexts) {
      expect(enWithPhotoHtml, `buildContactHtml('en') ne doit contenir aucun texte FR: "${text}"`).not.toContain(text);
    }
  });
});
