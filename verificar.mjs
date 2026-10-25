/* Verificación de la web de Aldea Rural A Cortiña (Playwright, un solo navegador, ventanas pequeñas, escala 1).
   Uso: node verificar.mjs            (puerto 8911; todo)
        node verificar.mjs 3 4        (solo los bloques 3 y 4, para depurar)
   Sin capturas: lo que hay que mirar a ojo va en el README. El WebGL del 3D NO se pinta: el navegador arranca
   con --disable-3d-apis (sin swiftshader) y la página se abre con ?sin-3d; se comprueba solo que la ruta monta o
   deja su respaldo. Todas las pruebas con movimiento reducido salvo las de movimiento (cortina, láminas, titulares),
   que van una vez y al final. Los módulos de los otros agentes se prueban solo si ya están (si no, su respaldo). */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const sharp = require('sharp');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8911;
const SOLO = process.argv.slice(2).map(Number).filter(Boolean);
const toca = (n) => !SOLO.length || SOLO.includes(n);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.bin': 'application/octet-stream' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
const PAG = BASE + 'index.html?sin-3d';

const fallos = [];
let nOk = 0;
const comprobar = (cond, m, detalle) => { if (cond) { nOk++; console.log('  ok     ' + m); } else { fallos.push(m); console.log('  FALLO  ' + m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle) : '')); } };
const nota = (m) => console.log('  ·      ' + m);
const LLAVE = 'acortina-cookies';
const sinCookies = `try { localStorage.setItem('${LLAVE}', 'si'); } catch (e) {}`;
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const HAY = { llave: existe('js/llave.js'), dibujo: existe('js/dibujo.js'), plano: existe('js/plano.js'), comarca: existe('js/comarca.js'), barra: existe('js/barra.js'), ruta: existe('js/3d/arranque.js'), cortina: existe('partes/cortina.html') };

/* librerías desde una copia local: la prueba no depende del CDN ese día */
const CDN = {
  'lenis.min.js': 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js',
  'gsap.min.js': 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
  'ScrollTrigger.min.js': 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js',
};
const CACHE = path.join(os.tmpdir(), 'acortina-cdn');
fs.mkdirSync(CACHE, { recursive: true });
for (const [n, u] of Object.entries(CDN)) {
  const f = path.join(CACHE, n);
  if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(await (await fetch(u)).arrayBuffer()));
}
const RE_CDN = /cdn\.jsdelivr\.net\/npm\/.*\/(lenis|gsap|ScrollTrigger)\.min\.js$/;
const local = (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) });

/* ================= 0. archivos (sin navegador) ================= */
if (toca(1)) {
console.log('\n0. Archivos');
console.log('  (módulos presentes: ' + Object.entries(HAY).map(([k, v]) => k + (v ? ' sí' : ' no')).join(', ') + ')');
const htmls = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'));
for (const f of htmls) {
  const s = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  comprobar(/^<!DOCTYPE html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, ?nofollow">/.test(s), `${f}: charset lo primero y noindex justo detrás`);
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
  comprobar(rep.length === 0, `${f}: ningún id repetido`, [...new Set(rep)]);
  comprobar(!/<!--parte:/.test(s) && !/<!-- sin partes\/(cabeza|cabecera|reserva|llegar|pie|guiones)/.test(s), `${f}: todas las partes de la web incluidas`);
}
if (!HAY.cortina) nota('aún no está partes/cortina.html (módulo Entrada): la web va sin cortina');
comprobar(['.nojekyll', '404.html', 'manifest.json', 'img/og.jpg', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/icono-512.png', 'marca/logo-160.png', 'marca/logo-240.png', 'marca/logo-480.png', 'marca/logo-papel-480.png', 'marca/burguer-rural-420.png', 'img/piedra/losa.webp', 'img/piedra/fondo.webp', 'img/piedra/almagre.webp', 'img/piedra/papel.webp', 'css/piedra.css', 'img/fotos/fotos.json'].every(existe), '.nojekyll, 404, manifest, og:image, favicons, logo, texturas de piedra y fotos.json');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const lista = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/fotos-lista.json'), 'utf8'));
const fotosJson = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8'));
{
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href|imagesrcset)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && r !== './' && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !existe(r));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza`, faltan);

  /* fotos */
  const nombres = ['casa-fachada', 'casa-salon', 'casa-dormitorio-1', 'casa-dormitorio-2', 'casa-dormitorio-3', 'casa-dormitorio-4', 'casa-bano', 'solaina', 'apto1-salon', 'apto1-cocina', 'apto1-dormitorio', 'apto1-dormitorio-2', 'apto1-bano', 'ventana-granito', 'apto2-dormitorio', 'apto2-dormitorio-2', 'apto2-bano', 'apto2-salon', 'apto2-cocina', 'piscina', 'cenador', 'cenador-mesas', 'vista-aldea', 'sala-juegos', 'sala-billar', 'llave'];
  comprobar(nombres.every((n) => fotosJson.some((f) => f.nombre === n)) && fotosJson.length === nombres.length, `están las ${nombres.length} fotos que piden los módulos por nombre (fotos.json), y ninguna más`, nombres.filter((n) => !fotosJson.some((f) => f.nombre === n)));
  const faltanFotos = [];
  for (const f of fotosJson) for (const w of f.anchos) for (const e of ['avif', 'webp', 'jpg']) if (!existe(`img/fotos/${f.nombre}-${w}.${e}`)) faltanFotos.push(`${f.nombre}-${w}.${e}`);
  comprobar(faltanFotos.length === 0, 'cada foto existe en todos sus anchos y en AVIF, WebP y JPG', faltanFotos.slice(0, 5));
  const ampliadas = [];
  for (const f of fotosJson) {
    const ori = await sharp(path.join(RAIZ, 'ref', f.origen)).metadata();
    if (f.ancho > ori.width) ampliadas.push([f.nombre, f.ancho, ori.width]);
    for (const w of f.anchos) { const m = await sharp(path.join(RAIZ, `img/fotos/${f.nombre}-${w}.jpg`)).metadata(); if (m.width > ori.width) ampliadas.push([f.nombre, w, ori.width]); }
  }
  comprobar(ampliadas.length === 0, 'ninguna foto se amplía por encima de su tamaño real', ampliadas);
  const peq = ['ventana-granito', 'llave'].map((n) => fotosJson.find((f) => f.nombre === n));
  comprobar(peq.every((f) => f && f.ancho <= 900), 'ventana-granito y llave, a 900 px como mucho', peq.map((f) => f && [f.nombre, f.ancho]));
  comprobar(lista.every((f) => !/alojamiento-verin-casa-rural|hamburguesa|patatas|perrito|unsplash|DALL|logo-gloton/i.test(f.ruta)) && !/alojamiento-verin-casa-rural|hamburguesa\.jpg|patatas-fritas|perrito-caliente/.test(html), 'ni la piscina rectangular, ni las fotos de comida de banco, ni fotos generadas con IA');
  comprobar(/img\/fotos\/casa-fachada-1920\.(avif|webp|jpg)/.test(html) && fotosJson.find((f) => f.nombre === 'casa-fachada').ancho === 1920, 'la fachada, la foto grande de la portada, llega a 1920 px (su tamaño real)');

  /* textos prohibidos */
  const texto = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
  comprobar(/4,6/.test(texto) && /216 opiniones/.test(texto) && /9,5/.test(texto) && /66 opiniones/.test(texto), 'las opiniones con su recuento: 4,6 en Google (216) y 9,5 en Booking (66)');
  comprobar(/«Impresionante para quien quiera disfrutar de la naturaleza y desconectar»/.test(html) && /José Luis M\./.test(html) && /Abril de 2026/.test(html), 'la cita de José Luis M. (abril de 2026), literal y con su fuente');
  comprobar(['sitio tranquilo', 'recién reformado', 'la piscina es fantástica', 'buena gente'].every((t) => html.includes(t)), 'las cuatro etiquetas literales de Kayak');
  comprobar(!/whatsapp|wa\.me/i.test(html), 'sin WhatsApp (no consta que el móvil lo tenga)');
  comprobar(!/aire acondicionado|climatiz|desayun/i.test(texto), 'no promete aire acondicionado ni desayuno (los portales se contradicen)');
  comprobar(!/\b(19|20|21|22)\s*m[óo]dulos|9,02|11\.790/.test(texto), 'las placas: sin número de módulos ni potencia (20 o 22 según la fuente)');
  comprobar(!/TR-OR-0*97/.test(html) && /Registro de turismo: <span class="sup">por confirmar<\/span>/.test(html), 'registro de turismo «por confirmar» (TR-OR-97 solo sale en Trip.com)');
  comprobar(!/siglo|\b1[0-9]{3}\b|centenari|antigu|histori/i.test(texto.replace(/Real Decreto \d+\/\d+/g, '')), 'nada de historia inventada: ni siglos, ni años de construcción');
  comprobar(!/el mejor|los mejores|la mejor|clientes satisfechos|cientos de|miles de|sin permanencia|garantizad/i.test(texto), 'sin superlativos propios ni prueba social inventada');
  comprobar(/No se admiten/.test(texto) && /de 16:00 a 20:00/.test(texto) && /antes de las 12:00/.test(texto) && /julio y agosto/.test(texto), 'datos reales: sin mascotas, entrada de 16:00 a 20:00, salida antes de las 12:00 y piscina en julio y agosto');
  comprobar(/Pepín, 40/.test(html) && /32625 Castrelo do Val/.test(html) && /988 41 92 15/.test(html) && /645 263 522/.test(html) && /a\.p\.pepin@hotmail\.com/.test(html) && /42\.0083/.test(html), 'dirección, los dos teléfonos, el correo y las coordenadas (42.0083, −7.4163)');
  comprobar(/2,6 km/.test(html) && /8,5 km/.test(html) && /10,4 km/.test(html) && /15,3 km/.test(html) && /Invernadeiro/.test(html) && !/Invernadeiro[^<]{0,60}(a \d+ min)/.test(html), 'distancias de OSRM; Invernadeiro solo como dirección');
  comprobar(/<html lang="es">/.test(html) && !/\/es\/|hreflang/.test(html) && [...html.matchAll(/lang="gl"/g)].length <= 2, 'solo castellano (el gallego, solo en «cortiña»)');
  comprobar(/en gallego, la cortiña es la finca cerrada junto a la casa/i.test(html) && !/RAG|Real Academia/.test(texto), '«cortiña» explicada sin comillas de diccionario (la cita literal no se ha comprobado)');
  comprobar(/cigarrón|cigarróns/.test(texto) && /peliqueiro/.test(texto) && /almagre \(el almagre es el rojo|el almagre es el rojo/.test(texto) && /solaina: la galería/.test(texto), 'se explican «almagre», «solaina», «cigarrón» y «peliqueiro» la primera vez');
  comprobar([...html.matchAll(/<img\b[^>]*>/g)].every((m) => /\salt="/.test(m[0])), 'todas las imágenes llevan alt');
  comprobar((() => { try { JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]); return true; } catch (e) { return false; } })() && !/aggregateRating|reviewCount/.test(html), 'el JSON-LD se lee y no lleva recuento de reseñas propio');
  comprobar(!/Instrument Serif|Fraunces|Gloock|Newsreader|IM Fell|Commissioner|Spline Sans/i.test(html + fs.readFileSync(path.join(RAIZ, 'css/estilos.css'), 'utf8')) && /Ibarra\+Real\+Nova/.test(html) && /Libre\+Franklin/.test(html) && /Overpass\+Mono/.test(html), 'tres letras (Ibarra Real Nova, Libre Franklin, Overpass Mono) y ninguna de las ya usadas en la cartera');

  /* contrato web ↔ módulos */
  const iMain = html.indexOf('js/main.js');
  const mods = ['js/llave.js', 'js/dibujo.js', 'js/plano.js', 'js/comarca.js', 'js/barra.js'].filter((s) => html.includes('src="' + s));
  comprobar(mods.every((s) => html.indexOf('src="' + s) < iMain && new RegExp('<script src="' + s.replace('.', '\\.') + '[^"]*" defer>').test(html)), 'los JS de los módulos que hay, con defer y antes de main.js', mods);
  comprobar(!html.includes('js/3d/arranque.js') || (/<script type="module" src="js\/3d\/arranque\.js[^"]*"/.test(html) && html.indexOf('js/3d/arranque.js') > iMain), 'el 3D, como módulo diferido y al final');
  comprobar(['css/entrada.css', 'css/plano.css', 'css/comarca.css', 'css/3d.css'].filter((c) => html.includes(c)).every((c) => html.indexOf(c) < html.indexOf('</head>') && html.indexOf(c) > html.indexOf('css/estilos.css')), 'los CSS de los módulos que hay, en el <head> y después del de la web');
  comprobar(/<section id="portada" class="portada"[^>]*>\s*<div class="portada__modulo" data-modulo="dibujo">\s*<picture data-foto="casa-fachada">/.test(html) && /<div class="portada-texto">/.test(html)
    && /<section id="aldea" class="[^"]*aldea[^"]*"[^>]*aria-labelledby="t-aldea">[\s\S]*?<h2 id="t-aldea"/.test(html) && /data-modulo="plano"/.test(html)
    && /<section id="barra" [^>]*aria-labelledby="t-barra">/.test(html) && /data-modulo="barra"/.test(html)
    && /<section id="alrededor" [^>]*aria-labelledby="t-alrededor">/.test(html) && /data-modulo="ruta"/.test(html)
    && /<section id="cuando" [^>]*aria-labelledby="t-cuando">/.test(html) && /data-modulo="comarca"/.test(html)
    && /<footer [^>]*id="pie"[\s\S]*data-modulo="circulo"/.test(html), 'los sitios de los módulos, como dice el contrato (dibujo, plano, barra, ruta, comarca y círculo)');
  const secciones = ['portada', 'finca', 'aldea', 'dentro', 'fuera', 'barra', 'alrededor', 'cuando', 'opiniones', 'reservar', 'llegar', 'pie'];
  const pos = secciones.map((s) => html.indexOf(`id="${s}"`));
  comprobar(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), 'las doce secciones, en el orden del encargo', secciones.filter((s, i) => pos[i] < 0));
  const sup = (id) => (new RegExp(`id="${id}"[^>]*class="[^"]*"|class="[^"]*"[^>]*id="${id}"`).exec(html) || [''])[0];
  comprobar(/sup-piedra/.test(sup('fuera')) && /sup-almagre/.test(sup('barra')) && /sup-papel/.test(sup('cuando')) && /sup-almagre/.test(sup('reservar')) && /sup-piedra/.test(sup('alrededor')) && /sup-papel/.test(sup('aldea')), 'superficies: Fuera piedra, La barra almagre, Cuándo venir papel, Reservar almagre, Alrededor piedra, La aldea papel');
  comprobar((html.match(/data-lamina/g) || []).length >= 4 && /lamina--a/.test(html) && /lamina--b/.test(html) && /lamina--c/.test(html), 'láminas de piedra con tres variantes de borde');
}
const css = fs.readFileSync(path.join(RAIZ, 'css/estilos.css'), 'utf8');
comprobar(['--papel: #F4EFE6', '--papel-2: #EAE2D4', '--tinta: #1F1A17', '--tinta-2: #4E4540', '--almagre: #A3302C', '--almagre-hondo: #7A2320', '--piedra: #2A2420', '--piedra-2: #3B332D', '--liquen: #C9BFA8', '--madera: #8A5A3B', '--prado: #5E7A3A', '--agua: #5FA7A8'].every((t) => css.includes(t)) && /--almagre-texto:\s*color-mix/.test(css), 'la paleta del encargo en :root, con --almagre-texto derivado por color-mix');
comprobar(!/(background|color|border[a-z-]*)\s*:[^;{}]*var\(--(prado|agua)\)/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), '--prado y --agua no se usan en la web (solo los módulos, para el césped y la piscina)');
comprobar(/\.cookies:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex/.test(css) && !/\.cookies\s*\{[^}]*display:/.test(css), 'cookies: display solo en :not([hidden])');
comprobar(/\.mando:not\(\[hidden\]\)/.test(css) && !/\.mando\s*\{[^}]*display:/.test(css), 'mando: display solo en :not([hidden])');
comprobar(/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(css), '[hidden] siempre oculta (las pestañas y los paneles usan hidden)');
comprobar(/\.menu-movil\s*\{[^}]*height:\s*100dvh/.test(css) && !/\.menu-movil\s*\{[^}]*inset:\s*0/.test(css), 'menú móvil: altura 100dvh, nunca inset:0 (la cabecera lleva backdrop-filter)');
comprobar(!/\ddvh/.test(css.replace(/\.menu-movil\s*\{[^}]*\}/, '')), 'fuera del menú fijo, ningún dvh (la barra del móvil no mueve nada)');
comprobar(/html\.cortina-fuera #cortina\s*\{\s*display:\s*none/.test(css) && /prefers-reduced-motion: reduce\)\s*\{\s*#cortina\s*\{\s*display:\s*none/.test(css) && /#cortina\[hidden\]\s*\{\s*display:\s*none/.test(css), 'cortina: la web la oculta al salir, con [hidden] y con movimiento reducido');
comprobar(!/cursor:\s*none/.test(css), 'sin cursor propio');
comprobar(!/position:\s*sticky/.test(css) && !/marquee/i.test(css + (fs.existsSync(path.join(RAIZ, 'index.html')) ? fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8') : '')), 'fuera la pila sticky de tarjetas y el marquee');
comprobar(/\.lamina__losa\s*\{[^}]*transform:\s*translate3d/.test(css) && !/\.lamina[^{]*\{[^}]*height\s*:\s*calc\(var\(--p/.test(css) && !/transition:[^;]*height/.test(css), 'las láminas se deslizan con transform (nunca animando height)');
comprobar(/\.foco-rayado/.test(css) && /:focus-visible\s*\{\s*outline:\s*2px solid/.test(css), 'foco: contorno de 2 px y el rayado de plumilla (#foco-rayado)');
const mainJs = fs.readFileSync(path.join(RAIZ, 'js/main.js'), 'utf8');
comprobar(/raiz\.classList\.add\('con-movimiento'\)/.test(mainJs) && /const motion = !quieto;/.test(mainJs), '«con-movimiento» solo sin movimiento reducido');
comprobar(/if \(esBarra\(\)\) return;/.test(mainJs) && !/addEventListener\('resize'[^;]*innerHeight/.test(mainJs), 'el resize de la barra del móvil no rehace nada');
{
  const cab = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  comprobar(/window\.__redCortina = setTimeout/.test(cab) && /<noscript><style>\.cortina,#cortina\{display:none!important\}<\/style><\/noscript>/.test(cab), 'red de seguridad inline y <noscript> para la cortina');
}
}

/* ================= navegador: uno solo, sin WebGL ================= */
const browser = await chromium.launch({ headless: true, args: ['--disable-3d-apis'] });
try {
  async function nueva(op = {}, { cdn = 'local', script, abortar } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce', ...op });
    if (cdn === 'local') await ctx.route(RE_CDN, local);
    if (cdn === 'caido') await ctx.route(RE_CDN, (r) => r.abort());
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.route(/google\.com\/maps/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>mapa</p>' }));
    if (abortar) await ctx.route(abortar, (r) => r.abort());
    if (script) await ctx.addInitScript(script);
    const page = await ctx.newPage();
    page._errores = [];
    page.on('pageerror', (e) => page._errores.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|WebGL|webgl/.test(m.text())) page._errores.push('consola: ' + m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) page._errores.push(r.status() + ' ' + r.url()); });
    return { ctx, page };
  }
  const fuera = (page) => page.waitForFunction(() => document.documentElement.classList.contains('cortina-fuera'), null, { timeout: 12000 });
  // contraste WCAG y APCA de las parejas de texto (componiendo el alfa sobre el fondo)
  const contrastes = (page, sel) => page.evaluate((sel) => {
    const lz = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (c) => { lz.clearRect(0, 0, 1, 1); lz.fillStyle = '#000'; lz.fillStyle = c; lz.fillRect(0, 0, 1, 1); return [...lz.getImageData(0, 0, 1, 1).data]; };
    const L = (m) => { m = m.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
    const apca = (t, b) => {
      const Y = (c) => .2126729 * (c[0] / 255) ** 2.4 + .7151522 * (c[1] / 255) ** 2.4 + .072175 * (c[2] / 255) ** 2.4;
      let yt = Y(t), yb = Y(b); const k = (y) => (y > .022 ? y : y + (.022 - y) ** 1.414); yt = k(yt); yb = k(yb);
      if (yb > yt) { const s = (yb ** .56 - yt ** .57) * 1.14; return s < .1 ? 0 : (s - .027) * 100; }
      const s = (yb ** .65 - yt ** .62) * 1.14; return s > -.1 ? 0 : (s + .027) * 100;
    };
    const fondo = (el) => { while (el) { const b = getComputedStyle(el).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b) && !/[, /] ?0\)$/.test(b)) return rgba(b).slice(0, 3); el = el.parentElement; } return rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3); };
    return sel.map((s) => {
      const el = document.querySelector(s); if (!el) return [s, 'falta', 0];
      const f = fondo(el), c = rgba(getComputedStyle(el).color), a = c[3] / 255;
      const t = [0, 1, 2].map((i) => c[i] * a + f[i] * (1 - a));
      const x = L(t), y = L(f); return [s, Math.round(((Math.max(x, y) + .05) / (Math.min(x, y) + .05)) * 100) / 100, Math.round(Math.abs(apca(t, f)) * 10) / 10];
    });
  }, sel);
  const ir = (page, y) => page.evaluate((y) => { const l = window.Cortina.web && window.Cortina.web.lenis; if (l) l.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
  const arriba = (page, sel, dy = 0) => page.evaluate(([s, d]) => document.querySelector(s).getBoundingClientRect().top + scrollY + d, [sel, dy]);

  /* ---------- 1. portada y superficies (escritorio, movimiento reducido) ---------- */
  if (toca(2)) {
  console.log('\n1. Portada, superficies y contraste (escritorio, movimiento reducido)');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    comprobar(await page.evaluate(() => { const c = document.getElementById('cortina'); return (!c || getComputedStyle(c).display === 'none') && !document.documentElement.classList.contains('con-movimiento'); }), 'con movimiento reducido no hay cortina ni «con-movimiento»');
    comprobar(await page.evaluate(() => getComputedStyle(document.body).cursor !== 'none' && !document.querySelector('.cursor, [class*="cursor-"]')), 'sin cursor propio (nunca dos cursores)');
    const p = await page.evaluate(() => {
      const por = document.getElementById('portada'), h1 = document.querySelector('#portada h1');
      const r = h1.getBoundingClientRect();
      const visual = por.querySelector('img, svg, canvas');
      return { h1: h1.textContent.trim(), visible: r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight + 2, visual: !!visual, botones: [...por.querySelectorAll('a.btn')].map((a) => a.getAttribute('href')), dentro: document.getElementById('cab').getBoundingClientRect().bottom <= r.top + 1 };
    });
    comprobar(p.h1 === 'Una aldea de piedra y almagre en Pepín' && p.visible && p.visual && p.botones.includes('#reservar') && p.botones.includes('tel:+34645263522') && p.dentro, 'la portada: titular visible bajo la cabecera, la foto o el dibujo y los botones «Elegir llave» y el teléfono', p);
    comprobar(await page.evaluate(() => { const i = document.querySelector('#portada img'); return !i || (i.complete && i.naturalWidth > 0); }), 'la foto de la portada (si es el respaldo) carga');
    // las tres superficies: colores y texturas
    const sf = await page.evaluate(() => Object.fromEntries(['#finca', '#fuera', '#barra', '#cuando', '#reservar', '#llegar', '#pie'].map((s) => { const c = getComputedStyle(document.querySelector(s)); return [s, [c.backgroundColor, c.backgroundImage.includes('url') ]]; })));
    comprobar(sf['#finca'][0] === 'rgb(244, 239, 230)' && sf['#fuera'][0] === 'rgb(42, 36, 32)' && sf['#barra'][0] === 'rgb(163, 48, 44)' && sf['#cuando'][0] === 'rgb(244, 239, 230)' && sf['#reservar'][0] === 'rgb(163, 48, 44)' && sf['#llegar'][0] === 'rgb(42, 36, 32)' && Object.values(sf).every((v) => v[1]), 'cada sección con su superficie (papel #F4EFE6, piedra #2A2420, almagre #A3302C) y su textura generada', sf);
    comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('dentro')).backgroundColor === 'rgb(234, 226, 212)' && getComputedStyle(document.getElementById('opiniones')).backgroundColor === 'rgb(234, 226, 212)'), 'por dentro y opiniones, en papel 2 (#EAE2D4)');
    // contraste en las tres superficies
    const cs = await contrastes(page, [
      '#finca .eyebrow', '.finca__texto p:nth-of-type(2)', '.finca__def', '.cuenta .mono', '.nota', '.notas__tit', '.finca__f figcaption', '#aldea .eyebrow', '#aldea .sec-cab__txt', '.ficha p:not(.ficha__datos)', '.ficha__datos', '.comunes span', '#aldea .btn--marca',
      '#dentro .sec-cab__txt', '.pestana[aria-selected="false"]', '.pestana[aria-selected="true"]', '.panel__res', '.tiene li', '.panel__fuente', '.g figcaption', '#dentro .btn--marca',
      '#cuando .eyebrow', '.epoca__mes', '.epoca p', '.epoca .btn--hueco', '.cita-grande figcaption .mono', '.nota-cifra i', '.repiten__tit', '.repiten__fuente', '#opiniones .enlace',
      '.pie__eti', '.pie__txt', '.pie__cols p', '.pie__legal', '#pie .btn--marca', '.sup',
      '#fuera .eyebrow', '#fuera .sec-cab__txt', '.fuera__txt p', '.fuera__aviso', '.fuera__cita footer', '.fuera__f figcaption', '.fuera__lista', '#alrededor .eyebrow', '#alrededor .sec-cab__txt', '.alrededor__lista .mono', '.alrededor__fuente',
      '#llegar .eyebrow', '.llegar__baj', '.distancias dd', '.contacto span', '.map-consent p', '#llegar .btn--marca',
      '#barra .eyebrow', '.barra__frase', '.barra__cats', '.barra__nota', '#barra .btn--marca', '#reservar .eyebrow', '#reservar .sec-cab__txt', '.saber__lista dt', '.saber__lista dd', '.saber__pasos li', '.saber .sup', '.demo',
      '.motor__fino', '.motor__pasos li', '.llave__datos', '.llave__plazas', '.motor .btn--marca',
    ]);
    await page.evaluate(() => window.Cortina.motor.elegir('casa'));
    cs.push(...await contrastes(page, ['.dsem', '.mes__tit', '.motor__ley', '.motor__top h3', '.motor__unidad small', '.fechas small', '.motor__msg']));
    const malos = cs.filter(([, v]) => v === 'falta' || v < 4.5);
    comprobar(malos.length === 0, `contraste WCAG ≥ 4,5:1 en ${cs.length} parejas de texto, en papel, piedra y almagre`, malos);
    const lcs = cs.filter(([, v]) => v !== 'falta').map(([s, , lc]) => [s, lc]);
    const flojos = lcs.filter(([, lc]) => lc < 60);
    nota(`APCA: mínimo Lc ${Math.min(...lcs.map(([, l]) => l))} (peor: ${lcs.sort((a, b) => a[1] - b[1])[0][0]}); papel sobre almagre ${lcs.find(([s]) => s === '.barra__frase')?.[1]}`);
    comprobar(flojos.length === 0, 'APCA: ningún texto por debajo de Lc 60 (el texto claro sobre almagre no se queda en un WCAG que se lee mal)', flojos);
    comprobar(await page.evaluate(() => { const m = document.getElementById('mando'); return m.hidden && getComputedStyle(m).display === 'none'; }), 'sin ?revision el mando no se ve');
    comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('vistazo')).display === 'none'), 'la tabla «A Cortiña, de un vistazo» solo sale en la sobria');
    // la cabecera cambia de tinta según la superficie
    const sups = {};
    for (const [sel, esperado] of [['#aldea', 'papel'], ['#fuera', 'piedra'], ['#barra', 'almagre'], ['#cuando', 'papel'], ['#reservar', 'almagre'], ['#llegar', 'piedra']]) {
      await ir(page, await arriba(page, sel, 160)); await page.waitForTimeout(150);
      sups[sel] = await page.evaluate(() => { const c = document.getElementById('cab'); return [c.dataset.sup, getComputedStyle(c).color, getComputedStyle(c.querySelector('.marca')).backgroundColor]; });
      if (sups[sel][0] !== esperado) sups[sel].push('esperado ' + esperado);
    }
    comprobar(Object.entries(sups).every(([s, v]) => v.length === 3) && sups['#fuera'][1] === 'rgb(244, 239, 230)' && sups['#fuera'][2] === 'rgb(244, 239, 230)' && sups['#barra'][2] === 'rgb(244, 239, 230)' && sups['#aldea'][1] === 'rgb(31, 26, 23)', 'la cabecera cambia de tinta según la superficie (papel, piedra, almagre) y el logo va sobre una etiqueta de papel en las oscuras', sups);
    // el foco: contorno de 2 px y el rayado debajo, en las tres superficies
    const focos = [];
    for (const [sel, color] of [['#dentro .panel:not([hidden]) .btn--marca', 'rgb(31, 26, 23)'], ['#fuera .foto-btn', 'rgb(244, 239, 230)'], ['#barra .btn--marca', 'rgb(244, 239, 230)']]) {
      await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), sel);
      await page.locator(sel).first().focus();
      await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(80);
      focos.push(await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e), r = e.getBoundingClientRect(), p = document.getElementById('foco-rayado'), q = p.getBoundingClientRect(); return { el: e.className, outline: s.outlineStyle, ancho: s.outlineWidth, color: s.outlineColor, rayado: getComputedStyle(p).opacity, bajo: q.top >= r.bottom && q.top - r.bottom < 16, tiene: getComputedStyle(p).backgroundImage.includes('repeating-linear-gradient') }; }));
      if (focos[focos.length - 1].color !== color) focos[focos.length - 1].esperado = color;
    }
    comprobar(focos.every((f) => f.outline === 'solid' && f.ancho === '2px' && +f.rayado > 0.5 && f.bajo && f.tiene && !f.esperado), 'el foco del teclado, con forma propia: contorno de 2 px y un rayado de plumilla justo debajo, visible sobre papel, piedra y almagre', focos);
    // mapa solo al pedirlo
    await page.evaluate(() => document.getElementById('mapa').scrollIntoView({ block: 'center' }));
    comprobar(await page.evaluate(() => !document.querySelector('#mapa iframe')), 'el mapa de Google no se carga solo');
    await page.locator('#mapa-btn').click();
    comprobar(await page.evaluate(() => /google\.com\/maps\?q=42\.0083%2C-7\.4163/.test(document.querySelector('#mapa iframe')?.src || '')), 'el mapa se carga al pulsar, en 42.0083, −7.4163');
    comprobar(await page.evaluate(() => typeof window.Cortina.reservar === 'function' && typeof window.Cortina.alAbrirse === 'function' && typeof window.Cortina.visor.abrir === 'function' && typeof window.Cortina.motor.elegir === 'function'), 'la web pone Cortina.reservar(), alAbrirse(), visor.abrir() y motor.elegir() para los módulos');
    comprobar(page._errores.length === 0, 'portada: sin errores de consola ni 404', page._errores.slice(0, 5));
    await ctx.close();
  }
  }

  /* ---------- 2. módulos: montan al acercarse; sin su JS, el respaldo ---------- */
  if (toca(3)) {
  console.log('\n2. Módulos');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    await page.waitForTimeout(400);
    const presentes = await page.evaluate(() => ({ plano: !!window.Cortina.plano, ruta: !!window.Cortina.ruta, comarca: !!window.Cortina.comarca, barra: !!window.Cortina.barra, circulo: !!(window.Cortina.dibujo && window.Cortina.dibujo.circulo) }));
    comprobar(await page.evaluate(() => ['plano', 'ruta', 'comarca', 'barra', 'circulo'].every((m) => document.querySelector(`[data-modulo="${m}"]`).dataset.montado !== '1')), 'plano, ruta, comarca, barra y círculo no se montan al arrancar');
    for (const [sel, nombre, clave] of [['#aldea', 'La aldea en plano', 'plano'], ['#barra', 'La barra', 'barra'], ['#alrededor', 'Alrededor (sin WebGL)', 'ruta'], ['#cuando', 'Cuándo venir', 'comarca'], ['#pie', 'El círculo del pie', 'circulo']]) {
      await page.locator(sel).scrollIntoViewIfNeeded();
      const ok = await page.waitForFunction((s) => document.querySelector(s + ' [data-modulo]').dataset.montado === '1', sel, { timeout: 8000 }).then(() => true, () => false);
      if (presentes[clave] || ok) comprobar(ok, `${nombre} monta al acercarse`);
      else nota(`${nombre}: su JS aún no está; se queda el respaldo`);
    }
    comprobar(await page.evaluate(() => { const r = document.querySelector('[data-modulo="ruta"]'); return /Verín/.test(r.textContent) || !!r.querySelector('img, canvas, svg'); }), 'la ruta, sin WebGL, enseña su plano o su lista de distancias');
    const malosSticky = await page.evaluate(() => { const f = document.querySelector('.ruta-fijo'); if (!f) return null; const m = []; for (let e = f.parentElement; e && e !== document.documentElement; e = e.parentElement) { const c = getComputedStyle(e); if (/hidden|auto|scroll/.test(c.overflowX + c.overflowY) || c.transform !== 'none' || c.contain.includes('paint')) m.push(e.tagName.toLowerCase() + '.' + [...e.classList].join('.') + ':' + c.overflowX + '/' + c.overflowY + '/' + c.transform); } return m; });
    if (malosSticky === null) nota('no hay .ruta-fijo (con ?sin-3d y movimiento reducido la pista no se fija)'); else comprobar(malosSticky.length === 0, 'ningún antepasado de .ruta-fijo lleva overflow hidden/auto ni transform (el sticky del 3D funciona)', malosSticky);
    comprobar(page._errores.length === 0, 'módulos montados sin errores', page._errores.slice(0, 5));
    await ctx.close();
  }
  {
    // el portal: al abrirse la cortina, el dibujo se monta (si el módulo existe)
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(PAG); await fuera(page);
    if (HAY.dibujo) comprobar(await page.waitForFunction(() => document.querySelector('#portada [data-modulo="dibujo"]').dataset.montado === '1', null, { timeout: 6000 }).then(() => true, () => false), 'el dibujo de la portada se monta en cuanto se abre la cortina');
    else nota('js/dibujo.js aún no está: la portada se queda con su respaldo');
    await ctx.close();
  }
  {
    const { ctx, page } = await nueva({}, { script: sinCookies, abortar: /js\/(llave|dibujo|plano|comarca|barra)\.js|js\/3d\// });
    await page.goto(PAG);
    await fuera(page);
    for (const sel of ['#aldea', '#barra', '#alrededor', '#cuando', '#pie']) { await page.locator(sel).scrollIntoViewIfNeeded(); await page.waitForTimeout(250); }
    const r = await page.evaluate(() => [...document.querySelectorAll('[data-modulo]')].map((el) => ({ m: el.dataset.modulo, montado: el.dataset.montado || '', alto: Math.round(el.getBoundingClientRect().height), cosas: el.querySelectorAll('img, svg, li, article').length })));
    comprobar(r.every((x) => !x.montado && x.alto > 100 && x.cosas >= 1), 'sin los JS de los módulos se queda cada respaldo (la foto, las fichas, el logo de la barra, las distancias, las épocas y el logo)', r);
    comprobar(await page.evaluate(() => document.querySelectorAll('.ficha').length === 3 && /Apartamento 2/.test(document.getElementById('aldea').textContent) && document.querySelectorAll('.epoca').length === 4 && document.querySelectorAll('.barra__cats li').length === 5 && !!document.querySelector('.barra__logo') && !!document.querySelector('.pie__circulo img')), 'los respaldos: tres fichas, cuatro épocas, cinco categorías de la barra con su logo y el logo real en el pie');
    comprobar(page._errores.filter((e) => !/llave|dibujo|plano|comarca|barra|3d/.test(e)).length === 0, 'y la página no da errores', page._errores);
    await ctx.close();
  }
  }

  /* ---------- 3. reservar, de punta a punta ---------- */
  if (toca(4)) {
  console.log('\n3. Reservar «Elige tu llave»');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(BASE + 'index.html?sin-3d#reservar');
    await fuera(page);
    const m = await page.evaluate(() => { const M = window.__motor; const y = new Date().getFullYear() + 1; return { julio: M.esAlta(`${y}-07-20`), agosto: M.esAlta(`${y}-08-30`), junio: M.esAlta(`${y}-06-20`), noviembre: M.esAlta(`${y}-11-18`), ss: M.esAlta(M.pascua(y)), precios: M.PRECIO, cuna: M.CUNA, min: M.MIN_NOCHES, max: Object.fromEntries(Object.entries(M.UNIDADES).map(([k, u]) => [k, [u.max, u.sup, u.min]])) }; });
    comprobar(m.julio && m.agosto && !m.junio && !m.noviembre && m.ss && m.precios.baja === 27 && m.precios.alta === 32 && m.cuna === 10 && m.min === 2, 'temporada alta (julio, agosto y Semana Santa), 27 € y 32 € por persona y noche, cuna a 10 €, mínimo 2 noches', m);
    comprobar(JSON.stringify(m.max) === JSON.stringify({ casa: [6, 1, 4], apto1: [2, 1, 2], apto2: [2, 1, 2], aldea: [10, 3, 8] }), 'plazas: casa 6 (+1), apartamentos 2 (+1), aldea 10 (+3); mínimo facturable 4, 2, 2 y 8', m.max);
    comprobar(await page.evaluate(() => /Demostración/.test(document.querySelector('.demo').textContent) && /supuesto|por confirmar/.test(document.getElementById('motor').textContent)), 'el motor dice que es una demostración y marca los supuestos');
    // paso 1: cuatro llaves, cada una con su dibujo
    const ll = await page.evaluate(() => [...document.querySelectorAll('#motor .llave')].map((l) => ({ valor: l.querySelector('input').value, nombre: l.querySelector('.llave__nom').textContent, dib: !!l.querySelector('.llave__dib img, .llave__dib svg') })));
    comprobar(ll.length === 4 && ll.map((l) => l.valor).join() === 'casa,apto1,apto2,aldea' && ll.every((l) => l.dib) && ll[3].nombre === 'La aldea entera', 'paso 1: cuatro llaves (la casa, apartamento 1, apartamento 2 y la aldea entera), cada una con su dibujo', ll);
    comprobar(await page.evaluate(() => document.querySelector('#motor [data-acc="a-fechas"]').getAttribute('aria-disabled') === 'true'), '«Seguir» no se enciende hasta elegir una llave');
    // ocupación: por unidad, y la aldea solo libre si lo están las tres
    const oc = await page.evaluate(() => {
      const M = window.__motor; let dif = 0, aldeaMal = 0, aldeaLibre = 0, n = 0;
      for (let k = M.hoy, i = 0; i < 360; i++) { const d = new Date(k + 'T12:00'); d.setDate(d.getDate() + 1); k = d.toISOString().slice(0, 10);
        const a = M.ocupadaDe('casa', k), b = M.ocupadaDe('apto1', k), c = M.ocupadaDe('apto2', k), t = M.ocupadaDe('aldea', k); n++;
        if (a !== b || b !== c) dif++; if (t !== (a || b || c)) aldeaMal++; if (!t) aldeaLibre++; }
      return { dif, aldeaMal, aldeaLibre, n };
    });
    comprobar(oc.dif > 20 && oc.aldeaMal === 0 && oc.aldeaLibre > 100, 'cada unidad tiene sus noches ocupadas; la aldea entera solo está libre si lo están las tres (y queda con noches libres)', oc);
    // elegir la casa
    await page.locator('#motor .llave input[value="casa"]').check({ force: true });
    comprobar(await page.evaluate(() => document.querySelector('#motor [data-acc="a-fechas"]').getAttribute('aria-disabled') === 'false'), 'al elegir una llave «Seguir» se enciende');
    await page.locator('#motor [data-acc="a-fechas"]').click();
    comprobar(await page.evaluate(() => /Tu estancia/.test(document.getElementById('motor-tit-paso').textContent) && /Noches libres · La casa/.test(document.querySelector('.motor__top h3').textContent)), 'paso 2: las noches libres de la casa');
    await page.evaluate(() => { const st = window.__motor.st; st.ini = st.fin = null; });
    await page.locator('#motor [data-acc="next"]').click();
    const L = await page.evaluate(() => [...document.querySelectorAll('#motor .dia:not([aria-disabled="true"])')].map((b) => b.dataset.k));
    const par = await page.evaluate((L) => { const M = window.__motor; const f = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; for (const k of L) { const d = new Date(k + 'T12:00'); const k1 = f(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)), k2 = f(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2)); if (!M.ocupada(k) && !M.ocupada(k1) && L.includes(k2)) return [k, k1, k2]; } return null; }, L);
    await page.locator(`#motor [data-k="${par[0]}"]`).click();
    await page.locator(`#motor [data-k="${par[1]}"]`).click();
    comprobar(/mínima es de 2 noches/.test(await page.textContent('#motor .motor__msg')), 'una sola noche no vale: mínimo 2 (supuesto)');
    await page.locator(`#motor [data-k="${par[2]}"]`).click();
    comprobar(await page.evaluate(() => /\d/.test(document.querySelector('#desglose [data-total]')?.textContent || '')), 'llegada y salida → total estimado');
    const piscina = await page.evaluate(() => document.querySelector('.motor__piscina')?.textContent || '');
    const mesPar = +par[0].slice(5, 7);
    comprobar((mesPar === 7 || mesPar === 8) ? /abierta/.test(piscina) : /solo abre en julio y agosto/.test(piscina), 'el aviso de la piscina según las fechas (abre en julio y agosto)', [par[0], piscina]);
    await page.locator('#motor [data-acc="seguir"]').click();
    comprobar(await page.evaluate(() => /¿Cuántas personas\?/.test(document.getElementById('motor-tit-paso').textContent)), 'paso 3: personas');
    for (let i = 0; i < 9; i++) await page.locator('#motor [data-acc="mas"]').click().catch(() => {});
    comprobar(await page.evaluate(() => document.getElementById('motor-pers').textContent === '7' && document.querySelector('#motor [data-acc="mas"]').disabled && /supletorias/.test(document.getElementById('motor').textContent)), 'la casa admite 6 + 1 supletoria: siete es el máximo (el botón + se apaga) y avisa de la supletoria');
    // mínimo facturable: con 2 personas se factura por 4
    for (let i = 0; i < 6; i++) await page.locator('#motor [data-acc="menos"]').click().catch(() => {});
    const min = await page.evaluate(() => { const c = window.__motor.cuenta(); return { pers: document.getElementById('motor-pers').textContent, fact: c.fact, aviso: /mínimo por 4 personas/.test(document.getElementById('motor').textContent) }; });
    comprobar(min.pers === '1' && min.fact === 4 && min.aviso, 'mínimo facturable de 4 personas en la casa, con su aviso de supuesto', min);
    await page.locator('#motor [data-acc="mas-cuna"]').click();
    await page.locator('#motor [data-acc="mas"]').click(); await page.locator('#motor [data-acc="mas"]').click(); await page.locator('#motor [data-acc="mas"]').click(); await page.locator('#motor [data-acc="mas"]').click();
    const cuenta = await page.evaluate(() => { const M = window.__motor, c = M.cuenta(); const n = (s) => parseFloat(s.replace(/\./g, '').replace(/[^\d,]/g, '').replace(',', '.')); return { c, total: n(document.querySelector('#desglose [data-total]').textContent), esperado: (c.alta * M.PRECIO.alta + c.baja * M.PRECIO.baja) * c.fact + M.CUNA * c.n, cuna: /Cuna × \d+ noches × 10 €/.test(document.getElementById('desglose').textContent), pers: document.getElementById('motor-pers').textContent }; });
    comprobar(cuenta.total === cuenta.esperado && cuenta.cuna && cuenta.pers === '5', 'total = noches × personas × precio + la cuna (10 € por noche) y la cuna en el resumen', cuenta);
    comprobar(/Mascotas: no se admiten/.test(await page.textContent('#motor')) && /menores de 2 años duermen gratis en las camas existentes/.test(await page.textContent('#motor')), 'mascotas: no se admiten; menores de 2 años gratis en las camas existentes');
    await page.locator('#motor [data-acc="a-datos"]').click();
    await page.locator('#motor-form button[type="submit"]').click();
    comprobar((await page.textContent('#m-error')).includes('Falta'), 'el formulario valida los datos');
    comprobar(await page.evaluate(() => { const b = document.querySelector('#motor-form button[type="submit"]'); const n = b.nextElementSibling; return n && /no se envía, no se guarda ni se cobra nada/.test(n.textContent); }), 'junto al botón dice que no envía, guarda ni cobra nada');
    await page.fill('#m-nombre', 'Ana Prueba'); await page.fill('#m-correo', 'ana@ejemplo.es'); await page.fill('#m-tel', '600 11 22 33'); await page.check('#m-ok');
    await page.locator('#motor-form button[type="submit"]').click();
    const loc = await page.textContent('#motor-loc');
    comprobar(new RegExp('^COR-' + par[0].slice(2).replace(/-/g, '') + '-\\d{3}$').test(loc) && /no se ha enviado, guardado ni cobrado nada/.test(await page.textContent('#motor-demo-hecho')), 'confirmación con localizador COR-AAMMDD-NNN y el aviso de demostración', loc);
    // la aldea entera, un apartamento y la API de la web
    await page.evaluate(() => window.Cortina.reservar('apto2'));
    comprobar(await page.evaluate(() => window.__motor.st.unidad === 'apto2' && window.__motor.st.paso === 'fechas' && /Noches libres · Apartamento 2/.test(document.querySelector('.motor__top h3').textContent)), 'Cortina.reservar(\'apto2\') deja el motor en las noches libres del apartamento 2');
    await page.evaluate(() => window.Cortina.reservar('aldea'));
    await page.evaluate(() => { const st = window.__motor.st; if (!st.fin) { st.ini = null; } document.querySelector('#motor [data-acc="seguir"]')?.click(); for (let i = 0; i < 20; i++) document.querySelector('#motor [data-acc="mas"]:not(:disabled)')?.click(); });
    comprobar(await page.evaluate(() => window.__motor.st.unidad === 'aldea' && window.__motor.MAX() === 13 && window.__motor.UNIDADES.aldea.min === 8), 'la aldea entera: 10 + 3 plazas y mínimo facturable de 8');
    await page.evaluate(() => window.Cortina.reservar(undefined, { mes: 2 }));
    comprobar(await page.evaluate(() => window.__motor.st.m === 1 && /febrero/i.test(document.querySelector('#motor .mes__tit')?.textContent || '')), 'Cortina.reservar(undefined, { mes: 2 }) lleva el calendario a febrero (lo usan los botones de «Cuándo venir»)');
    await page.evaluate(() => window.Cortina.reservar('casa', { mes: 'julio' }));
    comprobar(await page.evaluate(() => window.__motor.st.unidad === 'casa' && window.__motor.st.m === 6), 'y con nombre de mes y unidad: reservar(\'casa\', { mes: \'julio\' })');
    await page.locator('#cuando [data-reservar-mes="2"]').click();
    comprobar(await page.evaluate(() => window.__motor.st.m === 1), 'los botones «Ver fechas de febrero» del respaldo de «Cuándo venir» llaman a la web con el mes');
    await page.locator('#aldea [data-reservar="apto1"]').first().click();
    comprobar(await page.evaluate(() => window.__motor.st.unidad === 'apto1'), '«Elegir esta llave» de las fichas del plano llama a la web con la unidad');
    comprobar(page._errores.length === 0, 'reservar: sin errores', page._errores.slice(0, 5));
    await ctx.close();
  }
  }

  /* ---------- 4. el visor se abre por NOMBRE (cada miniatura, ratón) y las pestañas ---------- */
  if (toca(5)) {
  console.log('\n4. Visor y pestañas');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies, abortar: /js\/(llave|dibujo|plano|comarca|barra)\.js|js\/3d\// });
    await page.goto(PAG);
    await fuera(page);
    const malos = [];
    let total = 0;
    for (const t of ['casa', 'apto1', 'apto2']) {
      await page.locator(`#tab-${t}`).click();
      comprobar(await page.evaluate((t) => ['casa', 'apto1', 'apto2'].every((u) => document.getElementById('panel-' + u).hidden === (u !== t) && document.getElementById('tab-' + u).getAttribute('aria-selected') === String(u === t)), t), `pestaña «${t}»: solo su panel está a la vista y aria-selected lo dice`);
    }
    await page.locator('#tab-casa').click();
    // cada miniatura de la página: en las pestañas, se activa la pestaña de su panel
    const total0 = await page.locator('[data-visor]').count();
    for (let i = 0; i < total0; i++) {
      const b = page.locator('[data-visor]').nth(i);
      const nombre = await b.getAttribute('data-visor');
      const panel = await b.evaluate((e) => e.closest('[role="tabpanel"]')?.id);
      if (panel) await page.locator('#tab-' + panel.replace('panel-', '')).click();
      await b.scrollIntoViewIfNeeded();
      await b.click();
      const v = await page.evaluate(() => ({ open: document.getElementById('visor').open, n: document.getElementById('visor-img').dataset.nombre, src: document.getElementById('visor-img').getAttribute('src') }));
      if (!(v.open && v.n === nombre && v.src.includes(nombre))) malos.push([nombre, v]);
      total++;
      await page.keyboard.press('Escape');
    }
    comprobar(total >= 28 && malos.length === 0, `cada una de las ${total} miniaturas abre SU foto en el visor`, malos.slice(0, 4));
    await page.locator('#tab-casa').click();
    await page.locator('#panel-casa [data-visor="casa-salon"]').click();
    await page.keyboard.press('ArrowRight');
    const sig = await page.evaluate(() => document.getElementById('visor-img').dataset.nombre);
    comprobar(sig === 'casa-dormitorio-1', 'con la flecha pasa a la siguiente de la serie de la pestaña (casa-salon → casa-dormitorio-1)', sig);
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
    comprobar(await page.evaluate(() => document.getElementById('visor-img').dataset.nombre === 'casa-bano'), 'y da la vuelta al principio (casa-salon ← casa-bano)');
    await page.keyboard.press('Escape');
    comprobar(await page.evaluate(() => !document.getElementById('visor').open && document.activeElement?.dataset.visor === 'casa-salon'), 'Escape cierra el visor y el foco vuelve a la miniatura');
    // la API para los módulos: lista y nombre
    await page.evaluate(() => window.Cortina.visor.abrir(['casa-fachada', 'solaina', 'piscina'], 'solaina'));
    const api = await page.evaluate(() => ({ open: document.getElementById('visor').open, n: document.getElementById('visor-img').dataset.nombre, cuenta: document.getElementById('visor-n').textContent, pie: document.getElementById('visor-pie').textContent }));
    comprobar(api.open && api.n === 'solaina' && api.cuenta === '2 / 3' && api.pie.length > 5, 'Cortina.visor.abrir(lista, nombre) abre por NOMBRE, con su puesto en la serie y su pie', api);
    await page.keyboard.press('Escape');
    // teclado: flechas entre pestañas
    await page.locator('#tab-casa').focus();
    await page.keyboard.press('ArrowRight');
    comprobar(await page.evaluate(() => document.activeElement.id === 'tab-apto1' && document.getElementById('panel-apto1').hidden === false), 'pestañas con el teclado: la flecha derecha pasa a la siguiente y la muestra');
    await page.keyboard.press('End');
    comprobar(await page.evaluate(() => document.activeElement.id === 'tab-apto2'), 'End va a la última pestaña');
    await ctx.close();
  }
  }

  /* ---------- 5. cookies en cuatro pasos y mando con ?revision ---------- */
  if (toca(6)) {
  console.log('\n5. Cookies y mando');
  {
    const { ctx, page } = await nueva();
    await page.goto(PAG);
    await fuera(page);
    await page.waitForSelector('#cookies:not([hidden])', { timeout: 4000 }).catch(() => {});
    comprobar(await page.isVisible('#cookies'), 'cookies: se ven en la primera visita');
    await page.click('#ck-si');
    comprobar(!(await page.isVisible('#cookies')) && (await page.evaluate((k) => localStorage.getItem(k), LLAVE)) === 'si', 'cookies: «Entendido» las cierra y guarda la marca');
    await page.reload(); await fuera(page);
    comprobar(!(await page.isVisible('#cookies')), 'cookies: al recargar no vuelven');
    await page.evaluate((k) => localStorage.removeItem(k), LLAVE);
    await page.reload(); await fuera(page);
    await page.waitForSelector('#cookies:not([hidden])', { timeout: 4000 }).catch(() => {});
    comprobar(await page.isVisible('#cookies'), 'cookies: sin la marca vuelven a salir');
    await page.click('#ck-no');
    const ck = fs.readFileSync(path.join(RAIZ, 'cookies.html'), 'utf8');
    comprobar(/Google Fonts/.test(ck) && /Google Maps/.test(ck) && /Instituto Geográfico Nacional/.test(ck) && /no se conecta a ningún servicio de fuera ni instala cookies/.test(ck) && /acortina-cookies/.test(ck), 'la página de cookies cita Google Fonts, el mapa de Google y el 3D (datos del IGN, sin cookies) y la marca que se guarda');
    await ctx.close();
  }
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { script: sinCookies });
    await page.goto(BASE + 'index.html?sin-3d&revision&densidad=sobria'); await fuera(page);
    await page.waitForTimeout(500);
    await ir(page, await arriba(page, '#fuera', 100)); await page.waitForTimeout(250);
    const s = await page.evaluate(() => ({ mando: !document.getElementById('mando').hidden, sobria: document.documentElement.classList.contains('densidad-sobria'), vistazo: getComputedStyle(document.getElementById('vistazo')).display, movimiento: document.documentElement.classList.contains('con-movimiento'), losa: getComputedStyle(document.querySelector('#fuera .lamina__losa')).transform, p: document.querySelector('#fuera [data-lamina]').style.getPropertyValue('--p'), titular: getComputedStyle(document.querySelector('#fuera h2')).clipPath }));
    comprobar(s.mando && s.sobria && s.vistazo === 'block', 'con ?revision el mando se ve y la sobria añade «A Cortiña, de un vistazo»', s);
    comprobar(!s.p && /matrix\(1, 0, 0, 1, 0, -\d+/.test(s.losa) && s.titular === 'none', 'sobria: la lámina quieta (con su borde de laja a medio camino) y los titulares enteros', s);
    // tabla de un vistazo: unidades, dormitorios y camas, baños, adaptado, plazas, piscina, sala de juegos, mascotas, horarios, distancias
    const filas = await page.$$eval('.vistazo__tabla th', (t) => t.map((x) => x.textContent));
    comprobar(['Unidades', 'Dormitorios y camas', 'Baños', 'Adaptado', 'Plazas', 'Piscina', 'Sala de juegos', 'Mascotas', 'Horarios', 'Distancias'].every((f) => filas.includes(f)), 'la tabla «de un vistazo» lleva las diez filas del encargo', filas);
    await page.click('#mando [data-densidad="aldea"]');
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => ({ sobria: document.documentElement.classList.contains('densidad-sobria'), vistazo: getComputedStyle(document.getElementById('vistazo')).display, url: location.search, movimiento: document.documentElement.classList.contains('con-movimiento') }));
    comprobar(!r.sobria && r.vistazo === 'none' && !r.url.includes('sobria') && r.movimiento, 'el mando vuelve a «Aldea»', r);
    comprobar(page._errores.length === 0, 'cambiar de densidad no da errores (los módulos se vuelven a montar)', page._errores.slice(0, 4));
    await ctx.close();
  }
  }

  /* ---------- 6. móvil: anchos, menú y barra del navegador ---------- */
  if (toca(7)) {
  console.log('\n6. Móvil');
  for (const [w, h] of [[360, 640], [375, 667], [390, 844], [768, 1024]]) {
    const { ctx, page } = await nueva({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true }, { script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    await page.waitForTimeout(300);
    const ancho = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    comprobar(ancho[0] <= ancho[1], `${w}×${h}: sin scroll lateral`, ancho);
    const salen = await page.evaluate(() => [...document.querySelectorAll('main *, footer *')]
      .filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > innerWidth + 1 && !e.closest('[aria-hidden="true"], .vh, [data-modulo="ruta"] canvas, .lamina'); })
      .slice(0, 4).map((e) => e.tagName.toLowerCase() + '.' + [...e.classList].join('.')));
    comprobar(!salen.length, `${w}×${h}: nada se sale por la derecha`, salen);
    const r = await page.evaluate(() => {
      const t = document.querySelector('#portada h1').getBoundingClientRect(), cab = document.getElementById('cab').getBoundingClientRect(), b = [...document.querySelectorAll('#portada .btn')].map((x) => x.getBoundingClientRect());
      return { h1BajoCab: t.top >= cab.bottom - 1, h1Dentro: t.left >= 0 && t.right <= innerWidth + 1, botones: b.every((x) => x.right <= innerWidth + 1 && x.height >= 44) };
    });
    comprobar(Object.values(r).every(Boolean), `${w}×${h}: el titular bajo la cabecera y los botones dentro de la pantalla (≥ 44 px de alto)`, r);
    if (w === 390) {
      await page.evaluate(() => scrollTo(0, 1600));
      await page.waitForFunction(() => document.getElementById('cab').classList.contains('sc'));
      await page.click('#menu-btn');
      const mm = await page.evaluate(() => { const r = document.getElementById('menu-movil').getBoundingClientRect(); return { top: r.top, alto: r.height, vista: innerHeight, vis: getComputedStyle(document.getElementById('menu-movil')).visibility }; });
      comprobar(mm.top === 0 && Math.abs(mm.alto - mm.vista) < 2 && mm.vis === 'visible', 'menú móvil a pantalla completa con la cabecera ya fija (blur)', mm);
      await page.click('#menu-movil a[href="#reservar"]');
      comprobar(await page.waitForFunction(() => !document.body.classList.contains('menu'), null, { timeout: 3000 }).then(() => true, () => false), 'el menú se cierra al elegir');
      // visor con el dedo
      await page.locator('[data-visor="piscina"]').scrollIntoViewIfNeeded();
      await page.locator('[data-visor="piscina"]').tap();
      comprobar(await page.evaluate(() => document.getElementById('visor').open && document.getElementById('visor-img').dataset.nombre === 'piscina'), 'en el móvil, tocar una miniatura abre su foto');
      await page.click('#visor-cerrar');
      // la barra del navegador: 6 cambios de alto → ningún «cortina:resize», las láminas no cambian y nada se mueve
      await page.evaluate(() => document.querySelectorAll('main > section, footer').forEach((s) => { s.style.height = s.offsetHeight + 'px'; }));
      const n = await page.evaluate(() => { window.__res = 0; document.addEventListener('cortina:resize', () => window.__res++); scrollTo(0, 5200); return document.getElementById('llegar').getBoundingClientRect().top + scrollY; });
      await page.waitForTimeout(150);
      for (const alto of [788, 844, 788, 844, 800, 844]) { await page.setViewportSize({ width: 390, height: alto }); await page.waitForTimeout(260); }
      const d = await page.evaluate(() => ({ res: window.__res, top: document.getElementById('llegar').getBoundingClientRect().top + scrollY }));
      comprobar(d.res === 0 && Math.abs(d.top - n) < 1, 'barra del móvil: nada se rehace y la página no se mueve', { ...d, antes: n });
    }
    comprobar(page._errores.length === 0, `${w}×${h}: sin errores`, page._errores.slice(0, 3));
    await ctx.close();
  }
  }

  /* ---------- 7. legales ---------- */
  if (toca(8)) {
  console.log('\n7. Legales');
  {
    const { ctx, page } = await nueva();
    for (const f of ['aviso-legal', 'privacidad', 'cookies', 'accesibilidad', '404']) {
      page._errores.length = 0;
      await page.goto(BASE + f + '.html');
      comprobar((await page.locator('h1').count()) === 1 && page._errores.length === 0, `${f}.html se abre sin errores`, page._errores);
    }
    const av = fs.readFileSync(path.join(RAIZ, 'aviso-legal.html'), 'utf8');
    comprobar(/Alberto Piñeiro Álvarez/.test(av) && /Pepín, 40/.test(av) && !/Registro de turismo<\/dt><dd>TR/.test(av) && /Registro de turismo<\/dt><dd><span class="aviso-corto">por confirmar/.test(av), 'aviso legal: titular, dirección y el registro «por confirmar» (no se afirma ninguno)');
    await ctx.close();
  }
  }

  /* ---------- 8. con movimiento (una vez, al final): cortina, láminas y titulares ---------- */
  if (toca(9)) {
  console.log('\n8. Con movimiento');
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { script: sinCookies });
    await page.goto(PAG);
    const tapa = await page.evaluate(() => { const c = document.getElementById('cortina'); if (!c) return 'sin cortina'; const r = c.getBoundingClientRect(); return getComputedStyle(c).display !== 'none' && r.width >= innerWidth - 1 && r.height >= innerHeight - 1; });
    if (tapa === 'sin cortina') nota('sin cortina todavía (módulo Entrada): la portada se abre sola');
    else comprobar(tapa === true, 'la cortina tapa la pantalla al cargar');
    await fuera(page);
    await page.waitForFunction(() => document.getElementById('portada').classList.contains('abierta'), null, { timeout: 8000 }).catch(() => {});
    comprobar(await page.evaluate(() => document.getElementById('portada').classList.contains('abierta') && document.documentElement.classList.contains('con-movimiento')), 'la cortina se retira y la portada se abre (alAbrirse llega)');
    await page.waitForFunction(() => !document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none', null, { timeout: 9000 }).catch(() => {});
    comprobar(await page.evaluate(() => !document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none'), 'la cortina desaparece de verdad');
    if (HAY.dibujo) comprobar(await page.waitForFunction(() => document.querySelector('#portada [data-modulo="dibujo"]').dataset.montado === '1', null, { timeout: 6000 }).then(() => true, () => false), 'el dibujo de la portada se monta al abrirse la cortina');
    // titulares: se escriben al llegar
    await page.evaluate(() => document.querySelector('#t-fuera').scrollIntoView({ block: 'center' }));
    await page.waitForFunction(() => document.querySelector('#t-fuera').classList.contains('es-visto'), null, { timeout: 4000 }).catch(() => {});
    comprobar(await page.evaluate(() => document.querySelector('#t-fuera').classList.contains('es-visto')), 'los titulares se «escriben» al llegar a pantalla (es-visto)');
    // la lámina se desliza con el scroll: --p y transform con valores intermedios, siempre creciendo
    const lam = [];
    const top = await arriba(page, '#fuera');
    for (let i = 0; i <= 14; i++) {
      await ir(page, Math.round(top - 800 + 40 + i * (800 * 0.62) / 12)); await page.waitForTimeout(110);
      lam.push(await page.evaluate(() => { const l = document.querySelector('#fuera [data-lamina]'); const m = /matrix\(1, 0, 0, 1, 0, (-?[\d.]+)\)/.exec(getComputedStyle(l.querySelector('.lamina__losa')).transform); return { p: +l.style.getPropertyValue('--p') || 0, ty: m ? +m[1] : 0, alto: l.offsetHeight }; }));
    }
    const ps = lam.map((x) => x.p), tys = lam.map((x) => x.ty);
    comprobar(ps.every((p, i) => i === 0 || p >= ps[i - 1] - 1e-9) && ps[0] < 0.1 && ps[ps.length - 1] > 0.9 && ps.filter((p) => p > 0.1 && p < 0.9).length >= 5 && tys.some((t) => t < -20 && t > -lam[0].alto + 20), 'la lámina de «Fuera» se desliza con el scroll: --p de 0 a 1 con valores intermedios y la losa se mueve de verdad (transform)', { ps, tys });
    // después de usarla, las laminas que ya no se ven no se pintan: --p solo en las visibles
    comprobar(page._errores.length === 0, 'con movimiento: sin errores', page._errores.slice(0, 5));
    await ctx.close();
  }
  {
    // Lenis y GSAP caídos y con movimiento: la cortina se va igual
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { cdn: 'caido', script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    await page.waitForFunction(() => !document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none', null, { timeout: 9000 }).catch(() => {});
    comprobar(await page.evaluate(() => (!document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none') && document.getElementById('portada').classList.contains('abierta')), 'sin Lenis ni GSAP la cortina se retira y la portada se abre');
    comprobar(page._errores.length === 0, 'sin las librerías no hay errores', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    // sin JavaScript: la cortina no tapa y se lee todo
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, javaScriptEnabled: false });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const page = await ctx.newPage();
    await page.goto(PAG);
    comprobar(await page.evaluate(() => { const c = document.getElementById('cortina'); return (!c || getComputedStyle(c).display === 'none') && getComputedStyle(document.querySelector('#t-fuera')).clipPath === 'none' && getComputedStyle(document.getElementById('cab')).opacity !== '0'; }), 'sin JavaScript no hay cortina, la cabecera se ve y los titulares se leen');
    await ctx.close();
  }
  }
} finally {
  await browser.close();
  servidor.close();
}

console.log(`\n${nOk} ok, ${fallos.length} fallos`);
if (fallos.length) { console.log(fallos.map((f) => ' - ' + f).join('\n')); process.exitCode = 1; }
