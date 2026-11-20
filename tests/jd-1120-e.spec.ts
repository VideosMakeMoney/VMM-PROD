import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

test.describe('PR E — Bugs Mobile iOS de JD (20 nov.)', () => {

  // 1. Meta viewport avec interactive-widget=resizes-content
  test('[PR-E #1] Meta viewport géré : interactive-widget injecté sur Chromium / sans erreur WebKit', async ({ page }, testInfo) => {
    const isWebKit = testInfo.project.use.browserName === 'webkit';
    await page.goto('/');
    const metaContent = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(metaContent).not.toBeNull();
    if (!isWebKit) {
      expect(metaContent, 'Chromium doit avoir interactive-widget=resizes-content').toContain('interactive-widget=resizes-content');
    }
  });

  // 2. Contact : Focus textarea, simulation clavier, snap-off, champ visible, bouton Envoyer atteignable, pas de saut vers FAQ (WebKit + Chromium, 390x844, 390x664, 430x932)
  const mobileViewports = [
    { width: 390, height: 844 },
    { width: 390, height: 664 },
    { width: 430, height: 932 },
  ];

  for (const vp of mobileViewports) {
    for (const lang of ['fr', 'en'] as const) {
      test(`[PR-E #2] Contact ${lang.toUpperCase()} ${vp.width}x${vp.height} : focus textarea + clavier -> snap-off, textarea visible, Envoyer scrollable, pas de saut FAQ`, async ({ page }, testInfo) => {
        // Interception absolue : NE JAMAIS SOUMETTRE LE FORMULAIRE
        await page.route('**', (route) => {
          if (route.request().method() === 'POST') {
            return route.abort();
          }
          return route.continue();
        });

        await page.setViewportSize(vp);
        const url = lang === 'fr' ? '/contact/' : '/en/contact/';
        await page.goto(url);

        // Au repos : pas de snap-off, scroll-snap actif
        const html = page.locator('html');
        await expect(html).not.toHaveClass(/snap-off/);
        const initialSnap = await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType);
        expect(initialSnap).toContain('mandatory');

        // Se positionner sur l'écran du formulaire de contact (écran 2)
        const contactForm = page.locator('.page-contact .contact-form');
        await contactForm.scrollIntoViewIfNeeded();

        // Focus sur le textarea
        const textarea = page.locator('.page-contact .contact-form textarea');
        await textarea.focus();

        // Pendant le focus : html doit avoir la classe snap-off et scrollSnapType = none
        await expect(html).toHaveClass(/snap-off/);
        const focusedSnap = await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType);
        expect(focusedSnap).toBe('none');

        // Simulation du clavier virtuel : réduction de la hauteur de viewport de 380 px
        const keyboardH = 380;
        const visibleH = vp.height - keyboardH;
        await page.setViewportSize({ width: vp.width, height: visibleH });

        // Attendre que visualViewport / resize soit pris en compte
        await page.waitForTimeout(350);

        // Le bas du textarea doit être visible dans la zone visible (>= 12 px au-dessus du bas visible)
        const textareaBox = await textarea.boundingBox();
        expect(textareaBox).not.toBeNull();
        const textareaBottom = textareaBox!.y + textareaBox!.height;
        expect(
          textareaBottom,
          `Le bas du textarea (${textareaBottom}px) doit être <= zone visible - 12px (${visibleH - 12}px)`
        ).toBeLessThanOrEqual(visibleH - 12 + 2); // tolérance de 2px
        expect(textareaBox!.y, 'Le haut du textarea doit être visible sous le header').toBeGreaterThanOrEqual(40);

        // Aucun saut vers la FAQ : la FAQ ne saute pas en haut de l'écran (y=64) à la place du formulaire
        if (lang === 'fr' && vp.width === 390 && vp.height === 844 && testInfo.project.name === 'mobile-iphone-390x844') {
          await page.screenshot({ path: 'C:/Users/WARRIORS666/.gemini/antigravity/brain/f9becf5f-890c-494d-9e57-ee00fd6f3dfd/contact-keyboard-390x844.png' });
        }
        const faqSection = page.locator('section[aria-labelledby="faq-title"]');
        const faqBox = await faqSection.boundingBox();
        if (faqBox) {
          expect(
            faqBox.y,
            `La section FAQ (${faqBox.y}px) ne doit pas avoir sauté en haut de l'écran`
          ).toBeGreaterThan(textareaBottom);
          expect(faqBox.y).toBeGreaterThan(150);
        }

        // Le bouton Envoyer doit être atteignable en défilant
        const submitBtn = page.locator('.page-contact .contact-form button[type="submit"]');
        await submitBtn.scrollIntoViewIfNeeded();
        const btnBox = await submitBtn.boundingBox();
        expect(btnBox).not.toBeNull();
        expect(btnBox!.y + btnBox!.height).toBeLessThanOrEqual(visibleH + 10);
        expect(btnBox!.y).toBeGreaterThanOrEqual(40);

        // Après blur, le snap est rétabli
        await textarea.blur();
        await page.waitForTimeout(250);
        await expect(html).not.toHaveClass(/snap-off/);
        const blurredSnap = await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType);
        expect(blurredSnap).toContain('mandatory');
      });
    }
  }

  // 3. Navigation via le menu depuis le milieu de chaque page (scrollY sur l'écran 2)
  const pagesToTest = [
    { url: '/', name: 'accueil-fr' },
    { url: '/en/', name: 'accueil-en' },
    { url: '/services/', name: 'services-fr' },
    { url: '/en/services/', name: 'services-en' },
    { url: '/portfolio/', name: 'portfolio-fr' },
    { url: '/en/portfolio/', name: 'portfolio-en' },
    { url: '/about/', name: 'apropos-en' },
    { url: '/contact/', name: 'contact-fr' },
  ];

  for (const p of pagesToTest) {
    test(`[PR-E #3] Navigation menu depuis écran 2 de ${p.name} : retour à scrollY=0 et 1re section sous le header`, async ({ page }, testInfo) => {
      test.skip(!page.viewportSize() || page.viewportSize()!.width >= 900, 'Test mobile seulement');

      await page.goto(p.url);

      // Défiler sur l'écran 2
      await page.evaluate(() => {
        const sections = document.querySelectorAll('main > section');
        if (sections.length > 1) {
          sections[1].scrollIntoView({ behavior: 'instant' });
        } else {
          window.scrollTo({ top: 700, behavior: 'instant' });
        }
      });
      await page.waitForTimeout(100);

      const scrollYBefore = await page.evaluate(() => window.scrollY);
      expect(scrollYBefore, 'scrollY doit être sur un écran inférieur').toBeGreaterThan(200);

      // Ouvrir le menu
      const toggle = page.locator('.menu-toggle');
      await toggle.click();
      const menu = page.locator('#menu');
      await expect(menu).toHaveClass(/open/);

      // Cliquer sur le 1er lien du menu (ex: Accueil / Home)
      const firstLink = menu.locator('a').first();
      await firstLink.click();

      // Attendre la fin du scroll / navigation
      await page.waitForTimeout(300);

      const scrollYAfter = await page.evaluate(() => window.scrollY);
      expect(scrollYAfter, 'La page doit être revenue à scrollY=0').toBe(0);

      // La première section commence juste sous le header (64px)
      const firstSection = page.locator('main > section').first();
      const firstSectionBox = await firstSection.boundingBox();
      expect(firstSectionBox).not.toBeNull();
      expect(Math.abs(firstSectionBox!.y - 64)).toBeLessThanOrEqual(4);

      if (p.name === 'accueil-fr' && testInfo.project.name === 'mobile-iphone-390x844') {
        await page.screenshot({ path: 'C:/Users/WARRIORS666/.gemini/antigravity/brain/f9becf5f-890c-494d-9e57-ee00fd6f3dfd/menu-nav-390x844.png' });
      }
    });
  }

  // 4. Espionner scrollTo dans main.js : appelé avec behavior instant et snap désactivé
  test('[PR-E #4] main.js appelle scrollTo({top:0, behavior:"instant"}) pendant que le snap est désactivé', async ({ page }) => {
    test.skip(!page.viewportSize() || page.viewportSize()!.width >= 900, 'Test mobile seulement');

    await page.goto('/services/');
    await page.waitForLoadState('domcontentloaded');

    // Scroller vers l'écran 2
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(150);

    // Injecter l'espion window.scrollTo
    await page.evaluate(() => {
      (window as any).__scrollToCalls = [];
      const originalScrollTo = window.scrollTo;
      window.scrollTo = function (...args: any[]) {
        const snap = getComputedStyle(document.documentElement).scrollSnapType;
        const snapOff = document.documentElement.classList.contains('snap-off');
        (window as any).__scrollToCalls.push({
          args,
          snap,
          snapOff,
        });
        return originalScrollTo.apply(this, args as any);
      };
    });

    // Ouvrir le menu et cliquer sur le lien de la page courante (Services)
    const toggle = page.locator('.menu-toggle');
    await toggle.click();
    await page.waitForTimeout(200);

    const link = page.locator('#menu a[href="/services/"]').first();
    await link.click();
    await page.waitForTimeout(100);

    const calls = await page.evaluate(() => (window as any).__scrollToCalls || []);
    expect(calls.length, 'window.scrollTo doit avoir été appelé lors de la navigation').toBeGreaterThan(0);

    // Vérifier qu'au moins un appel est fait vers top:0 avec behavior: 'instant' et snap désactivé
    const instantResetCall = calls.find((c: any) => {
      const firstArg = c.args[0];
      const isInstant = typeof firstArg === 'object' && firstArg !== null && firstArg.top === 0 && firstArg.behavior === 'instant';
      const snapDisabled = c.snap === 'none' || c.snapOff === true;
      return isInstant && snapDisabled;
    });

    expect(
      instantResetCall,
      `Un appel scrollTo({top:0, behavior:'instant'}) avec snap coupé doit exister. Appels reçus: ${JSON.stringify(calls)}`
    ).toBeDefined();
  });

  // 5. Services écran 2, clic sur « EXPLORER NOS SERVICES → » : #svc-liste juste sous le header, snap 'none' pendant le scroll, rétabli après
  for (const lang of ['fr', 'en'] as const) {
    test(`[PR-E #5] Services ${lang.toUpperCase()} écran 2 : clic CTA amène #svc-liste sous le header (±4px), snap coupé pendant scroll`, async ({ page }, testInfo) => {
      test.skip(!page.viewportSize() || page.viewportSize()!.width >= 900, 'Test mobile seulement');

      // Espionner scrollTo et scrollIntoView
      await page.addInitScript(() => {
        (window as any).__anchorScrollSnap = null;
        const origScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = function (...args: any[]) {
          if (this.id === 'svc-liste') {
            (window as any).__anchorScrollSnap = getComputedStyle(document.documentElement).scrollSnapType;
            (window as any).__anchorSnapOff = document.documentElement.classList.contains('snap-off');
          }
          return origScrollIntoView.apply(this, args as any);
        };
      });

      const url = lang === 'fr' ? '/services/' : '/en/services/';
      await page.goto(url);

      // Aller sur l'écran 2 (section jd-vision)
      const visionSection = page.locator('section.jd-vision');
      await visionSection.scrollIntoViewIfNeeded();

      // Clic sur le CTA
      const ctaBtn = visionSection.locator('a[href="#svc-liste"]');
      await expect(ctaBtn).toBeVisible();
      await ctaBtn.click();

      await page.waitForTimeout(300);

      // Vérifier le cadrage : le haut de #svc-liste est à ±4 px du bas du header (header-h = 64px)
      const svcListe = page.locator('#svc-liste');
      const box = await svcListe.boundingBox();
      expect(box).not.toBeNull();
      const diffFromHeader = Math.abs(box!.y - 64);
      expect(
        diffFromHeader,
        `Le haut de #svc-liste (${box!.y}px) doit être à ±4 px du bas du header (64px)`
      ).toBeLessThanOrEqual(4);

      if (lang === 'fr' && testInfo.project.name === 'mobile-iphone-390x844') {
        await page.screenshot({ path: 'C:/Users/WARRIORS666/.gemini/antigravity/brain/f9becf5f-890c-494d-9e57-ee00fd6f3dfd/services-cta-390x844.png' });
      }

      // Vérifier que scroll-snap était coupé au moment du scroll
      const snapDuringScroll = await page.evaluate(() => (window as any).__anchorScrollSnap);
      const snapOffDuringScroll = await page.evaluate(() => (window as any).__anchorSnapOff);
      expect(
        snapDuringScroll === 'none' || snapOffDuringScroll === true,
        `scroll-snap-type devait être 'none' ou classe snap-off active pendant le scroll (reçu: snap=${snapDuringScroll}, snapOff=${snapOffDuringScroll})`
      ).toBe(true);

      // Vérifier que le snap est rétabli après
      const snapAfter = await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType);
      expect(snapAfter).toContain('mandatory');
    });
  }

  // 6. Accessibilité : focus visible et focus déplacé sur la cible de l'ancre
  test('[PR-E #6] Navigation ancre : focus déplacé sur la cible (#svc-liste)', async ({ page }) => {
    test.skip(!page.viewportSize() || page.viewportSize()!.width >= 900, 'Test mobile seulement');

    await page.goto('/services/');
    const visionSection = page.locator('section.jd-vision');
    await visionSection.scrollIntoViewIfNeeded();

    const ctaBtn = visionSection.locator('a[href="#svc-liste"]');
    await ctaBtn.click();
    await page.waitForTimeout(200);

    const activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId, 'Le focus doit avoir été déplacé sur la cible de l\'ancre').toBe('svc-liste');
  });

  // 7. Touch targets mobile : tous les .btn et liens de menu >= 44 px
  test('[PR-E #7] Touch targets : tous les .btn et liens de menu en mobile >= 44 px', async ({ page }) => {
    test.skip(!page.viewportSize() || page.viewportSize()!.width >= 900, 'Test mobile seulement');

    for (const url of ['/', '/services/', '/contact/']) {
      await page.goto(url);

      // Ouvrir le menu pour vérifier ses liens
      const toggle = page.locator('.menu-toggle');
      const toggleBox = await toggle.boundingBox();
      if (toggleBox) {
        expect(toggleBox.height).toBeGreaterThanOrEqual(44);
        expect(toggleBox.width).toBeGreaterThanOrEqual(44);
      }

      const menuLinks = page.locator('#menu a');
      const linkCount = await menuLinks.count();
      for (let i = 0; i < linkCount; i++) {
        const link = menuLinks.nth(i);
        const box = await link.boundingBox();
        if (box && await link.isVisible()) {
          expect(box.height, `Le lien ${i} du menu sur ${url} doit avoir une hauteur >= 44 px`).toBeGreaterThanOrEqual(44);
        }
      }

      // Vérifier tous les boutons visibles
      const buttons = page.locator('.btn:visible');
      const btnCount = await buttons.count();
      for (let i = 0; i < btnCount; i++) {
        const btn = buttons.nth(i);
        const box = await btn.boundingBox();
        if (box) {
          expect(box.height, `Le bouton ${i} sur ${url} doit avoir une hauteur >= 44 px`).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });

});
