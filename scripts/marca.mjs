/* La marca de Aldea Rural A Cortiña: su logo real (dibujo a plumilla de la solaina dentro de un círculo fino,
   con «Aldea Rural» y «A CORTIÑA»). NO se redibuja: solo se pasa de «tinta negra sobre blanco» a «tinta sobre
   transparente» (el negro de la tinta se vuelve --tinta, #1F1A17; el blanco, transparente) y se reduce.
   Fuentes (ref/fotos/web):
     favicon.jpg (512×512, el mejor: el logo completo)  → logo-*.png y la versión en papel para fondos oscuros
     aldea-rural.png (891×752, el dibujo de la solaina SIN letras ni círculo) → icono y favicons
     logo-gloton.png (996×842, «Burguer Rural · Disfruta como un jabalí») → marca/burguer-rural-*.png (tal cual, reducido)
     image003.png, cartel-subvencion*.png (carteles de ayudas) → img/ayudas/*.png (tal cual)
   Uso: node scripts/marca.mjs  → marca/logo-240.png, logo-480.png (cabecera y pie, 1x y 2x), logo-papel-480.png
   (tinta en papel, para sobre piedra), logo-512.png (el máster recortado, para Entrada), simbolo.png (la solaina),
   favicon.svg, favicon-32.png, apple-touch-icon.png, icono-512.png, burguer-rural-*.png, img/ayudas/*.png e
   img/og.jpg (1200×630). Necesita antes img/fotos/ (scripts/fotos.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(RAIZ, 'ref/fotos/web');
const PAPEL = '#F4EFE6', TINTA = [0x1f, 0x1a, 0x17], PAPELRGB = [0xf4, 0xef, 0xe6];
fs.mkdirSync(path.join(RAIZ, 'marca'), { recursive: true });
fs.mkdirSync(path.join(RAIZ, 'img/ayudas'), { recursive: true });

// tinta de un dibujo (negro sobre blanco o sobre transparente) → RGBA del color pedido, con alfa = oscuridad
async function tinta(fichero, color, { recortar = true, margen = 8 } = {}) {
  const { data, info } = await sharp(fichero).flatten({ background: '#ffffff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < data.length; i++) {
    // niveles: ≤ 60 es tinta entera, ≥ 245 es papel (el JPG deja un poco de halo)
    const a = Math.max(0, Math.min(1, (245 - data[i]) / (245 - 60)));
    out[i * 4] = color[0]; out[i * 4 + 1] = color[1]; out[i * 4 + 2] = color[2]; out[i * 4 + 3] = Math.round(a * 255);
  }
  let img = sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
  let buf = await img.toBuffer();
  if (recortar) {
    buf = await sharp(buf).trim({ threshold: 8 }).toBuffer();
    buf = await sharp(buf).extend({ top: margen, bottom: margen, left: margen, right: margen, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  }
  return buf;
}

// 1. el logo completo en tinta sobre transparente: máster recortado y las dos medidas de cabecera/pie
const logo = await tinta(path.join(WEB, 'favicon.jpg'), TINTA);
const lm = await sharp(logo).metadata();
fs.writeFileSync(path.join(RAIZ, 'marca/logo-512.png'), logo);
// tamaño real recortado ≈ 460 px de ancho: no se amplía; la cabecera usa 240 (1x) y 480 (2x, como mucho el máster)
const anchoMax = lm.width;
for (const w of [160, 240, 480]) {
  await sharp(logo).resize({ width: Math.min(w, anchoMax), kernel: 'lanczos3', withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(path.join(RAIZ, `marca/logo-${w}.png`));
}
// la versión en papel, para sobre piedra o almagre sin etiqueta
const logoPapel = await tinta(path.join(WEB, 'favicon.jpg'), PAPELRGB);
await sharp(logoPapel).resize({ width: Math.min(480, anchoMax), kernel: 'lanczos3', withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(path.join(RAIZ, 'marca/logo-papel-480.png'));

// 2. la solaina sola (sin letras ni círculo): para los iconos
const sol = await tinta(path.join(WEB, 'aldea-rural.png'), TINTA, { margen: 0 });
fs.writeFileSync(path.join(RAIZ, 'marca/simbolo.png'), await sharp(sol).resize({ width: 640, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer());

async function icono(tam, radio = 0) {
  const marco = Math.round(tam * 0.1), ancho = tam - 2 * marco;
  const dib = await sharp(sol).resize({ width: ancho, height: ancho, fit: 'inside', kernel: 'lanczos3' }).toBuffer();
  const m = await sharp(dib).metadata();
  const fondo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}"><rect width="${tam}" height="${tam}" rx="${radio}" fill="${PAPEL}"/><circle cx="${tam / 2}" cy="${tam / 2}" r="${tam / 2 - tam * 0.035}" fill="none" stroke="#1F1A17" stroke-width="${Math.max(1, tam * 0.012)}"/></svg>`);
  return sharp(fondo).composite([{ input: dib, left: Math.round((tam - m.width) / 2), top: Math.round((tam - m.height) / 2) }]).png().toBuffer();
}
await sharp(await icono(128, 24)).resize(32, 32, { kernel: 'lanczos3' }).png().toFile(path.join(RAIZ, 'marca/favicon-32.png'));
await sharp(await icono(180)).png().toFile(path.join(RAIZ, 'marca/apple-touch-icon.png'));
await sharp(await icono(512)).png().toFile(path.join(RAIZ, 'marca/icono-512.png'));
const b64 = (await icono(96, 18)).toString('base64');
fs.writeFileSync(path.join(RAIZ, 'marca/favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="64" viewBox="0 0 96 96"><image width="96" height="96" href="data:image/png;base64,${b64}"/></svg>\n`);

// 3. Burguer Rural, tal cual (reducido, sin ampliar)
for (const w of [420, 840]) await sharp(path.join(WEB, 'logo-gloton.png')).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(path.join(RAIZ, `marca/burguer-rural-${w}.png`));

// 4. carteles de ayudas, tal cual (PNG optimizado)
for (const [de, a] of [['cartel-subvencion-2.png', 'feder-galicia.png'], ['cartel-subvencion.png', 'inega-bono-energia.png'], ['image003.png', 'next-generation-fotovoltaica.png']]) {
  await sharp(path.join(WEB, de)).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(path.join(RAIZ, 'img/ayudas', a));
}

// 5. og:image 1200×630: papel, el logo a la izquierda y la fachada de almagre y piedra a la derecha, con filete de tinta
const logoOg = await sharp(logo).resize({ width: 520, withoutEnlargement: true }).toBuffer();
const lo = await sharp(logoOg).metadata();
const foto = await sharp(path.join(RAIZ, 'img/fotos/casa-fachada-1024.jpg')).resize(520, 560, { fit: 'cover', position: 'centre' }).toBuffer();
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${PAPEL}"/>
  <text x="62" y="${70 + lo.height + 56}" font-family="Georgia, serif" font-size="38" fill="#1F1A17">Una aldea de piedra y almagre</text>
  <text x="62" y="${70 + lo.height + 102}" font-family="Georgia, serif" font-size="38" font-style="italic" fill="#7A2320">en Pepín, Castrelo do Val</text>
  <text x="62" y="${70 + lo.height + 156}" font-family="Consolas, monospace" font-size="16" letter-spacing="2" fill="#4E4540">CASA PARA SEIS · DOS APARTAMENTOS</text>
  <rect x="632" y="32" width="528" height="568" fill="none" stroke="#1F1A17" stroke-width="1.4"/>
</svg>`;
await sharp(Buffer.from(og)).composite([
  { input: logoOg, left: 62, top: 56 },
  { input: foto, left: 636, top: 36 },
]).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(RAIZ, 'img/og.jpg'));
console.log(`marca/ lista (logo recortado ${lm.width}×${lm.height}), img/ayudas/ e img/og.jpg`);
