#!/usr/bin/env python3
"""Entrada · el dibujo de la solaina, en vector.

Vectoriza ref/fotos/web/aldea-rural.png (891 x 752, tinta negra sobre blanco, sin letras) para que aguante
los aumentos del viaje de la portada (hasta ×20) sin pixelarse:
  1. tinta = 255 - luminancia (sobre blanco); ×4 LANCZOS + desenfoque gaussiano + umbral a media tinta
  2. potrace (potracer) con alphamax 1,0 y opttolerance 0,5
  3. se vuelve a rasterizar el camino y se compara con el PNG por IoU de la tinta (hay que pasar de 0,9)
  4. escribe img/dibujo/solaina.svg y mete el camino y el hueco en js/dibujo.js (entre las marcas DATOS)

El hueco (la boca de la galería entre dos pies derechos, por donde aparece la aldea) se da a mano, en
coordenadas del dibujo: HUECO. `HUECO_EXT` es el mismo polígono ensanchado unas unidades para que la foto
pase por debajo de la tinta del marco (la tinta se repinta encima, solo fuera del hueco).

Uso:  python scripts/entrada-vectorizar.py [--depurar]   (con --depurar deja un PNG de revisión en el temporal)
"""
import json
import math
import os
import re
import sys

import cv2
import numpy as np
import potrace
from PIL import Image
from scipy.ndimage import gaussian_filter

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ORIGEN = os.path.join(RAIZ, 'ref', 'fotos', 'web', 'aldea-rural.png')
SVG = os.path.join(RAIZ, 'img', 'dibujo', 'solaina.svg')
JS = os.path.join(RAIZ, 'js', 'dibujo.js')
os.makedirs(os.path.dirname(SVG), exist_ok=True)

ESCALA = 4
# El hueco: segundo vano de la galería (entre el pie derecho de x≈466 y el de x≈598). Orden: arriba-izquierda,
# arriba-derecha, abajo-derecha, abajo-izquierda. Coordenadas del PNG de 891 x 752. Se afinó contra el dibujo
# (--depurar) para que sus lados caigan sobre el borde interior de la tinta del marco.
HUECO = [(468.5, 168.5), (597.0, 151.5), (597.0, 247.5), (468.5, 262.0)]
DELTA = 2.2  # cuánto se ensancha HUECO_EXT hacia fuera (unidades del dibujo)


def cargar():
    im = Image.open(ORIGEN).convert('RGBA')
    fondo = Image.new('RGBA', im.size, (255, 255, 255, 255))
    fondo.alpha_composite(im)
    g = np.asarray(fondo.convert('L'), np.float32)
    return g


def trazar(g):
    ancho, alto = g.shape[1], g.shape[0]
    im = Image.fromarray(g.astype(np.uint8)).resize((ancho * ESCALA, alto * ESCALA), Image.LANCZOS)
    a = np.asarray(im, np.float32)
    a = gaussian_filter(a, 1.5)
    tinta = a < 128
    # potracer invierte en Bitmap.__init__: se le pasa el lado del fondo, como bool
    bm = potrace.Bitmap(~tinta)
    plist = bm.trace(turdsize=24, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.0, opticurve=True, opttolerance=1.0)
    return plist, tinta


def q(v):
    """A décimas de unidad del dibujo, enteras."""
    return int(round(v / ESCALA * 10))


def curva_a_cadena(curva):
    s = curva.start_point
    x0, y0 = q(s.x), q(s.y)
    partes = ['M%d %d' % (x0, y0)]
    cx, cy = x0, y0
    for seg in curva.segments:
        if seg.is_corner:
            a = (q(seg.c.x), q(seg.c.y))
            b = (q(seg.end_point.x), q(seg.end_point.y))
            partes.append('l' + sep([a[0] - cx, a[1] - cy]) + 'l' + sep([b[0] - a[0], b[1] - a[1]]))
            cx, cy = b
        else:
            c1 = (q(seg.c1.x), q(seg.c1.y)); c2 = (q(seg.c2.x), q(seg.c2.y)); e = (q(seg.end_point.x), q(seg.end_point.y))
            partes.append('c' + sep([c1[0] - cx, c1[1] - cy, c2[0] - cx, c2[1] - cy, e[0] - cx, e[1] - cy]))
            cx, cy = e
    partes.append('z')
    return ''.join(partes)


def area_con_signo(curva):
    pts = [(curva.start_point.x, curva.start_point.y)] + [(sg.end_point.x, sg.end_point.y) for sg in curva.segments]
    a = 0.0
    for k in range(len(pts)):
        x1, y1 = pts[k]
        x2, y2 = pts[(k + 1) % len(pts)]
        a += x1 * y2 - x2 * y1
    return a / 2


def camino(plist):
    """Camino relativo en DÉCIMAS de unidad (enteros): el JS lo pinta con scale(.1). Evenodd."""
    return ''.join(curva_a_cadena(c) for c in plist)


def poligono(curva):
    pts = []
    cur = (curva.start_point.x, curva.start_point.y)
    pts.append(cur)
    for seg in curva.segments:
        if seg.is_corner:
            pts.append((seg.c.x, seg.c.y)); pts.append((seg.end_point.x, seg.end_point.y))
        else:
            a, b, c, d = cur, (seg.c1.x, seg.c1.y), (seg.c2.x, seg.c2.y), (seg.end_point.x, seg.end_point.y)
            for t in (0.25, 0.5, 0.75, 1.0):
                u = 1 - t
                pts.append((u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0],
                            u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1]))
        cur = (seg.end_point.x, seg.end_point.y)
    return np.array(pts, np.float32)


def grupos(plist, tam=14000):
    """El camino en grupos de ~tam caracteres. Cada contorno exterior va con todos sus descendientes (huecos e islas:
    potracer no da el árbol, se calcula por contención), así que cada grupo se rellena entero con evenodd."""
    polis = [poligono(c) for c in plist]
    areas = [abs(cv2.contourArea(p)) for p in polis]
    n = len(plist)
    padre = [-1] * n
    for i in range(n):
        mejor = -1
        for j in range(n):
            if j == i or areas[j] <= areas[i]:
                continue
            if cv2.pointPolygonTest(polis[j], (float(polis[i][0][0]), float(polis[i][0][1])), False) > 0:
                if mejor < 0 or areas[j] < areas[mejor]:
                    mejor = j
        padre[i] = mejor
    raiz_de = []
    for i in range(n):
        r = i
        while padre[r] >= 0:
            r = padre[r]
        raiz_de.append(r)
    por_raiz = {}
    for i in range(n):
        por_raiz.setdefault(raiz_de[i], []).append(plist[i])
    out, actual, largo = [], [], 0
    for r in sorted(por_raiz):
        unidad = por_raiz[r]
        cad = sum(len(curva_a_cadena(c)) for c in unidad)
        if largo >= tam:
            out.append(actual)
            actual, largo = [], 0
        actual.extend(unidad)
        largo += cad
    if actual:
        out.append(actual)
    return out


def trozos(plist):
    return [''.join(curva_a_cadena(c) for c in g) for g in grupos(plist)]


def sep(nums):
    out = ''
    for k, v in enumerate(nums):
        t = str(v)
        out += t if (k == 0 or v < 0) else ' ' + t
    return out


def rasterizar(plist, ancho, alto):
    """Vuelve a pintar las curvas (evenodd = XOR de cada subcamino) a ESCALA y devuelve la tinta como bool."""
    W, H = ancho * ESCALA, alto * ESCALA
    acum = np.zeros((H, W), np.uint8)
    for curva in plist:
        pts = []
        p0 = curva.start_point
        cur = (p0.x, p0.y)
        pts.append(cur)
        for seg in curva.segments:
            if seg.is_corner:
                pts.append((seg.c.x, seg.c.y))
                pts.append((seg.end_point.x, seg.end_point.y))
            else:
                a, b, c, d = cur, (seg.c1.x, seg.c1.y), (seg.c2.x, seg.c2.y), (seg.end_point.x, seg.end_point.y)
                for t in np.linspace(0, 1, 12)[1:]:
                    u = 1 - t
                    pts.append((u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0],
                                u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1]))
            cur = (seg.end_point.x, seg.end_point.y)
        m = np.zeros((H, W), np.uint8)
        cv2.fillPoly(m, [np.round(np.array(pts)).astype(np.int32)], 1)
        acum ^= m
    return acum.astype(bool)


def ensanchar(poli, d):
    """Polígono convexo desplazado d hacia fuera (cada lado se corre d y se vuelven a cortar los lados vecinos)."""
    n = len(poli)
    cx = sum(p[0] for p in poli) / n
    cy = sum(p[1] for p in poli) / n
    rectas = []
    for i in range(n):
        a, b = poli[i], poli[(i + 1) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        nx, ny = dy / L, -dx / L
        # que la normal apunte hacia fuera del centro
        if (a[0] - cx) * nx + (a[1] - cy) * ny < 0:
            nx, ny = -nx, -ny
        rectas.append(((a[0] + nx * d, a[1] + ny * d), (dx, dy)))
    out = []
    for i in range(n):
        (p, v), (q, w) = rectas[i - 1], rectas[i]
        det = v[0] * (-w[1]) - v[1] * (-w[0])
        t = ((q[0] - p[0]) * (-w[1]) - (q[1] - p[1]) * (-w[0])) / det
        out.append((p[0] + v[0] * t, p[1] + v[1] * t))
    return out


def main():
    depurar = '--depurar' in sys.argv
    g = cargar()
    alto, ancho = g.shape
    original = g < 128
    plist, tinta_alta = trazar(g)
    d = camino(plist)
    # comprobación: el camino vuelve a rasterizarse y se compara a ×4 con la tinta ampliada y a 1× con el PNG
    nuevo = rasterizar(plist, ancho, alto)
    inter = np.logical_and(nuevo, tinta_alta).sum()
    union = np.logical_or(nuevo, tinta_alta).sum()
    iou4 = inter / union
    bajo = cv2.resize(nuevo.astype(np.float32), (ancho, alto), interpolation=cv2.INTER_AREA) > 0.5
    iou1 = np.logical_and(bajo, original).sum() / np.logical_or(bajo, original).sum()
    nseg = sum(len(c.segments) for c in plist)
    print('curvas %d, segmentos %d, camino %.1f KB' % (len(plist), nseg, len(d) / 1024))
    print('IoU de la tinta: %.4f (a x4, contra el PNG ampliado) · %.4f (a 1x, contra el PNG)' % (iou4, iou1))
    if iou1 < 0.9:
        print('IoU por debajo de 0,9: no se escribe nada')
        sys.exit(1)

    # comprobación: rellenar los trozos por separado da la misma tinta que el camino entero
    union = np.zeros(nuevo.shape, bool)
    for g in grupos(plist):
        union |= rasterizar(g, ancho, alto)
    print('trozos: %d · coinciden con el camino entero: %s' % (len(grupos(plist)), bool((union == nuevo).all())))
    if not (union == nuevo).all():
        print('los trozos no casan (un hueco quedó lejos de su contorno)'); sys.exit(1)
    ext = ensanchar(HUECO, DELTA)
    bbox = (0, 0, ancho, alto)
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">'
           '<path transform="scale(.1)" fill="#1F1A17" fill-rule="evenodd" d="%s"/></svg>\n' % (ancho, alto, ancho, alto, d))
    with open(SVG, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(svg)
    print('  img/dibujo/solaina.svg  (%d bytes)' % len(svg.encode('utf-8')))

    # los trozos del camino, por curva, con su caja: para no pintar en pantalla lo que cae fuera de cuadro
    # (cada «trozo» es un grupo de curvas; el camino completo sigue siendo el de arriba)
    datos = {
        'ancho': ancho, 'alto': alto,
        'hueco': [[round(x, 2), round(y, 2)] for x, y in HUECO],
        'huecoExt': [[round(x, 2), round(y, 2)] for x, y in ext],
        'caja': [int(np.nonzero(original.any(0))[0].min()), int(np.nonzero(original.any(1))[0].min()), int(np.nonzero(original.any(0))[0].max()) + 1, int(np.nonzero(original.any(1))[0].max()) + 1],
        'iou': round(float(iou1), 4),
        'trozos': trozos(plist),
    }
    if os.path.exists(JS):
        s = open(JS, encoding='utf-8').read()
        ini, fin = '/*DATOS-INICIO*/', '/*DATOS-FIN*/'
        if ini in s and fin in s:
            i = s.index(ini) + len(ini)
            j = s.index(fin)
            s = s[:i] + '\n  var DATOS = ' + json.dumps(datos, ensure_ascii=False, separators=(',', ':')) + ';\n  ' + s[j:]
            open(JS, 'w', encoding='utf-8', newline='\n').write(s)
            print('  js/dibujo.js: datos escritos')
        else:
            print('  js/dibujo.js existe pero no tiene las marcas /*DATOS-INICIO*/ ... /*DATOS-FIN*/')
    else:
        print('  (js/dibujo.js todavía no existe; los datos quedan en el temporal)')
    with open(os.path.join(os.path.dirname(__file__), 'entrada-datos.json'), 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(datos, fh, ensure_ascii=False, separators=(',', ':'))

    if depurar:
        SP = os.environ.get('ENTRADA_TEMP')
        if SP:
            base = np.asarray(Image.open(ORIGEN).convert('RGBA').resize((ancho * 3, alto * 3), Image.LANCZOS))
            fondo = np.full((alto * 3, ancho * 3, 3), 255, np.uint8)
            a = base[..., 3:4] / 255.0
            fondo = (base[..., :3] * a + 255 * (1 - a)).astype(np.uint8)
            fondo = np.ascontiguousarray(fondo)
            for poli, col in ((HUECO, (255, 0, 0)), (ext, (0, 120, 255))):
                pts = np.array([[x * 3, y * 3] for x, y in poli], np.int32)
                cv2.polylines(fondo, [pts], True, col, 1)
            cv2.imwrite(os.path.join(SP, 'hueco-depurar.png'), cv2.cvtColor(fondo, cv2.COLOR_RGB2BGR)[100 * 3:300 * 3, 420 * 3:660 * 3])
            print('  depuración escrita')


if __name__ == '__main__':
    main()
