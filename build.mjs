// Génère le site statique (dist/) à partir de content/*.json.
// Aucune dépendance : `node build.mjs`.
//
// Variables d'environnement :
//   SITE_URL         URL canonique (défaut : siteUrl de content/site.json)
//   VMM_ALLOW_INDEX  "true" seulement pour la mise en ligne sur videosmakemoney.ca.
//                    Sinon, le site est servi en noindex (démo Netlify).

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'dist');
const readJson = (f) => JSON.parse(readFileSync(join(ROOT, 'content', f), 'utf8'));

const site = readJson('site.json');
const portfolio = readJson('portfolio.json');
const clips = readJson('clips.json');
const langs = { fr: readJson('fr.json'), en: readJson('en.json') };
// Pages locales (zones desservies) : content/zones.json. Texte provisoire, JD réécrira.
const zonesData = readJson('zones.json');
const ZONES = zonesData.zones;
const zoneRoute = (z) => ({ fr: z.fr.route, en: z.en.route });
const SITE_URL = (process.env.SITE_URL || site.siteUrl).replace(/\/$/, '');
// Indexation : seulement en contexte production Netlify (CONTEXT est fourni par Netlify ; absent en local).
// Les deploy previews et branch deploys restent toujours en noindex, même si VMM_ALLOW_INDEX traîne dans l'interface.
const CONTEXT = process.env.CONTEXT || '';
const ALLOW_INDEX = process.env.VMM_ALLOW_INDEX === 'true' && (!CONTEXT || CONTEXT === 'production');
// Téléphone de JD (site.telephone, format +1-514-604-5682) : lien tel: et affichage 514-604-5682
const TEL = site.telephone
  ? { href: `tel:${site.telephone.replace(/[^\d+]/g, '')}`, affiche: site.telephone.replace(/^\+1-?/, '') }
  : null;
const BUILD_ID = Date.now().toString(36);

// Chemins des pages, par langue. La clé relie les versions FR et EN (hreflang, bascule).
const ROUTES = {
  accueil: { fr: '/', en: '/en/' },
  services: { fr: '/services/', en: '/en/services/' },
  portfolio: { fr: '/portfolio/', en: '/en/portfolio/' },
  apropos: { fr: '/about/', en: '/en/about/' },
  contact: { fr: '/contact/', en: '/en/contact/' },
  merci: { fr: '/merci/', en: '/en/thanks/' },
};
const INDEXABLE = ['accueil', 'services', 'portfolio', 'apropos', 'contact'];

// Une page par client qui a au moins une vidéo (portfolio.json). Ajouter un client = modifier seulement ce fichier.
const clientSlug = (c) => c.slug || slug(c.nom);
const clientVideos = (c) => portfolio.videos.filter((v) => v.type !== 'coulisses' && v.client === c.nom);
const CLIENTS = portfolio.clients.filter((c) => clientVideos(c).length);
// Page de la collection Coulisses (portfolio.json → coulissesCollection)
const COUL = portfolio.coulissesCollection || { slug: { fr: 'coulisses', en: 'behind-the-scenes' }, clip: '', photo: 'coulisses-01' };
const coulissesVideos = () => portfolio.videos.filter((v) => v.type === 'coulisses');
// Vidéos affichées dans les bibliothèques et comptées (« 01 / N », « N vidéos ») : seulement celles qui ont un ID YouTube.
// Les autres restent dans portfolio.json et réapparaissent dès qu'un ID est ajouté (Natasha, 2026-11-12).
const visibleVideos = (list) => list.filter((v) => v.youtubeId);
const coulissesRoute = { fr: `${ROUTES.portfolio.fr}${COUL.slug.fr}/`, en: `${ROUTES.portfolio.en}${COUL.slug.en}/` };
const clientRoute = (c) => ({ fr: `${ROUTES.portfolio.fr}${clientSlug(c)}/`, en: `${ROUTES.portfolio.en}${clientSlug(c)}/` });

// Logo 3D animé de l'en-tête (fichiers dans static/logo/). width/height = dimensions réelles de la vidéo.
// Caméra qui se démonte (page Services, fichiers dans static/videos/). width/height = dimensions réelles.
// scroll : suit le défilement sur ordi (0 % = assemblée, 100 % = démontée) ; loop : boucle pour mobile et animations réduites.
const CAMERA = {
  scroll: { webm: '/videos/vmm-camera-scroll.webm', mp4: '/videos/vmm-camera-scroll.mp4' },
  loop: { webm: '/videos/vmm-camera-explode.webm', mp4: '/videos/vmm-camera-explode.mp4' },
  poster: '/videos/vmm-camera-poster.jpg', // première image : caméra assemblée
  width: 1280,
  height: 720,
};

// Logo de face (image tirée de la vidéo vmm-logo-spin, recadrée, fond noir rendu transparent) :
// la rotation se fait en CSS. Le revers montre la même face, pour que VMM se lise toujours à l'endroit.
// Les fichiers vmm-logo-spin.* restent dans static/logo/.
// Version 240 px de large (affichée à 52 px de haut, nette jusqu'à 3x) : 18 Ko au lieu de 46 Ko. L'original 444 px reste dans static/logo/.
// Version 164 px (affichée à environ 82 px de large, soit 2x) : 12 Ko en WebP. Les versions 240 px et 444 px restent dans static/logo/.
const LOGO = {
  src: '/logo/vmm-logo-face-164.webp',
  png: '/logo/vmm-logo-face-164.png',
  width: 164,
  height: 104,
};

// Clips de fond de JD (content/clips.json) : <nom>.mp4, <nom>.webm, <nom>-poster.jpg dans static/videos/jd/.
// Poster en WebP allégé (720 px de large pour le 9:16) quand il existe à côté du .jpg, qui reste le repli.
const webpOf = (url) => (url && existsSync(join(ROOT, 'static', url.replace(/\.jpe?g$/, '.webp'))) ? url.replace(/\.jpe?g$/, '.webp') : url);
// Poster AVIF (le plus léger, ≤ 40 Ko) quand il existe à côté du .jpg
const avifOf = (url) => (url && existsSync(join(ROOT, 'static', url.replace(/\.jpe?g$/, '.avif'))) ? url.replace(/\.jpe?g$/, '.avif') : '');
// <picture> d'un poster : AVIF puis WebP, version mobile sous 768 px et version ordi au-dessus, .jpg en repli.
// Le navigateur ne télécharge qu'une seule image.
function posterPicture(mobileJpg, ordiJpg, cls) {
  const src = (jpg, media) => [
    avifOf(jpg) && `<source type="image/avif" srcset="${avifOf(jpg)}" media="${media}">`,
    webpOf(jpg) !== jpg && `<source type="image/webp" srcset="${webpOf(jpg)}" media="${media}">`,
  ].filter(Boolean).join('');
  const size = jpegSize(ordiJpg) || { width: 1920, height: 1080 };
  return `<picture class="${cls}">${src(mobileJpg, '(max-width: 767px)')}${src(ordiJpg, '(min-width: 768px)')}<img src="${ordiJpg}" alt="" width="${size.width}" height="${size.height}" decoding="async" fetchpriority="high"></picture>`;
}
// Préchargement de la même image que la <picture> (AVIF si présent, sinon WebP)
function picturePreload(mobileJpg, ordiJpg) {
  const best = (jpg) => (avifOf(jpg) ? [avifOf(jpg), 'image/avif'] : [webpOf(jpg), webpOf(jpg) !== jpg ? 'image/webp' : 'image/jpeg']);
  const link = (jpg, media) => { const [href, type] = best(jpg); return `<link rel="preload" as="image" href="${href}" type="${type}"${media ? ` media="${media}"` : ''} fetchpriority="high">`; };
  return mobileJpg === ordiJpg ? link(ordiJpg, '') : `${link(mobileJpg, '(max-width: 767px)')}\n${link(ordiJpg, '(min-width: 768px)')}`;
}
const clipFiles = (name) => (name ? { mp4: `${clips.dossier}${name}.mp4`, webm: `${clips.dossier}${name}.webm`, poster: webpOf(`${clips.dossier}${name}-poster.jpg`), posterJpg: `${clips.dossier}${name}-poster.jpg` } : null);

// Vidéo de fond muette en boucle. main.js ne charge que la version de l'appareil (mobile ou ordi), et seulement
// quand la section approche ; avec « réduire les animations », le poster reste seul. Sans version ordi,
// le clip 9:16 est centré, sans être coupé, sur la même vidéo agrandie et floue (data-portrait-ordi) ;
// avec « réduire les animations », ce fond est le poster flou.
function bgVideo(id) {
  const clip = clips.clips[id];
  if (!clip) return '';
  const mobile = clipFiles(clip.mobile);
  const ordi = clipFiles(clip.ordi);
  const desk = ordi || mobile;
  const focal = clip.focal ? ` style="--focal-mobile: ${esc(clip.focal.mobile || '50% 50%')}; --focal-ordi: ${esc(clip.focal.ordi || '50% 50%')}"` : '';
  return `<div class="bg-video" data-bg-video data-clip="${id}"${ordi ? '' : ' data-portrait-ordi'}${focal} aria-hidden="true"
    data-mobile-mp4="${mobile.mp4}" data-mobile-webm="${mobile.webm}" data-mobile-poster="${mobile.poster}"
    data-ordi-mp4="${desk.mp4}" data-ordi-webm="${desk.webm}" data-ordi-poster="${desk.poster}">
    ${ordi ? posterPicture(mobile.posterJpg, ordi.posterJpg, 'bg-video-poster') : `<video class="bg-video-blur" muted loop playsinline preload="none" poster="${desk.poster}"></video>`}
    <video class="bg-video-media" muted loop playsinline preload="none"${ordi ? '' : ` poster="${mobile.poster}"`}></video>
    <span class="bg-video-veil"></span>
  </div>`;
}

// Avec une version ordi, le poster est une <picture> (une seule image par appareil, affichée sans attendre le JavaScript).
// Préchargement du poster d'un bandeau (image LCP) : une seule image par appareil, choisie par media query.
// Avec une version ordi, le poster n'est plus dans le HTML de la vidéo (main.js le pose selon l'appareil) :
// l'ordi ne télécharge donc plus le poster mobile en plus du sien.
function posterPreload(id) {
  const clip = clips.clips[id];
  if (!clip) return '';
  // Sans version ordi, le poster est l'attribut poster de la vidéo (WebP) : c'est lui qu'on précharge
  if (!clip.ordi) return `<link rel="preload" as="image" href="${clipFiles(clip.mobile).poster}" fetchpriority="high">`;
  return picturePreload(clipFiles(clip.mobile).posterJpg, clipFiles(clip.ordi).posterJpg);
}

// Image de partage (Open Graph / Twitter), 1200 × 630, tirée des posters existants (static/og/).
const OG = { accueil: '/og/og-accueil.jpg', services: '/og/og-services.jpg', apropos: '/og/og-apropos.jpg', portfolio: '/og/og-accueil.jpg', contact: '/og/og-accueil.jpg', defaut: '/og/og-accueil.jpg' };
const ogFor = (key, page) => page?.og || OG[key] || OG.defaut;

// Phrase d'intro courte et factuelle (seo.<page>.resume), facile à citer par Google et les IA.
const summary = (text, cls = '') => (text ? `<p class="page-summary${cls ? ` ${cls}` : ''}" data-reveal>${t(text)}</p>` : '');
// Description SEO dans le héros des pages autres que l'accueil (JD, 2026-11-12) : seulement si la langue a heroResume
// (fr.json) ; sinon la bande sous le héros reste comme avant (pages anglaises inchangées).
const heroResume = (L, key) => (L.heroResume ? (L.heroResume.source === 'services' ? L.seo.services.resume : L.seo[key].resume) : '');
const summaryBand = (text) => (text ? `<div class="summary-band"><div class="container">${summary(text)}</div></div>` : '');

// Dimensions réelles d'un JPEG de static/ (width/height des images, sans dépendance)
function jpegSize(url) {
  const file = join(ROOT, 'static', url);
  if (!existsSync(file)) return null;
  const b = readFileSync(file);
  for (let i = 2; i < b.length; ) {
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

// Mot-clé + ville (seo.<page>.h1) : petit sous-titre gris visible sous le titre, à l'intérieur du H1.
// Le grand titre garde son style.
// Sous-titre SEO dans le H1 : retiré de l'affichage à la demande de JD (2026-11-05), car répétitif.
// Les mots-clés restent dans title, meta description, JSON-LD et hreflang ; seo.<page>.h1 reste dans les JSON.
const h1Seo = () => '';

// Feuille de style en ligne dans chaque page (≈ 10 Ko compressée) : aucune requête ne bloque le premier affichage.
// src/styles.css reste la source (et est toujours copiée dans dist/).
// Ajustements JD du 15 nov. : chaque partie (A à E) garde ses règles dans src/parts/*.css, ajoutées après styles.css
// (ordre alphabétique) ; même principe pour src/parts/*.js, ajoutés à la fin de main.js dans dist/.
const PARTS_DIR = join(ROOT, 'src', 'parts');
const partFiles = (ext) => (existsSync(PARTS_DIR) ? readdirSync(PARTS_DIR).filter((f) => f.endsWith(ext)).sort() : []);
const CSS_SOURCE = [readFileSync(join(ROOT, 'src', 'styles.css'), 'utf8'), ...partFiles('.css').map((f) => readFileSync(join(PARTS_DIR, f), 'utf8'))].join('\n');
const CSS = CSS_SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{};,>])\s*/g, '$1')
  .replace(/;}/g, '}')
  .replace(/<\//g, '<\\/')
  .trim();

// ---------- utilitaires ----------
const PLACEHOLDER = /\[(?:À CONFIRMER|TO CONFIRM)[^\]]*\]/g;
const isPlaceholder = (s) => !s || /\[(?:À CONFIRMER|TO CONFIRM)/.test(s);
const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Texte affiché : échappé, et les placeholders sont rendus bien visibles.
// Les placeholders [À CONFIRMER …] restent dans content/*.json (pour suivi) mais ne sont jamais publiés dans le HTML.
const t = (s = '') => esc(s).replace(/\s*\[(?:À CONFIRMER|TO CONFIRM)[^\]]*\]/g, '');
const note = (s) => (s ? ` ${t(s)}` : '');
// Titres des pages Services et À propos : *mot* = mot en violet, retour à la ligne = <br>
const rich = (s = '') => t(s).replace(/\*([^*]+)\*/g, '<span class="accent">$1</span>').replace(/\n/g, '<br>');
// Drapeaux de content/site.json (contenu en attente de JD) : un élément avec « drapeau » n'apparaît que si son drapeau est true
const shown = (x) => !x?.drapeau || site.drapeaux?.[x.drapeau] === true;
// Image .webp + repli .jpg/.png (chemin sans extension, fichiers dans static/img/)
const picture = (src, alt, { w, h, cls = '', fallback = 'jpg', lazy = true } = {}) =>
  `<picture${cls ? ` class="${cls}"` : ''}><source srcset="${src}.webp" type="image/webp"><img src="${src}.${fallback}" alt="${esc(alt)}" width="${w}" height="${h}"${lazy ? ' loading="lazy"' : ''} decoding="async"></picture>`;
const abs = (p) => SITE_URL + p;
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

// Titres : un mot composé (bandes-annonces, post-production) ne se coupe pas au trait d'union
const keepCompounds = (html) => html.replace(/<(h[1-3])\b[^>]*>[\s\S]*?<\/\1>/g, (h) =>
  h.replace(/>([^<]+)</g, (m, text) => '>' + text.replace(/[^\s-]+(?:-[^\s-]+)+/g, (w) => `<span class="nowrap">${w}</span>`) + '<'));

// h1 et h2 : texte blanc, dernier mot en dégradé violet (<span class="accent">), posé au build pour éviter un flash.
// Les placeholders [À CONFIRMER] (.tbc) sont ignorés ; un mot composé garde son <span class="nowrap">.
// Titre qui place lui-même ses mots violets (*mot* dans content/*.json) ou marqué data-no-accent : laissé tel quel.
const accentLast = (html) => html.replace(/<(h[12])\b([^>]*)>([\s\S]*?)<\/\1>/g, (all, tag, attrs, inner) => {
  if (/data-no-accent/.test(attrs) || /class="accent"/.test(inner)) return all;
  const parts = inner.split(/(<[^>]+>)/);
  const skip = new Array(parts.length).fill(false);
  for (let i = 0, depth = 0, inTbc = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith('<')) {
      if (/^<span\b/.test(p)) { depth++; if (inTbc || /class="(?:tbc|visually-hidden|h1-sub)"/.test(p)) inTbc++; }
      else if (/^<\/span>/.test(p)) { depth--; if (inTbc) inTbc--; }
      skip[i] = true;
    } else skip[i] = inTbc > 0;
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    if (skip[i] || !/\S/.test(parts[i])) continue;
    parts[i] = parts[i].replace(/(\S+(?:\s+[!?:;»]+)?)(\s*)$/, '<span class="accent">$1</span>$2'); // « Merci ! » : le point d'exclamation suit son mot
    break;
  }
  return `<${tag}${attrs}>${parts.join('')}</${tag}>`;
});

function write(path, content) {
  const file = join(OUT, path.endsWith('/') ? path + 'index.html' : path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, /\.html$/.test(file) ? accentLast(keepCompounds(content)) : content);
}

// ---------- vidéos ----------
const ytThumb = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
const ytEmbed = (id) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
const ytUrl = (v) => (v.vertical ? `https://www.youtube.com/shorts/${v.youtubeId}` : `https://www.youtube.com/watch?v=${v.youtubeId}`);

// Numéro de chaque vidéo dans son groupe (client ou coulisses), pour nommer celles sans titre.
const groupKey = (v) => (v.type === 'coulisses' ? '_coulisses' : v.client);
{
  const counts = {};
  for (const v of portfolio.videos) v.rang = counts[groupKey(v)] = (counts[groupKey(v)] || 0) + 1;
}
const groupName = (v, lang) => (v.type === 'coulisses' ? (lang === 'fr' ? 'Coulisses' : 'Behind the scenes') : v.client);
// Nom utilisé pour Google et les lecteurs d'écran ; à l'écran, un titre manquant reste un placeholder.
const videoName = (v, lang) => (v.titre ? v.titre : `${groupName(v, lang)} ${v.rang}`);
// Vedette de la catégorie qui a un ID YouTube, sinon videoAccueil, sinon la vedette sans ID (placeholder).
const categoryVideo = (cat) =>
  portfolio.videos.find((v) => v.vedette && v.categorie === cat.id && v.youtubeId) ||
  (cat.videoAccueil && (portfolio.videos.find((v) => v.youtubeId === cat.videoAccueil) || { youtubeId: cat.videoAccueil, vertical: true, titre: '', client: '', rang: 1 })) ||
  portfolio.videos.find((v) => v.vedette && v.categorie === cat.id) ||
  null;
const featured = () => portfolio.videos.filter((v) => v.vedette);

// Une vidéo n'entre dans le JSON-LD et le sitemap vidéo qu'avec sa vraie date de mise en ligne (dateMiseEnLigne
// dans portfolio.json, format AAAA-MM-JJ) : Google exige uploadDate. Les autres restent en réserve, prêtes à sortir
// dès que la date est remplie.
const videoReady = (v) => Boolean(v?.youtubeId && v.dateMiseEnLigne);

// pageUrl : la page où la vidéo est montrée ; l'@id de la vidéo est cette URL suivie de #video-<ID YouTube>.
function videoObject(v, lang, pageUrl) {
  const name = videoName(v, lang);
  return {
    '@type': 'VideoObject',
    '@id': `${pageUrl}#video-${v.youtubeId}`,
    name: `${name} | VMM Productions`,
    description: v.client
      ? lang === 'fr' ? `Vidéo réalisée par VMM Productions pour ${v.client}.` : `Video produced by VMM Productions for ${v.client}.`
      : lang === 'fr' ? 'Coulisses de tournage de VMM Productions.' : 'Behind the scenes of a VMM Productions shoot.',
    thumbnailUrl: ytThumb(v.youtubeId),
    embedUrl: ytEmbed(v.youtubeId),
    url: ytUrl(v),
    ...(v.fichier ? { contentUrl: abs(v.fichier) } : {}), // fichier vidéo hébergé sur le site, s'il existe un jour
    ...(v.dateMiseEnLigne ? { uploadDate: v.dateMiseEnLigne } : {}),
    ...(v.langue ? { inLanguage: v.langue === 'en' ? 'en-CA' : 'fr-CA' } : {}),
    publisher: { '@id': `${SITE_URL}/#entreprise` },
  };
}

// ---------- JSON-LD ----------
// Valeur { fr, en } → valeur de la langue (récursif), pour les zones de content/zones.json
const localize = (v, lang) =>
  Array.isArray(v) ? v.map((x) => localize(x, lang))
  : v && typeof v === 'object' ? ('fr' in v && 'en' in v && Object.keys(v).length === 2 ? v[lang] : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, localize(x, lang)])))
  : v;
function structuredData(key, lang, pageVideos = [], page = null) {
  const L = langs[lang];
  const biz = `${SITE_URL}/#entreprise`;
  const persons = L.equipe.membres.map((m) => {
    const found = L.apropos.membres.find((b) => b.id === m.id);
    const bio = found && { ...found, texte: found.texte || (found.paragraphes || []).join(' ') };
    return {
      '@type': 'Person',
      '@id': `${SITE_URL}/#${m.id}`,
      name: m.nomComplet || m.nom,
      ...(m.nomComplet && m.nomComplet !== m.nom ? { alternateName: m.nom } : {}),
      jobTitle: m.role,
      worksFor: { '@id': biz },
      ...(bio && !isPlaceholder(bio.note || bio.noteInterne) ? { description: bio.texte } : m.experience ? { description: m.experience } : {}),
      ...(m.photo ? { image: abs(m.photo) } : bio?.photo ? { image: abs(`${bio.photo}.jpg`) } : {}),
    };
  });
  const a = site.adresse;
  const business = {
    '@type': 'ProfessionalService', // sous-type de LocalBusiness ; aucune adresse de rue (confirmé par JD), seulement région et pays
    '@id': biz,
    name: site.nom,
    legalName: site.nomLegal,
    alternateName: site.marque,
    slogan: L.hero.sousTitre,
    description: L.mission,
    url: SITE_URL + '/',
    // Logo carré de JD (content/site.json → logoCarre), sinon le logo de face de l'en-tête
    logo: site.logoCarre?.png512 && existsSync(join(ROOT, 'static', site.logoCarre.png512)) ? abs(site.logoCarre.png512) : abs(LOGO.png.replace(/\?.*$/, '')),
    image: abs(OG.defaut),
    email: site.courriel,
    ...(site.telephone ? { telephone: site.telephone } : {}),
    // Pas de rue, de ville ni de code postal : seulement la région et le pays.
    address: { '@type': 'PostalAddress', addressRegion: a.region, addressCountry: a.pays },
    // Zone principale : 50 km autour de Sainte-Thérèse (centre de la ville, pas une adresse) ; « Québec » reste la zone élargie
    areaServed: [
      {
        '@type': 'GeoCircle',
        name: `${site.zoneBase.ville}, ${site.zoneBase.region} (${site.zoneBase.rayonKm} km)`,
        geoMidpoint: { '@type': 'GeoCoordinates', latitude: site.zoneBase.latitude, longitude: site.zoneBase.longitude },
        geoRadius: site.zoneBase.rayonKm * 1000,
      },
      { '@type': 'AdministrativeArea', name: site.zoneJsonLd },
    ],
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: site.heures.jours.map((d) => `https://schema.org/${d}`),
      opens: site.heures.ouverture,
      closes: site.heures.fermeture,
    },
    foundingDate: site.dateFondation,
    knowsAbout: L.services.items.filter(shown).map((s) => s.titre),
    knowsLanguage: ['fr-CA', 'en-CA'],
    founder: { '@id': `${SITE_URL}/#jd` },
    employee: persons.map((p) => ({ '@id': p['@id'] })),
    // Fiche Google Business (JD, 2026-11-14, C12) : forme durable du lien share.google, version française seulement
    sameAs: [...site.reseaux.map((r) => r.url), ...(lang === 'fr' && site.google?.sameAs ? [site.google.sameAs] : [])],
  };
  const seo = page?.seo || L.seo[key];
  const pageUrl = abs((page?.route || ROUTES[key])[lang]);
  const crumbs = [{ name: L.nav.accueil, url: abs(ROUTES.accueil[lang]) }];
  if (key !== 'accueil' && ROUTES[key]) crumbs.push({ name: L.nav[key] || L[key]?.titre || '', url: abs(ROUTES[key][lang]) });
  if (page?.crumb) crumbs.push({ name: page.crumb, url: pageUrl });
  const graph = [
    business,
    ...persons,
    { '@type': 'WebSite', '@id': `${SITE_URL}/#site`, url: SITE_URL + '/', name: site.nom, inLanguage: ['fr-CA', 'en-CA'], publisher: { '@id': biz } },
    {
      '@type': key === 'contact' ? 'ContactPage' : key === 'apropos' ? 'AboutPage' : 'WebPage',
      '@id': pageUrl + '#page',
      url: pageUrl,
      name: seo.title,
      description: seo.description,
      inLanguage: L.lang,
      isPartOf: { '@id': `${SITE_URL}/#site` },
      about: { '@id': biz },
      ...(page?.client ? { mentions: { '@type': 'Organization', name: page.client.nom, ...(page.client.url ? { url: page.client.url, sameAs: page.client.url } : {}) } } : {}),
      ...(crumbs.length > 1 ? { breadcrumb: { '@id': pageUrl + '#fil' } } : {}),
    },
    // Fil d'Ariane : seulement à partir de deux niveaux (pas sur l'accueil)
    ...(crumbs.length > 1
      ? [{
          '@type': 'BreadcrumbList',
          '@id': pageUrl + '#fil',
          itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
        }]
      : []),
    ...[...new Map(pageVideos.filter(videoReady).map((v) => [v.youtubeId, v])).values()].map((v) => ({ ...videoObject(v, lang, pageUrl), isPartOf: { '@id': pageUrl + '#page' } })),
  ];
  // Page Services : un Service par carte affichée, sans prix
  if (key === 'services') {
    for (const [i, s] of L.services.items.entries()) {
      if (!shown(s)) continue;
      graph.push({
        '@type': 'Service',
        '@id': `${pageUrl}#service-${i + 1}`,
        name: s.titre,
        serviceType: s.titre,
        description: s.texte,
        provider: { '@id': biz },
        areaServed: business.areaServed,
        url: pageUrl,
      });
    }
  }
  // Page locale : un Service (fourni par l'entreprise, même @id) limité à la ville ou à la région, et sa FAQ
  if (key === 'zone' && page?.zone) {
    const z = page.zone;
    const Z = z[lang];
    graph.push({
      '@type': 'Service',
      '@id': pageUrl + '#service',
      name: Z.h1,
      serviceType: lang === 'fr' ? 'Production vidéo' : 'Video production',
      description: Z.intro,
      provider: { '@id': biz },
      areaServed: localize(z.areaServed, lang),
      url: pageUrl,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: L.zones.servicesTitre,
        itemListElement: L.services.items.filter(shown).map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.titre, description: s.texte, provider: { '@id': biz } } })),
      },
    });
    graph.push({
      '@type': 'FAQPage',
      '@id': pageUrl + '#faq',
      inLanguage: L.lang,
      mainEntity: Z.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.r } })),
    });
  }
  if (key === 'contact') {
    const faq = L.faq.items.filter((f) => !isPlaceholder(f.r) && !f.note); // réponse signalée (note) : pas dans les données structurées
    if (faq.length) {
      graph.push({
        '@type': 'FAQPage',
        '@id': pageUrl + '#faq',
        inLanguage: L.lang,
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.r } })),
      });
    }
  }
  return jsonLd({ '@context': 'https://schema.org', '@graph': graph });
}

// ---------- gabarit commun ----------
// Pied de page (FR et EN) : nom commercial suivi du nom légal.
const FOOTER_NAME = `${site.nom} (${site.nomLegal})`;
// page : pour une page sans clé propre (page client) : { route, seo, crumb }.
// endBand : bande placée avec le pied de page dans le dernier écran (accueil FR).
function layout({ key, lang, body, videos = [], page = null, preload = '', endBand = '' }) {
  if (preload) preload += '\n';
  // Pages FR : le pied de page (et la bande de fin de l'accueil) forment le dernier écran sur mobile (.end-screen,
  // neutre sur ordi). Les pages EN gardent leur HTML tel quel.
  const endScreen = lang === 'fr';
  const L = langs[lang];
  const other = lang === 'fr' ? 'en' : 'fr';
  const routed = Boolean(page?.route || ROUTES[key]);
  const route = page?.route || ROUTES[key] || ROUTES.accueil;
  const seo = page?.seo || L.seo[key];
  const hasData = INDEXABLE.includes(key) || key === 'zone';
  const indexable = hasData && ALLOW_INDEX; // pages locales : indexables au lancement seulement, comme les autres
  const navLink = (k) => `<li><a href="${ROUTES[k][lang]}"${k === key ? ' aria-current="page"' : ''}>${esc(L.nav[k])}</a></li>`;
  const ogImage = abs(ogFor(key, page));
  const ogAlt = `${site.nom} · ${L.hero.sousTitre}`;

  return `<!doctype html>
<html lang="${L.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(seo.title)}</title>
<meta name="description" content="${esc(seo.description)}">
${indexable ? '' : '<meta name="robots" content="noindex, nofollow">\n'}${
    routed
      ? `<link rel="canonical" href="${abs(route[lang])}">
<link rel="alternate" hreflang="fr-CA" href="${abs(route.fr)}">
<link rel="alternate" hreflang="en-CA" href="${abs(route.en)}">
<link rel="alternate" hreflang="x-default" href="${abs(route.fr)}">
`
      : ''
  }<meta name="theme-color" content="#0d0917">
<meta name="geo.region" content="CA-QC">
<meta name="geo.placename" content="Montréal">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.nom)}">
<meta property="og:locale" content="${lang === 'fr' ? 'fr_CA' : 'en_CA'}">
<meta property="og:locale:alternate" content="${lang === 'fr' ? 'en_CA' : 'fr_CA'}">
<meta property="og:title" content="${esc(seo.title)}">
<meta property="og:description" content="${esc(seo.description)}">
${routed ? `<meta property="og:url" content="${abs(route[lang])}">\n` : ''}<meta property="og:image" content="${ogImage}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(ogAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(seo.title)}">
<meta name="twitter:description" content="${esc(seo.description)}">
<meta name="twitter:image" content="${ogImage}">
<meta name="twitter:image:alt" content="${esc(ogAlt)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script>document.documentElement.classList.add('js')</script>
${preload}<link rel="preload" href="/fonts/syne-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<style>${CSS}</style>
${hasData ? structuredData(key, lang, videos, page) : ''}
</head>
<body class="page-${key}">
<a class="skip" href="#contenu">${esc(L.nav.allerAuContenu)}</a>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <filter id="bloom" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
    <feColorMatrix in="blur" type="saturate" values="1.6" result="glow"/>
    <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</svg>
${L.avisTraduction && !isPlaceholder(L.avisTraduction) ? `<div class="notice">${t(L.avisTraduction)}</div>` : ''}
<header class="site-header">
  <div class="container header-inner">
    <a class="logo logo-video" href="${ROUTES.accueil[lang]}" aria-label="${esc(site.nom)}, ${esc(L.nav.accueil)}">
      <span class="logo-spin">
        <picture class="logo-face"><source srcset="${LOGO.src}" type="image/webp"><img src="${LOGO.png}" alt="${esc(site.nom)}" width="${LOGO.width}" height="${LOGO.height}"></picture>
        <picture class="logo-face logo-back"><source srcset="${LOGO.src}" type="image/webp"><img src="${LOGO.png}" alt="" aria-hidden="true" width="${LOGO.width}" height="${LOGO.height}"></picture>
      </span>
    </a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu" data-open="${esc(L.nav.menu)}" data-close="${esc(L.nav.fermer)}">${esc(L.nav.menu)}</button>
    <nav id="menu" class="site-nav" aria-label="Navigation">
      <ul>
        ${['accueil', 'services', 'portfolio', 'apropos', 'contact'].map(navLink).join('\n        ')}
        <li><a class="lang-switch" href="${route[other]}" hreflang="${langs[other].lang}" lang="${langs[other].lang}" aria-label="${esc(L.nav.autreLangue)} — ${esc(L.nav.autreLangueNom)}">${esc(L.nav.autreLangue)}</a></li>
        <li class="nav-cta"><a class="btn-header-cta" href="${ROUTES.contact[lang]}">${esc(L.nav.rdv)}</a></li>
      </ul>
    </nav>
  </div>
</header>
<main id="contenu">
${body}
</main>
${endScreen ? `<div class="end-screen">\n${endBand ? `${endBand}\n` : ''}` : ''}<footer class="site-footer">
  <div class="container footer-inner">
    <div>
      <a class="footer-logo" href="${ROUTES.accueil[lang]}">${picture('/img/logo-pied-de-page', site.nom, { w: 112, h: 72, fallback: 'png' })}</a>
      ${t(L.pied.slogan) ? `<p class="muted">${t(L.pied.slogan)}</p>` : ''}
      <p class="muted">${esc(FOOTER_NAME)}</p>
      <p><a href="mailto:${site.courriel}">${esc(site.courriel)}</a></p>
      ${TEL ? `<p><a href="${TEL.href}">${esc(TEL.affiche)}</a></p>` : ''}
    </div>
    <div>
      <p class="label">${esc(L.contact.suivre)}</p>
      ${socials({ icons: true, iconsOnly: true, suffix: `pied-${lang}`, lang })}
    </div>
    <nav aria-label="${esc(L.pied.zones)}">
      <p class="label">${esc(L.pied.zones)}</p>
      <ul class="socials footer-zones">
        ${footerZones(L, lang, page)}
      </ul>
    </nav>
  </div>
  <p class="container muted small">© ${esc(FOOTER_NAME)}. ${esc(L.pied.droits)}</p>
</footer>${endScreen ? '\n</div>' : ''}
<dialog class="lightbox" aria-label="${esc(L.lightbox.titre)}">
  <button class="lightbox-close" type="button" aria-label="${esc(L.lightbox.fermer)}">×</button>
  <div class="lightbox-frame"></div>
  <p class="lightbox-missing" hidden>${t(L.lightbox.manquante)}</p>
</dialog>
${/* GSAP, ScrollTrigger et Lenis (src/vendor/) sont chargés par main.js après l'affichage de la page (commentaire gardé hors du HTML publié) */ ''}<script src="/main.js?v=${BUILD_ID}" defer></script>
</body>
</html>
`;
}

// Icônes officielles des réseaux (Simple Icons, CC0), en ligne. Blanches ; dégradé du site au survol.
const SOCIAL_ICON_FILE = { Instagram: 'instagram', TikTok: 'tiktok', YouTube: 'youtube', Facebook: 'facebook', X: 'x', Google: 'google' };
function socialIcon(nom, suffix) {
  const file = SOCIAL_ICON_FILE[nom];
  if (!file) return '';
  const svg = readFileSync(join(ROOT, 'icons', 'simple-icons', `${file}.svg`), 'utf8');
  const d = svg.match(/<path d="([^"]+)"/)[1];
  const id = `si-${file}-${suffix}`;
  return `<svg class="social-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="0"><stop offset="0" stop-color="#7C3AED"/><stop offset=".45" stop-color="#3B5BFF"/><stop offset="1" stop-color="#FF3CAC"/></linearGradient></defs><path d="${d}" style="--icon-hover: url(#${id})"/></svg>`;
}

// iconsOnly (pied de page, JD 2026-11-10) : le logo seul, le nom reste lu par les lecteurs d'écran (aria-label)
// Icône Google (JD, courriel du 2026-11-14) : version française seulement (Contact et pied de page).
// site.google.url = lien de la fiche Google Business fourni par JD (2026-11-14). S'il est vide, l'icône est affichée
// mais non cliquable (aria-disabled), sans lien inventé.
const googleItem = ({ icons, iconsOnly, suffix }) => {
  const g = site.google;
  if (!g) return '';
  const inner = `${icons ? socialIcon(g.nom, suffix) : ''}${iconsOnly ? '' : esc(g.nom)}`;
  return g.url
    ? `<li><a href="${esc(g.url)}" target="_blank" rel="noopener" aria-label="${esc(g.nom)}">${inner}</a></li>`
    : `<li><a class="is-pending" role="link" aria-disabled="true"${iconsOnly ? ` aria-label="${esc(g.nom)}"` : ''}>${inner}</a></li>`;
};
const socials = ({ icons = false, iconsOnly = false, suffix = '', lang = '' } = {}) =>
  `<ul class="socials${iconsOnly ? ' icons-only' : ''}">
        ${site.reseaux.map((r) => `<li><a href="${esc(r.url)}" rel="me noopener" target="_blank"${iconsOnly ? ` aria-label="${esc(r.nom)}"` : ''}>${icons ? socialIcon(r.nom, suffix) : ''}${iconsOnly ? '' : esc(r.nom)}</a></li>`).join('\n        ')}${lang === 'fr' ? `\n        ${googleItem({ icons, iconsOnly, suffix })}` : ''}
      </ul>`;

// Zones desservies du pied de page : la liste exacte de JD (pied.zonesListe, capture du 2026-11-10).
// Une zone qui a déjà sa page (content/zones.json) garde son lien ; les autres sont du texte simple.
// Les pages locales absentes de la liste (Rive-Nord) restent en ligne et dans le sitemap.
function footerZones(L, lang, page) {
  const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const pageOf = (nom) => ZONES.find((z) => norm(z.fr.lien) === norm(nom) || norm(z.en.lien) === norm(nom));
  return (L.pied.zonesListe || [])
    .map((nom) => {
      const z = pageOf(nom);
      return z
        ? `<li><a href="${z[lang].route}"${page?.zone === z ? ' aria-current="page"' : ''}>${esc(nom)}</a></li>`
        : `<li><span>${esc(nom)}</span></li>`;
    })
    .join('\n        ');
}

const sectionHead = (label, title, intro, id, tag = 'h2', h1 = '') => `<p class="label" data-reveal>${esc(label)}</p>
    <${tag} id="${id}" data-reveal>${t(title)}${tag === 'h1' ? h1Seo(h1) : ''}</${tag}>
    ${intro ? `<p class="intro" data-reveal>${t(intro)}</p>` : ''}`;

const pageHead = (title, intro, clip = '', resume = '', h1 = '') => `<section class="page-hero${clip ? ` has-bg-video bg-clip-${clip}` : ''}">
  ${clip ? bgVideo(clip) : ''}
  <div class="container">
    <h1 data-reveal>${t(title)}${h1Seo(h1)}</h1>
    <p class="intro" data-reveal>${t(intro)}</p>
    ${summary(resume)}
  </div>
</section>`;

// Vignette vidéo : un lien YouTube sans JavaScript, une lightbox avec.
// img (facultatif) : visuel de JD (chemin sans extension, .webp + .jpg) à la place de la miniature YouTube ;
// sans ID YouTube, la vignette devient une image seule, non cliquable, sans icône de lecture.
function videoTile(v, lang, { shape = 'vertical', caption = true, missing, img = '', label = '' } = {}) {
  const L = langs[lang];
  const own = img && existsSync(join(ROOT, 'static', `${img}.webp`)) ? picture(img, '', { w: 460, h: 642 }) : '';
  const cap = () => `<span class="tile-caption">${v?.titre ? `<strong>${esc(v.titre)}</strong>` : label ? `<strong>${esc(label)}</strong>` : ''}${v?.client ? `<span class="muted">${esc(v.client)}</span>` : ''}</span>`;
  if (own && !v?.youtubeId) {
    return `<span class="tile tile-${shape} tile-static"><span class="thumb">${own}</span>${caption ? cap() : ''}</span>`;
  }
  if (!v || !v.youtubeId) {
    const name = v?.titre || '';
    return `<button type="button" class="tile tile-${shape}" data-video="" aria-label="${esc(L.lightbox.voir)}${name ? ` : ${esc(name)}` : ''}">
          <span class="thumb"><span class="thumb-empty" aria-hidden="true"></span><span class="play" aria-hidden="true">▶</span></span>
          ${caption ? `<span class="tile-caption">${name ? `<strong>${esc(name)}</strong>` : ''}${v?.client ? `<span class="muted">${esc(v.client)}</span>` : ''}${t(v?.note || missing || L.lightbox.manquante)}</span>` : ''}
        </button>`;
  }
  const name = videoName(v, lang);
  return `<a href="${ytUrl(v)}" target="_blank" rel="noopener" class="tile tile-${shape}" data-video="${esc(v.youtubeId)}" data-vertical="${v.vertical ? '1' : '0'}" aria-label="${esc(L.lightbox.voir)} : ${esc(name)}">
          <span class="thumb">${own || `<img src="${ytThumb(v.youtubeId)}" alt="" loading="lazy" decoding="async" width="480" height="360">`}<span class="play" aria-hidden="true">▶</span></span>
          ${
            caption
              ? `<span class="tile-caption">${v.titre ? `<strong>${esc(v.titre)}</strong>` : t(L.portfolio.titreManquant)}${v.client ? `<span class="muted">${esc(v.client)}</span>` : ''}${note(v.note)}</span>`
              : ''
          }
        </a>`;
}

// Vignette de catégorie de l'accueil (« Ce que nous créons ») : le visuel de JD (categories[].miniature), comme sur Portfolio.
// Avec un ID YouTube : vignette cliquable (lightbox). Sans ID : image seule, non cliquable, sans icône de lecture.
const hasMiniature = (c) => Boolean(c.miniature) && existsSync(join(ROOT, 'static', `${c.miniature}.webp`));
function categoryTile(c, v, lang) {
  if (!hasMiniature(c)) return videoTile(v, lang, { shape: 'category', caption: false });
  const img = picture(c.miniature, '', { w: 460, h: 642 });
  if (!v?.youtubeId) return `<span class="tile tile-category tile-static"><span class="thumb">${img}</span></span>`;
  const L = langs[lang];
  return `<a href="${ytUrl(v)}" target="_blank" rel="noopener" class="tile tile-category" data-video="${esc(v.youtubeId)}" data-vertical="${v.vertical ? '1' : '0'}" aria-label="${esc(L.lightbox.voir)} : ${esc(videoName(v, lang))}">
          <span class="thumb">${img}<span class="play" aria-hidden="true">▶</span></span>
        </a>`;
}

// ---------- composant Contact (accueil et page Contact) ----------
// Icônes de JD (PNG transparents, 2026-11-10) : décoratives, alt vide
const contactIcon = (name) => picture(`/img/icons/${name}`, '', { w: 24, h: 24, cls: 'contact-icon', fallback: 'png' });
function contactBlock(lang, { tag = 'h2', id = 'contact-title' } = {}) {
  const L = langs[lang];
  const c = L.contact.champs;
  const f = (n) => `${n}-${lang}-${tag}`;
  return `<div class="container contact-grid">
    <div class="contact-info">
      ${sectionHead(L.contact.etiquette, L.contact.titre, L.contact.texte, id, tag, L.seo.contact.h1)}
      ${tag === 'h1' ? summary(heroResume(L, 'contact') || L.seo.contact.resume) : ''}
      <dl class="contact-details" data-reveal>
        <div><dt class="label">${esc(L.contact.courrielLabel)}</dt><dd class="has-icon">${contactIcon('contact-courriel')}<a href="mailto:${site.courriel}">${esc(site.courriel)}</a></dd></div>
        ${tag === 'h1' && TEL ? `<div><dt class="label">${esc(L.contact.telephoneLabel)}</dt><dd><a href="${TEL.href}">${esc(TEL.affiche)}</a> <span class="muted">· ${esc(L.contact.heures)}</span></dd></div>` : ''}
        <div><dt class="label">${esc(L.contact.zoneLabel)}</dt><dd class="has-icon">${contactIcon('contact-localisation')}<span>${esc(L.contact.zone)}</span></dd></div>
      </dl>
      ${tag === 'h1' ? `<p class="muted small" data-reveal>${esc(L.contact.deplacement)}</p>` : ''}
      <div data-reveal>
        <p class="label">${esc(L.contact.suivre)}</p>
        ${socials({ icons: tag === 'h1', suffix: lang, lang: tag === 'h1' ? lang : '' })}
      </div>
    </div>
    <form class="contact-form card glass" name="contact" method="POST" action="${ROUTES.merci[lang]}" data-netlify="true" netlify-honeypot="bot-field" data-reveal
      data-sending="${esc(c.envoi)}" data-success="${esc(c.succes)}" data-error="${esc(c.erreur)}">
      <input type="hidden" name="form-name" value="contact">
      <input type="hidden" name="langue" value="${lang}">
      <p class="hp" aria-hidden="true"><label>Ne pas remplir <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
      <label for="${f('name')}">${esc(c.nom)}</label>
      <input id="${f('name')}" name="name" type="text" autocomplete="name" required>
      <label for="${f('email')}">${esc(c.courriel)}</label>
      <input id="${f('email')}" name="email" type="email" autocomplete="email" required>
      <label for="${f('company')}">${esc(c.entreprise)}</label>
      <input id="${f('company')}" name="company" type="text" autocomplete="organization">
      <label for="${f('budget')}">${esc(c.budget)}</label>
      <select id="${f('budget')}" name="budget">
        <option value="">${esc(c.budgetChoisir)}</option>
        ${site.budgets.filter((b) => !isPlaceholder(b)).map((b) => `<option>${esc(b)}</option>`).join('\n        ')}
      </select>
      
      <label for="${f('message')}">${esc(c.projet)}</label>
      <textarea id="${f('message')}" name="message" rows="5" required></textarea>
      <button class="btn btn-neon" type="submit">${esc(c.envoyer)}</button>
      <p class="form-status" role="status" aria-live="polite"></p>
    </form>
  </div>`;
}

// ---------- pages ----------
function homePage(lang) {
  const L = langs[lang];
  const hv = site.heroVideo;
  const vedettes = featured();
  // Vedettes (avec leur visuel de JD, videos[].miniature), puis, s'il en manque, les catégories dont le visuel
  // n'est pas déjà affiché. Une tuile sans ID YouTube est une image seule, non cliquable (JD, 2026-11-05).
  const slots = vedettes.map((v) => ({ v, img: v.miniature || '' }));
  for (const c of portfolio.categories) {
    if (slots.length >= L.realisations.vedettesMin) break;
    if (!c.miniature || slots.some((x) => x.img === c.miniature)) continue;
    const v = categoryVideo(c);
    slots.push({ v: v?.youtubeId ? v : null, img: c.miniature, label: c.titre[lang] });
  }
  while (slots.length < L.realisations.vedettesMin) slots.push({ v: null });
  const catVideos = portfolio.categories.map(categoryVideo);
  // Seuls les fichiers présents dans static/ sont appelés : un fichier manquant ne donne jamais de 404.
  const exists = (url) => Boolean(url) && existsSync(join(ROOT, 'static', url));
  const sources = [
    [hv.mobileWebm, 'video/webm', '(max-width: 767px)'],
    [hv.mobile, 'video/mp4', '(max-width: 767px)'],
    [hv.ordiWebm, 'video/webm', ''],
    [hv.ordi, 'video/mp4', ''],
  ].filter(([src]) => exists(src));
  const hasVideo = sources.length > 0;
  const poster = exists(hv.poster) ? hv.poster : '';
  // Poster ordinateur (16:9) quand il existera ; en attendant, le poster 9:16 sert partout
  const posterOrdi = exists(hv.posterOrdi) ? hv.posterOrdi : poster;
  const attenteOrdi = exists(hv.posterAttenteOrdi) ? hv.posterAttenteOrdi : '';
  const attenteMobile = exists(hv.posterAttenteMobile) ? hv.posterAttenteMobile : attenteOrdi;
  // Le poster (image LCP) s'affiche d'abord, sans JavaScript. La vidéo héro, quand elle existera, n'a aucune
  // source dans le HTML : main.js ajoute seulement celle de l'appareil (mobile ou ordi), après le chargement de la page.
  const heroPicture = poster ? posterPicture(poster, posterOrdi, 'hero-poster') : attenteOrdi ? posterPicture(attenteMobile, attenteOrdi, 'hero-poster') : '';
  const pick = (media) => sources.filter(([, , m]) => (media ? m : !m)).map(([src, type]) => ({ src, type }));
  const heroMedia = `${heroPicture}${
    hasVideo
      ? `
    <video class="hero-video" muted loop playsinline preload="none" data-hero-mobile='${esc(JSON.stringify(pick(true).length ? pick(true) : pick(false)))}' data-hero-ordi='${esc(JSON.stringify(pick(false).length ? pick(false) : pick(true)))}'></video>`
      : ''
  }`;
  // Préchargement de l'image du bandeau : une seule par appareil (ou le poster de la vidéo héro quand elle existera)
  const heroPreload = poster ? picturePreload(poster, posterOrdi) : attenteOrdi ? picturePreload(attenteMobile, attenteOrdi) : '';
  // Accueil selon le PDF « VMM-HomePage-LAYOUT-2026-11-05 » de JD (pages 1 à 5, la page 11 « AJUSTEMENTS VALIDÉS »
  // primant sur les pages 6 à 10) : 01 héros vidéo, 02 portfolio (4 miniatures), 03 équipe, 04 services, 05 contact.
  // Les anciennes sections (creons, equipe, realisations, avis) gardent leurs textes dans content/*.json.
  const A = L.accueilJD;
  const [tVideos, tMake, tMoney] = A.hero.titre;
  const svcItems = L.services.items;
  // Bloc Avis Google : affiché seulement avec un vrai widget (aucun titre seul, aucun avis inventé)
  const avis = site.avisGoogle.widgetHtml
    ? `
<section class="section" id="avis" aria-labelledby="avis-title">
  <div class="container">
    ${sectionHead(L.avis.etiquette, L.avis.titre, '', 'avis-title')}
    <div class="reviews" data-reveal>${site.avisGoogle.widgetHtml}</div>
  </div>
</section>`
    : '';
  const contactPhoto = A.contact.photo && existsSync(join(ROOT, 'static', `${A.contact.photo}.webp`));
  // Écran 4 (JD, 2026-11-10) : photo du studio ; l'ancien portrait détouré revient si la photo manque
  const studio = A.services.photoStudio && existsSync(join(ROOT, 'static', `${A.services.photoStudio}.webp`));
  // Titre animé (JD, courriel du 2026-11-14, C1-C2) : l'animation détourée remplace le titre visible ; le H1 reste
  // dans la page (masqué visuellement). Image fixe d'abord (sans JavaScript ni « réduire les animations ») ;
  // main.js ajoute la vidéo WebM avec transparence, ou l'image animée sur Safari (pas de WebM transparent).
  const TT = A.hero.titrage;
  const titrage = TT && exists(`${TT.poster}.webp`) ? TT : null;
  const titrageHtml = titrage
    ? `<div class="hero-titrage" aria-hidden="true"${exists(titrage.webm) ? ` data-webm="${titrage.webm}"` : ''}${exists(titrage.hevc) ? ` data-hevc="${titrage.hevc}"` : ''}${exists(titrage.anim) ? ` data-anim="${titrage.anim}"` : ''}>
      <picture class="hero-titrage-img"><source srcset="${titrage.poster}.webp" type="image/webp"><img src="${titrage.poster}.png" alt="" width="${titrage.largeur}" height="${titrage.hauteur}" decoding="async" fetchpriority="high"></picture>
    </div>`
    : '';
  const heroH1 = `<h1 id="hero-title" class="hero-title hero-title-jd${titrage ? ' visually-hidden' : ''}" data-no-accent${titrage ? '' : ' data-reveal'}><span class="ht-videos">${esc(tVideos)}</span> <span class="ht-make">${esc(tMake)}</span> <span class="ht-money">${esc(tMoney)}</span>${h1Seo(L.seo.accueil.h1)}</h1>`;
  const body = `
<section class="hero" aria-labelledby="hero-title">
  <div class="hero-media" aria-hidden="true">
    ${heroMedia}
    <div class="hero-vignette"></div>
  </div>
  <div class="container hero-content">
    ${titrageHtml}${titrageHtml ? '\n    ' : ''}${heroH1}
    <p class="hero-sub hero-signature" data-reveal>${rich(A.hero.signature)}</p>
    <p class="hero-text" data-reveal>${t(L.hero.texte)}</p>
    <p class="hero-ctas" data-reveal>
      <a class="btn btn-solid hero-cta" href="${ROUTES.contact[lang]}">${esc(A.hero.bouton)}</a>
      <a class="btn btn-ghost hero-cta-ghost" href="${ROUTES.portfolio[lang]}">${esc(A.hero.boutonTravail)}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a>
    </p>
    ${hasVideo && poster || isPlaceholder(L.hero.posterManquant) ? '' : `<p class="hero-missing small">${t(L.hero.posterManquant)}</p>`}
  </div>
  ${hasVideo ? `<button class="hero-toggle" type="button" aria-pressed="false" data-pause="${esc(L.hero.pause)}" data-play="${esc(L.hero.lecture)}" aria-label="${esc(L.hero.pause)}"><span aria-hidden="true">❚❚</span></button>` : ''}
</section>
${L.heroResume ? '' : summaryBand(L.seo.accueil.resume)}

<section class="jd-screen home-portfolio" id="portfolio-accueil" aria-labelledby="hp-portfolio-title">
  <div class="jd-wrap">
    <p class="jd-label jd-label-line" data-reveal>${esc(A.portfolio.etiquette)}</p>
    <h2 id="hp-portfolio-title" data-reveal data-no-accent>${rich(A.portfolio.titre)}</h2>
    <p class="jd-lead" data-reveal>${t(A.portfolio.intro)}</p>
    <ul class="hp-cards" role="list">
      ${portfolio.categories
        .map((c, i) => `<li data-reveal>${ytTile(catVideos[i], lang, { cls: 'hp-card', label: t(c.titre[lang]), img: c.miniature })}</li>`)
        .join('\n      ')}
    </ul>
    <p class="cta-row" data-reveal><a class="btn btn-solid" href="${ROUTES.portfolio[lang]}">${esc(A.portfolio.bouton)}</a></p>
  </div>
</section>

<section class="jd-screen home-team" id="equipe" aria-labelledby="equipe-title">
  <div class="jd-wrap home-split">
    <div class="home-split-text">
      <p class="jd-label jd-label-line" data-reveal>${esc(A.equipe.etiquette)}</p>
      <h2 id="equipe-title" class="home-team-title" data-reveal data-no-accent>${rich(A.equipe.titre)}</h2>
      <p class="jd-lead" data-reveal>${t(A.equipe.texte)}</p>
      <p class="cta-row" data-reveal><a class="btn btn-solid" href="${ROUTES.apropos[lang]}">${esc(A.equipe.bouton)}</a></p>
    </div>
    <ul class="home-team-photos" role="list">
      ${A.equipe.photos
        .filter((p) => existsSync(join(ROOT, 'static', `${p.src}.webp`)))
        .map((p) => `<li data-reveal>${picture(p.src, p.alt, { w: 900, h: 1200 })}</li>`)
        .join('\n      ')}
    </ul>
  </div>
</section>

<section class="jd-screen home-services" id="services-accueil" aria-labelledby="hp-services-title">
  <div class="jd-wrap">
    <div class="home-services-text">
    <p class="jd-label jd-label-line" data-reveal>${esc(A.services.etiquette)}</p>
    <h2 id="hp-services-title" data-reveal data-no-accent>${rich(A.services.titre)}</h2>
    <p class="jd-lead" data-reveal>${t(A.services.intro)}</p>
    <div class="home-services-split">
      <div class="home-split-text">
        <ul class="hp-svc-grid" role="list">
          ${A.services.libelles
            .map((lib, i) => `<li data-reveal><a class="hp-svc" href="${ROUTES.services[lang]}">${picture(`/img/${svcItems[i].icone}-336`, '', { w: 336, h: 336, cls: 'hp-svc-icon', fallback: 'png' })}<span class="hp-svc-text"><strong>${esc(lib[0])}</strong> <span>${esc(lib[1])}</span></span></a></li>`)
            .join('\n          ')}
        </ul>
        <p class="cta-row" data-reveal><a class="btn btn-solid" href="${ROUTES.services[lang]}">${esc(A.services.bouton)}</a></p>
      </div>
    </div>
    </div>
  </div>
  ${studio ? `<div class="home-services-studio" data-reveal>${picture(A.services.photoStudio, A.services.photoStudioAlt, { w: 1200, h: 1600 })}</div>` : `<div class="home-services-portrait" data-reveal>${picture('/img/services-jd-detoure', A.services.portraitAlt, { w: 683, h: 1200, fallback: 'png' })}</div>`}
</section>

<section class="jd-screen home-contact" id="contact" aria-labelledby="contact-title">
  <div class="jd-wrap home-split home-contact-split">
    <div class="home-contact-photo${contactPhoto ? '' : ' is-empty'}" data-reveal>${contactPhoto ? picture(A.contact.photo, 'JD', { w: A.contact.photoLargeur || 852, h: A.contact.photoHauteur || 1222, fallback: 'png' }) : ''}</div>
    <div class="home-split-text">
      <p class="jd-label jd-label-line" data-reveal>${esc(A.contact.etiquette)}</p>
      <h2 id="contact-title" data-reveal data-no-accent>${rich(A.contact.titre)}</h2>
      <p class="jd-lead" data-reveal>${t(A.contact.texte)}</p>
      <p class="cta-row" data-reveal><a class="btn btn-solid" href="${ROUTES.contact[lang]}">${esc(A.contact.bouton)}</a></p>
    </div>
  </div>
</section>${avis}`;
  const endBand = L.heroResume ? summaryBand(L.seo.accueil.resume).replace('class="summary-band"', 'class="summary-band summary-band-end"') : '';

  return layout({ key: 'accueil', lang, body: lang === 'fr' ? body : `${body}${endBand ? `\n${endBand}` : ''}`, endBand: lang === 'fr' ? endBand : '', videos: catVideos.filter((v) => v?.youtubeId), preload: heroPreload });
}

function memberPhoto(m, L) {
  return `<div class="member-photo">${
    m.photo
      ? `<img src="${esc(m.photo)}" alt="${esc(m.nomComplet)}" loading="lazy" decoding="async" width="800" height="1000">`
      : `<span>${t(L.equipe.photoManquante)}</span>`
  }</div>`;
}

function clientMarquee() {
  const names = portfolio.clients.map((c) => c.nom);
  const items = (hidden) => names.map((n) => `<li${hidden ? ' aria-hidden="true"' : ''}>${esc(n)}</li>`).join('');
  return `<div class="marquee" data-reveal><ul class="marquee-track">${items(false)}${items(true)}</ul></div>`;
}

// Icône Lucide (ISC) en trait, en ligne. pathLength sert à l'animation de tracé (svc-stroke).
function lucide(name, cls = 'svc-icon', size = 40) {
  const svg = readFileSync(join(ROOT, 'icons', 'lucide', `${name}.svg`), 'utf8');
  const shapes = svg
    .slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'))
    .trim()
    .split('\n')
    .map((l) => l.trim().replace(/\s*\/>$/, ' pathLength="300" />'))
    .join('');
  return `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes}</svg>`;
}

// Bandeau vidéo plein écran (Services, À propos) : un seul titre, en bas à gauche, et un bouton pause (vidéo de plus de 5 s).
// hero (facultatif) : titre sur deux lignes en haut à gauche, sous le menu, puis texte d'intro (Services).
// opts.cls : classe en plus ; opts.scroll : { texte, label, cible } = repère SCROLL en bas, lien vers la section suivante.
function fullHero(clipId, title, L, hero = null, h1 = '', opts = {}) {
  // Titre et description en bas du bandeau sur toutes les pages (JD, 2026-11-05) : la classe is-top n'est plus posée.
  return `<section class="page-hero full-hero has-bg-video${opts.cls ? ` ${opts.cls}` : ''}" aria-labelledby="hero-title">
  ${bgVideo(clipId)}
  <div class="container">
    ${
      hero
        ? `<h1 id="hero-title" class="hero-stack${hero.ligne1 ? '' : ' is-one-line'}" data-no-accent>${hero.ligne1 ? `<span class="hero-line">${esc(hero.ligne1)}</span> ` : ''}<span class="hero-word">${esc(hero.ligne2)}</span>${h1Seo(h1)}</h1>
    ${hero.intro ? `<p class="intro hero-intro">${t(hero.intro)}</p>` : ''}`
        : `<h1 id="hero-title" class="hero-word" data-no-accent>${esc(title)}${h1Seo(h1)}</h1>`
    }${opts.resume ? `
    <p class="page-summary hero-resume">${t(opts.resume)}</p>` : ''}
  </div>
  ${opts.scroll ? `<a class="scroll-cue" href="#${opts.scroll.cible}" aria-label="${esc(opts.scroll.label)}"><span aria-hidden="true">${esc(opts.scroll.texte)}</span></a>` : ''}
  <button class="bg-toggle" type="button" data-bg-toggle data-pause="${esc(L.services.heroPause)}" data-play="${esc(L.services.heroLecture)}" aria-label="${esc(L.services.heroPause)}"><span aria-hidden="true">❚❚</span></button>
</section>`;
}

// Illustration de service : version 336 px (2x l'affichage max de 168 px) quand elle existe ; l'original 600 px reste dans static/img/
function svcArt(name) {
  const light = existsSync(join(ROOT, 'static', 'img', `${name}-336.webp`));
  return picture(`/img/${name}${light ? '-336' : ''}`, '', { w: light ? 336 : 600, h: light ? 336 : 600, cls: 'svc-art', fallback: 'png' });
}
// Carte de service (page Services et pages locales)
const card = (s) => `<li class="svc-card" data-reveal>
          ${svcArt(s.icone)}
          <h3>${t(s.titre)}</h3>
          <p>${t(s.texte)}</p>
        </li>`;

// Page Services : maquette de JD (PDF « VMM Service Section LAYOUT + DIRECTIONS »).
function servicesPage(lang) {
  const L = langs[lang];
  const S = L.services;
  const V = S.vision;
  const items = S.items;
  // Sur ordi, main.js passe à la vidéo « scroll » et la cale sur le défilement ; sinon, boucle
  const camera = `<section class="camera-scrub" aria-labelledby="camera-title" data-scrub>
  <div class="camera-stage">
    <h2 id="camera-title" data-reveal>${t(S.camera.titre)}</h2>
    ${S.camera.note ? `<p class="small" data-reveal>${t(S.camera.note)}</p>` : ''}
    <video class="camera-video" muted playsinline preload="none" poster="${CAMERA.poster}" width="${CAMERA.width}" height="${CAMERA.height}" aria-label="${esc(S.camera.videoLabel)}" data-scroll-webm="${CAMERA.scroll.webm}" data-scroll-mp4="${CAMERA.scroll.mp4}">
      <source src="${CAMERA.loop.webm}" type="video/webm">
      <source src="${CAMERA.loop.mp4}" type="video/mp4">
    </video>
  </div>
</section>`;
  const groups = S.groupes
    .map((g, gi) => {
      const list = g.items.map((i) => items[i]).filter(shown);
      return `<section class="jd-screen svc-group"${gi === 0 && V.bouton ? ' id="svc-liste"' : ''} aria-labelledby="svc-${gi + 1}">
  <div class="jd-wrap">
    <p class="jd-label" data-reveal>${esc(S.etiquette)}</p>
    <h2 id="svc-${gi + 1}" data-reveal>${rich(g.titre)}</h2>
    <ul class="svc-grid${list.length === 1 ? ' is-single' : ''}">
        ${list.map(card).join('\n        ')}
    </ul>
  </div>
</section>`;
    })
    .join('\n');
  const resumeHero = heroResume(L, 'services');
  // Image de l'écran 2 (JD, 2026-11-12) : capture Premiere Pro, version 16:9 sur ordi et 9:16 sur mobile, fondue dans le fond
  const visionImg = V.image && existsSync(join(ROOT, 'static', `${V.image.ordi}.webp`))
    ? `<div class="vision-premiere" aria-hidden="false"><picture><source media="(max-width: 899px)" srcset="${V.image.mobile}.webp" type="image/webp"><source media="(max-width: 899px)" srcset="${V.image.mobile}.jpg"><source srcset="${V.image.ordi}.webp" type="image/webp"><img src="${V.image.ordi}.jpg" alt="${esc(V.image.alt)}" width="836" height="940" loading="lazy" decoding="async"></picture></div>`
    : '';
  const F = S.finPortfolio;
  const finPortfolio = F
    ? `<section class="jd-screen svc-to-portfolio" aria-labelledby="fin-title">
  <div class="stp-photo" data-reveal>${picture(F.photo, F.photoAlt, { w: COUL.photoLargeur || 693, h: COUL.photoHauteur || 1218 })}</div>
  <div class="jd-wrap stp-text">
    <h2 id="fin-title" data-reveal data-no-accent>${rich(F.titre)}</h2>
    <p class="jd-lead" data-reveal>${t(F.texte)}</p>
    <p class="cta-row" data-reveal><a class="btn btn-solid" href="${ROUTES.portfolio[lang]}">${esc(F.bouton)}</a></p>
  </div>
</section>`
    : '';
  const body = `${fullHero('services', S.titre, L, S.hero, L.seo.services.h1, { resume: resumeHero })}
${resumeHero ? '' : summaryBand(L.seo.services.resume)}
<section class="jd-screen jd-vision${visionImg ? ' has-premiere' : ''}" aria-labelledby="vision-title">
${visionImg ? `  ${visionImg}
` : ''}  <div class="jd-wrap vision-grid">
    <div class="vision-text">
      <p class="jd-label jd-label-line" data-reveal>${esc(V.etiquette)}</p>
      <h2 id="vision-title" class="vision-title" data-reveal>${rich(V.titre)}</h2>
      <p class="jd-lead" data-reveal>${t(V.texte)}</p>
      <ul class="reperes" data-reveal>
        ${V.reperes.map((r) => `<li>${r.image && existsSync(join(ROOT, 'static', `${r.image}.webp`)) ? picture(r.image, '', { w: 192, h: 192, cls: 'repere-img', fallback: 'png' }) : lucide(r.icone, 'repere-icon', 44)}<strong>${esc(r.titre)}</strong><span>${esc(r.texte)}</span></li>`).join('\n        ')}
      </ul>${V.bouton ? `
      <p class="cta-row" data-reveal><a class="btn btn-solid" href="#svc-liste">${esc(V.bouton)}</a></p>` : ''}
    </div>
    ${visionImg ? '' : `<div class="vision-photo" data-reveal>
      ${picture('/img/services-jd-detoure', V.photoAlt, { w: 683, h: 1200, fallback: 'png' })}
    </div>`}
  </div>
</section>
${groups}
${shown(S.camera) ? camera : ''}
${finPortfolio || (shown(S.fin) ? `<section class="jd-screen jd-end" aria-labelledby="fin-title">
  <div class="jd-wrap">
    <p class="jd-label" data-reveal>${esc(S.fin.etiquette)}</p>
    <h2 id="fin-title" data-reveal data-no-accent>${t(S.fin.titre)}</h2>
    <p class="jd-lead" data-reveal>${t(S.fin.texte)}</p>
    <p class="cta-row" data-reveal><a class="btn btn-solid" href="${ROUTES.portfolio[lang]}">${esc(S.fin.bouton)}</a></p>
  </div>
</section>` : `<section class="jd-screen jd-end svc-cta" aria-label="${esc(S.fin.bouton)}">
  <div class="jd-wrap">
    <p class="cta-row" data-reveal><a class="btn btn-solid" href="${ROUTES.portfolio[lang]}">${esc(S.fin.bouton)}</a></p>
  </div>
</section>`)}
${shown(S.slogan) ? `<p class="jd-slogan">${esc(S.slogan.texte)}</p>` : ''}`;
  return layout({ key: 'services', lang, body, preload: posterPreload('services') });
}

// Image d'une carte client : poster de sa bande-annonce, sinon miniature de sa première vidéo.
function clientImage(c) {
  const clip = clips.clips[c.clip];
  if (clip) return clipFiles(clip.mobile).poster;
  const first = clientVideos(c).find((v) => v.youtubeId);
  return first ? ytThumb(first.youtubeId) : '';
}

const countText = (n, P) => `${n} ${n > 1 ? P.videos : P.video}`;

// Miniature qui ouvre directement YouTube (nouvel onglet), sans lightbox. Sans ID : vignette vide, non cliquable.
// img (facultatif) : visuel fourni par JD (chemin sans extension, .webp + .jpg) au lieu de la miniature YouTube.
function ytTile(v, lang, { label = '', cls = '', img = '' } = {}) {
  const L = langs[lang];
  const own = img && existsSync(join(ROOT, 'static', `${img}.webp`)) ? picture(img, '', { w: 460, h: 642 }) : '';
  if (!v?.youtubeId) {
    return `<span class="yt-tile is-empty${cls ? ` ${cls}` : ''}"><span class="thumb">${own || '<span class="thumb-empty" aria-hidden="true"></span>'}</span>${label ? `<span class="yt-tile-label">${label}</span>` : ''}</span>`;
  }
  const name = videoName(v, lang);
  return `<a class="yt-tile${cls ? ` ${cls}` : ''}" href="${ytUrl(v)}" target="_blank" rel="noopener" aria-label="${esc(L.portfolio.biblio.youtube)} : ${esc(name)}">
          <span class="thumb">${own || `<img src="${ytThumb(v.youtubeId)}" alt="" loading="lazy" decoding="async" width="480" height="360">`}<span class="play" aria-hidden="true">▶</span></span>
          ${label ? `<span class="yt-tile-label">${label}</span>` : ''}
        </a>`;
}

// Bibliothèque d'une page client ou Coulisses : une rangée qui défile à l'horizontale (doigt, trackpad, flèches ‹ ›),
// 3 miniatures visibles au plus, compteur « 01 / N ». Sans JavaScript, la rangée défile quand même ; les flèches
// et le compteur n'apparaissent qu'avec JS. Aucun conteneur derrière la rangée (PDF client de JD, 2026-11-04).
function library(list, lang, id) {
  const B = langs[lang].portfolio.biblio;
  const pad = (n) => String(n).padStart(2, '0');
  return `<div class="library-row" data-library>
      <button class="library-arrow is-prev" type="button" data-library-prev aria-controls="${id}" aria-label="${esc(B.precedent)}"><span aria-hidden="true">‹</span></button>
      <ul class="library-track" id="${id}" role="list" tabindex="0" aria-label="${esc(B.youtube)}">
        ${list.map((v) => `<li>${ytTile(v, lang)}</li>`).join('\n        ')}
      </ul>
      <button class="library-arrow is-next" type="button" data-library-next aria-controls="${id}" aria-label="${esc(B.suivant)}"><span aria-hidden="true">›</span></button>
    </div>
    <p class="library-count" data-library-count data-total="${list.length}" data-label="${esc(B.compteur)}"><span aria-hidden="true"><span data-library-index>01</span> / ${pad(list.length)}</span><span class="visually-hidden" data-library-sr>${esc(B.compteur.replace('{i}', '1').replace('{n}', list.length))}</span></p>`;
}

// Clients de « Les entreprises à l'honneur », dans l'ordre de portfolio.json → honneur (les autres suivent).
function honourClients() {
  const order = portfolio.honneur || [];
  const rank = (c) => (order.includes(clientSlug(c)) ? order.indexOf(clientSlug(c)) : order.length);
  return [...CLIENTS].sort((a, b) => rank(a) - rank(b));
}

// Vidéos montrées sur /portfolio/ (JSON-LD et sitemap) : celles des 4 catégories.
const portfolioVideos = () => [...new Set(portfolio.categories.map(categoryVideo).filter((v) => v?.youtubeId))];

// Page Portfolio, dans l'ordre du PDF « VMM Portfolio LAYOUT » de JD : héros vidéo, 4 catégories,
// entreprises à l'honneur (boutons logo), coulisses (une photo), bouton vers À propos.
function portfolioPage(lang) {
  const L = langs[lang];
  const P = L.portfolio;
  const catVideos = portfolio.categories.map(categoryVideo);
  const behind = visibleVideos(coulissesVideos());
  // Photo du bloc Coulisses : chemin complet (/img/...) ou, ancien format, nom d'un fichier de /img/coulisses/
  const photo = COUL.photo.startsWith('/') ? COUL.photo : `/img/coulisses/${COUL.photo}`;
  const hasPhoto = existsSync(join(ROOT, 'static', `${photo}.webp`));
  const photoFallback = existsSync(join(ROOT, 'static', `${photo}.jpg`)) ? 'jpg' : 'webp';
  const logo = (c) => {
    const name = c.nomBouton || c.nom;
    if (c.logo && existsSync(join(ROOT, 'static', `${c.logo}.webp`))) return picture(c.logo, `${L.portfolio.honneur.logoAlt} ${name}`, { w: c.logoLargeur || 440, h: c.logoHauteur || 440, cls: 'logo-btn-img', fallback: c.logoFormat || 'png' });
    return `<span class="logo-btn-name">${esc(name)}</span>`;
  };
  const head = (label, title, intro, id) => `<p class="jd-label jd-label-line" data-reveal>${esc(label)}</p>
    <h2 id="${id}" data-reveal data-no-accent>${t(title)}</h2>
    ${[].concat(intro || []).map((x) => `<p class="jd-lead" data-reveal>${t(x)}</p>`).join('\n    ')}`;
  // Écran 4 (JD, courriel du 2026-11-14, A6) : fond étagère + tuile VMM, quand ces visuels existent (version française).
  const CB = P.coulissesBloc;
  const shelf = CB.fond && existsSync(join(ROOT, 'static', `${CB.fond}-720.webp`)) && existsSync(join(ROOT, 'static', `${CB.tuile}.webp`));
  const playIcon = '<svg class="cta-play" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4Z"/></svg>';
  const coulissesSection = shelf
    ? `<section class="jd-screen pf-coulisses pf-shelf" aria-labelledby="pf-coulisses-title">
  <div class="pf-shelf-bg" aria-hidden="true"><picture><source media="(min-width: 900px)" srcset="${CB.fond}-1080.webp" type="image/webp"><source srcset="${CB.fond}-720.webp 720w, ${CB.fond}-1080.webp 1080w" sizes="100vw" type="image/webp"><img src="${CB.fond}-1080.jpg" alt="" width="1080" height="1920" loading="lazy" decoding="async"></picture></div>
  <div class="jd-wrap pf-shelf-grid">
    <div class="pf-coulisses-text">
    ${head(CB.etiquette, CB.titre, CB.intro, 'pf-coulisses-title')}
    </div>
    <p class="pf-shelf-row"><a class="coulisses-link pf-shelf-tile" href="${coulissesRoute[lang]}" aria-label="${esc(CB.voir)} (${countText(behind.length, P)})" data-reveal>
      <span class="pf-shelf-img">${picture(CB.tuile, '', { w: 512, h: 512, fallback: 'png' })}</span>
      <span class="coulisses-text"><strong>${esc(CB.legende)}</strong><span class="coulisses-count">${countText(behind.length, P)}</span><span class="logo-btn-cta">${playIcon}${esc(P.cliquer)}</span></span>
    </a></p>
  </div>
</section>`
    : `<section class="jd-screen pf-coulisses" aria-labelledby="pf-coulisses-title">
  <div class="jd-wrap">
    <div class="pf-coulisses-grid">
    <div class="pf-coulisses-text">
    ${head(CB.etiquette, CB.titre, CB.intro, 'pf-coulisses-title')}
    </div>
    <p class="pf-coulisses-row"><a class="coulisses-link" href="${coulissesRoute[lang]}" aria-label="${esc(CB.voir)} (${countText(behind.length, P)})" data-reveal>
      <span class="coulisses-photo">${hasPhoto ? picture(photo, CB.photoAlt, { w: COUL.photoLargeur || 1152, h: COUL.photoHauteur || 2048, fallback: photoFallback }) : '<span class="thumb-empty" aria-hidden="true"></span>'}</span>
      <span class="coulisses-text"><strong>${esc(CB.legende)}</strong><span class="coulisses-count">${countText(behind.length, P)}</span><span class="logo-btn-cta">${esc(P.cliquer)}</span></span>
    </a></p>
    </div>
  </div>
</section>`;
  // Écran 5 (JD, courriel du 2026-11-14, A9) : photo de JD à gauche, fondue dans le fond ; texte à droite.
  const finPhoto = P.fin.photo && existsSync(join(ROOT, 'static', `${P.fin.photo}.webp`));
  const finSection = `<section class="jd-screen jd-end pf-end${finPhoto ? ' jd-photo-split' : ''}" aria-labelledby="pf-fin-title">
  <div class="jd-wrap">${finPhoto ? `
    <div class="jd-split-photo" data-reveal>${picture(P.fin.photo, P.fin.photoAlt, { w: P.fin.photoLargeur, h: P.fin.photoHauteur, fallback: 'png' })}</div>
    <div class="jd-split-text">` : ''}
    <p class="jd-label${finPhoto ? ' jd-label-line' : ''}" data-reveal>${esc(P.fin.etiquette)}</p>
    <h2 id="pf-fin-title" data-reveal data-no-accent>${t(P.fin.titre)}</h2>
    <p class="jd-lead" data-reveal>${t(P.fin.texte)}</p>
    <p class="cta-row" data-reveal><a class="btn btn-solid" href="${ROUTES.apropos[lang]}">${esc(P.bouton)}</a></p>${finPhoto ? `
    </div>` : ''}
  </div>
</section>`;
  const body = `${fullHero('portfolio', P.heroTitre, L, null, L.seo.portfolio.h1, { cls: 'pf-hero', scroll: { texte: P.scroll, label: P.scrollLabel, cible: 'realisons' }, resume: heroResume(L, 'portfolio') })}
${heroResume(L, 'portfolio') ? '' : summaryBand(L.seo.portfolio.resume)}
<section class="jd-screen pf-cats" id="realisons" aria-labelledby="realisons-title">
  <div class="jd-wrap">
    ${head(P.realisons.etiquette, P.realisons.titre, P.realisons.texte ? [P.realisons.texte] : [P.intro, P.realisons.intro], 'realisons-title')}
    <ul class="pf-cat-grid" role="list">
      ${portfolio.categories
        .map((c, i) => `<li data-reveal>${ytTile(catVideos[i], lang, { cls: 'pf-cat', label: t((c.titrePortfolio || c.titre)[lang]), img: c.miniature })}</li>`)
        .join('\n      ')}
    </ul>
  </div>
</section>

<section class="jd-screen pf-honneur" aria-labelledby="honneur-title">
  <div class="jd-wrap">
    ${head(P.honneur.etiquette, P.honneur.titre, P.honneur.intro, 'honneur-title')}
    <ul class="logo-grid" role="list">
      ${honourClients()
        .map((c) => `<li data-reveal><a class="logo-btn" href="${clientRoute(c)[lang]}" aria-label="${esc(P.honneur.voir.replace('{client}', c.nomBouton || c.nom))} (${countText(visibleVideos(clientVideos(c)).length, P)})">
        <span class="logo-btn-face">${logo(c)}</span>
        <span class="logo-btn-text"><strong>${esc(c.nomBouton || c.nom)}</strong><span class="logo-btn-count">${countText(visibleVideos(clientVideos(c)).length, P)}</span><span class="logo-btn-cta">${esc(P.cliquer)}</span></span>
      </a></li>`)
        .join('\n      ')}
    </ul>
  </div>
</section>

${coulissesSection}

${finSection}`;
  return layout({ key: 'portfolio', lang, body, videos: portfolioVideos(), preload: posterPreload('portfolio') });
}

// Page de collection (client ou Coulisses), selon les PDF client de JD (2026-11-04) : un seul écran, le clip en fond,
// le titre en blanc (seul texte du héros), puis les miniatures et les flèches posées directement sur la vidéo, en bas.
// Les anciens éléments du héros (résumé « VMM Productions a réalisé… », nombre de vidéos, « Retour aux projets »)
// sont retirés de la page ; leurs textes restent dans content/*.json.
// centered (pages des entreprises, version française ; JD, courriel du 2026-11-14, C10) : titre centré à l'horizontale, même hauteur.
function collectionScreen(L, lang, { clip, title, h1, list, centered = false }) {
  const hasClip = clip && clips.clips[clip];
  return `<section class="page-hero collection-screen${hasClip ? ' full-hero has-bg-video' : ''}" aria-labelledby="hero-title">
  ${hasClip ? bgVideo(clip) : ''}
  <div class="container collection-inner">
    <h1 id="hero-title" class="collection-title${title.length > 22 ? ' is-long' : ''}${centered ? ' is-centered' : ''}" data-no-accent>${esc(title)}${h1Seo(h1)}</h1>
    <div class="collection-library" id="videos">
      ${library(list, lang, `biblio-${lang}`)}
    </div>
  </div>
  ${hasClip ? `<button class="bg-toggle" type="button" data-bg-toggle data-pause="${esc(L.services.heroPause)}" data-play="${esc(L.services.heroLecture)}" aria-label="${esc(L.services.heroPause)}"><span aria-hidden="true">❚❚</span></button>` : ''}
</section>`;
}

// Page d'un client : son clip en fond (si le client en a un) et toutes ses vidéos.
function clientPage(c, lang) {
  const L = langs[lang];
  const P = L.portfolio;
  const list = visibleVideos(clientVideos(c));
  // Élision en français : « de Installations » devient « d'Installations ».
  const fill = (s) => (lang === 'fr' && /^[aeiouyàâéèêîôûh]/i.test(c.nom) ? s.replaceAll('de {client}', 'd’{client}') : s).replaceAll('{client}', c.nom);
  const body = collectionScreen(L, lang, { clip: c.clip, title: c.nomHero || c.nom, h1: fill(P.clientH1), list, centered: lang === 'fr' });
  return layout({
    key: 'portfolio',
    lang,
    body,
    videos: list,
    page: { route: clientRoute(c), seo: { title: fill(P.clientSeoTitre), description: fill(P.clientSeoDescription) }, crumb: c.nom, client: c, og: existsSync(join(ROOT, 'static', 'og', `og-client-${clientSlug(c)}.jpg`)) ? `/og/og-client-${clientSlug(c)}.jpg` : '' },
    preload: c.clip ? posterPreload(c.clip) : '',
  });
}

// Page Coulisses : toutes les vidéos de type « coulisses » de portfolio.json.
function coulissesPage(lang) {
  const L = langs[lang];
  const P = L.portfolio;
  const C = P.coulissesPage;
  const list = visibleVideos(coulissesVideos());
  const body = collectionScreen(L, lang, { clip: COUL.clip, title: C.titreHero || C.titre, h1: C.h1, list });
  return layout({
    key: 'portfolio',
    lang,
    body,
    videos: list,
    page: { route: coulissesRoute, seo: { title: C.seoTitre, description: C.seoDescription }, crumb: C.titre },
    preload: COUL.clip ? posterPreload(COUL.clip) : '',
  });
}

// Vidéos d'une page locale : d'abord celles des clients de la zone (portfolio.json → villes / region, comparées à
// zones.json → villesLocales), 2 au plus par client et en priorité celles déjà choisies dans « videos », puis la sélection.
// Le nombre de vignettes reste celui de « videos ».
function zoneVideos(z) {
  const byId = (id) => portfolio.videos.find((v) => v.youtubeId === id);
  const chosen = z.videos.map(byId).filter(Boolean);
  const places = z.villesLocales || [];
  const local = portfolio.clients.filter((c) => [...(c.villes || []), c.region].some((p) => p && places.includes(p)));
  const perClient = local.map((c) => {
    const all = clientVideos(c).filter((v) => v.youtubeId); // vidéo sans ID YouTube (à confirmer) : pas sur les pages locales
    return [...all.filter((v) => chosen.includes(v)), ...all.filter((v) => !chosen.includes(v))].slice(0, 2);
  });
  const first = [];
  for (let i = 0; i < 2; i++) for (const list of perClient) if (list[i]) first.push(list[i]);
  return [...new Set([...first, ...chosen])].slice(0, Math.max(chosen.length, 1));
}

// Page locale (zones desservies) : un H1 service + ville, une intro factuelle, les 6 services, 3-4 vidéos, 3 questions.
function zonePage(z, lang) {
  const L = langs[lang];
  const Z = z[lang];
  const ZL = L.zones;
  const F = ZL.faits;
  const byId = (id) => portfolio.videos.find((v) => v.youtubeId === id);
  const vids = zoneVideos(z);
  const fact = (label, value) => `<div><dt class="label">${esc(label)}</dt><dd>${value}</dd></div>`;
  // zonesData.noteProvisoire (« texte provisoire, JD réécrira ») reste dans content/zones.json, plus dans le HTML publié.
  const body = `<section class="page-hero has-bg-video zone-hero" aria-labelledby="zone-title">
  ${bgVideo(z.clip)}
  <div class="container">
    <p class="label" data-reveal>${esc(ZL.etiquette)}</p>
    <h1 id="zone-title" data-reveal>${t(Z.h1)}</h1>
    <p class="intro" data-reveal>${t(Z.intro)}</p>
    <p class="cta-row" data-reveal><a class="btn btn-neon" href="${ROUTES.contact[lang]}">${esc(ZL.ctaBouton)}</a></p>
  </div>
</section>

<section class="section" aria-labelledby="zone-angle">
  <div class="container zone-grid">
    <div>
      <h2 id="zone-angle" data-reveal>${t(Z.angleTitre)}</h2>
      ${Z.angle.map((p) => `<p class="intro" data-reveal>${t(p)}</p>`).join('\n      ')}
    </div>
    <div class="card glass zone-facts" data-reveal>
      <h3>${esc(ZL.faitsTitre)}</h3>
      <dl class="contact-details">
        ${fact(F.base, esc(F.baseValeur))}
        ${fact(F.rayon, esc(F.rayonValeur))}
        ${fact(F.heures, esc(F.heuresValeur))}
        ${fact(F.livraison, esc(F.livraisonValeur))}
        ${fact(F.langues, esc(F.languesValeur))}
        ${fact(F.equipe, esc(F.equipeValeur))}
        ${TEL ? fact(L.contact.telephoneLabel, `<a href="${TEL.href}">${esc(TEL.affiche)}</a>`) : ''}
        ${fact(L.contact.courrielLabel, `<a href="mailto:${site.courriel}">${esc(site.courriel)}</a>`)}
      </dl>
    </div>
  </div>
</section>

<section class="jd-screen svc-group" aria-labelledby="zone-services">
  <div class="jd-wrap">
    <p class="jd-label" data-reveal>${esc(L.services.etiquette)}</p>
    <h2 id="zone-services" data-reveal>${t(ZL.servicesTitre)}</h2>
    <p class="jd-lead" data-reveal>${t(ZL.servicesIntro)}</p>
    <ul class="svc-grid">
        ${L.services.items.filter(shown).map(card).join('\n        ')}
    </ul>
    <p class="cta-row" data-reveal><a class="btn btn-neon" href="${ROUTES.services[lang]}">${esc(ZL.servicesBouton)}</a></p>
  </div>
</section>

<section class="section" aria-labelledby="zone-videos">
  <div class="container">
    <h2 id="zone-videos" data-reveal>${t(ZL.videosTitre)}</h2>
    <p class="intro" data-reveal>${t(ZL.videosIntro)}</p>
    <ul class="grid grid-4 featured">
      ${vids.map((v) => `<li data-reveal>${videoTile(v, lang)}</li>`).join('\n      ')}
    </ul>
    <p class="cta-row"><a class="btn btn-neon" href="${ROUTES.portfolio[lang]}">${esc(ZL.videosBouton)}</a></p>
  </div>
</section>

<section class="section section-tight" aria-labelledby="zone-faq">
  <div class="container faq">
    <h2 id="zone-faq" data-reveal>${esc(ZL.faqTitre)}</h2>
    ${Z.faq.map((f) => `<details data-reveal><summary>${t(f.q)}</summary><p>${t(f.r)}</p></details>`).join('\n    ')}
  </div>
</section>

<section class="section zone-cta" aria-labelledby="zone-cta">
  <div class="container">
    <h2 id="zone-cta" data-reveal>${t(ZL.ctaTitre)}</h2>
    <p class="intro" data-reveal>${t(ZL.ctaTexte)}</p>
    <p class="cta-row" data-reveal><a class="btn btn-neon" href="${ROUTES.contact[lang]}">${esc(ZL.ctaBouton)}</a></p>
  </div>
</section>`;
  return layout({
    key: 'zone',
    lang,
    body,
    videos: vids,
    page: { route: zoneRoute(z), seo: Z.seo, crumb: Z.h1, zone: z },
    preload: posterPreload(z.clip),
  });
}

function slug(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Page À propos : maquette de JD (PDF « VMM About Section LAYOUT + DIRECTIONS »), même identité que Services.
// Photos de coulisses (static/img/coulisses/coulisses-NN.webp + variante -576.webp), dans l'ordre des numéros.
// Grille simple sur /about/, entre les bios et le mot de la fin ; chargement différé.
const COULISSES_DIR = join(ROOT, 'static', 'img', 'coulisses');
const coulissesPhotos = existsSync(COULISSES_DIR)
  ? readdirSync(COULISSES_DIR).filter((f) => /^coulisses-\d+\.webp$/.test(f)).sort((a, b) => parseInt(a.slice(10), 10) - parseInt(b.slice(10), 10))
  : [];
function coulissesGrid(C) {
  if (!C || !coulissesPhotos.length) return '';
  const total = coulissesPhotos.length;
  const items = coulissesPhotos
    .map((f, i) => {
      const src = `/img/coulisses/${f}`;
      const small = src.replace(/\.webp$/, '-576.webp');
      const srcset = existsSync(join(ROOT, 'static', small)) ? ` srcset="${small} 576w, ${src} 1152w" sizes="(min-width: 1024px) 190px, (min-width: 600px) 31vw, 47vw"` : '';
      const alt = C.alt.replace('{n}', i + 1).replace('{total}', total);
      // Chaque photo ouvre l'original (1152 × 2048) : en plein écran avec JS (visionneuse), dans un nouvel onglet sans JS
      return `<li><a class="coulisses-zoom" href="${src}" target="_blank" rel="noopener" data-zoom="${i}" aria-label="${esc(C.agrandir.replace('{n}', i + 1))}"><img src="${src}"${srcset} alt="${esc(alt)}" width="1152" height="2048" loading="lazy" decoding="async"></a></li>`;
    })
    .join('\n      ');
  return `<section class="jd-screen jd-coulisses" aria-labelledby="coulisses-photos-title">
  <div class="jd-wrap">
    <h2 id="coulisses-photos-title" class="jd-label" data-reveal data-no-accent>${esc(C.titre)}</h2>
    <ul class="coulisses-grid" role="list">
      ${items}
    </ul>
  </div>
  <dialog class="lightbox photo-viewer" aria-label="${esc(C.visionneuse)}" data-photo-viewer data-total="${total}">
    <button class="lightbox-close" type="button" data-viewer-close aria-label="${esc(C.fermer)}">×</button>
    <p class="photo-viewer-count" aria-live="polite"></p>
    <button class="photo-viewer-nav is-prev" type="button" data-viewer-prev aria-label="${esc(C.precedente)}"><span aria-hidden="true">‹</span></button>
    <img alt="" width="1152" height="2048" decoding="async">
    <button class="photo-viewer-nav is-next" type="button" data-viewer-next aria-label="${esc(C.suivante)}"><span aria-hidden="true">›</span></button>
  </dialog>
</section>`;
}

function aboutPage(lang) {
  const L = langs[lang];
  const A = L.apropos;
  const label = `<p class="jd-label" data-reveal>${esc(A.etiquette)}</p>`;
  // Version française (JD, courriel du 2026-11-14, B1-B3) : l'écran « Les visages derrière VMM. » est fusionné dans le
  // dernier écran (photo de JD à droite / en bas) ; les pages JD et Renaud portent l'étiquette « Les visages derrière VMM »
  // au format des autres étiquettes (trait + majuscules violettes). La version anglaise garde l'ancienne structure.
  const fused = Boolean(A.fin.photo && existsSync(join(ROOT, 'static', `${A.fin.photo}.webp`)));
  const personLabel = fused && A.etiquettePersonnes ? `<p class="jd-label jd-label-line" data-reveal>${esc(A.etiquettePersonnes)}</p>` : label;
  const members = A.membres
    .map(
      (m) => `<section class="jd-screen" id="${m.id}" aria-labelledby="${m.id}-title">
  <div class="jd-wrap">
    ${personLabel}
    <div class="person">
      <div class="person-photo" data-reveal>
        ${m.photo ? picture(m.photo, m.photoAlt, { w: 900, h: 1200 }) : `<span class="tbc">${t(L.equipe.photoManquante)}</span>`}
      </div>
      <div class="person-text">
        <p class="jd-role" data-reveal>${esc(m.role)}</p>
        <h2 id="${m.id}-title" data-reveal>${rich(m.titre)}</h2>
        ${m.paragraphes.map((p) => `<p data-reveal>${t(p)}</p>`).join('\n        ')}
        ${m.note ? `<p class="small" data-reveal>${t(m.note)}</p>` : ''}
      </div>
    </div>
  </div>
</section>`
    )
    .join('\n');
  const visionSection = `<section class="jd-screen jd-vision" id="vision" aria-labelledby="visages-title">
  <div class="jd-wrap${A.vision.photo ? ' vision-grid' : ''}">
    <div class="vision-text">
      ${label}
      <h2 id="visages-title" class="vision-title" data-reveal>${rich(A.vision.titre)}</h2>
      <p class="jd-lead" data-reveal>${t(A.vision.texte)}</p>
    </div>
    ${A.vision.photo ? `<div class="vision-photo vision-portrait${A.vision.photoFormat === 'png' ? ' is-cutout' : ''}" data-reveal>
      ${picture(A.vision.photo, A.vision.photoAlt, { w: A.vision.photoLargeur || 900, h: A.vision.photoHauteur || 1200, fallback: A.vision.photoFormat || 'jpg' })}
    </div>` : ''}
  </div>
</section>`;
  const closing = fused
    ? `<section class="jd-screen jd-closing jd-photo-split is-photo-right" id="vision" aria-labelledby="gens-title">
  <div class="jd-wrap">
    <div class="jd-split-text">
    <p class="jd-label" data-reveal>${esc(A.fin.etiquette)}</p>
    <h2 id="gens-title" class="vision-title" data-reveal>${rich(A.fin.titre)}</h2>
    <p class="jd-lead" data-reveal>${t(A.fin.texte)}</p>
    <p class="cta-row" data-reveal><a class="btn btn-solid" href="${ROUTES.contact[lang]}">${esc(A.fin.bouton)}</a></p>
    </div>
    <div class="jd-split-photo" data-reveal>${picture(A.fin.photo, A.fin.photoAlt, { w: A.fin.photoLargeur, h: A.fin.photoHauteur, fallback: 'png' })}</div>
  </div>
</section>`
    : `<section class="jd-screen jd-closing" aria-labelledby="gens-title">
  <div class="jd-wrap">
    ${label}
    <h2 id="gens-title" class="vision-title" data-reveal>${rich(A.fin.titre)}</h2>
    <p class="jd-lead" data-reveal>${t(A.fin.texte)}</p>
    <p class="cta-row" data-reveal><a class="btn btn-solid" href="${ROUTES.contact[lang]}">${esc(A.fin.bouton)}</a></p>
  </div>
</section>`;
  // Repère « SCROLL ↓ » du PDF À propos (écran 01), même composant que Portfolio
  const body = `${fullHero('about', A.titre, L, null, L.seo.apropos.h1, { scroll: { texte: L.portfolio.scroll, label: L.portfolio.scrollLabel, cible: fused ? A.membres[0].id : 'vision' }, resume: heroResume(L, 'apropos') })}
${heroResume(L, 'apropos') ? '' : summaryBand(L.seo.apropos.resume)}
${fused ? '' : `${visionSection}\n`}${members}
${coulissesGrid(A.coulisses)}
${closing}`;
  return layout({ key: 'apropos', lang, body, preload: posterPreload('about') });
}

function contactPage(lang) {
  const L = langs[lang];
  const body = `<section class="section section-contact page-contact has-bg-video" aria-labelledby="contact-page-title">
  ${bgVideo('contact-logo')}
  ${contactBlock(lang, { tag: 'h1', id: 'contact-page-title' })}
</section>
<section class="section section-tight" aria-labelledby="faq-title">
  <div class="container faq">
    <h2 id="faq-title" data-reveal>${esc(L.faq.titre)}</h2>
    ${L.faq.items.map((f) => `<details data-reveal><summary>${t(f.q)}</summary><p>${t(f.r)}</p>${f.note && !isPlaceholder(f.note) ? `<p class="small">${t(f.note)}</p>` : ''}</details>`).join('\n    ')}
  </div>
</section>`;
  return layout({ key: 'contact', lang, body, preload: posterPreload('contact-logo') });
}

function messagePage(lang, key, data) {
  const body = `<section class="section page-simple">
  <div class="container">
    <h1>${t(data.titre)}</h1>
    <p class="intro">${t(data.texte)}</p>
    <p class="cta-row"><a class="btn btn-neon" href="${ROUTES.accueil[lang]}">${esc(data.retour)}</a></p>
  </div>
</section>`;
  return layout({ key, lang, body });
}

// Page 404 : dans la langue de l'adresse demandée, avec les pages principales et le lien vers l'autre langue.
function notFoundPage(lang) {
  const L = langs[lang];
  const other = lang === 'fr' ? 'en' : 'fr';
  const O = langs[other];
  const data = L.introuvable;
  const links = (lg) => INDEXABLE.map((k) => `<li><a href="${ROUTES[k][lg]}">${esc(langs[lg].nav[k])}</a></li>`).join('');
  const body = `<section class="section page-simple">
  <div class="container">
    <h1>${t(data.titre)}</h1>
    <p class="intro">${t(data.texte)}</p>
    <p class="cta-row"><a class="btn btn-neon" href="${ROUTES.accueil[lang]}">${esc(data.retour)}</a></p>
    <h2 class="label" data-no-accent>${esc(data.pages)}</h2>
    <ul class="pills">${links(lang)}</ul>
    <div lang="${O.lang}">
      <h2 class="label" data-no-accent>${esc(O.introuvable.titre)} · ${esc(O.introuvable.pages)}</h2>
      <ul class="pills">${links(other)}</ul>
    </div>
  </div>
</section>`;
  return layout({ key: 'introuvable', lang, body });
}

// ---------- fichiers SEO/GEO ----------
function sitemap() {
  const xml = (s) => esc(s);
  // Vidéos d'une page : une liste, ou la clé d'une page (portfolio : vidéos des 4 catégories ; les autres sont sur les pages clients et Coulisses)
  const videoEntries = (key, lang, pageUrl) => {
    const list = Array.isArray(key) ? key : key === 'portfolio' ? portfolioVideos() : [];
    return list
      .filter(videoReady)
      .map((v) => {
        const o = videoObject(v, lang, pageUrl);
        return `
    <video:video>
      <video:thumbnail_loc>${xml(o.thumbnailUrl)}</video:thumbnail_loc>
      <video:title>${xml(o.name)}</video:title>
      <video:description>${xml(o.description)}</video:description>
      <video:player_loc>${xml(o.embedUrl)}</video:player_loc>
      <video:publication_date>${xml(o.uploadDate)}</video:publication_date>
    </video:video>`;
      })
      .join('');
  };
  const entry = (route, lang, videos) => `  <url>
    <loc>${abs(route[lang])}</loc>
    <xhtml:link rel="alternate" hreflang="fr-CA" href="${abs(route.fr)}"/>
    <xhtml:link rel="alternate" hreflang="en-CA" href="${abs(route.en)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(route.fr)}"/>${videos}
  </url>`;
  const urls = [
    ...INDEXABLE.flatMap((k) => ['fr', 'en'].map((lang) => entry(ROUTES[k], lang, videoEntries(k, lang, abs(ROUTES[k][lang]))))),
    ...CLIENTS.flatMap((c) => ['fr', 'en'].map((lang) => entry(clientRoute(c), lang, videoEntries(clientVideos(c), lang, abs(clientRoute(c)[lang]))))),
    ...['fr', 'en'].map((lang) => entry(coulissesRoute, lang, videoEntries(coulissesVideos(), lang, abs(coulissesRoute[lang])))),
    ...ZONES.flatMap((z) => ['fr', 'en'].map((lang) => entry(zoneRoute(z), lang, videoEntries(zoneVideos(z), lang, abs(zoneRoute(z)[lang]))))),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls.join('\n')}
</urlset>
`;
}

function llmsTxt() {
  const fr = langs.fr;
  const en = langs.en;
  const known = (s) => !isPlaceholder(s);
  const pageLinks = (L, lang) => INDEXABLE.map((k) => `- [${L.nav[k]}](${abs(ROUTES[k][lang])}) : ${L.seo[k].resume || L.seo[k].description}`);
  const lines = [
    `# ${site.nom} (${site.marque})`,
    '',
    `> ${fr.seo.accueil.resume}`,
    '',
    `${site.nom} (nom légal : ${site.nomLegal}) est une boîte de production vidéo et un vidéaste corporatif établi dans le Grand Montréal et les Laurentides, au service de tout le Québec (Canada). Fondateur : JD. Phrase centrale : « ${fr.hero.sousTitre} »`,
    '',
    `Mission : ${fr.mission}`,
    '',
    '## Façon de travailler',
    `- ${fr.surMesure}`,
    `- Délai de livraison : ${site.delaiLivraison.fr}, selon la complexité.`,
    '',
    '## Ce que nous créons',
    ...portfolio.categories.map((c) => `- ${c.titre.fr} : ${c.texte.fr}`),
    '',
    '## Services',
    ...fr.services.items.filter(shown).map((s) => `- ${s.titre} : ${s.texte}`),
    '',
    '## Équipe',
    ...fr.equipe.membres.map((m) => `- ${m.nomComplet}${m.nom !== m.nomComplet ? ` (${m.nom})` : ''}, ${m.role} : ${m.texte}`),
    '',
    '## Clients filmés',
    ...portfolio.clients.map((c) => `- ${c.nom}${c.villes?.length ? `, ${c.villes.join(', ')}` : ''}${c.url ? ` (${c.url})` : ''} (${visibleVideos(clientVideos(c)).length} vidéos)${CLIENTS.includes(c) ? ` : ${abs(clientRoute(c).fr)}` : ''}`),
    `- ${fr.portfolio.coulissesPage.titre} (${visibleVideos(coulissesVideos()).length} vidéos) : ${abs(coulissesRoute.fr)}`,
    '',
    '## Zones desservies',
    ...site.zonesDesservies.map((z) => `- ${z}`),
    `- ${fr.contact.deplacement}`,
    '',
    '## Heures',
    `- Du lundi au dimanche, ${fr.contact.heures}.`,
    '',
    '## Repères',
    `- Date de fondation : ${site.dateFondation}`,
    '',
    '## Pages (français)',
    ...pageLinks(fr, 'fr'),
    '',
    '## Zones desservies (pages locales)',
    ...ZONES.map((z) => `- [${z.fr.h1}](${abs(z.fr.route)}) : ${z.fr.intro}`),
    '',
    '## Contact',
    `- Courriel : ${site.courriel}`,
    ...(site.telephone ? [`- Téléphone : ${site.telephone}`] : []),
    `- Formulaire : ${abs(ROUTES.contact.fr)}`,
    ...site.reseaux.map((r) => `- ${r.nom} : ${r.url}`),
  ];
  const faq = fr.faq.items.filter((f) => known(f.r) && !f.note);
  if (faq.length) lines.push('', '## Questions fréquentes', ...faq.flatMap((f) => ['', `### ${f.q}`, f.r]));
  lines.push(
    '',
    '## English',
    '',
    en.seo.accueil.resume,
    '',
    `Mission: ${en.mission}`,
    '',
    ...pageLinks(en, 'en'),
    '',
    '### Service areas',
    ...ZONES.map((z) => `- [${z.en.h1}](${abs(z.en.route)}): ${z.en.intro}`),
    '',
    `- Services: ${en.services.items.filter(shown).map((s) => s.titre).join('; ')}`,
    `- Team: ${en.equipe.membres.map((m) => `${m.nom} (${m.role})`).join(', ')}`,
    `- Areas served: ${en.contact.zone}. ${en.contact.deplacement}`,
    `- Hours: Monday to Sunday, ${en.contact.heures}`,
    `- Founded: ${site.dateFondation}`,
    `- How we work: ${en.surMesure} Delivery time: ${site.delaiLivraison.en}, depending on complexity.`,
    `- Email: ${site.courriel}`,
    ...(site.telephone ? [`- Phone: ${site.telephone}`] : []),
    '',
    '## Optional',
    `- [Sitemap](${abs('/sitemap.xml')})`
  );
  return lines.join('\n') + '\n';
}

// ---------- génération ----------
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(ROOT, 'static'), OUT, { recursive: true });
cpSync(join(ROOT, 'src'), OUT, { recursive: true });
if (partFiles('.css').length) writeFileSync(join(OUT, 'styles.css'), CSS_SOURCE);
if (partFiles('.js').length)
  writeFileSync(join(OUT, 'main.js'), [readFileSync(join(ROOT, 'src', 'main.js'), 'utf8'), ...partFiles('.js').map((f) => readFileSync(join(PARTS_DIR, f), 'utf8'))].join('\n'));

for (const lang of ['fr', 'en']) {
  const L = langs[lang];
  write(ROUTES.accueil[lang], homePage(lang));
  write(ROUTES.services[lang], servicesPage(lang));
  write(ROUTES.portfolio[lang], portfolioPage(lang));
  for (const c of CLIENTS) write(clientRoute(c)[lang], clientPage(c, lang));
  write(coulissesRoute[lang], coulissesPage(lang));
  write(ROUTES.apropos[lang], aboutPage(lang));
  write(ROUTES.contact[lang], contactPage(lang));
  write(ROUTES.merci[lang], messagePage(lang, 'merci', L.merci));
  for (const z of ZONES) write(z[lang].route, zonePage(z, lang));
}
write('/404.html', notFoundPage('fr'));
write('/en/404.html', notFoundPage('en'));

write('/sitemap.xml', sitemap());
write('/llms.txt', llmsTxt());
write(
  '/robots.txt',
  ALLOW_INDEX
    ? `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`
    : `# Démo : indexation désactivée (VMM_ALLOW_INDEX n'est pas "true")\nUser-agent: *\nDisallow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`
);
write(
  '/_headers',
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
${ALLOW_INDEX ? '' : '  X-Robots-Tag: noindex, nofollow\n'}
/images/*
  Cache-Control: public, max-age=31536000, immutable
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/videos/*
  Cache-Control: public, max-age=604800
`
);
// Redirections 301 forcées (301!) de l'ancien site (URL sans préfixe = anglais, /fr/... = français), en UN seul saut :
// chaque destination est l'adresse finale avec slash (pas de 2e redirection /services → /services/).
// Netlify ignore le slash final dans les règles : « /process » couvre aussi « /process/ ».
// /services, /about et /contact (anciennes pages EN) ne sont PAS redirigées : ce sont aussi les adresses des
// nouvelles pages FR, et une règle forcée rendrait ces pages FR inaccessibles. Elles servent donc la page FR,
// qui a le bouton EN et le hreflang vers /en/services/, /en/about/ et /en/contact/.
const OLD_REDIRECTS = [
  // ancien anglais
  ['/work', '/en/portfolio/'],
  ['/work/*', '/en/portfolio/'],
  ['/process', '/en/services/'],
  ['/pricing', '/en/contact/'],
  // ancien français
  ['/fr', '/'],
  ['/fr/services', '/services/'],
  ['/fr/about', '/about/'],
  ['/fr/contact', '/contact/'],
  ['/fr/work', '/portfolio/'],
  ['/fr/work/*', '/portfolio/'],
  ['/fr/process', '/services/'],
  ['/fr/pricing', '/contact/'],
  ['/fr/*', '/:splat'],
  // anciennes variantes déjà redirigées avant cette version
  ['/en/work', '/en/portfolio/'],
  ['/en/process', '/en/services/'],
  ['/en/pricing', '/en/contact/'],
  ['/a-propos', '/about/'],
];
// Domaine : www et l'adresse Netlify vers videosmakemoney.ca (forcé). Seulement au lancement (indexation activée,
// contexte production) : avant, la démo vmm-prod.netlify.app doit rester consultable. Les deploy previews
// (deploy-preview-N--vmm-prod.netlify.app) ont un autre nom d'hôte et ne sont jamais touchés par ces règles.
const DOMAIN_REDIRECTS = ALLOW_INDEX
  ? ['https://www.videosmakemoney.ca/*', 'https://vmm-prod.netlify.app/*'].map((from) => [from, `${SITE_URL}/:splat`, '301!'])
  : [];
const col = (rows) => {
  const w = Math.max(...rows.map((r) => r[0].length)) + 2;
  const w2 = Math.max(...rows.map((r) => r[1].length)) + 2;
  return rows.map(([a, b, c = '301!']) => `${a.padEnd(w)}${b.padEnd(w2)}${c}`).join('\n');
};
write(
  '/_redirects',
  `${DOMAIN_REDIRECTS.length ? `# Domaine principal (301 forcé)\n${col(DOMAIN_REDIRECTS)}\n\n` : ''}# Anciennes pages (301 forcé, un seul saut)
${col(OLD_REDIRECTS)}

# Page 404 en anglais pour les adresses /en/... (le 404.html racine est en français)
/en/*         /en/404.html     404
`
);

console.log(`Site généré dans dist/ (${SITE_URL}, indexation ${ALLOW_INDEX ? 'ACTIVÉE' : 'désactivée'})`);
