/* Genera las páginas a partir de sus fuentes *.src.html:
   1. <!--parte:partes/archivo.html--> → el contenido de ese archivo. Si no existe (la cortina mientras
      el módulo Entrada no la deje), deja un comentario y la web funciona sin ella.
   2. <img data-foto="nombre" ...> → <picture> con AVIF, WebP y JPG en todos los anchos de
      img/fotos/fotos.json (el <img> conserva sus demás atributos).
   3. <!--plano-ruta--> → el plano 2D de «Alrededor» (img/terreno/plano.*) si el módulo Ruta
      ya lo ha dejado; si no, nada (el respaldo se queda con la lista de distancias).
   4. Los <link> y <script> de CSS/JS propios que aún no existen (los módulos de otros agentes
      mientras no estén) se quitan con un aviso: la web no pide archivos que no hay.
   5. Ejecuta versionar.mjs para poner ?v=<huella> a CSS y JS.
   Se edita SIEMPRE el *.src.html (o la parte); el .html generado se sobrescribe. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const FOTOS = new Map(JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8')).map((f) => [f.nombre, f]));

function picture(atrs) {
  const nombre = /data-foto="([^"]+)"/.exec(atrs)[1];
  const f = FOTOS.get(nombre);
  if (!f) throw new Error('Foto desconocida: ' + nombre);
  const sizes = (/\bsizes="([^"]+)"/.exec(atrs) || [, '100vw'])[1];
  const set = (ext) => f.anchos.map((w) => `img/fotos/${nombre}-${w}.${ext} ${w}w`).join(', ');
  const base = f.anchos.includes(800) ? 800 : f.anchos[f.anchos.length - 1];
  let resto = atrs.replace(/\s*data-foto="[^"]+"/, '').replace(/\s*\bsizes="[^"]+"/, '');
  if (!/\bloading=/.test(resto) && !/fetchpriority="high"/.test(resto)) resto += ' loading="lazy"';
  if (!/\bdecoding=/.test(resto)) resto += ' decoding="async"';
  return `<picture data-foto="${nombre}">`
    + `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
    + `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
    + `<img src="img/fotos/${nombre}-${base}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${f.ancho}" height="${f.alto}"${resto}>`
    + `</picture>`;
}

const partes = (html, prof = 0) => html.replace(/<!--parte:([^\s>]+)\s*-->/g, (m, ruta) => {
  const f = path.join(RAIZ, ruta);
  if (!fs.existsSync(f)) { console.warn('  (falta ' + ruta + ')'); return `<!-- sin ${ruta} -->`; }
  if (prof > 3) throw new Error('Partes anidadas de más: ' + ruta);
  return partes(fs.readFileSync(f, 'utf8').trim(), prof + 1);
});

// tamaño de un PNG, WebP o JPEG leyendo su cabecera (sin dependencias)
function tamano(f) {
  const b = fs.readFileSync(f);
  if (b.slice(1, 4).toString() === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.slice(0, 4).toString() === 'RIFF') {
    const t = b.slice(12, 16).toString();
    if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (t === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (t === 'VP8L') { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) { const m = b[i + 1], l = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + l; }
  }
  return null;
}
function plano() {
  const dir = path.join(RAIZ, 'img/terreno');
  const hay = ['avif', 'webp', 'jpg', 'png'].filter((e) => fs.existsSync(path.join(dir, 'plano.' + e)));
  if (!hay.length) { console.warn('  (sin img/terreno/plano.*: el respaldo de la ruta va sin plano)'); return ''; }
  const base = hay.find((e) => e === 'jpg' || e === 'png') || hay[hay.length - 1];
  const t = tamano(path.join(dir, 'plano.' + base)) || tamano(path.join(dir, 'plano.' + hay.find((e) => e !== 'avif'))) || [1600, 1000];
  const fuentes = hay.filter((e) => e !== base).map((e) => `<source type="image/${e}" srcset="img/terreno/plano.${e}">`).join('');
  return `<picture>${fuentes}<img class="ruta__plano" src="img/terreno/plano.${base}" width="${t[0]}" height="${t[1]}" alt="Plano de tinta de los alrededores de la aldea, con anillos cada 2 km y los caminos en coche a Castrelo do Val (5 min), Verín (14 min), el castillo de Monterrei (21 min) y Laza (25 min)." loading="lazy" decoding="async"></picture>`;
}

const quitarAusentes = (html) => html
  .replace(/[ \t]*<link rel="stylesheet" href="(css\/[^"?]+)"[^>]*>\r?\n?/g, (m, r) => (fs.existsSync(path.join(RAIZ, r)) ? m : (console.warn('  (sin ' + r + ': se quita su <link>)'), '')))
  .replace(/[ \t]*<script (?:type="module" )?src="(js\/[^"?]+)"[^>]*><\/script>\r?\n?/g, (m, r) => (fs.existsSync(path.join(RAIZ, r)) ? m : (console.warn('  (sin ' + r + ': se quita su <script>)'), '')));

const fuentes = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.src.html'));
for (const src of fuentes) {
  let html = quitarAusentes(partes(fs.readFileSync(path.join(RAIZ, src), 'utf8')));
  if (html.includes('<!--plano-ruta-->')) html = html.replace('<!--plano-ruta-->', plano());
  html = html.replace(/<img\b([^>]*\bdata-foto="[^"]+"[^>]*)>/g, (m, a) => picture(a.replace(/\s*\/$/, '')));
  const destino = src.replace('.src.html', '.html');
  fs.writeFileSync(path.join(RAIZ, destino), html);
  console.log(`${src} → ${destino} (${(html.length / 1024).toFixed(0)} KB)`);
}
execFileSync(process.execPath, [path.join(RAIZ, 'versionar.mjs')], { stdio: 'inherit' });
