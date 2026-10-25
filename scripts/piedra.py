"""Texturas de «Almagre y piedra», generadas (nunca fotos), con semilla fija: salen siempre iguales.

  python -I scripts/piedra.py

Escribe en img/piedra/:
  losa.webp     la lámina que se desliza entre secciones: lajas claras con juntas oscuras (1800x520)
  fondo.webp    la superficie «piedra»: lajas pardo-pizarra oscuras y calladas, que encajan en mosaico (1024x1024)
  almagre.webp  la superficie «almagre»: revoco de fachada, paño rojo con manchas y llana (768x768, en mosaico)
  papel.webp    la superficie «papel»: fibra casi invisible, en mosaico (512x512)
y css/piedra.css con los bordes irregulares de laja de la lámina (--borde-1, --borde-2, --borde-3) y del
paso de piedra a papel (--canto-1, --canto-2), como clip-path: polygon() en porcentajes.
Colores: los medidos en las fachadas (almagre #A22730 / #AB3A2E; piedra parda #7E6648-#A0947B).
"""
import os
import numpy as np
import cv2
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
SALIDA = os.path.join(RAIZ, 'img', 'piedra')
os.makedirs(SALIDA, exist_ok=True)


def hexa(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)


def ruido(rng, w, h, escalas, pesos):
    """ruido de valor suave que se repite en mosaico (la imagen se envuelve): suma de octavas"""
    out = np.zeros((h, w))
    for e, p in zip(escalas, pesos):
        gw, gh = max(2, w // e), max(2, h // e)
        base = rng.random((gh, gw)).astype(np.float32)
        # envolver: repetir una fila/columna y recortar, para que no haya costura
        grande = np.tile(base, (3, 3))
        grande = cv2.resize(grande, (gw * 3 * e, gh * 3 * e), interpolation=cv2.INTER_CUBIC)
        oy, ox = gh * e, gw * e
        capa = grande[oy:oy + gh * e, ox:ox + gw * e]
        capa = cv2.resize(capa, (w, h), interpolation=cv2.INTER_CUBIC)
        out += p * (capa - 0.5)
    return out


def muro(rng, W, H, paleta, junta, celda, aniso, gap, envolver, contraste, relieve, grano, estrato):
    """un muro de lajas por Voronoi anisótropo (celdas anchas, como lajas de pizarra en hiladas): cada laja con
    su tono, su veta horizontal, sus cantos biselados con luz desde arriba a la izquierda y juntas oscuras.
    `envolver`: las distancias se miden en toroide, para que el mosaico no tenga costura."""
    cw, ch = celda
    filas = int(np.ceil(H / ch)); semillas = []
    y = rng.uniform(0, ch)
    while y < H + ch * (0 if envolver else 1):
        x = rng.uniform(-cw / 2, cw / 2)
        while x < W + cw * (0 if envolver else 1):
            semillas.append((x + rng.uniform(-.28, .28) * cw, y + rng.uniform(-.30, .30) * ch))
            x += cw * rng.uniform(.7, 1.3)
        y += ch * rng.uniform(.8, 1.2)
    S = np.array(semillas)
    n = len(S)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # bordes con ondulación: se tuerce el plano con ruido suave (las lajas no son polígonos de regla)
    xx = xx + (ruido(rng, W, H, (46, 17), (1.0, 0.5)) * 30).astype(np.float32)
    yy = yy + (ruido(rng, W, H, (38, 14), (1.0, 0.5)) * 20).astype(np.float32)
    d1 = np.full((H, W), 1e9, np.float32); d2 = np.full((H, W), 1e9, np.float32); ident = np.zeros((H, W), np.int32)
    for i, (sx, sy) in enumerate(S):
        dx = np.abs(xx - sx); dy = np.abs(yy - sy)
        if envolver:
            dx = np.minimum(dx, W - dx); dy = np.minimum(dy, H - dy)
        d = np.sqrt((dx / aniso) ** 2 + dy ** 2)
        m1 = d < d1
        d2 = np.where(m1, d1, np.minimum(d2, d))
        ident = np.where(m1, i, ident)
        d1 = np.where(m1, d, d1)
    borde = d2 - d1                                  # 0 en la junta, crece hacia el centro de la laja
    # tono de cada laja
    tonos = np.array([hexa(paleta[int(rng.integers(0, len(paleta)))]) * (1 + (rng.random() - .5) * contraste) for _ in range(n)])
    fases = rng.random(n) * 6.28
    a = tonos[ident]
    # veta de la pizarra: bandas finas casi horizontales, distintas en cada laja
    ven = np.sin(yy[..., None] * 0.55 + fases[ident][..., None] + np.sin(xx[..., None] * 0.012 + fases[ident][..., None]) * 2.0)
    a = a * (1 + ven * estrato)
    # relieve: la laja sube desde la junta; la luz viene de arriba a la izquierda
    alt = np.clip(borde / 9.0, 0, 1).astype(np.float32)
    alt = cv2.GaussianBlur(alt, (0, 0), 1.1)
    gx = cv2.Sobel(alt, cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(alt, cv2.CV_32F, 0, 1, ksize=3)
    luz = -(gx * 0.7 + gy * 0.9)
    a = a * (1 + (luz * relieve)[..., None])
    # junta
    j = np.clip((borde - gap * 0.6) / (gap * 0.9), 0, 1)[..., None]
    a = hexa(junta) * (1 - j) + a * j
    # grano de la piedra: ruido fino alargado en horizontal
    g = rng.random((H // 2, W // 6)).astype(np.float32)
    g = cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR) - .5
    g2 = rng.random((H, W)).astype(np.float32) - .5
    rugoso = ruido(rng, W, H, (28, 9, 3), (0.5, 0.35, 0.25))
    a = a * (1 + (g[..., None] * 0.20 + g2[..., None] * 0.20 + rugoso[..., None] * 0.55) * grano)
    # motas claras y oscuras (liquen, cuarzo): pocas y pequeñas
    mota = rng.random((H, W)).astype(np.float32)
    a = a * (1 + ((mota > 0.9985) * 0.35 - (mota < 0.0015) * 0.35)[..., None])
    return a


def guardar(a, nombre, calidad):
    Image.fromarray(a).save(os.path.join(SALIDA, nombre), 'WEBP', quality=calidad, method=6)
    print(nombre, a.shape[1], 'x', a.shape[0], os.path.getsize(os.path.join(SALIDA, nombre)) // 1024, 'KB')


# ───────────── losa: la lámina que se desliza (lajas más claras, con juntas oscuras) ─────────────
rng = np.random.default_rng(1727)
paleta_losa = ['#625A50', '#6A6055', '#564F47', '#716759', '#5F564E', '#4C463F', '#766C5D', '#5B5248']
a = muro(rng, 1800, 520, paleta_losa, '#14100E', (300, 110), 2.0, 4.6, False, 0.30, 0.42, 1.0, 0.05)
guardar(np.clip(a, 0, 255).astype(np.uint8), 'losa.webp', 78)

# ───────────── fondo: la superficie piedra (oscura, calla, en mosaico) ─────────────
rng = np.random.default_rng(1648)
paleta_fondo = ['#2F2823', '#342C26', '#2A241F', '#38302A', '#2D2621', '#3A322B', '#302924']
a = muro(rng, 1024, 1024, paleta_fondo, '#171310', (250, 105), 2.0, 3.8, True, 0.22, 0.26, 0.8, 0.035)
guardar(np.clip(a, 0, 255).astype(np.uint8), 'fondo.webp', 74)

# ───────────── almagre: el paño de fachada (revoco rojo, en mosaico) ─────────────
rng = np.random.default_rng(1871)
W = H = 768
base = np.tile(hexa('#A3302C'), (H, W, 1))
n1 = ruido(rng, W, H, (192, 96, 40, 14), (0.22, 0.16, 0.10, 0.06))
n2 = ruido(rng, W, H, (6, 3), (0.05, 0.04))
# llana: manchas alargadas en diagonal (se estira un ruido)
llana = ruido(rng, W, H, (24,), (1.0,))
llana = cv2.GaussianBlur(llana.astype(np.float32), (0, 0), 14)
llana = cv2.warpAffine(np.tile(llana, (1, 1)), cv2.getRotationMatrix2D((W / 2, H / 2), 18, 1.0), (W, H), borderMode=cv2.BORDER_WRAP)
a = base * (1 + n1[..., None] * 0.34 + n2[..., None] * 0.9 + llana[..., None] * 0.16)
# el revoco deja ver algo más oscuro y más claro, sin salir del almagre
a += (rng.random((H, W, 1)) - .5) * 12
guardar(np.clip(a, 0, 255).astype(np.uint8), 'almagre.webp', 72)

# ───────────── papel: fibra casi invisible, en mosaico ─────────────
rng = np.random.default_rng(1759)
W = H = 512
base = np.tile(hexa('#F4EFE6'), (H, W, 1))
n1 = ruido(rng, W, H, (128, 48, 12, 4), (0.05, 0.04, 0.035, 0.03))
a = base * (1 + n1[..., None] * 0.6) + (rng.random((H, W, 1)) - .5) * 5
guardar(np.clip(a, 0, 255).astype(np.uint8), 'papel.webp', 62)


# ───────────── bordes irregulares de laja (clip-path polygon, en porcentajes) ─────────────
def borde_inferior(seed, y_min, y_max, paso):
    """la orilla de abajo de una lámina: de izquierda a derecha, lajas con una grada cada una (el techo, recto)"""
    r = np.random.default_rng(seed)
    xs, x = [0.0], 0.0
    while x < 100:
        x = min(100.0, x + r.uniform(*paso)); xs.append(round(x, 2))
    ys = []
    y = r.uniform(y_min, y_max)
    for _ in xs[:-1]:
        y = float(np.clip(y + r.uniform(-9, 9), y_min, y_max))
        ys.append(round(y, 2))
    pts = ['0% 0%', '100% 0%']
    # de derecha a izquierda por abajo
    for i in range(len(xs) - 2, -1, -1):
        pend = r.uniform(-1.6, 1.6)
        pts.append(f'{xs[i + 1]}% {round(float(np.clip(ys[i] + pend, y_min - 3, 100)), 2)}%')
        pts.append(f'{xs[i]}% {ys[i]}%')
    return 'polygon(' + ', '.join(pts) + ')'


def canto_superior(seed, y_min, y_max, paso):
    """el canto de arriba de una sección de papel que cae sobre piedra: lajas a distinto nivel"""
    r = np.random.default_rng(seed)
    pts = []
    x, y = 0.0, r.uniform(y_min, y_max)
    pts.append(f'0% {round(y, 2)}%')
    while x < 100:
        x = min(100.0, x + r.uniform(*paso))
        pts.append(f'{round(x, 2)}% {round(y + r.uniform(-1.2, 1.2), 2)}%')
        if x >= 100: break
        y = float(np.clip(y + r.uniform(-8, 8), y_min, y_max))
        pts.append(f'{round(x, 2)}% {round(y, 2)}%')
    pts += ['100% 100%', '0% 100%']
    return 'polygon(' + ', '.join(pts) + ')'


css = ['/* Generado por scripts/piedra.py (semilla fija): no editar a mano. Bordes irregulares de laja. */', ':root {']
css.append('  --borde-1: ' + borde_inferior(11, 74, 97, (4.5, 11)) + ';')
css.append('  --borde-2: ' + borde_inferior(23, 70, 96, (3.5, 9)) + ';')
css.append('  --borde-3: ' + borde_inferior(37, 78, 98, (6, 14)) + ';')
css.append('  --canto-1: ' + canto_superior(5, 0, 38, (4, 11)) + ';')
css.append('  --canto-2: ' + canto_superior(8, 0, 34, (5, 13)) + ';')
css.append('}')
open(os.path.join(RAIZ, 'css', 'piedra.css'), 'w', encoding='utf-8').write('\n'.join(css) + '\n')
print('css/piedra.css')
