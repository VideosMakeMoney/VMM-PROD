# VMM-PROD
site web de vmm prod videastre 

## Site VMM Productions (Videos Make Money)

Nouveau site de VMM Productions, vidéaste corporatif du Grand Montréal et des Laurentides.
Spécifications : `docs/objectif-vmm.txt`, `docs/contexte-vmm.txt` et `docs/prompt_landing.md`.

> **Aucune mise en ligne sur videosmakemoney.ca sans l'accord explicite de Max.**
> La démo Netlify est servie en `noindex` tant que `VMM_ALLOW_INDEX` n'est pas `true`.

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
| `content/clips.json` | Clips muets de JD joués en fond (Projets, pages clients, Services, À propos, Contact) : version mobile 9:16 et version ordi 16:9, avec un point focal (`focal`) réglable. Fichiers dans `static/videos/jd/` |

Ajouter une vidéo : copier une entrée de `videos` dans `portfolio.json`, coller l'ID YouTube (`youtube.com/shorts/ABC123` → `ABC123`), mettre le client. Netlify reconstruit le site tout seul après chaque modification.

Chaque client de `clients` qui a au moins une vidéo a sa page : `/portfolio/<slug>/` et `/en/portfolio/<slug>/`, avec toutes ses vidéos. Le nombre de vidéos de sa carte sur « Projets » est calculé automatiquement. Ajouter un client : une entrée dans `clients` (nom, slug, clip facultatif), puis ses vidéos dans `videos` avec le même nom de client.

Pages Services et À propos : elles suivent les PDF de JD rangés dans `docs/jd/` (hors du site publié). Dans leurs titres (`services` et `apropos` de `fr.json` / `en.json`), `*mot*` met un mot en violet et `\n` fait un retour à la ligne. Images dans `static/img/` (`.webp` + `.png`/`.jpg`). Les anciens textes de ces deux pages sont gardés sous `ancien`.

Drapeau `strategie` (`site.json` → `drapeaux`) : à `false`, la carte « Stratégie vidéo et contenu publicitaire » et le slogan « Strategy first. Camera second. » disparaissent de la page Services (et de `llms.txt` / JSON-LD).

Tout texte contenant `[À CONFIRMER ...]` ou `[TO CONFIRM ...]` s'affiche en rose pointillé sur le site jusqu'à ce qu'il soit remplacé.

## Formulaire

Netlify Forms, formulaire `contact` (champs `name`, `email`, `company`, `budget`, `message`, comme l'ancien `/api/contact`). Envoi sans recharger la page ; sans JavaScript, envoi classique puis page `/merci/`.
Après le premier déploiement : Netlify → Forms → activer la détection, puis Notifications → courriel vers jeandavid@videosmakemoney.ca.

## Déploiement Netlify

1. Netlify → Add new site → Import from GitHub → ce dépôt.
2. Build : `node build.mjs`, dossier publié : `dist` (déjà dans `netlify.toml`).
3. Laisser `VMM_ALLOW_INDEX` vide pour la démo.
4. **Mise en ligne réelle (avec l'accord de Max seulement)** : brancher le domaine, mettre `VMM_ALLOW_INDEX=true`, redéployer, puis soumettre `https://videosmakemoney.ca/sitemap.xml` dans Google Search Console.

Redirections 301 (`_redirects`) : `/work` → `/portfolio`, `/process` → `/services`, `/pricing` → `/contact`, `/fr` → `/`.

## SEO / GEO

- `<title>` et meta description uniques par page, en FR et en EN ; `hreflang` fr-CA / en-CA / x-default réciproques ; `<html lang>` correct.
- JSON-LD : LocalBusiness + ProfessionalService, Person (JD, Renaud), WebSite, WebPage, BreadcrumbList, VideoObject pour chaque vidéo qui a un ID YouTube, FAQPage sur /contact (réponses connues seulement).
- `sitemap.xml` : 10 URL avec alternates et entrées vidéo. `robots.txt` et `llms.txt` générés à partir du contenu.
- Pas d'adresse ni de téléphone dans le JSON-LD tant qu'ils ne sont pas fournis (`site.json`).

## Placeholders restants [À CONFIRMER]

**Médias**
- Vidéos du bandeau `static/images/vmm-hero-desktop.mp4` et `vmm-hero-mobile.mp4`, image poster, versions WebM (facultatif).
- Vidéo de chaque catégorie de « Ce que nous créons » (`videoAccueil` dans `portfolio.json`).
- ID YouTube des vedettes « Une équipe soudée » (Tapis Rouge) et « ICI, TOUT A CHANGÉ » (Hors-Paire Excavation), et la catégorie de cette dernière (« production »).
- 2 autres vidéos vedettes pour arriver à 4.
- Photos authentiques de JD et Renaud pour l'accueil (la page À propos a maintenant les siennes).
- Titres des 23 Shorts (pour l'instant « [À CONFIRMER : titre] » à l'écran, « Client N » pour Google), catégorie et langue de chaque Short.
- Liens HH Portes et Fenêtres, Paintball Mirabel (making-of et album photo).

**Services et À propos (en attente de JD)**
- Carte Stratégie et slogan « Strategy first. Camera second. » : codés comme le PDF, derrière le drapeau `strategie`.
- Section caméra « Pièce par pièce » : gardée sous les services, à confirmer.
- Vidéo About finale (`about-16x9` / `about-9x16`) et points focaux des bandeaux (`clips.json`).
- Pas de portrait de JD dans l'intro À propos ; `about-jd-detoure` (faux damier) n'est pas utilisé.
- Textes anglais de ces deux pages : traduction fidèle, à valider.
- Animation des nouvelles icônes : même déclencheur, durée (1,4 s) et courbe que les anciennes icônes en trait, en dévoilement progressif (les nouvelles icônes sont des images). Comparaison avant/après à faire valider (PDF, étape 06).

**Textes**
- Bio de Renaud à enrichir avec ses réponses (ne pas inventer son parcours).
- Paragraphe BlueWise AI (gardé dans `apropos.bluewise`, plus affiché : absent du PDF À propos).
- Textes finaux de Contact et texte du pied de page.
- Fourchettes de budget du formulaire actuel.
- Widget d'avis Google : emplacement et compte.
- Orthographe des clients : « Pur » / « PUR », « Hors-Paire ».
- Toute la version anglaise (traduction brouillon) et les 4 réponses FAQ en anglais (à reprendre du dictionnaire du site actuel).
- FAQ 2 : la réponse originale parle de « stratégie » et de « visuels IA », ce qui contredit la règle « aucune stratégie pub ni service IA ». Gardée telle quelle et signalée.

**Charte**
- Inter (bandeau actuel) ou la police des titres (Cinzel) partout : variable `--font-hero` dans `src/styles.css`.
- Courbes exactes des keyframes (float-in, aurora-drift, marquee, shimmer, spin-border, svc-stroke/svc-fill, leak-drift) : le fichier `identite_visuelle.md` n'a pas été fourni, elles sont reconstituées.
- Page Contact « identique à l'actuelle » : reconstruite selon la charte, à comparer avec la page en ligne.
