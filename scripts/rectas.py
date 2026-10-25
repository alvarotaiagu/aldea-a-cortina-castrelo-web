"""Enderezar verticales de las exteriores de Aldea Rural A Cortiña (gran angular de móvil).

Receta de la memoria feedback_corregir_verticales_fotos (la de Casa de la Judería): Canny + HoughLinesP,
punto de fuga por RANSAC, homografía al 85 % con tope de apertura 1,4x y 30 % de aspecto; el recorte es solo
el rectángulo que queda dentro. Solo se tocan casa-fachada, solaina y cenador (las que lo piden).
Lee de ref/fotos/web, escribe scripts/fuentes/rectas/<nombre>.jpg (q 95) y una hoja antes/después
scripts/fuentes/hoja-rectas.jpg para revisarlas a ojo. Después, node scripts/fotos.mjs las toma de ahí.

  python -I scripts/rectas.py            (las tres)
  python -I scripts/rectas.py solaina
"""
import json, math, os, sys
import numpy as np
import cv2
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
ORIGEN = os.path.join(RAIZ, 'ref', 'fotos', 'web')
DESTINO = os.path.join(AQUI, 'fuentes', 'rectas')
os.makedirs(DESTINO, exist_ok=True)
FUERZA_VERTICAL = 0.85
TOPE_INCLINACION = 0.22
FOTOS = {'casa-fachada': 'aldear-rural-a-cortinha-49.jpg', 'solaina': 'aldear-rural-a-cortinha-18.jpg', 'cenador': 'aldear-rural-a-cortinha-62.jpg'}


# ───────────────────────────── 1 · verticales ─────────────────────────────
def segmentos_verticales(bgr):
    H, W = bgr.shape[:2]
    esc = 1200 / H
    peq = cv2.resize(bgr, (round(W * esc), 1200), interpolation=cv2.INTER_AREA)
    gris = cv2.cvtColor(peq, cv2.COLOR_BGR2GRAY)
    gris = cv2.GaussianBlur(gris, (3, 3), 0)
    bordes = cv2.Canny(gris, 40, 120)
    lineas = cv2.HoughLinesP(bordes, 1, np.pi / 720, threshold=60, minLineLength=110, maxLineGap=6)
    segs = []
    if lineas is None:
        return segs, esc
    for x1, y1, x2, y2 in np.asarray(lineas).reshape(-1, 4):
        dy = y2 - y1
        if abs(dy) < 1: continue
        b = (x2 - x1) / dy
        if abs(b) > TOPE_INCLINACION: continue
        ym = 600.0
        a = x1 + b * (ym - y1)               # x en y = H/2 (en la escala pequeña)
        L = math.hypot(x2 - x1, dy)
        segs.append((a / esc, b, L / esc))    # a en píxeles originales; b no cambia con la escala
    return segs, esc


def ajustar_fuga(segs, H):
    """Ajuste robusto de a = c0 + c1·b (RANSAC + mínimos cuadrados ponderados)."""
    if len(segs) < 6:
        return None
    A = np.array(segs)
    a, b, w = A[:, 0], A[:, 1], A[:, 2]
    mejor, mejor_in = None, None
    rng = np.random.default_rng(7)
    tol = 0.006 * H
    for _ in range(400):
        i, j = rng.choice(len(A), 2, replace=False)
        if abs(b[i] - b[j]) < 1e-3: continue
        c1 = (a[i] - a[j]) / (b[i] - b[j]); c0 = a[i] - c1 * b[i]
        # residuo: en px, a media altura; el ruido de b se multiplica por c1
        dentro = np.abs(a - (c0 + c1 * b)) < tol + np.abs(c1) * 0.004
        puntuacion = w[dentro].sum()
        if mejor is None or puntuacion > mejor:
            mejor, mejor_in = puntuacion, dentro
    if mejor_in is None or mejor_in.sum() < 5:
        return None
    X = np.c_[np.ones(mejor_in.sum()), b[mejor_in]]
    W_ = np.diag(w[mejor_in])
    c0, c1 = np.linalg.solve(X.T @ W_ @ X, X.T @ W_ @ a[mejor_in])
    return dict(c0=c0, c1=c1, n=int(mejor_in.sum()), peso=float(w[mejor_in].sum()), b_medio=float(np.average(b[mejor_in], weights=w[mejor_in])))


def corregir_verticales(rgb, nombre):
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    H, W = rgb.shape[:2]
    segs, _ = segmentos_verticales(bgr)
    fit = ajustar_fuga(segs, H)
    if not fit:
        print(f'  {nombre}: sin verticales fiables, sin corregir'); return rgb, None
    c0, c1 = fit['c0'], fit['c1']
    # punto de fuga: vx = c0, vy = H/2 - c1
    vx, vy = c0, H / 2 - c1
    if abs(vy - H / 2) < 0.8 * H:
        print(f'  {nombre}: fuga demasiado cerca ({round(vx)}, {round(vy)}), sin corregir'); return rgb, None
    # recta de cada borde: x(y) = a_borde + b_borde·(y - H/2); para las dos esquinas de abajo y las de arriba
    # Pendiente de una recta que pasa por el punto de fuga y por (x0, y0): b = (x0 - vx) / (y0 - vy)
    def b_por(x0, y0):
        return (x0 - vx) / (y0 - vy)
    # inclinación que se corregirá en cada borde (con la fuerza)
    if abs(vy) > 60 * H:   # prácticamente paralelas: solo giro
        giro = -math.degrees(math.atan(fit['b_medio'])) * FUERZA_VERTICAL
        if abs(giro) < 0.3:
            print(f'  {nombre}: rectas a plomo, sin corregir'); return rgb, None
        M = cv2.getRotationMatrix2D((W / 2, H / 2), giro, 1.0)
        out = cv2.warpAffine(rgb, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        rect = recorte_giro(W, H, giro)
        return recortar(out, rect), dict(tipo='giro', grados=round(giro, 2), n=fit['n'])
    # cuadrilátero de origen: las rectas hacia el punto de fuga que pasan por las esquinas del lado ancho
    arriba = vy < H / 2      # convergen hacia arriba (cámara mirando arriba): base fija
    yb = H if arriba else 0  # lado que se queda fijo
    yo = 0 if arriba else H  # lado que se abre
    bl, br = b_por(0, yb), b_por(W, yb)
    # con fuerza f: la pendiente corregida es (1-f)·b; el punto del lado opuesto en origen se mueve sobre la recta real
    # fuerza: 85 %, pero sin que el lado opuesto se ensanche más de 1,4 veces (si no, todo lo de
    # arriba queda achatado); lo que falte se queda como una leve convergencia natural
    xl_o = 0 + bl * (yo - yb); xr_o = W + br * (yo - yb)              # dónde está la recta de la esquina en el otro lado
    Wo = xr_o - xl_o
    f = FUERZA_VERTICAL
    if Wo < W:   # la apertura (ancho corregido / ancho real en el lado opuesto) no pasa de 1,4
        f = min(f, 1 - (W - 1.4 * Wo) / (W - Wo))
    xl_d = 0 + (1 - f) * bl * (yo - yb); xr_d = W + (1 - f) * br * (yo - yb)  # a dónde la llevamos
    src = np.float32([[0, yb], [W, yb], [xr_o, yo], [xl_o, yo]])
    dst = np.float32([[0, yb], [W, yb], [xr_d, yo], [xl_d, yo]])
    Hm = cv2.getPerspectiveTransform(src, dst)
    out = cv2.warpPerspective(rgb, Hm, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
    # rectángulo útil: el mayor que queda dentro de la imagen original transformada
    esquinas = cv2.perspectiveTransform(np.float32([[[0, 0], [W, 0], [W, H], [0, H]]]), Hm)[0]
    rect = rect_interior(esquinas, W, H)
    # compensación de aspecto (como el «aspecto» de un upright): al abrir arriba, lo de arriba se
    # ensancha; se estira en vertical un 30 % de esa apertura para que no se vea achatado
    apertura = (xr_d - xl_d) / (xr_o - xl_o)
    k = 1 + 0.3 * (apertura - 1)
    rec = recortar(out, rect)
    if k > 1.005:
        rec = cv2.resize(rec, (rec.shape[1], round(rec.shape[0] * k)), interpolation=cv2.INTER_CUBIC)
    info = dict(tipo='homografia', fuga=[round(vx), round(vy)], n=fit['n'], fuerza=round(f, 2), aspecto=round(k, 3),
                inclinacion_bordes=[round(math.degrees(math.atan(bl)), 2), round(math.degrees(math.atan(br)), 2)],
                recorte=[int(v) for v in rect])
    return rec, info


def rect_interior(q, W, H):
    """q = esquinas transformadas [TL, TR, BR, BL]. Rectángulo eje-alineado dentro del cuadrilátero
    (convexo) y dentro del lienzo, conservando el ancho máximo posible."""
    TL, TR, BR, BL = q
    x0 = max(0, TL[0], BL[0]); x1 = min(W, TR[0], BR[0])
    y0 = max(0, TL[1], TR[1]); y1 = min(H, BL[1], BR[1])
    # los bordes laterales son rectas inclinadas: el x válido depende de y; tomar el más restrictivo en [y0, y1]
    def x_en(p, r, y):
        if abs(r[1] - p[1]) < 1e-6: return p[0]
        return p[0] + (r[0] - p[0]) * (y - p[1]) / (r[1] - p[1])
    for y in (y0, y1):
        x0 = max(x0, x_en(TL, BL, y)); x1 = min(x1, x_en(TR, BR, y))
    return (math.ceil(x0), math.ceil(y0), math.floor(x1), math.floor(y1))


def recorte_giro(W, H, grados):
    a = abs(math.radians(grados))
    # mayor rectángulo con la misma proporción dentro del rotado
    s = 1 / (math.cos(a) + max(W, H) / min(W, H) * math.sin(a))
    w, h = W * s, H * s
    return (round((W - w) / 2), round((H - h) / 2), round((W + w) / 2), round((H + h) / 2))


def recortar(img, rect):
    x0, y0, x1, y1 = rect
    return img[y0:y1, x0:x1]



if __name__ == '__main__':
    pedidas = sys.argv[1:] or list(FOTOS)
    informe = {}
    filas = []
    for n in pedidas:
        rgb = np.asarray(Image.open(os.path.join(ORIGEN, FOTOS[n])).convert('RGB'))
        out, info = corregir_verticales(rgb, n)
        dst = os.path.join(DESTINO, n + '.jpg')
        if info: Image.fromarray(out).save(dst, quality=95, subsampling=0)
        elif os.path.exists(dst): os.remove(dst)   # sin verticales fiables: fotos.mjs usa el original
        informe[n] = dict(origen=FOTOS[n], ancho=int(out.shape[1]), alto=int(out.shape[0]), verticales=info)
        print(n, out.shape[1], 'x', out.shape[0], info or 'sin tocar')
        a = Image.fromarray(rgb).resize((480, 360)); b = Image.fromarray(out); b = b.resize((round(b.width * 360 / b.height), 360))
        c = Image.new('RGB', (a.width + b.width + 20, 380), 'white'); c.paste(a, (0, 20)); c.paste(b, (a.width + 20, 20)); ImageDraw.Draw(c).text((4, 4), n, fill='black')
        filas.append(c)
    ruta_inf = os.path.join(AQUI, 'fuentes', 'rectas.json')
    prev = json.load(open(ruta_inf, encoding='utf-8')) if os.path.exists(ruta_inf) else {}
    prev.update(informe)
    json.dump(prev, open(ruta_inf, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    W = max(f.width for f in filas); H = sum(f.height for f in filas)
    hoja = Image.new('RGB', (W, H), (230, 230, 230)); y = 0
    for f in filas: hoja.paste(f, (0, y)); y += f.height
    hoja.save(os.path.join(AQUI, 'fuentes', 'hoja-rectas.jpg'), quality=85)
