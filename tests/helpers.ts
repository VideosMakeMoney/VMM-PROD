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

export interface SectionDefinition {
  index: number;
  selector: string;
  label: string;
}

export interface PageDefinition {
  name: string;
  url: string;
  lang: 'fr' | 'en';
  type: 'accueil' | 'services' | 'portfolio' | 'client' | 'apropos' | 'contact';
  clientSlug?: string;
  sections: SectionDefinition[];
}

export const PAGES: PageDefinition[] = [
  // Français
  {
    name: 'accueil-fr',
    url: '/',
    lang: 'fr',
    type: 'accueil',
    sections: [
      { index: 0, selector: '.hero', label: 'Héros' },
      { index: 1, selector: '#portfolio-accueil', label: 'Portfolio' },
      { index: 2, selector: '#equipe', label: 'Équipe' },
      { index: 3, selector: '#services-accueil', label: 'Services' },
      { index: 4, selector: '#contact', label: 'Contact' },
    ],
  },
  {
    name: 'services-fr',
    url: '/services/',
    lang: 'fr',
    type: 'services',
    sections: [
      { index: 0, selector: '.page-hero', label: 'Héros Services' },
      { index: 1, selector: '.jd-vision', label: 'Vision JD Premiere' },
      { index: 2, selector: '#svc-liste', label: 'Liste Services' },
      { index: 3, selector: 'section:nth-of-type(4)', label: 'Groupe Services 1' },
      { index: 4, selector: 'section:nth-of-type(5)', label: 'Groupe Services 2' },
      { index: 5, selector: '.svc-to-portfolio', label: 'Transition Portfolio' },
    ],
  },
  {
    name: 'portfolio-fr',
    url: '/portfolio/',
    lang: 'fr',
    type: 'portfolio',
    sections: [
      { index: 0, selector: '.pf-hero', label: 'Héros Portfolio' },
      { index: 1, selector: '#realisons', label: 'Ce que nous réalisons' },
      { index: 2, selector: '.pf-honneur', label: 'Entreprises à l\'honneur' },
      { index: 3, selector: '.pf-coulisses', label: 'Coulisses' },
      { index: 4, selector: '.pf-end', label: 'Écran final' },
    ],
  },
  {
    name: 'client-tapis-rouge-fr',
    url: '/portfolio/tapis-rouge/',
    lang: 'fr',
    type: 'client',
    clientSlug: 'tapis-rouge',
    sections: [{ index: 0, selector: '.collection-screen', label: 'Collection Tapis Rouge' }],
  },
  {
    name: 'client-pur-construction-fr',
    url: '/portfolio/pur-construction/',
    lang: 'fr',
    type: 'client',
    clientSlug: 'pur-construction',
    sections: [{ index: 0, selector: '.collection-screen', label: 'Collection Pur Construction' }],
  },
  {
    name: 'client-hors-pair-fr',
    url: '/portfolio/hors-pair/',
    lang: 'fr',
    type: 'client',
    clientSlug: 'hors-pair',
    sections: [{ index: 0, selector: '.collection-screen', label: 'Collection Hors-Pair' }],
  },
  {
    name: 'client-bluewise-fr',
    url: '/portfolio/bluewise/',
    lang: 'fr',
    type: 'client',
    clientSlug: 'bluewise',
    sections: [{ index: 0, selector: '.collection-screen', label: 'Collection Bluewise' }],
  },
  {
    name: 'apropos-fr',
    url: '/about/',
    lang: 'fr',
    type: 'apropos',
    sections: [
      { index: 0, selector: '.page-hero', label: 'Héros À propos' },
      { index: 1, selector: '#jd', label: 'Jean-David' },
      { index: 2, selector: '#renaud', label: 'Renaud' },
      { index: 3, selector: '.jd-coulisses', label: 'Coulisses' },
      { index: 4, selector: '#vision', label: 'Vision' },
    ],
  },
  {
    name: 'contact-fr',
    url: '/contact/',
    lang: 'fr',
    type: 'contact',
    sections: [
      { index: 0, selector: '.section-contact', label: 'Formulaire et Coordonnées' },
      { index: 1, selector: '.section-tight', label: 'FAQ' },
    ],
  },

  // Anglais
  {
    name: 'accueil-en',
    url: '/en/',
    lang: 'en',
    type: 'accueil',
    sections: [
      { index: 0, selector: '.hero', label: 'Hero' },
      { index: 1, selector: '#portfolio-accueil', label: 'Portfolio' },
      { index: 2, selector: '#equipe', label: 'Team' },
      { index: 3, selector: '#services-accueil', label: 'Services' },
      { index: 4, selector: '#contact', label: 'Contact' },
    ],
  },
  {
    name: 'services-en',
    url: '/en/services/',
    lang: 'en',
    type: 'services',
    sections: [
      { index: 0, selector: '.page-hero', label: 'Hero Services' },
      { index: 1, selector: '.jd-vision', label: 'Vision' },
      { index: 2, selector: 'section:nth-of-type(3)', label: 'Services Group 1' },
      { index: 3, selector: 'section:nth-of-type(4)', label: 'Services Group 2' },
      { index: 4, selector: 'section:nth-of-type(5)', label: 'Services Group 3' },
      { index: 5, selector: '.svc-cta', label: 'Transition Portfolio' },
    ],
  },
  {
    name: 'portfolio-en',
    url: '/en/portfolio/',
    lang: 'en',
    type: 'portfolio',
    sections: [
      { index: 0, selector: '.pf-hero', label: 'Hero Portfolio' },
      { index: 1, selector: '#realisons', label: 'What we create' },
      { index: 2, selector: '.pf-honneur', label: 'Featured Companies' },
      { index: 3, selector: '.pf-coulisses', label: 'Behind the Scenes' },
      { index: 4, selector: '.pf-end', label: 'Final Transition' },
    ],
  },
  {
    name: 'client-tapis-rouge-en',
    url: '/en/portfolio/tapis-rouge/',
    lang: 'en',
    type: 'client',
    clientSlug: 'tapis-rouge',
    sections: [{ index: 0, selector: '.collection-screen', label: 'Collection Tapis Rouge' }],
  },
  {
    name: 'client-pur-construction-en',
    url: '/en/portfolio/pur-construction/',
    lang: 'en',
    type: 'client',
    clientSlug: 'pur-construction',
    sections: [{ index: 0, selector: '.collection-screen', label: 'Collection Pur Construction' }],
  },
  {
    name: 'client-hors-pair-en',
    url: '/en/portfolio/hors-pair/',
    lang: 'en',
    type: 'client',
    clientSlug: 'hors-pair',
    sections: [{ index: 0, selector: '.collection-screen', label: 'Collection Hors-Pair' }],
  },
  {
    name: 'client-bluewise-en',
    url: '/en/portfolio/bluewise/',
    lang: 'en',
    type: 'client',
    clientSlug: 'bluewise',
    sections: [{ index: 0, selector: '.collection-screen', label: 'Collection Bluewise' }],
  },
  {
    name: 'apropos-en',
    url: '/en/about/',
    lang: 'en',
    type: 'apropos',
    sections: [
      { index: 0, selector: '.page-hero', label: 'Hero About' },
      { index: 1, selector: '#vision', label: 'Vision' },
      { index: 2, selector: '#jd', label: 'Jean-David' },
      { index: 3, selector: '#renaud', label: 'Renaud' },
      { index: 4, selector: '.jd-coulisses', label: 'Behind the scenes' },
      { index: 5, selector: '.jd-closing', label: 'Closing' },
    ],
  },
  {
    name: 'contact-en',
    url: '/en/contact/',
    lang: 'en',
    type: 'contact',
    sections: [
      { index: 0, selector: '.section-contact', label: 'Contact Info & Form' },
      { index: 1, selector: '.section-tight', label: 'FAQ' },
    ],
  },
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
