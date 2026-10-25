// El guion de «A un cuarto de hora de la aldea», común al 3D y al plano (sin Three.js):
// - fase(p): del progreso del scroll (0–1) a qué se ve: la parada en que está la cámara (la aldea, Castrelo, Verín, el
//   castillo de Monterrei, Laza, todo el valle), cuánto se han dibujado los anillos y los caminos;
// - los anillos: círculos a pulso alrededor de la aldea (el mismo trazado que scripts/terreno.py);
// - la tabla de minutos (el «cuaderno»), el itinerario en texto y los rótulos: elementos HTML sobre el mapa, a plumilla,
//   que no chocan entre sí ni se salen del marco.

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const suave = t => (t = clamp(t), t * t * (3 - 2 * t));
export const coma = (v, d = 1) => v.toFixed(d).replace('.', ',');
const rad = Math.PI / 180;

/** Las cinco paradas con destino (la aldea y los cuatro sitios) y la vista de todo; la cámara se queda quieta de p0 a p1.
 *  Cambia estos números para retocar el ritmo del scroll (todo lo demás sale de aquí). */
export const PARADAS = [
  { k: 'aldea', p0: 0, p1: .05 },
  { k: 'castrelo', p0: .17, p1: .23 },
  { k: 'verin', p0: .40, p1: .46 },
  { k: 'monterrei', p0: .60, p1: .66 },
  { k: 'laza', p0: .81, p1: .87 },
  { k: 'vista', p0: .97, p1: 1 },
];
export const SITIOS = ['castrelo', 'verin', 'monterrei', 'laza'];
/** Cuándo se dibuja cada anillo (0,5 · 2 · 4 · 6 · 8 km): [desde p, hasta p]. Cada uno acaba a mitad de camino hacia la parada que lo cruza. */
const ANILLO_P = [[0, .06], [.05, .18], [.26, .40], [.46, .60], [.67, .80]];

/** p: progreso de la sección fijada → { a, b (paradas), t (0–1 entre ellas), est, anillos[5], rutas[4], vista } */
export function fase(p) {
  p = clamp(p);
  let a = 0; PARADAS.forEach((s, i) => { if (p >= s.p0) a = i; });
  let b = a, t = 0;
  if (a < PARADAS.length - 1 && p > PARADAS[a].p1) { b = a + 1; t = suave((p - PARADAS[a].p1) / (PARADAS[b].p0 - PARADAS[a].p1)); }
  const est = a + t;
  return {
    p, a, b, t, est,
    anillos: ANILLO_P.map(([x, y]) => suave((p - x) / (y - x))),
    // el camino a cada sitio se dibuja mientras la cámara viaja hacia él y queda completo al llegar
    rutas: SITIOS.map((_, j) => { const s = PARADAS[j].p1, e = PARADAS[j + 1].p0; return suave((p - s) / (e - s)); }),
    vista: suave(est - 4),   // 0 hasta Laza, 1 en la vista de todo
  };
}

// ---------- los anillos a pulso (la misma cuenta que radio_pulso de scripts/terreno.py) ----------
export function radioPulso(T, anillo, th) {
  const amp = Math.min(1, anillo.r / 2000) * 40;
  let s = 0; for (const [k, a, f] of T.ondas) s += a / .0060 * Math.sin(k * th + f + anillo.i * 1.7);
  return anillo.r + amp * s / 2.2;
}
/** Punto [x, z] del anillo a un ángulo th (rad, desde el norte, horario) */
export function puntoAnillo(T, anillo, th) {
  const [ax, az] = T.lugares.aldea.xz, r = radioPulso(T, anillo, th);
  return [ax + r * Math.sin(th), az - r * Math.cos(th)];
}
/** Las dos mitades del anillo: salen de la semilla (hacia su sitio) y se encuentran al otro lado. [[x, z], …] cada una */
export function trazadoAnillo(T, anillo, paso = 45) {
  const n = Math.max(24, Math.floor(2 * Math.PI * anillo.r / paso)), m = Math.floor(n / 2), a = [], b = [];
  for (let j = 0; j <= m; j++) a.push(puntoAnillo(T, anillo, anillo.th0 + 2 * Math.PI * j / n));
  for (let j = 0; j <= n - m; j++) b.push(puntoAnillo(T, anillo, anillo.th0 - 2 * Math.PI * j / n));
  return { a, b };
}
/** Dónde va la etiqueta de kilómetros de cada anillo (a 100° del norte: hacia el este, bajo la aldea) */
export const anclaAnillo = (T, anillo) => puntoAnillo(T, anillo, 100 * rad);

// ---------- las paradas: a dónde mira la cámara (las dos vistas, 3D y plano, las leen) ----------
const dist2 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
/** Fracción del camino dest → aldea a la que mira la cámara en cada parada (más cerca de la aldea = el sitio queda abajo) */
const MIRA = { castrelo: .38, verin: .44, monterrei: .44, laza: .44 };
/** { o: [x, z] (punto al que mira), b (rumbo de la cámara, ° desde el norte), el (inclinación, °), ptos: [[x, z, alto]] (lo que tiene que caber) } */
export function parada(T, k, aspecto = 1.6) {
  const L = T.lugares, A = L.aldea;
  if (k === 'aldea') return { o: A.xz.slice(), b: 158, el: 29, ptos: [], fijo: aspecto < 1 ? 1500 : 1150 };
  if (k === 'vista') {
    const ptos = [];
    for (const an of T.anillos) for (const th of [0, 90, 180, 270]) { const [x, z] = puntoAnillo(T, an, th * rad); if (an.r >= 8000) ptos.push([x, z, 0]); }
    for (const q of ['invernadeiro', 'chaves']) ptos.push([...L[q].xz, L[q].alto]);
    for (const q of SITIOS) ptos.push([...L[q].xz, L[q].alto]);
    ptos.push([...A.xz, A.alto]);
    const xs = ptos.map(p => p[0]), zs = ptos.map(p => p[1]);
    return { o: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2], b: aspecto < 1 ? 188 : 180, el: aspecto < 1 ? 62 : 54, ptos };
  }
  const D = L[k], f = MIRA[k], ux = D.xz[0] - A.xz[0], uz = D.xz[1] - A.xz[1], m = Math.hypot(ux, uz) || 1;
  return {
    o: [D.xz[0] + (A.xz[0] - D.xz[0]) * f, D.xz[1] + (A.xz[1] - D.xz[1]) * f],
    b: Math.atan2(ux / m, -uz / m) / rad,   // la cámara, detrás del sitio, mira hacia la aldea
    el: aspecto < 1 ? 38 : 31,
    ptos: [[...D.xz, D.alto], [...A.xz, A.alto]],
  };
}
export const kmRecta = (T, k) => dist2(T.lugares[k].xz, T.lugares.aldea.xz) / 1000;

// ---------- la tabla de minutos (el cuaderno) ----------
/** Escribe el cuaderno dentro de «el» y devuelve poner(fase) */
export function crearCuaderno(el, T) {
  const L = T.lugares;
  const filas = SITIOS.map(k => `<li data-k="${k}"><span class="n">${L[k].t}</span><i aria-hidden="true"></i><span class="m">${L[k].min} min</span></li>`).join('');
  el.innerHTML = `
    <p class="ruta-c-ceja">Desde Pepín, en coche</p>
    <p class="ruta-c-grande"><b data-min>0</b><span>min</span></p>
    <p class="ruta-c-sitio" data-sitio></p>
    <ol class="ruta-c-lista">${filas}</ol>
    <p class="ruta-c-nota">Los anillos miden kilómetros en línea recta. Los minutos son en coche, calculados con OpenStreetMap.</p>
    <p class="ruta-c-fuente">Relieve y ortofoto © IGN (CC BY 4.0) · caminos © OpenStreetMap</p>`;
  const q = s => el.querySelector(s), eMin = q('[data-min]'), eSitio = q('[data-sitio]'), filasEl = [...el.querySelectorAll('.ruta-c-lista li')];
  let ultimo = '';
  return function poner(F) {
    const act = Math.min(5, Math.round(F.est)), k = SITIOS[act - 1];
    const clave = act + '|' + F.vista.toFixed(2);
    if (clave === ultimo) return;
    ultimo = clave;
    let min, txt;
    if (act === 0) { min = '0'; txt = 'Salimos de la aldea, en Pepín.'; }
    else if (k) { min = String(L[k].min); txt = `${L[k].t}: ${coma(L[k].km)} km por carretera, ${coma(kmRecta(T, k))} en línea recta.`; }
    else { min = '25'; txt = 'Cuatro sitios en menos de media hora, por carretera.'; }
    eMin.textContent = min; eSitio.textContent = txt;
    filasEl.forEach((f, i) => { f.classList.toggle('es-act', i === act - 1); f.classList.toggle('es-hecho', i < act - 1 || act === 5); });
  };
}

/** El itinerario en texto (para lectores de pantalla): una lista ordenada */
const R8 = ['norte', 'nordeste', 'este', 'sudeste', 'sur', 'suroeste', 'oeste', 'noroeste'];
export function itinerario(T) {
  const L = T.lugares;
  const li = SITIOS.map(k => `<li>${L[k].t}: ${L[k].min} minutos en coche (${coma(L[k].km)} km por carretera; ${coma(kmRecta(T, k))} km en línea recta).</li>`);
  return `<ol>${li.join('')}</ol><p>Minutos en coche calculados con OpenStreetMap. Invernadeiro queda fuera del mapa, hacia el ${R8[Math.round(L.invernadeiro.rumbo / 45) % 8]}: ${L.invernadeiro.sub}.</p>`;
}

// ---------- los rótulos ----------
/** Una cartela a plumilla por sitio: lista [{ k, html, clase }] */
export function listaRotulos(T, base = '') {
  const L = T.lugares, lista = [];
  lista.push({ k: 'aldea', clase: 'aldea', html: `<img class="ruta-logo" src="${base}logo-pin.webp" width="40" height="40" alt=""><span><b>Aldea Rural A Cortiña</b><small>Pepín</small></span>` });
  for (const k of SITIOS) lista.push({ k, clase: 'sitio', html: `<b>${L[k].t}</b><span class="min"><i>${L[k].min}</i> min</span><small>${coma(L[k].km)} km en coche</small>` });
  for (const k of ['invernadeiro', 'chaves']) lista.push({ k, clase: 'fuera', html: `<b>${L[k].t}</b><svg class="ruta-flecha" viewBox="0 0 24 12" aria-hidden="true" focusable="false"><path d="M1 6h20M16 1.5 22 6l-6 4.5"/></svg><small>${L[k].sub}</small>` });
  T.anillos.slice(1).forEach((an, j) => lista.push({ k: 'anillo-' + (j + 1), clase: 'anillo', html: `${an.r / 1000} km` }));
  return lista;
}
const IDX = { aldea: 0, castrelo: 1, verin: 2, monterrei: 3, laza: 4 };
/** Opacidad de cada rótulo según la fase (libre = el explorador: todos) */
export function opRotulo(k, F, libre) {
  if (libre) return 1;
  if (k === 'aldea') return 1;
  if (k in IDX) return Math.max(suave(1.25 - Math.abs(F.est - IDX[k]) * 1.5), F.vista);
  if (k === 'invernadeiro' || k === 'chaves') return F.vista;
  if (k.startsWith('anillo-')) return clamp((F.anillos[+k.slice(7)] - .55) * 3);
  return 1;
}

/** capa: el elemento donde van los rótulos → { rot, medir(), colocar(pos), ocultar() } con pos[i] = { x, y, visible, op?, ang? } en px del marco.
 *  En orden de prioridad (más opacos primero, luego el orden de la lista) cada cartela prueba seis sitios alrededor de su punto (encima al centro,
 *  encima a un lado y al otro, y lo mismo debajo) y se queda con el primero que cabe entero en el marco sin pisar a otra; si ninguno vale, no se pone.
 *  El filete de la cartela siempre apunta al punto exacto. */
export function crearRotulos(capa, lista) {
  capa.textContent = '';
  const rot = lista.map(r => {
    const d = document.createElement('div');
    d.className = 'ruta-rotulo ' + (r.clase || ''); d.dataset.lugar = r.k;
    d.innerHTML = r.html;
    d.style.display = 'none';
    capa.appendChild(d); return { ...r, d, w: 0, h: 0 };
  });
  return {
    rot,
    medir() { rot.forEach(r => { r.w = 0; }); },
    colocar(pos) {
      const puestos = [], cw = capa.clientWidth, ch = capa.clientHeight, M = 4;
      const orden = rot.map((_, i) => i).sort((i, j) => ((pos[j]?.op ?? 1) - (pos[i]?.op ?? 1)) || i - j);
      for (const i of orden) {
        const r = rot[i], p = pos[i];
        if (!p || !p.visible || (p.op ?? 1) <= .01) { r.d.style.display = 'none'; continue; }
        if (r.d.style.display === 'none') r.d.style.display = '';
        if (!r.w) { r.w = r.d.offsetWidth || 120; r.h = r.d.offsetHeight || 34; }
        const w = r.w, h = r.h, libre = r.clase === 'anillo';
        // dx, dy: esquina de arriba a la izquierda respecto al punto; ab: debajo del punto (el filete sube); tallo: largo del filete.
        // Primero con el filete corto (14 px), encima y debajo; si no cabe, con el filete largo, para escalonar las que se pisan
        const cands = [];
        if (libre) cands.push([-w / 2, -h / 2, 0, 0]);
        else for (const t of [14, 46]) for (const ab of [0, 1]) for (const dx of [-w / 2, -16, 16 - w]) cands.push([dx, ab ? t : -h - t, ab, t]);
        let elegido = null;
        for (const [dx, dy, ab, tallo] of cands) {
          let x0 = p.x + dx; const y0 = p.y + dy;
          // si el punto está dentro pero la cartela se sale por un lado, la cartela se corre hacia dentro
          if (p.x >= M && p.x <= cw - M) x0 = Math.min(cw - M - w, Math.max(M, x0));
          const guia = p.x - x0;
          const c = { x0, x1: x0 + w, y0, y1: y0 + h };
          if (!libre && (guia < 8 || guia > w - 8)) continue;
          if (c.x0 < M || c.x1 > cw - M || c.y0 < M || c.y1 > ch - M) continue;
          if (puestos.some(o => c.x0 < o.x1 + M && c.x1 > o.x0 - M && c.y0 < o.y1 && c.y1 > o.y0)) continue;
          elegido = { c, ab, guia, tallo }; break;
        }
        if (!elegido) { r.d.style.display = 'none'; continue; }
        puestos.push(elegido.c);
        r.d.classList.toggle('abajo', !!elegido.ab);
        r.d.style.opacity = (p.op ?? 1) < 1 ? (p.op).toFixed(2) : '';
        r.d.style.transform = `translate(${elegido.c.x0.toFixed(1)}px, ${elegido.c.y0.toFixed(1)}px)`;
        r.d.style.setProperty('--guia', `${elegido.guia.toFixed(1)}px`);   // el filete sigue apuntando al sitio
        r.d.style.setProperty('--tallo', `${elegido.tallo}px`);
        if (p.ang != null) r.d.style.setProperty('--ang', p.ang.toFixed(0) + 'deg');
      }
    },
    ocultar() { rot.forEach(r => { r.d.style.display = 'none'; }); },
  };
}
