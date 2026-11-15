# QA : ajustements JD du 14 novembre 2026

Build local (`node build.mjs`, `python3 -m http.server`), Playwright Chromium. Le conteneur n'atteint pas les aperçus Netlify : à revérifier sur l'aperçu de la PR.

## Captures
- `mobile/` : écrans modifiés à 360×740, 390×844, 430×932 et 390×664, DSF 3 (WebP q62).
- `desktop-avant/` (main 5b44069) et `desktop-apres/` (cette branche) : 1440×900 ; quelques écrans à 1920×1080 dans `desktop-apres/`.
- `titrage/` : animation du titre détourée, images 0, 30, 100 et 150 sur fond sombre #0d0917, sur fond clair et sur une image vidéo (`composite_all`), raccord de boucle (`loopframes`), zooms des bords (`zoom_*`), poster (`poster_compare`). Sur la vidéo du héros : `desktop-apres/1440x900-accueil-ecran1.webp`.

## tools/mesure-mobile.mjs (4 formats, 6 pages)
- Hauteur : toutes les sections tiennent dans l'écran (360×740, 390×844, 430×932, 390×664). Corrigés pendant la QA : Portfolio écrans 2, 3 et 4, À propos écran JD (bio plus longue), Accueil écrans 2 et 3 à 390×664.
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
Tout reste au-dessus de 4,5:1 sur les instants mesurés. Une image plus claire de la vidéo pourrait descendre plus bas : à revoir sur l'aperçu.

## Animation du titre (C1/C2)
- WebM VP9 avec alpha, 1152×360, 721 Ko, 8 s en boucle. Raccord fin→début : écart 14,53 avant, 2,07 après un fondu de 0,25 s (images voisines : 1,73 en moyenne).
- Safari/iOS ne lit pas le WebM alpha : il affiche le poster fixe (même titre). Pas de HEVC alpha possible ici.
- Le H1 reste dans la page (masqué visuellement) pour le référencement et les lecteurs d'écran.
- Mouvement réduit : poster fixe.

## Pages EN
HTML identique à main hors `<style>` (vérifié sur toutes les pages /en/).
