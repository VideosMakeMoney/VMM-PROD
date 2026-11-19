import { test, expect } from '@playwright/test';
import { PAGES, preparePageForLayout, PageDefinition, SectionDefinition } from './helpers';

/**
 * BLOC 2 : RÈGLES DE LAYOUT DE JD (tests stricts par section)
 * 
 * Règles d'or de JD :
 * 1. La section tient dans un écran : hauteur <= 100svh moins le header + 1 px.
 * 2. Le bouton de la section est entièrement visible dans l'écran.
 * 3. Aucun débordement horizontal : scrollWidth <= clientWidth + 1.
 * 4. Aucun élément coupé ou superposé.
 * 5. Texte >= 12 px sur toutes résolutions, cibles tactiles >= 44 px sur mobile.
 * 6. scroll-snap présent (une section par défilement).
 * 7. Images non déformées (ratio affiché vs ratio naturel +-5%).
 * 
 * Dérogations documentées dans tests/known-issues.md appliquées individuellement par (page, section, résolution).
 */

// Liste exacte des dépassements de hauteur connus sur main (cf. tests/known-issues.md)
const KNOWN_HEIGHT_ISSUES = new Set([
  // Desktop 1280x720
  'portfolio-fr|1|desktop-1280x720',
  'apropos-fr|1|desktop-1280x720',
  'apropos-fr|2|desktop-1280x720',
  'contact-fr|0|desktop-1280x720',
  // Desktop 1366x768
  'apropos-fr|1|desktop-1366x768',
  'apropos-fr|2|desktop-1366x768',
  // Mobile
  'contact-fr|0|mobile-iphone-390x844',
  'contact-en|0|mobile-iphone-390x844',
  'contact-fr|0|mobile-iphone-390x664',
  'contact-en|0|mobile-iphone-390x664',
  'contact-fr|0|mobile-android-360x740',
  'contact-en|0|mobile-android-360x740',
  'contact-fr|0|mobile-iphone-430x932',
  'contact-en|0|mobile-iphone-430x932',
]);

// Liste exacte des 8 boutons masqués hors du premier écran connus sur main (cf. tests/known-issues.md section 4)
const KNOWN_HIDDEN_BUTTONS = new Set([
  'contact-fr|0|mobile-iphone-390x844',
  'contact-en|0|mobile-iphone-390x844',
  'contact-fr|0|mobile-iphone-390x664',
  'contact-en|0|mobile-iphone-390x664',
  'contact-fr|0|mobile-android-360x740',
  'contact-en|0|mobile-android-360x740',
  'contact-fr|0|mobile-iphone-430x932',
  'contact-en|0|mobile-iphone-430x932',
]);

// Allowlists d'éléments connus précis pour la typographie (< 12px) et les cibles tactiles mobiles (< 44px)
const ALLOWED_SMALL_TEXT_SELECTORS = [
  '.bg-toggle', // Bouton de pause/lecture vidéo d'arrière-plan (font-size: 0.7rem = 11.2px) sur /services/ et /about/
];

const ALLOWED_SMALL_TOUCH_SELECTORS = [
  'footer a[href^="mailto:"]', // Lien courriel du pied de page (h: ~20px)
  'footer a[href^="tel:"]', // Lien téléphonique du pied de page (h: ~20px)
  'footer a[aria-label="X"]', // Icône sociale X du pied de page (w: ~40-48px, h: ~44px)
  'footer a[href*="x.com"]', // Icône sociale X du pied de page (sélecteur fallback)
  'footer .footer-zones a', // Liens des pastilles de zones desservies du pied de page (h: ~32px)
  '.section-contact a[href^="mailto:"]', // Lien courriel dans le bloc coordonnées de la page contact (h: ~19px)
  '.section-contact a[href^="tel:"]', // Lien téléphonique dans le bloc coordonnées de la page contact (h: ~16px)
];

for (const p of PAGES) {
  test.describe(`Layout JD - ${p.name} (${p.url})`, () => {

    // 1 & 2. Règles JD par section : hauteur <= 100svh et bouton visible
    for (const sec of p.sections) {
      test(`Section ${sec.index} (${sec.label}) tient dans un écran et bouton visible`, async ({ page }, testInfo) => {
        await page.goto(p.url);
        await preparePageForLayout(page);

        const secData = await page.evaluate(({ selector, index }) => {
          const header = document.querySelector('header');
          const headerH = header ? header.offsetHeight : 72;
          const maxH = window.innerHeight - headerH + 1;
          const allSections = Array.from(document.querySelectorAll('section'));
          const el = allSections[index] || document.querySelector(selector);
          if (!el) return null;
          const rect = el.getBoundingClientRect();

          document.documentElement.style.scrollBehavior = 'auto';
          const secTop = rect.top + window.scrollY;
          window.scrollTo(0, Math.max(0, secTop - headerH));

          const btns = Array.from(el.querySelectorAll('.btn, button, a.btn')).filter((b) => b.checkVisibility());
          const hidden = [];
          for (const btn of btns) {
            const r = btn.getBoundingClientRect();
            const fullyVisible = r.bottom <= window.innerHeight + 1 && r.top >= headerH - 1;
            if (!fullyVisible) {
              hidden.push({
                btnText: btn.textContent?.trim().slice(0, 30) || 'btn',
                top: Math.round(r.top),
                bottom: Math.round(r.bottom),
                windowH: window.innerHeight,
              });
            }
          }

          return {
            height: Math.round(rect.height),
            maxH,
            diff: Math.round(rect.height - maxH),
            overflows: rect.height > maxH,
            hiddenBtns: hidden,
          };
        }, { selector: sec.selector, index: sec.index });

        if (!secData) return;

        const issueKey = `${p.name}|${sec.index}|${testInfo.project.name}`;
        const isHeightKnown = KNOWN_HEIGHT_ISSUES.has(issueKey);
        const isBtnKnown = KNOWN_HIDDEN_BUTTONS.has(issueKey);

        test.fixme(
          isHeightKnown || isBtnKnown,
          `Dépassement ou bouton hors écran connu sur main (${p.name} sec ${sec.index} sur ${testInfo.project.name}, cf. tests/known-issues.md)`
        );

        expect(
          secData.height,
          `Section ${sec.index} (${sec.label}) dépasse la hauteur d'écran de ${secData.diff}px (${secData.height}px > ${secData.maxH}px)`
        ).toBeLessThanOrEqual(secData.maxH);

        expect(
          secData.hiddenBtns,
          `Bouton(s) non entièrement visibles dans la section ${sec.index}`
        ).toEqual([]);
      });
    }

    // 3. Débordement horizontal du document
    test('3. Aucun débordement horizontal', async ({ page }, testInfo) => {
      await page.goto(p.url);
      await preparePageForLayout(page);

      const overflowInfo = await page.evaluate(() => {
        const scrollW = document.documentElement.scrollWidth;
        const clientW = document.documentElement.clientWidth;
        const overflowsDoc = scrollW > clientW + 1;
        return { overflowsDoc, scrollW, clientW };
      });

      expect(
        overflowInfo.overflowsDoc,
        `Débordement horizontal du document : scrollWidth (${overflowInfo.scrollW}) > clientWidth (${overflowInfo.clientW})`
      ).toBe(false);
    });

    // 4. Aucun élément coupé ou superposé
    test('4. Aucun élément coupé ou superposé', async ({ page }, testInfo) => {
      await page.goto(p.url);
      await preparePageForLayout(page);

      const issues = await page.evaluate(() => {
        const keyItems = Array.from(
          document.querySelectorAll('h1, h2, h3, p, .btn, button, a.btn, .svc-card, .person')
        ).filter((el) => {
          if (!el.checkVisibility()) return false;
          if (el.closest('.hp') || el.closest('[aria-hidden="true"]') || el.classList.contains('visually-hidden')) return false;
          const style = window.getComputedStyle(el);
          return style.position !== 'absolute' && style.position !== 'fixed';
        });

        const overlaps = [];
        for (let i = 0; i < keyItems.length; i++) {
          for (let j = i + 1; j < keyItems.length; j++) {
            const a = keyItems[i];
            const b = keyItems[j];
            if (a.contains(b) || b.contains(a)) continue;

            const rA = a.getBoundingClientRect();
            const rB = b.getBoundingClientRect();
            if (rA.width === 0 || rA.height === 0 || rB.width === 0 || rB.height === 0) continue;

            const xOverlap = Math.max(0, Math.min(rA.right, rB.right) - Math.max(rA.left, rB.left));
            const yOverlap = Math.max(0, Math.min(rA.bottom, rB.bottom) - Math.max(rA.top, rB.top));
            const overlapArea = xOverlap * yOverlap;
            const minArea = Math.min(rA.width * rA.height, rB.width * rB.height);

            if (overlapArea > 0 && overlapArea / minArea > 0.2) {
              overlaps.push({
                type: 'overlap',
                elemA: `${a.tagName} ("${a.textContent?.trim().slice(0, 25)}")`,
                elemB: `${b.tagName} ("${b.textContent?.trim().slice(0, 25)}")`,
              });
            }
          }
        }

        const clipped = [];
        for (const el of keyItems) {
          let parent = el.parentElement;
          const elRect = el.getBoundingClientRect();
          while (parent && parent !== document.documentElement) {
            const pStyle = window.getComputedStyle(parent);
            if (['hidden', 'clip'].includes(pStyle.overflow) || ['hidden', 'clip'].includes(pStyle.overflowY) || ['hidden', 'clip'].includes(pStyle.overflowX)) {
              const pRect = parent.getBoundingClientRect();
              if (elRect.bottom > pRect.bottom + 2 || elRect.top < pRect.top - 2 || elRect.right > pRect.right + 2 || elRect.left < pRect.left - 2) {
                clipped.push({
                  tag: el.tagName,
                  text: el.textContent?.trim().slice(0, 25),
                  parent: `${parent.tagName}.${parent.className}`,
                });
                break;
              }
            }
            parent = parent.parentElement;
          }
        }

        return { overlaps, clipped };
      });

      const isKnownHomeClipped = (p.name === 'accueil-fr' || p.name === 'accueil-en') && testInfo.project.name === 'mobile-iphone-390x664';

      test.fixme(
        isKnownHomeClipped,
        `Élément coupé connu sur main (${p.name} sur ${testInfo.project.name}, cf. tests/known-issues.md)`
      );

      expect(issues.overlaps).toEqual([]);
      expect(issues.clipped).toEqual([]);
    });

    // 5. Texte >= 12 px, cibles tactiles >= 44 px sur mobile
    test('5. Texte >= 12 px, cibles tactiles >= 44 px sur mobile', async ({ page, isMobile }, testInfo) => {
      await page.goto(p.url);
      await preparePageForLayout(page);

      const { unexpectedSmallText, unexpectedSmallTouch } = await page.evaluate(
        ({ isMobile, allowedTextSelectors, allowedTouchSelectors }) => {
          const isAllowedText = (el: Element) =>
            allowedTextSelectors.some((sel: string) => el.matches(sel) || Boolean(el.closest(sel)));
          const isAllowedTouch = (el: Element) =>
            allowedTouchSelectors.some((sel: string) => el.matches(sel) || Boolean(el.closest(sel)));

          const smallTextItems: { tag: string; text: string; fontSize: number }[] = [];
          const all = document.querySelectorAll('body *');
          for (const el of all) {
            if (el.children.length === 0 && el.textContent && el.textContent.trim().length > 0) {
              if (el.closest('.hp') || el.closest('[aria-hidden="true"]') || el.classList.contains('visually-hidden')) continue;
              if (isAllowedText(el)) continue;
              if (el.checkVisibility()) {
                const style = window.getComputedStyle(el);
                const fs = parseFloat(style.fontSize);
                if (fs < 12) {
                  smallTextItems.push({
                    tag: el.tagName,
                    text: el.textContent.trim().slice(0, 30),
                    fontSize: fs,
                  });
                }
              }
            }
          }

          const smallTouchItems: { tag: string; cls: string; text: string; width: number; height: number }[] = [];
          if (isMobile) {
            const interactive = document.querySelectorAll('a, button, input, summary, [role="button"]');
            for (const el of interactive) {
              if (el.closest('.hp') || el.closest('[aria-hidden="true"]') || el.classList.contains('visually-hidden')) continue;
              if (isAllowedTouch(el)) continue;
              if (el.checkVisibility()) {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) {
                  if (r.width < 44 || r.height < 44) {
                    smallTouchItems.push({
                      tag: el.tagName,
                      cls: el.className,
                      text: el.textContent?.trim().slice(0, 25) || '',
                      width: Math.round(r.width),
                      height: Math.round(r.height),
                    });
                  }
                }
              }
            }
          }

          return { unexpectedSmallText: smallTextItems, unexpectedSmallTouch: smallTouchItems };
        },
        {
          isMobile,
          allowedTextSelectors: ALLOWED_SMALL_TEXT_SELECTORS,
          allowedTouchSelectors: ALLOWED_SMALL_TOUCH_SELECTORS,
        }
      );

      expect(
        unexpectedSmallText,
        `Élément(s) textuel(s) avec police < 12px non autorisés sur ${p.name}`
      ).toEqual([]);

      expect(
        unexpectedSmallTouch,
        `Cible(s) tactile(s) mobile(s) < 44px non autorisées sur ${p.name} (${testInfo.project.name})`
      ).toEqual([]);
    });

    // 6. scroll-snap présent (une section par défilement)
    test('6. scroll-snap présent (une section par défilement)', async ({ page }) => {
      await page.goto(p.url);
      await preparePageForLayout(page);

      const snapInfo = await page.evaluate(() => {
        const htmlSnap = window.getComputedStyle(document.documentElement).scrollSnapType;
        const bodySnap = window.getComputedStyle(document.body).scrollSnapType;
        const mainEl = document.querySelector('main');
        const mainSnap = mainEl ? window.getComputedStyle(mainEl).scrollSnapType : 'none';
        const sections = Array.from(document.querySelectorAll('section'));
        const secAligns = sections.map((s) => window.getComputedStyle(s).scrollSnapAlign);

        const hasContainerSnap =
          (htmlSnap && htmlSnap !== 'none') ||
          (bodySnap && bodySnap !== 'none') ||
          (mainSnap && mainSnap !== 'none');
        const hasSectionAlign = secAligns.some((a) => a && a !== 'none');

        return {
          hasScrollSnap: Boolean(hasContainerSnap && hasSectionAlign),
          htmlSnap,
        };
      });

      expect(snapInfo.hasScrollSnap).toBe(true);
    });

    // 7. Images non déformées (ratio affiché vs ratio naturel +-5%)
    test('7. Images non déformées (ratio affiché vs ratio naturel +-5%)', async ({ page }) => {
      await page.goto(p.url);
      await preparePageForLayout(page);

      const distortedImages = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        const distorted = [];
        for (const img of imgs) {
          if (!img.checkVisibility()) continue;
          const r = img.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && img.naturalWidth > 0 && img.naturalHeight > 0) {
            const style = window.getComputedStyle(img);
            if (style.objectFit !== 'cover' && style.objectFit !== 'contain') {
              const displayedRatio = r.width / r.height;
              const naturalRatio = img.naturalWidth / img.naturalHeight;
              const diffPercent = Math.abs(displayedRatio - naturalRatio) / naturalRatio;
              if (diffPercent > 0.05) {
                distorted.push({
                  src: img.getAttribute('src')?.slice(0, 40),
                  alt: img.getAttribute('alt')?.slice(0, 30),
                  displayedRatio: Number(displayedRatio.toFixed(3)),
                  naturalRatio: Number(naturalRatio.toFixed(3)),
                  diffPercent: Number((diffPercent * 100).toFixed(1)),
                });
              }
            }
          }
        }
        return distorted;
      });

      expect(distortedImages).toEqual([]);
    });

    // 8. Aucun chevauchement texte/icône dans .hp-svc et texte dans sa colonne
    if (p.type === 'accueil') {
      test('8. Aucun chevauchement texte/icône dans .hp-svc et texte dans sa colonne', async ({ page }) => {
        await page.goto(p.url);
        await preparePageForLayout(page);

        const svcIssues = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('.home-services .hp-svc'));
          const issues: { text: string; issue: string; details: Record<string, number> }[] = [];

          for (const item of items) {
            const icon = item.querySelector('.hp-svc-icon');
            const text = item.querySelector('.hp-svc-text');
            const li = item.closest('li');
            if (!icon || !text || !li) continue;

            const iRect = icon.getBoundingClientRect();
            const tRect = text.getBoundingClientRect();
            const liRect = li.getBoundingClientRect();

            // 1. Aucun chevauchement texte / icône (le texte doit être à droite de l'icône)
            if (tRect.left < iRect.right - 1) {
              issues.push({
                text: text.textContent?.trim().replace(/\s+/g, ' ') || '',
                issue: 'texte chevauche icone',
                details: { textLeft: Math.round(tRect.left), iconRight: Math.round(iRect.right) },
              });
            }

            // 2. Le texte reste dans sa colonne (sa cellule li)
            if (tRect.right > liRect.right + 2) {
              issues.push({
                text: text.textContent?.trim().replace(/\s+/g, ' ') || '',
                issue: 'texte deborde de sa colonne',
                details: {
                  textRight: Math.round(tRect.right),
                  colRight: Math.round(liRect.right),
                  overflow: Math.round(tRect.right - liRect.right),
                },
              });
            }

            // 3. Le texte ne dépasse pas de l'écran
            if (tRect.right > window.innerWidth) {
              issues.push({
                text: text.textContent?.trim().replace(/\s+/g, ' ') || '',
                issue: 'texte depasse de l ecran',
                details: {
                  textRight: Math.round(tRect.right),
                  innerWidth: Math.round(window.innerWidth),
                  overflow: Math.round(tRect.right - window.innerWidth),
                },
              });
            }
          }

          return issues;
        });

        expect(svcIssues).toEqual([]);
      });
    }

  });
}
