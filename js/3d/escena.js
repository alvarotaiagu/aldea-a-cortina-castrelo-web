// La escena de «A un cuarto de hora de la aldea»: un solo renderer WebGL sobre #ruta-lienzo. Relieve MDT05 + ortofoto
// PNOA del IGN (CC BY 4.0), altura ×1,6, cantos de maqueta, la aldea y el castillo de Monterrei de cerca (parches a
// 0,35 m/px), cúpula de cielo con el sol y la luna de ahora, estrellas, sombras del sol, una aguja por sitio (la aldea
// en almagre, los cuatro destinos en papel), calidad automática.
// Parte de la escena de A Casa da Tulla (../a-casa-da-tulla-gomesende-web/js/3d/escena.js), que viene de Casa O Pontillón.
import * as THREE from './vendor/three.module.min.js';
import { fovPara } from './poses.js';

export { THREE };
const BASE = new URL('../../img/terreno/', import.meta.url);
const rad = Math.PI / 180;

// Móvil: malla 384×421, ortofoto 1536 y parches a 1024; escritorio: 576×632, 3072 y 1536
export const MOVIL = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;

// ---------- Datos ----------
let promesaDatos = null;
/** T: terreno.json (ya leído por arranque.js); v: «?v=…» para que la caché no sirva datos viejos */
export function cargarDatos(T, v = '') {
  return promesaDatos ||= (async () => {
    const [nx, nz] = T.mallas[MOVIL ? 0 : T.mallas.length - 1], lado = MOVIL ? 1536 : 3072, ladoP = MOVIL ? 1024 : 1536;
    const pedir = f => fetch(new URL(f + v, BASE), { priority: 'low' }).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r; });
    const imagen = async nombre => {   // WebP y, si falla, JPG; decodificada fuera del hilo principal
      let ultimo;
      for (const ext of ['webp', 'jpg']) {
        try {
          const b = await (await pedir(`${nombre}.${ext}`)).blob();
          if ('createImageBitmap' in window) return await createImageBitmap(b);
          const img = new Image(); img.src = URL.createObjectURL(b); await img.decode(); return img;
        } catch (e) { ultimo = e; }
      }
      throw ultimo;
    };
    const opcional = nombre => imagen(nombre).catch(() => null);   // los parches son un extra
    const nombresP = Object.keys(T.parches);
    const [buf, orto, ...imgsP] = await Promise.all([pedir(`alturas-${nx}x${nz}.bin`).then(r => r.arrayBuffer()), imagen(`orto-${lado}`), ...nombresP.map(n => opcional(`${n}-${ladoP}`))]);
    const pParches = Object.fromEntries(nombresP.map((n, i) => [n, imgsP[i]]));
    const ALT = new Uint16Array(buf);
    if (ALT.length !== nx * nz) throw new Error('alturas: tamaño inesperado');
    const W = T.ancho, H = T.alto, EX = T.exageracion;
    const cota = (r, c) => ALT[r * nx + c] / 10;
    /** altura de la malla (m reales) bajo un punto, exacta a sus triángulos (a-d-b y b-d-e de cada celda) */
    const suelo = (x, z) => {
      const c = Math.min(nx - 1.0001, Math.max(0, (x / W + .5) * (nx - 1))), r = Math.min(nz - 1.0001, Math.max(0, (z / H + .5) * (nz - 1)));
      const c0 = Math.floor(c), r0 = Math.floor(r), fc = c - c0, fr = r - r0;
      const A = cota(r0, c0), B = cota(r0, c0 + 1), D = cota(r0 + 1, c0), E = cota(r0 + 1, c0 + 1);
      return fc + fr <= 1 ? A + (B - A) * fc + (D - A) * fr : E + (D - E) * (1 - fc) + (B - E) * (1 - fr);
    };
    return { T, nx, nz, W, H, EX, cota, suelo, orto, parches: pParches, L: T.lugares };
  })();
}

// Luz según la altura del sol: [altura, cielo arriba, horizonte y bruma, color del sol, intensidad del sol, intensidad del cielo]
const TABLA = [[-18, '#04070e', '#0b1220', '#8fa6d8', .22, .16], [-6, '#0d1631', '#29304a', '#9fb0e0', .3, .22], [-1, '#2f3d66', '#c27758', '#ff8f55', .8, .3],
  [5, '#5f7fae', '#e6a874', '#ffad66', 2.0, .55], [18, '#7fa6cf', '#d6dcd9', '#ffeedb', 2.7, .8], [60, '#77a2d0', '#cbd8de', '#ffffff', 3.0, .92]];
const TABLA_C = TABLA.map(([a, c1, c2, c3, i, h]) => [a, new THREE.Color(c1), new THREE.Color(c2), new THREE.Color(c3), i, h]);
function mezcla(a) {
  let i = 0; while (i < TABLA_C.length - 2 && a > TABLA_C[i + 1][0]) i++;
  const p = TABLA_C[i], q = TABLA_C[i + 1], k = Math.min(1, Math.max(0, (a - p[0]) / (q[0] - p[0])));
  const col = j => p[j].clone().lerp(q[j], k);
  return { cielo: col(1), bruma: col(2), sol: col(3), i: p[4] + (q[4] - p[4]) * k, h: p[5] + (q[5] - p[5]) * k, noche: Math.min(1, Math.max(0, (-a - 2) / 10)) };
}
const direccion = (az, al, v = new THREE.Vector3()) => v.set(Math.sin(az * rad) * Math.cos(al * rad), Math.sin(al * rad), -Math.cos(az * rad) * Math.cos(al * rad));

// cúpula del cielo: degradado, disco y halo del sol, disco de la luna
const cieloVert = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const cieloFrag = `uniform vec3 arriba, horizonte, colSol, dirSol, dirLuna; uniform float noche, luna;
varying vec3 vDir;
void main(){ vec3 d = normalize(vDir); float h = d.y;
  vec3 c = mix(horizonte, arriba, pow(smoothstep(-.02, .55, h), .75));
  c = mix(c, horizonte * .7, smoothstep(0., -.08, h));
  float s = max(dot(d, dirSol), 0.);
  c += colSol * (smoothstep(.99955, .9997, s) * 6. + pow(s, 14.) * .35 * (1. - noche) + pow(s, 3.) * .08 * (1. - noche));
  float m = dot(d, dirLuna);
  c += vec3(.93, .95, 1.) * (smoothstep(.99988, .99993, m) * 1.6 + pow(max(m, 0.), 60.) * .12) * luna;
  gl_FragColor = vec4(c, 1.);
  #include <colorspace_fragment>
}`;

// ---------- El motor ----------
/** S: el módulo sol.js (una sola copia, la que pasa arranque.js) */
export function crearMotor(D, { S, alFallar } = {}) {
  const { nx, nz, W, H, EX, cota, T, suelo } = D;
  const renderer = new THREE.WebGLRenderer({ antialias: !MOVIL, powerPreference: 'high-performance' });   // lanza si no hay WebGL2
  const lienzo = renderer.domElement;
  lienzo.className = 'ruta-gl'; lienzo.setAttribute('aria-hidden', 'true');
  // tope de densidad: 1,5 en móvil y 1,75 en escritorio (?dpr3d=1 lo cambia, para el póster)
  const dprPedido = +new URLSearchParams(location.search).get('dpr3d');
  let dpr = dprPedido > 0 ? Math.min(devicePixelRatio || 1, dprPedido) : Math.min(devicePixelRatio || 1, MOVIL ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.5;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;   // el sol no se mueve dentro de un minuto: la sombra se rehace al cambiar la hora
  let perdido = false, destruido = false;
  lienzo.addEventListener('webglcontextlost', e => { e.preventDefault(); if (destruido) return; perdido = true; detener(); alFallar?.('contexto perdido'); });

  const escena = new THREE.Scene();
  const anis = Math.min(MOVIL ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
  // ---- relieve ----
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  for (let r = 0; r < nz; r++) for (let c = 0; c < nx; c++) {
    const i = r * nx + c;
    pos[i * 3] = (c / (nx - 1) - .5) * W; pos[i * 3 + 1] = cota(r, c) * EX; pos[i * 3 + 2] = (r / (nz - 1) - .5) * H;
    uv[i * 2] = c / (nx - 1); uv[i * 2 + 1] = r / (nz - 1);   // textura sin voltear (ImageBitmap): fila 0 = norte
  }
  let k = 0; for (let r = 0; r < nz - 1; r++) for (let c = 0; c < nx - 1; c++) { const a = r * nx + c, b = a + 1, d = a + nx, e = d + 1; idx.set([a, d, b, b, d, e], k); k += 6; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals();
  const texturas = [];
  const textura = img => { const t = new THREE.Texture(img); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anis; t.needsUpdate = true; texturas.push(t); return t; };
  const tex = textura(D.orto);
  const tierra = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: .96, metalness: 0 }));
  tierra.receiveShadow = tierra.castShadow = true; escena.add(tierra);
  // ---- los cuatro cantos de la maqueta ----
  {
    const base = (T.min - 140) * EX, p = [], borde = [];
    for (let c = 0; c < nx; c++) borde.push([0, c]); for (let r = 1; r < nz; r++) borde.push([r, nx - 1]);
    for (let c = nx - 2; c >= 0; c--) borde.push([nz - 1, c]); for (let r = nz - 2; r > 0; r--) borde.push([r, 0]); borde.push([0, 0]);
    for (let i = 0; i < borde.length - 1; i++) {
      const [r0, c0] = borde[i], [r1, c1] = borde[i + 1];
      const x0 = (c0 / (nx - 1) - .5) * W, z0 = (r0 / (nz - 1) - .5) * H, x1 = (c1 / (nx - 1) - .5) * W, z1 = (r1 / (nz - 1) - .5) * H, y0 = cota(r0, c0) * EX, y1 = cota(r1, c1) * EX;
      p.push(x0, y0, z0, x0, base, z0, x1, y1, z1, x1, y1, z1, x0, base, z0, x1, base, z1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals();
    escena.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#3a332b', roughness: 1, side: THREE.DoubleSide })));
  }
  // ---- la aldea y el castillo de cerca: parches de foto aérea a 0,35 m/px, pegados al relieve, con los bordes difuminados ----
  const lienzoBorde = document.createElement('canvas'); lienzoBorde.width = lienzoBorde.height = 64;
  { const x = lienzoBorde.getContext('2d'), im = x.createImageData(64, 64);
    for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { const d = Math.min(i, 63 - i, j, 63 - j) / 63, a = Math.max(0, Math.min(1, (d - .02) / .22)), v = Math.round(255 * a * a * (3 - 2 * a)); im.data.set([v, v, v, 255], (j * 64 + i) * 4); }
    x.putImageData(im, 0, 0); }
  const texBorde = new THREE.CanvasTexture(lienzoBorde); texturas.push(texBorde);
  const parches = [];
  for (const nombre of Object.keys(T.parches)) {
    const P = T.parches[nombre], img = D.parches[nombre];
    if (!P || !img) continue;
    const seg = 48, g = new THREE.BufferGeometry(), p = new Float32Array((seg + 1) ** 2 * 3), u = new Float32Array((seg + 1) ** 2 * 2), ix = [];
    for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) {
      const q = j * (seg + 1) + i, x = P.xz[0] + (i / seg - .5) * P.ancho, z = P.xz[1] + (j / seg - .5) * P.alto;
      p.set([x, suelo(x, z) * EX + 2.5, z], q * 3); u.set([i / seg, j / seg], q * 2);
    }
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + 1, d = a + seg + 1, e = d + 1; ix.push(a, d, b, b, d, e); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.BufferAttribute(u, 2)); g.setIndex(ix); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: textura(img), alphaMap: texBorde, transparent: true, depthWrite: false, roughness: .96, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    m.receiveShadow = true; m.renderOrder = 2; escena.add(m); parches.push(m);
  }

  // ---- luces ----
  const sl = new THREE.DirectionalLight('#fff', 3); sl.castShadow = true;
  const tamSombra = MOVIL ? 1024 : 2048; sl.shadow.mapSize.set(tamSombra, tamSombra);
  const radioS = Math.hypot(W, H) / 2 + 400;
  Object.assign(sl.shadow.camera, { left: -radioS, right: radioS, top: radioS, bottom: -radioS, near: 100, far: 60000 }); sl.shadow.bias = -.0004; sl.shadow.normalBias = 24;
  escena.add(sl, sl.target);
  const hemi = new THREE.HemisphereLight('#cfe0ee', '#2a3a30', .6); escena.add(hemi);

  // ---- una aguja por sitio: la aldea (almagre, más alta) y los cuatro destinos (papel); de noche la aldea luce como un farol ----
  const aguja = (lugar, color, radio) => {
    const P = new THREE.Vector3(lugar.xz[0], suelo(lugar.xz[0], lugar.xz[1]) * EX, lugar.xz[1]), Hh = lugar.alto;
    const g = new THREE.Group();
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, Hh, 8), new THREE.MeshBasicMaterial({ color: '#f4efe6', transparent: true, opacity: .9, fog: false }));
    const bola = new THREE.Mesh(new THREE.SphereGeometry(radio, 20, 14), new THREE.MeshBasicMaterial({ color, fog: false })); bola.position.y = Hh / 2 + radio * .6;
    g.add(palo, bola); g.position.set(P.x, P.y + Hh / 2, P.z); escena.add(g);
    return { P, g, bola, color: new THREE.Color(color), alto: Hh };
  };
  const AG = { aldea: aguja(D.L.aldea, '#A3302C', 22) };
  for (const k of ['castrelo', 'verin', 'monterrei', 'laza']) AG[k] = aguja(D.L[k], '#f4efe6', 13);

  // ---- cielo y estrellas: pegados a la cámara ----
  const ep = []; { let s = 11; const az = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 1800; i++) { const t = az() * Math.PI * 2, f = Math.acos(az() * .92); ep.push(Math.sin(f) * Math.cos(t) * 2800, Math.cos(f) * 2800, Math.sin(f) * Math.sin(t) * 2800); } }
  const geoE = new THREE.BufferGeometry(); geoE.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3));
  const estrellas = new THREE.Points(geoE, new THREE.PointsMaterial({ color: '#dfe8ff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  const uCielo = { arriba: { value: new THREE.Color() }, horizonte: { value: new THREE.Color() }, colSol: { value: new THREE.Color() }, dirSol: { value: new THREE.Vector3(0, 1, 0) },
    dirLuna: { value: new THREE.Vector3(0, -1, 0) }, noche: { value: 0 }, luna: { value: 0 } };
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), new THREE.ShaderMaterial({ uniforms: uCielo, vertexShader: cieloVert, fragmentShader: cieloFrag, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }));
  cielo.frustumCulled = estrellas.frustumCulled = false; cielo.renderOrder = -2; estrellas.renderOrder = -1;
  cielo.onBeforeRender = estrellas.onBeforeRender = function (r, e, cam) { this.position.setFromMatrixPosition(cam.matrixWorld); this.updateMatrixWorld(); };
  escena.add(cielo, estrellas);
  escena.fog = new THREE.Fog('#cfdce4', 16000, 52000);

  // ---- la luz de una fecha ----
  let claveHora = '', estado = null;
  const blanco = new THREE.Color('#ffffff'), farol = new THREE.Color('#F2C46D'), vDir = new THREE.Vector3();
  const oyentesHora = [];
  /** Pone la luz de una fecha; devuelve { s: sol, lu: luna, m: mezcla } */
  function ponerHora(fecha) {
    const clave = Math.floor(fecha / 6e4) + '';
    if (clave === claveHora && estado) return estado;
    claveHora = clave;
    const s = S.sol(fecha), m = mezcla(s.alt), lu = S.luna(fecha); estado = { s, m, lu };
    const deNoche = s.alt < -3, lunaArriba = lu.alt > 0 ? Math.min(1, lu.alt / 4) : 0;
    // de noche la luz principal es la luna (si está), o un cielo azul que viene del sur
    const az = deNoche ? (lunaArriba ? lu.az : 205) : s.az, al = deNoche ? (lunaArriba ? Math.max(lu.alt, 6) : 38) : Math.max(s.alt, 1.5);
    sl.target.position.set(0, 300, 0); sl.position.copy(direccion(az, al, vDir)).multiplyScalar(26000).add(sl.target.position); sl.target.updateMatrixWorld();
    sl.color.copy(m.sol); sl.intensity = deNoche ? m.i * (.6 + lu.luz * lunaArriba * 1.2) : m.i; hemi.intensity = m.h;
    hemi.color.copy(m.cielo).lerp(blanco, .35); hemi.groundColor.set(deNoche ? '#0c1416' : '#2a3a30');
    escena.fog.color.copy(m.bruma);
    uCielo.arriba.value.copy(m.cielo); uCielo.horizonte.value.copy(m.bruma); uCielo.colSol.value.copy(m.sol);
    direccion(s.az, s.alt, uCielo.dirSol.value); direccion(lu.az, lu.alt, uCielo.dirLuna.value);
    uCielo.noche.value = m.noche; uCielo.luna.value = lunaArriba * (.25 + lu.luz * .75);
    estrellas.material.opacity = m.noche * .95; estrellas.visible = m.noche > 0;
    renderer.toneMappingExposure = 1.5 + m.noche * .45;
    AG.aldea.bola.material.color.copy(AG.aldea.color).lerp(farol, m.noche);
    renderer.shadowMap.needsUpdate = true;
    for (const f of oyentesHora) f(estado);
    return estado;
  }

  // ---------- La vista (una sola: #ruta-lienzo) ----------
  let vista = null, bw = 0, bh = 0;
  function medir(forzar) {
    if (!vista) return;
    const w = vista.caja.clientWidth, h = vista.caja.clientHeight;
    if (!w || !h) return;
    // la barra del móvil cambia solo el alto: no se rehace nada (el canvas cubre con object-fit)
    if (!forzar && w === bw && Math.abs(h - bh) < 160) return;
    bw = w; bh = h; renderer.setSize(w, h, false);
    vista.camara.aspect = w / h; vista.ajustarCamara?.(w, h); vista.camara.updateProjectionMatrix();
    pedir();
  }
  let visible = false;
  const io = new IntersectionObserver(es => {
    for (const e of es) visible = e.isIntersecting;
    ultimo = 0;
    if (!visible) { cancelAnimationFrame(raf); raf = 0; } else pedir();
  }, { rootMargin: '120px 0px' });
  const ro = new ResizeObserver(() => medir());
  const alCambiarPestana = () => { ultimo = 0; if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else pedir(); };
  document.addEventListener('visibilitychange', alCambiarPestana);

  // ---------- Bucle: solo cuando se ve y hay algo que mover ----------
  let raf = 0, ultimo = 0, suma = 0, cuenta = 0, calentar = 20, parado = false, pintada = false, pausa = false;
  const calidad = { nivel: 0, dpr, sombras: true, fpsMedio: 0 };
  function bajarCalidad() {
    calidad.nivel++;
    if (dpr > 1) dpr = Math.max(1, dpr - .25);
    else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; sl.castShadow = false; tierra.material.needsUpdate = true; parches.forEach(p => { p.material.needsUpdate = true; }); calidad.sombras = false; }
    else if (dpr > .75) dpr = .75;
    else return;
    calidad.dpr = dpr; renderer.setPixelRatio(dpr); renderer.setSize(bw, bh, false);
  }
  function pedir() { if (!raf && !parado && !pausa && vista && visible && !document.hidden) raf = requestAnimationFrame(cuadro); }
  function cuadro(t) {
    raf = 0;
    if (parado || pausa || !visible || document.hidden) { ultimo = 0; return; }
    const dt = ultimo ? Math.min(120, t - ultimo) : 16;
    const sigue = vista.cuadro(t, dt) !== false;
    renderer.render(escena, vista.camara);
    vista.trasPintar?.();
    if (!pintada) { pintada = true; requestAnimationFrame(() => { if (!parado) vista.alPrimerFotograma?.(); }); }
    // calidad automática: media de 45 fotogramas seguidos; por encima de 30 ms, un escalón abajo
    if (ultimo && sigue) {
      if (calentar > 0) calentar--;
      else { suma += dt; if (++cuenta === 45) { calidad.fpsMedio = Math.round(1000 / (suma / cuenta)); if (suma / cuenta > 30) { bajarCalidad(); calentar = 20; } suma = cuenta = 0; } }
    }
    ultimo = sigue ? t : 0;
    if (sigue) pedir();
  }
  function detener() { parado = true; cancelAnimationFrame(raf); raf = 0; }

  // ---------- Pantalla: proyección con la cuenta de object-fit: cover ----------
  const v3 = new THREE.Vector3();
  function aPantalla(p, out = {}) {
    out.visible = false;
    if (!vista || !bw || !bh) return out;
    const cw = vista.caja.clientWidth, ch = vista.caja.clientHeight;
    v3.copy(p).project(vista.camara);
    const s = Math.max(cw / bw, ch / bh), ox = (cw - bw * s) / 2, oy = (ch - bh * s) / 2;
    out.x = ox + (v3.x + 1) / 2 * bw * s; out.y = oy + (1 - v3.y) / 2 * bh * s;
    out.visible = v3.z < 1 && out.x > -40 && out.x < cw + 40 && out.y > -40 && out.y < ch + 40;
    return out;
  }

  // shaders en paralelo (KHR_parallel_shader_compile) y texturas subidas antes del primer fotograma, de una en una
  const listo = (async () => {
    try { await renderer.compileAsync(escena, new THREE.PerspectiveCamera(42, 1.6, 20, 90000)); } catch (e) { /* se compila al pintar */ }
    for (const t of texturas) {
      await new Promise(r => ('requestIdleCallback' in window ? requestIdleCallback(r, { timeout: 500 }) : setTimeout(r, 0)));
      if (parado) return;
      renderer.initTexture(t);
    }
  })();

  return {
    THREE, D, S, escena, renderer, lienzo, listo, AG, calidad, ponerHora, pedir, aPantalla, detener, fovPara, MOVIL,
    get visible() { return visible; },
    get perdido() { return perdido; },
    /** pausa: con «En plano» el 3D no pinta */
    pausar(si) { pausa = si; if (si) { cancelAnimationFrame(raf); raf = 0; } else { ultimo = 0; pedir(); } },
    escucharHora(f) { oyentesHora.push(f); if (estado) f(estado); },
    /** v: { caja, camara, cuadro(t, dt) → false si no hace falta otro fotograma, trasPintar, ajustarCamara(w, h), alPrimerFotograma } */
    montar(v) { vista = v; v.caja.appendChild(lienzo); io.observe(v.caja); ro.observe(v.caja); medir(true); pedir(); return v; },
    destruir() {
      destruido = true; detener(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', alCambiarPestana);
      escena.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => x.dispose()); });
      texturas.forEach(t => t.dispose());
      renderer.dispose(); renderer.forceContextLoss?.(); lienzo.remove();
    },
  };
}
