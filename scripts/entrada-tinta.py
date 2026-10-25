#!/usr/bin/env python3
"""Entrada · la foto de la portada «a tinta» (el gesto de la plumilla).

De la foto de la fachada saca una versión a plumilla: bordes (Canny sobre la foto suavizada) + rayado cruzado
según la luz (más oscuro = más capas y líneas más gruesas), tinta --tinta sobre --papel, con la mano algo
temblona (ruido de semilla fija). Escribe img/tinta/casa-fachada-tinta.webp con las MISMAS proporciones que la
foto de entrada: el módulo cubre con las dos igual, así que tienen que casar.

La foto de entrada es, por orden: el argumento, img/fotos/casa-fachada-1920.jpg (la procesada por la web) o la
original de ref/. Cuando la web cambie el recorte o el enderezado de casa-fachada, hay que volver a lanzarlo:
    python scripts/entrada-tinta.py [ruta-de-la-foto]
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SALIDA = os.path.join(RAIZ, 'img', 'tinta', 'casa-fachada-tinta.webp')
os.makedirs(os.path.dirname(SALIDA), exist_ok=True)

TINTA = np.array([0x1F, 0x1A, 0x17], np.float32)
PAPEL = np.array([0xF4, 0xEF, 0xE6], np.float32)
ANCHO = 1440
rng = np.random.default_rng(2610)


def entrada():
    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        return sys.argv[1]
    for c in ('img/fotos/casa-fachada-1920.jpg', 'ref/fotos/web/aldear-rural-a-cortinha-49.jpg'):
        r = os.path.join(RAIZ, c)
        if os.path.exists(r):
            return r
    raise SystemExit('no encuentro la foto de la fachada')


def ruido(h, w, sigma):
    r = rng.standard_normal((h, w)).astype(np.float32)
    r = gaussian_filter(r, sigma)
    return r / (r.std() + 1e-6)


def capa_rayada(tono, ang_grados, periodo, umbral, grosor_max, temblor):
    """Una capa de rayas inclinadas: donde el tono baja del umbral, la raya engorda hasta grosor_max."""
    h, w = tono.shape
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    a = np.radians(ang_grados)
    u = x * np.cos(a) + y * np.sin(a) + temblor
    d = np.abs(((u + periodo / 2) % periodo) - periodo / 2)  # distancia a la raya más cercana
    prof = np.clip((umbral - tono) / max(umbral, 1e-3), 0, 1)  # 0 en el umbral, 1 en negro
    semi = (0.25 + grosor_max * prof) / 2.0
    return np.clip((semi + 0.7 - d) / 1.4, 0, 1) * (prof > 0.0)


def main():
    ruta = entrada()
    im = Image.open(ruta).convert('RGB')
    if im.size[0] != ANCHO:
        im = im.resize((ANCHO, int(round(im.size[1] * ANCHO / im.size[0]))), Image.LANCZOS)
    rgb = np.asarray(im)
    h, w = rgb.shape[:2]
    gris = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gris = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gris)
    suave = cv2.bilateralFilter(gris, 9, 40, 9)
    tono = gaussian_filter(suave.astype(np.float32) / 255.0, 2.2)

    # bordes: Canny sobre la foto suavizada; se quitan las motas y se engorda un pelo
    bord = cv2.Canny(cv2.GaussianBlur(suave, (0, 0), 2.3), 52, 135)
    n, etiq, stats, _ = cv2.connectedComponentsWithStats((bord > 0).astype(np.uint8), 8)
    mantener = np.zeros(n, bool)
    mantener[1:] = stats[1:, cv2.CC_STAT_AREA] >= 70
    bord = mantener[etiq].astype(np.uint8) * 255
    bord = cv2.dilate(bord, np.ones((2, 2), np.uint8))
    bord = gaussian_filter(bord.astype(np.float32) / 255.0, 0.6)
    bord = np.clip(bord * 1.35, 0, 1) * 0.92
    # el césped y la hiedra (muy verdes) llevan sobre todo rayado: sus bordes son ruido de hierba
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    verde = gaussian_filter(np.clip((g - np.maximum(r, b)) / 60.0, 0, 1), 6)
    bord *= np.clip(1 - verde * 1.1, 0.12, 1)

    # rayado cruzado: la mano tiembla (campo de ruido lento sumado a la coordenada de cada raya)
    t1 = ruido(h, w, 14) * 1.7
    t2 = ruido(h, w, 14) * 1.7
    t3 = ruido(h, w, 18) * 1.5
    r1 = capa_rayada(tono, 38, 7.0, 0.74, 1.6, t1)
    r2 = capa_rayada(tono, -38, 7.0, 0.55, 1.7, t2)
    r3 = capa_rayada(tono, 6, 5.5, 0.36, 2.0, t3)
    rayado = np.clip(np.maximum.reduce([r1 * 0.78, r2 * 0.82, r3 * 0.9]), 0, 1)

    tinta = np.clip(np.maximum(bord, rayado), 0, 1)
    out = PAPEL[None, None, :] * (1 - tinta[..., None]) + TINTA[None, None, :] * tinta[..., None]
    out = np.clip(out, 0, 255).astype(np.uint8)
    Image.fromarray(out).save(SALIDA, 'WEBP', quality=60, method=6)
    print('%s -> %s  (%dx%d, %d KB)' % (os.path.relpath(ruta, RAIZ), os.path.relpath(SALIDA, RAIZ), w, h, os.path.getsize(SALIDA) // 1024))


if __name__ == '__main__':
    main()
