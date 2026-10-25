// Las poses de la cámara: a dónde mira en cada parada, desde qué rumbo, inclinación y distancia, y cómo se mezclan al viajar
// de una a otra. Solo usa Three.js (sin renderer, sin DOM): por eso pruebas/3d-encuadre.mjs puede comprobar en Node, sin WebGL,
// que en cada pantalla caben el sitio y la aldea con sitio para su cartela.
import { PARADAS, parada } from './guion.js';

const rad = Math.PI / 180;
const mezcla = (a, b, k) => a + (b - a) * k;
const mezclaAng = (a, b, k) => a + ((((b - a) % 360) + 540) % 360 - 180) * k;

/** Campo de visión vertical: apaisado, 42°; en vertical, 36° en horizontal fijos */
export function fovPara(aspecto, vBase = 42, hFijo = 36) {
  if (aspecto >= 1) return vBase;
  return Math.max(vBase, 2 * Math.atan(Math.tan(hFijo / 2 * rad) / aspecto) / rad);
}

/** Pone el campo de visión y el desplazamiento de la imagen: lo importante, a la derecha de la tabla (apaisado) o por encima de ella (vertical).
 *  Con setViewOffset, aspect es el de la imagen entera (la visible es un trozo). Devuelve el aspecto de la pantalla (w / h). */
export function ajustarVista(camara, w, h) {
  const aspecto = w / h; camara.fov = fovPara(aspecto);
  const dx = aspecto >= 1 && w > 760 ? Math.min(190, w * .13) : 0, dy = aspecto < 1 || w <= 760 ? Math.min(120, h * .14) : 0;
  camara.aspect = (w + 2 * dx) / (h + 2 * dy);
  if (dx || dy) camara.setViewOffset(w + 2 * dx, h + 2 * dy, 0, 2 * dy, w, h); else camara.clearViewOffset();
  camara.updateProjectionMatrix();
  return aspecto;
}

/** sup(x, z) → altura del relieve en la escena (m reales × exageración) */
export function crearPoses(THREE, T, sup) {
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const Pose = (o, b, el, d) => ({ o, b, el, d });
  const mezclarPose = (A, B, k) => k <= 0 ? A : k >= 1 ? B : Pose(A.o.clone().lerp(B.o, k), mezclaAng(A.b, B.b, k), mezcla(A.el, B.el, k), Math.exp(mezcla(Math.log(A.d), Math.log(B.d), k)));
  /** Pone la cámara según una pose (sin bajar de 150 m sobre el relieve) */
  function colocar(P, cam) {
    const ce = Math.cos(P.el * rad);
    cam.position.set(P.o.x + P.d * ce * Math.sin(P.b * rad), P.o.y + P.d * Math.sin(P.el * rad), P.o.z - P.d * ce * Math.cos(P.b * rad));
    const minY = sup(cam.position.x, cam.position.z) + 150; if (cam.position.y < minY) cam.position.y = minY;
    cam.lookAt(P.o); cam.updateMatrixWorld();
  }
  const prueba = new THREE.PerspectiveCamera();
  let poses = PARADAS.map(() => Pose(V3(0, 0, 0), 180, 30, 5000));
  /** Calcula la pose de cada parada: mira a un punto de la línea sitio → aldea (la fracción que deje más cerca la cámara, repartiendo bien
   *  arriba y abajo) y se pone a la distancia más corta a la que caben los puntos que tienen que verse */
  function calcular(camara, aspecto) {
    poses = PARADAS.map(({ k }) => {
      const P = parada(T, k, aspecto), vista = k === 'vista';
      const alto = (x, z) => sup(x, z) + (vista ? 0 : 20);
      if (P.fijo) return Pose(V3(P.o[0], alto(P.o[0], P.o[1]), P.o[1]), P.b, P.el, P.fijo);
      const pts = P.ptos.map(([x, z, h]) => V3(x, sup(x, z) + h, z));
      const lim = vista ? [.9, -.86, .84] : [.80, -.68, .50];   // |x|, y abajo, y arriba (el resto, para la cartela encima de cada punta)
      const ajusta = o => {
        prueba.copy(camara);
        const cabe = d => { colocar(Pose(o, P.b, P.el, d), prueba); prueba.updateProjectionMatrix();
          return pts.every(p => { const v = p.clone().project(prueba); return Math.abs(v.x) < lim[0] && v.y > lim[1] && v.y < lim[2] && v.z < 1; }); };
        let a = 800, b = 80000; for (let i = 0; i < 22; i++) { const m = (a + b) / 2; if (cabe(m)) b = m; else a = m; }
        return b;
      };
      if (vista) { const o = V3(P.o[0], alto(P.o[0], P.o[1]), P.o[1]); return Pose(o, P.b, P.el, Math.min(ajusta(o), 46000)); }
      const [D, A] = P.ptos; let mejor = null;
      for (let f = .15; f <= .86; f += .05) {   // 0 = mirar al sitio, 1 = mirar a la aldea
        const x = D[0] + (A[0] - D[0]) * f, z = D[1] + (A[1] - D[1]) * f, o = V3(x, alto(x, z), z), d = ajusta(o);
        if (!mejor || d < mejor.d - 1) mejor = { o, d };
      }
      return Pose(mejor.o, P.b, P.el, Math.min(mejor.d, 46000));
    });
    return poses;
  }
  return { Pose, mezclarPose, colocar, calcular, poseDe: F => mezclarPose(poses[F.a], poses[F.b], F.t), get poses() { return poses; }, prueba };
}
