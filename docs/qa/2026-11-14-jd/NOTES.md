# QA : ajustements JD du 14 novembre 2026

Build local (`node build.mjs`, `python3 -m http.server`), Playwright Chromium. Le conteneur n'atteint pas les aperçus Netlify : à revérifier sur l'aperçu de la PR.

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
