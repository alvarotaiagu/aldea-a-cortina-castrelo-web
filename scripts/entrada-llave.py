#!/usr/bin/env python3
"""Entrada · la llave.

Dibuja en SVG la llave de hierro de su foto (ref/fotos/web/alojamiento-pepin-verin.jpg): anilla ovalada
inclinada, caña con un collarín bajo la anilla, paletón con sus dientes. Se midió sobre la foto (enderezada
11,8 grados) y se dibuja a mano con curvas; la foto no se usa en ningún sitio.

Salidas:
  img/llave/llave.svg, llave-casa.svg, llave-apto1.svg, llave-apto2.svg, llave-aldea.svg   (para el motor «Elige tu llave»)
  partes/cortina.html   (a partir de scripts/entrada-cortina.plantilla.html: la llave va en línea, sin otra petición)

Los textos de las etiquetas se pasan a trazados (fontTools) para que el SVG funcione como <img>, donde las
letras web no cargan. Uso:  python scripts/entrada-llave.py
"""
import math
import os
import re
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SALIDA = os.path.join(RAIZ, 'img', 'llave')
FUENTES = os.path.join(os.path.dirname(__file__), 'entrada-fuentes')
os.makedirs(SALIDA, exist_ok=True)

HIERRO = '#1D1815'      # cuerpo (casi tinta)
BORDE = '#6A5C4F'       # brillo de forja en el canto de arriba a la izquierda
MADERA = '#8A5A3B'
MADERA_OSC = '#5E3B25'
ALMAGRE = '#A3302C'
TINTA = '#1F1A17'
PAPEL = '#F4EFE6'


def n(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


# ---------------------------------------------------------------- la llave, en coordenadas de la foto enderezada
# (x, y) en «píxeles de foto ×3 enderezada»; luego T() lo lleva a unidades de llave (alto ≈ 320).
K = 0.3
def T(x, y):
    return ((x + 190) * K + 8, (y + 490) * K + 6)


def tp(pts):
    return [T(x, y) for x, y in pts]


def poli_suave(pts, cerrar=True, tension=0.18):
    """Camino con curvas de Catmull-Rom entre los puntos (cantos de hierro forjado, sin esquinas de regla)."""
    P = pts
    N = len(P)
    d = 'M%s %s' % (n(P[0][0]), n(P[0][1]))
    rango = range(N) if cerrar else range(N - 1)
    for i in rango:
        p0 = P[(i - 1) % N] if (cerrar or i > 0) else P[i]
        p1 = P[i]
        p2 = P[(i + 1) % N]
        p3 = P[(i + 2) % N] if (cerrar or i + 2 < N) else P[(i + 1) % N]
        c1 = (p1[0] + (p2[0] - p0[0]) * tension, p1[1] + (p2[1] - p0[1]) * tension)
        c2 = (p2[0] - (p3[0] - p1[0]) * tension, p2[1] - (p3[1] - p1[1]) * tension)
        d += 'C%s %s %s %s %s %s' % (n(c1[0]), n(c1[1]), n(c2[0]), n(c2[1]), n(p2[0]), n(p2[1]))
    return d + ('Z' if cerrar else '')


def poli_recto(pts):
    return 'M' + 'L'.join('%s %s' % (n(x), n(y)) for x, y in pts) + 'Z'


def elipse(cx, cy, rx, ry, rot):
    """Elipse inclinada como camino (dos arcos), en unidades de llave."""
    a = math.radians(rot)
    ca, sa = math.cos(a), math.sin(a)
    p1 = (cx + rx * ca, cy + rx * sa)
    p2 = (cx - rx * ca, cy - rx * sa)
    return 'M%s %sA%s %s %s 1 1 %s %sA%s %s %s 1 1 %s %sZ' % (
        n(p1[0]), n(p1[1]), n(rx), n(ry), n(rot), n(p2[0]), n(p2[1]), n(rx), n(ry), n(rot), n(p1[0]), n(p1[1]))


def camino_llave():
    """Devuelve (anilla, cuerpo): dos caminos (el de la anilla lleva el hueco, para fill-rule evenodd)."""
    ce = T(11.7, -349)
    ci = T(12.2, -345.9)
    anilla = elipse(ce[0], ce[1], 212 * K, 144 * K, 5.7) + elipse(ci[0], ci[1], 145 * K, 92 * K, 5.7)
    # caña y paletón: perfil de la foto enderezada, de arriba (bajo la anilla) a abajo; cantos con su temblor de forja
    izq = [(-30, -240), (-36, -222), (-36, -176), (-31, -120), (-30, -55), (-41, -14), (-44, 9), (-46, 60), (-48, 112), (-47, 230),
           (-50, 330), (-51, 419), (-45, 500), (-38, 559)]
    # abajo: paletón (de izquierda a derecha): borde de abajo con sus dientes
    abajo = [(-12, 556), (30, 554), (68, 548), (74, 546), (74, 524), (94, 522), (96, 546), (140, 548), (142, 531), (164, 530),
             (166, 546), (186, 548), (201, 548), (214, 531), (218, 506)]
    # derecha: de abajo a arriba por el paletón y la caña
    der = [(218, 462), (216, 432), (205, 422), (150, 413), (90, 402), (52, 396), (49, 330), (47, 230), (46, 120), (45, 60), (44, -9),
           (58, -44), (70, -76), (71, -110), (62, -176), (60, -222), (56, -240)]
    pts = izq + abajo + der
    cuerpo = poli_suave(tp(pts), False, 0.13) + 'Z'  # abierta: el canto de arriba queda recto, escondido bajo la anilla
    return anilla, cuerpo


ANILLA, CUERPO = camino_llave()
ANCHO_LLAVE, ALTO_LLAVE = 138, 326
# la anilla tiene su centro en:
ANILLA_C = T(11.7, -349)
# punto de la anilla donde cuelga la argolla / la cuerda de la etiqueta (abajo a la derecha del hueco)
ANILLA_COLGAR = T(120, -250)


def llave_g(uid):
    """Grupo con la llave (en unidades de llave). El canto brillante de forja es la misma silueta, desplazada
    arriba a la izquierda, detrás del cuerpo (sin clipPath: librsvg suma mal los hijos de un clipPath)."""
    return (
        '<g>'
        '<g transform="translate(-.8 -.8)"><path d="%(a)s" fill="%(b)s" fill-rule="evenodd"/><path d="%(c)s" fill="%(b)s"/></g>'
        '<path d="%(a)s" fill="%(h)s" fill-rule="evenodd"/><path d="%(c)s" fill="%(h)s"/>'
        '</g>' % dict(a=ANILLA, c=CUERPO, b=BORDE, h=HIERRO)
    )


def svg(vb_w, vb_h, cuerpo, defs='', extra=''):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s" width="%s" height="%s"%s>%s%s</svg>\n'
            % (n(vb_w), n(vb_h), n(vb_w), n(vb_h), extra, ('<defs>%s</defs>' % defs) if defs else '', cuerpo))


# ---------------------------------------------------------------- letras a trazados
_fuentes = {}


def fuente(nombre, peso):
    clave = (nombre, peso)
    if clave not in _fuentes:
        f = TTFont(os.path.join(FUENTES, nombre))
        f = instancer.instantiateVariableFont(f, {'wght': peso}, inplace=False)
        _fuentes[clave] = f
    return _fuentes[clave]


def texto_path(nombre, peso, texto, tam, cx, base_y, espaciado=0.0):
    """Camino SVG de un texto centrado en cx (línea base en base_y)."""
    f = fuente(nombre, peso)
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    upm = f['head'].unitsPerEm
    esc = tam / upm
    hmtx = f['hmtx']
    nombres = [cmap[ord(ch)] for ch in texto]
    ancho = sum(hmtx[g][0] for g in nombres) * esc + espaciado * (len(nombres) - 1)
    x = cx - ancho / 2
    d = ''
    for g in nombres:
        pen = SVGPathPen(gs, ntos=lambda v: n(v))
        tpen = TransformPen(pen, (esc, 0, 0, -esc, x, base_y))
        gs[g].draw(tpen)
        d += pen.getCommands()
        x += hmtx[g][0] * esc + espaciado
    return d


# ---------------------------------------------------------------- la etiqueta de madera
def etiqueta(uid, lineas, cx, cy, ang):
    """Etiqueta de madera con las esquinas de arriba cortadas, agujero y texto en tinta grabada."""
    w, h = 62, 92
    x0, y0 = -w / 2, -h / 2
    ch = 11
    forma = poli_recto([(x0 + ch, y0), (x0 + w - ch, y0), (x0 + w, y0 + ch), (x0 + w, y0 + h), (x0, y0 + h), (x0, y0 + ch)])
    veta = ''
    for i, (yy, ox) in enumerate([(-26, 3), (-14, -4), (-3, 5), (9, -2), (20, 4), (31, -5)]):
        veta += '<path d="M%s %sq%s %s %s %s" fill="none" stroke="%s" stroke-width=".7" opacity=".5"/>' % (
            n(x0 + 4), n(yy), n(w * 0.25), n(ox * 0.25), n(w * 0.9), n(ox * 0.6), MADERA_OSC)
    txt = ''
    # primera línea pequeña, segunda grande
    l1, l2 = lineas
    txt += '<path d="%s" fill="%s"/>' % (texto_path('OverpassMono-wght.ttf', 600, l1, 12.5, 0, -2, 1.4), TINTA)
    tam2 = 27 if len(l2) <= 2 else (16 if len(l2) <= 5 else 13)
    txt += '<path d="%s" fill="%s"/>' % (texto_path('IbarraRealNova-wght.ttf', 600, l2, tam2, 0, 24 if len(l2) <= 2 else 20, 0.6), TINTA)
    return (
        '<g transform="translate(%s %s) rotate(%s)">'
        '<path d="%s" fill="%s" stroke="%s" stroke-width="1.2" stroke-linejoin="round"/>%s'
        '<path d="M%s %sH%s" stroke="%s" stroke-width=".8" opacity=".6"/>'
        '<circle cx="0" cy="%s" r="4.6" fill="%s" stroke="%s" stroke-width="1"/>%s</g>'
        % (n(cx), n(cy), n(ang), forma, MADERA, MADERA_OSC, veta, n(x0 + 6), n(y0 + 25), n(x0 + w - 6), TINTA, n(y0 + 12), PAPEL, MADERA_OSC, txt)
    )


def cuerda(x1, y1, x2, y2, caida=10):
    """Cuerda de almagre: un lazo que sale de la anilla y cae a la etiqueta."""
    mx = (x1 + x2) / 2
    return ('<path d="M%s %sC%s %s %s %s %s %s" fill="none" stroke="%s" stroke-width="2.4" stroke-linecap="round"/>'
            % (n(x1), n(y1), n(x1 + 10), n(y1 + caida + 8), n(x2 + 6), n(y2 - caida), n(x2), n(y2), ALMAGRE))


def variante_etiqueta(nombre, lineas):
    uid = 'l-' + nombre
    anc = ANILLA_COLGAR
    ex, ey = 121, 156  # centro de la etiqueta
    cuerpo = (
        # la cuerda pasa por la anilla (detrás de la llave en su mitad izquierda)
        cuerda(anc[0], anc[1], ex - 1, ey - 46 + 12, 4) +
        llave_g(uid) +
        etiqueta(uid, lineas, ex, ey, 7) +
        '<path d="M%s %sq4 -2 7 1" fill="none" stroke="%s" stroke-width="2.6" stroke-linecap="round"/>' % (n(anc[0] - 3), n(anc[1] - 2), ALMAGRE)
    )
    return svg(168, ALTO_LLAVE, cuerpo)


def variante_aldea():
    """Las tres llaves en una argolla de hierro, con su etiqueta."""
    W, H = 330, 330
    cx, cy, r = 150, 64, 54
    esc = 0.56
    ring_top = T(11.7, -349 - 144)  # arriba de la anilla (donde cuelga de la argolla)
    argolla = ('<circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" stroke-width="5.2"/>'
               '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" stroke-width="1" opacity=".55" transform="translate(-.8 -.8)"/>'
               % (cx, cy, r, HIERRO, cx, cy, r, BORDE))
    llaves = ''
    for i, (ang, deg) in enumerate([(-38, 148), (38, 32), (0, 90)]):
        a = math.radians(deg)
        px, py = cx + r * math.cos(a), cy + r * math.sin(a)
        uid = 'la-%d' % i
        # el punto central de la anilla de cada llave se pone justo en la argolla (la argolla pasa por el aro)
        llaves += ('<g transform="translate(%s %s) rotate(%s) scale(%s) translate(%s %s)">%s</g>'
                   % (n(px), n(py), ang, esc, n(-ANILLA_C[0]), n(-ANILLA_C[1] + 14), llave_g(uid)))
    cuerpo = argolla + llaves
    # la argolla vuelve por delante en la mitad izquierda de cada aro, para que las llaves cuelguen de ella
    cuerpo += ('<path d="M%s %sA%s %s 0 0 1 %s %s" fill="none" stroke="%s" stroke-width="5.2" stroke-linecap="round"/>'
               % (n(cx - r * 0.5), n(cy + r * 0.866), r, r, n(cx + r * 0.5), n(cy + r * 0.866), HIERRO))
    cuerpo += cuerda(cx + r * 0.95, cy - 10, 262, 150 - 46 + 12, 4)
    cuerpo += etiqueta('la-t', ('LA', 'ALDEA'), 262, 150, 9)
    return svg(W, H, cuerpo)


# ---------------------------------------------------------------- escribir
def escribir(ruta, texto):
    with open(ruta, 'w', encoding='utf-8', newline='\n') as f:
        f.write(texto)
    print('  %s  (%d bytes)' % (os.path.relpath(ruta, RAIZ), len(texto.encode('utf-8'))))


def main():
    print('Llave:')
    escribir(os.path.join(SALIDA, 'llave.svg'), svg(ANCHO_LLAVE, ALTO_LLAVE, llave_g('l')))
    escribir(os.path.join(SALIDA, 'llave-casa.svg'), variante_etiqueta('casa', ('LA', 'CASA')))
    escribir(os.path.join(SALIDA, 'llave-apto1.svg'), variante_etiqueta('apto1', ('APTO.', '1')))
    escribir(os.path.join(SALIDA, 'llave-apto2.svg'), variante_etiqueta('apto2', ('APTO.', '2')))
    escribir(os.path.join(SALIDA, 'llave-aldea.svg'), variante_aldea())

    # la cortina: la plantilla lleva {{LLAVE}} (el <g> de la llave con ids propios) y {{LLAVE_W}}/{{LLAVE_H}}
    plantilla = os.path.join(os.path.dirname(__file__), 'entrada-cortina.plantilla.html')
    if os.path.exists(plantilla):
        t = open(plantilla, encoding='utf-8').read()
        t = t.replace('{{LLAVE}}', llave_g('cl'))
        t = t.replace('{{LLAVE_W}}', str(ANCHO_LLAVE)).replace('{{LLAVE_H}}', str(ALTO_LLAVE))
        # el punto de la anilla y el de la punta del paletón, en unidades de llave, para el JS
        punta = T(12, 560)
        t = t.replace('{{PUNTA_X}}', n(punta[0])).replace('{{PUNTA_Y}}', n(punta[1]))
        escribir(os.path.join(RAIZ, 'partes', 'cortina.html'), t)
    else:
        print('  (no hay plantilla de la cortina todavía)')


if __name__ == '__main__':
    main()
