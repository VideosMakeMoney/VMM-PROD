/* === PARTIE C (JD, 15 nov., #2) === Titre animé de l'accueil : vidéo H.264 « alpha empilé » (moitié haute = couleur
   prémultipliée, moitié basse = transparence en gris), décodée dans une <video> cachée et composée dans un <canvas>
   WebGL. Un seul chemin pour Safari/iOS, Chrome (Android, ordi) et Firefox : pas de WebM transparent (Safari et tous
   les navigateurs iOS l'affichaient sur fond noir), pas de fond vert. Sans WebGL, sans lecture automatique (ex. mode
   économie d'énergie iOS) ou avec « réduire les animations » : l'image fixe transparente reste affichée. */
(() => {
  const box = document.querySelector('.hero-titrage[data-empile]');
  if (!box) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-titrage-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let gl = null;
  try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false }); } catch (e) { gl = null; }
  if (!gl) return;

  const vs = 'attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
  // Couleur : moitié haute (y 0 → .5) ; transparence : moitié basse (y .5 → 1). Seuil léger contre le bruit de compression.
  const fs = 'precision mediump float;varying vec2 uv;uniform sampler2D t;void main(){' +
    'vec3 c=texture2D(t,vec2(uv.x,uv.y*.5)).rgb;float a=texture2D(t,vec2(uv.x,.5+uv.y*.5)).g;' +
    'a=clamp((a-.04)/.92,0.,1.);gl_FragColor=vec4(min(c,vec3(a)),a);}';
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

  // Version légère (960 px) quand le titre affiché fait moins de 1000 pixels réels
  const small = box.dataset.empileMobile && box.getBoundingClientRect().width * (window.devicePixelRatio || 1) < 1000;
  const v = document.createElement('video');
  v.className = 'hero-titrage-source';
  v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto';
  ['muted', 'playsinline', 'webkit-playsinline', 'autoplay', 'loop'].forEach((a) => v.setAttribute(a, ''));
  v.setAttribute('aria-hidden', 'true');
  v.src = small ? box.dataset.empileMobile : box.dataset.empile;

  let shown = false, lastT = -1, raf = 0, failed = false;
  const fail = () => { failed = true; box.classList.remove('is-playing'); canvas.remove(); v.removeAttribute('src'); v.load(); };
  const draw = () => {
    if (failed || v.readyState < 2) return;
    if (v.currentTime === lastT && shown) return;
    lastT = v.currentTime;
    const w = v.videoWidth, h = v.videoHeight >> 1;
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v); } catch (e) { fail(); return; }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!shown) { shown = true; box.classList.add('is-playing'); }
  };
  const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  const loop = () => { draw(); raf = hasRVFC ? v.requestVideoFrameCallback(loop) : requestAnimationFrame(loop); };
  const stop = () => { if (!raf) return; hasRVFC ? v.cancelVideoFrameCallback(raf) : cancelAnimationFrame(raf); raf = 0; };
  v.addEventListener('playing', () => { if (!raf && !failed) loop(); });
  v.addEventListener('error', fail);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail(); });
  box.append(canvas, v);

  let visible = true;
  const play = () => { if (!failed && visible && !document.hidden) v.play().catch(() => {}); };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) play(); else { v.pause(); stop(); } }).observe(box);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { v.pause(); stop(); } else play(); });
  play();
})();
