#!/usr/bin/env python3
"""Entrada · la madera de la puerta de la cortina.

Genera img/llave/madera.webp: tablas verticales de madera oscura con vetas finas, nudos y juntas. Semilla fija.
La imagen encaja en horizontal (el grano es periódico en x), así que la cortina la repite con repeat-x.
Uso:  python scripts/entrada-madera.py
"""
import os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, gaussian_filter1d

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SALIDA = os.path.join(RAIZ, 'img', 'llave', 'madera.webp')
W, H = 1200, 1200
TABLAS = 6
rng = np.random.default_rng(2610)


def periodico_x(sigma_x, sigma_y, escala=1.0):
    """Ruido suave que encaja en horizontal (envuelve en x)."""
    r = rng.standard_normal((H, W)).astype(np.float32)
    r = gaussian_filter(r, (sigma_y, sigma_x), mode=('wrap', 'wrap'))
    r -= r.mean()
    r /= (r.std() + 1e-6)
    return r * escala


ancho_tabla = W // TABLAS
y, x = np.mgrid[0:H, 0:W].astype(np.float32)

# base: color por tabla (cada una un poco distinta) + grano alargado en vertical
base = np.zeros((H, W, 3), np.float32)
colores = [(66, 45, 31), (58, 40, 28), (72, 50, 34), (61, 42, 29), (68, 47, 32), (56, 38, 26)]
for i in range(TABLAS):
    x0, x1 = i * ancho_tabla, (i + 1) * ancho_tabla
    base[:, x0:x1, :] = np.array(colores[i % len(colores)], np.float32)

# vetas: líneas verticales finas que ondulan (desplazamiento del ruido lento)
onda = periodico_x(60, 120) * 9.0
fino = periodico_x(1.1, 38)          # grano muy estirado en vertical
medio = periodico_x(3.5, 90)
veta = np.sin((x + onda) * (2 * np.pi / 7.0) + medio * 1.6)  # franjas de unos 7 px que serpentean
sombra = 0.55 * fino + 0.35 * medio + 0.28 * veta
sombra = gaussian_filter(sombra, (0.8, 0.5))

largo = periodico_x(400, 160)  # manchas largas: cada tabla envejece distinto
img = base * (1 + 0.27 * sombra[..., None] + 0.09 * largo[..., None])

# luz: más clara a lo ancho del centro de cada tabla (tablas algo abombadas) y borde oscuro en cada junta
dx = ((x % ancho_tabla) / ancho_tabla - 0.5) * 2
img *= (1 - 0.16 * dx ** 2)[..., None]
junta = np.exp(-(((x % ancho_tabla) - 0) / 3.2) ** 2) + np.exp(-(((x % ancho_tabla) - ancho_tabla) / 3.2) ** 2)
img *= (1 - 0.78 * np.clip(junta, 0, 1))[..., None]
# biselado: una línea de luz fina junto a la junta
bisel = np.exp(-(((x % ancho_tabla) - 7) / 2.0) ** 2)
img += (bisel * 9)[..., None] * np.array([1.0, 0.8, 0.6], np.float32)

# nudos: elipses oscuras con anillos alrededor
for _ in range(13):
    cx = rng.uniform(0, W)
    cy = rng.uniform(80, H - 80)
    rx = rng.uniform(9, 20)
    ry = rng.uniform(26, 62)
    d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
    anillos = np.exp(-d / 5.0) * (0.5 + 0.5 * np.cos(np.sqrt(d) * 5.5))
    img *= (1 - 0.42 * np.exp(-d / 1.1) - 0.16 * anillos)[..., None]
    # las vetas rodean el nudo: empuja un poco la luz
    img *= (1 + 0.04 * np.exp(-d / 14.0) * np.sin(np.sqrt(d) * 2.1))[..., None]

# clavos de las juntas (cabezas de hierro) a dos alturas
for fy in (0.22, 0.78):
    for i in range(TABLAS):
        cx = i * ancho_tabla + ancho_tabla / 2
        cy = fy * H
        d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        img *= (1 - 0.55 * np.exp(-(d / 5.5) ** 4))[..., None]

# un poco de polvo claro, para que no sea liso del todo
img += (periodico_x(0.9, 0.9) * 1.8)[..., None]
img = np.clip(img, 0, 255).astype(np.uint8)

Image.fromarray(img).save(SALIDA, 'WEBP', quality=72, method=6)
print('madera.webp', os.path.getsize(SALIDA), 'bytes')
