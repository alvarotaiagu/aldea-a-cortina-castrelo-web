#!/usr/bin/env python3
"""Entrada · el logo real para «El círculo se cierra» (pie).

El logo NO se redibuja: se usa el PNG/JPG de su web (ref/fotos/web/favicon.jpg, 512 x 512) como máscara de tinta.
  1. alfa = tinta (255 - luminancia) con una curva de niveles; se amplía ×2 (Lanczos) y se recorta a la caja del logo
  2. se ajusta la elipse del círculo fino a los píxeles de tinta
  3. se QUITA el círculo del raster salvo donde lo cruzan letras o el dibujo (ahí el círculo queda dentro del trazo
     de la letra): el círculo lo traza el módulo en vivo, como vector, encima del mismo sitio
  4. se escriben dos versiones del logo sin círculo: tinta (para papel) y papel (para piedra o almagre)
  5. la geometría del círculo se mete en js/dibujo.js entre /*LOGO-INICIO*/ y /*LOGO-FIN*/

Uso:  python scripts/entrada-logo.py
"""
import json
import math
import os

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ORIGEN = os.path.join(RAIZ, 'ref', 'fotos', 'web', 'favicon.jpg')
SALIDA = os.path.join(RAIZ, 'img', 'dibujo')
JS = os.path.join(RAIZ, 'js', 'dibujo.js')
os.makedirs(SALIDA, exist_ok=True)

TINTA = (0x1F, 0x1A, 0x17)
PAPEL = (0xF4, 0xEF, 0xE6)
X0, Y0, X1, Y1 = 28, 88, 494, 424       # caja del logo en el JPG de 512 (con un margen)
ESC = 2


def alfa_de(gris):
    a = np.clip((236.0 - gris) / (236.0 - 70.0), 0, 1)
    return a ** 0.85


def main():
    jpg = cv2.imread(ORIGEN, cv2.IMREAD_GRAYSCALE)
    tinta = jpg < 140
    ys, xs = np.nonzero(tinta)

    # círculo: Hough para arrancar y mínimos cuadrados con los píxeles de tinta cercanos
    b = cv2.GaussianBlur(jpg, (5, 5), 1.5)
    c = cv2.HoughCircles(b, cv2.HOUGH_GRADIENT, dp=1, minDist=50, param1=100, param2=30, minRadius=120, maxRadius=160)
    cx, cy, r = [float(v) for v in c[0][0]]
    for _ in range(8):
        dd = np.hypot(xs - cx, ys - cy)
        sel = np.abs(dd - r) < 4
        A = np.c_[2 * xs[sel], 2 * ys[sel], np.ones(sel.sum())]
        bb = (xs[sel] ** 2 + ys[sel] ** 2).astype(float)
        sol = np.linalg.lstsq(A, bb, rcond=None)[0]
        cx, cy = sol[0], sol[1]
        r = math.sqrt(sol[2] + cx ** 2 + cy ** 2)
    dd = np.hypot(xs - cx, ys - cy)
    sel = np.abs(dd - r) < 4
    (ex, ey), (ea, eb), eang = cv2.fitEllipse(np.c_[xs[sel], ys[sel]].astype(np.float32))
    print('círculo: centro (%.2f, %.2f) radio %.2f · elipse ejes %.1f x %.1f, ángulo %.1f' % (cx, cy, r, ea, eb, eang))

    # --- quitar el círculo del raster (en el JPG original, coordenadas de 512) ---
    # distancia radial a la elipse ajustada (aprox. con la normalización de ejes)
    ang = math.radians(eang)
    H, W = jpg.shape
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    ux = (xx - ex) * math.cos(ang) + (yy - ey) * math.sin(ang)
    uy = -(xx - ex) * math.sin(ang) + (yy - ey) * math.cos(ang)
    ra, rb = ea / 2.0, eb / 2.0
    rho = np.sqrt((ux / ra) ** 2 + (uy / rb) ** 2)
    dist = (rho - 1.0) * (ra + rb) / 2.0         # px con signo: > 0 fuera del círculo
    teta = np.arctan2(uy / rb, ux / ra)          # ángulo paramétrico
    perim = 2 * math.pi * (ra + rb) / 2.0
    nbin = int(perim)
    abin = ((teta + math.pi) / (2 * math.pi) * nbin).astype(np.int32) % nbin
    ink = jpg < 150
    banda = np.abs(dist) <= 3.4
    # ¿hay tinta pegada al círculo por fuera o por dentro en ese ángulo? (una letra, o el dibujo, que lo cruza)
    lejos = ink & (np.abs(dist) > 3.8) & (np.abs(dist) < 13)
    cruza = np.zeros(nbin, bool)
    cruza[np.unique(abin[lejos])] = True
    # engordar los tramos de cruce unos píxeles de arco
    k = np.ones(9, bool)
    cruza = binary_dilation(np.r_[cruza, cruza, cruza], structure=k)[nbin:2 * nbin]
    quitar = banda & (~cruza[abin]) & ink
    # y la tinta pegada a la banda (anti-alias) también, para no dejar un hilo gris
    quitar |= (np.abs(dist) <= 4.6) & (~cruza[abin]) & (jpg < 235) & (np.abs(dist) > 3.4)
    print('píxeles de círculo quitados:', int(quitar.sum()))

    g = jpg.astype(np.float32).copy()
    g[quitar] = 255.0
    # ampliar ×2 y recortar
    gi = cv2.resize(g, (W * ESC, H * ESC), interpolation=cv2.INTER_LANCZOS4)
    a = alfa_de(np.clip(gi, 0, 255))
    a = a[Y0 * ESC:Y1 * ESC, X0 * ESC:X1 * ESC]
    h, w = a.shape
    for nombre, col in (('logo-tinta', TINTA), ('logo-papel', PAPEL)):
        rgba = np.zeros((h, w, 4), np.uint8)
        rgba[..., 0], rgba[..., 1], rgba[..., 2] = col
        rgba[..., 3] = np.round(a * 255).astype(np.uint8)
        ruta = os.path.join(SALIDA, nombre + '.webp')
        Image.fromarray(rgba, 'RGBA').save(ruta, 'WEBP', lossless=False, quality=88, alpha_quality=92, method=6)
        print('  %s  %dx%d  %d KB' % (os.path.relpath(ruta, RAIZ), w, h, os.path.getsize(ruta) // 1024))

    # geometría del círculo en el sistema de la caja recortada (unidades del JPG de 512)
    logo = {
        'caja': [X0, Y0, X1 - X0, Y1 - Y0],
        'aro': {'cx': round(ex, 2), 'cy': round(ey, 2), 'rx': round(ea / 2.0, 2), 'ry': round(eb / 2.0, 2), 'rot': round(eang, 2), 'grosor': 2.0},
        'ancho': w, 'alto': h,
    }
    with open(os.path.join(os.path.dirname(__file__), 'entrada-logo.json'), 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(logo, fh, ensure_ascii=False, separators=(',', ':'))
    if os.path.exists(JS):
        s = open(JS, encoding='utf-8').read()
        ini, fin = '/*LOGO-INICIO*/', '/*LOGO-FIN*/'
        if ini in s and fin in s:
            i = s.index(ini) + len(ini)
            j = s.index(fin)
            s = s[:i] + '\n  var LOGO = ' + json.dumps(logo, ensure_ascii=False, separators=(',', ':')) + ';\n  ' + s[j:]
            open(JS, 'w', encoding='utf-8', newline='\n').write(s)
            print('  js/dibujo.js: geometría del círculo escrita')
    # una vista para revisar a ojo (en el temporal si se pide)
    tmp = os.environ.get('ENTRADA_TEMP')
    if tmp:
        fondo = np.full((h, w, 3), 244, np.uint8)
        al = a[..., None]
        vista = (fondo * (1 - al) + np.array(TINTA, np.float32) * al).astype(np.uint8)
        # el círculo, encima, en rojo, para ver que cae sobre el original
        cv2.ellipse(vista, (int(round((ex - X0) * ESC)), int(round((ey - Y0) * ESC))), (int(round(ea / 2 * ESC)), int(round(eb / 2 * ESC))), eang, 0, 360, (200, 40, 40), 1, cv2.LINE_AA)
        Image.fromarray(vista).save(os.path.join(tmp, 'logo-vista.png'))


if __name__ == '__main__':
    main()
