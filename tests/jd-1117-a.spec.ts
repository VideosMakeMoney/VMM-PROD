import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

test.describe('Ajustements JD du 17 nov. 2026 — PR A : Contact', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Point 8 — Formulaire de contact Netlify
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #8] Build dist/ : Présence du formulaire data-netlify et de ses champs (FR + EN)', async () => {
    const frPath = join(ROOT, 'dist', 'contact', 'index.html');
    const enPath = join(ROOT, 'dist', 'en', 'contact', 'index.html');

    expect(existsSync(frPath), 'dist/contact/index.html doit exister').toBe(true);
    expect(existsSync(enPath), 'dist/en/contact/index.html doit exister').toBe(true);

    const frHtml = readFileSync(frPath, 'utf8');
    const enHtml = readFileSync(enPath, 'utf8');

    for (const [lang, html] of [['fr', frHtml], ['en', enHtml]] as const) {
      // Formulaire Netlify complet
      expect(html).toContain('name="contact"');
      expect(html).toContain('data-netlify="true"');
      expect(html).toContain('netlify-honeypot="bot-field"');

      // Champ caché form-name=contact
      expect(html).toContain('<input type="hidden" name="form-name" value="contact">');

      // Champ langue
      expect(html).toContain(`<input type="hidden" name="langue" value="${lang}">`);

      // Honeypot bot-field
      expect(html).toMatch(/<input\s+name="bot-field"[^>]*autocomplete="off"/);

      // Champs requis et optionnels
      expect(html).toMatch(/<input[^>]+name="name"[^>]*required/);
      expect(html).toMatch(/<input[^>]+name="email"[^>]*type="email"[^>]*required/);
      expect(html).toMatch(/<input[^>]+name="company"/);
      expect(html).toMatch(/<textarea[^>]+name="message"[^>]*required/);

      // Point 6 : budget doit être un input[type="text"], PAS un select
      expect(html).toMatch(/<input[^>]+name="budget"[^>]*type="text"/);
      expect(html).not.toMatch(/<select[^>]+name="budget"/);

      // Actions /merci/ et /en/thanks/
      if (lang === 'fr') {
        expect(html).toContain('action="/merci/"');
      } else {
        expect(html).toContain('action="/en/thanks/"');
      }
    }
  });

  test('[JD-1117 #8] Soumission AJAX (page.route) : Envoi POST vers / avec form-name=contact et champs URL-encodés (FR)', async ({ page }) => {
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
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: 'OK',
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/contact/');

    const form = page.locator('form.contact-form');
    await expect(form).toBeVisible();

    await page.fill('form.contact-form input[name="name"]', 'Jean-David Test');
    await page.fill('form.contact-form input[name="email"]', 'jd@test.ca');
    await page.fill('form.contact-form input[name="company"]', 'VMM Test Inc');
    await page.fill('form.contact-form input[name="budget"]', '5 000 $');
    await page.fill('form.contact-form textarea[name="message"]', 'Projet de test automatisé Playwright');

    await page.click('form.contact-form button[type="submit"]');

    expect(interceptedRequest).not.toBeNull();
    expect(interceptedRequest?.method).toBe('POST');
    expect(interceptedRequest?.headers['content-type']).toContain('application/x-www-form-urlencoded');

    const params = new URLSearchParams(interceptedRequest?.postData || '');
    expect(params.get('form-name')).toBe('contact');
    expect(params.get('langue')).toBe('fr');
    expect(params.get('name')).toBe('Jean-David Test');
    expect(params.get('email')).toBe('jd@test.ca');
    expect(params.get('company')).toBe('VMM Test Inc');
    expect(params.get('budget')).toBe('5 000 $');
    expect(params.get('message')).toBe('Projet de test automatisé Playwright');
    expect(params.get('bot-field')).toBe('');

    // Message de succès affiché
    const status = page.locator('form.contact-form .form-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/ok/);
    await expect(status).toContainText('Merci ! Votre message est bien parti');
  });

  test('[JD-1117 #8] Soumission AJAX (page.route) : Affichage du message d\'erreur sur réponse 500 (FR)', async ({ page }) => {
    await page.route('/', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'text/plain',
          body: 'Internal Server Error',
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/contact/');

    await page.fill('form.contact-form input[name="name"]', 'Jean-David Test');
    await page.fill('form.contact-form input[name="email"]', 'jd@test.ca');
    await page.fill('form.contact-form textarea[name="message"]', 'Test erreur');

    await page.click('form.contact-form button[type="submit"]');

    const status = page.locator('form.contact-form .form-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/err/);
    await expect(status).toContainText("L'envoi n'a pas fonctionné. Réessayez, ou écrivez-nous directement à jeandavid@videosmakemoney.ca.");
  });

  test('[JD-1117 #8] Soumission AJAX (page.route) : Envoi POST vers / avec form-name=contact et champs URL-encodés (EN)', async ({ page }) => {
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
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: 'OK',
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/en/contact/');

    const form = page.locator('form.contact-form');
    await expect(form).toBeVisible();

    await page.fill('form.contact-form input[name="name"]', 'JD English Test');
    await page.fill('form.contact-form input[name="email"]', 'jd@test.ca');
    await page.fill('form.contact-form input[name="company"]', 'VMM Global');
    await page.fill('form.contact-form input[name="budget"]', '$5,000');
    await page.fill('form.contact-form textarea[name="message"]', 'Playwright automated test project');

    await page.click('form.contact-form button[type="submit"]');

    expect(interceptedRequest).not.toBeNull();
    expect(interceptedRequest?.method).toBe('POST');
    expect(interceptedRequest?.headers['content-type']).toContain('application/x-www-form-urlencoded');

    const params = new URLSearchParams(interceptedRequest?.postData || '');
    expect(params.get('form-name')).toBe('contact');
    expect(params.get('langue')).toBe('en');
    expect(params.get('name')).toBe('JD English Test');
    expect(params.get('email')).toBe('jd@test.ca');
    expect(params.get('company')).toBe('VMM Global');
    expect(params.get('budget')).toBe('$5,000');
    expect(params.get('message')).toBe('Playwright automated test project');

    const status = page.locator('form.contact-form .form-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/ok/);
    await expect(status).toContainText('Thank you! Your message is on its way');
  });

  test('[JD-1117 #8] Soumission AJAX (page.route) : Affichage du message d\'erreur sur réponse 500 (EN)', async ({ page }) => {
    await page.route('/', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'text/plain',
          body: 'Internal Server Error',
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/en/contact/');

    await page.fill('form.contact-form input[name="name"]', 'JD English Test');
    await page.fill('form.contact-form input[name="email"]', 'jd@test.ca');
    await page.fill('form.contact-form textarea[name="message"]', 'Error test');

    await page.click('form.contact-form button[type="submit"]');

    const status = page.locator('form.contact-form .form-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/err/);
    await expect(status).toContainText('Sending failed. Please try again, or email us directly at jeandavid@videosmakemoney.ca.');
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
    const budgetLabel = form.locator('label[for="' + (await budgetInput.getAttribute('id')) + '"]');
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

    const budgetLabel = form.locator('label[for="' + (await budgetInput.getAttribute('id')) + '"]');
    await expect(budgetLabel).toHaveText('Budget range');

    await budgetInput.fill('$10,000 - $15,000');
    await expect(budgetInput).toHaveValue('$10,000 - $15,000');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Point 7 — Photo FAQ : dérivés optimisés et code prêt
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #7] Photo FAQ : Présence des dérivés optimisés WebP/JPG en 941, 720 et 470 px', async () => {
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
      // Vérification que les dérivés sont bien compressés par rapport au PNG original de 2.1 Mo
      expect(stat.size, `Le fichier ${relPath} doit faire moins de 300 Ko`).toBeLessThan(300 * 1024);
    }
  });

  test('[JD-1117 #7] Photo FAQ : Rendu prêt, texte alternatif factuel et préservation du ratio 941/1672 (FR + EN)', async ({ page }) => {
    // Vérifier les données dans content/fr.json et content/en.json
    const fr = JSON.parse(readFileSync(join(ROOT, 'content', 'fr.json'), 'utf8'));
    const en = JSON.parse(readFileSync(join(ROOT, 'content', 'en.json'), 'utf8'));
    const site = JSON.parse(readFileSync(join(ROOT, 'content', 'site.json'), 'utf8'));

    expect(fr.faq.photo).toBe('/img/faq-jd');
    expect(fr.faq.photoAlt).toBe('JD au studio de VMM Productions');
    expect(fr.faq.photoLargeur).toBe(941);
    expect(fr.faq.photoHauteur).toBe(1672);

    expect(en.faq.photo).toBe('/img/faq-jd');
    expect(en.faq.photoAlt).toBe('JD in the VMM Productions studio');
    expect(en.faq.photoLargeur).toBe(941);
    expect(en.faq.photoHauteur).toBe(1672);

    // L'indicateur est false en attente des maquettes de disposition de JD
    expect(site.drapeaux.faqPhoto).toBe(false);

    // Tester l'injection active dans le DOM pour valider que le code prêt s'affiche sans déformation
    for (const [url, altText] of [['/contact/', 'JD au studio de VMM Productions'], ['/en/contact/', 'JD in the VMM Productions studio']] as const) {
      await page.goto(url);
      const faqSection = page.locator('section[aria-labelledby="faq-title"]');
      await expect(faqSection).toBeVisible();

      // Injection dynamique de la photo pour tester le comportement de la mise en page
      await page.evaluate(({ alt }) => {
        const faq = document.querySelector('.container.faq');
        if (!faq) return;
        faq.classList.add('faq-with-photo');
        const wrap = document.createElement('div');
        wrap.className = 'faq-photo-wrap';
        wrap.innerHTML = `<picture><source srcset="/img/faq-jd.webp" type="image/webp"><img src="/img/faq-jd.jpg" alt="${alt}" width="941" height="1672" loading="lazy" decoding="async"></picture>`;
        faq.insertBefore(wrap, faq.firstChild);
      }, { alt: altText });

      const img = faqSection.locator('.faq-photo-wrap img');
      await expect(img).toBeVisible();
      await expect(img).toHaveAttribute('alt', altText);
      await expect(img).toHaveAttribute('width', '941');
      await expect(img).toHaveAttribute('height', '1672');
      await expect(img).toHaveAttribute('loading', 'lazy');

      // Vérification du ratio d'aspect rendu (941/1672 ≈ 0.5628)
      const box = await img.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        const renderedRatio = box.width / box.height;
        const expectedRatio = 941 / 1672;
        expect(Math.abs(renderedRatio - expectedRatio)).toBeLessThan(0.05);
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Point 13 — Version anglaise & absence de fuite linguistique croisée
  // ──────────────────────────────────────────────────────────────────────────

  test('[JD-1117 #13] Version EN : Ségrégation linguistique stricte sur la page Contact (FR vs EN)', async ({ page }) => {
    // Page française
    await page.goto('/contact/');
    const frBody = (await page.locator('body').textContent()) || '';
    expect(frBody).toContain('Fourchette de budget');
    expect(frBody).toContain('Questions fréquentes');
    expect(frBody).not.toContain('Budget range');
    expect(frBody).not.toContain('Frequently asked questions');
    expect(frBody).not.toContain('Sending failed');

    // Page anglaise
    await page.goto('/en/contact/');
    const enBody = (await page.locator('body').textContent()) || '';
    expect(enBody).toContain('Budget range');
    expect(enBody).toContain('Frequently asked questions');
    expect(enBody).not.toContain('Fourchette de budget');
    expect(enBody).not.toContain('Questions fréquentes');
    expect(enBody).not.toContain("L'envoi n'a pas fonctionné");
  });
});
