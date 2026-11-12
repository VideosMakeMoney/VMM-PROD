# VMM-PROD
site web de vmm prod videastre 

## Site VMM Productions (Videos Make Money)

Nouveau site de VMM Productions, vidéaste corporatif du Grand Montréal et des Laurentides.
Spécifications : `docs/objectif-vmm.txt`, `docs/contexte-vmm.txt` et `docs/prompt_landing.md`.

> **Aucune mise en ligne sur videosmakemoney.ca sans l'accord explicite de Max.**
> Domaine final : `https://videosmakemoney.ca` (sans www). Le contexte production a `VMM_ALLOW_INDEX = "true"` (indexé) ; les deploy previews et branch deploys restent en `noindex`.

## Comment ça marche

- Site statique, généré par `node build.mjs` (aucune dépendance) dans `dist/`.
- Tout le contenu est rendu en HTML : lisible sans JavaScript, par Google et par les IA.
- Pages : `/`, `/services`, `/portfolio`, `/about`, `/contact`, et `/en/...` pour l'anglais. Bascule FR/EN sur chaque page vers la page équivalente.
- Animations : GSAP 3.12.5 + ScrollTrigger et Lenis 1.1.13, hébergés dans `src/vendor/`. Tout est désactivé si « réduire les animations » est activé.
- Vidéos YouTube : vignette légère, l'iframe n'est chargé qu'au clic (lightbox plein écran, Échap pour fermer, focus gardé dans la lightbox). Les Shorts s'affichent entiers en 9:16.

## Modifier le contenu (pour JD)

Tout se trouve dans `content/`, en JSON, modifiable directement sur GitHub (crayon « Edit ») :

| Fichier | Contenu |
| --- | --- |
| `content/portfolio.json` | Vidéos (client, catégorie, ID YouTube, langue, titre, vedette oui/non), clients, catégories |
| `content/fr.json` / `content/en.json` | Tous les textes FR / EN, titres et descriptions Google |
| `content/site.json` | Courriel, réseaux sociaux, vidéo du bandeau, fourchettes de budget, widget d'avis Google, `drapeaux` (contenu en attente de JD) |
| `content/zones.json` | Pages locales (zones desservies) FR + EN : Laurentides, Sainte-Thérèse, Saint-Jérôme, Rive-Nord de Montréal. Texte provisoire, JD réécrira. Libellés communs sous `zones` de `fr.json` / `en.json` |
| `content/clips.json` | Clips muets de JD joués en fond (Projets, pages clients, Services, À propos, Contact) : version mobile 9:16 et version ordi 16:9, avec un point focal (`focal`) réglable. Fichiers dans `static/videos/jd/` |

Ajouter une vidéo : copier une entrée de `videos` dans `portfolio.json`, coller l'ID YouTube (`youtube.com/shorts/ABC123` → `ABC123`), mettre le client. Netlify reconstruit le site tout seul après chaque modification.

Chaque client de `clients` qui a au moins une vidéo a sa page : `/portfolio/<slug>/` et `/en/portfolio/<slug>/`, avec toutes ses vidéos. Le nombre de vidéos de sa carte sur « Projets » est calculé automatiquement. Ajouter un client : une entrée dans `clients` (nom, slug, clip facultatif), puis ses vidéos dans `videos` avec le même nom de client.

Page Portfolio (d'après le PDF « VMM Portfolio LAYOUT » de JD, 2026-11-05), dans l'ordre : héros vidéo plein écran `PORTFOLIO` (clip `portfolio` de `clips.json`, fichiers `portfolio-hero-mobile` 9:16 et `portfolio-hero-ordi` 16:9) avec repère SCROLL ; « Ce que nous réalisons », 4 miniatures de catégorie qui ouvrent YouTube (`categories[].videoAccueil`) ; « Les entreprises à l'honneur », un bouton logo par client dans l'ordre de `honneur` (boutons originaux de JD dans `static/img/clients/`, champ `clients[].logo` sans extension, `nomBouton` = nom écrit sous le bouton), nombre de vidéos calculé ; « Coulisses », une photo (`coulissesCollection.photo`) qui mène à `/portfolio/coulisses/` (`/en/portfolio/behind-the-scenes/`) ; bouton vers À propos. Pages client et Coulisses : héros vidéo si un clip existe, puis une rangée de miniatures qui ouvrent YouTube, avec flèches ←→. `clientsAVenir` reste dans le JSON mais n'est plus affiché.

Pages Services et À propos : elles suivent les PDF de JD rangés dans `docs/jd/` (hors du site publié). Dans leurs titres (`services` et `apropos` de `fr.json` / `en.json`), `*mot*` met un mot en violet et `\n` fait un retour à la ligne. Images dans `static/img/` (`.webp` + `.png`/`.jpg`). Les anciens textes de ces deux pages sont gardés sous `ancien`.

Drapeaux (`site.json` → `drapeaux`, `true` = affiché) : `strategie` pour le slogan « Strategy first. Camera second. » de Services (la carte Stratégie est confirmée par JD), `servicesCamera` pour la section caméra « Pièce par pièce » et `servicesFin` pour « Découvrez nos réalisations. » + bouton /portfolio. Les deux derniers sont à `false` pour l'instant : le code reste en place, la caméra reviendra à la fin de la page en animation au défilement.

Les textes `[À CONFIRMER ...]` / `[TO CONFIRM ...]` restent dans `content/*.json` pour le suivi, mais ne sont jamais publiés dans le HTML : rien ne s'affiche à leur place tant qu'ils ne sont pas remplacés.

## Formulaire

Netlify Forms, formulaire `contact` (champs `name`, `email`, `company`, `budget`, `message`, comme l'ancien `/api/contact`). Envoi sans recharger la page ; sans JavaScript, envoi classique puis page `/merci/`.
Après le premier déploiement : Netlify → Forms → activer la détection, puis Notifications → courriel vers jeandavid@videosmakemoney.ca.

## Déploiement Netlify

1. Netlify → Add new site → Import from GitHub → ce dépôt.
2. Build : `node build.mjs`, dossier publié : `dist` (déjà dans `netlify.toml`).
3. Laisser `VMM_ALLOW_INDEX` vide pour la démo.
4. **Mise en ligne réelle** : `VMM_ALLOW_INDEX = "true"` est déjà dans `netlify.toml` sous `[context.production.environment]` (branche `lancement-domaine-final`, fusionnée par Max après le changement DNS de JD : A @ → 75.2.60.5, CNAME www → vmm-prod.netlify.app). Après le déploiement, puis soumettre `https://videosmakemoney.ca/sitemap.xml` dans Google Search Console. Ce réglage active aussi les redirections forcées `www.videosmakemoney.ca` et `vmm-prod.netlify.app` → `videosmakemoney.ca`. Les deploy previews et branch deploys restent toujours en `noindex` (`build.mjs` vérifie `CONTEXT`).

Redirections 301 (`_redirects`, liste `OLD_REDIRECTS` dans `build.mjs`), en un seul saut vers l'adresse finale : ancien anglais `/work` → `/en/portfolio/`, `/process` → `/en/services/`, `/pricing` → `/en/contact/` ; ancien français `/fr` → `/`, `/fr/services` → `/services/`, `/fr/about` → `/about/`, `/fr/contact` → `/contact/`, `/fr/work` → `/portfolio/`, `/fr/process` → `/services/`, `/fr/pricing` → `/contact/`. Les anciennes `/services`, `/about` et `/contact` ne sont pas redirigées : ce sont les adresses des nouvelles pages FR.

## SEO / GEO

- `<title>` (≤ 60 caractères), meta description (≤ 155) et phrase d'intro factuelle (`resume`) dans `seo` de `fr.json` / `en.json`. Les anciennes valeurs sont gardées sous `seoAncien`. La phrase d'intro s'affiche en haut de chaque page (bande sous le bandeau sur Accueil, Services et À propos ; sous le titre ailleurs) et sert aussi dans `llms.txt`.
- Canonical, `hreflang` fr-CA / en-CA / x-default réciproques, `<html lang>` correct.
- Open Graph + Twitter card complets. Images de partage 1200 × 630 dans `static/og/`, tirées des posters existants : `og-accueil` (logo, aussi pour Projets et Contact), `og-services`, `og-apropos`, `og-client-<slug>` (une page client sans image utilise `og-accueil`).
- H1 : un mot-clé + ville (`seo.<page>.h1`, `portfolio.clientH1`) s'affiche en petit sous-titre gris sous le grand titre, à l'intérieur du H1 (style `.h1-sub`).
- JSON-LD : ProfessionalService seul (nom « VMM Productions », nom légal « Productions VMM », courriel, téléphone, mission en description, zone `GeoCircle` de 50 km autour de Sainte-Thérèse plus `AdministrativeArea` « Québec » en zone élargie, heures du lundi au dimanche 7 h à 19 h (`openingHoursSpecification`), `foundingDate` 2026-04-01, adresse limitée à QC / CA sans rue ni code postal, aucun prix ni forfait ; logo, image, langues fr-CA/en-CA), Person (toujours « JD », jamais le prénom complet ; Renaud : « 10 ans d'expérience en cinéma » tant que sa bio est à confirmer), WebSite, WebPage, BreadcrumbList (à partir de deux niveaux, donc pas sur l'accueil), Service pour chaque carte de /services/ (sans prix), VideoObject (et entrée du sitemap vidéo) seulement pour une vidéo qui a un ID YouTube **et** une `dateMiseEnLigne` (AAAA-MM-JJ) dans `portfolio.json` (dates remplies le 2026-11-05 depuis les pages YouTube publiques : 23 vidéos ; les 2 sans ID restent vides) : les autres sont gardées en réserve et sortent dès que la date est remplie. L'@id d'une vidéo est l'URL de sa page + `#video-<ID>`, FAQPage sur /contact (réponses connues et non signalées seulement).
- `sitemap.xml` : pages FR + EN avec alternates et entrées vidéo. `robots.txt` pointe vers le sitemap. `llms.txt` (FR + résumé EN) généré à partir du contenu.
- Page 404 propre : `/404.html` en français, `/en/404.html` en anglais (règle dans `_redirects`), avec les pages principales dans les deux langues.
- Infos confirmées par JD (2026-11-03) dans `site.json` et `mission` / `surMesure` de `fr.json` / `en.json` : nom légal, téléphone, zone (tout le Québec, Montréal et Laurentides en villes principales), délai de livraison 1 à 2 semaines, services sur mesure et bilingues. Aucune adresse de rue publiée. Le client s'écrit « Installations Hors-Pair » (https://hors-pair.ca/).

### Vitesse

- CSS en ligne dans chaque page (`src/styles.css` reste la source) : aucune requête ne bloque le premier affichage. Police préchargée : Syne 700 (titres). Depuis le 2026-11-12, deux familles sont chargées : Syne 700 pour les titres principaux (H1 et H2), Inter (400, 700, 800) pour les textes, boutons, menu et étiquettes.
- Logo de l'en-tête en 240 px (18 Ko au lieu de 46 Ko ; l'original reste dans `static/logo/`). Posters en AVIF (6 à 27 Ko), puis WebP, puis `.jpg`.
- Polices hébergées sur le site (`static/fonts/`, licences OFL à côté), `font-display: swap`. Plus de feuille Google Fonts bloquante.
- GSAP, ScrollTrigger et Lenis sont chargés par `main.js` après l'affichage de la page ; ce qui est déjà à l'écran reste affiché sans animation, le reste apparaît au défilement comme avant.
- Vidéo héro de l'accueil (quand elle existera) : aucune source dans le HTML, `main.js` ajoute seulement celle de l'appareil après le chargement ; le poster s'affiche d'abord.
- Poster du bandeau préchargé (une seule image par appareil, par media query) et affiché par une `<picture>` sans attendre le JavaScript. Posters en WebP allégés (540 px de large pour le 9:16, 1280 px pour le 16:9) à côté des `.jpg` (qui restent le repli).
- Clips de fond : une seule version téléchargée (mobile ou ordi), après le chargement de la page et seulement à l'approche de la section. Images sous la ligne de flottaison en `loading="lazy"`, avec `width`/`height`.
- La classe `js` est posée dès le `<head>` : le menu mobile ne fait plus sauter la page au chargement.

## Placeholders restants [À CONFIRMER]

**Médias**
- Bandeau d'accueil (2026-11-05) : vidéo 9:16 de JD dans `static/videos/jd/hero-mobile.mp4` / `.webm` + poster `hero-mobile-poster.*` (image à 3 s). Ordinateur (2026-11-05) : `hero-ordi.mp4` / `.webm` (1920 × 1080) fabriquées à partir de la même vidéo, clip 9:16 centré sur un fond flou, + poster `hero-ordi-poster.*` (image à 3 s). Version provisoire : à remplacer si JD fournit une vraie vidéo 16:9.
- Dates de publication YouTube (`datePublication` dans `portfolio.json`) pour sortir les vidéos dans le JSON-LD VideoObject.
- Vidéo de chaque catégorie de « Ce que nous créons » (`videoAccueil` dans `portfolio.json`).
- ID YouTube des vedettes « Une équipe soudée » (Tapis Rouge) et « ICI, TOUT A CHANGÉ » (Installations Hors-Pair), et la catégorie de cette dernière (« production »).
- 2 autres vidéos vedettes pour arriver à 4.
- Photos authentiques de JD et Renaud pour l'accueil (la page À propos a maintenant les siennes).
- Titres des 23 Shorts (pour l'instant « [À CONFIRMER : titre] » à l'écran, « Client N » pour Google), catégorie et langue de chaque Short.
- Liens HH Portes et Fenêtres, Paintball Mirabel (making-of et album photo).

**Services et À propos (en attente de JD)**
- Portrait détouré de JD (PNG transparent, 2026-11-05) dans l'intro À propos : `static/img/about-jd.webp` / `.png`. L'ancienne photo rectangulaire est gardée en `about-jd-photo` (section « Rencontrez JD »).
- Réponses de JD (2026-11-02) : carte Stratégie gardée ; portrait de JD dans l'intro À propos (about-jd en attendant son PNG transparent : `apropos.vision.photo` / `photoFormat`) ; textes et bio de Renaud gardés comme aperçus, sans mention visible (`noteInterne`) ; section caméra et « Découvrez nos réalisations. » retirées de Services pour l'instant (drapeaux).
- Héro Services (demande de Natasha, 2026-11-03) : « NOS / SERVICES. » en haut à gauche avec le texte d'intro de l'ancienne page (`services.hero`), au lieu du seul titre « SERVICES » en bas du PDF.
- Section caméra : reviendra à la fin de Services, en animation au défilement qui suit l'utilisateur.
- Vidéo About finale (`about-16x9` / `about-9x16`) et points focaux des bandeaux (`clips.json`).
- `about-jd-detoure` (faux damier) n'est pas utilisé.
- Textes anglais de ces deux pages : traduction fidèle, à valider.
- Animation des nouvelles icônes : même déclencheur, durée (1,4 s) et courbe que les anciennes icônes en trait, en dévoilement progressif. Comparaison avant/après à faire valider (PDF, étape 06).

**Textes**
- Bio de Renaud à enrichir avec ses réponses (ne pas inventer son parcours).
- Paragraphe BlueWise AI (gardé dans `apropos.bluewise`, plus affiché : absent du PDF À propos).
- Textes finaux de Contact et texte du pied de page.
- Fourchettes de budget du formulaire actuel.
- Widget d'avis Google : emplacement et compte.
- Orthographe des clients : « Pur » / « PUR » (« Installations Hors-Pair » est confirmé).
- Toute la version anglaise (traduction brouillon) et les réponses FAQ 2 et 4 en anglais (à reprendre du dictionnaire du site actuel ; les réponses 1 et 3 sont traduites des infos confirmées par JD).
- FAQ 2 : la réponse originale parle de « stratégie » et de « visuels IA », ce qui contredit la règle « aucune stratégie pub ni service IA ». Gardée telle quelle et signalée.

**Charte**
- Bandeau de l'accueil : titre « Videos Make Money. » en Syne 700, majuscules, avec le dégradé des titres (Natasha, 2026-11-12 ; Inter 800 du 2026-11-10 ; avant : Cinzel 900, demande de Natasha du 2026-11-03).
- Courbes exactes des keyframes (float-in, aurora-drift, marquee, shimmer, spin-border, svc-stroke/svc-fill, leak-drift) : le fichier `identite_visuelle.md` n'a pas été fourni, elles sont reconstituées.
- Page Contact « identique à l'actuelle » : reconstruite selon la charte, à comparer avec la page en ligne.

## Originaux des médias (hors du site publié)

Originaux conservés hors du repo (dossier de Max : Videos Make Money\NOUVEAU\JD-AJUSTEMENT-2026-11-10\ et LIVRAISON-CLAUDE-2026-11-07\).

`media-originaux/` garde les fichiers tels que reçus (jamais copiés dans `dist/`) :
- `coulisses/01–18` : photos de coulisses ; versions WebP allégées dans `static/img/coulisses/coulisses-NN.webp` (1152 × 2048) et `coulisses-NN-576.webp` (576 × 1024). Affichées en grille sur /about/ et /en/about/ (titre « Coulisses » / « Behind the scenes », entre les bios et le mot de la fin), chargement différé, `srcset` 576/1152.
- `jd/PNG Transparent - Section A Propos.png` → `static/img/about-jd.webp` / `.png`.
- `jd/VMM Logo Carre.png` (fond noir, pas transparent) → `static/img/logo-carre.webp` / `.png` et `logo-carre-512.*` (logo du JSON-LD, future fiche Google Business). Le logo 3D de l'en-tête ne change pas.
- `jd/hero-upload.mp4` → `static/videos/jd/hero-mobile.mp4` / `.webm` (réencodées 30 i/s, sans son).
