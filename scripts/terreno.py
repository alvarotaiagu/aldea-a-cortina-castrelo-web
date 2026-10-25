# «A un cuarto de hora de la aldea» (sección #alrededor): datos del 3D y del plano de Aldea Rural A Cortiña (Pepín).
#
# Fuentes (se descargan una vez a pruebas/3d-fuente/, que NO se publica; con un User-Agent propio y pausas):
#   MDT05 del IGN por WCS (Elevacion4258_5) y ortofoto PNOA por WMS (OI.OrthoimageCoverage): © Instituto Geográfico
#   Nacional, CC BY 4.0. Dos parches finos (0,35 m/px): la aldea y el castillo de Monterrei.
#   Minutos y caminos en coche: OSRM (router.project-osrm.org, perfil coche), datos © colaboradores de OpenStreetMap:
#   cuatro rutas (Castrelo do Val, Verín, castillo de Monterrei, Laza) + Chaves e Invernadeiro (solo para saber la dirección).
# Caja del 3D: lat 41,915–42,095, lon −7,530 – −7,310 (≈ 18,2 × 20,0 km): la aldea, Castrelo, Verín, Monterrei y Laza,
#   con el valle del Támega. Invernadeiro y Chaves quedan fuera: solo se señalan como dirección.
# Los anillos son DISTANCIAS EN LÍNEA RECTA (0,5 · 2 · 4 · 6 · 8 km), dibujados a pulso alrededor de la aldea; los minutos van
#   en los rótulos de cada sitio (por carretera, de OSRM). No son isocronas: en este monte las carreteras dan muchas vueltas
#   (Laza está a 6,6 km en línea recta y a 25 min en coche) y eso es justo lo que cuenta la escena.
#
# Salida en img/terreno/:
#   alturas-<nx>x<nz>.bin   Uint16 little-endian, decímetros, fila 0 = norte (móvil 384 / escritorio 576)
#   orto-1536.*, orto-3072.*  ortofoto (móvil / escritorio), fila 0 = norte
#   aldea-1024.*, aldea-1536.*, monterrei-1024.*, monterrei-1536.*   los dos parches finos (móvil / escritorio)
#   plano-base.*            plano de tinta (relieve sombreado + curvas de nivel sobre papel), sin anillos
#   plano.*                 lo mismo con los anillos, las rutas y los rótulos (respaldo de la web, sin JS; también
#                           el «póster» mientras carga el 3D: no se pinta WebGL para hacerlo)
#   logo-pin.webp           el dibujo de la solaina del logo (sin redibujar) en un disco de papel, para la chincheta
#   terreno.json            caja, mallas, lugares, rutas, anillos (radios y semillas)
#
# Uso (desde la carpeta de la web): python -I scripts/terreno.py
import json, math, pathlib, sys, time, urllib.request, urllib.error
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageEnhance, ImageFont
from scipy import ndimage as nd
Image.MAX_IMAGE_PIXELS = None

R = pathlib.Path(__file__).resolve().parent.parent
FUENTE = R / 'pruebas' / '3d-fuente'
OUT = R / 'img' / 'terreno'
FUENTE.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
UA = {'User-Agent': 'CortinaWeb/1.0 (anillos de la aldea; web de Aldea Rural A Cortiña)'}

S, N, O, E = 41.915, 42.095, -7.530, -7.310
ALDEA = (42.00832, -7.41637)             # ortofoto del IGN (DATOS: cenador, losas, piscina y césped coinciden con las fotos)
DESTINOS = {                              # lat, lon del punto de rutas.json (las «(pueblo)» / «(centro)»); min y km de DATOS
    'castrelo':  dict(t='Castrelo do Val', sub='el pueblo', ll=(41.9915, -7.4247), min=5, km=2.6),
    'verin':     dict(t='Verín', sub='el centro', ll=(41.9407, -7.4364), min=14, km=8.5),
    'monterrei': dict(t='Castillo de Monterrei', sub='con el Parador', ll=(41.9483, -7.4518), min=21, km=10.4),
    'laza':      dict(t='Laza', sub='el pueblo', ll=(42.0606, -7.4617), min=25, km=15.3),
}
ANILLOS = [(500, 'castrelo'), (2000, 'castrelo'), (4000, 'verin'), (6000, 'laza'), (8000, 'monterrei')]   # radio en m y hacia qué sitio arranca el trazo
LEJOS = {   # fuera de la caja: solo la dirección (rótulo en el borde)
    'invernadeiro': dict(t='Invernadeiro', sub='49 km por carretera hasta Vilariño de Conso', ll=(42.1492112, -7.2775545)),
    'chaves': dict(t='Chaves (Portugal)', sub='36 km · 41 min', ll=(41.7399003, -7.4715213)),
}
EX = 1.6
lat0 = (S + N) / 2
KX, KZ = 111320 * math.cos(math.radians(lat0)), 110950       # metros por grado
ancho, alto = (E - O) * KX, (N - S) * KZ

def parche(c, lado):   # caja s, n, o, e de un cuadrado de «lado» metros centrado en c
    dl, do = lado / 2 / KZ, lado / 2 / KX
    return (c[0] - dl, c[0] + dl, c[1] - do, c[1] + do)
P_ALDEA, P_MON = parche(ALDEA, 720), parche(DESTINOS['monterrei']['ll'], 820)

# ---------- 0. Descargas (una vez; pausa entre peticiones) ----------
def pide(url, intentos=3):
    for intento in range(intentos):   # el IGN y OSRM dan algún 502 suelto: tres intentos, con calma
        try: return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300).read()
        except urllib.error.HTTPError as e:
            if e.code < 500 or intento == intentos - 1: raise
            print('  ', e.code, 'otra vez en', 15 * (intento + 1), 's', flush=True); time.sleep(15 * (intento + 1))
def baja(url, f, minimo=20000):
    p = FUENTE / f
    if p.exists() and p.stat().st_size > minimo: return p
    print('pido', f, flush=True)
    d = pide(url); p.write_bytes(d); print('  ', f, len(d) // 1024, 'KB', flush=True); time.sleep(2)
    return p
WMS = 'https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=OI.OrthoimageCoverage&STYLES=&CRS=EPSG:4326&FORMAT=image/jpeg'
# el WCS da como mucho 4096 px por lado (el MDT05 va a 4,5e-5°): dos hojas, oeste y este, que se cosen por sus tiepoints
MEDIO = (O + E) / 2
HOJAS = (('mdt5b-oeste.tif', O, MEDIO + .002), ('mdt5b-este.tif', MEDIO - .002, E))
for f, o, e in HOJAS:
    baja('https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=Elevacion4258_5'
         f'&SUBSET=Lat({S},{N})&SUBSET=Long({o},{e})&FORMAT=image/tiff', f, 1_000_000)
# la ortofoto, en dos franjas (norte y sur) de 4096 px de ancho: el WMS no da más de 4096 por lado
OW = 4096; OH2 = round(OW * (alto / 2) / ancho)
LATM = (S + N) / 2
baja(f'{WMS}&BBOX={LATM},{O},{N},{E}&WIDTH={OW}&HEIGHT={OH2}', 'pnoab-norte.jpg')
baja(f'{WMS}&BBOX={S},{O},{LATM},{E}&WIDTH={OW}&HEIGHT={OH2}', 'pnoab-sur.jpg')
for nombre, (s, n, o, e) in (('aldea', P_ALDEA), ('monterrei', P_MON)):   # parches: un extra, si el WMS falla se piden la próxima vez
    try: baja(f'{WMS}&BBOX={s},{o},{n},{e}&WIDTH=2048&HEIGHT=2048', f'{nombre}-pnoa.jpg')
    except Exception as er: print('  sin parche', nombre, er)

# OSRM: las cuatro rutas (con el tiempo de cada tramo) y una tabla de tiempos a una rejilla de la comarca
def osrm_ruta(clave, ll):
    f = FUENTE / f'ruta-{clave}.json'
    if f.exists(): return json.loads(f.read_text(encoding='utf-8'))
    print('pido ruta', clave, flush=True)
    d = pide(f'https://router.project-osrm.org/route/v1/driving/{ALDEA[1]},{ALDEA[0]};{ll[1]},{ll[0]}?overview=full&geometries=geojson&annotations=duration,distance')
    f.write_bytes(d); time.sleep(1.5); return json.loads(d)
RUTAS = {k: osrm_ruta(k, v['ll'])['routes'][0] for k, v in DESTINOS.items()}
for k in ('chaves', 'invernadeiro'):
    RUTAS[k] = osrm_ruta(k, LEJOS[k]['ll'])['routes'][0]
# las tipografías del plano (solo para pintar el respaldo; Google Fonts, TTF)
def tipografia(nombre, url):
    p = FUENTE / nombre
    if not p.exists():
        try: p.write_bytes(pide(url))
        except Exception as e: print('  sin tipografía', nombre, e)
    return p
F_TIT = tipografia('IbarraRealNova-500.ttf', 'https://fonts.gstatic.com/s/ibarrarealnova/v30/sZlSdQiA-DBIDCcaWtQzL4BZHoiDundw4ATyjed3EXdS5MDt.ttf')
F_MONO = tipografia('OverpassMono-400.ttf', 'https://fonts.gstatic.com/s/overpassmono/v21/_Xm5-H86tzKDdAPa-KPQZ-AC_COcRycquHlL6EXUokzz.ttf')

if __name__ == '__main__' and 'solo-bajar' in sys.argv:
    raise SystemExit

# ---------- 1. Relieve: las dos hojas cosidas en la rejilla del MDT05 y recortadas a la caja ----------
hojas = [Image.open(FUENTE / f) for f, _, _ in HOJAS]
px, py = hojas[0].tag_v2[33550][:2]
wD, hD = round((E - O) / px), round((N - S) / py)
dem = np.zeros((hD, wD), np.float32); hecho = np.zeros((hD, wD), bool)
for im in hojas:
    a = np.array(im, dtype=np.float32); x0 = round((im.tag_v2[33922][3] - O) / px); y0 = round((N - im.tag_v2[33922][4]) / py)
    xa, ya = max(0, x0), max(0, y0); xb, yb = min(wD, x0 + a.shape[1]), min(hD, y0 + a.shape[0])
    dem[ya:yb, xa:xb] = a[ya - y0:yb - y0, xa - x0:xb - x0]; hecho[ya:yb, xa:xb] = True
assert hecho.all(), 'faltan píxeles del MDT en la caja'
# el MDT05 del WCS viene en metros enteros: un desenfoque de 1,5 px (≈7 m) quita los escalones de las laderas suaves
dem = nd.gaussian_filter(dem, 1.5)
def local(lat, lon): return [round((lon - (O + E) / 2) * KX, 1), round(((S + N) / 2 - lat) * KZ, 1)]
def cota_xz(x, z):   # altura real (bilineal) en metros locales
    c = (x / ancho + .5) * (wD - 1); r = (z / alto + .5) * (hD - 1)
    return float(nd.map_coordinates(dem, [[r], [c]], order=1, mode='nearest')[0])
def uv(x, z): return [round(x / ancho + .5, 4), round(z / alto + .5, 4)]

# ---------- 2. Mallas (área media, sin escalones) ----------
MALLAS = []
for nx in (384, 576):
    nz = round(nx * alto / ancho)
    a = np.array(Image.fromarray(dem).resize((nx, nz), Image.BOX), dtype=np.float32)
    (OUT / f'alturas-{nx}x{nz}.bin').write_bytes(np.round(np.clip(a, 0, 6000) * 10).astype('<u2').tobytes())
    MALLAS.append([nx, nz])

# ---------- 3. Las rutas de hoy (OSRM): cada 24 m, y los tiempos de cada punto ----------
def traza(ruta, paso=24.0):
    """Polilínea local de la ruta, remuestreada cada «paso» m, con los minutos de cada punto (acumulados de OSRM)"""
    ll = np.array(ruta['geometry']['coordinates'], dtype=np.float64)
    xz = np.column_stack([(ll[:, 0] - (O + E) / 2) * KX, ((S + N) / 2 - ll[:, 1]) * KZ])
    ann = ruta['legs'][0]['annotation']
    dur = np.array(ann['duration'], dtype=np.float64)
    assert len(dur) == len(xz) - 1, (len(dur), len(xz))
    tmin = np.concatenate([[0], np.cumsum(dur)]) / 60
    seg = np.hypot(*np.diff(xz, axis=0).T); s = np.concatenate([[0], np.cumsum(seg)])
    t = np.arange(0, s[-1], paso); t = np.append(t, s[-1])
    return np.interp(t, s, xz[:, 0]), np.interp(t, s, xz[:, 1]), np.interp(t, s, tmin), float(s[-1])
TR = {k: traza(v) for k, v in RUTAS.items()}
for k, d in DESTINOS.items():
    print(f'ruta {k:10} OSRM {RUTAS[k]["distance"] / 1000:5.1f} km {RUTAS[k]["duration"] / 60:5.1f} min   (DATOS: {d["km"]} km, {d["min"]} min)')

# ---------- 4. Los anillos: círculos a pulso alrededor de la aldea (el mismo trazado que en js/3d/guion.js) ----------
ax, az0 = local(*ALDEA)
ONDAS = ((3, .0060, 1.1), (5, .0040, 2.3), (8, .0026, 0.4), (13, .0016, 3.9))   # (veces por vuelta, amplitud relativa, fase)
def radio_pulso(R_, i, th):
    """El radio de la vuelta i a ese ángulo (rad, desde el norte, en sentido horario): una suma de ondas, como el temblor de la mano"""
    amp = min(1.0, R_ / 2000.0) * 40.0
    return R_ + amp * sum(a_ / .0060 * math.sin(k_ * th + f_ + i * 1.7) for k_, a_, f_ in ONDAS) / 2.2
def punto_anillo(R_, i, th):
    r = radio_pulso(R_, i, th); return ax + r * math.sin(th), az0 - r * math.cos(th)
def trazado_anillo(R_, i, semilla_th, paso=45.0):
    n = max(24, int(2 * math.pi * R_ / paso)); m = n // 2
    a = [punto_anillo(R_, i, semilla_th + 2 * math.pi * j / n) for j in range(m + 1)]
    b = [punto_anillo(R_, i, semilla_th - 2 * math.pi * j / n) for j in range(n - m + 1)]
    return np.array(a), np.array(b)
def rumbo_a(clave):
    x, z = local(*DESTINOS[clave]['ll']); return math.atan2(x - ax, -(z - az0))
anillos = []
for i, (R_, ref) in enumerate(ANILLOS):
    a_, b_ = trazado_anillo(R_, i, rumbo_a(ref))
    anillos.append({'r': R_, 'ref': ref, 'a': a_, 'b': b_, 'largo': float(np.hypot(*np.diff(a_, axis=0).T).sum())})
    ok = (np.abs(np.vstack([a_, b_])[:, 0]) < ancho / 2 - 60).all() and (np.abs(np.vstack([a_, b_])[:, 1]) < alto / 2 - 60).all()
    print(f'anillo {R_ / 1000:3.1f} km: {len(a_) + len(b_)} puntos, {"dentro de la caja" if ok else "SE SALE de la caja"}')
for k, d in DESTINOS.items():
    x, z = local(*d['ll']); print(f'  {k:10} a {math.hypot(x - ax, z - az0) / 1000:4.1f} km en línea recta; {d["km"]} km y {d["min"]} min por carretera')

# ---------- 5. Ortofoto (dos tamaños) y los parches finos ----------
orto = np.vstack([np.array(Image.open(FUENTE / 'pnoab-norte.jpg').convert('RGB'), dtype=np.float32), np.array(Image.open(FUENTE / 'pnoab-sur.jpg').convert('RGB'), dtype=np.float32)])
# el PNOA a veces trae dos vuelos con un corte en una columna (una franja más oscura y azulada): se busca el escalón que se
# repite en todas las filas y se iguala con la ganancia por canal medida a los dos lados, con el borde difuminado
paso_col = np.abs(np.median(orto[:, 4:] - orto[:, :-4], axis=0)).sum(1)
C0 = int(np.argmax(paso_col)) + 2
print('escalón máximo entre columnas del PNOA:', round(float(paso_col.max()), 1), 'en', C0)
if paso_col[C0 - 2] > 12:
    xx = np.arange(orto.shape[1]); peso = np.clip((xx - C0 + 70) / 140, 0, 1)
    for ch in range(3):
        g = np.median(orto[:, C0 - 90:C0 - 6, ch]) / max(1, np.median(orto[:, C0 + 6:C0 + 90, ch]))
        orto[:, :, ch] *= 1 + (g - 1) * peso
    print('corte del PNOA en la columna', C0)
# y la costura entre la franja norte y la sur (dos peticiones): se mira el escalón de la fila central
h2 = orto.shape[0] // 2
sal = np.median(orto[h2:h2 + 3], axis=(0, 1)) - np.median(orto[h2 - 3:h2], axis=(0, 1)); print('salto en la costura norte/sur (RGB):', np.round(sal, 1))
orto = Image.fromarray(np.clip(orto, 0, 255).astype('uint8'))
orto = ImageEnhance.Color(ImageEnhance.Contrast(orto).enhance(1.08)).enhance(.92)
ortos = {}
for w, qj, qw in ((1536, 64, 52), (3072, 62, 50)):
    h = round(w * alto / ancho / 2) * 2
    o = orto.resize((w, h), Image.LANCZOS)
    o.save(OUT / f'orto-{w}.jpg', quality=qj, optimize=True, progressive=True)
    o.save(OUT / f'orto-{w}.webp', quality=qw, method=6)
    ortos[str(w)] = [w, h]
parches = {}
for nombre, (s, n, o, e) in (('aldea', P_ALDEA), ('monterrei', P_MON)):
    f = FUENTE / f'{nombre}-pnoa.jpg'
    if not f.exists(): continue
    im = ImageEnhance.Contrast(ImageEnhance.Color(Image.open(f).convert('RGB')).enhance(.94)).enhance(1.06)
    for w in (1024, 1536):
        iw = im.resize((w, w), Image.LANCZOS)
        iw.save(OUT / f'{nombre}-{w}.jpg', quality=72, optimize=True, progressive=True)
        iw.save(OUT / f'{nombre}-{w}.webp', quality=52, method=6)
    parches[nombre] = {'xz': local((s + n) / 2, (o + e) / 2), 'ancho': round((e - o) * KX, 1), 'alto': round((n - s) * KZ, 1)}

# ---------- 6. La chincheta: el dibujo de la solaina del logo (sin redibujar) en un disco de papel ----------
PAPEL = (244, 239, 230); TINTA = (31, 26, 23); ALMAGRE = (163, 48, 44)
def chincheta():
    f = R / 'ref' / 'fotos' / 'web' / 'aldea-rural.png'
    if not f.exists(): print('  sin ref/fotos/web/aldea-rural.png: sin chincheta'); return False
    S2 = 4; W = 192 * S2
    dib = Image.open(f).convert('L'); bb = Image.eval(dib, lambda v: 255 - v).getbbox(); dib = dib.crop(bb)
    k = (W * .70) / max(dib.size); dib = dib.resize((round(dib.width * k), round(dib.height * k)), Image.LANCZOS)
    lienzo = Image.new('RGB', (W, W), PAPEL); lienzo.paste(Image.new('RGB', dib.size, TINTA), ((W - dib.width) // 2, (W - dib.height) // 2), Image.eval(dib, lambda v: 255 - v))
    d = ImageDraw.Draw(lienzo); d.ellipse([W * .035, W * .035, W * .965, W * .965], outline=TINTA, width=2 * S2)
    m = Image.new('L', (W, W), 0); ImageDraw.Draw(m).ellipse([W * .02, W * .02, W * .98, W * .98], fill=255)
    out = lienzo.convert('RGBA'); out.putalpha(m)
    out.resize((192, 192), Image.LANCZOS).save(OUT / 'logo-pin.webp', quality=88, method=6); return True
hay_pin = chincheta()

# ---------- 7. El plano de tinta: relieve sombreado y curvas de nivel sobre papel ----------
PW = 1800; PH = round(PW * alto / ancho)
K = 2; BW, BH = PW * K, PH * K
dK = np.array(Image.fromarray(dem).resize((BW, BH), Image.BICUBIC), dtype=np.float32)
dK = nd.gaussian_filter(dK, 2.2)
d1 = np.array(Image.fromarray(dem).resize((PW, PH), Image.BOX), dtype=np.float32)
gy, gx_ = np.gradient(d1 * EX, ancho / PW)
az, al = math.radians(315), math.radians(40)
sl = np.arctan(np.hypot(gx_, gy)); asp = np.arctan2(-gx_, gy)
hs = np.clip(math.sin(al) * np.cos(sl) + math.cos(al) * np.sin(sl) * np.cos(az - asp), 0, 1)
hs = nd.gaussian_filter(hs, .8)
lum = np.array(orto.resize((PW, PH), Image.LANCZOS).convert('L'), dtype=np.float32) / 255
lum = nd.gaussian_filter(lum, 1.2)
sombra = np.clip(1 + .95 * (hs - .62), .60, 1.07)
uso = .80 + .20 * np.clip((lum - .10) / .28, 0, 1)          # el monte (oscuro) pesa un poco más que el prado
papel = np.array(PAPEL, np.float32)
base = papel[None, None, :] * (sombra * uso)[..., None]
base *= np.array([1.0, .985, .955], np.float32)[None, None, :] ** (1.6 - sombra[..., None])   # las sombras, un poco pardas
base = np.clip(base, 0, 255).astype(np.uint8)
big = cv2.resize(base, (BW, BH), interpolation=cv2.INTER_CUBIC)
# curvas de nivel: finas cada 20 m, maestras cada 100 m
lin = big.astype(np.float32)
capa = np.zeros((BH, BW), np.float32)
lo, hi = float(dK.min()), float(dK.max())
for nivel in range(int(lo // 20 + 1) * 20, int(hi), 20):
    maestra = nivel % 100 == 0
    m = (dK >= nivel).astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    tmp = np.zeros((BH, BW), np.uint8)
    for c in cs:
        if len(c) < 40: continue
        cv2.polylines(tmp, [c], False, 255, 2 if maestra else 1, cv2.LINE_AA)
    capa = np.maximum(capa, tmp.astype(np.float32) / 255 * (.50 if maestra else .20))
tinta_c = np.array([88, 66, 50], np.float32)
lin = lin * (1 - capa[..., None]) + tinta_c * capa[..., None]
plano_big = np.clip(lin, 0, 255).astype(np.uint8)
# marco fino de plumilla alrededor
cv2.rectangle(plano_big, (6, 6), (BW - 7, BH - 7), TINTA, 3, cv2.LINE_AA)
plano_base = Image.fromarray(plano_big).resize((PW, PH), Image.LANCZOS)
plano_base.save(OUT / 'plano-base.jpg', quality=80, optimize=True, progressive=True); plano_base.save(OUT / 'plano-base.webp', quality=74, method=6)

# el respaldo sin JS: anillos con su lavado, las rutas en almagre, los cuatro sitios y la aldea, con rótulos
def aP(x, z): return ((x / ancho + .5) * BW, (z / alto + .5) * BH)
def poli(p): return np.array([aP(x, z) for x, z in p], np.int32).reshape(-1, 1, 2)
im = Image.fromarray(plano_big)
lienzo = plano_big.copy()
for k_, d in DESTINOS.items():     # rutas
    rx, rz, _, _ = TR[k_]
    cv2.polylines(lienzo, [poli(np.column_stack([rx[::2], rz[::2]]))], False, ALMAGRE, 5, cv2.LINE_AA)
for a_ in anillos:        # anillos: tinta con un hilo de papel dentro
    pts = np.vstack([a_['b'][::-1], a_['a'][1:]])
    cv2.polylines(lienzo, [poli(pts)], True, TINTA, 7, cv2.LINE_AA)
    cv2.polylines(lienzo, [poli(pts)], True, PAPEL, 2, cv2.LINE_AA)
im = Image.fromarray(lienzo); dr = ImageDraw.Draw(im)
fT = ImageFont.truetype(str(F_TIT), 15 * K + 6) if F_TIT.exists() else ImageFont.load_default()
fM = ImageFont.truetype(str(F_MONO), 9 * K + 5) if F_MONO.exists() else ImageFont.load_default()
def rotulo(x, z, t, sub, dx=14, dy=-16, ancla='l'):
    X, Y = aP(x, z)
    w1 = dr.textlength(t, font=fT); w2 = dr.textlength(sub, font=fM); w = max(w1, w2) + 22; h = 15 * K + 6 + 9 * K + 5 + 16
    x0 = X + dx if ancla == 'l' else X - dx - w; y0 = Y + dy - h
    dr.rectangle([x0, y0, x0 + w, y0 + h], fill=PAPEL, outline=TINTA, width=3); dr.rectangle([x0 + 5, y0 + 5, x0 + w - 5, y0 + h - 5], outline=TINTA, width=1)
    dr.text((x0 + 11, y0 + 7), t, font=fT, fill=TINTA); dr.text((x0 + 11, y0 + 11 + 15 * K + 6), sub, font=fM, fill=ALMAGRE)
    dr.line([(X, Y), (x0 + (14 if ancla == 'l' else w - 14), y0 + h)], fill=TINTA, width=3)
for k_, d in DESTINOS.items():
    x, z = local(*d['ll']); X, Y = aP(x, z)
    dr.ellipse([X - 13, Y - 13, X + 13, Y + 13], fill=PAPEL, outline=TINTA, width=4); dr.ellipse([X - 5, Y - 5, X + 5, Y + 5], fill=ALMAGRE)
for k_, dx_, dy_, anc in (('castrelo', -16, 24, 'r'), ('verin', -16, 40, 'r'), ('monterrei', 16, 54, 'l'), ('laza', 16, -4, 'l')):
    d = DESTINOS[k_]; x, z = local(*d['ll']); rotulo(x, z, d['t'], f'{d["min"]} min · {str(d["km"]).replace(".", ",")} km', dx_ if anc == 'r' else dx_, dy_, anc)
X, Y = aP(ax, az0)
if hay_pin and (OUT / 'logo-pin.webp').exists():
    pin = Image.open(OUT / 'logo-pin.webp').convert('RGBA').resize((92, 92), Image.LANCZOS); im.paste(pin, (int(X - 46), int(Y - 46)), pin)
    dr.ellipse([X - 47, Y - 47, X + 47, Y + 47], outline=ALMAGRE, width=5)
else:
    dr.ellipse([X - 20, Y - 20, X + 20, Y + 20], fill=ALMAGRE, outline=PAPEL, width=5)
rotulo(ax, az0, 'Aldea Rural A Cortiña', 'Pepín · el punto de partida', 40, -22, 'l')
for i_, a_ in enumerate(anillos[1:], 1):        # los kilómetros sobre cada anillo, hacia el este (a 100° del norte)
    th = math.radians(100); x, z = punto_anillo(a_['r'], i_, th); X, Y = aP(x, z)
    t = f'{a_["r"] // 1000} km'; w = dr.textlength(t, font=fM); dr.rectangle([X - w / 2 - 6, Y - 14, X + w / 2 + 6, Y + 14], fill=PAPEL, outline=TINTA, width=2); dr.text((X - w / 2, Y - 12), t, font=fM, fill=TINTA)
plano = im.resize((PW, PH), Image.LANCZOS)
plano.save(OUT / 'plano.jpg', quality=80, optimize=True, progressive=True); plano.save(OUT / 'plano.webp', quality=74, method=6)

# ---------- 8. Lugares y metadatos ----------
def al_borde(lat, lon, margen=520):   # fuera de la caja: el punto del borde de la maqueta en la línea aldea → lugar
    c0 = np.array(local(*ALDEA)); c1 = np.array(local(lat, lon)); v = c1 - c0
    lim_x, lim_z = ancho / 2 - margen, alto / 2 - margen
    k = min([((lim_x if v[0] > 0 else -lim_x) - c0[0]) / v[0] if v[0] else 9, ((lim_z if v[1] > 0 else -lim_z) - c0[1]) / v[1] if v[1] else 9, 1])
    p = c0 + v * k; return [round(float(p[0]), 1), round(float(p[1]), 1)], round(math.degrees(math.atan2(v[0], -v[1])) % 360)
def lugar(t, sub, xz, **kw):
    return {'t': t, 'sub': sub, 'xz': xz, 'h': round(cota_xz(*xz), 1), 'uv': uv(*xz), **kw}
L = {'aldea': lugar('Aldea Rural A Cortiña', 'Pepín', local(*ALDEA), alto=170)}
for k, d in DESTINOS.items():
    L[k] = lugar(d['t'], d['sub'], local(*d['ll']), min=d['min'], km=d['km'], alto=170 if k != 'monterrei' else 200)
for k, d in LEJOS.items():
    xz, rumbo = al_borde(*d['ll']); L[k] = lugar(d['t'], d['sub'], xz, fuera=True, rumbo=rumbo, alto=320)
def ruta_json(k):
    rx, rz, rt, largo = TR[k]
    return {'paso': 24.0, 'largo': round(largo, 1), 'x': [round(float(v), 1) for v in rx], 'z': [round(float(v), 1) for v in rz]}
def trazo_json(p): return [round(float(v), 1) for v in np.asarray(p).reshape(-1)]
meta = {'caja': {'s': S, 'n': N, 'o': O, 'e': E}, 'ancho': round(ancho), 'alto': round(alto), 'mallas': MALLAS, 'exageracion': EX,
        'min': round(float(dem.min()), 1), 'max': round(float(dem.max()), 1), 'ortos': ortos, 'parches': parches,
        'plano': {'w': PW, 'h': PH}, 'lugares': L, 'orden': ['castrelo', 'verin', 'monterrei', 'laza'],
        'rutas': {k: ruta_json(k) for k in DESTINOS},
        'anillos': [{'r': a_['r'], 'ref': a_['ref'], 'largo': round(a_['largo'], 1), 'i': i, 'th0': round(rumbo_a(a_['ref']), 4)} for i, a_ in enumerate(anillos)],
        'ondas': [list(o) for o in ONDAS],
        'fuente': 'MDT05 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0) · Minutos en coche: OSRM, datos © colaboradores de OpenStreetMap'}
(OUT / 'terreno.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('caja km', round(ancho / 1000, 2), round(alto / 1000, 2), '| alturas', int(dem.min()), '->', int(dem.max()), '| aldea', L['aldea']['h'], 'm | parches', list(parches))
for p in sorted(OUT.iterdir()): print(f'{p.name:28} {p.stat().st_size // 1024:6} KB')
