/* Genera los dibujos a plumilla del módulo Comarca (sin dependencias):
     img/comarca/valle.svg    primavera: el valle y el río
     img/comarca/piscina.svg  verano: la piscina ovalada
     img/comarca/racimo.svg   otoño: la vendimia
     img/comarca/castillo.svg otoño: el castillo de Monterrei
     img/barra/xxl.svg        la hamburguesa por capas («Burguer Rural XXL», ilustración genérica)
   Uso:  node scripts/comarca-dibujos.mjs
   El dibujo va con la tinta del logo (#1F1A17), trazo fino con un temblor fijo (semilla) y
   rayado de plumilla recortado a cada forma. Cada <g data-g="n"> es un paso del trazado
   (de menos a más detalle); lo que va con class="rel" es un relleno plano que entra al final.
   Es ILUSTRACIÓN: no es un plano ni una vista exacta de ningún sitio. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TINTA = '#1F1A17';

/* ---------- caja de herramientas ---------- */
const semilla = (s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const n1 = (v) => (Math.round(v * 10) / 10).toString();
const pts2d = (pts, cierra) => pts.length ? 'M' + pts.map((p) => n1(p[0]) + ' ' + n1(p[1])).join('L') + (cierra ? 'Z' : '') : '';
// curva suave por los puntos
const suave = (pts, cierra) => {
  const n = pts.length;
  if (n < 3) return pts2d(pts, cierra);
  const P = (i) => (cierra ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = 'M' + n1(pts[0][0]) + ' ' + n1(pts[0][1]);
  const tope = cierra ? n : n - 1;
  for (let i = 0; i < tope; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    d += 'C' + n1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + n1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + n1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + n1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + n1(p2[0]) + ' ' + n1(p2[1]);
  }
  return d + (cierra ? 'Z' : '');
};

function Pluma(seed) {
  const az = semilla(seed);
  const o = {};
  o.az = az;
  // trocea los tramos largos y los mueve un poco: pulso de mano
  o.tiembla = (pts, amp = 1.1, paso = 16) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push([a[0] + (az() - 0.5) * amp, a[1] + (az() - 0.5) * amp]);
      if (b) {
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.floor(L / paso);
        for (let j = 1; j <= k; j++) { const t = j / (k + 1); out.push([a[0] + (b[0] - a[0]) * t + (az() - 0.5) * amp, a[1] + (b[1] - a[1]) * t + (az() - 0.5) * amp]); }
      }
    }
    return out;
  };
  o.linea = (pts, amp, cierra) => suave(o.tiembla(cierra ? pts.concat([pts[0]]) : pts, amp), false);
  o.poli = (pts, amp) => suave(o.tiembla(pts.concat([pts[0]]), amp == null ? 1.1 : amp), false);
  o.elipse = (cx, cy, rx, ry, n = 28, rot = 0, a0 = 0, a1 = Math.PI * 2) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n, x = rx * Math.cos(a), y = ry * Math.sin(a);
      pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return pts;
  };
  // rayado recortado al polígono (cualquier orientación), con huecos y finales desiguales
  o.rayado = (poly, ang, sep, opc = {}) => {
    const { corte = 0.0, hueco = 0.1, jit = 1.6 } = opc;
    const c = Math.cos(-ang), s = Math.sin(-ang);
    const R = poly.map((p) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c]);
    let y0 = Infinity, y1 = -Infinity;
    R.forEach((p) => { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    const ci = Math.cos(ang), si = Math.sin(ang);
    let d = '';
    for (let y = y0 + sep / 2 + (az() - 0.5) * sep * 0.4; y < y1; y += sep * (0.85 + az() * 0.3)) {
      const xs = [];
      for (let i = 0; i < R.length; i++) {
        const a = R[i], b = R[(i + 1) % R.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        let xa = xs[k] + 1.2 + az() * jit, xb = xs[k + 1] - 1.2 - az() * jit;
        if (xb - xa < 3 || az() < hueco) continue;
        const ya = y + (az() - 0.5) * 0.8, yb = y + (az() - 0.5) * 0.8;
        d += 'M' + n1(xa * ci - ya * si) + ' ' + n1(xa * si + ya * ci) + 'L' + n1(xb * ci - yb * si) + ' ' + n1(xb * si + yb * ci);
      }
    }
    return d;
  };
  return o;
}

// formas de los elementos
const trazo = (d, w = 1.5, extra = '', col = TINTA) => d ? `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>` : '';
const relleno = (d, color, extra = '') => `<path class="rel" d="${d}" fill="${color}" stroke="none"${extra}/>`;
const grupo = (n, contenido, clase = '') => `<g data-g="${n}"${clase ? ` class="${clase}"` : ''}>${contenido}</g>`;
const svg = (w, h, titulo, contenido) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${titulo}" focusable="false"><title>${titulo}</title>${contenido}</svg>\n`;

/* ================================================================
   VALLE (primavera)
   ================================================================ */
const remuestrea = (eje, n) => {
  // Catmull-Rom muestreado: un eje suave con n puntos
  const P = (i) => eje[Math.max(0, Math.min(eje.length - 1, i))];
  const out = [];
  const tramos = eje.length - 1;
  for (let k = 0; k < n; k++) {
    const u = k / (n - 1) * tramos, i = Math.min(tramos - 1, Math.floor(u)), t = u - i;
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c = (a, b, c2, d) => 0.5 * ((2 * b) + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t * t + (-a + 3 * b - 3 * c2 + d) * t * t * t);
    out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
};

function valle() {
  const L = Pluma(11);
  const W = 640, H = 480;
  const crestaLejana = []; for (let x = 0; x <= W; x += 20) crestaLejana.push([x, 175 + 26 * Math.sin(x / 95 + 0.4) + 11 * Math.sin(x / 38 + 1)]);
  const crestaMedia = []; for (let x = 0; x <= W; x += 20) crestaMedia.push([x, 232 + 30 * Math.sin(x / 120 + 2.3) + 9 * Math.sin(x / 45)]);
  const lejos = crestaLejana.concat([[W, 270], [0, 270]]);
  const medio = crestaMedia.concat([[W, 330], [0, 330]]);
  const g1 = trazo(L.linea(crestaLejana, 1.4), 1.7) + trazo(L.rayado(lejos, -1.2, 7.5, { hueco: 0.22 }), 0.7);
  const g2 = relleno(pts2d(medio, true), '#B8C2A0', ' opacity=".55"') + trazo(L.linea(crestaMedia, 1.4), 1.9) + trazo(L.rayado(medio, -1.15, 6.2, { hueco: 0.16 }), 0.7);

  // el río: un eje con meandros que se ensancha hacia quien mira
  const eje = remuestrea([[318, 262], [306, 286], [334, 312], [382, 334], [352, 366], [296, 392], [324, 424], [398, 450], [372, 488]], 46);
  const a = [], b = [];
  for (let i = 0; i < eje.length; i++) {
    const p = eje[Math.max(0, i - 1)], q = eje[Math.min(eje.length - 1, i + 1)];
    let tx = q[0] - p[0], ty = q[1] - p[1]; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
    const w = 3.5 + (i / eje.length) * 21;
    a.push([eje[i][0] - ty * w, eje[i][1] + tx * w]); b.push([eje[i][0] + ty * w, eje[i][1] - tx * w]);
  }
  const agua = a.concat(b.slice().reverse());
  let ondas = '';
  for (let i = 4; i < eje.length - 3; i += 5) {
    const [x, y] = eje[i], w = 3 + (i / eje.length) * 12;
    ondas += 'M' + n1(x - w) + ' ' + n1(y) + 'q' + n1(w / 2) + ' -3 ' + n1(w) + ' 0t' + n1(w) + ' 0';
  }
  const g3 = relleno(pts2d(agua, true), '#9FBFC4', ' opacity=".9"') + trazo(L.linea(a, 1.1), 1.6) + trazo(L.linea(b, 1.1), 1.6) + trazo(ondas, 0.9) + trazo(L.rayado(agua, 0.05, 9, { hueco: 0.45 }), 0.6);

  // árboles, de lejos a cerca
  const ar = [];
  [[70, 292, 1.1], [120, 306, 0.9], [172, 288, 0.8], [226, 300, 1.0], [262, 280, 0.7], [520, 286, 1.0], [572, 300, 1.15], [612, 284, 0.8], [468, 298, 0.8], [190, 372, 1.2], [112, 402, 1.3], [250, 420, 1.05], [470, 392, 1.15], [540, 430, 1.3], [586, 380, 0.95], [60, 352, 1.0]].forEach(([x, y, s]) => {
    const copa = L.elipse(x, y - 26 * s, 17 * s, 20 * s, 14).map((p) => [p[0] + (L.az() - 0.5) * 5 * s, p[1] + (L.az() - 0.5) * 5 * s]);
    ar.push({ x, y, s, copa, sombra: L.elipse(x + 5 * s, y - 20 * s, 12 * s, 15 * s, 12) });
  });
  ar.sort((p, q) => p.y - q.y);
  let g4 = '';
  ar.forEach((t) => {
    g4 += trazo(pts2d([[t.x, t.y], [t.x + (L.az() - 0.5) * 2, t.y - 12 * t.s]]), 1.8) + relleno(pts2d(t.copa, true), '#93A672') + trazo(L.poli(t.copa, 1.3), 1.4) + trazo(L.rayado(t.sombra, -0.9, 4.4 * (0.6 + t.s * 0.5)), 0.7);
  });
  // sendero con su poste y las flores del prado
  const sendero = [[26, 470], [70, 446], [116, 436], [160, 422], [205, 406], [236, 388]];
  let g5 = trazo(suave(sendero, false), 1.4, ' stroke-dasharray="7 6"');
  g5 += trazo(pts2d([[52, 458], [52, 424]]), 2) + relleno(pts2d([[52, 424], [88, 424], [98, 431], [88, 438], [52, 438]], true), '#E8DCC0') + trazo(pts2d([[52, 424], [88, 424], [98, 431], [88, 438], [52, 438]], true), 1.5);
  let flores = '';
  for (let i = 0; i < 46; i++) {
    const x = 20 + L.az() * 250, y = 410 + L.az() * 66;
    if (Math.abs(y - (466 - (x - 26) * 0.2)) < 14) continue;
    flores += 'M' + n1(x) + ' ' + n1(y) + 'v-' + n1(5 + L.az() * 4) + 'M' + n1(x - 2.2) + ' ' + n1(y - 8) + 'a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0';
  }
  g5 += trazo(flores, 0.9);
  let sol = trazo(suave(L.elipse(540, 74, 26, 26, 16), true), 1.5);
  for (let i = 0; i < 14; i++) { const an = i / 14 * Math.PI * 2; sol += trazo('M' + n1(540 + Math.cos(an) * 34) + ' ' + n1(74 + Math.sin(an) * 34) + 'L' + n1(540 + Math.cos(an) * (46 + (i % 2) * 9)) + ' ' + n1(74 + Math.sin(an) * (46 + (i % 2) * 9)), 1.2); }
  return svg(W, H, 'Dibujo a plumilla de un valle con un río que serpentea, un sendero con un poste y prados con flores', grupo(1, g1) + grupo(2, g2) + grupo(3, g3) + grupo(4, g4) + grupo(5, g5) + grupo(6, sol));
}

/* ================================================================
   PISCINA (verano)
   ================================================================ */
function piscina() {
  const L = Pluma(23);
  const W = 640, H = 480;
  const bosque = [];
  for (let x = -10; x <= W + 10; x += 22) bosque.push([x, 132 + 22 * Math.sin(x / 70) + 12 * L.az()]);
  const bosquePoli = bosque.concat([[W + 10, 215], [-10, 215]]);
  let g1 = relleno(pts2d([[-10, 120], [W + 10, 120], [W + 10, H + 10], [-10, H + 10]], true), '#BFCB9E', ' opacity=".35"');
  g1 += relleno(pts2d(bosquePoli, true), '#8FA373', ' opacity=".55"') + trazo(L.linea(bosque, 1.8), 1.6);
  for (let i = 0; i < bosque.length - 1; i++) { const [x, y] = bosque[i]; g1 += trazo(suave(L.elipse(x + 11, y + 6, 14, 16, 10), true), 1); }
  g1 += trazo(L.rayado(bosquePoli, -1.1, 6.4, { hueco: 0.22 }), 0.65);
  const cx = 350, cy = 318, rx = 235, ry = 84;
  const borde = L.elipse(cx, cy, rx + 22, ry + 14, 40), canto = L.elipse(cx, cy, rx, ry, 40);
  const lamina = L.elipse(cx, cy + 3, rx - 4, ry - 3, 40);
  let g2 = relleno(pts2d(lamina, true), '#9FC6C8') + trazo(L.poli(borde.slice(0, -1), 1.4), 1.8) + trazo(L.poli(canto.slice(0, -1), 1.2), 1.6);
  const pared = L.elipse(cx, cy, rx, ry, 30, 0, 0.12, Math.PI - 0.12).concat(L.elipse(cx, cy + 14, rx - 4, ry - 2, 30, 0, Math.PI - 0.12, 0.12));
  g2 += trazo(L.rayado(pared, 1.5, 4.8, { hueco: 0.1 }), 0.8);
  let ondas = '';
  for (let i = 0; i < 9; i++) {
    const y = cy - 40 + i * 11, k = Math.sqrt(Math.max(0, 1 - Math.pow((y - cy) / (ry - 8), 2)));
    if (k < 0.2) continue;
    const half = (rx - 28) * k, x0 = cx - half * (0.2 + L.az() * 0.5), l = 40 + L.az() * 60;
    for (let j = 0; j < 2; j++) {
      const xa = x0 + j * (l + 24 + L.az() * 40);
      if (xa + l > cx + half) continue;
      ondas += 'M' + n1(xa) + ' ' + n1(y) + 'q' + n1(l / 6) + ' -4 ' + n1(l / 3) + ' 0t' + n1(l / 3) + ' 0t' + n1(l / 3) + ' 0';
    }
  }
  g2 += trazo(ondas, 1) + trazo(pts2d([[cx + 150, cy - 70], [cx + 150, cy - 50]]), 2) + trazo(pts2d([[cx + 166, cy - 66], [cx + 166, cy - 44]]), 2) + trazo('M' + n1(cx + 150) + ' ' + n1(cy - 58) + 'h16M' + n1(cx + 150) + ' ' + n1(cy - 50) + 'h16', 1.4);
  const tumbona = (x, y, s) => {
    const base = [[x, y], [x + 120 * s, y - 26 * s], [x + 136 * s, y - 14 * s], [x + 16 * s, y + 14 * s]];
    const resp = [[x, y], [x - 36 * s, y - 34 * s], [x - 22 * s, y - 44 * s], [x + 18 * s, y - 8 * s]];
    return relleno(pts2d(base, true), '#E8DCC0') + trazo(L.poli(base, 0.9), 1.6) + trazo(L.poli(resp, 0.9), 1.6) + trazo(L.rayado(base, 0.5, 5 * s, { hueco: 0.15 }), 0.8) + trazo(pts2d([[x + 22 * s, y + 14 * s], [x + 22 * s, y + 34 * s]]), 1.6) + trazo(pts2d([[x + 128 * s, y - 12 * s], [x + 128 * s, y + 8 * s]]), 1.6);
  };
  const g3 = tumbona(70, 426, 1) + tumbona(250, 440, 1.05);
  let hierba = '';
  for (let i = 0; i < 70; i++) {
    const x = 10 + L.az() * 620, y = 230 + L.az() * 240;
    const e = Math.pow((x - cx) / (rx + 30), 2) + Math.pow((y - cy) / (ry + 20), 2);
    if (e < 1.05) continue;
    const h = 5 + L.az() * 7;
    hierba += 'M' + n1(x) + ' ' + n1(y) + 'l-2 ' + n1(-h) + 'M' + n1(x) + ' ' + n1(y) + 'l1 ' + n1(-h - 2) + 'M' + n1(x) + ' ' + n1(y) + 'l3.4 ' + n1(-h);
  }
  let g4 = trazo(hierba, 1);
  let sol = trazo(suave(L.elipse(88, 70, 25, 25, 16), true), 1.5);
  for (let i = 0; i < 14; i++) { const an = i / 14 * Math.PI * 2; sol += trazo('M' + n1(88 + Math.cos(an) * 33) + ' ' + n1(70 + Math.sin(an) * 33) + 'L' + n1(88 + Math.cos(an) * (45 + (i % 2) * 9)) + ' ' + n1(70 + Math.sin(an) * (45 + (i % 2) * 9)), 1.2); }
  return svg(W, H, 'Dibujo a plumilla de una piscina ovalada con dos tumbonas, el prado y el bosque al fondo', grupo(1, g1) + grupo(2, g2) + grupo(3, g3) + grupo(4, g4) + grupo(5, sol));
}

/* ================================================================
   RACIMO (otoño)
   ================================================================ */
function racimo() {
  const L = Pluma(37);
  const W = 640, H = 480;
  const hoja = (cx, cy, R, rot) => {
    const pts = [], n = 80;
    for (let i = 0; i <= n; i++) {
      const an = -Math.PI * 0.5 + Math.PI * 2 * i / n;
      const lobo = 0.62 + 0.38 * Math.pow(Math.abs(Math.cos(2.5 * (an + Math.PI * 0.5))), 0.55);
      const r = R * lobo * (0.92 + 0.08 * Math.sin(an * 11));
      const x = r * Math.cos(an), y = r * Math.sin(an) * 0.95;
      pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return pts;
  };
  const tallo = trazo(suave([[318, 14], [322, 60], [312, 100], [318, 160]], false), 3) + trazo(suave([[168, 128], [220, 70], [270, 44], [318, 40]], false), 2) + trazo(suave([[472, 118], [420, 62], [370, 44], [320, 40]], false), 2);
  const esp = [];
  for (let i = 0; i <= 40; i++) { const an = i / 40 * Math.PI * 4.2, r = 3 + i * 0.52; esp.push([548 + r * Math.cos(an) * 0.9, 232 + r * Math.sin(an) * 0.9]); }
  const zar = trazo(suave([[440, 160], [488, 190], [530, 230], [548, 236]], false), 1.5) + trazo(suave(esp, false), 1.4);
  let gh = '';
  [[168, 128, 86, -0.5], [472, 118, 80, 0.55]].forEach(([x, y, R, rot]) => {
    const p = hoja(x, y, R, rot);
    gh += relleno(pts2d(p, true), '#9CB172') + trazo(L.poli(p.slice(0, -1), 1.2), 1.8);
    const c = Math.cos(rot), s = Math.sin(rot);
    let nerv = '';
    for (let k = -2; k <= 2; k++) {
      const an = k * 0.62, ex = x + R * 0.86 * Math.sin(an) * c + R * 0.86 * Math.cos(an) * s, ey = y + R * 0.86 * Math.sin(an) * s - R * 0.86 * Math.cos(an) * c;
      nerv += 'M' + n1(x) + ' ' + n1(y) + 'L' + n1(ex) + ' ' + n1(ey);
    }
    gh += trazo(nerv, 1) + trazo(L.rayado(p, rot + 1.3, 6.4, { hueco: 0.4 }), 0.6);
  });
  const uvas = [];
  [6, 6, 5, 5, 4, 3, 2, 1].forEach((n, f) => {
    const y = 176 + f * 38, ancho = 46;
    for (let i = 0; i < n; i++) uvas.push({ x: 320 + (i - (n - 1) / 2) * ancho + (L.az() - 0.5) * 6, y: y + (L.az() - 0.5) * 6, r: 23 + L.az() * 2.5, f });
  });
  uvas.sort((p, q) => q.f - p.f);
  let gu = '';
  uvas.forEach((u) => {
    const c = L.elipse(u.x, u.y, u.r, u.r * 1.02, 18);
    gu += relleno(pts2d(c, true), '#5C2B4E') + trazo(L.poli(c.slice(0, -1), 0.9), 1.6);
    gu += trazo(L.rayado(L.elipse(u.x + u.r * 0.3, u.y + u.r * 0.3, u.r * 0.75, u.r * 0.75, 14), 0.9, 3.8, { hueco: 0.12 }), 0.75, ' opacity=".85"', '#F4EFE6');
    gu += trazo(suave(L.elipse(u.x - u.r * 0.35, u.y - u.r * 0.35, u.r * 0.42, u.r * 0.42, 8, 0, Math.PI * 1.05, Math.PI * 1.75), false), 1.8, ' opacity=".9"', '#F4EFE6');
  });
  return svg(W, H, 'Dibujo a plumilla de un racimo de uvas con dos hojas de vid y un zarcillo', grupo(1, tallo + zar) + grupo(2, gh) + grupo(3, gu));
}

/* ================================================================
   CASTILLO DE MONTERREI (otoño)
   Composición libre a partir de la silueta que se reconoce en las fotos libres
   (torre del homenaje alta con remate volado, palacio con galería de columnas,
   iglesia con tejado a la derecha, muralla almenada delante). No es una vista exacta.
   ================================================================ */
function castillo() {
  const L = Pluma(41);
  const W = 640, H = 480;
  const ladera = [[-10, 420], [60, 404], [140, 392], [230, 384], [330, 380], [430, 384], [520, 396], [600, 410], [650, 430], [650, 490], [-10, 490]];
  const g1 = relleno(pts2d(ladera, true), '#C9C19A', ' opacity=".45"') + trazo(L.linea(ladera.slice(0, 9), 1.6), 1.8) + trazo(L.rayado(ladera, -1.25, 6.4, { hueco: 0.2 }), 0.65);
  const murY = 372, base = 408;
  const hiladas = (x0, x1, y0, y1, sep, ancho) => {
    let j = '';
    for (let y = y0; y < y1; y += sep) { j += 'M' + x0 + ' ' + n1(y + (L.az() - 0.5) * 1.6) + 'H' + x1; for (let x = x0 + 6 + L.az() * ancho * 0.5; x < x1; x += ancho * (0.8 + L.az() * 0.6)) j += 'M' + n1(x) + ' ' + n1(y) + 'v-' + (sep - 1); }
    return j;
  };
  let alm = '';
  for (let x = 74; x < 566; x += 22) alm += 'M' + x + ' ' + murY + 'v-11h13v11';
  const g2 = relleno(pts2d([[70, base - 2], [70, murY], [570, murY], [570, base - 6]], true), '#EFE7D6') + trazo(pts2d([[70, base - 2], [70, murY], [570, murY], [570, base - 6]]), 1.8) + trazo(alm, 1.5) + trazo(hiladas(72, 568, murY + 8, base - 2, 9, 22), 0.7);
  // palacio con galería
  const px0 = 168, px1 = 352, py0 = 250, py1 = murY;
  const tejado = [[px0 - 8, py0], [px0 + 18, py0 - 22], [px1 + 8, py0 - 22], [px1 + 18, py0]];
  let col = '';
  for (let i = 0; i <= 11; i++) { const x = px0 + 14 + i * ((px1 - px0 - 28) / 11); col += 'M' + n1(x) + ' ' + (py0 + 10) + 'V' + (py0 + 66); }
  col += 'M' + (px0 + 10) + ' ' + (py0 + 66) + 'H' + (px1 - 10) + 'M' + (px0 + 10) + ' ' + (py0 + 10) + 'H' + (px1 - 10);
  let bal = '';
  for (let i = 0; i < 40; i++) { const x = px0 + 14 + i * ((px1 - px0 - 28) / 39); bal += 'M' + n1(x) + ' ' + (py0 + 54) + 'v12'; }
  const fondoGaleria = [[px0 + 12, py0 + 10], [px1 - 12, py0 + 10], [px1 - 12, py0 + 66], [px0 + 12, py0 + 66]];
  let g4 = relleno(pts2d([[px0, py1], [px0, py0], [px1, py0], [px1, py1]], true), '#EFE7D6') + trazo(pts2d([[px0, py1], [px0, py0], [px1, py0], [px1, py1]]), 1.8);
  g4 += trazo(L.rayado(fondoGaleria, 1.35, 5.2, { hueco: 0.05 }), 0.85) + trazo(col, 1.4) + trazo(bal, 0.8);
  g4 += trazo(hiladas(px0, px1, py0 + 80, py1 - 2, 10, 20), 0.7);
  [[205, 318], [262, 322], [312, 318]].forEach(([x, y]) => { g4 += trazo(L.poli([[x, y + 18], [x, y], [x + 11, y - 5], [x + 22, y], [x + 22, y + 18]], 0.5), 1.3); });
  g4 += relleno(pts2d(tejado, true), '#B4523A') + trazo(L.poli(tejado, 1), 1.6) + trazo(L.rayado(tejado, 0.1, 5, { hueco: 0.1 }), 0.8);
  // torre del homenaje
  const tx0 = 96, tx1 = 164, ty0 = 112, ty1 = murY;
  let alm2 = '';
  for (let x = tx0 - 8; x < tx1 + 8; x += 14) alm2 += 'M' + n1(x) + ' ' + (ty0 + 12) + 'v-12h8v12';
  let mat = '';
  for (let x = tx0 - 6; x <= tx1 + 6; x += 8) mat += 'M' + n1(x) + ' ' + (ty0 + 26) + 'l3 -8l3 8';
  let g3 = relleno(pts2d([[tx0, ty1], [tx0, ty0 + 26], [tx1, ty0 + 26], [tx1, ty1]], true), '#EFE7D6') + trazo(pts2d([[tx0, ty1], [tx0, ty0 + 26], [tx1, ty0 + 26], [tx1, ty1]]), 1.8);
  g3 += relleno(pts2d([[tx0 - 10, ty0 + 26], [tx0 - 10, ty0 + 12], [tx1 + 10, ty0 + 12], [tx1 + 10, ty0 + 26]], true), '#EFE7D6') + trazo(pts2d([[tx0 - 10, ty0 + 26], [tx0 - 10, ty0 + 12], [tx1 + 10, ty0 + 12], [tx1 + 10, ty0 + 26]], true), 1.7) + trazo(alm2, 1.4) + trazo(mat, 0.9);
  g3 += trazo(hiladas(tx0, tx1, ty0 + 36, ty1 - 2, 11, 15), 0.7);
  [[118, 164], [118, 228], [140, 290]].forEach(([x, y]) => { g3 += trazo(pts2d([[x, y + 16], [x, y], [x + 7, y - 5], [x + 14, y], [x + 14, y + 16]]), 1.3) + trazo(pts2d([[x + 3, y + 16], [x + 3, y + 3]]), 2.4); });
  g3 += trazo(L.rayado([[tx1 - 22, ty0 + 30], [tx1, ty0 + 30], [tx1, ty1], [tx1 - 22, ty1]], 1.4, 4.6, { hueco: 0.1 }), 0.7);
  // iglesia y torrecilla
  const ix0 = 392, ix1 = 530, iy0 = 292;
  const tejIg = [[ix0 - 10, iy0 + 2], [ix0 + 36, iy0 - 30], [ix1 - 36, iy0 - 30], [ix1 - 14, iy0 + 2]];
  const abs = L.elipse(ix1 - 24, iy0 + 40, 30, 38, 14, 0, -Math.PI / 2, Math.PI / 2);
  let g5 = relleno(pts2d([[ix0, murY], [ix0, iy0], [ix1 - 24, iy0], [ix1 - 24, murY]], true), '#EFE7D6') + trazo(pts2d([[ix0, murY], [ix0, iy0], [ix1 - 24, iy0], [ix1 - 24, murY]]), 1.8);
  g5 += relleno(pts2d(abs.concat([[ix1 - 24, murY]]), true), '#EFE7D6') + trazo(suave(abs, false), 1.7);
  g5 += relleno(pts2d(tejIg, true), '#B4523A') + trazo(L.poli(tejIg, 0.8), 1.7) + trazo(L.rayado(tejIg, 0.1, 5, { hueco: 0.1 }), 0.8);
  g5 += trazo(pts2d([[ix0 + 44, iy0 - 30], [ix0 + 44, iy0 - 58], [ix0 + 66, iy0 - 58], [ix0 + 66, iy0 - 30]]), 1.6) + trazo(L.poli(L.elipse(ix0 + 55, iy0 - 46, 5, 8, 8, 0, Math.PI, 0), 0.3), 1.2) + trazo(pts2d([[ix0 + 40, iy0 - 58], [ix0 + 55, iy0 - 72], [ix0 + 70, iy0 - 58]]), 1.6);
  g5 += trazo(hiladas(ix0, ix1 - 24, iy0 + 10, murY - 2, 10, 18), 0.7);
  g5 += trazo(pts2d([[ix0 + 20, murY], [ix0 + 20, iy0 + 40], [ix0 + 32, iy0 + 28], [ix0 + 44, iy0 + 40], [ix0 + 44, murY]]), 1.5);
  const mx0 = 356, mx1 = 386;
  let alm3 = '';
  for (let x = mx0 - 4; x < mx1 + 4; x += 10) alm3 += 'M' + n1(x) + ' 260v-8h5v8';
  g5 += relleno(pts2d([[mx0, murY], [mx0, 270], [mx1, 270], [mx1, murY]], true), '#EFE7D6') + trazo(pts2d([[mx0, murY], [mx0, 270], [mx1, 270], [mx1, murY]]), 1.7) + trazo(pts2d([[mx0 - 4, 270], [mx0 - 4, 260], [mx1 + 4, 260], [mx1 + 4, 270]], true), 1.5) + trazo(alm3, 1.3);
  let g6 = '';
  [[50, 424, 1.0], [600, 432, 1.1], [320, 452, 0.8], [130, 444, 0.9], [470, 450, 1.0]].forEach(([x, y, s]) => { const m = L.elipse(x, y, 30 * s, 17 * s, 12); g6 += relleno(pts2d(m, true), '#93A672') + trazo(L.poli(m, 1.4), 1.3) + trazo(L.rayado(L.elipse(x + 4, y + 3, 22 * s, 11 * s, 10), -0.8, 4), 0.7); });
  return svg(W, H, 'Dibujo a plumilla de un castillo de piedra sobre una colina: torre del homenaje, un palacio con galería, una iglesia y una muralla almenada', grupo(1, g1) + grupo(2, g2) + grupo(3, g3) + grupo(4, g4) + grupo(5, g5) + grupo(6, g6));
}

/* ================================================================
   LA HAMBURGUESA POR CAPAS (la barra)
   ================================================================ */
function xxl() {
  const L = Pluma(53);
  const W = 600, H = 346, cx = 300, DY = -188;
  const capa = (id, nombre, cuerpo) => `<g class="capa" data-capa="${id}" data-nombre="${nombre}">${cuerpo}</g>`;
  const ondulado = (x0, x1, y, amp, n, fase = 0) => { const p = []; for (let i = 0; i <= n; i++) p.push([x0 + (x1 - x0) * i / n, y + amp * Math.sin(i * 1.3 + fase) * (i % 2 ? 1 : -0.6)]); return p; };

  const pAbajo = (() => {
    const cont = [[cx - 220, 468], [cx - 214, 490], [cx - 170, 512], [cx - 80, 524], [cx + 80, 524], [cx + 170, 512], [cx + 214, 490], [cx + 220, 468]];
    const poly = cont.concat([[cx + 210, 466], [cx - 210, 466]]);
    return capa(1, 'pan de abajo', relleno(pts2d(poly, true), '#C98B45') + relleno(pts2d([[cx - 212, 492], [cx - 168, 512], [cx - 80, 524], [cx + 80, 524], [cx + 170, 512], [cx + 212, 492], [cx + 150, 508], [cx, 514], [cx - 150, 508]], true), '#A8672B') +
      trazo(L.poli(poly, 1.2), 3.2) + trazo(L.rayado([[cx - 200, 496], [cx + 200, 496], [cx + 160, 516], [cx - 160, 516]], 1.15, 4.6, { hueco: 0.12 }), 1.1));
  })();
  const pCarne = (() => {
    const sup = ondulado(cx - 232, cx + 232, 432, 5, 16, 0.4), inf = ondulado(cx + 228, cx - 228, 472, 3, 12, 1.2);
    const poly = sup.concat(inf);
    let motas = '';
    for (let i = 0; i < 46; i++) { const x = cx - 210 + L.az() * 420, y = 440 + L.az() * 26; motas += 'M' + n1(x) + ' ' + n1(y) + 'l' + n1(3 + L.az() * 3) + ' ' + n1(1 - L.az() * 2); }
    return capa(2, 'carne', relleno(pts2d(poly, true), '#6A3B28') + trazo(L.poli(poly, 1.4), 3.2) + trazo(L.rayado(poly, 1.05, 5.4, { hueco: 0.25 }), 0.9, ' opacity=".7"') + trazo(motas, 1.5, '', '#1A0E08'));
  })();
  const pQueso = (() => {
    const poly = [[cx - 236, 416], [cx + 236, 416], [cx + 242, 430], [cx + 214, 436], [cx + 206, 470], [cx + 190, 440], [cx + 120, 438], [cx + 60, 440], [cx + 40, 454], [cx + 20, 440], [cx - 80, 438], [cx - 150, 441], [cx - 176, 466], [cx - 190, 438], [cx - 232, 434]];
    return capa(3, 'queso', relleno(pts2d(poly, true), '#F2B731') + trazo(L.poli(poly, 1), 3) + trazo('M' + n1(cx - 150) + ' 424l60 0M' + n1(cx + 40) + ' 427l70 -1', 1.4, ' opacity=".6"'));
  })();
  const pTomate = (() => {
    let s = '';
    [[cx - 150, 404, 74], [cx + 10, 410, 82], [cx + 160, 404, 70]].forEach(([x, y, w]) => {
      const poly = L.elipse(x, y, w, 15, 22);
      let pip = '';
      for (let i = 0; i < 7; i++) pip += 'M' + n1(x - w * 0.6 + i * w * 0.2) + ' ' + n1(y - 2 + (i % 2) * 5) + 'l3 2';
      s += relleno(pts2d(poly, true), '#C8352B') + trazo(L.poli(poly.slice(0, -1), 1.2), 3) + trazo(pip, 1.6, '', '#F2D78A') + trazo(suave(L.elipse(x - w * 0.3, y - 3, w * 0.35, 5, 8, 0, Math.PI * 1.1, Math.PI * 1.9), false), 1.2, ' opacity=".6"');
    });
    return capa(4, 'tomate', s);
  })();
  const pLechuga = (() => {
    const sup = [], inf = [];
    for (let i = 0; i <= 26; i++) { const x = cx - 250 + 500 * i / 26; sup.push([x, 372 + 12 * Math.sin(i * 1.7) - (i % 2) * 6]); }
    for (let i = 26; i >= 0; i--) { const x = cx - 250 + 500 * i / 26; inf.push([x, 402 + 10 * Math.sin(i * 2.1 + 1) + (i % 2) * 7]); }
    const poly = sup.concat(inf);
    let ner = '';
    for (let i = 1; i < 26; i += 2) { const x = cx - 250 + 500 * i / 26; ner += 'M' + n1(x) + ' 380q6 10 ' + n1(L.az() * 10 - 5) + ' 20'; }
    return capa(5, 'lechuga', relleno(pts2d(poly, true), '#83B240') + trazo(L.poli(poly, 1.2), 3.2) + trazo(ner, 1.3) + trazo(L.rayado(poly, 0.35, 8, { hueco: 0.4 }), 0.8, ' opacity=".8"'));
  })();
  const pArriba = (() => {
    // cúpula: media elipse con la base algo curvada
    const dom = [];
    for (let i = 0; i <= 36; i++) { const a = Math.PI + Math.PI * i / 36; dom.push([cx + 236 * Math.cos(a), 366 + 158 * Math.sin(a) * (1 + 0.04 * Math.sin(a * 5))]); }
    const base = [[cx + 226, 368], [cx + 120, 378], [cx, 381], [cx - 120, 378], [cx - 226, 368]];
    const poly = dom.concat(base);
    const sombra = [];
    for (let i = 0; i <= 14; i++) { const a = -Math.PI * 0.42 + Math.PI * 0.42 * i / 14; sombra.push([cx + 236 * Math.cos(a), 366 + 158 * Math.sin(a)]); }
    const sombraP = sombra.concat([[cx + 226, 368], [cx + 120, 378], [cx + 150, 330]]);
    const semillas = [];
    for (let i = 0; i < 52; i++) {
      const x = cx - 205 + L.az() * 410, y = 220 + L.az() * 140;
      const e = Math.pow((x - cx) / 222, 2) + Math.pow((y - 366) / 146, 2);
      if (e > 0.82 || e < 0.05 && false) continue;
      semillas.push([x, y, (L.az() - 0.5) * 1.2]);
    }
    const semR = semillas.map(([x, y, r]) => relleno(pts2d(L.elipse(x, y, 7.5, 3.6, 8, r), true), '#F6EAC8')).join('');
    const semT = semillas.map(([x, y, r]) => trazo(pts2d(L.elipse(x, y, 7.5, 3.6, 8, r), true), 1.1)).join('');
    return capa(6, 'pan de arriba', relleno(pts2d(poly, true), '#D99B50') + relleno(pts2d(sombraP, true), '#B97633') + trazo(L.poli(poly, 1.2), 3.4) + trazo(L.rayado(sombraP, 1.1, 5, { hueco: 0.18 }), 0.9) + semR + semT +
      trazo(suave([[cx - 160, 262], [cx - 110, 238], [cx - 50, 228]], false), 2.4, ' opacity=".5"'));
  })();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dibujo a plumilla de una hamburguesa por capas: pan, carne, queso, tomate, lechuga y pan; ilustración genérica, no es la receta" focusable="false"><title>Hamburguesa por capas (ilustración genérica)</title><g transform="translate(0 ${DY})">${pAbajo}${pCarne}${pQueso}${pTomate}${pLechuga}${pArriba}</g></svg>\n`;
}

/* ---------- salida ---------- */
const salida = (carpeta, nombre, texto) => {
  const dir = path.join(raiz, 'img', carpeta);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, nombre), texto);
  console.log('→ img/' + carpeta + '/' + nombre + ' (' + Math.round(texto.length / 1024) + ' KB)');
};
const que = process.argv.slice(2);
const todo = !que.length;
if (todo || que.includes('valle')) salida('comarca', 'valle.svg', valle());
if (todo || que.includes('piscina')) salida('comarca', 'piscina.svg', piscina());
if (todo || que.includes('racimo')) salida('comarca', 'racimo.svg', racimo());
if (todo || que.includes('castillo')) salida('comarca', 'castillo.svg', castillo());
if (todo || que.includes('xxl')) salida('barra', 'xxl.svg', xxl());
