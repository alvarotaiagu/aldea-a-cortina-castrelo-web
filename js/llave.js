/* ------------------------------------------------------------------
   Aldea Rural A Cortiña · cortina «La llave» (agente Entrada).
   Una puerta de madera con su cerradura. La llave de hierro de su foto entra desde fuera de cuadro, se mete en
   la bocallave, gira un cuarto de vuelta (con un rebote mínimo de pestillo) y la puerta se abre hacia dentro
   (rotateY con bisagra a la izquierda, perspectiva 3D en CSS, sin WebGL), con una franja de luz cálida por la
   rendija. Debajo ya está la portada. Unos 2,8 s.

   Contrato (ver ENCARGO.md): window.Cortina.llave.montar(el, opciones) -> { destruir() }.
   El puente (Cortina.cortina: alAbrirse, alRetirarse, abrir, retirar, marcas) lo pone el script de
   partes/cortina.html ANTES que este fichero: así existe desde el primer pintado y los demás módulos pueden
   suscribirse aunque este fichero tarde. Este fichero solo hace la animación y se arranca solo.

   - alAbrirse(fn) se llama cuando EMPIEZA a abrirse la puerta (no cuando acaba).
   - Se salta (la cortina se retira sin animar) si la página tardó más de 2 s en arrancar, con movimiento
     reducido y con densidad sobria.
   - Reloj que no se traga los atascos: un fotograma de más de 0,1 s cuenta como 1/30 s.
   ------------------------------------------------------------------ */
(function (w, d) {
  'use strict';
  var C = w.Cortina = w.Cortina || {};

  var PI = Math.PI;
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var suave = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var easeOutQuart = function (t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 4); };
  var easeInOutCubic = function (t) { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var easeInCubic = function (t) { t = clamp(t, 0, 1); return t * t * t; };
  // rebote mínimo de pestillo: pasa un 2-3 % de largo y vuelve (easeOutBack suave)
  var easeOutBack = function (t, c1) {
    t = clamp(t, 0, 1); c1 = c1 == null ? .9 : c1;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  // tiempos (ms desde que arranca la animación)
  var T = {
    entra0: 110, entra1: 880,      // la llave llega a la cerradura
    mete1: 1120,                   // y se mete
    gira0: 1180, gira1: 1600,      // cuarto de vuelta
    abre: 1640,                    // clic: empieza a abrirse (alAbrirse)
    puerta1: 2740,                 // puerta del todo abierta
    fuera: 2780                    // la cortina se retira
  };

  var quieto = function (op) {
    var q = false;
    try { q = w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    return q || (op && (op.movimiento === false || op.densidad === 'sobria')) || d.documentElement.classList.contains('densidad-sobria');
  };

  function montar(el, op) {
    op = op || {};
    var cort = (el && el.id === 'cortina') ? el : d.getElementById('cortina');
    var CC = C.cortina;
    if (!cort || !CC) return { destruir: function () {} };
    if (cort.__llave) return cort.__llave;
    var marcas = CC.marcas = CC.marcas || {};
    var asa = { destruir: destruir };
    cort.__llave = asa;
    marcas.montado = Math.round(w.performance.now());

    // sin animación: movimiento reducido, sobria, o la página ya tardó más de 2 s en arrancar
    if (quieto(op)) { marcas.quieto = true; CC.retirar(); return asa; }
    if (w.performance.now() > 2000 && !op.forzar) { marcas.tarde = true; CC.retirar(); return asa; }

    var hoja = cort.querySelector('.cortina__hoja');
    var escena = cort.querySelector('.cortina__escena');
    var luz = cort.querySelector('.cortina__luz');
    var sombra = cort.querySelector('.cortina__sombra');
    var cerradura = cort.querySelector('.cortina__cerradura');
    var disco = cort.querySelector('.cortina__disco');
    var caja = cort.querySelector('.cortina__llave-caja');
    var llave = cort.querySelector('.cortina__llave');
    var gira = cort.querySelector('.cortina__llave-gira');
    if (!hoja || !escena || !disco || !llave || !gira || !caja) { CC.retirar(); return asa; }

    CC.enMarcha = true;
    cort.classList.add('es-lista');

    // ---------- geometría (px, en coordenadas de la hoja, que al empezar no tiene transform) ----------
    var vw = cort.clientWidth || w.innerWidth, vh = cort.clientHeight || w.innerHeight;
    var hr = hoja.getBoundingClientRect();
    var dr = disco.getBoundingClientRect();
    var hx = dr.left + dr.width / 2 - hr.left, hy = dr.top + dr.height / 2 - hr.top; // la bocallave, en la hoja
    var sx = dr.left + dr.width / 2, sy = dr.top + dr.height / 2;                    // y en pantalla
    var vmin = Math.min(vw, vh);
    var KW = +llave.dataset.w, KH = +llave.dataset.h, PX = +llave.dataset.px, PY = +llave.dataset.py;
    var L = clamp(vmin * 0.56, 200, 540);          // largo de la llave en pantalla
    var s = L / KH;
    llave.style.width = (KW * s).toFixed(1) + 'px';
    // dirección en que viene (de la bocallave hacia la anilla): abajo a la derecha
    var D = vw >= vh ? [0.82, 0.57] : [0.66, 0.75];
    var nD = Math.hypot(D[0], D[1]); D = [D[0] / nD, D[1] / nD];
    var theta = Math.atan2(D[0], -D[1]) * 180 / PI;   // giro de la llave: su punta (abajo) mira hacia la bocallave
    // distancia a la que la punta ya está fuera de cuadro
    var tx = D[0] > 0 ? (vw + 60 - sx) / D[0] : 1e9, ty = D[1] > 0 ? (vh + 60 - sy) / D[1] : 1e9;
    var d0 = Math.min(tx, ty) + 70;
    var dToca = L * 0.05, dDentro = -L * 0.34;
    // todo lo que ya pasó de la bocallave (hacia dentro de la puerta) se recorta: la llave «entra»
    var P = [-D[1], D[0]], BIG = 5000;
    var pt = function (a, b) { return (hx + P[0] * a + D[0] * b).toFixed(1) + 'px ' + (hy + P[1] * a + D[1] * b).toFixed(1) + 'px'; };
    caja.style.clipPath = caja.style.webkitClipPath = 'polygon(' + [pt(BIG, 0), pt(BIG, BIG), pt(-BIG, BIG), pt(-BIG, 0)].join(',') + ')';

    function pintarLlave(dist, rod) {
      var tx_ = hx + D[0] * dist, ty_ = hy + D[1] * dist;
      llave.style.transform = 'translate(' + tx_.toFixed(1) + 'px,' + ty_.toFixed(1) + 'px) rotate(' + theta.toFixed(2) + 'deg) translate(' + (-PX * s).toFixed(1) + 'px,' + (-PY * s).toFixed(1) + 'px)';
      // el giro sobre su eje: la llave de cara se ve de canto (proyección de un cuarto de vuelta, con su grosor)
      gira.style.transform = 'scaleX(' + Math.max(0.13, Math.cos(clamp(rod, 0, 1) * PI / 2)).toFixed(3) + ')';
    }
    var discoBase = -53;
    var persp = parseFloat(w.getComputedStyle(cort).perspective) || Math.max(900, vw * 1.25);

    function pintar(t) {
      // ----- la llave -----
      var dist;
      if (t <= T.entra0) dist = d0;
      else if (t < T.entra1) dist = lerp(d0, dToca, easeOutQuart((t - T.entra0) / (T.entra1 - T.entra0)));
      else if (t < T.mete1) dist = lerp(dToca, dDentro, easeInOutCubic((t - T.entra1) / (T.mete1 - T.entra1)));
      else dist = dDentro;
      var pg = t <= T.gira0 ? 0 : easeOutBack((t - T.gira0) / (T.gira1 - T.gira0), .9);
      if (t >= T.entra0 && llave.style.opacity !== '1') llave.style.opacity = '1';
      pintarLlave(dist, pg);
      disco.style.transform = 'translate(-50%,-50%) rotate(' + (discoBase + 90 * pg).toFixed(2) + 'deg)';
      // sacudida del pestillo al llegar al tope
      var sac = t > T.gira1 - 90 && t < T.gira1 + 120 ? Math.sin(clamp((t - (T.gira1 - 90)) / 210, 0, 1) * PI) : 0;
      cerradura.style.transform = 'translate(-50%,-52%) scale(' + (1 + 0.014 * sac).toFixed(4) + ')';

      // ----- la puerta -----
      var p = clamp((t - T.abre) / (T.puerta1 - T.abre), 0, 1);
      if (p <= 0) {
        hoja.style.transform = ''; escena.style.transform = '';
        luz.style.opacity = '0'; sombra.style.opacity = '0'; hoja.style.opacity = '';
        return;
      }
      // arranque con algo de velocidad (vista de frente la rendija apenas crece en los primeros grados)
      var e = 0.34 * p + 0.66 * easeInOutCubic(p);
      var ang = 87 * e;
      var push = 0.5 * persp * easeInCubic((p - 0.18) / 0.82);   // la cámara avanza y la hoja sale de cuadro
      hoja.style.transform = 'rotateY(' + ang.toFixed(2) + 'deg)';
      escena.style.transform = 'translateZ(' + push.toFixed(1) + 'px)';
      sombra.style.opacity = (0.7 * e).toFixed(3);
      hoja.style.opacity = (1 - suave((p - 0.72) / 0.28)).toFixed(3);
      luz.style.opacity = (0.97 * suave(ang / 15) * (1 - suave((ang - 36) / 40))).toFixed(3);
    }

    // ---------- reloj ----------
    // Un atasco suelto (fuentes, pintado en frío) no se traga el arranque: durante el primer segundo real, un
    // fotograma de más de 0,1 s cuenta como 1/30 s. Pasado ese segundo el reloj es el real, y hay tres topes de
    // seguridad para móviles lentos: (1) si en 1,2 s reales apenas se han pintado 8 fotogramas, el aparato no
    // aguanta la animación y se salta; (2) la animación no puede durar más de 4,2 s reales; (3) alAbrirse no
    // espera más de 2,8 s reales (la web se monta cuando se abre la puerta).
    var raf = 0, t = 0, antes = 0, yaAbrio = false, vivo = true, real0 = 0, fotogramas = 0;
    function marco(ahora) {
      if (!vivo) return;
      if (!real0) real0 = ahora;
      var real = ahora - real0;
      var dt = antes ? ahora - antes : 16;
      antes = ahora;
      fotogramas++;
      t += (dt > 100 && real < 1000) ? 33 : dt;
      if (real > 1200 && fotogramas < 8) { marcas.lento = true; saltar(); return; }
      if (!yaAbrio && real > 2800) { t = Math.max(t, T.abre); }
      pintar(t);
      if (!yaAbrio && t >= T.abre) { yaAbrio = true; marcas.abre = Math.round(w.performance.now()); CC.abrir(); }
      if (t >= T.fuera || real > 4200) { if (real > 4200) marcas.tope = true; fin(); return; }
      raf = w.requestAnimationFrame(marco);
    }
    function saltar() {
      // sin animar el resto: se abre y se retira (la portada se monta debajo y listo)
      vivo = false;
      if (!yaAbrio) { yaAbrio = true; marcas.abre = Math.round(w.performance.now()); CC.abrir(); }
      marcas.fuera = Math.round(w.performance.now());
      CC.retirar();
    }
    function fin() {
      vivo = false;
      marcas.fuera = Math.round(w.performance.now());
      CC.retirar();
    }
    function destruir() {
      vivo = false;
      w.cancelAnimationFrame(raf);
      if (!CC.fuera) CC.retirar();
    }

    pintar(0);
    marcas.inicio = Math.round(w.performance.now());
    raf = w.requestAnimationFrame(marco);
    return asa;
  }

  C.llave = {
    montar: montar,
    alAbrirse: function (f) { if (C.cortina) C.cortina.alAbrirse(f); },
    alRetirarse: function (f) { if (C.cortina) C.cortina.alRetirarse(f); },
    tiempos: T
  };

  // se arranca solo (como lo hacía grano.js en Tulla): la parte ya dejó html.cortina-activa si hay que animar
  function arrancar() {
    if (!C.cortina || C.cortina.fuera) return;
    if (!d.documentElement.classList.contains('cortina-activa')) return;
    montar(d.getElementById('cortina'), {});
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})(window, document);
