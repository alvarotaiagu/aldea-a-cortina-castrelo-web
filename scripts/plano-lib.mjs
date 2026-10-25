/* «La aldea en plano» · caja de herramientas del dibujo a plumilla.
   Proyección caballera, líneas con pulso de mano, mampostería, tejas, rayado.
   Todo con semilla fija: el mismo comando da siempre el mismo dibujo. */

// ---------- números con semilla ----------
export function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function RND(nombre) {
  const r = mulberry(hashStr('cortina-plano-' + nombre));
  r.f = (a, b) => a + (b - a) * r();
  r.i = (a, b) => Math.floor(a + (b - a + 1) * r());
  r.pick = (a) => a[Math.floor(r() * a.length)];
  r.p = (p) => r() < p;
  return r;
}

// ---------- geometría ----------
export const f1 = (n) => Math.round(n * 10) / 10;
export const pt = (p) => f1(p[0]) + ' ' + f1(p[1]);
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Proyección caballera: el frente (y pequeño) en verdadera magnitud; la profundidad se va hacia
// arriba y a la izquierda; así se ven el frente, las caras de la izquierda y los tejados.
export const KX = 0.40, KY = 0.68, OX = 330, OY = 800;
export const P = (x, y, z = 0) => [OX + x - KX * y, OY - KY * y - z];

// ---------- trazados compactos ----------
// Pasa M/L/Q absolutos a relativos con un decimal y quita ceros: el mismo dibujo en la mitad de bytes.
export function mini(d, prec = 1) {
  const F = prec ? 10 : 1, rd = (n) => Math.round(n * F) / F;
  const num = (n) => { let t = rd(n).toString(); if (t === '-0') t = '0'; return t.replace(/^(-?)0\./, '$1.'); };
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) || [];
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, out = '';
  const nums = (n) => { const a = []; for (let k = 0; k < n; k++) a.push(+toks[i++]); return a; };
  const emit = (c, arr) => { let t = c; arr.forEach((v, k) => { const n = num(v); if (k && !(n[0] === '-')) t += (/\.\d*$/.test(t) && n[0] === '.') ? '' : ' '; t += n; }); out += t; };
  while (i < toks.length) {
    const c = toks[i++];
    if (c === 'M') { const [x, y] = nums(2); const rx = rd(x), ry = rd(y); emit('M', [rx, ry]); cx = sx = rx; cy = sy = ry; }
    else if (c === 'L') { const [x, y] = nums(2); const rx = rd(x), ry = rd(y); emit('l', [rx - cx, ry - cy]); cx = rx; cy = ry; }
    else if (c === 'Q') { const [a, b, x, y] = nums(4); const rx = rd(x), ry = rd(y); emit('q', [rd(a) - cx, rd(b) - cy, rx - cx, ry - cy]); cx = rx; cy = ry; }
    else if (c === 'l') { const [x, y] = nums(2); emit('l', [x, y]); cx += x; cy += y; }
    else if (c === 'q') { const [a, b, x, y] = nums(4); emit('q', [a, b, x, y]); cx += x; cy += y; }
    else if (c === 't') { const [x, y] = nums(2); emit('t', [x, y]); cx += x; cy += y; }
    else if (c === 'Z' || c === 'z') { out += 'z'; cx = sx; cy = sy; }
    else { out += c; }
  }
  return out;
}

// ---------- pulso de mano ----------
// Una línea de A a B con un ligero combado, ligeros desvíos y, si se pide, rabillo que sobresale.
export function pen(a, b, r, { amp = 0.7, ov = 0, seg = 80 } = {}) {
  const L = dist(a, b);
  if (L < 0.8) return { d: '', len: 0 };
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy, ny = ux;
  const s = ov ? r.f(0, ov) : 0, e = ov ? r.f(0, ov) : 0;
  const A = [a[0] - ux * s + nx * r.f(-0.35, 0.35) * amp, a[1] - uy * s + ny * r.f(-0.35, 0.35) * amp];
  const B = [b[0] + ux * e + nx * r.f(-0.35, 0.35) * amp, b[1] + uy * e + ny * r.f(-0.35, 0.35) * amp];
  const n = Math.max(1, Math.round(dist(A, B) / seg));
  let d = 'M' + pt(A), prev = A;
  for (let i = 1; i <= n; i++) {
    let q = lerp(A, B, i / n);
    if (i < n) { const w = r.f(-1, 1) * amp * 0.8; q = [q[0] + nx * w, q[1] + ny * w]; }
    const m = lerp(prev, q, 0.5), w2 = r.f(-1, 1) * amp * 0.7;
    d += 'Q' + pt([m[0] + nx * w2, m[1] + ny * w2]) + ' ' + pt(q);
    prev = q;
  }
  return { d, len: dist(A, B) * 1.02 };
}

// polilínea con pulso (vértices ligeramente movidos), sin rabillos
export function pline(pts, r, { amp = 0.6, cerrar = false } = {}) {
  const q = pts.map((p) => [p[0] + r.f(-1, 1) * amp * 0.5, p[1] + r.f(-1, 1) * amp * 0.5]);
  let d = 'M' + pt(q[0]), len = 0;
  for (let i = 1; i < q.length; i++) { d += 'L' + pt(q[i]); len += dist(q[i - 1], q[i]); }
  if (cerrar) { d += 'Z'; len += dist(q[q.length - 1], q[0]); }
  return { d, len: len * 1.02 };
}

// ---------- recorte de rectas contra un polígono convexo (rayado) ----------
export function hatchPoly(poly, ang, sp, r, { skip = 0, jit = 0.8, ini = 0, fin = 0 } = {}) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const pr = poly.map((p) => p[0] * nx + p[1] * ny);
  const lo = Math.min(...pr), hi = Math.max(...pr);
  const out = [];
  for (let s = lo + sp * 0.5 + (r ? r.f(0, sp * 0.4) : 0); s < hi; s += sp * (r ? r.f(0.85, 1.15) : 1)) {
    const xs = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const sa = a[0] * nx + a[1] * ny - s, sb = b[0] * nx + b[1] * ny - s;
      if ((sa <= 0 && sb > 0) || (sb <= 0 && sa > 0)) {
        const t = sa / (sa - sb); const p = lerp(a, b, t);
        xs.push(p[0] * ux + p[1] * uy);
      }
    }
    if (xs.length < 2) continue;
    const t0 = Math.min(...xs), t1 = Math.max(...xs);
    if (t1 - t0 < 2) continue;
    if (skip && r && r() < skip) continue;
    const j0 = r ? r.f(0, jit) + ini : ini, j1 = r ? r.f(0, jit) + fin : fin;
    if (t1 - t0 - j0 - j1 < 1.5) continue;
    const a = [ux * (t0 + j0) + nx * s, uy * (t0 + j0) + ny * s];
    const b = [ux * (t1 - j1) + nx * s, uy * (t1 - j1) + ny * s];
    out.push([a, b]);
  }
  return out;
}

// ---------- un grupo de dibujo (una pieza o una zona) ----------
// Se dibuja por CAPAS, de atrás adelante: cada capa lleva su papel (que tapa lo de detrás), su color
// real (que se rellena al tocar) y su tinta. Así lo que queda oculto detrás no deja líneas.
const FASE = { c: 1, r: 2, p: 3, d: 3, h: 4, s: 4 };
class Capa {
  constructor() { this.papel = []; this.color = []; this.tintas = new Map(); this.contornos = []; this.extra = []; }
}
export class Grupo {
  constructor(id, { zona = null, tenue = false, clase = '' } = {}) {
    this.id = id; this.zona = zona; this.tenue = tenue; this.clase = clase;
    this.capas = [new Capa()]; this.hit = [];
  }
  nueva() { if (this.c.papel.length || this.c.tintas.size || this.c.contornos.length) this.capas.push(new Capa()); return this; }
  get c() { return this.capas[this.capas.length - 1]; }
  // cara que tapa lo de detrás (papel); `col` = color real que se rellena al tocar
  cara(pts, col = null, { hatchAng = -0.62, hatchSp = 4.6, op = null, hit = true, papel = true } = {}) {
    if (papel) this.c.papel.push(pts);
    if (hit) this.hit.push(pts);
    if (col) this.c.color.push({ pts, c: col, ang: hatchAng, sp: hatchSp, op });
  }
  // trazo suelto: pieza de un compuesto por clase de tinta
  tinta(tipo, k, trazo) {
    if (!trazo || !trazo.d) return;
    const key = tipo + k;
    let t = this.c.tintas.get(key);
    if (!t) { t = { tipo, k, ds: [], max: 0 }; this.c.tintas.set(key, t); }
    t.ds.push(trazo.d); t.max = Math.max(t.max, trazo.len);
  }
  // contorno con su propio dibujado (se traza uno a uno)
  contorno(trazo, k = 'k1') {
    if (!trazo || !trazo.d) return;
    this.c.contornos.push({ d: trazo.d, k });
  }
  seg(tipo, k, a, b, r, o) { this.tinta(tipo, k, pen(a, b, r, o)); }
  borde(a, b, r, k = 'k1', o = { ov: 2.4, amp: 0.8 }) { this.contorno(pen(a, b, r, o), k); }
  poli(pts, r, k = 'k1', o) { for (let i = 0; i < pts.length; i++) this.borde(pts[i], pts[(i + 1) % pts.length], r, k, o); }
  svg() {
    const R = RND('grupo-' + this.id);
    let s = '';
    for (const c of this.capas) {
      if (c.papel.length) s += `<path class="pf" d="${mini(c.papel.map((p) => 'M' + p.map(pt).join('L') + 'Z').join(''))}"/>`;
      const porColor = new Map();
      for (const q of c.color) { const k = q.c + '|' + (q.op || ''); if (!porColor.has(k)) porColor.set(k, []); porColor.get(k).push(q); }
      for (const [k, lista] of porColor) {
        const [nom, op] = k.split('|');
        s += `<path class="cf c-${nom}"${op ? ` style="--op:${op}"` : ''} d="${mini(lista.map((q) => 'M' + q.pts.map(pt).join('L') + 'Z').join(''))}"/>`;
      }
      const orden = ['p', 'd', 's', 'r', 'h'];
      const lista = [...c.tintas.values()].sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo));
      for (const t of lista) s += `<path class="t t-${t.tipo} ${t.k}" data-f="${FASE[t.tipo]}" data-l="${Math.ceil(t.max + 1)}" d="${mini(t.ds.join(''), t.k === 'k6' && t.tipo !== 'r' ? 0 : 1)}"/>`;
      for (const q of c.contornos) s += `<path class="t t-c ${q.k}" data-f="1" pathLength="1" d="${mini(q.d)}"/>`;
      for (const e of c.extra) s += e;
    }
    return s;
  }
}

// ---------- mampostería ----------
// Hiladas con juntas desparejas y algunas piedras sombreadas. `f(u,v)` lleva (ancho, alto) a la pantalla.
export function mamposteria(g, f, w, h, r, { rh = [9, 14], sw = [20, 40], sombra = 0.2, hueco = 0.1, k = 'k5', huecos = [] } = {}) {
  const enHueco = (u, v) => huecos.some((q) => u > q[0] - 1 && u < q[1] + 1 && v > q[2] - 1 && v < q[3] + 1);
  let v = 0, fila = 0;
  while (v < h - 3) {
    let alto = r.f(rh[0], rh[1]); if (v + alto > h - 3) alto = h - v;
    // línea de la hilada: tramos con huecos
    let u = 0;
    while (u < w - 2) {
      const largo = r.f(sw[0], sw[1]) * r.f(1.4, 2.6);
      const u1 = Math.min(w, u + largo);
      if (!enHueco((u + u1) / 2, v)) {
        if (v > 0.5 && !r.p(hueco)) g.tinta('p', k, pen(f(u + r.f(0, 2), v + r.f(-0.7, 0.7)), f(u1 - r.f(0, 2), v + r.f(-0.7, 0.7)), r, { amp: 0.7 }));
      }
      u = u1 + r.f(0, 5);
    }
    // juntas verticales y piedras
    u = r.f(-sw[0] * 0.6, 0);
    while (u < w) {
      const a = r.f(sw[0], sw[1]); const u1 = u + a;
      const uj = Math.min(w - 1, Math.max(1, u1));
      if (uj < w - 1 && !enHueco(uj, v + alto / 2) && !r.p(hueco * 0.7)) {
        g.tinta('p', k, pen(f(uj + r.f(-1, 1), v + r.f(0.5, 2)), f(uj + r.f(-1.4, 1.4), v + alto - r.f(0.5, 2)), r, { amp: 0.5 }));
      }
      // piedra sombreada (rayado corto) o con una oquedad
      const cu = Math.max(1, u) + 2, cu1 = Math.min(w - 1, u1) - 2;
      if (cu1 - cu > 8 && alto > 7 && !enHueco((cu + cu1) / 2, v + alto / 2)) {
        if (r.p(sombra)) {
          const poly = [f(cu, v + 2), f(cu1, v + 2.6), f(cu1 - 1, v + alto - 2), f(cu + 1, v + alto - 2.4)];
          for (const [p, q] of hatchPoly(poly, -0.95, 2.6, r, { jit: 0.8 })) g.tinta('p', 'k6', { d: 'M' + pt(p) + 'L' + pt(q), len: dist(p, q) });
        } else if (r.p(0.09)) {
          const c = f((cu + cu1) / 2, v + alto * 0.45);
          g.tinta('p', 'k6', { d: 'M' + pt([c[0] - 3, c[1] + 0.5]) + 'q3 -2.4 6 0', len: 7 });
        }
      }
      u = u1;
    }
    v += alto; fila++;
  }
}

// ---------- tejas (teja curva): canales de la cumbrera al alero ----------
export function tejas(g, A, B, C, D, r, { sp = 10.5, k = 'k5', sombra = 0, falta = 0.06 } = {}) {
  // A-B alero (A izquierda, B derecha); D-C cumbrera (D arriba-izquierda, C arriba-derecha)
  const n = Math.max(2, Math.round(dist(A, B) / sp));
  const canal = [];
  for (let i = 0; i <= n; i++) canal.push(i / n);
  canal.forEach((t, i) => {
    if (falta && r.p(falta)) return;
    const E = lerp(A, B, t), Rr = lerp(D, C, t);
    const s0 = r.f(0, 0.05), s1 = r.f(0.9, 1);
    g.tinta('r', k, pen(lerp(E, Rr, s0), lerp(E, Rr, s1), r, { amp: 0.8, seg: 60 }));
    // gancho de la teja en el alero
    if (i < n) {
      const t2 = (i + 0.5) / n; const E2 = lerp(A, B, t2);
      const dir = [(Rr[0] - E[0]) / (dist(E, Rr) || 1), (Rr[1] - E[1]) / (dist(E, Rr) || 1)];
      g.tinta('r', 'k5', { d: 'M' + pt([E[0] + (B[0] - A[0]) / n * 0.12, E[1]]) + 'q' + f1((B[0] - A[0]) / n * 0.38) + ' ' + f1(2.2 + r.f(0, 1)) + ' ' + f1((B[0] - A[0]) / n * 0.78) + ' ' + f1(-0.3), len: 9 });
    }
  });
  // hiladas partidas (solape de tejas)
  const nf = Math.max(1, Math.round(dist(lerp(A, D, 0), lerp(D, A, 0)) / 11));
  for (let j = 1; j < nf; j++) {
    const s = j / nf;
    for (let i = 0; i < n; i++) {
      if (!r.p(0.55)) continue;
      const t0 = i / n + 0.12 / n, t1 = (i + 1) / n - 0.12 / n;
      const aa = lerp(lerp(A, D, s), lerp(B, C, s), t0), bb = lerp(lerp(A, D, s), lerp(B, C, s), t1);
      g.tinta('r', 'k6', pen(aa, bb, r, { amp: 0.6, seg: 40 }));
    }
  }
  if (sombra) {
    // sombra: unas hiladas junto a la cumbrera y a la derecha más cerradas
    const quad = [lerp(A, D, 0.55), lerp(B, C, 0.55), C, D];
    for (const [p, q] of hatchPoly(quad, 0.5, 3.2, r, { jit: 1.2 })) g.tinta('h', 'k6', { d: 'M' + pt(p) + 'L' + pt(q), len: dist(p, q) });
  }
}

// ---------- rayado de sombra sobre un polígono convexo ----------
export function sombrear(g, poly, r, { ang = -0.9, sp = 3.4, k = 'k6', skip = 0.08, jit = 1.2 } = {}) {
  for (const [a, b] of hatchPoly(poly, ang, sp, r, { skip, jit })) g.tinta('h', k, { d: 'M' + pt(a) + 'L' + pt(b), len: dist(a, b) });
}

// ---------- tablas verticales de madera (como en el logo) ----------
export function tablas(g, f, u0, u1, v0, v1, r, { sp = 5.2, k = 'k5', tipo = 'd', corte = 0.1 } = {}) {
  for (let u = u0 + sp * 0.4; u < u1; u += sp * r.f(0.8, 1.25)) {
    const a = r.f(0, 2.4) + (r.p(corte) ? r.f(2, 10) : 0), b = r.f(0, 3);
    g.tinta(tipo, k, pen(f(u + r.f(-0.3, 0.3), v1 - a), f(u + r.f(-0.5, 0.5), v0 + b), r, { amp: 0.4 }));
  }
}

// ---------- arco de pluma para copas de árbol ----------
export function copa(g, cx, cy, rad, r, { k = 'k3', denso = 1 } = {}) {
  // varias circunferencias que se juntan; se dibujan solo los tramos exteriores
  const n = r.i(5, 7), cs = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r.f(-0.3, 0.3), dd = i === 0 ? 0 : rad * r.f(0.42, 0.62);
    cs.push({ x: cx + Math.cos(a) * dd * 1.15, y: cy + Math.sin(a) * dd * 0.78 - (i === 0 ? 0 : 0), r: rad * r.f(0.5, 0.72) });
  }
  cs.push({ x: cx, y: cy - rad * 0.2, r: rad * 0.7 });
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]; let run = [];
    const flush = () => {
      if (run.length > 2) {
        let d = 'M' + pt(run[0]), len = 0;
        for (let j = 1; j < run.length; j++) { d += 'L' + pt(run[j]); len += dist(run[j - 1], run[j]); }
        g.tinta('s', k, { d, len });
      }
      run = [];
    };
    for (let a = 0; a <= 360; a += 14) {
      const ang = (a * Math.PI) / 180 + i;
      const p = [c.x + Math.cos(ang) * c.r * 1.12 + r.f(-0.5, 0.5), c.y + Math.sin(ang) * c.r * 0.86 + r.f(-0.5, 0.5)];
      const dentro = cs.some((o, j) => j !== i && ((p[0] - o.x) / (o.r * 1.04)) ** 2 + ((p[1] - o.y) / (o.r * 0.82)) ** 2 < 0.86);
      if (dentro) flush(); else run.push(p);
    }
    flush();
  }
  // sombra interior: arcos pequeños en la parte baja-derecha
  const m = Math.round(rad * 0.9 * denso);
  for (let i = 0; i < m; i++) {
    const a = r.f(0.1, 1.5), q = r.f(0.15, 0.85) * rad;
    const x = cx + Math.cos(a) * q * 1.1, y = cy + Math.sin(a) * q * 0.7 + rad * 0.1;
    g.tinta('h', 'k6', { d: 'M' + pt([x - 2.6, y - 1.2]) + 'q2.6 3 5.6 0.4', len: 7 });
  }
}
