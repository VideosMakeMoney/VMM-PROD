# QA : ajustements JD du 14 novembre 2026

Build local (`node build.mjs`, `python3 -m http.server`), Playwright Chromium, puis contrôle sur l'aperçu Netlify de la PR (navigateur intégré de l'app de bureau, 15 nov.) : voir « Aperçu Netlify » plus bas.

## Captures
- `mobile/` : écrans modifiés à 360×740, 390×844, 430×932 et 390×664, DSF 3 (WebP q62).
- `desktop-avant/` (main 5b44069) et `desktop-apres/` (cette branche) : 1440×900 ; quelques écrans à 1920×1080 dans `desktop-apres/`.
- `titrage/` : animation du titre détourée, images 0, 30, 100 et 150 sur fond sombre #0d0917, sur fond clair et sur une image vidéo (`composite_all`), raccord de boucle (`loopframes`), zooms des bords (`zoom_*`), poster (`poster_compare`). Sur la vidéo du héros : `desktop-apres/1440x900-accueil-ecran1.webp`.

## Contrôle visuel contre les maquettes « souhaitées » de JD (15 nov.)
Chaque écran touché a été comparé à la maquette de JD, pas au site actuel :
- Accueil 2 (ordi), Accueil 5 (ordi et mobile), Portfolio 4 et 5 (ordi et mobile), À propos 5 (ordi et mobile) : textes, boutons et photos agrandis pour suivre les proportions des maquettes (titre d'Accueil 5 sur trois lignes, photo d'À propos 5 plus grande et recadrée par le bas comme la maquette, étiquette « Et après les images ? » avec espace insécable avant « ? »).
- Accueil 4 mobile (C7) : même disposition que la maquette (icônes 2 × 3, photo studio en bas, bouton « Explorer nos services → »). Les textes et la typographie du site restent ceux de la prod : la maquette montre un titre en capitales sérif et un autre sous-titre.
- Portfolio 2 mobile (A2) : 4 vignettes 9:16 en 2 colonnes ; le texte est celui de A4 (plus long que celui de la maquette), donc les vignettes sont un peu plus petites que sur la maquette pour que tout tienne dans l'écran.
- Contact mobile (C11) : le 9:16 est servi sous 768 px (contact-logo-9x16), le 16:9 au-dessus. La boîte du fond fait un écran (390 × 780) ; le 9:16 y est recadré d'environ 5 % de chaque côté (object-fit: cover). Dans la vidéo elle-même, le logo touche les bords à certains moments.
- C6 : SVG animés avec l'effet Services (balayage + éclat, 1,4 s) : icônes sociales (Contact, pied de page), flèche « Voir notre travail », icône lecture de la tuile Coulisses ; PNG d'icônes (Accueil 4, coordonnées) avec le même effet. Mouvement réduit : aucune animation.
- C2 : les sources seraient HEVC alpha d'abord, WebM ensuite ; aucun HEVC alpha n'a pu être produit ici, Safari garde le poster.

## tools/mesure-mobile.mjs (4 formats, 6 pages)
- Hauteur : toutes les sections tiennent dans l'écran (360×740, 390×844, 430×932, 390×664). Corrigés pendant la QA : Portfolio écrans 2, 3 et 4, À propos écrans JD et 5, Accueil écrans 2 et 3 à 390×664, Contact écran 1.
- 390×844 et 430×932 : OK complet (hauteur et snap).
- Snap tactile : des « sautées » sortent par moments à 360×740 et toujours à 390×664. Même résultat sur main : à 360×740 le test est instable (même page OK puis KO d'une exécution à l'autre, sur main comme sur la branche), et à 390×664 le balayage de 650 px du script dépasse l'écran de 600 px (artefact déjà noté le 13 nov.).

## Contraste du rectangle (A1, opacité ÷ 2)
Estimation sur captures : luminance du fond derrière le paragraphe du héros (pixels de texte exclus), 3 instants de la vidéo, 95e centile = zone la plus claire.
| Page | 1440×900 | 390×844 |
|---|---|---|
| Accueil | 7,5:1 | 5,8:1 |
| Services | 13,7:1 | 13,0:1 |
| Portfolio | 11,0:1 | 10,4:1 |
| À propos | 14,2:1 | 12,4:1 |
| Tapis Rouge (page client) | — | 5,7:1 |
Le rectangle s'applique aussi aux héros des pages de zones et à l'écran 1 de Contact (ajout du 15 nov., « dans toutes les pages du site »).
Tout reste au-dessus de 4,5:1 sur les instants mesurés. Une image plus claire de la vidéo pourrait descendre plus bas : à revoir sur l'aperçu.

## Animation du titre (C1/C2), v2 du 14 nov. au soir
- Source remplacée par le MP4 v2 de JD (courriel uid 1930, 22 h 58) : H.264 2304×4096, 7,708 s, 24 i/s, 185 images, piste AAC muette (retirée, `-an`).
- Même recadrage (2304×720 à y 1660, couvre le titre et l'éclat, y ≈ 1692–2327 mesuré), même détourage maison ; aucun pixel verdâtre (G > max(R,B)+25 sous alpha > 40) sur les images 0, 30, 92, 150, 184. WebM VP9 alpha 1152×360, crf 37, 733 Ko ; poster WebP 57 Ko / PNG 267 Ko.
- Boucle v2, mesurée sur la bande recadrée (écart absolu moyen 0–255, demi-résolution) : images voisines moyenne 1,72, médiane 1,54, max 3,43 ; raccord dernière→première **6,88** (titre seul : 10,10). Le saut reste deux fois plus grand que le plus grand pas normal : fondu enchaîné gardé (6 dernières images vers la première, 0,25 s). Après fondu : raccord **0,95**, pas maximal 3,43 (celui de la source).
- Capture : `titrage/v2-sombre-et-video.webp` (images 0, 30, 92, 184 sur #0d0917 et sur l'image du héros).

## Animation du titre (C1/C2), v1 (remplacée)
- WebM VP9 avec alpha, 1152×360, 721 Ko, 8 s en boucle. Raccord fin→début : écart 14,53 avant, 2,07 après un fondu de 0,25 s (images voisines : 1,73 en moyenne).
- Safari/iOS ne lit pas le WebM alpha : il affiche le poster fixe (même titre). Pas de HEVC alpha possible ici.
- Le H1 reste dans la page (masqué visuellement) pour le référencement et les lecteurs d'écran.
- Mouvement réduit : poster fixe.

## Pages EN
HTML identique à main hors `<style>` (vérifié sur toutes les pages /en/).

## Aperçu Netlify (15 nov., commit 276eaf0)
Captures dans `apercu/`, prises dans le navigateur intégré sur `https://deploy-preview-26--vmm-prod.netlify.app/` (bandeau Netlify « Collaborate » visible en bas, il n'existe que sur les aperçus).
- Accueil écran 1 à 360×740, 390×844, 430×932, 390×664, 1440×900 et 1920×1080 : titre animé centré, entier, sur la vidéo.
- 390×844 : Contact, À propos écran 5 (photo de JD sur plus de la moitié de la hauteur, fondu en haut), Portfolio écran 5 (photo à gauche, texte à droite, sans chevauchement).
- 1440×900 : Contact, Google sur la première ligne des réseaux.
- Vérifié par script : vidéo du titre présente, en lecture, `loop`, `is-playing`, marges 16/16 à 390 px ; `.socials` reçoit `is-visible` sur /contact/ (3 listes, dont le pied de page) ; lien Google `https://share.google/Q1kfklKWv8FgykyCD` ; `sameAs` Google sur l'accueil FR seulement ; robots `noindex,nofollow`.
- Boucle du titre : `1920x1080-titre-derniere-image.png` (t = 8,02 s) et `1920x1080-titre-premiere-image.png` (t = 0) sont identiques à l'œil sur la vidéo. Le fondu enchaîné est gardé : sans lui, l'écart mesuré au raccord est 6,88, soit deux fois le plus grand écart entre images voisines.
- Le bouton « Voir notre travail » est gris-violet (#8b8ba8) sur la vidéo, comme sur main : pas changé ici.

## Accueil écrans 2 et 3 sur ordi portable (relecture de Natasha, 15 nov. midi)
Avant (aperçu, commit f0e9796) : l'écran 2 dépassait à 1280×720, 1366×768, 1440×900 et 1536×864, l'écran 3 à 1280×720 et 1366×768 (titre sur 5 ou 6 lignes, bouton sous l'écran).
Correction : vignettes de l'écran 2 limitées à `100svh − en-tête − 8svh − min(26vw, 24.5rem)` (marges + étiquette, titre, texte, légendes et bouton), largeur déduite au format des affiches (460:642) ; à l'écran 3, photos 3:4 bornées par la hauteur et par la place laissée à une colonne de texte d'au moins 24rem, titre ramené à clamp(2.4rem, 4.2vw, 4.25rem).

Mesuré sur l'aperçu (commit 54ac72c, navigateur intégré ; hauteur de section / dispo, bas du bouton, lignes du titre, média) :

| Format | Écran 2 | Écran 3 |
|---|---|---|
| 1024×768 | 704 / 703,3, bouton 662, 1 ligne, vignettes 226×316 | 704, bouton 580, 3 lignes, photos 255×340 |
| 1280×720 | 656 / 655, bouton 619, vignettes 190×266 | 656, bouton 572, 3 lignes, photos 370×493 |
| 1366×768 | 704 / 703, bouton 673, vignettes 206×287 | 704, bouton 590, 3 lignes, photos 395×527 |
| 1440×900 | 836 / 835, bouton 798, vignettes 279×390 | 836, bouton 665, 3 lignes, photos 417×556 |
| 1536×864 | 800,6 / 799,3, bouton 761, vignettes 243×339 | 800,6, bouton 653, 3 lignes, photos 445×594 |
| 1920×1080 | 1016,5 / 1015,3, bouton 920, vignettes 304×424 | 1016,5, bouton 757, 3 lignes, photos 452×603 |

La hauteur des sections est leur `min-height` (contenu plus court partout). L'écart de 1 à 1,3 px vient de l'en-tête, qui fait 64,7 px au rendu alors que `--header-h` vaut 64 px ; c'est le cas de toutes les sections du site, comme sur main.
Captures (build local identique, Playwright) : `desktop-ecrans-2-3/`. Les captures du navigateur intégré étaient recadrées à ces formats, d'où les mesures par script.
Mobile : `tools/mesure-mobile.mjs` OK à 360×740, 390×844 et 430×932 ; à 390×664, seulement les « sautées » du snap tactile déjà présentes sur main. Les règles ne s'appliquent qu'à partir de 900 px de large. Pages EN : HTML identique à main hors `<style>`.
