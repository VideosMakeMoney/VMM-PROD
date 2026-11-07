# VMM-PROD — corrections pour se conformer aux maquettes JD (audit du 2026-11-07)

Repo : lesconstructionsmr-debug/VMM-PROD, base `main` (372f5d2). Nouvelle branche + PR, **ne pas merger**.
Règles : `VMM_ALLOW_INDEX` reste false (noindex) ; ne rien inventer (aucun ID YouTube, aucune bio, aucune URL) ; ne pas toucher au logo 3D CSS ; garder FR/EN cohérents (fr.json / en.json) ; ne pas casser Services / À propos / SEO local / sitemap / hreflang.

## Pièces jointes (Max les joint au fil Claude)
- `VMM-HomePage-LAYOUT-2026-11-05.pdf` (11 p., directives Accueil, la source la plus récente pour l'accueil)
- `VMM-Client-TapisRouge|PurConstruction|BlueWise|HorsPair|Coulisses-LAYOUT-2026-11-04.pdf` (4 p. chacun, pages client)
Dates : LastWriteTime des entrées dans les ZIP Drive (Accueil 2026-11-05, pages client 2026-11-04), pas les métadonnées des PDF. Les directives de ces PDF priment sur les anciennes. En cas de conflit **dans** le PDF Accueil, la page 11 « AJUSTEMENTS VALIDÉS » prime sur les pages 6 à 10.

## A. Accueil (PDF Accueil)
1. Ordre des sections : 01 Héros vidéo → 02 Portfolio (4 miniatures) → 03 Équipe → 04 Services → 05 Contact. Il y a aujourd'hui `#creations`, `#equipe`, `#realisations`, `#contact` et `#avis` : fusionner pour n'avoir qu'**une** section Portfolio de 4 miniatures, placée avant l'Équipe. Bloc Avis Google : s'il n'y a aucun avis authentique à afficher, masquer toute la section (pas de titre seul, aucun avis inventé).
2. Héros : le bouton devient « CONTACTEZ-NOUS » → page `/contact/` (EN : `/en/contact/`), sans défilement ni modale. Titre « VIDEOS MAKE MONEY » sans rectangle : VIDEOS en blanc, MAKE en violet, MONEY en rose-violet. Dans la signature, PASSION et GROW en mauve, le reste en blanc. Garder muet, en boucle, playsinline et le poster. La balise n'a pas d'attribut autoplay : vérifier dans `src/main.js` le démarrage par JS (play() après chargement, gestion du refus, reduced-motion) et le confirmer en navigateur. Ajouter `autoplay` seulement si c'est compatible avec le chargement différé.
3. Portfolio : 4 cartes côte à côte, 9:16, `object-fit: contain`, coins arrondis, halo violet au survol (150 à 300 ms). Chaque carte ouvre sa vidéo YouTube si l'ID existe déjà dans `content/portfolio.json`. Sinon, carte sans lien et note [À CONFIRMER JD]. Mobile : carrousel tactile. Bouton « EXPLORER NOTRE PORTFOLIO → » vers `/portfolio/` (aujourd'hui, cette section renvoie à /services/). Mettre en violet les mots « travail » et « lui-même » du titre de section, tel qu'écrit dans le PDF.
4. Équipe : texte à gauche, **2 portraits côte à côte** à droite, avec les portraits déjà approuvés et affichés sur /about/ (fichiers repo `static/img/about-jd-photo` et `static/img/about-renaud`, issus de « About Section JD Photo.png » et « About Section RENAUD Photo.png » fournis par JD). Aucune génération, visages entiers, coins arrondis. Aujourd'hui, les blocs photo de l'équipe sur l'accueil sont vides. Mots mauves : « équipe », « vision », « histoires ». Bouton « DÉCOUVRIR NOTRE ÉQUIPE → » vers `/about/`. Mobile : texte, puis photos.
5. Services (nouvelle section 04) : les 6 icônes existantes `static/img/service-0X-*` en grille 2 × 3 à gauche, dans l'ordre 1 Publicité stratégique, 2 Tournage/photo, 3 Drone, 4 Scénarisation, 5 Montage, 6 Branding. Portrait `static/img/services-jd-detoure` à droite, en entier et avec sa transparence. Aucun chevauchement. Bouton « EXPLORER NOS SERVICES → » vers `/services/`.
6. Contact : photo de JD à gauche ; titre « Votre prochain projet commence ici. », la description et le CTA « CONTACTEZ-NOUS → » vers `/contact/` à droite (même mauve, coins arrondis). Le formulaire reste uniquement sur la page /contact/. Photo : seulement si elle fait partie des photos de JD déjà approuvées et correspond à la maquette p. 5. En cas de doute, ne pas forcer une autre photo : laisser l'emplacement sans image et noter [À CONFIRMER : photo exacte de JD, maquette p. 5].

## B. Pages client et Coulisses (PDF client)
7. Le titre est le seul texte sur le héros : blanc uniquement (retirer le `<span class="accent">` mauve sur « Rouge » et ailleurs), un peu plus bas que la V1. Retirer la ligne « VMM Productions a réalisé N vidéos… », le compteur et « Retour aux projets » du héros. Ne pas cacher de texte pour le SEO : retirer ce texte du héros, ou le déplacer en contenu visible compatible avec la maquette. `.sr-only` est réservé aux libellés d'accessibilité utiles (par ex. le nom d'un bouton flèche).
8. Page Coulisses : titre « VMM COULISSES / MAKING-OF / ANNONCES » (EN : équivalent sobre, à confirmer), taille adaptée au titre long.
9. Une seule page écran, sans défilement vertical sur ordi. Les miniatures et les flèches se superposent au bas du héros, **sans aucun conteneur** (pas de rectangle, panneau ni fond translucide). Au maximum 3 miniatures visibles, flèches ‹ › sur ordi, glissement tactile et flèches sur mobile. Compteur « 01 / N ». Survol : léger éclaircissement mauve, sans déplacement. Focus clavier visible, prefers-reduced-motion respecté. Le héros continue de jouer pendant la navigation.
10. Héros vidéo par client : `content/clips.json` prévoit déjà `clip` par client. Préparer les entrées `tapis-rouge`, `pur-construction`, `bluewise` et `coulisses`, et la version `ordi` de `hors-pairs`, **uniquement si** les fichiers web compressés sont joints (voir C). Sans fichier : laisser vide, ne pas mettre de faux clip.
11. Nombre de miniatures : les aperçus des PDF client montrent Tapis Rouge 3, PUR 3, BlueWise 2, Hors-Pair 2 et Coulisses 9, alors que le PDF Portfolio indique 10/3/7/2/9. C'est un conflit à faire valider, pas une instruction de suppression : ne retirer aucune vidéo, garder la bibliothèque calculée depuis `videos` et signaler le conflit dans la PR.

## C. Médias web prêts (pack `LIVRAISON-CLAUDE-2026-11-07/web/`, joint par Max)
Encodés depuis les originaux de JD (ZIP Drive dans NOUVEAU), sans recadrage ni coupe : durée complète, ratio conservé, muets, H.264 yuv420p faststart + WebM VP9 + poster jpg/webp. Le détail (entrée ZIP source → fichier → dimensions/durée/poids/hash) est dans `MANIFEST-medias.csv`. Copier dans `static/videos/jd/` sous le nom `<nom>.mp4`, `<nom>.webm` et `<nom>-poster.jpg/.webp`. Générer un poster avif seulement si le build l'exige.
Mapping proposé dans `content/clips.json` (ne rien inventer d'autre) :
- `work` : mobile `work-9x16`, ordi `work-16x9`. Remplace l'ancien work-9x16 si le manifeste confirme la même source JD.
- `portfolio` : mobile `work-9x16`, ordi `work-16x9`. Le vrai 16:9 remplace le 16:9 « composé flou » ; on peut ensuite supprimer les anciens fichiers `portfolio-hero-*` devenus inutiles.
- `hors-pairs` : mobile `hors-pair-9x16`, ordi `hors-pair-16x9`.
- Nouveaux clips `tapis-rouge`, `pur-construction`, `bluewise` et `coulisses` (mobile `<slug>-9x16`, ordi `<slug>-16x9`), reliés via `clip` dans `portfolio.json` (clients) et `coulissesCollection.clip`.
- Héros de l'accueil : remplacer `hero-ordi` / `hero-mobile` par `hero-accueil-16x9` / `hero-accueil-9x16` (sources JD « HomePage Hero 16-9 DESKTOP.mp4 » / « HomePage Hero 9-16 MOBILE.mp4 », 28,3 s ; le PDF Accueil demande le plan « tournage sur toiture », contenu non visionné). Constat ffprobe : l'actuel `hero-ordi.mp4` dure 20,23 s, comme le clip Work (20,2 s), pas comme le HomePage Hero (28,33 s) ; il ne provient donc pas du héros JD. Ces fichiers pèsent environ 10,6 Mo : garder preload prudent et poster.
Garder le chargement prudent existant (preload, lecture hors écran, reduced-motion).

## D. Autres points des 35 critères
- Contrôle du survol (critère 34) : halo ou éclaircissement violet discret, transition de 150 à 300 ms, sur les miniatures de l'accueil, du Portfolio et des pages client.
- Couleurs du titre du héros (critère 5), mots mauves (critère 12) et titre SERVICES en dégradé (critère 26) : appliquer exactement les PDF, sans autre changement de palette.
- Pied de page : aucune directive de JD trouvée, ne pas le modifier.
- Toutes les productions dont l'ID est connu restent ; aucun faux avis, ID ou vidéo.

## Ne pas faire
Aucun ID YouTube inventé (promo, événementiel et coulisses restent vides sans confirmation). Aucun changement de domaine ni d'indexation. Ne pas toucher à l'ancien site public (videosmakemoney.ca, hébergé sur Vercel).

## Limites à garder explicites
- 3 IDs YouTube vides (promo, événementiel, coulisses) : en attente de JD.
- Compteurs contradictoires (PDF Portfolio 10/3/7/2/9 contre aperçus client 3/3/2/2/9) : ne rien supprimer.
- LiXjVf43rqo et -6N2iah60mc : non attribués, ne pas les ajouter sans confirmation.
- 95 % non garanti : il faut les tests ordi et mobile plus les réponses de JD.

## Livrable
PR + preview Netlify, liste des fichiers touchés, captures ordi (1440) et mobile (390) de l'accueil et des 5 pages client, liste [À CONFIRMER JD] restante.
