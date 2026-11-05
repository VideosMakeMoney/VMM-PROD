// Génère le site statique (dist/) à partir de content/*.json.
// Aucune dépendance : `node build.mjs`.
//
// Variables d'environnement :
//   SITE_URL         URL canonique (défaut : siteUrl de content/site.json)
//   VMM_ALLOW_INDEX  "true" seulement pour la mise en ligne sur videosmakemoney.ca.
//                    Sinon, le site est servi en noindex (démo Netlify).

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
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
const h1Seo = (text) => (text ? `<span class="h1-sub">${esc(text)}</span>` : '');

// Feuille de style en ligne dans chaque page (≈ 10 Ko compressée) : aucune requête ne bloque le premier affichage.
// src/styles.css reste la source (et est toujours copiée dans dist/).
const CSS = readFileSync(join(ROOT, 'src', 'styles.css'), 'utf8')
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
const categoryVideo = (cat) =>
  portfolio.videos.find((v) => v.vedette && v.categorie === cat.id) ||
  (cat.videoAccueil && (portfolio.videos.find((v) => v.youtubeId === cat.videoAccueil) || { youtubeId: cat.videoAccueil, vertical: true, titre: '', client: '', rang: 1 })) ||
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
    sameAs: site.reseaux.map((r) => r.url),
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
function layout({ key, lang, body, videos = [], page = null, preload = '' }) {
  if (preload) preload += '\n';
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
  }<meta name="theme-color" content="#08080f">
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
${preload}<link rel="preload" href="/fonts/cinzel-latin-900-normal.woff2" as="font" type="font/woff2" crossorigin>
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
      </ul>
    </nav>
  </div>
</header>
<main id="contenu">
${body}
</main>
<footer class="site-footer">
  <div class="container footer-inner">
    <div>
      <p class="logo">VMM<span>.</span></p>
      <p class="muted">${t(L.pied.slogan)}</p>
      <p class="muted">${esc(FOOTER_NAME)} · ${esc(L.contact.zone)}</p>
      <p><a href="mailto:${site.courriel}">${esc(site.courriel)}</a></p>
      ${TEL ? `<p><a href="${TEL.href}">${esc(TEL.affiche)}</a></p>` : ''}
    </div>
    <div>
      <p class="label">${esc(L.contact.suivre)}</p>
      ${socials()}
    </div>
    <nav aria-label="${esc(L.pied.zones)}">
      <p class="label">${esc(L.pied.zones)}</p>
      <ul class="socials footer-zones">
        ${ZONES.map((z) => `<li><a href="${z[lang].route}"${page?.zone === z ? ' aria-current="page"' : ''}>${esc(z[lang].lien)}</a></li>`).join('\n        ')}
      </ul>
    </nav>
  </div>
  <p class="container muted small">© ${esc(FOOTER_NAME)}. ${esc(L.pied.droits)}</p>
</footer>
<dialog class="lightbox" aria-label="${esc(L.lightbox.titre)}">
  <button class="lightbox-close" type="button" aria-label="${esc(L.lightbox.fermer)}">×</button>
  <div class="lightbox-frame"></div>
  <p class="lightbox-missing" hidden>${t(L.lightbox.manquante)}</p>
</dialog>
<!-- GSAP, ScrollTrigger et Lenis (src/vendor/) sont chargés par main.js après l'affichage de la page -->
<script src="/main.js?v=${BUILD_ID}" defer></script>
</body>
</html>
`;
}

// Icônes officielles des réseaux (Simple Icons, CC0), en ligne. Blanches ; dégradé du site au survol.
const SOCIAL_ICON_FILE = { Instagram: 'instagram', TikTok: 'tiktok', YouTube: 'youtube', Facebook: 'facebook', X: 'x' };
function socialIcon(nom, suffix) {
  const file = SOCIAL_ICON_FILE[nom];
  if (!file) return '';
  const svg = readFileSync(join(ROOT, 'icons', 'simple-icons', `${file}.svg`), 'utf8');
  const d = svg.match(/<path d="([^"]+)"/)[1];
  const id = `si-${file}-${suffix}`;
  return `<svg class="social-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="0"><stop offset="0" stop-color="#7C3AED"/><stop offset=".45" stop-color="#3B5BFF"/><stop offset="1" stop-color="#FF3CAC"/></linearGradient></defs><path d="${d}" style="--icon-hover: url(#${id})"/></svg>`;
}

const socials = ({ icons = false, suffix = '' } = {}) =>
  `<ul class="socials">
        ${site.reseaux.map((r) => `<li><a href="${esc(r.url)}" rel="me noopener" target="_blank">${icons ? socialIcon(r.nom, suffix) : ''}${esc(r.nom)}</a></li>`).join('\n        ')}
      </ul>`;

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
function videoTile(v, lang, { shape = 'vertical', caption = true, missing } = {}) {
  const L = langs[lang];
  if (!v || !v.youtubeId) {
    const name = v?.titre || '';
    return `<button type="button" class="tile tile-${shape}" data-video="" aria-label="${esc(L.lightbox.voir)}${name ? ` : ${esc(name)}` : ''}">
          <span class="thumb"><span class="thumb-empty" aria-hidden="true"></span><span class="play" aria-hidden="true">▶</span></span>
          ${caption ? `<span class="tile-caption">${name ? `<strong>${esc(name)}</strong>` : ''}${v?.client ? `<span class="muted">${esc(v.client)}</span>` : ''}${t(v?.note || missing || L.lightbox.manquante)}</span>` : ''}
        </button>`;
  }
  const name = videoName(v, lang);
  return `<a href="${ytUrl(v)}" target="_blank" rel="noopener" class="tile tile-${shape}" data-video="${esc(v.youtubeId)}" data-vertical="${v.vertical ? '1' : '0'}" aria-label="${esc(L.lightbox.voir)} : ${esc(name)}">
          <span class="thumb"><img src="${ytThumb(v.youtubeId)}" alt="" loading="lazy" decoding="async" width="480" height="360"><span class="play" aria-hidden="true">▶</span></span>
          ${
            caption
              ? `<span class="tile-caption">${v.titre ? `<strong>${esc(v.titre)}</strong>` : t(L.portfolio.titreManquant)}${v.client ? `<span class="muted">${esc(v.client)}</span>` : ''}${note(v.note)}</span>`
              : ''
          }
        </a>`;
}

// ---------- composant Contact (accueil et page Contact) ----------
function contactBlock(lang, { tag = 'h2', id = 'contact-title' } = {}) {
  const L = langs[lang];
  const c = L.contact.champs;
  const f = (n) => `${n}-${lang}-${tag}`;
  return `<div class="container contact-grid">
    <div class="contact-info">
      ${sectionHead(L.contact.etiquette, L.contact.titre, L.contact.texte, id, tag, L.seo.contact.h1)}
      ${tag === 'h1' ? summary(L.seo.contact.resume) : ''}
      <dl class="contact-details" data-reveal>
        <div><dt class="label">${esc(L.contact.courrielLabel)}</dt><dd><a href="mailto:${site.courriel}">${esc(site.courriel)}</a></dd></div>
        ${tag === 'h1' && TEL ? `<div><dt class="label">${esc(L.contact.telephoneLabel)}</dt><dd><a href="${TEL.href}">${esc(TEL.affiche)}</a> <span class="muted">· ${esc(L.contact.heures)}</span></dd></div>` : ''}
        <div><dt class="label">${esc(L.contact.zoneLabel)}</dt><dd>${esc(L.contact.zone)}</dd></div>
      </dl>
      ${tag === 'h1' ? `<p class="muted small" data-reveal>${esc(L.contact.deplacement)}</p>` : ''}
      <div data-reveal>
        <p class="label">${esc(L.contact.suivre)}</p>
        ${socials({ icons: tag === 'h1', suffix: lang })}
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
  const slots = [...vedettes];
  while (slots.length < L.realisations.vedettesMin) slots.push(null);
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
  const body = `
<section class="hero" aria-labelledby="hero-title">
  <div class="hero-media" aria-hidden="true">
    ${heroMedia}
    <div class="hero-vignette"></div>
    <div class="halo halo-violet"></div>
    <div class="halo halo-rose"></div>
    <div class="leak leak-violet"></div>
    <div class="leak leak-rose"></div>
    <div class="leak leak-bleu"></div>
  </div>
  <div class="container hero-content">
    <p class="label hero-kicker" data-reveal>${esc(L.hero.surtitre)}</p>
    <h1 id="hero-title" class="hero-title" data-reveal>${t(L.hero.titre)}${h1Seo(L.seo.accueil.h1)}</h1>
    <p class="hero-sub" data-reveal>${t(L.hero.sousTitre)}</p>
    <p class="hero-text" data-reveal>${t(L.hero.texte)}</p>
    <a class="btn btn-neon" href="#contact" data-scroll-contact data-reveal>${esc(L.hero.bouton)}</a>
    ${hasVideo && poster || isPlaceholder(L.hero.posterManquant) ? '' : `<p class="hero-missing small">${t(L.hero.posterManquant)}</p>`}
  </div>
  ${hasVideo ? `<button class="hero-toggle" type="button" aria-pressed="false" data-pause="${esc(L.hero.pause)}" data-play="${esc(L.hero.lecture)}" aria-label="${esc(L.hero.pause)}"><span aria-hidden="true">❚❚</span></button>` : ''}
</section>
${summaryBand(L.seo.accueil.resume)}

<section class="section" id="creations" aria-labelledby="creons-title">
  <div class="container">
    ${sectionHead(L.creons.etiquette, L.creons.titre, L.creons.intro, 'creons-title')}
    <ul class="grid grid-4 cards">
      ${portfolio.categories
        .map(
          (c, i) => `<li class="card glass" data-reveal>
        ${videoTile(catVideos[i], lang, { shape: 'category', caption: false })}
        <h3>${t(c.titre[lang])}</h3>
        <p class="muted">${t(c.texte[lang])}</p>
        ${catVideos[i] ? '' : `<p class="small">${t(L.creons.videoManquante)}</p>`}
      </li>`
        )
        .join('\n      ')}
    </ul>
    <p class="cta-row"><a class="btn btn-neon" href="${ROUTES.services[lang]}">${esc(L.creons.bouton)}</a></p>
  </div>
</section>

<section class="section" id="equipe" aria-labelledby="equipe-title">
  <div class="container">
    ${sectionHead(L.equipe.etiquette, L.equipe.titre, L.equipe.intro, 'equipe-title')}
    <ul class="grid grid-2 team">
      ${L.equipe.membres.map((m) => `<li class="card glass member" data-reveal>${memberPhoto(m, L)}
        <div class="member-text">
          <h3>${esc(m.nom)}</h3>
          <p class="role">${t(m.role)}</p>
          <p class="muted">${t(m.texte)}</p>
        </div>
      </li>`).join('\n      ')}
    </ul>
    <p class="cta-row"><a class="btn btn-neon" href="${ROUTES.apropos[lang]}">${esc(L.equipe.bouton)}</a></p>
  </div>
</section>

<section class="section" id="realisations" aria-labelledby="realisations-title">
  <div class="container">
    ${sectionHead(L.realisations.etiquette, L.realisations.titre, L.realisations.intro, 'realisations-title')}
    <ul class="grid grid-4 featured">
      ${slots.map((v) => `<li data-reveal>${videoTile(v, lang, { missing: L.realisations.vedetteManquante })}</li>`).join('\n      ')}
    </ul>
    ${clientMarquee()}
    <p class="cta-row"><a class="btn btn-neon" href="${ROUTES.portfolio[lang]}">${esc(L.realisations.bouton)}</a></p>
  </div>
</section>

<section class="section section-contact" id="contact" aria-labelledby="contact-title">
  ${contactBlock(lang)}
</section>

<section class="section" id="avis" aria-labelledby="avis-title">
  <div class="container">
    ${sectionHead(L.avis.etiquette, L.avis.titre, '', 'avis-title')}
    <div class="reviews" data-reveal>${site.avisGoogle.widgetHtml || `<p>${t(L.avis.placeholder)}</p>`}</div>
  </div>
</section>`;
  return layout({ key: 'accueil', lang, body, videos: [...catVideos.filter(Boolean), ...vedettes], preload: heroPreload });
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
function fullHero(clipId, title, L, hero = null, h1 = '') {
  return `<section class="page-hero full-hero has-bg-video${hero ? ' is-top' : ''}" aria-labelledby="hero-title">
  ${bgVideo(clipId)}
  <div class="container">
    ${
      hero
        ? `<h1 id="hero-title" class="hero-stack" data-no-accent><span class="hero-line">${esc(hero.ligne1)}</span> <span class="hero-word">${esc(hero.ligne2)}</span>${h1Seo(h1)}</h1>
    ${hero.intro ? `<p class="intro hero-intro">${t(hero.intro)}</p>` : ''}`
        : `<h1 id="hero-title" class="hero-word" data-no-accent>${esc(title)}${h1Seo(h1)}</h1>`
    }
  </div>
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
      return `<section class="jd-screen svc-group" aria-labelledby="svc-${gi + 1}">
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
  const body = `${fullHero('services', S.titre, L, S.hero, L.seo.services.h1)}
${summaryBand(L.seo.services.resume)}
<section class="jd-screen jd-vision" aria-labelledby="vision-title">
  <div class="jd-wrap vision-grid">
    <div class="vision-text">
      <p class="jd-label jd-label-line" data-reveal>${esc(V.etiquette)}</p>
      <h2 id="vision-title" class="vision-title" data-reveal>${rich(V.titre)}</h2>
      <p class="jd-lead" data-reveal>${t(V.texte)}</p>
      <ul class="reperes" data-reveal>
        ${V.reperes.map((r) => `<li>${lucide(r.icone, 'repere-icon', 44)}<strong>${esc(r.titre)}</strong><span>${esc(r.texte)}</span></li>`).join('\n        ')}
      </ul>
    </div>
    <div class="vision-photo" data-reveal>
      ${picture('/img/services-jd-detoure', V.photoAlt, { w: 683, h: 1200, fallback: 'png' })}
    </div>
  </div>
</section>
${groups}
${shown(S.camera) ? camera : ''}
${shown(S.fin) ? `<section class="jd-screen jd-end" aria-labelledby="fin-title">
  <div class="jd-wrap">
    <p class="jd-label" data-reveal>${esc(S.fin.etiquette)}</p>
    <h2 id="fin-title" data-reveal data-no-accent>${t(S.fin.titre)}</h2>
    <p class="jd-lead" data-reveal>${t(S.fin.texte)}</p>
    <p class="cta-row" data-reveal><a class="btn btn-solid" href="${ROUTES.portfolio[lang]}">${esc(S.fin.bouton)}</a></p>
  </div>
</section>` : ''}
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

function portfolioPage(lang) {
  const L = langs[lang];
  const P = L.portfolio;
  const behind = portfolio.videos.filter((v) => v.type === 'coulisses');
  const count = (n) => `${n} ${n > 1 ? P.videos : P.video}`;
  const catVideos = portfolio.categories.map(categoryVideo);
  const body = `${pageHead(P.titre, P.intro, 'work', L.seo.portfolio.resume, L.seo.portfolio.h1)}
<section class="section section-tight" aria-labelledby="clients-title">
  <div class="container">
    <h2 id="clients-title" data-reveal>${esc(P.parClientTitre)}</h2>
    <p class="intro" data-reveal>${t(P.parClientIntro)}</p>
    <ul class="grid grid-4 client-cards">
      ${CLIENTS.map((c) => {
        const img = clientImage(c);
        return `<li data-reveal>
        <a class="client-card card glass" href="${clientRoute(c)[lang]}">
          <span class="client-card-img">${img ? `<img src="${img}" alt="" loading="lazy" decoding="async" width="${img.startsWith('https://i.ytimg.com') ? '480' : '1080'}" height="${img.startsWith('https://i.ytimg.com') ? '360' : '1920'}">` : '<span class="thumb-empty" aria-hidden="true"></span>'}</span>
          <span class="client-card-text"><strong>${esc(c.nom)}</strong><span class="muted">${count(clientVideos(c).length)}</span>${note(c.note)}</span>
        </a>
      </li>`;
      }).join('\n      ')}
    </ul>
    <div class="client-group upcoming" data-reveal>
      <h3>${esc(P.aVenirTitre)}</h3>
      <ul class="pills">
        ${portfolio.clientsAVenir.map((c) => `<li>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.nom)}</a>` : esc(c.nom)}${note(c.note)}</li>`).join('\n        ')}
      </ul>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="vedettes-title">
  <div class="container">
    <h2 id="vedettes-title" data-reveal>${esc(P.vedettesTitre)}</h2>
    <ul class="grid grid-4">
      ${portfolio.categories
        .map(
          (c, i) => `<li class="card glass" data-reveal>
        <h3>${t(c.titre[lang])}</h3>
        ${videoTile(catVideos[i], lang, { missing: P.vedetteManquante })}
      </li>`
        )
        .join('\n      ')}
    </ul>
  </div>
</section>

<section class="section" aria-labelledby="coulisses-title">
  <div class="container">
    <h2 id="coulisses-title" data-reveal>${esc(P.coulissesTitre)}</h2>
    <p class="intro" data-reveal>${t(P.coulissesIntro)}</p>
    <ul class="grid grid-5">
      ${behind.map((v) => `<li data-reveal>${videoTile(v, lang)}</li>`).join('\n      ')}
    </ul>
    <p class="cta-row"><a class="btn btn-neon" href="${ROUTES.apropos[lang]}">${esc(P.bouton)}</a></p>
  </div>
</section>`;
  return layout({ key: 'portfolio', lang, body, videos: portfolio.videos.filter((v) => v.vedette || v.type === 'coulisses'), preload: posterPreload('work') });
}

// Page d'un client : bande-annonce en fond (si le client a un clip), puis toutes ses vidéos.
function clientPage(c, lang) {
  const L = langs[lang];
  const P = L.portfolio;
  const list = clientVideos(c);
  const n = list.length;
  // Élision en français : « de Installations » devient « d'Installations ».
  const fill = (s) => (lang === 'fr' && /^[aeiouyàâéèêîôûh]/i.test(c.nom) ? s.replaceAll('de {client}', 'd’{client}') : s).replaceAll('{client}', c.nom);
  const back = `<a class="btn btn-neon btn-back" href="${ROUTES.portfolio[lang]}">${esc(P.retour)}</a>`;
  const body = `<section class="page-hero client-hero${c.clip ? ' has-bg-video' : ''}">
  ${c.clip ? bgVideo(c.clip) : ''}
  <div class="container">
    <p class="back-row" data-reveal>${back}</p>
    <h1 data-reveal>${esc(c.nom)}${h1Seo(fill(P.clientH1))}</h1>
    <p class="intro" data-reveal>${n} ${n > 1 ? P.videos : P.video}${note(c.note)}</p>
    ${summary(P.clientResume.replace('{n}', `${n} ${n > 1 ? P.videos : P.video}`).replace('{client}', c.nom))}
  </div>
</section>
<section class="section section-tight" aria-labelledby="videos-${clientSlug(c)}">
  <div class="container">
    <h2 id="videos-${clientSlug(c)}" class="visually-hidden">${esc(L.nav.portfolio)} · ${esc(c.nom)}</h2>
    <ul class="grid grid-5 library">
      ${list.map((v) => `<li data-reveal>${videoTile(v, lang)}</li>`).join('\n      ')}
    </ul>
    <p class="cta-row">${back}</p>
  </div>
</section>`;
  return layout({
    key: 'portfolio',
    lang,
    body,
    videos: list,
    page: { route: clientRoute(c), seo: { title: fill(P.clientSeoTitre), description: fill(P.clientSeoDescription) }, crumb: c.nom, client: c, og: existsSync(join(ROOT, 'static', 'og', `og-client-${clientSlug(c)}.jpg`)) ? `/og/og-client-${clientSlug(c)}.jpg` : '' },
    preload: c.clip ? posterPreload(c.clip) : '',
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
  const body = `<!-- ${esc(zonesData.noteProvisoire)} -->
<section class="page-hero has-bg-video zone-hero" aria-labelledby="zone-title">
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
function aboutPage(lang) {
  const L = langs[lang];
  const A = L.apropos;
  const label = `<p class="jd-label" data-reveal>${esc(A.etiquette)}</p>`;
  const members = A.membres
    .map(
      (m) => `<section class="jd-screen" id="${m.id}" aria-labelledby="${m.id}-title">
  <div class="jd-wrap">
    ${label}
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
  const body = `${fullHero('about', A.titre, L, null, L.seo.apropos.h1)}
${summaryBand(L.seo.apropos.resume)}
<section class="jd-screen jd-vision" aria-labelledby="visages-title">
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
</section>
${members}
<section class="jd-screen jd-closing" aria-labelledby="gens-title">
  <div class="jd-wrap">
    ${label}
    <h2 id="gens-title" class="vision-title" data-reveal>${rich(A.fin.titre)}</h2>
    <p class="jd-lead" data-reveal>${t(A.fin.texte)}</p>
    <p class="cta-row" data-reveal><a class="btn btn-solid" href="${ROUTES.contact[lang]}">${esc(A.fin.bouton)}</a></p>
  </div>
</section>`;
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
  // Vidéos d'une page : une liste, ou la clé d'une page (portfolio : vedettes et coulisses ; les autres sont sur les pages clients)
  const videoEntries = (key, lang, pageUrl) => {
    const list = Array.isArray(key) ? key : key === 'portfolio' ? portfolio.videos.filter((v) => v.vedette || v.type === 'coulisses') : [];
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
    ...portfolio.clients.map((c) => `- ${c.nom}${c.villes?.length ? `, ${c.villes.join(', ')}` : ''}${c.url ? ` (${c.url})` : ''} (${clientVideos(c).length} vidéos)${CLIENTS.includes(c) ? ` : ${abs(clientRoute(c).fr)}` : ''}`),
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

for (const lang of ['fr', 'en']) {
  const L = langs[lang];
  write(ROUTES.accueil[lang], homePage(lang));
  write(ROUTES.services[lang], servicesPage(lang));
  write(ROUTES.portfolio[lang], portfolioPage(lang));
  for (const c of CLIENTS) write(clientRoute(c)[lang], clientPage(c, lang));
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
`
);
// Redirections 301 de l'ancien site (URL sans préfixe = anglais, /fr/... = français), en UN seul saut :
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
  return rows.map(([a, b, c = '301']) => `${a.padEnd(w)}${b.padEnd(w2)}${c}`).join('\n');
};
write(
  '/_redirects',
  `${DOMAIN_REDIRECTS.length ? `# Domaine principal (301 forcé)\n${col(DOMAIN_REDIRECTS)}\n\n` : ''}# Anciennes pages (301, un seul saut)
${col(OLD_REDIRECTS)}

# Page 404 en anglais pour les adresses /en/... (le 404.html racine est en français)
/en/*         /en/404.html     404
`
);

console.log(`Site généré dans dist/ (${SITE_URL}, indexation ${ALLOW_INDEX ? 'ACTIVÉE' : 'désactivée'})`);
