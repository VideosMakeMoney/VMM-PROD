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

function write(path, content) {
  const file = join(OUT, path.endsWith('/') ? path + 'index.html' : path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
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
function structuredData(key, lang, pageVideos = []) {
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
  const pageUrl = abs(ROUTES[key][lang]);
  const crumbs = [{ name: L.nav.accueil, url: abs(ROUTES.accueil[lang]) }];
  if (key !== 'accueil') crumbs.push({ name: L.nav[key] || L[key]?.titre || '', url: pageUrl });
  const graph = [
    business,
    ...persons,
    { '@type': 'WebSite', '@id': `${SITE_URL}/#site`, url: SITE_URL + '/', name: site.nom, inLanguage: ['fr-CA', 'en-CA'], publisher: { '@id': biz } },
    {
      '@type': key === 'contact' ? 'ContactPage' : key === 'apropos' ? 'AboutPage' : 'WebPage',
      '@id': pageUrl + '#page',
      url: pageUrl,
      name: L.seo[key].title,
      description: L.seo[key].description,
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
function layout({ key, lang, body, videos = [] }) {
  const L = langs[lang];
  const other = lang === 'fr' ? 'en' : 'fr';
  const routed = Boolean(ROUTES[key]);
  const route = ROUTES[key] || ROUTES.accueil;
  const seo = L.seo[key];
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&family=JetBrains+Mono:wght@600;700&family=Space+Grotesk:wght@400;500;600&family=Syne:wght@700;800;900&display=swap">
<link rel="stylesheet" href="/styles.css?v=${BUILD_ID}">
${INDEXABLE.includes(key) ? structuredData(key, lang, videos) : ''}
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
    <a class="logo" href="${ROUTES.accueil[lang]}" aria-label="${esc(site.nom)}, ${esc(L.nav.accueil)}">VMM<span>.</span></a>
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

const socials = () =>
  `<ul class="socials">
        ${site.reseaux.map((r) => `<li><a href="${esc(r.url)}" rel="me noopener" target="_blank">${esc(r.nom)}</a></li>`).join('\n        ')}
      </ul>`;

const sectionHead = (label, title, intro, id, tag = 'h2') => `<p class="label" data-reveal>${esc(label)}</p>
    <${tag} id="${id}" class="gradient-text" data-reveal>${t(title)}</${tag}>
    ${intro ? `<p class="intro" data-reveal>${t(intro)}</p>` : ''}`;

const pageHead = (title, intro) => `<section class="page-hero">
  <div class="container">
    <h1 class="gradient-text" data-reveal>${t(title)}</h1>
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
        ${socials()}
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
    <h1 id="hero-title" class="hero-title gradient-text" data-reveal>${t(L.hero.titre)}</h1>
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
function serviceIcon(i, lang) {
  const svg = readFileSync(join(ROOT, 'icons', 'lucide', `${SERVICE_ICONS[i]}.svg`), 'utf8');
  // Formes du SVG, avec pathLength pour l'animation de tracé (svc-stroke)
  const shapes = svg
    .slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'))
    .trim()
    .split('\n')
    .map((l) => l.trim().replace(/\s*\/>$/, ' pathLength="300" />'))
    .join('');
  const id = `svc-grad-${i + 1}-${lang}`;
  return `<svg class="svc-icon" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="url(#${id})" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="0"><stop offset="0" stop-color="#7C3AED"/><stop offset=".45" stop-color="#3B5BFF"/><stop offset="1" stop-color="#FF3CAC"/></linearGradient></defs>${shapes}</svg>`;
}

function servicesPage(lang) {
  const L = langs[lang];
  const S = L.services;
  const body = `${pageHead(S.titre, S.intro)}
<section class="section section-tight" aria-label="${esc(L.nav.services)}">
  <div class="container">
    <ol class="grid grid-3 services">
      ${S.items
        .map((s, i) => {
          const n = String(i + 1).padStart(2, '0');
          return `<li class="card glass service" data-reveal>
        ${serviceIcon(i, lang)}
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

function portfolioPage(lang) {
  const L = langs[lang];
  const P = L.portfolio;
  const finals = portfolio.videos.filter((v) => v.type !== 'coulisses');
  const behind = portfolio.videos.filter((v) => v.type === 'coulisses');
  const clientNames = [...new Set([...portfolio.clients.map((c) => c.nom), ...finals.map((v) => v.client)])];
  const count = (n) => `${n} ${n > 1 ? P.videos : P.video}`;
  const catVideos = portfolio.categories.map(categoryVideo);
  const body = `${pageHead(P.titre, P.intro)}
<section class="section section-tight" aria-labelledby="vedettes-title">
  <div class="container">
    <h2 id="vedettes-title" class="gradient-text" data-reveal>${esc(P.vedettesTitre)}</h2>
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

<section class="section" aria-labelledby="clients-title">
  <div class="container">
    <h2 id="clients-title" class="gradient-text" data-reveal>${esc(P.parClientTitre)}</h2>
    <p class="intro" data-reveal>${t(P.parClientIntro)}</p>
    ${clientNames
      .map((name) => {
        const client = portfolio.clients.find((c) => c.nom === name) || {};
        const list = finals.filter((v) => v.client === name);
        if (!list.length) return '';
        return `<article class="client-group" aria-labelledby="client-${slug(name)}">
      <h3 id="client-${slug(name)}">${client.url ? `<a href="${esc(client.url)}" target="_blank" rel="noopener">${esc(name)}</a>` : esc(name)} <span class="muted small">${count(list.filter((v) => v.youtubeId).length)}</span>${note(client.note)}</h3>
      <ul class="grid grid-5">
        ${list.map((v) => `<li data-reveal>${videoTile(v, lang)}</li>`).join('\n        ')}
      </ul>
    </article>`;
      })
      .join('\n    ')}
    <div class="client-group upcoming" data-reveal>
      <h3>${esc(P.aVenirTitre)}</h3>
      <ul class="pills">
        ${portfolio.clientsAVenir.map((c) => `<li>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.nom)}</a>` : esc(c.nom)}${note(c.note)}</li>`).join('\n        ')}
      </ul>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="coulisses-title">
  <div class="container">
    <h2 id="coulisses-title" class="gradient-text" data-reveal>${esc(P.coulissesTitre)}</h2>
    <p class="intro" data-reveal>${t(P.coulissesIntro)}</p>
    <ul class="grid grid-5">
      ${behind.map((v) => `<li data-reveal>${videoTile(v, lang)}</li>`).join('\n      ')}
    </ul>
    <p class="cta-row"><a class="btn btn-neon" href="${ROUTES.apropos[lang]}">${esc(P.bouton)}</a></p>
  </div>
</section>`;
  return layout({ key: 'portfolio', lang, body, videos: portfolio.videos });
}

const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
  const body = `<section class="section section-contact page-contact" aria-labelledby="contact-page-title">
  ${contactBlock(lang, { tag: 'h1', id: 'contact-page-title' })}
</section>
<section class="section section-tight" aria-labelledby="faq-title">
  <div class="container faq">
    <h2 id="faq-title" class="gradient-text" data-reveal>${esc(L.faq.titre)}</h2>
    ${L.faq.items.map((f) => `<details data-reveal><summary>${t(f.q)}</summary><p>${t(f.r)}</p>${f.note ? `<p class="small">${t(f.note)}</p>` : ''}</details>`).join('\n    ')}
  </div>
</section>`;
  return layout({ key: 'contact', lang, body });
}

function messagePage(lang, key, data) {
  const body = `<section class="section page-simple">
  <div class="container">
    <h1 class="gradient-text">${t(data.titre)}</h1>
    <p class="intro">${t(data.texte)}</p>
    <p class="cta-row"><a class="btn btn-neon" href="${ROUTES.accueil[lang]}">${esc(data.retour)}</a></p>
  </div>
</section>`;
  return layout({ key, lang, body });
}

// ---------- fichiers SEO/GEO ----------
function sitemap() {
  const xml = (s) => esc(s);
  const videoEntries = (key, lang) => {
    const list = key === 'portfolio' ? portfolio.videos : [];
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
  const urls = INDEXABLE.flatMap((k) =>
    ['fr', 'en'].map(
      (lang) => `  <url>
    <loc>${abs(ROUTES[k][lang])}</loc>
    <xhtml:link rel="alternate" hreflang="fr-CA" href="${abs(ROUTES[k].fr)}"/>
    <xhtml:link rel="alternate" hreflang="en-CA" href="${abs(ROUTES[k].en)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(ROUTES[k].fr)}"/>${videoEntries(k, lang)}
  </url>`
    )
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls.join('\n')}
</urlset>
`;
}

function llmsTxt() {
  const fr = langs.fr;
  const known = (s) => !isPlaceholder(s);
  const finals = portfolio.videos.filter((v) => v.type !== 'coulisses' && v.youtubeId);
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
    ...portfolio.clients.map((c) => `- ${c.nom} (${finals.filter((v) => v.client === c.nom).length} vidéos)`),
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
