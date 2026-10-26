<!-- Copie conforme du prompt landing envoyé par Natasha dans le projet le 2026-10-26 (16:09 UTC). Ne pas modifier : c'est la spécification de référence. -->

PROMPT — Reconstruction du site VMM Productions (Videos Make Money)
Tu es développeur front-end senior et spécialiste SEO/GEO. Construis le nouveau site de VMM Productions (videosmakemoney.ca), une boîte de production vidéo du Grand Montréal et des Laurentides. Fondateur : JD (Jean-David). Hébergement : GitHub + Netlify (démo sur un lien Netlify).
Règles absolues

* N'invente JAMAIS de faits, de clients, de témoignages, de statistiques ou de bios. Tout ce qui manque reste un placeholder visible `[À CONFIRMER]`.
* Ne reprends aucun chiffre de l'ancienne maquette (« +1.2M conversions », « 50+ entreprises », « Vitesse 99/100 », etc.).
* Utilise seulement les vidéos et photos VMM approuvées (liste plus bas).
* Ton : portfolio et authenticité d'abord, invitation sans pression, aucun discours de vente, aucune stratégie publicitaire, aucun service IA.
* Phrase centrale : « Notre passion, aider la vôtre à grandir. »

Identité visuelle (à conserver EXACTEMENT, valeurs extraites du site en ligne le 26 oct. 2026)
Détail complet et bloc `:root` à coller : `identite_visuelle.md`.

* Polices (Google Fonts) : titres en Syne 700/800/900, texte en Space Grotesk 400/500/600, étiquettes en JetBrains Mono 600/700. Le bandeau d'accueil actuel utilise Inter 400/700/800 (titre en 800, letter-spacing -0.02em). `[À CONFIRMER avec JD : on uniformise sur un seul système ?]`
* Couleurs : fond #08080f, surfaces #0f0f1a et #14142b, accent violet #7b2fff, violet clair #bf7fff, rose néon #ff2d78, cyan #00f5ff, texte #f0eeff / #8b8ba8 / #7a7a9a, bordures #1e1e3a et #3d2080 (lumineuse). Palette du bandeau : #7C3AED, #3B5BFF, #FF3CAC, texte #F5F5FA, texte courant #9E94B0.
* Dégradés : titre `linear-gradient(90deg,#7C3AED 0%,#3B5BFF 45%,#FF3CAC 100%)` en background-clip:text ; halos radiaux violet rgba(123,47,255,.12) et rose rgba(255,45,120,.08) avec flou de 100 à 120px ; light leaks violet, rose et bleu en mix-blend-mode:screen ; overlay de vignette rgba(11,11,18,.85).
* Lueurs : bouton néon `0 0 24px #ff3cac59, inset 0 0 12px #7c3aed2e` (au survol `0 0 36px #ff3cac8c, inset 0 0 18px #7c3aed4d`), bordure 1px #ff3cac99, rayon 8px ; lueurs de cartes `0 0 30px rgba(124,58,237,.18)` ; filtre SVG bloom ; verre backdrop-blur 8px ; vidéo `brightness(1.1) saturate(1.35) contrast(1.1)`.
* Rayons : 8px pour les boutons, .5 / .75 / 1 / 1.5rem pour les cartes, 9999px pour les pilules.
* Animations : GSAP + ScrollTrigger et défilement fluide Lenis (pas de framer-motion). Keyframes à reprendre : fade-in (.8s cubic-bezier(.16,1,.3,1)), float-in, halo-pulse (3.2s infinite), aurora-drift, marquee, shimmer, spin-border, svc-stroke/svc-fill, leak-drift. `prefers-reduced-motion` doit être respecté.
* Vidéo héro existante : /images/vmm-hero-desktop.mp4 et /images/vmm-hero-mobile.mp4.
* Réseaux : Instagram @videosmakemoney, TikTok @videosmakemoney3, YouTube UCFuY4K2iKcRxa5R6vx6Hmxg, Facebook id 61579432510766, X @IncVmm47623.
* Formulaire actuel : POST JSON vers `/api/contact` (route Next.js sur Vercel) avec name, email, company, budget, message. À recréer sur Netlify. On change la structure, pas la marque.

Stack
Site statique ou SSR (Astro ou Next.js en export statique) pour que le contenu reste lisible sans JavaScript. Bilingue FR (défaut) / EN. CMS simple (JSON ou CMS git, par ex. Decap) pour que JD ajoute lui-même vidéos, clients et textes. Formulaire via Netlify Forms, testé.
Navigation
Accueil · Services · Portfolio · À propos · Contact, avec la bascule EN/FR sur CHAQUE page (vers la page équivalente). À retirer : Process, Pricing, et le bouton « Prendre rendez-vous » / « Book a Call ». Redirections 301 : /work → /portfolio, /process → /services, /pricing → /contact, /fr → /. Parcours : Accueil → #contact · Services → /portfolio · Portfolio → /about · À propos → /contact. URL : `/`, `/services`, `/portfolio`, `/about`, `/contact`, et `/en/...` pour l'anglais.
Accueil (une page qui défile, 5 sections dans cet ordre)

1. Bandeau : vidéo VMM muette, en lecture auto et en boucle, avec une image poster `[vidéo à fournir]`. Surtitre « VMM PRODUCTIONS · CINÉMA ET RÉCIT ». H1 « Videos Make Money. » Sous-titre « Notre passion, aider la vôtre à grandir. » Texte : « Donner vie à la vision de quelqu'un a quelque chose d'unique. Chez VMM, nous réunissons récit, image et son pour capter ce qui rend votre entreprise différente : les gens, la passion et la fierté derrière chaque projet. » UN SEUL bouton : « Nous contacter ↓ », qui défile jusqu'à la section Contact de l'accueil.
2. Ce que nous créons : « Chaque entreprise a une histoire qui mérite d'être racontée. Voici quatre façons de lui donner vie en vidéo. » 4 vignettes, chacune ouvre une lightbox vidéo :
   * Vidéos promotionnelles : « Mettez en lumière votre savoir-faire, votre différence et ce qui vous anime. »
   * Couverture événementielle : « Revivez l'énergie, l'ambiance et les moments marquants de votre événement. »
   * Histoires d'entreprises : « Donnez une voix aux personnes derrière votre entreprise et à leur passion. »
   * Coulisses, making-of et bandes-annonces : « Découvrez la créativité et le travail d'équipe derrière chaque tournage. » Bouton « Découvrir nos services → » vers /services. `[vidéo de chaque catégorie à confirmer]`
3. Derrière VMM : « Les grandes productions commencent par les personnes derrière la caméra. Découvrez celles qui donnent vie à notre travail. »
   * JD, Fondateur : « Des chantiers de construction aux plateaux de tournage, JD apporte une perspective concrète à chaque production. Pour lui, filmer, c'est mettre en valeur ce que les gens bâtissent et ce qui les passionne. »
   * Renaud, Cameraman : « Avec près de dix ans d'expérience derrière la caméra, Renaud apporte créativité, énergie et une approche immersive pour saisir l'action sur le vif. » Bouton « Faire notre connaissance → » vers /about. `[photos authentiques à fournir]`
4. Nos réalisations : « Un aperçu des histoires, des personnes et des moments que nous avons eu le privilège de capter. » Vedettes : « Une équipe soudée » (Tapis Rouge, événement) et « ICI, TOUT A CHANGÉ » (Hors-Paire Excavation, production) `[ID YouTube à fournir]`. Bouton « Explorer notre portfolio → » vers /portfolio.
5. Contact : même composant que la page Contact.
6. Avis Google : section pour un widget d'avis Google existants `[emplacement et compte à confirmer]`.

Services (/services)
« Nos services. De la première idée au montage final, nous réunissons les compétences créatives et techniques nécessaires pour donner vie à votre vision. » 6 capacités, sans lecteur vidéo : 01 Production vidéo : « Des tournages professionnels sur le terrain pour donner vie à vos idées. » 02 Photographie : « Des images qui immortalisent les gens, les moments et les détails importants. » 03 Images aériennes et drone : « Des perspectives aériennes uniques pour enrichir vos images. » 04 Scénarisation et narration : « Des idées transformées en récits structurés, porteurs de sens et d'émotion. » 05 Montage et postproduction : « L'image, le son et le récit réunis dans un montage créatif. » 06 Animation et habillage graphique : « Des titres, graphiques et effets animés qui donnent vie à vos images. » Aucune stratégie pub ni gestion d'annonces. Bouton « Explorer nos réalisations → » vers /portfolio.
Portfolio (/portfolio), ordre OBLIGATOIRE
Intro : « Notre portfolio. Découvrez nos productions finales et les moments qui prennent vie derrière la caméra. »

1. Productions vedettes par catégorie (les 4 types, en lightbox).
2. « Productions finales par client » : « Les productions finales sont regroupées par entreprise, sans limite arbitraire du nombre de vidéos. » TOUTES les vidéos, client par client.
3. « Coulisses, bandes-annonces et making-of » : « Passez derrière la caméra et découvrez comment nos productions prennent forme, de la préparation à la dernière image. » Cette section reste séparée. Bouton « Rencontrer les gens derrière VMM → » vers /about. Les données viennent d'un fichier `portfolio.json` éditable dans le CMS (client, catégorie, ID YouTube, langue, titre, vedette oui/non).

Inventaire actuel (YouTube Shorts verticaux) :

* Tapis Rouge : HeLdEo_awQ0, t7zXkOFUdBs, 3ru2cIaqzeo, g8pY-zSgljI, kKz1pKN44dM, O2UTFiYzGU0, hmrhpcyGGEk
* Pur Construction : 3T-zTO2Q30A, F8bCIpVoDFI, G3owwW2k1Po, duRjqB2By-0, wNGp61LUV8g, VaEXZ5aXcE0, FOeE9sB-UtY
* Hors-Paire Excavation : fxGb6xSqsfw, aRr26p8dQxk
* BlueWise : LQmzAY6qCv8, zga2uMl5zhk
* Coulisses : a6L9xFtDSgc, hOUNzv6MYc8, n7_rIrZQLk8, 5cwIdsVO0Jc, z2eTv3wpHDA
* À ajouter quand on aura les liens : HH Portes et Fenêtres, Paintball Mirabel (making-of et album photo) `[À CONFIRMER]` Orthographe des clients à uniformiser `[À CONFIRMER : Hors-Paire, PUR]`.

À propos (/about)
« Les visages derrière VMM. De vraies personnes. Une passion authentique. Des histoires à raconter. »

* Rencontrez JD : « Mon parcours a commencé avec une passion pour le récit visuel. J'ai étudié à la Toronto Film School avant de devoir interrompre mes études pour des raisons financières. Aujourd'hui, je travaille dans la construction tout en développant VMM Productions : deux univers qui m'ont appris la valeur du travail et des relations humaines. Chaque production est une occasion de donner vie à une vision et de montrer la fierté derrière le travail accompli. »
* Rencontrez Renaud : « Avec près de dix ans derrière la caméra, Renaud apporte expérience, originalité et instinct pour saisir l'action. Son approche immersive transforme les moments spontanés en images vivantes. » `[bio à valider, n'ajoute rien]`
* Photos authentiques `[à fournir]`. Bouton « Nous joindre → » vers /contact.
* Retire « We Don't Just Create Videos — We Create Business Growth » et « Marketing First ». Paragraphe BlueWise AI `[à confirmer]`.

Contact (/contact)
Garde la page actuelle IDENTIQUE (composant, animations, styles, liens sociaux, formulaire avec Nom, Courriel, Entreprise, Fourchette de budget, Projet et Envoyer, envoi sans recharger la page). Courriel : jeandavid@videosmakemoney.ca. Zone : Grand Montréal et Laurentides `[textes finaux à confirmer]`. Ajoute SEULEMENT 4 accordéons FAQ entre le contact et le pied de page, avec les réponses originales :

1. Combien de temps prend un projet typique ? « La plupart des projets sont livrés en 1 à 2 semaines selon la complexité. Les clients en production continue reçoivent leurs livrables de façon régulière. »
2. Qu'est-ce qui est inclus dans le processus de production ? « Chaque projet inclut la stratégie, le script, le tournage professionnel, le montage avancé et la direction créative — avec des options comme les prises de drone, motion graphics, animation de logo, visuels IA, voix off et livraison bilingue (FR + EN). »
3. Offrez-vous du contenu bilingue (français & anglais) ? « Oui. Tous les forfaits incluent la livraison bilingue (FR + EN) adaptée au marché québécois pour un message naturel et efficace dans les deux langues. »
4. Et si je ne sais pas quel type de contenu mon entreprise a besoin ? « Aucun problème. On vous guide vers la meilleure stratégie selon votre entreprise, vos objectifs et votre clientèle — pour créer du contenu conçu pour attirer l'attention, bâtir la confiance et générer de l'action. » (Versions EN originales à reprendre du dictionnaire du site actuel.)

Pied de page
Remplace l'ancien slogan (« Video that prints money… viral campaigns ») par un texte `[à confirmer]`.
Mobile
Une seule colonne, boutons tactiles d'au moins 44 px, vidéos verticales affichées entières, sans recadrage, et lightbox plein écran.
SEO local

* Mots-clés : production vidéo Montréal, vidéaste corporatif Laurentides, vidéo promotionnelle, vidéo d'entreprise, couverture événementielle, drone.
* Un `<title>` et une meta description uniques par page, en FR et en EN (« VMM Productions — Production vidéo, Grand Montréal et Laurentides », etc.). Aucune ancienne meta de vente.
* hreflang fr-CA / en-CA / x-default sur chaque page, URL réciproques, `<html lang>` correct.
* JSON-LD : `LocalBusiness`/`ProfessionalService` (VMM Productions Inc., email, areaServed Grand Montréal + Laurentides, founder, sameAs `[réseaux sociaux]`, adresse `[à confirmer si publique]`), `Person` (JD, Renaud), `VideoObject` pour chaque vidéo (embedUrl, thumbnail i.ytimg.com/vi/{id}/hqdefault.jpg, inLanguage), `FAQPage` sur /contact, `BreadcrumbList` et `WebSite`.
* sitemap.xml (10 URL avec alternates et entrées vidéo) et robots.txt. Prévoir l'inscription à Google Search Console.

GEO (réponses des IA)

* Textes factuels et citables (qui, quoi, où), noms de clients et titres de vidéos en texte HTML.
* Fichier `llms.txt` résumant VMM.
* Contenu rendu sans JavaScript.

Performance

* Lightbox YouTube chargée seulement au clic (façade légère), lazy-load des images et des iframes.
* Vidéo héro compressée (WebM/MP4) avec poster.
* Lightbox accessible : clavier, Échap, focus piégé.
* Visé : Lighthouse mobile ≥ 90.

Livrable
Code sur GitHub, démo sur un lien Netlify, avec la liste de tous les placeholders `[À CONFIRMER]` restants. Ne mets rien en ligne sur le domaine de production sans l'accord explicite de Max.
