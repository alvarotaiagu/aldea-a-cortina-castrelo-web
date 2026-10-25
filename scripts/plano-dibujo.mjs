/* «La aldea en plano» · generador del dibujo (img/plano/plano.svg).
   Un dibujo a plumilla en perspectiva caballera del conjunto, visto desde el norte: el cenador
   (por detrás), la piscina a un lado, el césped en medio y, al fondo, la casa de almagre y el
   edificio de la solaina. Es ORIENTATIVO: la composición sale de la ortofoto del IGN y de las
   fotos, no de planos; no guarda escala ni medidas.
   Uso: node scripts/plano-dibujo.mjs      (siempre da el mismo dibujo: semilla fija) */
import fs from 'node:fs';
import { RND, P, pen, pline, hatchPoly, Grupo, mamposteria, tejas, sombrear, tablas, copa, f1, pt, lerp, dist } from './plano-lib.mjs';

const SALIDA = new URL('../img/plano/', import.meta.url);
const items = [];
const G = (id, zona = null, o = {}) => { const g = new Grupo(id, { zona, ...o }); items.push(g); return g; };

const frente = (x0, y0) => (u, v) => P(x0 + u, y0, v);
const izq = (x0, y0) => (u, v) => P(x0, y0 + u, v);
const quad = (f, u0, u1, v0, v1) => [f(u0, v0), f(u1, v0), f(u1, v1), f(u0, v1)];
const suelo = (x0, x1, y0, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
const raya = (g, tipo, k, a, b) => g.tinta(tipo, k, { d: 'M' + pt(a) + 'L' + pt(b), len: dist(a, b) });
const elipse = (cx, cy, rx, ry, n = 56, z = 0, ang = 0) => {
  const o = [];
  for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; const dx = Math.cos(t) * rx, dy = Math.sin(t) * ry; o.push(P(cx + dx * Math.cos(ang) - dy * Math.sin(ang), cy + dx * Math.sin(ang) + dy * Math.cos(ang), z)); }
  return o;
};

// ---------- piezas de fachada ----------
function ventana(g, f, u0, u1, v0, v1, r, { marco = true, m = 3.4, mont = 1, vidrio = true, capa = false } = {}) {
  if (capa) g.nueva();
  if (marco) { const ext = quad(f, u0 - m, u1 + m, v0 - m, v1 + m); g.cara(ext, 'granito', { hit: false }); g.poli(ext, r, 'k3', { ov: 0.8, amp: 0.4 }); }
  const hu = quad(f, u0, u1, v0, v1);
  g.cara(hu, vidrio ? 'cristal' : null, { hit: false });
  g.poli(hu, r, 'k2', { ov: 1, amp: 0.4 });
  if (vidrio) for (const [a, b] of hatchPoly(hu, -1.05, 2.5, r, { jit: 0.7, skip: 0.16 })) raya(g, 'd', 'k6', a, b);
  for (let i = 1; i <= mont; i++) { const u = u0 + ((u1 - u0) * i) / (mont + 1); g.seg('d', 'k4', f(u, v0), f(u, v1), r, { amp: 0.3 }); }
  g.seg('d', 'k4', f(u0, (v0 + v1) / 2 + 3), f(u1, (v0 + v1) / 2 + 3), r, { amp: 0.3 });
  // alféizar
  g.seg('d', 'k3', f(u0 - m - 1.5, v0 - m), f(u1 + m + 1.5, v0 - m), r, { amp: 0.3 });
}
function puerta(g, f, u0, u1, v0, v1, r, { vidrio = 0.45, dintel = true } = {}) {
  const pu = quad(f, u0, u1, v0, v1);
  g.cara(pu, 'madera', { hit: false });
  g.poli(pu, r, 'k2', { ov: 1.2, amp: 0.4 });
  tablas(g, f, u0 + 1.5, u1 - 1.5, v0, v1 * (1 - vidrio * 0.9), r, { sp: 4.6, k: 'k5' });
  const vi = quad(f, u0 + 4, u1 - 4, v1 * (1 - vidrio) + 2, v1 - 4);
  g.cara(vi, 'cristal', { hit: false });
  g.poli(vi, r, 'k4', { ov: 0.6, amp: 0.3 });
  for (const [a, b] of hatchPoly(vi, -1.05, 2.4, r, { jit: 0.6, skip: 0.15 })) raya(g, 'd', 'k6', a, b);
  if (dintel) { const li = quad(f, u0 - 5, u1 + 5, v1, v1 + 5); g.cara(li, 'granito', { hit: false }); g.poli(li, r, 'k3', { ov: 0.8, amp: 0.4 }); }
}
function viga(g, f, u0, u1, v0, v1, r) {
  const q = quad(f, u0, u1, v0, v1);
  g.cara(q, 'madera', { hit: false });
  g.poli(q, r, 'k3', { ov: 1.4, amp: 0.5 });
  for (let i = 0; i < 3; i++) raya(g, 'd', 'k6', f(u0 + r.f(0, 14), v0 + ((v1 - v0) * (i + 1)) / 4), f(u1 - r.f(0, 14), v0 + ((v1 - v0) * (i + 1)) / 4 + r.f(-0.4, 0.4)));
}
function esquinero(g, f, u0, u1, v0, v1, r, { color = 'granito', bloque = 13 } = {}) {
  g.cara(quad(f, u0, u1, v0, v1), color, { hit: false });
  let v = v0, i = 0;
  while (v < v1 - 2) {
    const b = Math.min(v1 - v, bloque * r.f(0.8, 1.25));
    g.seg('p', 'k4', f(u0, v), f(u1, v + r.f(-0.4, 0.4)), r, { amp: 0.4 });
    if (i % 2) g.seg('p', 'k5', f(u0 + (u1 - u0) * r.f(0.35, 0.6), v), f(u0 + (u1 - u0) * r.f(0.35, 0.6), v + b), r, { amp: 0.3 });
    v += b; i++;
  }
  g.poli(quad(f, u0, u1, v0, v1), r, 'k3', { ov: 0.8, amp: 0.4 });
}
function moteado(g, f, u0, u1, v0, v1, r, n) {
  for (let i = 0; i < n; i++) { const u = r.f(u0, u1 - 4), v = r.f(v0, v1 - 1), l = r.f(1.6, 4.4); raya(g, 'h', 'k6', f(u, v), f(u + l, v + r.f(-0.5, 0.5))); }
}

// ---------- tejado de dos aguas con la cumbrera a lo largo de x ----------
function tejadoGeom({ x0, x1, y0, y1, h, H, ov = 12, ovx = 8 }) {
  const ym = (y0 + y1) / 2, ze = h - (ov * (H - h)) / (ym - y0);
  const A = P(x0 - ovx, y0 - ov, ze), B = P(x1 + ovx, y0 - ov, ze), C = P(x1 + ovx, ym, H), D = P(x0 - ovx, ym, H);
  const E = P(x0 - ovx, y1 + ov, ze), F = P(x1 + ovx, y1 + ov, ze);
  return { A, B, C, D, E, F, ym, ze, atras: E[1] < D[1] - 3 };
}
function faldonTrasero(g, r, T, o = {}) {
  g.nueva();
  g.cara([T.D, T.C, T.F, T.E], 'teja');
  tejas(g, T.E, T.F, T.C, T.D, r, { sp: 11, ...o });
  g.borde(T.E, T.F, r, 'k2'); g.borde(T.D, T.E, r, 'k2'); g.borde(T.C, T.F, r, 'k2');
}
function faldonFrontal(g, r, T, o = {}) {
  g.nueva();
  g.cara([T.A, T.B, T.C, T.D], 'teja');
  tejas(g, T.A, T.B, T.C, T.D, r, { sp: 10.5, sombra: 1, ...o });
  // canto del alero: un grueso de tabla
  g.seg('d', 'k3', [T.A[0] + 1, T.A[1] + 4.2], [T.B[0] - 1, T.B[1] + 4.2], r, { amp: 0.5 });
  g.borde(T.A, T.B, r, 'k1'); g.borde(T.D, T.C, r, T.atras ? 'k2' : 'k1');
  g.borde(T.A, T.D, r, 'k2'); g.borde(T.B, T.C, r, 'k2');
}
// cara de la izquierda con su hastial
function caraIzq(g, r, { x0, y0, y1, h, H, color = 'piedra', mamp = {}, ymin = 0 }) {
  const ym = (y0 + y1) / 2, fl = izq(x0, y0);
  g.nueva();
  const poly = [P(x0, y0, ymin), P(x0, y1, ymin), P(x0, y1, h), P(x0, ym, H), P(x0, y0, h)];
  g.cara(poly, color);
  if (color === 'piedra') {
    mamposteria(g, fl, y1 - y0, h - ymin, r, { ...mamp });
    // el hastial: unas hiladas más cortas hacia la punta
    const alto = H - h; let v = 0;
    while (v < alto - 4) { const w = (y1 - y0) * (1 - (v + 6) / alto); const u0 = ((y1 - y0) - w) / 2; raya(g, 'p', 'k5', fl(u0 + r.f(0, 4), h + v), fl(u0 + w - r.f(0, 4), h + v)); v += r.f(9, 13); }
  }
  // cara a la sombra (la luz viene del oeste): rayado
  sombrear(g, poly, r, { ang: -0.78, sp: 3.7, skip: 0.14, jit: 2.2 });
  g.borde(P(x0, y0, ymin), P(x0, y1, ymin), r, 'k2');
  g.borde(P(x0, y1, ymin), P(x0, y1, h), r, 'k2');
  g.borde(P(x0, y1, h), P(x0, ym, H), r, 'k2'); g.borde(P(x0, ym, H), P(x0, y0, h), r, 'k2');
  g.borde(P(x0, y0, h), P(x0, y0, ymin), r, 'k1');
}

// ====================================================================
// 1. TERRENO: prado, bosque, calles
// ====================================================================
function prado() {
  const r = RND('prado'); const g = G('prado', null, { clase: 'ten' });
  // pasto seco: matas de trazos cortos, más espesas hacia el borde
  for (let i = 0; i < 230; i++) {
    const x = r.f(-90, 170), y = r.f(40, 560);
    const p = P(x, y);
    const l = r.f(2.4, 5);
    for (let k = -1; k <= 1; k++) raya(g, 's', 'k6', [p[0] + k * 2.2, p[1]], [p[0] + k * 3.4 + r.f(-0.6, 0.6), p[1] - l - r.f(0, 2)]);
  }
}
function arbol(g, x, y, rad, r) {
  const c = P(x, y, rad * 1.1);
  const base = P(x, y, 0);
  g.nueva();
  const blob = []; for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; blob.push([c[0] + Math.cos(a) * rad * 1.02, c[1] + Math.sin(a) * rad * 0.82]); }
  g.cara(blob, 'follaje', { hit: false });
  // tronco
  g.seg('s', 'k3', [base[0] - 1.6, base[1]], [c[0] - 1.6, c[1] + rad * 0.55], r, { amp: 0.4 });
  g.seg('s', 'k3', [base[0] + 1.8, base[1]], [c[0] + 1.8, c[1] + rad * 0.55], r, { amp: 0.4 });
  copa(g, c[0], c[1], rad, r, { k: 'k3' });
}
function pino(g, x, y, hh, r) {
  const base = P(x, y, 0), cx = base[0] + r.f(-1, 1), w = hh * r.f(0.24, 0.3);
  g.nueva();
  const tiers = r.i(4, 5), ap = [cx, base[1] - hh];
  const der = [], izq2 = [];
  for (let i = 0; i < tiers; i++) {
    const yy = ap[1] + hh * (0.1 + (0.86 * (i + 1)) / tiers), ww = w * (0.32 + (0.68 * (i + 1)) / tiers);
    const dy = hh * 0.045;
    der.push([cx + ww, yy - dy * 0.2]); if (i < tiers - 1) der.push([cx + ww * 0.42, yy - dy * 2.2]);
    izq2.push([cx - ww, yy - dy * 0.2]); if (i < tiers - 1) izq2.push([cx - ww * 0.42, yy - dy * 2.2]);
  }
  const sil = [ap, ...der, [cx, base[1] - hh * 0.08], ...izq2.reverse()];
  g.cara(sil, 'follaje', { hit: false });
  const abierto = [ap, ...der.map((p) => [p[0] + r.f(-0.5, 0.5), p[1] + r.f(-0.5, 0.5)]), [cx + 1.5, base[1] - hh * 0.08]];
  g.tinta('s', 'k3', pline(abierto, r, { amp: 0.5 }));
  g.tinta('s', 'k3', pline([ap, ...izq2.slice().reverse().map((p) => [p[0] + r.f(-0.5, 0.5), p[1] + r.f(-0.5, 0.5)]), [cx - 1.5, base[1] - hh * 0.08]], r, { amp: 0.5 }));
  g.tinta('s', 'k3', { d: 'M' + pt([cx, base[1] - hh * 0.08]) + 'L' + pt([cx + r.f(-0.6, 0.6), base[1]]), len: hh * 0.1 });
  // rayado de la mitad derecha de cada piso
  for (let i = 0; i < tiers; i++) {
    const yy = ap[1] + hh * (0.1 + (0.86 * (i + 1)) / tiers), ww = w * (0.32 + (0.68 * (i + 1)) / tiers);
    for (let k = 0; k < 5; k++) { const u = r.f(0.1, 0.9) * ww; raya(g, 'h', 'k6', [cx + u * 0.3, yy - hh * 0.12 - r.f(0, 3)], [cx + u, yy - hh * 0.02 - r.f(0, 2)]); }
  }
}
function bosque() {
  const r = RND('bosque'); const g = G('bosque', null, { clase: 'ten' });
  const lista = [];
  for (let i = 0; i < 30; i++) lista.push({ x: r.f(-70, 130), y: r.f(150, 570), rad: r.f(22, 36), pino: r.p(0.6), hh: r.f(80, 118) });
  lista.sort((a, b) => b.y - a.y);
  for (const a of lista) { if (a.pino) pino(g, a.x, a.y, a.hh, r); else arbol(g, a.x, a.y, a.rad, r); }
}
function arbolesCerca() {
  const r = RND('arboles-cerca'); const g = G('arboles-cerca', null, {});
  for (const a of [{ x: 40, y: 60, rad: 30 }, { x: 150, y: 30, rad: 24 }, { x: 1150, y: 120, rad: 30 }]) arbol(g, a.x, a.y, a.rad, r);
  pino(g, 70, 190, 96, r);
}
function calles() {
  const r = RND('calles'); const g = G('calles', null, { clase: 'ten' });
  // camino que sube por el oeste (derecha del dibujo) y calle del pueblo al fondo
  const lane = suelo(1000, 1075, -70, 600);
  g.cara(lane, 'asfalto', { hit: false });
  g.borde(P(1000, -70), P(1000, 600), r, 'k3', { ov: 0, amp: 1.2 });
  g.borde(P(1075, -70), P(1075, 600), r, 'k3', { ov: 0, amp: 1.2 });
  for (let y = -60; y < 590; y += 11) { const a = P(1004 + r.f(0, 8), y), b = P(1004 + r.f(8, 24), y + r.f(2, 5)); raya(g, 'h', 'k6', a, b); }
  const calle = suelo(-60, 1075, 590, 630);
  g.cara(calle, 'asfalto', { hit: false });
  g.borde(P(-60, 590), P(1075, 590), r, 'k3', { ov: 0, amp: 1.2 });
  g.borde(P(-60, 630), P(1075, 630), r, 'k3', { ov: 0, amp: 1.2 });
  for (let x = -50; x < 1060; x += 13) raya(g, 'h', 'k6', P(x + r.f(0, 4), 594 + r.f(0, 8)), P(x + r.f(8, 24), 596 + r.f(2, 14)));
}
function vecina(id, x0, x1, y0, y1, h, H, o = {}) {
  const r = RND('vecina-' + id); const g = G('vecina-' + id, null, { clase: 'ten' });
  const T = tejadoGeom({ x0, x1, y0, y1, h, H, ov: 8, ovx: 6 });
  if (T.atras) faldonTrasero(g, r, T, { sp: 10 });
  caraIzq(g, r, { x0, y0, y1, h, H, color: 'piedra', mamp: { rh: [10, 15], sw: [22, 44], sombra: 0.12 } });
  g.nueva();
  const ff = frente(x0, y0), W = x1 - x0;
  g.cara(quad(ff, 0, W, 0, h), o.color || 'piedra');
  mamposteria(g, ff, W, h, r, { rh: [10, 15], sw: [22, 44], sombra: 0.12, huecos: o.huecos || [] });
  for (const q of o.huecos || []) ventana(g, ff, q[0] + 2, q[1] - 2, q[2] + 2, q[3] - 2, r, { m: 2.6 });
  g.borde(P(x0, y0, 0), P(x1, y0, 0), r, 'k2'); g.borde(P(x0, y0, 0), P(x0, y0, h), r, 'k2'); g.borde(P(x1, y0, 0), P(x1, y0, h), r, 'k2');
  faldonFrontal(g, r, T, { sombra: 0 });
}
function vecinas() {
  vecina('a', 150, 290, 650, 740, 62, 100, { huecos: [[22, 44, 20, 46], [88, 110, 20, 46]] });
  vecina('b', 420, 590, 655, 745, 70, 108, { huecos: [[30, 54, 24, 52], [98, 122, 24, 52], [140, 160, 30, 54]] });
  vecina('c', 700, 860, 650, 745, 64, 100, { huecos: [[26, 48, 22, 48], [96, 118, 22, 48]] });
  vecina('d', 910, 1060, 660, 740, 58, 92, { huecos: [[22, 42, 20, 44]] });
}
function huerta() {
  const r = RND('huerta'); const g = G('huerta', null, { clase: 'ten' });
  // bancales entre la piscina y el edificio de la solaina (se ven en la ortofoto); sin nombrar
  for (let i = 0; i < 6; i++) {
    const y = 372 + i * 11;
    g.seg('h', 'k5', P(170, y), P(430, y + r.f(-1, 1)), r, { amp: 0.8 });
  }
  for (let i = 0; i < 8; i++) { const x = 175 + i * 33; g.seg('h', 'k6', P(x, 372), P(x + r.f(-4, 4), 436), r, { amp: 0.8 }); }
}

// ====================================================================
// 2. PISCINA
// ====================================================================
function piscina() {
  const r = RND('piscina'); const g = G('piscina', 'piscina');
  const x0 = 150, x1 = 440, y0 = 150, y1 = 360, cx = 295, cy = 255;
  const terr = suelo(x0, x1, y0, y1);
  g.cara(terr, 'terraza');
  g.poli(terr, r, 'k2', { ov: 1.6, amp: 1 });
  // solado estampado: tablas largas
  for (let y = y0 + 6; y < y1 - 3; y += 6.2) {
    let x = x0 + 3;
    while (x < x1 - 4) {
      const l = r.f(40, 120); const xe = Math.min(x1 - 3, x + l);
      if (r.p(0.82)) raya(g, 'h', 'k6', P(x, y + r.f(-0.6, 0.6)), P(xe, y + r.f(-0.6, 0.6)));
      x = xe + r.f(2, 8);
    }
  }
  // borde de piedra y vaso
  g.nueva();
  const ext = elipse(cx, cy, 108, 60, 64), vaso = elipse(cx, cy, 95, 48, 64);
  g.cara(ext, 'granito', { hit: true });
  g.contorno(pline(ext, r, { amp: 0.7, cerrar: true }), 'k1');
  g.nueva();
  g.cara(vaso, 'agua');
  g.contorno(pline(vaso, r, { amp: 0.6, cerrar: true }), 'k2');
  // agua: ondas y destellos
  for (let i = 0; i < 70; i++) {
    const a = r.f(0, Math.PI * 2), q = Math.sqrt(r.f(0.02, 0.78));
    const px = cx + Math.cos(a) * 88 * q, py = cy + Math.sin(a) * 42 * q;
    const p = P(px, py); const l = r.f(5, 14);
    g.tinta('s', 'k6', { d: 'M' + pt([p[0] - l / 2, p[1]]) + 'q' + f1(l / 4) + ' -1.6 ' + f1(l / 2) + ' 0t' + f1(l / 2) + ' 0', len: l + 2 });
  }
  // orilla sombreada (borde norte, el más lejano)
  for (let i = 0; i < 18; i++) { const t = r.f(0.18, 0.82) * Math.PI; const p = P(cx - Math.cos(t) * 90, cy - Math.sin(t) * 44); raya(g, 'h', 'k6', p, [p[0] + r.f(2, 6), p[1] + r.f(3, 7)]); }
  // escalerilla (dos barras) en el borde norte
  g.nueva();
  const e1 = P(cx + 40, cy - 54), e2 = P(cx + 54, cy - 52);
  for (const e of [e1, e2]) { g.seg('d', 'k3', [e[0], e[1] + 12], [e[0], e[1] - 12], r, { amp: 0.2 }); g.tinta('d', 'k3', { d: 'M' + pt([e[0], e[1] - 12]) + 'q4 -1 4 4', len: 8 }); }
  // dos tumbonas al sur
  for (const [lx, ly] of [[262, 322], [312, 326]]) {
    const q = [P(lx, ly, 8), P(lx + 22, ly, 8), P(lx + 22, ly + 52, 8), P(lx, ly + 52, 8)];
    g.cara(q, 'tumbona', { hit: false });
    g.poli(q, r, 'k3', { ov: 0.6, amp: 0.4 });
    for (let k = 1; k < 7; k++) raya(g, 'd', 'k6', lerp(q[0], q[3], k / 7), lerp(q[1], q[2], k / 7));
    for (const [dx, dy] of [[1, 1], [21, 1], [1, 51], [21, 51]]) raya(g, 'd', 'k5', P(lx + dx, ly + dy, 8), P(lx + dx, ly + dy, 0));
  }
}
function vallaPiscina() {
  const r = RND('valla'); const g = G('valla-piscina', 'piscina');
  g.nueva();
  const tramo = (x0, y0, x1, y1) => {
    const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 6);
    const a0 = P(x0, y0, 0), a1 = P(x1, y1, 0), b0 = P(x0, y0, 26), b1 = P(x1, y1, 26);
    const q = [a0, a1, b1, b0];
    g.cara(q, 'madera', { op: '.5', papel: false, hit: true });
    g.borde(lerp(a0, a1, 0), lerp(a0, a1, 1), r, 'k4', { amp: 0.4 });
    g.seg('d', 'k4', lerp(b0, b1, 0), lerp(b0, b1, 1), r, { amp: 0.3 });
    g.seg('d', 'k4', [lerp(a0, a1, 0)[0], lerp(a0, a1, 0)[1] - 8], [lerp(a0, a1, 1)[0], lerp(a0, a1, 1)[1] - 8], r, { amp: 0.3 });
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = lerp(a0, a1, t), b = lerp(b0, b1, t);
      g.tinta('d', 'k4', { d: 'M' + pt([a[0], a[1]]) + 'L' + pt([b[0], b[1] + 2.2]) + 'L' + pt([b[0] + 1.4, b[1] - 1.6]) + 'L' + pt([b[0] + 2.8, b[1] + 2.2]) + 'L' + pt([a[0] + 2.8, a[1]]), len: 34 });
    }
  };
  tramo(440, 152, 440, 358);
  tramo(150, 152, 305, 152);
}

// ====================================================================
// 3. CÉSPED, camino de losas y casita infantil
// ====================================================================
function cesped() {
  const r = RND('cesped'); const g = G('cesped', 'cesped');
  const x0 = 440, x1 = 792, y0 = 112, y1 = 426;
  const cp = suelo(x0, x1, y0, y1);
  g.cara(cp, 'prado');
  // bordillo de granito
  g.borde(P(x0, y1), P(x1, y1), r, 'k3', { ov: 0, amp: 0.8 });
  g.borde(P(x1, y0), P(x1, y1), r, 'k3', { ov: 0, amp: 0.8 });
  g.borde(P(x0, y0), P(x1, y0), r, 'k3', { ov: 0, amp: 0.8 });
  g.borde(P(x0, y0), P(x0, y1), r, 'k3', { ov: 0, amp: 0.8 });
  // matas de hierba
  for (let i = 0; i < 250; i++) {
    const p = P(r.f(x0 + 5, x1 - 5), r.f(y0 + 5, y1 - 5)); const l = r.f(2.4, 4.6);
    raya(g, 's', 'k6', [p[0] - 2, p[1]], [p[0] - 2.9 + r.f(-0.4, 0.4), p[1] - l]);
    raya(g, 's', 'k6', [p[0], p[1]], [p[0] + r.f(-0.5, 0.5), p[1] - l - 1.4]);
    raya(g, 's', 'k6', [p[0] + 2, p[1]], [p[0] + 3 + r.f(-0.4, 0.4), p[1] - l]);
  }
  // camino de losas del cenador a la casa
  g.nueva();
  const cx0 = 592, cx1 = 650;
  let y = y0 + 8;
  while (y < y1 - 4) {
    const dy = r.f(20, 32); const ye = Math.min(y1 - 1, y + dy);
    const n = r.i(2, 3); let x = cx0;
    for (let i = 0; i < n; i++) {
      const w = (cx1 - cx0) / n; const xe = i === n - 1 ? cx1 : x + w * r.f(0.8, 1.2);
      const j = () => r.f(-2.6, 2.6);
      const ps = [P(x + 1.5 + j() * 0.3, y + 1 + j() * 0.3), P(xe - 1.5 + j(), y + 1 + j() * 0.3), P(xe - 1 + j() * 0.3, ye - 1 + j()), P(x + 1 + j(), ye - 1.5 + j() * 0.3)];
      if (r.p(0.4)) ps.splice(2, 0, lerp(ps[1], ps[2], 0.5).map((q, ii) => q + (ii ? r.f(-1.5, 0) : r.f(0, 2.4))));
      g.cara(ps, 'losa', { hit: false });
      g.contorno(pline(ps, r, { amp: 0.7, cerrar: true }), 'k4');
      if (r.p(0.45)) for (const [a, b] of hatchPoly(ps, -0.9, 3.3, r, { jit: 1.2, skip: 0.2 })) raya(g, 'p', 'k6', a, b);
      x = xe;
    }
    y = ye;
  }
  // bordillo del camino: dos filetes
  g.seg('p', 'k4', P(cx0 - 3, y0 + 4), P(cx0 - 3, y1), r, { amp: 1 });
  g.seg('p', 'k4', P(cx1 + 3, y0 + 4), P(cx1 + 3, y1), r, { amp: 1 });
}
function casita() {
  const r = RND('casita'); const g = G('casita-infantil', 'cesped');
  const x0 = 738, x1 = 778, y0 = 200, y1 = 226, h = 22, H = 36;
  const T = tejadoGeom({ x0, x1, y0, y1, h, H, ov: 3, ovx: 3 });
  g.nueva();
  const li = [P(x0, y0, 0), P(x0, y1, 0), P(x0, y1, h), P(x0, (y0 + y1) / 2, H), P(x0, y0, h)];
  g.cara(li, 'amarillo'); g.poli(li, r, 'k3', { ov: 0.8, amp: 0.3 });
  g.nueva();
  const ff = frente(x0, y0);
  g.cara(quad(ff, 0, x1 - x0, 0, h), 'azul');
  g.poli(quad(ff, 0, x1 - x0, 0, h), r, 'k2', { ov: 1, amp: 0.3 });
  const v = quad(ff, 6, 18, 6, 17); g.cara(v, 'rojo', { hit: false }); g.poli(v, r, 'k4', { ov: 0.5, amp: 0.2 });
  const pu = quad(ff, 25, 34, 0, 15); g.cara(pu, 'rojo', { hit: false }); g.poli(pu, r, 'k4', { ov: 0.5, amp: 0.2 });
  g.nueva();
  g.cara([T.A, T.B, T.C, T.D], 'rojo');
  g.poli([T.A, T.B, T.C, T.D], r, 'k2', { ov: 0.8, amp: 0.3 });
  for (let i = 1; i < 5; i++) raya(g, 'd', 'k6', lerp(T.A, T.B, i / 5), lerp(T.D, T.C, i / 5));
}

// ====================================================================
// 4. LA CASA (almagre y piedra)
// ====================================================================
function casa() {
  const r = RND('casa'); const g = G('casa', 'casa');
  const x0 = 530, x1 = 926, y0 = 430, y1 = 550, h = 190, hp = 98, H = 226, W = x1 - x0;
  const T = tejadoGeom({ x0, x1, y0, y1, h, H, ov: 14, ovx: 10 });
  const ff = frente(x0, y0);
  if (T.atras) faldonTrasero(g, r, T);
  caraIzq(g, r, { x0, y0, y1, h, H, mamp: { rh: [10, 15], sw: [22, 44], sombra: 0.2 } });

  // pared de fachada
  g.nueva();
  g.cara(quad(ff, 0, W, 0, hp), 'piedra');
  g.cara(quad(ff, 20, W, hp, h), 'almagre');
  g.cara(quad(ff, 0, 20, hp, h), 'piedra');
  const huecos = [[22, 66, -1, 74], [132, 202, 34, 90], [276, 360, 34, 86], [388, 420, 0, 80]];
  mamposteria(g, ff, W, hp, r, { rh: [10, 15], sw: [24, 46], sombra: 0.2, huecos });
  mamposteria(g, (u, v) => ff(u, hp + v), 20, h - hp, r, { rh: [10, 15], sw: [20, 30], sombra: 0.2 });
  moteado(g, ff, 22, W - 2, hp + 4, h - 16, r, 60);
  // sombra bajo el alero
  sombrear(g, quad(ff, 20, W, h - 15, h), r, { ang: -0.85, sp: 2.8, skip: 0.04 });
  // vigas entre plantas
  viga(g, ff, 130, 204, hp - 3, hp + 3, r); viga(g, ff, 254, 388, hp - 3, hp + 3, r);
  g.seg('d', 'k3', ff(20, hp), ff(130, hp), r, { amp: 0.4 }); g.seg('d', 'k3', ff(204, hp), ff(254, hp), r, { amp: 0.4 });
  // ventanas de la planta alta
  ventana(g, ff, 76, 120, 116, 158, r, { m: 4, mont: 1 });
  ventana(g, ff, 192, 216, 112, 160, r, { m: 3.4, mont: 0 });
  ventana(g, ff, 304, 348, 116, 158, r, { m: 4, mont: 1 });
  // planta baja: puerta, dos ventanas
  puerta(g, ff, 26, 62, 0, 70, r);
  ventana(g, ff, 139, 195, 38, 84, r, { m: 4, mont: 1 });
  ventana(g, ff, 281, 355, 38, 80, r, { m: 4, mont: 2 });
  // columna de piedra clara (esquinero) a la izquierda y portón de madera a la derecha
  esquinero(g, ff, 0, 18, 0, h, r, { color: 'granito', bloque: 15 });
  const por = quad(ff, 380, 396, 0, 76); g.cara(por, 'madera', { hit: false }); g.poli(por, r, 'k3', { ov: 0.8, amp: 0.3 }); tablas(g, ff, 381, 395, 0, 76, r, { sp: 3.6 });
  // zócalo y líneas de pie
  g.borde(P(x0, y0, 0), P(x1, y0, 0), r, 'k1');
  g.borde(P(x0, y0, 0), P(x0, y0, h), r, 'k1');
  g.borde(P(x1, y0, 0), P(x1, y0, h), r, 'k1');

  // patio de losa delante de las ventanas + mesa y sillas
  g.nueva();
  const pat = [P(x0 + 190, y0 - 34), P(x0 + 292, y0 - 34), P(x0 + 292, y0), P(x0 + 190, y0)];
  g.cara(pat, 'losa', { hit: true });
  g.poli(pat, r, 'k3', { ov: 0.5, amp: 0.8 });
  for (let i = 0; i < 12; i++) { const a = lerp(pat[0], pat[1], r.f(0.05, 0.95)), b = [a[0] + r.f(-9, 9), a[1] + r.f(6, 23)]; raya(g, 'p', 'k6', a, [Math.max(pat[0][0], b[0]), Math.min(pat[3][1] - 1, b[1])]); }
  const mesa = P(x0 + 242, y0 - 17, 18);
  g.contorno(pline(Array.from({ length: 16 }, (_, i) => [mesa[0] + Math.cos((i / 16) * 6.283) * 11, mesa[1] + Math.sin((i / 16) * 6.283) * 4.6]), r, { amp: 0.3, cerrar: true }), 'k3');
  raya(g, 'd', 'k4', P(x0 + 242, y0 - 17, 18), P(x0 + 242, y0 - 17, 0));
  for (const [dx, dy] of [[-17, 4], [17, 3], [-6, -14]]) { const s = P(x0 + 242 + dx, y0 - 17 + dy, 11); raya(g, 'd', 'k4', [s[0] - 5, s[1]], [s[0] + 5, s[1]]); raya(g, 'd', 'k5', s, [s[0] + (dx < 0 ? -2 : 2), s[1] - 9]); raya(g, 'd', 'k5', s, P(x0 + 242 + dx, y0 - 17 + dy, 0)); }

  // tejado de teja curva
  faldonFrontal(g, r, T);
  // canalón de cobre junto al esquinero (en la foto baja por la esquina izquierda)
}

// ====================================================================
// 5. EL EDIFICIO DE LA SOLAINA (apartamentos 1 y 2)
// ====================================================================
function solaina() {
  const r = RND('solaina');
  const x0 = 330, x1 = 510, y0 = 445, y1 = 545, h = 198, H = 236, hb = 94, W = x1 - x0, yb = 431, ov = 18, ovx = 10;
  const T = tejadoGeom({ x0, x1, y0, y1, h, H, ov, ovx });
  const ff = frente(x0, y0), ym = (y0 + y1) / 2;

  // --- apto 2 (detrás): faldón trasero, cara izquierda de arriba y fondo de la galería
  const g2 = G('apto2-fondo', 'apto2');
  if (T.atras) faldonTrasero(g2, r, T);
  g2.nueva();
  const li = [P(x0, y0, hb), P(x0, y1, hb), P(x0, y1, h), P(x0, ym, H), P(x0, y0, h)];
  g2.cara(li, 'piedra');
  const fl = izq(x0, y0);
  mamposteria(g2, (u, v) => fl(u, hb + v), y1 - y0, h - hb, r, { rh: [10, 14], sw: [22, 40], sombra: 0.22, huecos: [[34, 56, 22, 52]] });
  { const alto = H - h; let v = 0; while (v < alto - 4) { const w = (y1 - y0) * (1 - (v + 6) / alto); const u0 = ((y1 - y0) - w) / 2; raya(g2, 'p', 'k5', fl(u0 + r.f(0, 4), h + v), fl(u0 + w - r.f(0, 4), h + v)); v += r.f(9, 13); } }
  sombrear(g2, li, r, { ang: -0.78, sp: 3.7, skip: 0.14, jit: 2.2 });
  ventana(g2, fl, 34, 56, hb + 22, hb + 52, r, { m: 3.4, mont: 1, capa: true });
  g2.borde(P(x0, y0, hb), P(x0, y1, hb), r, 'k3'); g2.borde(P(x0, y1, hb), P(x0, y1, h), r, 'k2');
  g2.borde(P(x0, y1, h), P(x0, ym, H), r, 'k2'); g2.borde(P(x0, ym, H), P(x0, y0, h), r, 'k2');
  // fondo de la galería (retranqueado)
  g2.nueva();
  const yg = 463, fg = frente(x0, yg);
  const fondo = quad(fg, 0, W, hb + 8, h);
  g2.cara(fondo, 'piedra');
  mamposteria(g2, (u, v) => fg(u, hb + 8 + v), W, h - hb - 8, r, { rh: [10, 14], sw: [22, 40], sombra: 0.2, huecos: [[28, 64, -1, 52], [104, 150, 14, 48]] });
  puerta(g2, fg, 32, 60, hb + 8, hb + 8 + 52, r, { vidrio: 0.35 });
  ventana(g2, fg, 108, 146, hb + 22, hb + 52, r, { m: 3, mont: 1 });
  sombrear(g2, quad(fg, 0, W, h - 26, h), r, { ang: -0.8, sp: 2.6, skip: 0.02 });

  // --- apto 1 (planta baja)
  const g1 = G('apto1', 'apto1');
  g1.nueva();
  const li1 = [P(x0, y0, 0), P(x0, y1, 0), P(x0, y1, hb), P(x0, y0, hb)];
  g1.cara(li1, 'piedra');
  mamposteria(g1, fl, y1 - y0, hb, r, { rh: [10, 14], sw: [22, 40], sombra: 0.22, huecos: [[44, 66, 24, 56]] });
  sombrear(g1, li1, r, { ang: -0.78, sp: 3.7, skip: 0.14, jit: 2.2 });
  ventana(g1, fl, 44, 66, 24, 56, r, { m: 3.4, mont: 1, capa: true });
  g1.borde(P(x0, y0, 0), P(x0, y1, 0), r, 'k2'); g1.borde(P(x0, y1, 0), P(x0, y1, hb), r, 'k2'); g1.borde(P(x0, y0, hb), P(x0, y0, 0), r, 'k1');
  g1.nueva();
  g1.cara(quad(ff, 0, W, 0, hb), 'piedra');
  const hu1 = [[18, 72, -1, 78], [92, 126, 28, 62]];
  mamposteria(g1, ff, W, hb, r, { rh: [10, 15], sw: [24, 46], sombra: 0.22, huecos: hu1 });
  sombrear(g1, quad(ff, 0, W, hb - 20, hb), r, { ang: -0.8, sp: 2.6, skip: 0.02 });
  // doble puerta de madera con visillos blancos (como en la foto de la solaina)
  const dp = quad(ff, 22, 68, 0, 74); g1.cara(dp, 'madera', { hit: false }); g1.poli(dp, r, 'k2', { ov: 1.2, amp: 0.4 });
  g1.seg('d', 'k3', ff(45, 0), ff(45, 74), r, { amp: 0.3 });
  tablas(g1, ff, 24, 66, 0, 40, r, { sp: 4.4 });
  for (const [a, b] of [[25, 43], [47, 65]]) { const v = quad(ff, a, b, 42, 70); g1.cara(v, 'cal', { hit: false }); g1.poli(v, r, 'k4', { ov: 0.5, amp: 0.3 }); for (let q = 0; q < 6; q++) raya(g1, 'd', 'k6', ff(a + 2 + q * ((b - a - 4) / 5), 44), ff(a + 2 + q * ((b - a - 4) / 5) + r.f(-0.4, 0.4), 68)); }
  const dint = quad(ff, 14, 76, 74, 82); g1.cara(dint, 'granito', { hit: false }); g1.poli(dint, r, 'k3', { ov: 0.8, amp: 0.4 });
  ventana(g1, ff, 96, 124, 30, 60, r, { m: 3.2, mont: 1 });
  esquinero(g1, ff, 0, 12, 0, hb, r, { color: 'granito', bloque: 14 });
  g1.borde(P(x0, y0, 0), P(x1, y0, 0), r, 'k1'); g1.borde(P(x0, y0, 0), P(x0, y0, hb), r, 'k1'); g1.borde(P(x1, y0, 0), P(x1, y0, hb), r, 'k2');

  // --- apto 2 (delante): viga, pies derechos, barandilla, tejado y escalera
  const g3 = G('apto2-galeria', 'apto2');
  g3.nueva();
  // la viga que vuela sobre la planta baja
  const fb = frente(x0, yb);
  const vtop = [P(x0 - 6, yb, hb + 9), P(x1 + 6, yb, hb + 9), P(x1 + 6, y0, hb + 9), P(x0 - 6, y0, hb + 9)];
  g3.cara(vtop, 'madera', { hit: true });
  g3.poli(vtop, r, 'k3', { ov: 0.8, amp: 0.4 });
  const vfr = quad(fb, -6, W + 6, hb - 3, hb + 9);
  g3.cara(vfr, 'madera'); g3.poli(vfr, r, 'k2', { ov: 1.8, amp: 0.5 });
  for (let i = 0; i < 3; i++) raya(g3, 'd', 'k6', fb(-4 + r.f(0, 14), hb - 3 + 3 * (i + 1)), fb(W + 4 - r.f(0, 14), hb - 3 + 3 * (i + 1) + r.f(-0.4, 0.4)));
  // cabeza de la viga (negra) en la cara izquierda
  const cab = [P(x0 - 6, yb, hb - 3), P(x0 - 6, y0 + 3, hb - 3), P(x0 - 6, y0 + 3, hb + 9), P(x0 - 6, yb, hb + 9)];
  g3.cara(cab, 'hierro', { hit: false }); g3.poli(cab, r, 'k3', { ov: 0.6, amp: 0.3 });
  for (const [a, b] of hatchPoly(cab, -0.8, 1.8, r, { jit: 0.3 })) raya(g3, 'h', 'k5', a, b);
  // tornapuntas de madera sobre la piedra
  for (const u of [28, 150]) { g3.seg('d', 'k3', fb(u, hb - 3), fb(u + 14, hb - 20), r, { amp: 0.3 }); g3.seg('d', 'k3', fb(u + 6, hb - 3), fb(u + 20, hb - 20), r, { amp: 0.3 }); }
  // pies derechos
  g3.nueva();
  const postes = [3, 62, 120, 176];
  const rj = (zi, zs) => { for (let i = 0; i < postes.length - 1; i++) { const ua = postes[i] + 3.6, ub = postes[i + 1] - 3.6; const q = quad(fb, ua, ub, zi, zi + 3.6); g3.cara(q, 'madera', { hit: false }); g3.poli(q, r, 'k4', { ov: 0.5, amp: 0.2 }); } };
  // barandilla: balaustres entre rieles
  for (let i = 0; i < postes.length - 1; i++) {
    const ua = postes[i] + 3.6, ub = postes[i + 1] - 3.6;
    for (let u = ua + 2; u < ub - 1; u += 5.4) raya(g3, 'd', 'k5', fb(u, hb + 12), fb(u + r.f(-0.3, 0.3), hb + 40));
  }
  rj(hb + 12, 0); rj(hb + 38, 0);
  for (const u of postes) {
    const q = quad(fb, u - 3.4, u + 3.4, hb + 9, h - 6);
    g3.cara(q, 'madera'); g3.poli(q, r, 'k2', { ov: 1.4, amp: 0.4 });
    raya(g3, 'd', 'k6', fb(u - 0.8, hb + 14), fb(u - 0.6, h - 14));
    raya(g3, 'd', 'k6', fb(u + 1.4, hb + 20), fb(u + 1.2, h - 22));
  }
  // jardineras con flores
  for (const u of [34, 92, 148]) {
    const cj = quad(fb, u - 9, u + 9, hb + 40, hb + 49); g3.cara(cj, 'hierro', { hit: false }); g3.poli(cj, r, 'k4', { ov: 0.5, amp: 0.2 });
    for (let k = 0; k < 4; k++) { const p = fb(u - 7 + k * 4.6, hb + 52); g3.tinta('s', 'k5', { d: 'M' + pt([p[0] - 2.6, p[1] + 2]) + 'q2.6 -5 5.2 0q-2.6 5 -5.2 0', len: 14 }); }
  }
  // tejado
  const gf = G('apto2-tejado', 'apto2');
  faldonFrontal(gf, r, T);
  // la escalera de hierro: del patio al extremo de la galería
  const ge = G('apto2-escalera', 'apto2');
  ge.nueva();
  const ya = 421, S0 = P(432, ya, 0), S1 = P(526, ya, hb + 4);
  const nt = 11;
  for (let i = 0; i <= nt; i++) {
    const p = lerp(S0, S1, i / nt);
    raya(ge, 'd', 'k3', [p[0] - 3, p[1]], [p[0] + 9, p[1]]);
  }
  ge.seg('d', 'k2', S0, S1, r, { amp: 0.4, ov: 1 });
  ge.seg('d', 'k2', [S0[0] + 3, S0[1] + 6], [S1[0] + 3, S1[1] + 6], r, { amp: 0.4 });
  // pasamanos y balaustres
  const hs0 = [S0[0] + 8, S0[1] - 30], hs1 = [S1[0] + 8, S1[1] - 30];
  ge.seg('d', 'k3', hs0, hs1, r, { amp: 0.4, ov: 1.4 });
  for (let i = 0; i <= nt * 2; i++) { const p = lerp(S0, S1, i / (nt * 2)), q = lerp(hs0, hs1, i / (nt * 2)); raya(ge, 'd', 'k6', [p[0] + 8, p[1]], q); }
  ge.seg('d', 'k3', hs0, [hs0[0], S0[1]], r, { amp: 0.2 });
  ge.seg('d', 'k3', hs1, [hs1[0], S1[1]], r, { amp: 0.2 });
}

// ====================================================================
// 6. EDIFICIO DE PIEDRA JUNTO AL CENADOR, BARBACOA
// ====================================================================
function edificioPiedra() {
  const r = RND('piedra-oeste'); const g = G('edificio-piedra', null, {});
  const x0 = 810, x1 = 990, y0 = 34, y1 = 150, h = 64, H = 98;
  const T = tejadoGeom({ x0, x1, y0, y1, h, H, ov: 12, ovx: 8 });
  if (T.atras) faldonTrasero(g, r, T);
  caraIzq(g, r, { x0, y0, y1, h, H, mamp: { rh: [10, 14], sw: [22, 42], sombra: 0.2, huecos: [[44, 64, 22, 46]] } });
  ventana(g, izq(x0, y0), 44, 64, 22, 46, r, { m: 3, mont: 1, capa: true });
  g.nueva();
  const ff = frente(x0, y0), W = x1 - x0;
  g.cara(quad(ff, 0, W, 0, h), 'piedra');
  const hu = [[24, 40, 30, 48], [96, 128, -1, 52]];
  mamposteria(g, ff, W, h, r, { rh: [10, 14], sw: [22, 44], sombra: 0.22, huecos: hu });
  ventana(g, ff, 26, 38, 32, 46, r, { m: 2.6, mont: 0 });
  const po = quad(ff, 98, 126, 0, 50); g.cara(po, 'madera', { hit: false }); g.poli(po, r, 'k2', { ov: 1, amp: 0.4 }); tablas(g, ff, 100, 124, 0, 50, r, { sp: 4 });
  esquinero(g, ff, 0, 11, 0, h, r, { color: 'granito', bloque: 13 });
  g.borde(P(x0, y0, 0), P(x1, y0, 0), r, 'k1'); g.borde(P(x0, y0, 0), P(x0, y0, h), r, 'k1'); g.borde(P(x1, y0, 0), P(x1, y0, h), r, 'k2');
  faldonFrontal(g, r, T);
  // chimenea
  g.nueva();
  const cb = P(x0 + 140, T.ym, H - 6), cf = [P(x0 + 134, y0 + 70, H - 6), P(x0 + 148, y0 + 70, H - 6), P(x0 + 148, y0 + 70, H + 22), P(x0 + 134, y0 + 70, H + 22)];
  g.cara(cf, 'piedra', { hit: false }); g.poli(cf, r, 'k3', { ov: 0.8, amp: 0.3 });
}
function barbacoa() {
  const r = RND('barbacoa'); const g = G('barbacoa', 'cenador');
  g.nueva();
  const x0 = 790, x1 = 850, y0 = 168, y1 = 204;
  // parrilla negra de gas
  const parr = [P(x0 + 6, y0 + 4, 0), P(x0 + 34, y0 + 4, 0), P(x0 + 34, y0 + 4, 26), P(x0 + 6, y0 + 4, 26)];
  g.cara(parr, 'hierro'); g.poli(parr, r, 'k2', { ov: 0.8, amp: 0.3 });
  for (const [a, b] of hatchPoly(parr, -0.9, 2.2, r, { jit: 0.5 })) raya(g, 'h', 'k6', a, b);
  const tp = [P(x0 + 6, y0 + 4, 26), P(x0 + 34, y0 + 4, 26), P(x0 + 34, y0 + 22, 26), P(x0 + 6, y0 + 22, 26)];
  g.cara(tp, 'hierro'); g.poli(tp, r, 'k3', { ov: 0.6, amp: 0.3 });
  // techadillo oscuro sobre cuatro pies de hierro
  g.nueva();
  const pies = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  for (const [px, py] of pies) raya(g, 'd', 'k3', P(px, py, 0), P(px, py, 52));
  const techo = [P(x0 - 4, y0 - 4, 52), P(x1 + 4, y0 - 4, 52), P(x1 + 4, y1 + 4, 58), P(x0 - 4, y1 + 4, 58)];
  g.cara(techo, 'hierro'); g.poli(techo, r, 'k2', { ov: 1, amp: 0.4 });
  for (const [a, b] of hatchPoly(techo, -1.0, 2.8, r, { jit: 0.6, skip: 0.1 })) raya(g, 'h', 'k6', a, b);
}

// ====================================================================
// 7. EL CENADOR (visto por detrás: el pórtico y las columnas dan al césped)
// ====================================================================
function cenador() {
  const r = RND('cenador'); const g = G('cenador', 'cenador');
  const x0 = 470, x1 = 760, y0 = -20, y1 = 110, h = 86, H = 124, W = x1 - x0;
  const T = tejadoGeom({ x0, x1, y0, y1, h, H, ov: 16, ovx: 14 });
  // faldón del lado del césped, con las placas solares
  g.nueva();
  g.cara([T.D, T.C, T.F, T.E], 'teja');
  tejas(g, T.E, T.F, T.C, T.D, r, { sp: 9 });
  g.borde(T.E, T.F, r, 'k2'); g.borde(T.D, T.E, r, 'k2'); g.borde(T.C, T.F, r, 'k2');
  g.nueva();
  const pp = (t, s) => lerp(lerp(T.D, T.E, s), lerp(T.C, T.F, s), t);
  for (let i = 0; i < 6; i++) {
    const t0 = 0.16 + i * 0.125, t1 = t0 + 0.108;
    const q = [pp(t0, 0.05), pp(t1, 0.05), pp(t1, 0.7), pp(t0, 0.7)];
    g.cara(q, 'panel');
    g.poli(q, r, 'k3', { ov: 0.6, amp: 0.3 });
    for (let k = 1; k < 4; k++) raya(g, 'd', 'k6', lerp(q[0], q[1], k / 4), lerp(q[3], q[2], k / 4));
    for (const [a, b] of hatchPoly(q, -0.5, 2.6, r, { jit: 0.3, skip: 0.25 })) raya(g, 'h', 'k6', a, b);
  }
  // cara izquierda (el extremo del este): pared de almagre con su esquinero de granito
  g.nueva();
  const ym = (y0 + y1) / 2, fl = izq(x0, y0);
  const li = [P(x0, y0, 0), P(x0, y1, 0), P(x0, y1, h), P(x0, ym, H), P(x0, y0, h)];
  g.cara(li, 'almagre');
  moteado(g, fl, 4, y1 - y0 - 2, 4, h - 14, r, 36);
  sombrear(g, [P(x0, y0, h - 12), P(x0, y1, h - 12), P(x0, y1, h), P(x0, y0, h)], r, { ang: -0.85, sp: 2.8 });
  g.borde(P(x0, y0, 0), P(x0, y1, 0), r, 'k2'); g.borde(P(x0, y1, 0), P(x0, y1, h), r, 'k2');
  g.borde(P(x0, y1, h), P(x0, ym, H), r, 'k2'); g.borde(P(x0, ym, H), P(x0, y0, h), r, 'k2');
  // pared del norte (la que se ve): almagre con columnas de granito en las esquinas
  g.nueva();
  const ff = frente(x0, y0);
  g.cara(quad(ff, 0, W, 0, h), 'almagre');
  moteado(g, ff, 18, W - 18, 4, h - 14, r, 70);
  sombrear(g, quad(ff, 16, W - 16, h - 13, h), r, { ang: -0.85, sp: 2.8, skip: 0.04 });
  // dintel y zócalo
  g.seg('d', 'k3', ff(16, h - 8), ff(W - 16, h - 8), r, { amp: 0.5 });
  g.seg('d', 'k4', ff(16, 7), ff(W - 16, 7), r, { amp: 0.5 });
  esquinero(g, ff, 0, 17, 0, h, r, { color: 'granito', bloque: 12 });
  esquinero(g, ff, W - 17, W, 0, h, r, { color: 'granito', bloque: 12 });
  g.borde(P(x0, y0, 0), P(x1, y0, 0), r, 'k1');
  // tejado: el faldón del norte
  faldonFrontal(g, r, T);
  // los extremos de las placas asoman sobre la cumbrera (se ven desde el norte)
  g.nueva();
  for (let i = 0; i < 6; i++) {
    const t0 = 0.16 + i * 0.125, t1 = t0 + 0.108;
    const a = lerp(T.D, T.C, t0), b = lerp(T.D, T.C, t1);
    const q = [a, b, [b[0], b[1] - 8], [a[0], a[1] - 8]];
    g.cara(q, 'panel', { hit: false });
    g.poli(q, r, 'k3', { ov: 0.5, amp: 0.2 });
  }
  // la chimenea de la barbacoa
  const ch = quad(frente(x0 + 22, 46), 0, 11, H - 4, H + 34);
  g.cara(ch, 'hierro', { hit: false }); g.poli(ch, r, 'k3', { ov: 0.8, amp: 0.2 });
  const tapa = quad(frente(x0 + 20, 46), 0, 15, H + 34, H + 40);
  g.cara(tapa, 'hierro', { hit: false }); g.poli(tapa, r, 'k3', { ov: 0.8, amp: 0.2 });
}

// ====================================================================
// 8. SOMBRAS EN EL SUELO
// ====================================================================
function sombras() {
  const r = RND('sombras'); const g = G('sombras', null, { clase: 'sombra' });
  // la luz viene del oeste (derecha del dibujo): las sombras caen hacia la izquierda y un poco al fondo
  const sh = (x0, y0, y1, h, f = 0.5) => {
    const q = [P(x0, y0), P(x0 - h * f, y0 + h * 0.2), P(x0 - h * f, y1 + h * 0.2), P(x0, y1)];
    for (const [a, b] of hatchPoly(q, -0.7, 3.4, r, { jit: 1.4, skip: 0.1 })) raya(g, 'h', 'k6', a, b);
  };
  sh(810, 34, 150, 64, 0.8);
  sh(470, -20, 110, 86, 0.7);
  sh(330, 445, 545, 100, 0.4);
}

// ====================================================================
// 9. RÓTULOS (a mano, en Overpass Mono) y salida
// ====================================================================
const VB = [150, 160, 1240, 700];
// zona, texto, ancla en el edificio (coordenadas del dibujo), punto donde acaba la línea, lado del texto
const ROTULOS = [
  { z: 'casa', t: 'La casa', a: [1055, 375], p: [1130, 330], s: 'start' },
  { z: 'apto2', t: 'Apartamento 2', a: [488, 386], p: [355, 330], s: 'end' },
  { z: 'apto1', t: 'Apartamento 1', a: [528, 460], p: [330, 530], s: 'end' },
  { z: 'piscina', t: 'Piscina', a: [470, 640], p: [395, 700], s: 'end' },
  { z: 'cenador', t: 'Cenador y barbacoa', a: [950, 800], p: [950, 842], s: 'middle' },
  { z: 'cesped', t: 'Césped y casita infantil', a: [995, 615], p: [1040, 555], s: 'start' },
  { z: 'sala', t: 'Sala de juegos', p: [180, 780], s: 'start', sin: 'sin ubicar en el dibujo' },
];
const FIJOS = [
  { t: 'prados y bosque', p: [210, 420], s: 'start' },
  { t: 'Pepín', p: [470, 215], s: 'start' },
];
const ZC = { casa: 'almagre', apto1: 'piedra', apto2: 'madera', piscina: 'agua', cenador: 'almagre', cesped: 'prado' };

function rotulos() {
  const r = RND('rotulos'); let s = '';
  for (const l of ROTULOS) {
    const [px, py] = l.p;
    const tx = px + (l.s === 'start' ? 6 : l.s === 'end' ? -6 : 0);
    if (!l.a) { s += `<g class="rot sin" data-zona="${l.z}"><text class="rt" x="${tx}" y="${py + 4}" text-anchor="${l.s}">${l.t}</text><text class="rt peq" x="${tx}" y="${py + 27}" text-anchor="${l.s}">${l.sin}</text></g>`; continue; }
    const [ax, ay] = l.a;
    const d = pen([ax, ay], [px, py], r, { amp: 1.4, seg: 40 });
    s += `<g class="rot" data-zona="${l.z}"><path class="ll" d="${mini(d.d)}"/><circle class="pt" cx="${ax}" cy="${ay}" r="2.6"/><text class="rt" x="${tx}" y="${py + 4}" text-anchor="${l.s}">${l.t}</text></g>`;
  }
  for (const l of FIJOS) s += `<text class="rt fijo" x="${l.p[0]}" y="${l.p[1]}" text-anchor="${l.s}">${l.t}</text>`;
  return s;
}

function ensamblar() {
  prado(); bosque(); vecinas(); calles(); huerta();
  piscina(); cesped(); vallaPiscina(); sombras();
  casa(); solaina(); edificioPiedra(); barbacoa(); casita(); arbolesCerca(); cenador();
  let defs = '', fondo = '', cuerpo = '', n = 0;
  for (const g of items) {
    const s = g.svg();
    if (!g.zona) { if (g.clase === 'ten') fondo += `<g class="pieza ten">${s}</g>`; else cuerpo += `<g class="pieza${g.clase ? ' ' + g.clase : ''}">${s}</g>`; continue; }
    // rayado de la zona: líneas en diagonal recortadas a sus caras; avanzan al tocarla
    const xs = g.hit.flat().map((p) => p[0]), ys = g.hit.flat().map((p) => p[1]);
    const bb = [[Math.min(...xs) - 4, Math.min(...ys) - 4], [Math.max(...xs) + 4, Math.min(...ys) - 4], [Math.max(...xs) + 4, Math.max(...ys) + 4], [Math.min(...xs) - 4, Math.max(...ys) + 4]];
    let hd = '', hm = 0;
    for (const [a, b] of hatchPoly(bb, -0.62, 7, null)) { hd += 'M' + pt(a) + 'L' + pt(b); hm = Math.max(hm, dist(a, b)); }
    const id = 'cp' + n++;
    const hit = g.hit.map((p) => 'M' + p.map(pt).join('L') + 'Z').join('');
    defs += `<clipPath id="${id}"><path d="${mini(hit)}"/></clipPath>`;
    cuerpo += `<g class="zona" data-zona="${g.zona}">${s}<path class="hz c-${ZC[g.zona]}" clip-path="url(#${id})" style="--l:${Math.ceil(hm + 2)}" d="${mini(hd)}"/><path class="hit" d="${mini(hit)}"/></g>`;
  }
  return { defs, fondo, cuerpo };
}

import { mini } from './plano-lib.mjs';
const { defs, fondo, cuerpo } = ensamblar();
const cx = VB[0] + VB[2] / 2, cy = VB[1] + VB[3] / 2;
const mascara = `<radialGradient id="pl-g" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${VB[2] / 2}" gradientTransform="translate(${cx} ${cy}) scale(1 ${f1(VB[3] / VB[2])}) translate(${-cx} ${-cy})"><stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient><mask id="pl-m" maskUnits="userSpaceOnUse" x="${VB[0]}" y="${VB[1]}" width="${VB[2]}" height="${VB[3]}"><rect x="${VB[0]}" y="${VB[1]}" width="${VB[2]}" height="${VB[3]}" fill="url(#pl-g)"/></mask>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB.join(' ')}" class="plano-svg" focusable="false" aria-hidden="true"><defs>${defs}${mascara}</defs><g mask="url(#pl-m)">${fondo}</g>${cuerpo}${rotulos()}</svg>\n`;
fs.mkdirSync(SALIDA, { recursive: true });
fs.writeFileSync(new URL('plano.svg', SALIDA), svg);
// Versión suelta y quieta (se puede usar en <img>, p. ej. como respaldo sin JavaScript): coloreada, sin zonas ni rayado
const estilo = `<style>.pf{fill:#F4EFE6}.t{fill:none;stroke:#1F1A17;stroke-linecap:round;stroke-linejoin:round}.k1{stroke-width:2.8}.k2{stroke-width:2.1}.k3{stroke-width:1.55}.k4{stroke-width:1.25}.k5{stroke-width:1.02}.k6{stroke-width:.86}.ten .t{stroke:#4E4540;opacity:.72}.sombra .t{opacity:.5}.cf{fill-opacity:.78;stroke:none}.pieza.ten .cf,.pieza.sombra .cf{display:none}.pieza:not(.ten):not(.sombra) .cf{fill-opacity:.4}.pieza.ten .c-follaje{display:inline;fill-opacity:.32}.hz,.hit{display:none}.c-almagre{fill:#A3302C}.c-teja{fill:#B4623E}.c-piedra{fill:#A18B67}.c-granito{fill:#CFC5B0}.c-madera{fill:#8A5A3B}.c-prado{fill:#5E7A3A}.c-agua{fill:#5FA7A8}.c-terraza{fill:#B9755C}.c-hierro{fill:#3B3532}.c-losa{fill:#A39687}.c-azul{fill:#3F63A3}.c-amarillo{fill:#E2B43A}.c-rojo{fill:#C2392F}.c-panel{fill:#2C4360}.c-cristal{fill:#54636C}.c-tumbona{fill:#D8B24C}.c-cal{fill:#EEE7D6}.c-follaje{fill:#6B8442}.c-asfalto{fill:#B9B0A2}.rt{font:19px 'Overpass Mono',ui-monospace,monospace;fill:#1F1A17;paint-order:stroke;stroke:#F4EFE6;stroke-width:6px;stroke-linejoin:round}.rt.fijo{font:italic 22px 'Ibarra Real Nova',Georgia,serif;fill:#4E4540}.rt.peq{font-size:14.5px;fill:#4E4540}.ll{fill:none;stroke:#1F1A17;stroke-width:1.1;stroke-linecap:round}.pt{fill:#F4EFE6;stroke:#1F1A17;stroke-width:1.3}</style>`;
const reposo = svg.replace('class="plano-svg"', 'class="plano-svg" role="img" aria-label="Dibujo orientativo de la aldea: la casa, los dos apartamentos, el cenador, la piscina y el césped"').replace(' focusable="false" aria-hidden="true">', '>' + estilo).replace(/<path class="hz[^>]*>/g, '').replace(/<path class="hit"[^>]*>/g, '').replace(/ data-(f|l|zona)="[^"]*"/g, '');
fs.writeFileSync(new URL('plano-reposo.svg', SALIDA), reposo);
console.log('plano.svg', Math.round(svg.length / 1024) + ' KB', 'elementos:', (svg.match(/<path/g) || []).length);
