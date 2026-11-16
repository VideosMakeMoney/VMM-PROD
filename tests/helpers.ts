import { Page } from '@playwright/test';

/**
 * Liste de toutes les pages FR et EN à tester conformément aux spécifications :
 * - Accueil : /, /en/
 * - Services : /services/, /en/services/
 * - Portfolio : /portfolio/, /en/portfolio/
 * - Pages clients du portfolio :
 *   - /portfolio/tapis-rouge/, /en/portfolio/tapis-rouge/
 *   - /portfolio/pur-construction/, /en/portfolio/pur-construction/
 *   - /portfolio/hors-pair/, /en/portfolio/hors-pair/
 *   - /portfolio/bluewise/, /en/portfolio/bluewise/
 * - À propos : /about/, /en/about/
 * - Contact : /contact/, /en/contact/
 */

export interface PageDefinition {
  name: string;
  url: string;
  lang: 'fr' | 'en';
  type: 'accueil' | 'services' | 'portfolio' | 'client' | 'apropos' | 'contact';
  clientSlug?: string;
}

export const PAGES: PageDefinition[] = [
  // Français
  { name: 'accueil-fr', url: '/', lang: 'fr', type: 'accueil' },
  { name: 'services-fr', url: '/services/', lang: 'fr', type: 'services' },
  { name: 'portfolio-fr', url: '/portfolio/', lang: 'fr', type: 'portfolio' },
  { name: 'client-tapis-rouge-fr', url: '/portfolio/tapis-rouge/', lang: 'fr', type: 'client', clientSlug: 'tapis-rouge' },
  { name: 'client-pur-construction-fr', url: '/portfolio/pur-construction/', lang: 'fr', type: 'client', clientSlug: 'pur-construction' },
  { name: 'client-hors-pair-fr', url: '/portfolio/hors-pair/', lang: 'fr', type: 'client', clientSlug: 'hors-pair' },
  { name: 'client-bluewise-fr', url: '/portfolio/bluewise/', lang: 'fr', type: 'client', clientSlug: 'bluewise' },
  { name: 'apropos-fr', url: '/about/', lang: 'fr', type: 'apropos' },
  { name: 'contact-fr', url: '/contact/', lang: 'fr', type: 'contact' },

  // Anglais
  { name: 'accueil-en', url: '/en/', lang: 'en', type: 'accueil' },
  { name: 'services-en', url: '/en/services/', lang: 'en', type: 'services' },
  { name: 'portfolio-en', url: '/en/portfolio/', lang: 'en', type: 'portfolio' },
  { name: 'client-tapis-rouge-en', url: '/en/portfolio/tapis-rouge/', lang: 'en', type: 'client', clientSlug: 'tapis-rouge' },
  { name: 'client-pur-construction-en', url: '/en/portfolio/pur-construction/', lang: 'en', type: 'client', clientSlug: 'pur-construction' },
  { name: 'client-hors-pair-en', url: '/en/portfolio/hors-pair/', lang: 'en', type: 'client', clientSlug: 'hors-pair' },
  { name: 'client-bluewise-en', url: '/en/portfolio/bluewise/', lang: 'en', type: 'client', clientSlug: 'bluewise' },
  { name: 'apropos-en', url: '/en/about/', lang: 'en', type: 'apropos' },
  { name: 'contact-en', url: '/en/contact/', lang: 'en', type: 'contact' },
];

/**
 * Prépare la page pour une capture d'écran stable et reproductible :
 * - Active prefers-reduced-motion
 * - Attend le chargement complet des polices
 * - Met en pause toutes les vidéos à 0s
 * - Gèle les transitions et animations CSS
 * - Masque le curseur de texte
 */
export async function stabilizePage(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForLoadState('networkidle');

  // Faire défiler la page pour déclencher le chargement de tous les médias différés
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(100);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(100);

  await page.evaluate(async () => {
    // Attendre les polices
    if (document.fonts) {
      await document.fonts.ready;
    }

    // Tuer tout GSAP / ScrollTrigger éventuel
    if ((window as any).ScrollTrigger) {
      (window as any).ScrollTrigger.getAll().forEach((t: any) => t.kill());
    }
    if ((window as any).gsap) {
      (window as any).gsap.globalTimeline.clear();
      (window as any).gsap.killTweensOf('*');
    }

    // Révéler tous les éléments animés et réinitialiser les styles inline GSAP
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      el.classList.add('is-visible');
      (el as HTMLElement).style.opacity = '1';
      (el as HTMLElement).style.transform = 'none';
    });

    // Mettre en pause toutes les vidéos à t=0 et empêcher la reprise
    HTMLMediaElement.prototype.play = function () {
      this.pause();
      this.currentTime = 0;
      return Promise.resolve();
    };

    document.querySelectorAll('video').forEach((v) => {
      try {
        v.pause();
        v.currentTime = 0;
      } catch (e) {
        // Ignorer les erreurs d'autoplay bloqué
      }
    });

    // Forcer le chargement immédiat des images
    document.querySelectorAll('img').forEach((img) => {
      if (img.loading === 'lazy') {
        img.loading = 'eager';
      }
    });

    // Attendre la fin du chargement des images
    await Promise.all(
      Array.from(document.images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener('load', () => resolve(true), { once: true });
          img.addEventListener('error', () => resolve(false), { once: true });
        });
      })
    );

    // Figer toutes les animations CSS et transitions
    const style = document.createElement('style');
    style.id = '__playwright-stabilize-style__';
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `;
    document.head.appendChild(style);
  });

  // Laisser 100ms pour que le layout se stabilise
  await page.waitForTimeout(100);
}
