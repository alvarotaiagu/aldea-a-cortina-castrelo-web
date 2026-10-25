/* Rasteriza los dibujos del módulo Comarca a PNG para REVISARLOS (sin navegador).
   Uso:  node scripts/comarca-revisar.mjs <carpeta-salida> [mascaras|ilustraciones|barra]...
   - mascaras: cigarrón y peliqueiro en varios ángulos y colores (hoja de contacto)
   - ilustraciones: las cuatro de las épocas (img/comarca/*.svg)
   - barra: la hamburguesa XXL por capas (img/barra/xxl.svg)
   Sale con una hoja por tema (PNG) que se lee con el visor de imágenes. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..');
const requerir = createRequire(path.resolve(raiz, '..', 'alvarotaiagu.github.io', 'package.json'));
const sharp = requerir('sharp');
const motor = createRequire(import.meta.url)(path.join(raiz, 'js', 'comarca.js'));

const salida = process.argv[2];
if (!salida) { console.error('Falta la carpeta de salida'); process.exit(1); }
fs.mkdirSync(salida, { recursive: true });
const temas = process.argv.slice(3).length ? process.argv.slice(3) : ['mascaras'];

const hoja = async (nombre, celdas, cols, ancho, alto, fondo = '#F4EFE6') => {
  const filas = Math.ceil(celdas.length / cols);
  const comp = [];
  for (let i = 0; i < celdas.length; i++) {
    const png = await sharp(Buffer.from(celdas[i]), { density: 96 }).resize(ancho, alto, { fit: 'contain', background: fondo }).flatten({ background: fondo }).png().toBuffer();
    comp.push({ input: png, left: (i % cols) * ancho, top: Math.floor(i / cols) * alto });
  }
  await sharp({ create: { width: cols * ancho, height: filas * alto, channels: 3, background: fondo } }).composite(comp).png().toFile(path.join(salida, nombre));
  console.log('→', path.join(salida, nombre));
};

if (temas.includes('mascaras')) {
  const angulos = (process.env.ANGULOS || '88,60,35,0').split(',').map(Number);
  const color = process.env.COLOR != null ? +process.env.COLOR : 1;
  for (const tipo of ['cigarron', 'peliqueiro']) {
    const signo = tipo === 'cigarron' ? 1 : -1;
    const celdas = angulos.map((a) => motor.mascaraSVG(tipo, signo * a * Math.PI / 180, color));
    await hoja(`mascara-${tipo}.png`, celdas, angulos.length, 380, 545);
  }
}
if (temas.includes('ilustraciones')) {
  const dir = path.join(raiz, 'img', 'comarca');
  const nombres = ['valle', 'piscina', 'racimo', 'castillo'].filter((n) => fs.existsSync(path.join(dir, n + '.svg')));
  const celdas = nombres.map((n) => fs.readFileSync(path.join(dir, n + '.svg'), 'utf8'));
  if (celdas.length) await hoja('ilustraciones.png', celdas, 2, 640, 480);
}
if (temas.includes('barra')) {
  const f = path.join(raiz, 'img', 'barra', 'xxl.svg');
  if (fs.existsSync(f)) {
    const s = fs.readFileSync(f, 'utf8');
    await sharp(Buffer.from(s), { density: 144 }).flatten({ background: '#A3302C' }).png().toFile(path.join(salida, 'xxl.png'));
    console.log('→', path.join(salida, 'xxl.png'));
  }
}
