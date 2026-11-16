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

## 4. Boutons hors du viewport initial

Sur les sections dont la hauteur dépasse l'écran (voir tableau 1), ou lorsque le bouton est positionné en bas de section, le bouton nécessite un défilement pour être visible.
Sont concernés :
- `accueil-fr` & `accueil-en` : Boutons d'action des écrans 1 à 4 sur desktop et mobile.
- `services-fr` & `services-en` : Boutons de transition vers le Portfolio.
- `portfolio-fr` & `portfolio-en` : Bouton d'action de la section 1.
- `apropos-fr` & `apropos-en` : Bouton de bas de page.
- `contact-fr` & `contact-en` : Bouton d'envoi du formulaire sur mobile.

---

## 5. Typographie et Cibles Tactiles

1. **Texte < 12 px** :
   - Pages `/services/` et `/about/` : Le bouton de bascule d'arrière-plan `.bg-toggle` utilise un `font-size: 0.7rem` (11.2 px).
2. **Cibles tactiles mobiles < 44 px** :
   - Liens `mailto:` dans le pied de page : hauteur calculée de 22 à 24 px.
   - Icône sociale "X" dans le pied de page : largeur calculée de 40 à 41 px.

---

## 6. Médias > 5 Mo dans le dossier public

Trois fichiers vidéo originaux hérités excèdent la limite stricte de 5 Mo :
- `static/videos/work-9x16.webm` (5,69 Mo)
- `static/videos/services-9x16-ancien.webm` (5,31 Mo)
- `static/videos/vmm-camera-scroll.webm` (5,13 Mo)
