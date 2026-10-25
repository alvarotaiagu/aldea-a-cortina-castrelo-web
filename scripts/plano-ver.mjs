/* Rasteriza el plano.svg (solo el dibujo, estático) para revisarlo a ojo.
   Uso: node scripts/plano-ver.mjs [salida.png] [ancho] [x,y,w,h del viewBox] [color]
   Una sola página, un navegador que se cierra siempre, escala 1, sin movimiento, sin red.
   Si ya hay otra prueba de Playwright en marcha, espera (regla del CLAUDE.md de WEBS NEGOCIOS). */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { chromium } from 'file:///C:/Users/alvar/Desktop/WEBS%20NEGOCIOS/alvarotaiagu.github.io/node_modules/playwright/index.mjs';

const salida = process.argv[2] || 'plano-vista.png';
const ancho = +process.argv[3] || 1450;
const vb = process.argv[4] && process.argv[4] !== '-' ? process.argv[4] : null;
const color = process.argv[5] === 'color';
const medio = process.argv[5] === 'medio';   // trazado a medias: comprueba que todos los trazos crecen a la vez
const aqui = new URL('..', import.meta.url);
const svg = fs.readFileSync(new URL('img/plano/plano.svg', aqui), 'utf8');
const css = fs.readFileSync(new URL('css/plano.css', aqui), 'utf8');

const hayOtra = () => { try { return execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"Name=\'chrome-headless-shell.exe\'\\" | Measure-Object).Count"').toString().trim() !== '0'; } catch { return false; } };
for (let i = 0; i < 40 && hayOtra(); i++) { console.log('hay otra prueba de Playwright en marcha; espero…'); await new Promise((r) => setTimeout(r, 6000)); }

const body = vb ? svg.replace(/viewBox="[^"]+"/, `viewBox="${vb}"`) : svg;
const html = `<!doctype html><meta charset="utf-8"><style>${css}
html,body{margin:0;background:#F4EFE6}
[data-modulo="plano"]{width:${ancho}px}</style>
<div data-modulo="plano">${color ? body.replace('class="plano-svg"', 'class="plano-svg pl-color"') : body}</div>`;
const nav = await chromium.launch();
try {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  if (medio) await p.evaluate(() => document.querySelectorAll('.t').forEach((e) => { const L = e.hasAttribute('pathLength') ? 1 : +e.dataset.l; e.style.strokeDasharray = L + ' ' + L; e.style.strokeDashoffset = L * 0.5; }));
  const el = await p.$('[data-modulo="plano"]');
  await el.screenshot({ path: salida });
  console.log('ok', salida);
} finally { await nav.close(); }
