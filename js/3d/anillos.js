// Los anillos de tinta en 3D: con el scroll, círculos a pulso (0,5 · 2 · 4 · 6 · 8 km en línea recta) se dibujan sobre el
// terreno alrededor de la aldea, y la cámara visita en orden Castrelo do Val, Verín, el castillo de Monterrei y Laza, MIRANDO
// ATRÁS, hacia la aldea: el sitio cerca, la aldea al fondo, el camino de hoy por carretera (OSRM) dibujado entre los dos.
// Después, el explorador libre (OrbitControls; en táctil, tras «Mover el mapa») con todos los rótulos.
// Nada del vuelo por el río de Pontillón ni del hilo de grano de Tulla: aquí todo lo mueve el scroll y todo es tinta y papel.
import { OrbitControls } from './vendor/OrbitControls.js';
import { fase, clamp, suave, SITIOS, trazadoAnillo, anclaAnillo, crearRotulos, listaRotulos, opRotulo } from './guion.js';
import { crearPoses, ajustarVista } from './poses.js';

const $ = id => document.getElementById(id);
const TACTIL = matchMedia('(pointer: coarse)').matches;
const mezcla = (a, b, k) => a + (b - a) * k;
const rad = Math.PI / 180;
const VIAJE = 1200;   // ms de la vuelta al recorrido

// la cinta: una banda pegada al relieve que se revela hasta «uCabeza» (metros desde el principio del trazo), con el borde de
// la pluma algo irregular y el ancho variable (la presión de la mano). Núcleo y borde con dos colores: el anillo es papel con
// filo de tinta; el camino, almagre con filo de papel.
const cintaVert = `attribute float aS; attribute float aLado; attribute float aW; attribute vec2 aNorm;
uniform float uAncho; varying float vS; varying float vLado;
#include <fog_pars_vertex>
void main(){ vec3 p = position + vec3(aNorm.x, 0., aNorm.y) * aLado * uAncho * aW; p.y += uAncho * .35;
  vS = aS; vLado = aLado;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const cintaFrag = `uniform vec3 uNucleo, uBorde; uniform float uCabeza, uFrac, uOpacidad;
varying float vS; varying float vLado;
#include <fog_pars_fragment>
void main(){ if (vS > uCabeza) discard;
  float v = abs(vLado);
  float n = .045 * sin(vS * .13) + .03 * sin(vS * .047 + 1.3);
  float alfa = 1. - smoothstep(.80 + n, .99 + n, v);
  float nuc = 1. - smoothstep(uFrac, uFrac + .09, v);
  alfa *= 1. - smoothstep(uCabeza - 26., uCabeza, vS);   // la punta de la pluma, al dibujar
  if (alfa < .01) discard;
  gl_FragColor = vec4(mix(uBorde, uNucleo, nuc), alfa * uOpacidad);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
function texturaPunta(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(244,239,230,1)'); g.addColorStop(.28, 'rgba(244,239,230,.95)'); g.addColorStop(.34, 'rgba(31,26,23,.95)'); g.addColorStop(.62, 'rgba(31,26,23,.9)'); g.addColorStop(1, 'rgba(31,26,23,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function montarAnillos(motor, { movimiento, quieto, alPrimerFotograma, base }) {
  const { THREE, D, AG } = motor, { EX, W, H, L, T, suelo } = D;
  const marco = $('ruta-marco'), caja = $('ruta-lienzo'), capa = $('ruta-rotulos');
  const bMover = $('ruta-mover'), bVolver = $('ruta-volver');
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const camara = new THREE.PerspectiveCamera(42, 16 / 10, 20, 90000);
  const sup = (x, z) => suelo(x, z) * EX;
  const PAPEL = new THREE.Color('#F4EFE6'), TINTA = new THREE.Color('#1F1A17'), ALMAGRE = new THREE.Color('#A3302C');

  // ---------- las cintas ----------
  function cinta(polis, { nucleo, borde, frac, grosor = 1, semilla = 0 }) {
    const geo = new THREE.BufferGeometry(), pos = [], aS = [], aLado = [], aW = [], aNorm = [], ix = [], trazos = [];
    let v0 = 0, mayor = 0;
    polis.forEach((p, pi) => {
      const n = p.length; let s = 0; const sacum = [0];
      for (let i = 1; i < n; i++) { s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); sacum.push(s); }
      mayor = Math.max(mayor, s); trazos.push({ p, s: sacum, largo: s });
      for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
        let tx = p[b][0] - p[a][0], tz = p[b][1] - p[a][1]; const m = Math.hypot(tx, tz) || 1; tx /= m; tz /= m;
        const y = sup(p[i][0], p[i][1]) + 2.5, w = grosor * (1 + .2 * Math.sin(sacum[i] * .0033 + semilla * 2.1 + pi) + .09 * Math.sin(sacum[i] * .0121 + semilla));
        for (let l = 0; l < 2; l++) { pos.push(p[i][0], y, p[i][1]); aS.push(sacum[i]); aLado.push(l ? -1 : 1); aW.push(w); aNorm.push(-tz, tx); }
        if (i < n - 1) { const v = v0 + i * 2; ix.push(v, v + 1, v + 2, v + 2, v + 1, v + 3); }
      }
      v0 += n * 2;
    });
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
    geo.setAttribute('aLado', new THREE.Float32BufferAttribute(aLado, 1)); geo.setAttribute('aW', new THREE.Float32BufferAttribute(aW, 1));
    geo.setAttribute('aNorm', new THREE.Float32BufferAttribute(aNorm, 2)); geo.setIndex(ix);
    geo.computeBoundingSphere(); geo.boundingSphere.radius += 400;
    const u = { uNucleo: { value: nucleo }, uBorde: { value: borde }, uFrac: { value: frac }, uCabeza: { value: 0 }, uOpacidad: { value: 1 }, uAncho: { value: 8 },
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) };
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: cintaVert, fragmentShader: cintaFrag, transparent: true, depthWrite: false,
      toneMapped: false, fog: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    mesh.renderOrder = 3; mesh.visible = false; motor.escena.add(mesh);
    return { mesh, u, trazos, largo: mayor };
  }
  const anillos = T.anillos.map(an => {
    const { a, b } = trazadoAnillo(T, an);
    return { an, ...cinta([a, b], { nucleo: PAPEL, borde: TINTA, frac: .30, grosor: 1, semilla: an.i }) };
  });
  const rutas = SITIOS.map((k, j) => {
    const R = T.rutas[k], pts = R.x.map((x, i) => [x, R.z[i]]);
    return { k, ...cinta([pts], { nucleo: ALMAGRE, borde: PAPEL, frac: .46, grosor: .75, semilla: j + 7 }) };
  });
  // de noche la tinta no luce como de día: algo más apagada
  motor.escucharHora(({ m }) => { for (const c of [...anillos, ...rutas]) c.u.uOpacidad.value = 1 - .3 * m.noche; });
  // la punta de la pluma: un punto de tinta con un halo de papel al final de cada trazo que se está dibujando
  const texPunta = texturaPunta(THREE);
  const puntas = [];
  for (const c of [...anillos, ...rutas]) for (let i = 0; i < c.trazos.length; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPunta, transparent: true, depthWrite: false, fog: false, toneMapped: false })); sp.renderOrder = 6; sp.visible = false; motor.escena.add(sp);
    puntas.push({ c, i, sp });
  }
  function enTrazo(tr, s) {   // punto del trazo a s metros del principio
    const S = tr.s; let lo = 0, hi = S.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const k = (s - S[lo]) / ((S[hi] - S[lo]) || 1);
    return [mezcla(tr.p[lo][0], tr.p[hi][0], k), mezcla(tr.p[lo][1], tr.p[hi][1], k)];
  }
  // ---------- las poses (poses.js): a dónde mira la cámara en cada parada y cómo se mezclan ----------
  const P = crearPoses(THREE, T, sup), prueba = P.prueba, colocar = (pose, cam = camara) => P.colocar(pose, cam), poseDe = P.poseDe;

  // ---------- rótulos ----------
  const lista = listaRotulos(T, base);
  const rotulos = crearRotulos(capa, lista);
  const anclas = lista.map(r => {
    if (r.k === 'aldea') { const l = L.aldea; return V3(l.xz[0], sup(l.xz[0], l.xz[1]) + l.alto + 34, l.xz[1]); }
    if (r.k.startsWith('anillo-')) { const [x, z] = anclaAnillo(T, T.anillos[+r.k.slice(7)]); return V3(x, sup(x, z) + 6, z); }
    const l = L[r.k]; return V3(l.xz[0], sup(l.xz[0], l.xz[1]) + l.alto + 30, l.xz[1]);
  });
  const sentidoFuera = lista.map(r => { const l = L[r.k]; return l?.fuera ? V3(Math.sin(l.rumbo * rad) * 700, 0, -Math.cos(l.rumbo * rad) * 700) : null; });
  const pant = {}, pant2 = {};

  // ---------- estado ----------
  let p = quieto ? 1 : 0, pv = p, modo = 'camino', viaje = null, F = fase(pv);

  // ---------- el explorador ----------
  const ctl = new OrbitControls(camara, caja);
  // la rueda es del scroll de la página (el marco ocupa la pantalla): acercar con Ctrl + rueda (o el pellizco del trackpad),
  // con + y − del teclado y, en táctil con el mapa suelto, con dos dedos
  Object.assign(ctl, { enabled: false, enableDamping: true, dampingFactor: .08, minDistance: 300, maxDistance: 52000, maxPolarAngle: 1.42,
    screenSpacePanning: false, rotateSpeed: .6, enableZoom: TACTIL });
  ctl.addEventListener('change', () => {
    ctl.target.x = clamp(ctl.target.x, -W / 2, W / 2); ctl.target.z = clamp(ctl.target.z, -H / 2, H / 2);
    motor.pedir();
  });
  let moviendo = false;
  const esf = new THREE.Spherical(), off = V3(0, 0, 0);
  ctl.addEventListener('start', () => { moviendo = true; motor.pedir(); });
  ctl.addEventListener('end', () => { moviendo = false; });
  const alRueda = e => {
    if (!e.ctrlKey) return;
    e.preventDefault(); soltar();
    off.copy(camara.position).sub(ctl.target);
    off.setLength(clamp(off.length() * Math.exp(clamp(e.deltaY, -60, 60) * .01), ctl.minDistance, ctl.maxDistance));
    camara.position.copy(ctl.target).add(off); ctl.update(); motor.pedir();
  };
  caja.addEventListener('wheel', alRueda, { passive: false });
  // en táctil, el dedo hace scroll hasta que se pulsa «Mover el mapa» (OrbitControls pone touch-action: none al crearse)
  let suelto = !TACTIL;
  caja.style.touchAction = 'pan-y';
  function ponerMover(activo) {
    suelto = activo;
    caja.style.touchAction = activo ? 'none' : 'pan-y';
    bMover.textContent = activo ? 'Soltar el mapa' : 'Mover el mapa';
    bMover.setAttribute('aria-pressed', String(activo));
    marco.classList.toggle('mapa-suelto', activo);
    ctl.enabled = modo === 'libre' && suelto;
  }
  function ponerModo(m) {
    modo = m;
    marco.classList.toggle('libre', m === 'libre');
    bVolver.hidden = m !== 'libre';
    ctl.enabled = m === 'libre' && suelto;
    rotulos.medir();
  }
  /** al explorador desde donde esté la cámara */
  function soltar() {
    if (modo === 'libre') return;
    viaje = null;
    ctl.target.copy(poseDe(F).o); ponerModo('libre'); ctl.update(); motor.pedir();
  }
  function volver() {
    if (modo !== 'libre') return;
    if (TACTIL) ponerMover(false);
    if (!movimiento) { ponerModo('camino'); colocar(poseDe(F)); motor.pedir(); return; }
    viaje = { t0: -1, p0: camara.position.clone(), o0: ctl.target.clone() };
    ponerModo('camino'); motor.pedir();
  }
  if (TACTIL) {
    bMover.hidden = false; ponerMover(false);
    bMover.addEventListener('click', () => { if (!suelto) soltar(); ponerMover(!suelto); });
  } else bMover.hidden = true;
  bVolver.addEventListener('click', volver);
  // ratón: arrastrar suelta el mapa (en captura, antes que OrbitControls: el mismo arrastre ya gira)
  const alBajar = e => { if (e.pointerType === 'touch') return; if (modo !== 'libre') soltar(); };
  caja.addEventListener('pointerdown', alBajar, { capture: true });
  // teclado: flechas giran e inclinan, + y − acercan (sueltan el mapa); Escape vuelve al recorrido
  caja.tabIndex = 0;
  caja.setAttribute('role', 'application');
  caja.setAttribute('aria-roledescription', 'relieve en 3D');
  caja.setAttribute('aria-label', 'El valle de Pepín en 3D: la aldea, anillos de distancia y cuatro sitios a menos de media hora en coche. Flechas: girar e inclinar. Más y menos: acercar y alejar. Escape: volver al recorrido.');
  const alTeclear = e => {
    const k = e.key; let dTh = 0, dPh = 0, f = 1;
    if (k === 'Escape' && modo === 'libre') { e.preventDefault(); volver(); return; }
    if (k === 'ArrowLeft') dTh = -.12; else if (k === 'ArrowRight') dTh = .12;
    else if (k === 'ArrowUp') dPh = -.08; else if (k === 'ArrowDown') dPh = .08;
    else if (k === '+' || k === '=') f = .85; else if (k === '-' || k === '_') f = 1 / .85;
    else return;
    e.preventDefault(); soltar();
    off.copy(camara.position).sub(ctl.target); esf.setFromVector3(off);
    esf.theta += dTh; esf.phi = Math.max(.15, Math.min(ctl.maxPolarAngle, esf.phi + dPh));
    esf.radius = Math.max(ctl.minDistance, Math.min(ctl.maxDistance, esf.radius * f));
    camara.position.copy(ctl.target).add(off.setFromSpherical(esf)); ctl.update(); motor.pedir();
  };
  caja.addEventListener('keydown', alTeclear);
  bVolver.textContent = quieto ? 'Ver todo el valle' : 'Volver al recorrido';

  // ---------- los trazos en cada fotograma ----------
  function ponerTrazos(Fh, libre) {
    const dCam = modo === 'libre' ? camara.position.distanceTo(ctl.target) : poseDe(Fh).d;
    // la bruma del fondo se aparta según lo lejos que esté la cámara: de cerca hay horizonte, desde la vista de todo el valle se ve claro
    const nb = motor.escena.fog; nb.near = Math.max(14000, dCam * 1.05); nb.far = Math.max(52000, dCam * 3.4);
    const ancho = clamp(dCam * .0026, 3, 55);
    anillos.forEach((c, i) => {
      const u = libre ? 1 : Fh.anillos[i];
      c.u.uAncho.value = ancho; c.u.uCabeza.value = u >= .9999 ? c.largo + 60 : u * c.largo; c.mesh.visible = u > .0005;
    });
    rutas.forEach((c, j) => {
      const u = libre ? 1 : Fh.rutas[j];
      c.u.uAncho.value = ancho * .8; c.u.uCabeza.value = u >= .9999 ? c.largo + 60 : u * c.largo; c.mesh.visible = u > .0005;
    });
    // la punta de la pluma, solo mientras el trazo se está dibujando
    for (const pt of puntas) {
      const s = pt.c.u.uCabeza.value, tr = pt.c.trazos[pt.i], dibujando = pt.c.mesh.visible && s < tr.largo - 1 && s > 1;
      pt.sp.visible = dibujando;
      if (dibujando) { const [x, z] = enTrazo(tr, s); pt.sp.position.set(x, sup(x, z) + ancho * 1.2, z); pt.sp.scale.setScalar(ancho * 3.4); }
    }
  }

  // ---------- la vista ----------
  const vista = motor.montar({
    caja, camara,
    ajustarCamara(w, h) {
      const aspecto = ajustarVista(camara, w, h);
      P.calcular(camara, aspecto); rotulos.medir();
      if (modo === 'camino' && !viaje) colocar(poseDe(F));
    },
    cuadro(t, dt) {
      pv = movimiento ? pv + (p - pv) * (1 - Math.exp(-dt / 90)) : p;
      if (Math.abs(p - pv) < 1e-4) pv = p;
      let sigue = pv !== p;
      F = fase(pv);
      if (modo === 'camino') {
        const dest = poseDe(F);
        if (viaje) {
          if (viaje.t0 < 0) viaje.t0 = t;
          const k = suave((t - viaje.t0) / VIAJE), c2 = prueba; c2.copy(camara); colocar(dest, c2);
          camara.position.lerpVectors(viaje.p0, c2.position, k); camara.lookAt(V3(0, 0, 0).lerpVectors(viaje.o0, dest.o, k)); camara.updateMatrixWorld();
          if (k >= 1) viaje = null; else sigue = true;
        } else colocar(dest);
      } else {
        const cambia = ctl.update();
        const c = camara.position, minY = sup(c.x, c.z) + 60; if (c.y < minY) c.y = minY;
        sigue = sigue || cambia || moviendo;
      }
      ponerTrazos(F, modo === 'libre');
      return sigue;
    },
    trasPintar() {
      const libre = modo === 'libre', compacto = libre || F.vista > .5;
      if (compacto !== marco.classList.contains('rotulos-compactos')) { marco.classList.toggle('rotulos-compactos', compacto); rotulos.medir(); }
      rotulos.colocar(anclas.map((a, i) => {
        motor.aPantalla(a, pant);
        const o = { x: pant.x, y: pant.y, visible: pant.visible, op: opRotulo(lista[i].k, F, libre) };
        if (sentidoFuera[i]) { motor.aPantalla(a.clone().add(sentidoFuera[i]), pant2); o.ang = Math.atan2(pant2.y - pant.y, pant2.x - pant.x) / rad; }
        return o;
      }));
    },
    alPrimerFotograma,
  });

  return {
    vista, camara, ctl, anillos, rutas,
    get modo() { return modo; }, get progreso() { return pv; }, get fase() { return F; },
    ponerProgreso(v, deGolpe) {
      const nuevo = quieto ? 1 : clamp(v);
      // con el mapa suelto, hacer scroll devuelve la cámara al recorrido (si no, se bajaba la pista sin que nada se moviera)
      if (modo === 'libre' && !quieto && !moviendo && Math.abs(nuevo - p) > .002) volver();
      p = nuevo; if (deGolpe || !movimiento) pv = p; motor.pedir();
    },
    soltar, volver, poses: () => P.poses,
    destruir() {
      ctl.dispose();
      caja.removeEventListener('wheel', alRueda);
      caja.removeEventListener('pointerdown', alBajar, { capture: true }); caja.removeEventListener('keydown', alTeclear);
      capa.textContent = '';
    },
  };
}
