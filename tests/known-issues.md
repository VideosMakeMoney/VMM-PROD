# Anomalies et Débordements Connus sur `main` (JD Layout & Médias)

Ce document répertorie l'ensemble des anomalies identifiées sur la branche `main` actuelle.
Conformément aux directives, ces écarts sont isolés dans la suite de tests Playwright via `test.fixme()` pour documenter la dette technique et éviter les blocages de la CI, tandis que **toutes les autres sections et règles sont des tests stricts et bloquants**.

---

## 1. Hauteur des sections (> 100svh - header + 1px)

Règle JD : *Chaque section tient dans un écran (hauteur $\le$ 100svh moins l'en-tête + 1px)*.

Sur 495 vérifications de hauteur (55 sections × 9 résolutions), **474 sections respectent strictement la règle d'or**. Les **21 dépassements réels** sont listés ci-dessous :

### A. Desktop Compact (1280×720) — 7 sections
| Page | Section | Sélecteur | Hauteur réelle | Hauteur max | Dépassement | Cause |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `portfolio-fr` | Section 1 | `#realisons` | 662 px | 656 px | +6 px | Titre + grille de cartes légèrement trop hauts à 720p |
| `apropos-fr` | Section 1 | `#jd` | 660 px | 656 px | +4 px | Portrait JD + bio textuelle |
| `apropos-fr` | Section 2 | `#renaud` | 660 px | 656 px | +4 px | Portrait Renaud + bio textuelle |
| `contact-fr` | Section 0 | `.section-contact` | 669 px | 656 px | +13 px | Formulaire + coordonnées sur un seul écran |
| `portfolio-en` | Section 1 | `#realisons` | 680 px | 656 px | +24 px | Hauteur de la grille de réalisations en version anglaise |
| `apropos-en` | Section 2 | `#jd` | 660 px | 656 px | +4 px | Portrait JD + bio |
| `apropos-en` | Section 3 | `#renaud` | 660 px | 656 px | +4 px | Portrait Renaud + bio |

### B. Desktop Compact (1366×768) — 5 sections
| Page | Section | Sélecteur | Hauteur réelle | Hauteur max | Dépassement | Cause |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `apropos-fr` | Section 1 | `#jd` | 712 px | 704 px | +8 px | Portrait JD + bio |
| `apropos-fr` | Section 2 | `#renaud` | 712 px | 704 px | +8 px | Portrait Renaud + bio |
| `portfolio-en` | Section 1 | `#realisons` | 708 px | 704 px | +4 px | Grille réalisations anglaise |
| `apropos-en` | Section 2 | `#jd` | 712 px | 704 px | +8 px | Portrait JD + bio |
| `apropos-en` | Section 3 | `#renaud` | 712 px | 704 px | +8 px | Portrait Renaud + bio |

### C. Mobile — 9 sections
*Note : Sur mobile, les sections multi-cartes de l'accueil, de services et du portfolio tiennent désormais toutes dans un écran grâce aux ajustements des PR #24 et #25.*
Seules les sections suivantes débordent :

| Résolution | Page | Section | Sélecteur | Hauteur réelle | Hauteur max | Dépassement | Cause |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **390×844** | `contact-fr` | Section 0 | `.section-contact` | 1 656 px | 781 px | +875 px | Balise `<section>` unique regroupant coordonnées + formulaire (2 écrans scroll-snap consécutifs) |
| **390×844** | `contact-en` | Section 0 | `.section-contact` | 1 656 px | 781 px | +875 px | Idem version anglaise |
| **390×664** | `contact-fr` | Section 0 | `.section-contact` | 1 296 px | 601 px | +695 px | Coordonnées + formulaire sur 1 balise `<section>` |
| **390×664** | `contact-en` | Section 0 | `.section-contact` | 1 296 px | 601 px | +695 px | Coordonnées + formulaire sur 1 balise `<section>` |
| **390×664** | `services-en` | Section 1 | `.jd-vision` | 618 px | 601 px | +17 px | Bloc vision JD dépasse sur très petit écran en hauteur (664 px) |
| **360×740** | `contact-fr` | Section 0 | `.section-contact` | 1 448 px | 677 px | +771 px | Coordonnées + formulaire sur 1 balise `<section>` |
| **360×740** | `contact-en` | Section 0 | `.section-contact` | 1 448 px | 677 px | +771 px | Coordonnées + formulaire sur 1 balise `<section>` |
| **430×932** | `contact-fr` | Section 0 | `.section-contact` | 1 832 px | 869 px | +963 px | Coordonnées + formulaire sur 1 balise `<section>` |
| **430×932** | `contact-en` | Section 0 | `.section-contact` | 1 832 px | 869 px | +963 px | Coordonnées + formulaire sur 1 balise `<section>` |

---

## 2. Débordement Horizontal (scrollWidth > clientWidth)

Sur l'ensemble des 18 pages et 9 résolutions, 17 pages ont un débordement horizontal strictement nul (0 px).
Seule la page suivante présente un débordement horizontal sur Desktop :

| Résolution | Page | clientWidth | scrollWidth | Élément en cause |
| :--- | :--- | :---: | :---: | :--- |
| **1280×720** | `contact-fr` | 1 280 px | 2 135 px | Pied de page : `nav[aria-label="Zones desservies"] ul.footer-zones` (14 pastilles sans retour à la ligne automatique) |
| **1366×768** | `contact-fr` | 1 366 px | 2 178 px | Idem |
| **1440×900** | `contact-fr` | 1 440 px | 2 215 px | Idem |
| **1536×864** | `contact-fr` | 1 536 px | 2 263 px | Idem |
| **1920×1080** | `contact-fr` | 1 920 px | 2 455 px | Idem |

---

## 3. Éléments Coupés ou Superposés

| Résolution | Page | Élément | Conteneur parent | Cause |
| :--- | :--- | :--- | :--- | :--- |
| **Desktop (toutes)** | `contact-fr` | `<p class="label">Zones desservies</p>` | `BODY.page-contact` | Débordement horizontal du bloc de zones du pied de page |
| **390×664** | `accueil-fr` | `<p>EXPLORER NOS SERVICES →</p>` | `SECTION.home-services` | Bouton calé en bas de la boîte studio sur écran mobile très court (664 px) |
| **390×664** | `accueil-en` | `<p>EXPLORE OUR SERVICES →</p>` | `SECTION.home-services` | Idem |

---

## 4. Boutons masqués hors du premier écran (`KNOWN_HIDDEN_BUTTONS`)

Règle JD : *Le bouton d'action d'une section doit être entièrement visible dans l'écran initial sans défilement*.

Dans la suite de tests (`tests/layout.spec.ts`), la condition `test.fixme` repose sur la liste exacte `KNOWN_HIDDEN_BUTTONS`. Sur l'ensemble des 55 sections × 9 résolutions (495 vérifications), seuls **8 cas précis** présentent un bouton situé sous la ligne de flottaison initiale, tous situés sur la section formulaire de la page Contact sur mobile :

| Résolution | Page | Section | Sélecteur | Bouton | Position top | Hauteur écran | Clé exacte (`KNOWN_HIDDEN_BUTTONS`) |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :--- |
| **390×844** | `contact-fr` | Section 0 | `.section-contact` | « Envoyer » (`button[type="submit"]`) | 1 480 px | 844 px | `contact-fr\|0\|mobile-iphone-390x844` |
| **390×844** | `contact-en` | Section 0 | `.section-contact` | « Send » (`button[type="submit"]`) | 1 480 px | 844 px | `contact-en\|0\|mobile-iphone-390x844` |
| **390×664** | `contact-fr` | Section 0 | `.section-contact` | « Envoyer » (`button[type="submit"]`) | 1 194 px | 664 px | `contact-fr\|0\|mobile-iphone-390x664` |
| **390×664** | `contact-en` | Section 0 | `.section-contact` | « Send » (`button[type="submit"]`) | 1 194 px | 664 px | `contact-en\|0\|mobile-iphone-390x664` |
| **360×740** | `contact-fr` | Section 0 | `.section-contact` | « Envoyer » (`button[type="submit"]`) | 1 311 px | 740 px | `contact-fr\|0\|mobile-android-360x740` |
| **360×740** | `contact-en` | Section 0 | `.section-contact` | « Send » (`button[type="submit"]`) | 1 311 px | 740 px | `contact-en\|0\|mobile-android-360x740` |
| **430×932** | `contact-fr` | Section 0 | `.section-contact` | « Envoyer » (`button[type="submit"]`) | 1 620 px | 932 px | `contact-fr\|0\|mobile-iphone-430x932` |
| **430×932** | `contact-en` | Section 0 | `.section-contact` | « Send » (`button[type="submit"]`) | 1 620 px | 932 px | `contact-en\|0\|mobile-iphone-430x932` |

Tout autre bouton masqué ou tronqué sur toute autre page ou section fait immédiatement échouer le test Playwright de manière bloquante.

---

## 5. Typographie et Cibles Tactiles (Allowlists strictes par sélecteur)

Le test 5 (`layout.spec.ts`) est un **test bloquant** (`test.fixme` retiré) : il filtre exclusivement les éléments connus répertoriés ci-dessous via des sélecteurs CSS précis. Tout nouvel élément textuel < 12 px ou toute nouvelle cible tactile mobile < 44 px fait échouer le test avec `expect(reste).toEqual([])`.

### A. Typographie < 12 px (`ALLOWED_SMALL_TEXT_SELECTORS`)
- **Sélecteur** : `.bg-toggle`
- **Taille** : `font-size: 0.7rem` (11.2 px)
- **Élément** : Bouton discret permettant de mettre en pause la vidéo d'arrière-plan sur les pages `/services/`, `/en/services/`, `/about/` et `/en/about/`.

### B. Cibles tactiles mobiles < 44 px (`ALLOWED_SMALL_TOUCH_SELECTORS`)
- `footer a[href^="mailto:"]` : Lien textuel courriel du pied de page (`jeandavid@videosmakemoney.ca`, hauteur ~20 px).
- `footer a[href^="tel:"]` : Lien textuel téléphonique du pied de page (`514-604-5682`, hauteur ~20 px).
- `footer a[aria-label="X"]` & `footer a[href*="x.com"]` : Bouton de réseau social X dans le pied de page (largeur 40 à 48 px selon rendu de police/icône).
- `footer .footer-zones a` : Liens de navigation des pastilles de zones desservies dans le pied de page (`Laurentides`, `Saint-Jérôme`, `Sainte-Thérèse`, hauteur ~32 px).
- `.section-contact a[href^="mailto:"]` : Lien textuel direct de contact dans le bloc coordonnées (hauteur ~19 px).
- `.section-contact a[href^="tel:"]` : Lien textuel téléphonique direct dans le bloc coordonnées (hauteur ~16 px).

---

## 6. Médias > 5 Mo dans le dossier public (`static/` et `dist/`)

14 fichiers vidéo originaux historiques (hérités des versions précédentes et des PR 24 à 26 de JD) excèdent la limite recommandée de 5 Mo :
- `static/videos/jd/hero-accueil-16x9.mp4` (10,6 Mo)
- `static/videos/jd/hero-accueil-16x9.webm` (6,0 Mo)
- `static/videos/jd/hero-accueil-9x16.mp4` (10,8 Mo)
- `static/videos/jd/hero-accueil-9x16.webm` (7,3 Mo)
- `static/videos/jd/hero-ordi.mp4` (6,8 Mo)
- `static/videos/jd/portfolio-hero-mobile.webm` (5,7 Mo)
- `static/videos/jd/portfolio-hero-ordi.mp4` (8,3 Mo)
- `static/videos/jd/portfolio-hero-ordi.webm` (6,5 Mo)
- `static/videos/jd/services-9x16-ancien.webm` (5,3 Mo)
- `static/videos/jd/work-16x9.mp4` (7,9 Mo)
- `static/videos/jd/work-9x16-ancien.webm` (5,7 Mo)
- `static/videos/jd/work-9x16.mp4` (7,9 Mo)
- `static/videos/jd/work-9x16.webm` (5,4 Mo)
- `static/videos/vmm-camera-scroll.webm` (5,1 Mo)

Dans `tests/media.spec.ts`, le test vide de placeholder a été supprimé. Le test principal `aucun fichier public > 5 Mo et fichiers PNG/MP4 optimisés` est strictement bloquant et utilise cette allowlist exacte de 14 fichiers. Tout ajout d'un fichier lourd supplémentaire fait échouer la CI.
