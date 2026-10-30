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
const SITE_URL = (process.env.SITE_URL || site.siteUrl).replace(/\/$/, '');
const ALLOW_INDEX = process.env.VMM_ALLOW_INDEX === 'true';
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
const LOGO = {
  src: '/logo/vmm-logo-face.webp?v=4',
  png: '/logo/vmm-logo-face.png?v=4',
  width: 444,
  height: 281,
};

// Clips de fond de JD (content/clips.json) : <nom>.mp4, <nom>.webm, <nom>-poster.jpg dans static/videos/jd/.
const clipFiles = (name) => (name ? { mp4: `${clips.dossier}${name}.mp4`, webm: `${clips.dossier}${name}.webm`, poster: `${clips.dossier}${name}-poster.jpg` } : null);

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
  return `<div class="bg-video" data-bg-video${ordi ? '' : ' data-portrait-ordi'} aria-hidden="true"
    data-mobile-mp4="${mobile.mp4}" data-mobile-webm="${mobile.webm}" data-mobile-poster="${mobile.poster}"
    data-ordi-mp4="${desk.mp4}" data-ordi-webm="${desk.webm}" data-ordi-poster="${desk.poster}">
    ${ordi ? '' : `<video class="bg-video-blur" muted loop playsinline preload="none" poster="${desk.poster}"></video>`}
    <video class="bg-video-media" muted loop playsinline preload="none" poster="${mobile.poster}"></video>
    <span class="bg-video-veil"></span>
  </div>`;
}

// ---------- utilitaires ----------
const PLACEHOLDER = /\[(?:À CONFIRMER|TO CONFIRM)[^\]]*\]/g;
const isPlaceholder = (s) => !s || /\[(?:À CONFIRMER|TO CONFIRM)/.test(s);
const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Texte affiché : échappé, et les placeholders sont rendus bien visibles.
const t = (s = '') => esc(s).replace(PLACEHOLDER, (m) => `<span class="tbc">${m}</span>`);
const note = (s) => (s ? ` ${t(s)}` : '');
const abs = (p) => SITE_URL + p;
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

// Titres : un mot composé (bandes-annonces, post-production) ne se coupe pas au trait d'union
const keepCompounds = (html) => html.replace(/<(h[1-3])\b[^>]*>[\s\S]*?<\/\1>/g, (h) =>
  h.replace(/>([^<]+)</g, (m, text) => '>' + text.replace(/[^\s-]+(?:-[^\s-]+)+/g, (w) => `<span class="nowrap">${w}</span>`) + '<'));

// h1 et h2 : texte blanc, dernier mot en dégradé violet (<span class="accent">), posé au build pour éviter un flash.
// Les placeholders [À CONFIRMER] (.tbc) sont ignorés ; un mot composé garde son <span class="nowrap">.
const accentLast = (html) => html.replace(/<(h[12])\b([^>]*)>([\s\S]*?)<\/\1>/g, (all, tag, attrs, inner) => {
  const parts = inner.split(/(<[^>]+>)/);
  const skip = new Array(parts.length).fill(false);
  for (let i = 0, depth = 0, inTbc = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith('<')) {
      if (/^<span\b/.test(p)) { depth++; if (inTbc || /class="tbc"/.test(p)) inTbc++; }
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

function videoObject(v, lang) {
  const name = videoName(v, lang);
  return {
    '@type': 'VideoObject',
    name: `${name} | VMM Productions`,
    description: v.client
      ? lang === 'fr' ? `Vidéo réalisée par VMM Productions pour ${v.client}.` : `Video produced by VMM Productions for ${v.client}.`
      : lang === 'fr' ? 'Coulisses de tournage de VMM Productions.' : 'Behind the scenes of a VMM Productions shoot.',
    thumbnailUrl: ytThumb(v.youtubeId),
    embedUrl: ytEmbed(v.youtubeId),
    url: ytUrl(v),
    ...(v.dateMiseEnLigne ? { uploadDate: v.dateMiseEnLigne } : {}),
    ...(v.langue ? { inLanguage: v.langue === 'en' ? 'en-CA' : 'fr-CA' } : {}),
    publisher: { '@id': `${SITE_URL}/#entreprise` },
  };
}

// ---------- JSON-LD ----------
function structuredData(key, lang, pageVideos = [], page = null) {
  const L = langs[lang];
  const biz = `${SITE_URL}/#entreprise`;
  const persons = L.equipe.membres.map((m) => {
    const bio = L.apropos.membres.find((b) => b.id === m.id);
    return {
      '@type': 'Person',
      '@id': `${SITE_URL}/#${m.id}`,
      name: m.nomComplet,
      alternateName: m.nom,
      jobTitle: m.role,
      worksFor: { '@id': biz },
      ...(bio && !isPlaceholder(bio.note) ? { description: bio.texte } : {}),
      ...(m.photo ? { image: abs(m.photo) } : {}),
    };
  });
  const a = site.adresse;
  const business = {
    '@type': ['LocalBusiness', 'ProfessionalService'],
    '@id': biz,
    name: site.nom,
    legalName: site.nomLegal,
    alternateName: site.marque,
    slogan: L.hero.sousTitre,
    description: L.seo.accueil.description,
    url: SITE_URL + '/',
    email: site.courriel,
    ...(site.telephone ? { telephone: site.telephone } : {}),
    ...(a.ville
      ? { address: { '@type': 'PostalAddress', streetAddress: a.rue, addressLocality: a.ville, addressRegion: a.region, postalCode: a.codePostal, addressCountry: a.pays } }
      : {}),
    areaServed: [
      { '@type': 'AdministrativeArea', name: 'Grand Montréal' },
      { '@type': 'City', name: 'Montréal' },
      { '@type': 'AdministrativeArea', name: 'Laurentides' },
    ],
    knowsAbout: L.services.items.map((s) => s.titre),
    founder: { '@id': `${SITE_URL}/#jd` },
    employee: persons.map((p) => ({ '@id': p['@id'] })),
    sameAs: site.reseaux.map((r) => r.url),
  };
  const seo = page?.seo || L.seo[key];
  const pageUrl = abs((page?.route || ROUTES[key])[lang]);
  const crumbs = [{ name: L.nav.accueil, url: abs(ROUTES.accueil[lang]) }];
  if (key !== 'accueil') crumbs.push({ name: L.nav[key] || L[key]?.titre || '', url: abs(ROUTES[key][lang]) });
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
      breadcrumb: { '@id': pageUrl + '#fil' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': pageUrl + '#fil',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
    },
    ...pageVideos.filter((v) => v.youtubeId).map((v) => videoObject(v, lang)),
  ];
  if (key === 'contact') {
    const faq = L.faq.items.filter((f) => !isPlaceholder(f.r));
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
// page : pour une page sans clé propre (page client) : { route, seo, crumb }.
function layout({ key, lang, body, videos = [], page = null }) {
  const L = langs[lang];
  const other = lang === 'fr' ? 'en' : 'fr';
  const routed = Boolean(page?.route || ROUTES[key]);
  const route = page?.route || ROUTES[key] || ROUTES.accueil;
  const seo = page?.seo || L.seo[key];
  const indexable = INDEXABLE.includes(key) && ALLOW_INDEX;
  const navLink = (k) => `<li><a href="${ROUTES[k][lang]}"${k === key ? ' aria-current="page"' : ''}>${esc(L.nav[k])}</a></li>`;
  const ogImage = site.heroVideo.poster ? abs(site.heroVideo.poster) : '';

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
${routed ? `<meta property="og:url" content="${abs(route[lang])}">\n` : ''}${ogImage ? `<meta property="og:image" content="${ogImage}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/cinzel-latin-900-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&family=JetBrains+Mono:wght@600;700&family=Space+Grotesk:wght@400;500;600&family=Syne:wght@700;800;900&display=swap">
<link rel="stylesheet" href="/styles.css?v=${BUILD_ID}">
${INDEXABLE.includes(key) ? structuredData(key, lang, videos, page) : ''}
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
${L.avisTraduction ? `<div class="notice">${t(L.avisTraduction)}</div>` : ''}
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
        <li><a class="lang-switch" href="${route[other]}" hreflang="${langs[other].lang}" lang="${langs[other].lang}" aria-label="${esc(L.nav.autreLangueNom)}">${esc(L.nav.autreLangue)}</a></li>
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
      <p class="muted">${esc(site.nomLegal)} · ${esc(L.contact.zone)}</p>
      <p><a href="mailto:${site.courriel}">${esc(site.courriel)}</a></p>
    </div>
    <div>
      <p class="label">${esc(L.contact.suivre)}</p>
      ${socials()}
    </div>
  </div>
  <p class="container muted small">© ${new Date().getFullYear()} ${esc(site.nomLegal)}. ${esc(L.pied.droits)}</p>
</footer>
<dialog class="lightbox" aria-label="${esc(L.lightbox.titre)}">
  <button class="lightbox-close" type="button" aria-label="${esc(L.lightbox.fermer)}">×</button>
  <div class="lightbox-frame"></div>
  <p class="lightbox-missing" hidden>${t(L.lightbox.manquante)}</p>
</dialog>
<script src="/vendor/gsap.min.js" defer></script>
<script src="/vendor/ScrollTrigger.min.js" defer></script>
<script src="/vendor/lenis.min.js" defer></script>
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

const sectionHead = (label, title, intro, id, tag = 'h2') => `<p class="label" data-reveal>${esc(label)}</p>
    <${tag} id="${id}" data-reveal>${t(title)}</${tag}>
    ${intro ? `<p class="intro" data-reveal>${t(intro)}</p>` : ''}`;

const pageHead = (title, intro, clip = '') => `<section class="page-hero${clip ? ' has-bg-video' : ''}">
  ${clip ? bgVideo(clip) : ''}
  <div class="container">
    <h1 data-reveal>${t(title)}</h1>
    <p class="intro" data-reveal>${t(intro)}</p>
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
      ${sectionHead(L.contact.etiquette, L.contact.titre, L.contact.texte, id, tag)}
      <dl class="contact-details" data-reveal>
        <div><dt class="label">${esc(L.contact.courrielLabel)}</dt><dd><a href="mailto:${site.courriel}">${esc(site.courriel)}</a></dd></div>
        <div><dt class="label">${esc(L.contact.zoneLabel)}</dt><dd>${esc(L.contact.zone)}</dd></div>
      </dl>
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
        ${site.budgets.map((b) => `<option>${esc(b)}</option>`).join('\n        ')}
      </select>
      ${site.budgets.some(isPlaceholder) ? `<p class="small">${t(site.budgets.find(isPlaceholder))}</p>` : ''}
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
  const body = `
<section class="hero" aria-labelledby="hero-title">
  <div class="hero-media" aria-hidden="true">
    <video class="hero-video" autoplay muted loop playsinline preload="metadata"${hv.poster ? ` poster="${hv.poster}"` : ''}>
      ${hv.mobileWebm ? `<source src="${hv.mobileWebm}" type="video/webm" media="(max-width: 767px)">` : ''}
      <source src="${hv.mobile}" type="video/mp4" media="(max-width: 767px)">
      ${hv.ordiWebm ? `<source src="${hv.ordiWebm}" type="video/webm">` : ''}
      <source src="${hv.ordi}" type="video/mp4">
    </video>
    <div class="hero-vignette"></div>
    <div class="halo halo-violet"></div>
    <div class="halo halo-rose"></div>
    <div class="leak leak-violet"></div>
    <div class="leak leak-rose"></div>
    <div class="leak leak-bleu"></div>
  </div>
  <div class="container hero-content">
    <p class="label hero-kicker" data-reveal>${esc(L.hero.surtitre)}</p>
    <h1 id="hero-title" class="hero-title" data-reveal>${t(L.hero.titre)}</h1>
    <p class="hero-sub" data-reveal>${t(L.hero.sousTitre)}</p>
    <p class="hero-text" data-reveal>${t(L.hero.texte)}</p>
    <a class="btn btn-neon" href="#contact" data-scroll-contact data-reveal>${esc(L.hero.bouton)}</a>
    ${hv.poster ? '' : `<p class="hero-missing small">${t(L.hero.posterManquant)}</p>`}
  </div>
  <button class="hero-toggle" type="button" aria-pressed="false" data-pause="${esc(L.hero.pause)}" data-play="${esc(L.hero.lecture)}" aria-label="${esc(L.hero.pause)}"><span aria-hidden="true">❚❚</span></button>
</section>

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
  return layout({ key: 'accueil', lang, body, videos: [...catVideos.filter(Boolean), ...vedettes] });
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

// Icônes des 6 services (Lucide, ISC), en trait, dans l'ordre de content/*.json → services.items.
const SERVICE_ICONS = ['video', 'camera', 'drone', 'clapperboard', 'scissors', 'sparkles'];
function serviceIcon(i) {
  const svg = readFileSync(join(ROOT, 'icons', 'lucide', `${SERVICE_ICONS[i]}.svg`), 'utf8');
  // Formes du SVG, avec pathLength pour l'animation de tracé (svc-stroke)
  const shapes = svg
    .slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'))
    .trim()
    .split('\n')
    .map((l) => l.trim().replace(/\s*\/>$/, ' pathLength="300" />'))
    .join('');
  return `<svg class="svc-icon" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes}</svg>`;
}

function servicesPage(lang) {
  const L = langs[lang];
  const S = L.services;
  // Sur ordi, main.js passe à la vidéo « scroll » et la cale sur le défilement ; sinon, boucle
  const camera = `<section class="camera-scrub" aria-labelledby="camera-title" data-scrub>
  <div class="camera-stage">
    <h2 id="camera-title" data-reveal>${t(S.camera.titre)}</h2>
    <video class="camera-video" muted playsinline preload="none" poster="${CAMERA.poster}" width="${CAMERA.width}" height="${CAMERA.height}" aria-label="${esc(S.camera.videoLabel)}" data-scroll-webm="${CAMERA.scroll.webm}" data-scroll-mp4="${CAMERA.scroll.mp4}">
      <source src="${CAMERA.loop.webm}" type="video/webm">
      <source src="${CAMERA.loop.mp4}" type="video/mp4">
    </video>
  </div>
</section>`;
  const body = `${pageHead(S.titre, S.intro, 'services')}
${camera}
<section class="section section-tight" aria-label="${esc(L.nav.services)}">
  <div class="container">
    <ol class="grid grid-3 services">
      ${S.items
        .map((s, i) => {
          const n = String(i + 1).padStart(2, '0');
          return `<li class="card glass service" data-reveal>
        ${serviceIcon(i)}
        <h2>${t(s.titre)}</h2>
        <p class="muted">${t(s.texte)}</p>
      </li>`;
        })
        .join('\n      ')}
    </ol>
    <p class="cta-row"><a class="btn btn-neon" href="${ROUTES.portfolio[lang]}">${esc(S.bouton)}</a></p>
  </div>
</section>`;
  return layout({ key: 'services', lang, body });
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
  const body = `${pageHead(P.titre, P.intro, 'work')}
<section class="section section-tight" aria-labelledby="clients-title">
  <div class="container">
    <h2 id="clients-title" data-reveal>${esc(P.parClientTitre)}</h2>
    <p class="intro" data-reveal>${t(P.parClientIntro)}</p>
    <ul class="grid grid-4 client-cards">
      ${CLIENTS.map((c) => {
        const img = clientImage(c);
        return `<li data-reveal>
        <a class="client-card card glass" href="${clientRoute(c)[lang]}">
          <span class="client-card-img">${img ? `<img src="${img}" alt="" loading="lazy" decoding="async">` : '<span class="thumb-empty" aria-hidden="true"></span>'}</span>
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
  return layout({ key: 'portfolio', lang, body, videos: portfolio.videos.filter((v) => v.vedette || v.type === 'coulisses') });
}

// Page d'un client : bande-annonce en fond (si le client a un clip), puis toutes ses vidéos.
function clientPage(c, lang) {
  const L = langs[lang];
  const P = L.portfolio;
  const list = clientVideos(c);
  const n = list.length;
  const fill = (s) => s.replaceAll('{client}', c.nom);
  const back = `<a class="btn btn-neon btn-back" href="${ROUTES.portfolio[lang]}">${esc(P.retour)}</a>`;
  const body = `<section class="page-hero client-hero${c.clip ? ' has-bg-video' : ''}">
  ${c.clip ? bgVideo(c.clip) : ''}
  <div class="container">
    <p class="back-row" data-reveal>${back}</p>
    <h1 data-reveal>${esc(c.nom)}</h1>
    <p class="intro" data-reveal>${n} ${n > 1 ? P.videos : P.video}${note(c.note)}</p>
  </div>
</section>
<section class="section section-tight" aria-label="${esc(c.nom)}">
  <div class="container">
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
    page: { route: clientRoute(c), seo: { title: fill(P.clientSeoTitre), description: fill(P.clientSeoDescription) }, crumb: c.nom },
  });
}

function slug(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function aboutPage(lang) {
  const L = langs[lang];
  const A = L.apropos;
  const body = `${pageHead(A.titre, A.intro)}
<section class="section section-tight" aria-label="${esc(L.equipe.titre)}">
  <div class="container about">
    ${A.membres
      .map((b) => {
        const m = L.equipe.membres.find((x) => x.id === b.id);
        return `<article class="card glass member member-large" id="${b.id}" data-reveal>
      ${memberPhoto(m, L)}
      <div class="member-text">
        <h2>${esc(b.titre)}</h2>
        <p class="role">${t(m.role)}</p>
        <p>${t(b.texte)}</p>
        ${b.note ? `<p class="small">${t(b.note)}</p>` : ''}
      </div>
    </article>`;
      })
      .join('\n    ')}
    <p data-reveal>${t(A.bluewise)}</p>
    <p class="cta-row"><a class="btn btn-neon" href="${ROUTES.contact[lang]}">${esc(A.bouton)}</a></p>
  </div>
</section>`;
  return layout({ key: 'apropos', lang, body });
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
    ${L.faq.items.map((f) => `<details data-reveal><summary>${t(f.q)}</summary><p>${t(f.r)}</p>${f.note ? `<p class="small">${t(f.note)}</p>` : ''}</details>`).join('\n    ')}
  </div>
</section>`;
  return layout({ key: 'contact', lang, body });
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

// ---------- fichiers SEO/GEO ----------
function sitemap() {
  const xml = (s) => esc(s);
  // Vidéos d'une page : une liste, ou la clé d'une page (portfolio : vedettes et coulisses ; les autres sont sur les pages clients)
  const videoEntries = (key, lang) => {
    const list = Array.isArray(key) ? key : key === 'portfolio' ? portfolio.videos.filter((v) => v.vedette || v.type === 'coulisses') : [];
    return list
      .filter((v) => v.youtubeId)
      .map((v) => {
        const o = videoObject(v, lang);
        return `
    <video:video>
      <video:thumbnail_loc>${xml(o.thumbnailUrl)}</video:thumbnail_loc>
      <video:title>${xml(o.name)}</video:title>
      <video:description>${xml(o.description)}</video:description>
      <video:player_loc>${xml(o.embedUrl)}</video:player_loc>
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
    ...INDEXABLE.flatMap((k) => ['fr', 'en'].map((lang) => entry(ROUTES[k], lang, videoEntries(k, lang)))),
    ...CLIENTS.flatMap((c) => ['fr', 'en'].map((lang) => entry(clientRoute(c), lang, videoEntries(clientVideos(c), lang)))),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls.join('\n')}
</urlset>
`;
}

function llmsTxt() {
  const fr = langs.fr;
  const known = (s) => !isPlaceholder(s);
  const lines = [
    `# ${site.nom} (${site.marque})`,
    '',
    `> ${fr.seo.accueil.description}`,
    '',
    `${site.nomLegal} est une boîte de production vidéo et un vidéaste corporatif établi dans le Grand Montréal et les Laurentides (Québec, Canada). Fondateur : JD (Jean-David). Phrase centrale : « ${fr.hero.sousTitre} »`,
    '',
    '## Ce que nous créons',
    ...portfolio.categories.map((c) => `- ${c.titre.fr} : ${c.texte.fr}`),
    '',
    '## Services',
    ...fr.services.items.map((s) => `- ${s.titre} : ${s.texte}`),
    '',
    '## Équipe',
    ...fr.equipe.membres.map((m) => `- ${m.nomComplet} (${m.nom}), ${m.role} : ${m.texte}`),
    '',
    '## Clients filmés',
    ...portfolio.clients.map((c) => `- ${c.nom} (${clientVideos(c).length} vidéos)${CLIENTS.includes(c) ? ` : ${abs(clientRoute(c).fr)}` : ''}`),
    '',
    '## Zones desservies',
    ...site.zonesDesservies.map((z) => `- ${z}`),
    '',
    '## Pages',
    ...INDEXABLE.map((k) => `- [${fr.nav[k]}](${abs(ROUTES[k].fr)}) · [EN](${abs(ROUTES[k].en)})`),
    '',
    '## Contact',
    `- Courriel : ${site.courriel}`,
    `- Formulaire : ${abs(ROUTES.contact.fr)}`,
    ...site.reseaux.map((r) => `- ${r.nom} : ${r.url}`),
  ];
  const faq = fr.faq.items.filter((f) => known(f.r) && !f.note);
  if (faq.length) lines.push('', '## Questions fréquentes', ...faq.flatMap((f) => ['', `### ${f.q}`, f.r]));
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
}
write('/404.html', messagePage('fr', 'introuvable', langs.fr.introuvable));

write('/sitemap.xml', sitemap());
write('/llms.txt', llmsTxt());
write(
  '/robots.txt',
  ALLOW_INDEX
    ? `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`
    : `# Démo : indexation désactivée (VMM_ALLOW_INDEX n'est pas "true")\nUser-agent: *\nDisallow: /\n`
);
write(
  '/_headers',
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
${ALLOW_INDEX ? '' : '  X-Robots-Tag: noindex, nofollow\n'}
/images/*
  Cache-Control: public, max-age=31536000, immutable
`
);
write(
  '/_redirects',
  `# Anciennes pages (301)
/work         /portfolio/      301
/work/*       /portfolio/      301
/process      /services/       301
/pricing      /contact/        301
/fr           /                301
/fr/*         /:splat          301
/en/work      /en/portfolio/   301
/en/process   /en/services/    301
/en/pricing   /en/contact/     301
/a-propos     /about/          301
`
);

console.log(`Site généré dans dist/ (${SITE_URL}, indexation ${ALLOW_INDEX ? 'ACTIVÉE' : 'désactivée'})`);
