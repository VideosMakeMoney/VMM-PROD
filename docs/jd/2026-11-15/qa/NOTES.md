# QA finale — ajustements de JD du 15 novembre 2026

Branche `jd-ajustements-2026-11-15` (parties A à E fusionnées + corrections de QA `src/parts/f.css`),
comparée à `main` (1cfd059). Date : 16 nov. 2026.

## Méthode

- Build `node build.mjs` (OK), servi en local ; `main` construit servi à côté pour les captures « avant ».
- Liens : tous les `href`, `src`, `srcset`, `poster`, `url()` et chemins de médias internes de `dist/` (1958 références) vérifiés sur disque → **0 lien cassé** (main : 0).
- Contrôle automatique Playwright (Chromium) : 32 pages (16 FR + 16 EN : accueil, services, portfolio, 4 pages client, coulisses, à propos, contact, 4 pages zones, 404, merci/thanks) × 9 résolutions (mobile 390×844, 390×664, 360×740, 430×932 en isMobile/hasTouch ; ordinateur 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080) = 288 chargements par version. Mesures : erreurs console, réponses réseau ≥ 400, débordement horizontal (`scrollWidth` > `innerWidth`), hauteur de chaque écran (section `jd-screen` ou aimantée) ≤ 100svh − en-tête + 1 px, chaque bouton entièrement dans l'écran, texte visible ≥ 12 px, cibles tactiles ≥ 44 px (mobile). Les animations d'apparition sont forcées à leur état final.
- Captures maquette | avant | après (PIL), regardées une à une ; sélection ci-dessous.
- Textes : `innerText` de toutes les pages FR et EN (390 et 1440 px) comparé à main ; les 11 textes comparés caractère par caractère au courriel de JD (UID 1936) ; `<title>`, meta description, Open Graph, canonical/alternate et JSON-LD comparés à main.
- Titre animé : Chromium avec émulation iPhone 13 et Pixel 7, ordinateur 1440×900 et 1920×1080, sans WebGL, « réduire les animations » ; WebKitGTK 2.52.6 (WebDriver sous Xvfb).

## Modifications → fichiers → statut

| Modification | Fichiers | Statut | Capture |
|---|---|---|---|
| A — description SEO propre à chaque page dans le héros (FR 4 pages, EN services/portfolio/about/contact ; accueil sans) | content/fr.json, content/en.json, build.mjs | Fait. Textes identiques à content et aux images de JD (EN) | 13 |
| Textes 1 à 11 (FR) | content/fr.json (anciens sous `…AncienJd15`) | Fait : 22/22 identiques au courriel (390 et 1440 px) ; 9 et 10 en 2 paragraphes aux bons endroits | 04, 05, 06, 08, 09, 11 |
| #1 rectangle des héros ajusté au texte (FR + EN) | src/parts/c.css | Fait | 12, 13 |
| #2 titre animé (MP4 alpha empilé + WebGL, poster transparent) | src/parts/c.js, c.css, static/videos/jd/ | Fait : joue partout, 11–22 px au-dessus de la signature, 0 pixel vert, pas de cadre | 12, 15 |
| #3 carrousel accueil p2 / portfolio p2 (mobile) | src/parts/d.css, d.js | Fait (écart mineur, voir plus bas) | 06 |
| #4 carrousel des logos portfolio p3 (mobile) | src/parts/d.css, d.js | Fait (écart mineur) | 07 |
| #5 équipe, accueil p3 (mobile) | src/parts/e.css | Fait | 08 |
| #6 accueil p4 (mobile) | src/parts/e.css | Fait : grille ajustée (.82fr / 1.18fr) et « Image de marque et » insécable (aucun mot orphelin) | 09 |
| #7 accueil p5 (ordinateur) | src/parts/e.css | Fait : photo ramenée à min(90%, 100% - 2.5rem), ancrée en bas, appareil photo entier, marge sous l'en-tête, 0 px de débordement | 10 |
| #8 « Découvrez ce que » en dégradé | src/parts/e.css | Fait | — |
| #9 portfolio p4, mobile | e.css + **f.css (QA)** | Corrigé en QA : photo ≈ 66 % de la largeur, du haut à ≈ 58 % de la hauteur, 3 tablettes entières, fondu à gauche/en bas ; titre 10,4 vw ; libellés de la tuile 5,5 vw | 01, 02 |
| #9 portfolio p4, ordinateur | e.css + **f.css (QA)** | Corrigé en QA : étiquette, titre, texte et libellés à l'échelle de la maquette (×1,2 à ×1,8), tuile 20,5 vw | 03 |
| #10 / #11 À propos JD / Renaud (mobile) | e.css + **f.css (QA)** | Corrigé en QA avec les vraies bios : vide photo → rôle supprimé (60 / 120 px → ≈ 20 px), titres à la largeur des maquettes, texte de Renaud ≈ 4 vw | 04, 05 |
| #12 À propos p5 (mobile) | src/parts/e.css | Fait : vide de 80 px éliminé (écart bouton-tête ≈ 9 px), sujet agrandi (largeur max 86vw) sous le bouton jusqu'au bas | 11 |
| Contact : débordement horizontal (ordinateur) | **f.css (QA)** | Corrigé et verrouillé par test : débordement horizontal 0 px sur toutes résolutions, test.fixme retirés | 14 |

Corrections de QA : commit `1739a7a` (src/parts/f.css, FR seulement, aucun texte modifié).

## Résultats des contrôles automatiques (après / main)

Nombre d'échecs sur 9 résolutions :

| groupe | console | réseau 404 | débordement horiz. | hauteur d'écran | bouton | texte < 12 px | cible < 44 px |
|---|---|---|---|---|---|---|---|
| FR pages principales | 0 (main 0) | 0 (0) | **0 (main 5)** | **0 (main 5)** | 0 (0) | 0 (0) | 196 (196) |
| EN pages principales | 0 (0) | 0 (0) | 0 (0) | 7 (7) | 0 (0) | 0 (0) | 196 (196) |
| FR zones | 0 (0) | 0 (0) | 0 (0) | 114 (114) | 71 (71) | 0 (0) | 112 (112) |
| EN zones | 0 (0) | 0 (0) | 0 (0) | 114 (114) | 69 (69) | 0 (0) | 112 (112) |
| FR 404 / merci | 0 (0) | 0 (0) | 0 (0) | 5 (5) | 0 (0) | 0 (0) | 40 (40) |
| EN 404 / thanks | 0 (0) | 0 (0) | 0 (0) | 5 (5) | 0 (0) | 0 (0) | 40 (40) |

**Aucun échec nouveau par rapport à main.** Détail :
- Console : seules erreurs = miniatures YouTube externes (`i.ytimg.com`) bloquées par le réseau du bac à sable (identique sur main, sans lien avec le site).
- FR : Contact ne déborde plus (+535 à +855 px sur main) ; Contact 1280×720 (669/655 sur main), Portfolio p2 1280×720 (662/655) et À propos JD/Renaud 1280×720 et 1366×768 (660/655, 712/703) tiennent maintenant.
- EN, déjà présents sur main, non corrigés (la version anglaise ne doit pas changer) : À propos JD/Renaud 1280×720 (+5 px) et 1366×768 (+9 px) ; Portfolio p2 1280×720 (+25 px) et 1366×768 (+5 px) ; Services p2 390×664 (+18 px).
- Pages zones, 404, merci : contenu long qui défile librement par conception (aimantation douce), identique à main.
- Cibles < 44 px : liens courriel/téléphone du pied de page (≈ 20 px de haut) et pastilles de zones (32 px visibles, zone tactile de 44 px par `::after`, que la mesure ne voit pas) ; identique à main.

Textes : les seules différences visibles avec main sont les 11 textes, les descriptions SEO déplacées dans les héros (FR : 4 pages ; EN : même texte, déplacé de la bande sous le héros vers le héros), et, sur mobile, des libellés montrés ou masqués par les carrousels (« Vidéos promotionnelles » sous la carte active ; noms des entreprises non actives masqués). Meta description, Open Graph, canonical/alternate et JSON-LD : identiques à main sur les 32 pages. HTML EN : identique à main hors descriptions déplacées, conteneur `hero-desc` (#1) et numéro de version de main.js.

Titre animé : joue (temps vidéo qui avance) sur iPhone 13, Pixel 7, 1440×900, 1920×1080 et WebKitGTK ; sans WebGL et avec « réduire les animations », le poster transparent (WebP RGBA) s'affiche. 0 pixel vert, aucun assombrissement autour du titre (comparaison avec/sans titre, fond figé).

## Écarts restants vs maquettes

1. #9 ordinateur : sur la maquette, les tablettes sont plus rapprochées (photo retouchée ou tassée en hauteur) ; la vraie photo 9:16 ne peut pas être reproduite ainsi sans la déformer. La taille des objets est la même ; le haut (lampe) est rogné.
2. #3 / #4 carrousels : sur les maquettes, les cartes de côté sont plus petites et entièrement visibles, et l'ordre affiché diffère (maquette : Tapis Rouge à gauche, Le Grind à droite). Sur le site, l'ordre reste celui des catégories ; à 390×844, les cartes de côté touchent les bords.
3. #12 : sur la maquette, le titre est coupé après « chaque » ; sur un écran de 390 px, le même rapport de taille passe à 3 lignes. Le titre garde donc sa taille (2 lignes, coupure après « image, »).
4. Les maquettes sont en 9:16 (écran plus large que 390×844) : les comparaisons de proportions ont été faites par rapport à la largeur.
5. Étiquettes et textes des maquettes #9 (« Derrière les images », « Une collection dédiée… ») différents du site : textes du site conservés (aucun texte changé).

## Questions pour JD

1. #9 ordinateur : acceptes-tu la photo telle quelle (tablettes à leur espacement réel), ou veux-tu fournir une version retouchée de l'étagère, plus large et moins haute ?
2. #9 : faut-il reprendre les textes de ta maquette (« Derrière les images », « Et derrière chaque production… », « Une collection dédiée aux moments derrière la caméra. ») ? Pour l'instant, les textes actuels sont gardés.
3. Carrousels : l'ordre des cartes doit-il suivre ta maquette (Tapis Rouge à gauche, Le Grind à droite) ?
4. Version anglaise : faut-il corriger les petits dépassements déjà présents sur main (About JD/Renaud et Portfolio p2 en 1280×720 et 1366×768, Services p2 en 390×664) ?

## Captures (dans ce dossier)

01–03 #9 · 04 #10 · 05 #11 · 06 #3 · 07 #4 · 08 #5 · 09 #6 · 10 #7 · 11 #12 · 12 #1/#2 héros mobile · 13 A (description dans le héros) · 14 pied de page de Contact · 15 WebKitGTK (accueil, titre animé).
