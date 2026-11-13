// tools/mesure-mobile.mjs : mesure « une section = un écran » en émulation mobile (hors dist, non déployé).
// Usage : PW=/chemin/vers/node_modules/playwright BASE=https://deploy-preview-NN--vmm-prod.netlify.app node tools/mesure-mobile.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'https://videosmakemoney.ca';
const ALL = [[360, 740], [390, 844], [430, 932], [390, 664]];
const VPS = process.env.VP ? ALL.filter(([w, h]) => `${w}x${h}` === process.env.VP) : ALL;
const PAGES = process.env.PAGE ? [process.env.PAGE] : ['/', '/services/', '/portfolio/', '/portfolio/tapis-rouge/', '/about/', '/contact/'];
const browser = await chromium.launch();
let fails = 0;
for (const [W, H] of VPS) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-CA' });
  for (const path of PAGES) {
    const pg = await ctx.newPage();
    await pg.goto(BASE + path, { waitUntil: 'load' }); await pg.waitForTimeout(3500);
    const cdp = await ctx.newCDPSession(pg);
    const swipe = async (dist, ms) => {
      const n = Math.max(6, Math.round(ms / 16)), x = Math.round(W / 2), y0 = Math.round(H * 0.8);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
      for (let i = 1; i <= n; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + dist * i / n, id: 1 }] }); await new Promise((r) => setTimeout(r, ms / n)); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const secs = await pg.evaluate(async () => {
      const hdr = Math.round(document.querySelector('.site-header').getBoundingClientRect().height);
      const main = document.querySelector('main');
      const list = [];
      [...main.children].forEach((e) => { if (e.matches('.page-contact')) e.querySelectorAll('.contact-info,.contact-form').forEach((c) => list.push(c)); else list.push(e); });
      const out = [];
      for (const [i, s] of list.entries()) {
        const top = Math.max(0, s.getBoundingClientRect().top + scrollY - hdr);
        document.documentElement.style.scrollSnapType = 'none'; scrollTo({ top, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 1800));
        const r0 = s.getBoundingClientRect(), vh = innerHeight, bad = [];
        s.querySelectorAll('h1,h2,h3,p,a,button,img,li,dt,dd,label,input,select,textarea,summary').forEach((e) => {
          const cs = getComputedStyle(e), r = e.getBoundingClientRect();
          if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2 || r.height < 2 || e.closest('details:not([open]) > :not(summary)') || e.closest('[aria-hidden=true]')) return;
          let op = 1, p = e; while (p && p !== document.documentElement) { op *= parseFloat(getComputedStyle(p).opacity); p = p.parentElement; }
          if (op < 0.05) bad.push('invisible: ' + (e.innerText || e.alt || e.tagName).slice(0, 30));
          else if (r.bottom > vh + 1 && !e.closest('.home-services-studio,.bg-video,.hero-media')) bad.push(`coupé bas (${Math.round(r.bottom)} > ${vh}): ` + (e.innerText || e.alt || e.tagName).slice(0, 30));
        });
        out.push({ i: i + 1, tag: s.tagName.toLowerCase() + (s.id ? '#' + s.id : '') + '.' + [...s.classList].slice(0, 2).join('.'), h: Math.round(r0.height), avail: vh - hdr, scrollOv: s.scrollHeight - s.clientHeight, bad });
      }
      document.documentElement.style.scrollSnapType = ''; scrollTo({ top: 0, behavior: 'instant' });
      return out;
    });
    for (const s of secs) {
      const ko = s.h > s.avail + 1 || s.scrollOv > 1 || s.bad.length;
      if (ko) { fails++; console.log(`✗ ${W}x${H} ${path} s${s.i} ${s.tag} h=${s.h} dispo=${s.avail} scrollOv=${s.scrollOv} ${s.bad.slice(0, 4).join(' | ')}`); }
    }
    await pg.waitForTimeout(600);
    const tops = await pg.evaluate(() => { const hdr = Math.round(document.querySelector('.site-header').getBoundingClientRect().height); const t = []; [...document.querySelector('main').children].forEach((e) => { if (e.matches('.page-contact')) e.querySelectorAll('.contact-info,.contact-form').forEach((c) => t.push(c)); else t.push(e); }); return t.filter((e) => getComputedStyle(e).scrollSnapAlign !== 'none' || e.matches('.contact-info,.contact-form')).map((e) => Math.round(e.getBoundingClientRect().top + scrollY - hdr)); });
    const max = await pg.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const ys = [await pg.evaluate(() => Math.round(scrollY))];
    for (let k = 0; k < 25; k++) { await swipe(-650, 140); await pg.waitForTimeout(1100); const y = await pg.evaluate(() => Math.round(scrollY)); if (y === ys.at(-1)) break; ys.push(y); if (y >= max - 2) break; }
    const want = [...new Set(tops.map((t) => Math.min(Math.max(t, 0), max)))].sort((a, b) => a - b);
    const missed = want.filter((t) => !ys.some((y) => Math.abs(y - t) <= 4));
    const skipped = missed.filter((t) => t < max - 2);
    if (skipped.length || ys.at(-1) < max - 2) { fails++; console.log(`✗ ${W}x${H} ${path} snap tactile : positions visées ${want.join(',')} / atteintes ${ys.join(',')} / sautées ${skipped.join(',') || '-'}`); }
    await pg.close();
  }
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : '\nOK : toutes les sections tiennent dans l’écran et le snap tactile les atteint une par une');
process.exit(fails ? 1 : 0);
