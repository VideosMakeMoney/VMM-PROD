# tools/titre-vmm-detourage.py : détourage du titre animé « VIDEOS MAKE MONEY » (JD, MP4 sur fond vert, 16 nov. 2026).
# Hors dist, non déployé. Chaîne complète (le MP4 original reste dans media-originaux/, hors du repo) :
#   1) ffmpeg -i "media-originaux/TITRE VMM HOMEPAGE OPTIMISER.mp4" -an -vf "crop=2064:258:76:339" -vsync 0 crop/%03d.png
#   2) SIZES=1280,960 python3 -I tools/titre-vmm-detourage.py crop sortie
#   3) pour W/CRF = 1280/20 et 960/21 :
#      ffmpeg -framerate 24 -i sortie/stack_W/%03d.png -an -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
#        -c:v libx264 -preset veryslow -tune animation -profile:v high -crf CRF -g 48 \
#        -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart titre-vmm-alpha-W.mp4
#   4) poster : image 0 de sortie/rgba, réduite à 1280×160 (prémultipliée), en PNG et WebP (q90, alpha 100).
# Détourage du titre VMM (fond vert uni) -> images RGBA prémultipliées + empilées (couleur en haut, alpha en bas)
# usage: python3 -I key.py IN_DIR OUT_DIR  (IN_DIR: PNG recadrés 2064x258, sortie: stack_<W>/%03d.png, rgba/%03d.png)
import sys, os, glob
import numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
T0, T1 = 8.0, 200.0         # excès de vert : <T0 opaque, >T1 transparent
KEY = np.array([20.0, 255.0, 8.0])
SIZES = [int(x) for x in os.environ.get("SIZES", "1280,960").split(",")]
fs = sorted(glob.glob(os.path.join(src, '*.png')))
for s in SIZES: os.makedirs(f'{out}/stack_{s}', exist_ok=True)
os.makedirs(f'{out}/rgba', exist_ok=True)
def dilate(m, r):
    o = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            o |= np.roll(np.roll(m, dy, 0), dx, 1)
    return o
for i, f in enumerate(fs):
    c = np.asarray(Image.open(f).convert('RGB')).astype(np.float64)
    d = c[..., 1] - np.maximum(c[..., 0], c[..., 2])
    a = np.clip((T1 - d) / (T1 - T0), 0, 1)
    core = d < 120
    a[~dilate(core, 3)] = 0          # aucun bruit dans le fond
    a[a < 0.03] = 0
    # démélange : C = a*F + (1-a)*K  ->  F*a = C - (1-a)*K  (couleur prémultipliée, sans vert)
    p = c - (1 - a)[..., None] * KEY
    p = np.clip(p, 0, None)
    p = np.minimum(p, a[..., None] * 255)
    # petite correction de débordement vert sur les pixels de bord : vert <= max(rouge, bleu) quand a<1
    edge = a < 0.999
    mx = np.maximum(p[..., 0], p[..., 2])
    p[..., 1] = np.where(edge, np.minimum(p[..., 1], mx), p[..., 1])
    A = (a * 255 + .5).astype(np.uint8)
    P = (p + .5).astype(np.uint8)
    # RGBA non prémultiplié pour le poster
    with np.errstate(divide='ignore', invalid='ignore'):
        u = np.where(a[..., None] > 0, p / np.maximum(a[..., None], 1e-6), 0)
    U = np.dstack([np.clip(u + .5, 0, 255).astype(np.uint8), A])
    Image.fromarray(U, 'RGBA').save(f'{out}/rgba/{i:03d}.png')
    pim, aim = Image.fromarray(P, 'RGB'), Image.fromarray(A, 'L').convert('RGB')
    for s in SIZES:
        h = round(s * c.shape[0] / c.shape[1] / 2) * 2
        st = Image.new('RGB', (s, h * 2))
        st.paste(pim.resize((s, h), Image.LANCZOS), (0, 0))
        st.paste(aim.resize((s, h), Image.LANCZOS), (0, h))
        st.save(f'{out}/stack_{s}/{i:03d}.png', compress_level=1)
print('ok', len(fs))
