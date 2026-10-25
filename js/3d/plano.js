// «En plano»: los anillos de la aldea en 2D (sin WebGL). El plano de tinta (img/terreno/plano-base: relieve sombreado y curvas
// de nivel sobre papel) y encima, en SVG, los anillos a pulso y los caminos que se dibujan con el scroll, con una «cámara»
// (el viewBox) que visita los mismos sitios que el 3D. Es el plan B (sin WebGL2, ahorro de datos, ?sin-3d) y el botón «En plano».
// Los rótulos son los mismos que en 3D (guion.js).
import { fase, clamp, suave, PARADAS, SITIOS, parada, trazadoAnillo, anclaAnillo, crearRotulos, listaRotulos, opRotulo } from './guion.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const mezcla = (a, b, k) => a + (b - a) * k;
const rad = Math.PI / 180;

/** caja: el contenedor (.ruta-plano; los rótulos van en su propia capa dentro), base: URL de img/terreno/ */
export function montarPlano(caja, T, { base, movimiento }) {
  const PW = T.plano.w, PH = T.plano.h, L = T.lugares;
  const aP = (x, z) => [(x / T.ancho + .5) * PW, (z / T.alto + .5) * PH];
  const trazo = pts => pts.map((q, i) => { const [x, y] = aP(q[0], q[1]); return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }).join('');
  const largoDe = pts => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };

  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'ruta-plano-svg'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  let html = `<image href="${base}plano-base.webp" x="0" y="0" width="${PW}" height="${PH}" preserveAspectRatio="none"/>`;
  const anillos = T.anillos.map(an => {
    const { a, b } = trazadoAnillo(T, an), la = largoDe(a), lb = largoDe(b);
    html += `<g class="ruta-p-anillo" data-i="${an.i}">` + [a, b].map(h => `<path class="ruta-p-tinta" d="${trazo(h)}" pathLength="1" stroke-dasharray="1 2" stroke-dashoffset="1"/><path class="ruta-p-papel" d="${trazo(h)}" pathLength="1" stroke-dasharray="1 2" stroke-dashoffset="1"/>`).join('') + '</g>';
    return { an, la, lb };
  });
  const rutas = SITIOS.map(k => {
    const R = T.rutas[k], pts = R.x.map((x, i) => [x, R.z[i]]);
    html += `<g class="ruta-p-camino" data-k="${k}"><path class="ruta-p-borde" d="${trazo(pts)}" pathLength="1" stroke-dasharray="1 2" stroke-dashoffset="1"/><path class="ruta-p-via" d="${trazo(pts)}" pathLength="1" stroke-dasharray="1 2" stroke-dashoffset="1"/></g>`;
    return k;
  });
  for (const k of ['aldea', ...SITIOS]) { const [x, y] = aP(...L[k].xz); html += `<circle class="ruta-p-punto ${k === 'aldea' ? 'aldea' : ''}" data-k="${k}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/>`; }
  svg.innerHTML = html;
  // si el navegador no tiene WebP, la imagen JPG
  const img = svg.querySelector('image');
  const prueba = new Image(); prueba.onerror = () => img.setAttribute('href', `${base}plano-base.jpg`); prueba.src = `${base}plano-base.webp`;
  caja.appendChild(svg);
  const capa = document.createElement('div'); capa.className = 'ruta-rotulos'; capa.setAttribute('aria-hidden', 'true'); caja.appendChild(capa);
  const gAn = [...svg.querySelectorAll('.ruta-p-anillo')].map(g => [...g.querySelectorAll('path')]);   // por anillo: tinta A, papel A, tinta B, papel B
  const gRu = [...svg.querySelectorAll('.ruta-p-camino')].map(g => [...g.querySelectorAll('path')]);

  const lista = listaRotulos(T, base);
  const rotulos = crearRotulos(capa, lista);
  const puntos = lista.map(r => {
    if (r.k.startsWith('anillo-')) return aP(...anclaAnillo(T, T.anillos[+r.k.slice(7)]));
    return [L[r.k].uv[0] * PW, L[r.k].uv[1] * PH];
  });
  const angulos = lista.map(r => (L[r.k]?.fuera ? L[r.k].rumbo - 90 : null));

  // ---------- la cámara 2D: centro y ancho visibles (en px del plano) según la parada ----------
  let cw = 0, ch = 0, vb = [0, 0, PW, PH], esc = 1;
  const mPorPx = T.ancho / PW;
  function paradaPlano(k, a) {
    const P = parada(T, k, a);
    if (k === 'vista') return { x: PW / 2, y: PH / 2, w: Math.max(PW * 1.02, PH * 1.04 * a) };   // el plano entero, con papel a los lados si hace falta
    if (k === 'aldea') { const [x, y] = aP(...P.o); return { x, y, w: (a < 1 ? 2300 : 2900) / mPorPx }; }
    const xs = P.ptos.map(q => q[0]), zs = P.ptos.map(q => q[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...zs) - Math.min(...zs);
    const [x, y] = aP(cx, cz);
    return { x, y, w: Math.max(bw * 1.7 + 1500, (bh * 1.7 + 1500) * a, 3200) / mPorPx };
  }
  function camara(F) {
    const a = cw / ch, A = paradaPlano(PARADAS[F.a].k, a), B = paradaPlano(PARADAS[F.b].k, a);
    let x = mezcla(A.x, B.x, F.t), y = mezcla(A.y, B.y, F.t), w = Math.exp(mezcla(Math.log(A.w), Math.log(B.w), F.t));
    let h = w / a;
    if (h > PH * 1.02 && F.est < 4.5) { h = PH * 1.02; w = h * a; }
    // como en 3D: lo importante, a la derecha de la tabla (apaisado) o por encima de ella (vertical)
    const e = cw / w, dx = a >= 1 && cw > 760 ? Math.min(190, cw * .13) : 0, dy = a < 1 || cw <= 760 ? Math.min(120, ch * .14) : 0;
    x -= dx / e * (1 - F.vista); y += dy / e * (1 - F.vista);
    // dentro de la imagen siempre que quepa
    x = w >= PW ? PW / 2 : clamp(x, w / 2, PW - w / 2); y = h >= PH ? PH / 2 : clamp(y, h / 2, PH - h / 2);
    return [x - w / 2, y - h / 2, w, h];
  }
  function medir() { cw = caja.clientWidth; ch = caja.clientHeight; rotulos.medir(); }

  let p = 0, pv = 0, raf = 0, ultimo = 0, activo = false;
  function pintar() {
    if (!cw || !ch) medir();
    if (!cw || !ch) return;
    const F = fase(pv);
    vb = camara(F); esc = cw / vb[2];
    svg.setAttribute('viewBox', vb.map(v => v.toFixed(1)).join(' '));
    svg.style.setProperty('--z', esc.toFixed(3));   // el trazo, del mismo grosor en pantalla a cualquier zoom
    anillos.forEach(({ an, la, lb }, i) => {
      const u = F.anillos[i], d = gAn[i], m = u * Math.max(la, lb);
      const fa = clamp(m / la), fb = clamp(m / lb);
      d[0].setAttribute('stroke-dashoffset', (1 - fa).toFixed(4)); d[1].setAttribute('stroke-dashoffset', (1 - fa).toFixed(4));
      d[2].setAttribute('stroke-dashoffset', (1 - fb).toFixed(4)); d[3].setAttribute('stroke-dashoffset', (1 - fb).toFixed(4));
      d[0].parentNode.style.display = u > .0005 ? '' : 'none';
    });
    gRu.forEach((d, j) => { const u = F.rutas[j]; d.forEach(x => x.setAttribute('stroke-dashoffset', (1 - u).toFixed(4))); d[0].parentNode.style.display = u > .0005 ? '' : 'none'; });
    const compacto = F.vista > .5;
    if (compacto !== caja.classList.contains('rotulos-compactos')) { caja.classList.toggle('rotulos-compactos', compacto); rotulos.medir(); }
    rotulos.colocar(lista.map((r, k) => ({ x: (puntos[k][0] - vb[0]) * esc, y: (puntos[k][1] - vb[1]) * esc, visible: true, op: opRotulo(r.k, F, false), ang: angulos[k] })));
  }
  function cuadro(t) {
    raf = 0;
    if (!activo) return;
    const dt = ultimo ? Math.min(100, t - ultimo) : 16; ultimo = t;
    pv = movimiento ? pv + (p - pv) * (1 - Math.exp(-dt / 110)) : p;
    if (Math.abs(p - pv) < 1e-4) pv = p;
    pintar();
    if (pv !== p) raf = requestAnimationFrame(cuadro); else ultimo = 0;
  }
  const pedir = () => { if (!raf && activo) raf = requestAnimationFrame(cuadro); };
  const ro = new ResizeObserver(() => { const w = caja.clientWidth, h = caja.clientHeight; if (w !== cw || Math.abs(h - ch) > 0) { medir(); pedir(); } });
  ro.observe(caja);

  return {
    svg, rotulos,
    get progreso() { return pv; },
    ponerProgreso(v, deGolpe) { p = clamp(v); if (deGolpe || !movimiento) pv = p; pedir(); },
    mostrar(si) { activo = si; caja.hidden = !si; if (si) { medir(); pv = p; pedir(); } else { cancelAnimationFrame(raf); raf = 0; rotulos.ocultar(); } },
    destruir() { activo = false; cancelAnimationFrame(raf); ro.disconnect(); svg.remove(); capa.remove(); },
  };
}
