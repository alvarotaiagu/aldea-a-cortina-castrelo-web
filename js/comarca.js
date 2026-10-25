/* ------------------------------------------------------------------
   Aldea Rural A Cortiña · módulo «Cuándo venir» (Comarca)

   Cuatro épocas: febrero (el Entroido de la comarca), primavera, verano y
   otoño. En febrero, el cigarrón de Verín y el peliqueiro de Laza están
   dibujados a plumilla (la tinta del logo) y GIRAN con el scroll, de perfil a
   frente; al girar, la cara se colorea con sus colores. El Maragato de Castrelo
   do Val va en texto: no hay una imagen de referencia fiable (ver
   img/comarca/FUENTES.md).

   Las máscaras no son dos imágenes que se cruzan: son un modelo en 3D muy
   sencillo (la cara es una chapa curvada, la mitra una placa plana, el cuerpo
   un tubo) proyectado a líneas de plumilla en cada fotograma, con el rayado
   siguiendo la forma y la luz fija de la pantalla. Eso hace que al girar el
   rayado se desplace por la cara, como en un dibujo de verdad.

   Contrato: window.Cortina.comarca.montar(el, { movimiento, densidad, fotos? })
   → { destruir() }. El HTML de `el` es el respaldo (lo escribe la web): se
   oculta solo cuando el módulo ya está montado y vuelve con destruir() o si algo
   falla. Para reservar: window.Cortina.reservar(unidad?, { mes }) o, si no
   existe, el enlace a #reservar.

   Movimiento reducido, movimiento:false o densidad sobria: máscaras de frente,
   en color, y los dibujos de las épocas ya trazados. Sin GSAP: el trazo se
   escribe a mano en cada fotograma (si algún día pasa a GSAP: autoRound:false).
   El resize de la barra del móvil no rehace nada (checklist punto 10).
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var enNavegador = typeof window !== 'undefined' && typeof document !== 'undefined';
  var guion = enNavegador && document.currentScript && document.currentScript.src;
  var base = function (ruta) {
    try { return guion ? new URL(ruta, guion).href : ruta.replace(/^\.\.\//, ''); } catch (e) { return ruta.replace(/^\.\.\//, ''); }
  };

  /* ================================================================
     1. LAS MÁSCARAS
     Modelo (unidad: 1 = ancho de la cara). X a la derecha, Y hacia abajo, Z hacia
     quien mira. Giro alrededor del eje vertical: con theta > 0 la cara mira a la
     derecha; theta = 0, de frente. Proyección ortogonal.
     ================================================================ */
  var TINTA = '#1F1A17';
  var PAPEL = '#F4EFE6';
  var K = 250, CX = 250, CY = 288;           // píxeles por unidad y origen en el SVG
  var ANCHO = 500, ALTO = 716;                // viewBox de cada máscara
  var PI = Math.PI;

  var CARAS = {
    cigarron: { nombre: 'cigarrón', cara: '#E3AB78', mitra: '#2B6A58', pelo: '#6E5139', pelica: false, animal: 'lobo', pelos: 1 },
    peliqueiro: { nombre: 'peliqueiro', cara: '#DCA94E', mitra: '#3F7DBB', pelo: '#5E4533', pelica: true, animal: 'leon', pelos: 1.4 }
  };
  var ROJO = '#B4292D', VERDE = '#2F7D43', DIENTE = '#F7F1E4', ORO = '#C99A3A', CAMISA = '#EBE2CF', CAPA = '#FBF8F0', TRAJE = '#B22A2E';

  var lim = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var f1 = function (n) { return (Math.round(n * 10) / 10).toString(); };
  var f3 = function (n) { return (Math.round(n * 1000) / 1000).toString(); };
  // ruido determinista (sin Math.random: el dibujo es siempre el mismo)
  var ruido = function (a, b) {
    var s = Math.sin(a * 127.1 + (b || 0) * 311.7 + 17.3) * 43758.5453;
    return s - Math.floor(s) - 0.5;
  };

  // ---- la cara: una chapa curvada
  var RC = 0.86, ZF = 0.42, ALTO_CARA = 1.15;
  var TABLA_H = [[0, 0.47], [0.12, 0.505], [0.35, 0.525], [0.55, 0.505], [0.75, 0.415], [0.9, 0.265], [1, 0.1]];
  var semi = function (v) {
    v = lim(v, 0, 1);
    for (var i = 1; i < TABLA_H.length; i++) {
      if (v <= TABLA_H[i][0]) {
        var a = TABLA_H[i - 1], b = TABLA_H[i];
        var t = (v - a[0]) / (b[0] - a[0]);
        t = (1 - Math.cos(t * PI)) / 2;
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return TABLA_H[TABLA_H.length - 1][1];
  };
  var cara = function (x0, v) {
    var s = lim(x0 / RC, -0.985, 0.985), fi = Math.asin(s);
    return [x0, ALTO_CARA * v, ZF + RC * (Math.cos(fi) - 1) - 0.21 * v * v];
  };
  var giro = function (th) { return { c: Math.cos(th), s: Math.sin(th) }; };
  var pant = function (r, P) {
    return [(P[0] * r.c + P[2] * r.s) * K + CX, P[1] * K + CY, -P[0] * r.s + P[2] * r.c];
  };
  var normalDe = function (S, a, b) {
    var e = 0.004, A = S(a - e, b), B = S(a + e, b), C = S(a, b - e), D = S(a, b + e);
    var tx = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], ty = [D[0] - C[0], D[1] - C[1], D[2] - C[2]];
    var n = [tx[1] * ty[2] - tx[2] * ty[1], tx[2] * ty[0] - tx[0] * ty[2], tx[0] * ty[1] - tx[1] * ty[0]];
    var l = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  };
  // normal de la cara (en el modelo) → en la pantalla
  var normalCaraPant = function (r, x0, v) {
    var n = normalDe(cara, x0, v);
    return [n[0] * r.c + n[2] * r.s, n[1], -n[0] * r.s + n[2] * r.c];
  };
  var nzCara = function (r, x0, v) { return normalCaraPant(r, x0, v)[2]; };
  var LUZ = (function () { var l = [-0.3, -0.45, 0.84], m = Math.sqrt(l[0] * l[0] + l[1] * l[1] + l[2] * l[2]); return [l[0] / m, l[1] / m, l[2] / m]; })();

  // intervalo visible de x0 en la fila v (null si no se ve nada)
  var intervaloFila = function (r, v) {
    var h = semi(v), N = 24, vis = [], j, x0;
    for (j = 0; j <= N; j++) { x0 = -h + 2 * h * j / N; vis.push(nzCara(r, x0, v) > 0.03); }
    var mejor = null, ini = -1;
    for (j = 0; j <= N + 1; j++) {
      if (j <= N && vis[j]) { if (ini < 0) ini = j; }
      else if (ini >= 0) { var fin = j - 1; if (!mejor || fin - ini > mejor[1] - mejor[0]) mejor = [ini, fin]; ini = -1; }
    }
    if (!mejor) return null;
    var a = -h + 2 * h * mejor[0] / N, b = -h + 2 * h * mejor[1] / N, lo, hi, m, k;
    if (mejor[0] > 0) { lo = a - 2 * h / N; hi = a; for (k = 0; k < 8; k++) { m = (lo + hi) / 2; if (nzCara(r, m, v) > 0.03) hi = m; else lo = m; } a = hi; }
    if (mejor[1] < N) { lo = b; hi = b + 2 * h / N; for (k = 0; k < 8; k++) { m = (lo + hi) / 2; if (nzCara(r, m, v) > 0.03) lo = m; else hi = m; } b = lo; }
    return [a, b];
  };
  var seVe = function (r, x0, v) { return nzCara(r, x0, v) > 0.03; };
  // lleva los puntos invisibles de un adorno hacia su centro hasta que se vean
  var proyectaAdorno = function (r, pts, cx, cv) {
    var out = [], visto = 0, i;
    for (i = 0; i < pts.length; i++) if (seVe(r, pts[i][0], pts[i][1])) visto++;
    if (!visto || !seVe(r, cx, cv)) return null;
    for (i = 0; i < pts.length; i++) {
      var x = pts[i][0], v = pts[i][1];
      if (!seVe(r, x, v)) {
        var lo = 0, hi = 1;
        for (var k = 0; k < 7; k++) { var m = (lo + hi) / 2; if (seVe(r, cx + (x - cx) * m, cv + (v - cv) * m)) lo = m; else hi = m; }
        x = cx + (x - cx) * lo; v = cv + (v - cv) * lo;
      }
      out.push(pant(r, cara(x, v)));
    }
    return out;
  };
  var poli = function (pts, cierra) {
    if (!pts || !pts.length) return '';
    var d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
    for (var i = 1; i < pts.length; i++) d += 'L' + f1(pts[i][0]) + ' ' + f1(pts[i][1]);
    return d + (cierra ? 'Z' : '');
  };
  // curva suave (Catmull-Rom → Bézier) por los puntos
  var curva = function (pts, cierra) {
    var n = pts.length;
    if (n < 3) return poli(pts, cierra);
    var d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
    var P = function (i) { return cierra ? pts[((i % n) + n) % n] : pts[lim(i, 0, n - 1)]; };
    var tope = cierra ? n : n - 1;
    for (var i = 0; i < tope; i++) {
      var p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      d += 'C' + f1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + f1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]);
    }
    return d + (cierra ? 'Z' : '');
  };

  /* ---- adornos de la cara, en (x0, v) ---- */
  var ojo = function (sg) {
    var cx = sg * 0.19, cv = 0.31, w = 0.095, pts = [], i, t, sv, x, v;
    for (i = 0; i < 20; i++) {
      t = i / 20 * PI * 2; sv = Math.sin(t);
      x = cx + w * Math.cos(t);
      v = cv + (sv < 0 ? 0.055 : 0.036) * sv - sg * 0.008 * (x - cx) / w;
      pts.push([x, v]);
    }
    return { pts: pts, cx: cx, cv: cv, w: w };
  };
  var pestanas = function (sg) {
    var o = ojo(sg), out = [], i, t, x, v, dx;
    for (i = 0; i < 7; i++) {
      t = Math.PI * (1.06 + 0.88 * i / 6); // lado de arriba del párpado
      x = o.cx + o.w * Math.cos(t); v = o.cv + 0.055 * Math.sin(t) - sg * 0.008 * (x - o.cx) / o.w;
      dx = sg * (0.01 + 0.012 * (i / 6)) * (x - o.cx < 0 ? -0.4 : 1);
      out.push([[x, v], [x + (x - o.cx) * 0.22, v - 0.036 - 0.006 * ruido(i, sg)]]);
    }
    return out;
  };
  var ceja = function (sg) {
    var up = [], dn = [], i, t, x, v, g;
    for (i = 0; i <= 8; i++) {
      t = i / 8; x = sg * (0.07 + 0.27 * t);
      g = 0.034 * Math.sin(PI * (0.08 + 0.84 * t)) + 0.005;
      v = 0.262 - 0.05 * Math.sin(t * PI * 0.92) + 0.018 * t * t;
      up.push([x, v - g * 0.9]); dn.push([x, v + g * 0.6]);
    }
    return { pts: up.concat(dn.reverse()), cx: sg * 0.2, cv: 0.2 };
  };
  var mejilla = function (sg) {
    var pts = [], i, a, cx = sg * 0.285, cv = 0.495;
    for (i = 0; i < 16; i++) { a = i / 16 * PI * 2; pts.push([cx + 0.06 * Math.cos(a), cv + 0.05 * Math.sin(a)]); }
    return { pts: pts, cx: cx, cv: cv };
  };
  var bocaSup = function (x) { return 0.665 - 0.1 * Math.pow(x / 0.3, 2); };
  var bocaInf = function (x) { var q = lim(1 - Math.pow(x / 0.31, 2), 0, 1); return bocaSup(x) + 0.04 + 0.15 * Math.pow(q, 0.8); };
  var bigote = function () {
    var up = [], dn = [], i, x, t;
    for (i = 0; i <= 14; i++) {
      t = i / 14; x = -0.33 + 0.66 * t;
      up.push([x, bocaSup(x) - 0.004 - 0.004 * Math.abs(Math.sin(t * PI * 3))]);
      dn.push([x, bocaSup(x) + 0.04 * (1 - 0.55 * Math.pow(Math.abs(x) / 0.33, 2))]);
    }
    return { pts: up.concat(dn.reverse()), cx: 0, cv: 0.68 };
  };
  var boca = function () {
    var a = [], b = [], i, x, t;
    for (i = 0; i <= 14; i++) {
      t = i / 14; x = -0.31 + 0.62 * t;
      a.push([x, bocaSup(x) + 0.036 * (1 - 0.55 * Math.pow(Math.abs(x) / 0.33, 2))]);
      b.push([x, bocaInf(x)]);
    }
    return { sup: a, inf: b, pts: a.concat(b.slice().reverse()), cx: 0, cv: 0.76 };
  };
  var perilla = function () { return { pts: [[-0.05, 0.89], [0.05, 0.89], [0, 0.985]], cx: 0, cv: 0.92 }; };

  /* ---- el cuerpo (un tubo elíptico) ---- */
  var semiAncho = function (y) { return 0.33 + 0.56 * Math.sin(Math.min(1, Math.max(0, y - 1.0) / 0.42) * PI / 2); };
  var tubo = function (y, fi, extra) {
    var a = semiAncho(y) + (extra || 0), b = a * 0.58;
    return [a * Math.sin(fi), y, b * Math.cos(fi) - 0.02];
  };
  // intervalo de fi visible en el tubo: normal (sin fi / a, cos fi / b)
  var intervaloTubo = function (r, a, b) {
    var d = Math.atan2(r.s / a, r.c / b);
    return [-PI / 2 - d, PI / 2 - d];
  };
  var arco = function (r, y, f0, f1, n, extra) {
    var out = [], i;
    for (i = 0; i <= n; i++) out.push(pant(r, tubo(y, f0 + (f1 - f0) * i / n, extra)));
    return out;
  };
  // parche de tubo entre dos alturas y un rango de fi → { poli, izq, der, abajo } (o null)
  var parcheTubo = function (r, y0, y1, rango, extra, filas) {
    var a = semiAncho((y0 + y1) / 2) + (extra || 0), b = a * 0.58;
    var iv = intervaloTubo(r, a, b);
    var lo = Math.max(iv[0], rango[0]), hi = Math.min(iv[1], rango[1]);
    if (hi - lo < 0.05) return null;
    var izq = [], der = [], k, y, fi0, fi1, a2, b2, iv2;
    for (k = 0; k <= filas; k++) {
      y = y0 + (y1 - y0) * k / filas;
      a2 = semiAncho(y) + (extra || 0); b2 = a2 * 0.58;
      iv2 = intervaloTubo(r, a2, b2);
      fi0 = Math.max(iv2[0], rango[0]); fi1 = Math.min(iv2[1], rango[1]);
      if (fi1 - fi0 < 0.01) { fi1 = fi0 + 0.01; }
      izq.push(pant(r, tubo(y, fi0, extra))); der.push(pant(r, tubo(y, fi1, extra)));
    }
    var fa = Math.max(intervaloTubo(r, semiAncho(y0) + (extra || 0), (semiAncho(y0) + (extra || 0)) * 0.58)[0], rango[0]);
    var fb = Math.min(intervaloTubo(r, semiAncho(y0) + (extra || 0), (semiAncho(y0) + (extra || 0)) * 0.58)[1], rango[1]);
    var a1 = semiAncho(y1) + (extra || 0);
    var ib = intervaloTubo(r, a1, a1 * 0.58);
    var ga = Math.max(ib[0], rango[0]), gb = Math.min(ib[1], rango[1]);
    var arriba = arco(r, y0, fa, fb, 8, extra), abajo = arco(r, y1, ga, gb, 8, extra);
    return { izq: izq, der: der, arriba: arriba, abajo: abajo, poli: izq.concat(abajo, der.slice().reverse(), arriba.slice().reverse()) };
  };

  /* ---- la pelica (solo el peliqueiro): una teja de piel por detrás de la cabeza ---- */
  var RP = 0.6, DP = 0.46, ZP = 0.13;
  var PSI0 = PI / 3, PSI1 = 5 * PI / 3;
  var pelicaP = function (y, psi) { var k = 0.8 + 0.2 * Math.min(1, Math.max(0, y) / 0.28); return [RP * k * Math.sin(psi), y, DP * k * Math.cos(psi) + ZP]; };
  var bajoPelica = function (psi) { return 0.8 + 0.1 * Math.sin(psi * 5.3) + 0.09 * ruido(Math.round(psi * 12), 4); };


  /* ================================================================
     La máscara como SVG: la estructura se crea una vez y cada fotograma
     solo reescribe el atributo d de sus capas.
     ================================================================ */
  // [clase, tipo]  (de atrás hacia delante). rel: papel + color; tin: tinta; ray: rayado fino;
  // neg: relleno de tinta; bla/roj/ver: relleno plano; ore: trazo dorado; rst: trazo rojo; som: sombra
  var CAPAS = [
    ['cuerpo-r', 'rel'], ['traje-r', 'rel'], ['cuerpo-t', 'tin'],
    ['capa-r', 'rel'], ['capa-f', 'ore'], ['capa-t', 'tin'], ['cuerpo-s', 'ray'], ['corbata-r', 'rel'], ['corbata-t', 'tin'],
    ['pelica-r', 'rel'], ['pelica-t', 'ray'],
    ['pelo-r', 'rel'], ['pelo-t', 'ray'],
    ['cara-r', 'rel'], ['cara-s', 'ray'], ['cara-t', 'tin'],
    ['mej-r', 'rel'], ['mej-t', 'ray'], ['ojo', 'neg'], ['pest', 'pes'], ['ceja', 'neg'],
    ['bigote', 'neg'], ['boca-b', 'bla'], ['boca-t', 'ray'], ['boca-r', 'rst'], ['perilla', 'neg'],
    ['nariz-a', 'rel'], ['nariz-s', 'som'], ['nariz-h', 'ray'], ['nariz-t', 'tin'],
    ['mitra-d', 'neg'], ['mitra-r', 'rel'], '#emblema', ['mitra-t', 'tin'],
    ['borla-h', 'ray'], ['borla-v', 'ver'], ['borla-r', 'roj'], ['borla-t', 'ray']
  ];
  var ANCHOS = { tin: 2.4, ray: 1.15, pes: 1.7, ore: 2.2, rst: 2.0 };

  function crearMascara(tipo, opciones) {
    var def = CARAS[tipo] || CARAS.cigarron;
    var op = opciones || {};
    var colores = {
      'pelica-r': def.pelo, 'cuerpo-r': CAMISA, 'traje-r': TRAJE, 'capa-r': CAPA, 'corbata-r': ROJO, 'pelo-r': def.pelo,
      'cara-r': def.cara, 'mej-r': ROJO, 'nariz-a': def.cara, 'mitra-r': def.mitra
    };
    var rell = { neg: TINTA, bla: DIENTE, roj: ROJO, ver: VERDE, som: TINTA };
    var etiqueta = tipo === 'cigarron' ? 'Dibujo a plumilla del cigarrón de Verín' : 'Dibujo a plumilla del peliqueiro de Laza';
    var svg = '<svg class="mk-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + ANCHO + ' ' + ALTO + '" role="img" aria-label="' + etiqueta + '" focusable="false">';
    svg += '<g class="mk-g" fill="none" stroke="' + TINTA + '" stroke-linecap="round" stroke-linejoin="round">';
    var id = 'mk-' + tipo + (op.sufijo || '');
    CAPAS.forEach(function (c) {
      if (c === '#emblema') { svg += '<g class="mk-emb" transform="matrix(1 0 0 1 0 0)">' + emblemaDe(def.animal) + '</g>'; return; }
      var n = c[0], t = c[1];
      if (def.pelica === false && n.indexOf('pelica') === 0) return;
      if (t === 'rel') {
        svg += '<path class="cp" data-n="' + n + '" d="" fill="' + PAPEL + '" stroke="none"/>';
        svg += '<path class="cp cq" data-n="' + n + '" d="" fill="' + colores[n] + '" fill-opacity="1" stroke="none"/>';
      } else if (rell[t]) {
        svg += '<path class="cp" data-n="' + n + '" d="" fill="' + rell[t] + '"' + (t === 'som' ? ' fill-opacity=".3"' : '') + ' stroke="none"/>';
      } else {
        var col = t === 'ore' ? ORO : t === 'rst' ? ROJO : TINTA;
        svg += '<path class="cp" data-n="' + n + '" d="" fill="none" stroke="' + col + '" stroke-width="' + ANCHOS[t] + '"/>';
      }
    });
    svg += '</g></svg>';
    return { svg: svg, id: id, def: def };
  }

  /* ---- emblemas de la mitra (en unidades de la placa) ---- */
  function emblemaDe(animal) {
    var fino = ' stroke="' + TINTA + '" stroke-width="0.0085" stroke-linecap="round" stroke-linejoin="round"';
    var sinFill = function (t) { return t.replace(/<path (?![^>]*fill=)/g, '<path fill="none" '); };
    var g = '', i, a, rr;
    if (animal === 'lobo') {
      var E = 0.0098, OX = -0.49, OY = -0.9;
      var tr = function (d) { return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, function (m, x, y) { return f3(OX + (+x) * E) + ' ' + f3(OY + (+y) * E); }); };
      g += '<path d="' + tr('M6 45C9 41 15 38 22 34C29 31 35 28 40 21C42 14 44 8 47 2L56 17C59 18 63 19 66 18L78 4C81 12 82 18 83 25C90 33 96 43 99 58C100 66 100 74 100 80L60 80C56 74 50 70 42 66C36 63 30 60 24 57C18 55 12 52 8 49C6 48 5 47 6 45Z') + '" fill="#9A9080"' + fino + '/>';
      g += '<path d="' + tr('M6 45C9 41 15 38 22 34C29 31 33 29 36 27L40 34C34 40 28 48 24 57C18 55 12 52 8 49C6 48 5 47 6 45Z') + '" fill="#CFC6B2" stroke="none"/>';
      g += '<path d="' + tr('M8 49C14 52 20 53 26 54L24 58') + '"' + fino + '/>';
      g += '<path d="' + tr('M28 36C31 33 36 33 40 34C36 38 32 38 28 36Z') + '" fill="' + TINTA + '" stroke="none"/>';
      g += '<path d="' + tr('M3 44C5 41 8 41 10 42L10 47C7 48 4 47 3 44Z') + '" fill="' + TINTA + '" stroke="none"/>';
      g += '<path d="' + tr('M50 24L52 12L55 22M68 24L73 14L74 26') + '"' + fino + '/>';
      var pelos = '';
      var hebra = function (x1, y1, dx, dy) { pelos += 'M' + f3(OX + x1 * E) + ' ' + f3(OY + y1 * E) + 'l' + f3(dx * E) + ' ' + f3(dy * E); };
      for (i = 0; i < 18; i++) hebra(46 + 44 * i / 17, 36 + 34 * i / 17, 3 + 3 * (ruido(i, 1) + 0.5), 7 + 3 * (ruido(i, 2) + 0.5));
      for (i = 0; i < 9; i++) hebra(40 + 38 * i / 8, 29 + 10 * i / 8, 6 + 2 * (ruido(i, 5) + 0.5), 4);
      g += '<path d="' + pelos + '"' + fino + '/>';
      return '<g class="emb" data-animal="lobo">' + sinFill(g) + '</g>';
    }
    // león de frente, melena en llamas
    var cx = 0, cy = -0.52, mel = [];
    for (i = 0; i < 28; i++) {
      a = i / 28 * PI * 2; rr = (i % 2 ? 0.26 : 0.39) + 0.03 * ruido(i, 3);
      mel.push([cx + rr * Math.cos(a), cy + rr * 0.95 * Math.sin(a)]);
    }
    g += '<path d="' + mel.map(function (p, k) { return (k ? 'L' : 'M') + f3(p[0]) + ' ' + f3(p[1]); }).join('') + 'Z" fill="#B9822B"' + fino + '/>';
    var tuft = '';
    for (i = 0; i < 24; i++) { a = i / 24 * PI * 2 + 0.07; tuft += 'M' + f3(cx + 0.2 * Math.cos(a)) + ' ' + f3(cy + 0.2 * Math.sin(a)) + 'L' + f3(cx + 0.31 * Math.cos(a + 0.05)) + ' ' + f3(cy + 0.31 * Math.sin(a + 0.05)); }
    g += '<path d="' + tuft + '"' + fino + '/>';
    g += '<path d="M' + f3(cx - 0.17) + ' ' + f3(cy - 0.14) + 'C' + f3(cx - 0.2) + ' ' + f3(cy + 0.16) + ' ' + f3(cx - 0.08) + ' ' + f3(cy + 0.26) + ' ' + f3(cx) + ' ' + f3(cy + 0.27) + 'C' + f3(cx + 0.08) + ' ' + f3(cy + 0.26) + ' ' + f3(cx + 0.2) + ' ' + f3(cy + 0.16) + ' ' + f3(cx + 0.17) + ' ' + f3(cy - 0.14) + 'C' + f3(cx + 0.08) + ' ' + f3(cy - 0.2) + ' ' + f3(cx - 0.08) + ' ' + f3(cy - 0.2) + ' ' + f3(cx - 0.17) + ' ' + f3(cy - 0.14) + 'Z" fill="#E4BD70"' + fino + '/>';
    g += '<path d="M' + f3(cx - 0.125) + ' ' + f3(cy - 0.06) + 'L' + f3(cx - 0.045) + ' ' + f3(cy - 0.04) + 'M' + f3(cx + 0.125) + ' ' + f3(cy - 0.06) + 'L' + f3(cx + 0.045) + ' ' + f3(cy - 0.04) + '" stroke="' + TINTA + '" stroke-width="0.016" stroke-linecap="round"/>';
    g += '<path d="M' + f3(cx - 0.065) + ' ' + f3(cy + 0.0) + 'L' + f3(cx + 0.065) + ' ' + f3(cy + 0.0) + 'L' + f3(cx) + ' ' + f3(cy + 0.075) + 'Z" fill="' + TINTA + '" stroke="none"/>';
    g += '<path d="M' + f3(cx) + ' ' + f3(cy + 0.075) + 'L' + f3(cx) + ' ' + f3(cy + 0.125) + 'M' + f3(cx - 0.095) + ' ' + f3(cy + 0.125) + 'C' + f3(cx - 0.06) + ' ' + f3(cy + 0.165) + ' ' + f3(cx - 0.02) + ' ' + f3(cy + 0.15) + ' ' + f3(cx) + ' ' + f3(cy + 0.125) + 'C' + f3(cx + 0.02) + ' ' + f3(cy + 0.15) + ' ' + f3(cx + 0.06) + ' ' + f3(cy + 0.165) + ' ' + f3(cx + 0.095) + ' ' + f3(cy + 0.125) + '"' + fino + '/>';
    g += '<path d="M' + f3(cx - 0.13) + ' ' + f3(cy + 0.07) + 'l-0.07 -0.01M' + f3(cx - 0.13) + ' ' + f3(cy + 0.1) + 'l-0.07 0.01M' + f3(cx + 0.13) + ' ' + f3(cy + 0.07) + 'l0.07 -0.01M' + f3(cx + 0.13) + ' ' + f3(cy + 0.1) + 'l0.07 0.01"' + fino + '/>';
    return '<g class="emb" data-animal="leon">' + sinFill(g) + '</g>';
  }

  /* ---------------- un fotograma ---------------- */
  var ZPLACA = function (y) { return 0.47 + 0.08 * y; };
  var placa = function () {
    // contorno de la mitra en (X, Y) de la placa: lados rectos y arco
    var pts = [], i, a;
    pts.push([-0.55, 0.03]); pts.push([-0.55, -0.5]);
    for (i = 1; i < 18; i++) { a = PI - PI * i / 18; pts.push([0.55 * Math.cos(a), -0.5 - 0.55 * Math.sin(a)]); }
    pts.push([0.55, -0.5]); pts.push([0.55, 0.03]);
    return pts;
  };
  var PLACA = placa();
  var proyPlaca = function (r, pts, dz, esc) {
    return pts.map(function (p) {
      var X = p[0], Y = p[1];
      if (esc) { X = X * esc; Y = -0.5 + (Y + 0.5) * esc; }
      return pant(r, [X, Y, ZPLACA(Y) + (dz || 0)]);
    });
  };

  function trazos(tipo, theta) {
    var def = CARAS[tipo] || CARAS.cigarron;
    var r = giro(theta), D = {}, i, j, v, x, p, t, pts;
    var add = function (clave, d) { if (d) D[clave] = (D[clave] || '') + d; };
    var cosT = r.c;

    /* --- cuerpo --- */
    var ct = parcheTubo(r, 1.0, 1.78, [-PI, PI], 0, 10);
    if (ct) {
      D['cuerpo-r'] = poli(ct.poli, true);
      add('cuerpo-t', poli(ct.izq, false) + poli(ct.der, false));
      var tj = parcheTubo(r, 1.5, 1.78, [-PI, PI], 0.012, 4);
      if (tj) { D['traje-r'] = poli(tj.poli, true); add('cuerpo-t', poli(tj.arriba, false)); }
      // pliegues del traje
      for (i = 1; i < 6; i++) { var fi2 = intervaloTubo(r, 0.9, 0.52); var fx = fi2[0] + (fi2[1] - fi2[0]) * i / 6; add('cuerpo-t', poli([pant(r, tubo(1.5, fx, 0.012)), pant(r, tubo(1.78, fx, 0.012))], false)); }
    }
    /* --- capa: dos hombreras con flecos --- */
    var paneles = [[0.62, PI], [-PI, -0.62]];
    paneles.forEach(function (rg, q) {
      var pc = parcheTubo(r, 1.05, 1.5, rg, 0.045, 8);
      if (!pc) return;
      add('capa-r', poli(pc.poli, true));
      add('capa-t', poli(pc.izq, false) + poli(pc.der, false) + poli(pc.arriba, false) + poli(pc.abajo, false));
      add('capa-f', poli(pc.abajo.map(function (pt) { return [pt[0], pt[1] - 4]; }), false));
      for (var fz = 1; fz < 4; fz++) {
        var pa = ptsAlong(pc.arriba, fz / 4), pb = ptsAlong(pc.abajo, fz / 4);
        add('capa-t', 'M' + f1(pa[0]) + ' ' + f1(pa[1] + 7) + 'Q' + f1((pa[0] + pb[0]) / 2 + (q ? 7 : -7)) + ' ' + f1((pa[1] + pb[1]) / 2) + ' ' + f1(pb[0]) + ' ' + f1(pb[1] - 9));
      }
      for (j = 0; j < pc.abajo.length * 3; j++) {
        var u = j / (pc.abajo.length * 3 - 1), k = Math.min(pc.abajo.length - 2, Math.floor(u * (pc.abajo.length - 1))), w = u * (pc.abajo.length - 1) - k;
        var bx = pc.abajo[k][0] + (pc.abajo[k + 1][0] - pc.abajo[k][0]) * w, by = pc.abajo[k][1] + (pc.abajo[k + 1][1] - pc.abajo[k][1]) * w;
        add('capa-t', 'M' + f1(bx) + ' ' + f1(by) + 'l' + f1(0.6 * ruido(j, q)) + ' ' + f1(9 + 3 * ruido(j, 7)));
      }
    });
    /* --- rayado del cuerpo: solo donde la luz no llega --- */
    var hb = '';
    for (i = 0; i < 15; i++) {
      var yy = 1.1 + i * 0.045, a3 = semiAncho(yy), ivb = intervaloTubo(r, a3, a3 * 0.58), run = null;
      for (j = 0; j <= 30; j++) {
        var f = ivb[0] + (ivb[1] - ivb[0]) * j / 30;
        var nx = Math.sin(f) / a3, nz = Math.cos(f) / (a3 * 0.58), ln = Math.sqrt(nx * nx + nz * nz);
        nx /= ln; nz /= ln;
        var q = (nx * r.c + nz * r.s) * LUZ[0] + (-nx * r.s + nz * r.c) * LUZ[2];
        var osc = q < (i % 2 ? 0.34 : 0.18) + 0.04 * ruido(i, j) && !(yy > 1.44 && yy < 1.5);
        if (osc) { if (!run) run = []; run.push(pant(r, tubo(yy, f, yy < 1.5 && Math.abs(f) > 0.62 ? 0.045 : 0))); }
        if ((!osc || j === 30) && run) { if (run.length > 2) hb += poli(run, false); run = null; }
      }
    }
    add('cuerpo-s', hb);

    /* --- corbata --- */
    if (cosT > 0.1) {
      var izqC = [], derC = [];
      for (i = 0; i <= 8; i++) {
        var yy = 1.12 + 0.6 * i / 8, ww = 0.032 + 0.028 * (i / 8) - (i === 8 ? 0.012 : 0);
        var zb = semiAncho(yy) * 0.58 - 0.02 + 0.018;
        izqC.push(pant(r, [-ww, yy, zb])); derC.push(pant(r, [ww, yy, zb]));
      }
      var nudo = [pant(r, [-0.034, 1.06, semiAncho(1.06) * 0.58 - 0.0]), pant(r, [0.034, 1.06, semiAncho(1.06) * 0.58 - 0.0]), pant(r, [0.05, 1.14, semiAncho(1.14) * 0.58 - 0.0]), pant(r, [-0.05, 1.14, semiAncho(1.14) * 0.58 - 0.0])];
      D['corbata-r'] = poli(izqC.concat(derC.reverse()), true) + poli(nudo, true);
      add('corbata-t', poli(izqC.slice().concat(), false) + poli(derC, false));
      add('corbata-t', poli(nudo, true) + poli([pant(r, [0, 1.15, semiAncho(1.15) * 0.58 + 0.0]), pant(r, [0, 1.68, semiAncho(1.68) * 0.58 - 0.0])], false));
    }

    /* --- pelica (solo peliqueiro): capucha de piel por detrás y a los lados --- */
    if (def.pelica) {
      var dd = Math.atan2(r.s / RP, r.c / DP);
      var visA = -PI / 2 - dd, visB = PI / 2 - dd, kk, trozos = [];
      for (kk = -1; kk <= 1; kk++) {
        var A = Math.max(PSI0, visA + 2 * PI * kk), B = Math.min(PSI1, visB + 2 * PI * kk);
        if (B - A > 0.07) trozos.push([A, B]);
      }
      trozos.forEach(function (tz, q) {
        var lo0 = tz[0], hi0 = tz[1], n1 = 14, tope = [], fondo = [], hebras = '';
        for (i = 0; i <= n1; i++) { var ps = lo0 + (hi0 - lo0) * i / n1; tope.push(pant(r, pelicaP(0.02, ps))); }
        for (i = 0; i <= 30; i++) {
          var ps2 = lo0 + (hi0 - lo0) * i / 30;
          var yb = bajoPelica(ps2) + (i % 2 ? 0.1 + 0.06 * ruido(i, 5) : -0.02);
          fondo.push(pant(r, pelicaP(yb, ps2)));
        }
        var lado1 = [], lado2 = [];
        for (i = 0; i <= 6; i++) { lado1.push(pant(r, pelicaP(0.02 + (bajoPelica(lo0) - 0.02) * i / 6, lo0))); lado2.push(pant(r, pelicaP(0.02 + (bajoPelica(hi0) - 0.02) * i / 6, hi0))); }
        add('pelica-r', poli(tope.concat(lado2, fondo.slice().reverse(), lado1.slice().reverse()), true));
        var nh = Math.max(3, Math.round((hi0 - lo0) / 0.075));
        for (j = 0; j <= nh; j++) {
          var psh = lo0 + (hi0 - lo0) * j / nh, ln = [];
          var yfin = bajoPelica(psh) + 0.04 + 0.1 * (ruido(j, 11) + 0.5);
          var ysal = 0.02 + 0.35 * (ruido(j, 3) + 0.5) * (j % 3 === 0 ? 1 : 0);
          for (i = 0; i <= 6; i++) { var yh = ysal + (yfin - ysal) * i / 6; ln.push(pant(r, pelicaP(yh, psh + 0.02 * Math.sin(i * 1.3 + j * 2.1)))); }
          hebras += poli(ln, false);
        }
        add('pelica-t', hebras + poli(tope, false));
      });
    }

    /* --- contorno visible de la cara --- */
    var NV = 30, izq = [], der = [];
    for (i = 0; i <= NV; i++) {
      v = i / NV;
      var iv = intervaloFila(r, v);
      if (iv) { izq.push(pant(r, cara(iv[0], v))); der.push(pant(r, cara(iv[1], v))); }
    }

    /* --- pelo alrededor de la careta --- */
    var fa = def.pelos, vs = [];
    for (i = 0; i <= 16; i++) vs.push(0.16 + 0.84 * i / 16);
    var lado = function (sg) {
      var ext = [], inn = [], k, vv, hh, ff, P2;
      for (k = 0; k < vs.length; k++) {
        vv = vs[k]; hh = semi(vv);
        ff = (0.045 + 0.06 * Math.sin(PI * Math.min(1, (vv - 0.08) / 0.92)) + 0.012 * ruido(k, sg)) * fa;
        P2 = cara(sg * hh, vv);
        inn.push(pant(r, P2));
        ext.push(pant(r, [sg * (hh + ff), P2[1] + 0.014, P2[2] - 0.075]));
      }
      return { ext: ext, inn: inn };
    };
    var L = lado(-1), R = lado(1), chin = [];
    for (i = 0; i <= 8; i++) {
      t = i / 8; x = -0.19 + 0.38 * t;
      var Pc = cara(x * 0.5, 1);
      chin.push(pant(r, [x * 1.15, Pc[1] + 0.065 + 0.05 * Math.sin(PI * t) * fa + 0.012 * ruido(i, 9), Pc[2] - 0.055]));
    }
    var cierre = L.inn.concat(R.inn.slice().reverse());
    var borde = L.ext.concat(chin, R.ext.slice().reverse());
    D['pelo-r'] = poli(borde.concat(cierre.slice().reverse()), true);
    var pel = '';
    var pelos = function (ld) {
      for (var k = 0; k < ld.ext.length; k++) {
        var a = ld.inn[k], b = ld.ext[k], dx = b[0] - a[0], dy = b[1] - a[1];
        for (var m = 0; m < 3; m++) {
          var f = 0.1 + 0.3 * m + 0.08 * ruido(k, m);
          pel += 'M' + f1(a[0] + dx * f) + ' ' + f1(a[1] + dy * f) + 'L' + f1(b[0] + 2 * ruido(m, k)) + ' ' + f1(b[1] + 3 + 3 * ruido(k, m + 3));
        }
      }
    };
    pelos(L); pelos(R);
    for (i = 0; i < chin.length; i++) { var c0 = chin[i]; pel += 'M' + f1(c0[0]) + ' ' + f1(c0[1] - 16) + 'L' + f1(c0[0] + 3 * ruido(i, 1)) + ' ' + f1(c0[1] + 2); }
    D['pelo-t'] = poli(L.ext, false) + poli(chin, false) + poli(R.ext, false) + pel;

    /* --- la cara --- */
    if (izq.length > 2) {
      var contorno = izq.concat(der.slice().reverse());
      var dc = poli(contorno, true);
      D['cara-r'] = dc; D['cara-t'] = dc;
    }
    // rayado que sigue la forma, con la luz fija de la pantalla
    var hatch = '';
    for (i = 1; i < 34; i++) {
      v = i * 0.0295 + 0.01;
      var hh2 = semi(v), seg = null, N = 36;
      for (j = 0; j <= N; j++) {
        x = -hh2 + 2 * hh2 * j / N;
        var visible = seVe(r, x, v) && (v < 0.9 || Math.abs(x) < 0.2);
        var q = 1;
        if (visible) { var nn = normalCaraPant(r, x, v); q = nn[0] * LUZ[0] + nn[1] * LUZ[1] + nn[2] * LUZ[2]; }
        var umbral = (i % 2 ? 0.62 : 0.46) + 0.04 * ruido(i, j);
        var oscuro = visible && q < umbral;
        if (oscuro) { if (!seg) seg = []; seg.push(pant(r, cara(x, v))); }
        if ((!oscuro || j === N) && seg) {
          if (seg.length > 2) hatch += poli(seg.slice(Math.floor(ruido(i, seg.length) + 0.5) + 0), false);
          seg = null;
        }
      }
    }
    D['cara-s'] = hatch;

    /* --- mejillas rojas --- */
    var mj = '', mt = '';
    [-1, 1].forEach(function (sg) {
      var m = mejilla(sg), pp = proyectaAdorno(r, m.pts, m.cx, m.cv);
      if (pp) { mj += poli(pp, true); mt += curva(pp, true); }
    });
    D['mej-r'] = mj; D['mej-t'] = mt;

    /* --- ojos, pestañas, cejas --- */
    var oj = '', pe = '', cj = '';
    [-1, 1].forEach(function (sg) {
      var o = ojo(sg), pp = proyectaAdorno(r, o.pts, o.cx, o.cv);
      if (pp) oj += curva(pp, true);
      pestanas(sg).forEach(function (seg) {
        if (seVe(r, seg[0][0], seg[0][1]) && seVe(r, seg[1][0], seg[1][1])) { var a = pant(r, cara(seg[0][0], seg[0][1])), b = pant(r, cara(seg[1][0], seg[1][1])); pe += 'M' + f1(a[0]) + ' ' + f1(a[1]) + 'L' + f1(b[0]) + ' ' + f1(b[1]); }
      });
      var c = ceja(sg), pc = proyectaAdorno(r, c.pts, c.cx, c.cv);
      if (pc) cj += curva(pc, true);
    });
    D['ojo'] = oj; D['pest'] = pe; D['ceja'] = cj;

    /* --- bigote, boca, perilla --- */
    var bg = bigote(), pb = proyectaAdorno(r, bg.pts, bg.cx, bg.cv);
    if (pb) D['bigote'] = curva(pb, true);
    var bc = boca(), pm = proyectaAdorno(r, bc.pts, bc.cx, bc.cv);
    if (pm) {
      D['boca-b'] = poli(pm, true);
      D['boca-r'] = poli(pm, true);
      var dientes = '';
      for (i = 1; i < 14; i++) {
        var xt = -0.31 + 0.62 * i / 14, ya = bocaSup(xt) + 0.036 * (1 - 0.55 * Math.pow(Math.abs(xt) / 0.33, 2)), yb2 = bocaInf(xt);
        if (seVe(r, xt, ya) && seVe(r, xt, yb2)) { var pa = pant(r, cara(xt, ya)), pb2 = pant(r, cara(xt, yb2)); dientes += 'M' + f1(pa[0]) + ' ' + f1(pa[1]) + 'L' + f1(pb2[0]) + ' ' + f1(pb2[1]); }
      }
      var mid = [];
      for (i = 0; i <= 14; i++) { var xm = -0.3 + 0.6 * i / 14, ym = (bocaSup(xm) + 0.036 + bocaInf(xm)) / 2; if (seVe(r, xm, ym)) mid.push(pant(r, cara(xm, ym))); else { if (mid.length > 1) dientes += poli(mid, false); mid = []; } }
      if (mid.length > 1) dientes += poli(mid, false);
      D['boca-t'] = dientes;
    }
    var pr = perilla(), pq = proyectaAdorno(r, pr.pts, pr.cx, pr.cv);
    if (pq) D['perilla'] = poli(pq, true);

    /* --- la nariz: poliedro --- */
    var Zs = function (xx, vv) { return cara(xx, vv)[2]; };
    var yv = function (vv) { return ALTO_CARA * vv; };
    var N0l = [-0.03, yv(0.2), Zs(-0.03, 0.2) + 0.012], N0r = [0.03, yv(0.2), Zs(0.03, 0.2) + 0.012];
    var Nml = [-0.05, yv(0.4), Zs(0, 0.4) + 0.175], Nmr = [0.05, yv(0.4), Zs(0, 0.4) + 0.175];
    var Ntl = [-0.034, yv(0.575), Zs(0, 0.575) + 0.335], Ntr = [0.034, yv(0.575), Zs(0, 0.575) + 0.335];
    var A0l = [-0.055, yv(0.2), Zs(-0.055, 0.2)], A1l = [-0.1, yv(0.4), Zs(-0.1, 0.4)], A2l = [-0.115, yv(0.59), Zs(-0.115, 0.59) + 0.02];
    var A0r = [0.055, yv(0.2), Zs(0.055, 0.2)], A1r = [0.1, yv(0.4), Zs(0.1, 0.4)], A2r = [0.115, yv(0.59), Zs(0.115, 0.59) + 0.02];
    var caras = [
      { n: 'cresta', p: [N0l, N0r, Nmr, Nml] },
      { n: 'cresta2', p: [Nml, Nmr, Ntr, Ntl] },
      { n: 'izq', p: [N0l, Nml, Ntl, A2l, A1l, A0l], arriba: [N0l, Nml, Ntl], abajo: [A0l, A1l, A2l] },
      { n: 'der', p: [N0r, Nmr, Ntr, A2r, A1r, A0r], arriba: [N0r, Nmr, Ntr], abajo: [A0r, A1r, A2r] },
      { n: 'bajo', p: [Ntl, Ntr, A2r, A2l] }
    ];
    var ref = [0, yv(0.4), Zs(0, 0.4)];   // un punto dentro de la nariz: la normal de cada cara sale hacia fuera de él
    var na = '', ns = '', nh = '', nt = '';
    caras.forEach(function (cf) {
      // normal de Newell, orientada hacia fuera del eje de la nariz
      var nx = 0, ny = 0, nz = 0, cx2 = 0, cy2 = 0, cz2 = 0, m = cf.p.length, a, b;
      for (var k = 0; k < m; k++) { a = cf.p[k]; b = cf.p[(k + 1) % m]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); cx2 += a[0]; cy2 += a[1]; cz2 += a[2]; }
      cx2 /= m; cy2 /= m; cz2 /= m;
      var ln = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= ln; ny /= ln; nz /= ln;
      var abajo = cf.n === 'bajo' ? 0.05 : 0;
      if (nx * (cx2 - ref[0]) + ny * (cy2 - ref[1] - abajo) + nz * (cz2 - ref[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      var nzv = -nx * r.s + nz * r.c;
      if (nzv < 0.05) return;
      var sc = cf.p.map(function (P) { return pant(r, P); });
      var nxv = nx * r.c + nz * r.s;
      var lam = nxv * LUZ[0] + ny * LUZ[1] + nzv * LUZ[2];
      na += poli(sc, true); nt += poli(sc, true);
      if (lam < 0.42) {
        ns += poli(sc, true);
        if (cf.arriba) {
          var s1 = cf.arriba.map(function (P) { return pant(r, P); }), s2 = cf.abajo.map(function (P) { return pant(r, P); });
          for (var h2 = 1; h2 < 7; h2++) {
            var fh = h2 / 7, pa1 = ptsAlong(s1, fh), pa2 = ptsAlong(s2, fh);
            nh += 'M' + f1(pa1[0]) + ' ' + f1(pa1[1]) + 'L' + f1(pa2[0]) + ' ' + f1(pa2[1]);
          }
        }
      }
    });
    D['nariz-a'] = na; D['nariz-s'] = ns; D['nariz-h'] = nh; D['nariz-t'] = nt;

    /* --- la mitra --- */
    var delante = proyPlaca(r, PLACA, 0), detras = proyPlaca(r, PLACA, -0.055);
    D['mitra-d'] = poli(detras, true);
    D['mitra-r'] = poli(delante, true);
    D['mitra-t'] = poli(delante, true) + poli(proyPlaca(r, PLACA, 0.001, 0.925), true) + poli(detras, true);
    // matriz del emblema: (X, Y) de la placa → pantalla
    D._matriz = [K * r.c, 0, K * r.s * 0.08, K, CX + K * r.s * 0.47, CY];

    /* --- borlas --- */
    var bh = '', bv = '', br = '', bt = '';
    [-1, 1].forEach(function (sg) {
      var C = pant(r, [sg * 0.575, 0.21, 0.4]);
      if (C[2] < -0.28) return;
      var tope2 = pant(r, [sg * 0.55, 0.03, ZPLACA(0.03)]);
      var rx = 0.078 * K, ry = 0.104 * K;
      bh += 'M' + f1(tope2[0]) + ' ' + f1(tope2[1]) + 'L' + f1(C[0]) + ' ' + f1(C[1] - ry);
      bv += 'M' + f1(C[0] - rx) + ' ' + f1(C[1]) + 'A' + f1(rx) + ' ' + f1(ry) + ' 0 1 1 ' + f1(C[0] + rx) + ' ' + f1(C[1]) + 'A' + f1(rx) + ' ' + f1(ry) + ' 0 1 1 ' + f1(C[0] - rx) + ' ' + f1(C[1]) + 'Z';
      var yc = C[1] + ry * 0.3, dxc = rx * Math.sqrt(1 - 0.09);
      br += 'M' + f1(C[0] - dxc) + ' ' + f1(yc) + 'A' + f1(rx) + ' ' + f1(ry) + ' 0 0 0 ' + f1(C[0] + dxc) + ' ' + f1(yc) + 'Z';
      bt += 'M' + f1(C[0] - rx) + ' ' + f1(C[1]) + 'A' + f1(rx) + ' ' + f1(ry) + ' 0 1 1 ' + f1(C[0] + rx) + ' ' + f1(C[1]) + 'A' + f1(rx) + ' ' + f1(ry) + ' 0 1 1 ' + f1(C[0] - rx) + ' ' + f1(C[1]) + 'Z';
      for (var k = -3; k <= 3; k++) bt += 'M' + f1(C[0] + k * rx * 0.28) + ' ' + f1(C[1] - ry * 0.6) + 'L' + f1(C[0] + k * rx * 0.3) + ' ' + f1(C[1] + ry * 0.9);
    });
    D['borla-h'] = bh; D['borla-v'] = bv; D['borla-r'] = br; D['borla-t'] = bt;
    return D;
  }
  var ptsAlong = function (pts, f) {
    var n = pts.length - 1, k = Math.min(n - 1, Math.floor(f * n)), w = f * n - k;
    return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * w, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * w];
  };

  // aplica un fotograma a un <svg> ya montado (o devuelve la cadena si no hay DOM)
  function pintarMascara(raiz, tipo, theta, color) {
    var D = trazos(tipo, theta);
    var hijos = raiz.querySelectorAll('path.cp');
    for (var i = 0; i < hijos.length; i++) hijos[i].setAttribute('d', D[hijos[i].getAttribute('data-n')] || '');
    var emb = raiz.querySelector('.mk-emb');
    if (emb) {
      var m = D._matriz;
      emb.setAttribute('transform', 'matrix(' + m.map(function (z) { return Math.round(z * 1000) / 1000; }).join(' ') + ')');
      emb.style.opacity = Math.abs(Math.cos(theta)) < 0.08 ? '0' : '';
    }
    raiz.style.setProperty('--col', String(color));
    var co = String(Math.round(color * 100) / 100);
    var us = raiz.querySelectorAll('path.cq');
    for (var k = 0; k < us.length; k++) us[k].setAttribute('fill-opacity', co);
    // lo que no es «papel + color» (borlas, labio, ribete de la capa y el animal de la mitra) también se colorea con el scroll
    if (!raiz.__fade) {
      raiz.__fade = Array.prototype.slice.call(raiz.querySelectorAll('path[data-n="borla-v"], path[data-n="borla-r"], path[data-n="boca-r"], path[data-n="capa-f"]'));
      raiz.__emb = Array.prototype.slice.call(raiz.querySelectorAll('.mk-emb path')).filter(function (e) { var f = e.getAttribute('fill'); return f && f !== 'none' && f !== TINTA; });
    }
    raiz.__fade.forEach(function (e) { e.style.opacity = co; });
    raiz.__emb.forEach(function (e) { e.setAttribute('fill-opacity', co); });
  }

  // cadena SVG de una máscara en un ángulo y un color (para pruebas y para el respaldo)
  function mascaraSVG(tipo, theta, color, opciones) {
    var m = crearMascara(tipo, opciones);
    var D = trazos(tipo, theta);
    var s = m.svg;
    // rellena los d en orden
    s = s.replace(/<path class="cp( cq)?" data-n="([a-z-]+)" d=""/g, function (x, q, n) { return '<path class="cp' + (q || '') + '" data-n="' + n + '" d="' + (D[n] || '') + '"'; });
    var mm = D._matriz;
    s = s.replace('<g class="mk-emb" transform="matrix(1 0 0 1 0 0)">', '<g class="mk-emb" transform="matrix(' + mm.map(function (z) { return Math.round(z * 1000) / 1000; }).join(' ') + ')"' + (Math.abs(Math.cos(theta)) < 0.08 ? ' style="opacity:0"' : '') + '>');
    var co = color == null ? 1 : color;
    s = s.replace(/(class="cp cq"[^>]*?)fill-opacity="1"/g, '$1fill-opacity="' + co + '"');
    s = s.replace(/<path class="cp" data-n="(borla-v|borla-r|boca-r|capa-f)"/g, '<path class="cp" data-n="$1" opacity="' + co + '"');
    var ie = s.indexOf('<g class="mk-emb"'), fe = s.indexOf('</g></g>', ie);
    if (ie > 0 && fe > ie) s = s.slice(0, ie) + s.slice(ie, fe).replace(/<path ([^>]*?)fill="#(?!1F1A17)([0-9A-Fa-f]{6})"/g, '<path $1fill="#$2" fill-opacity="' + co + '"') + s.slice(fe);
    return s;
  }

  /* ================================================================
     2. EL MÓDULO «CUÁNDO VENIR»
     ================================================================ */
    var RAD = Math.PI / 180;
  var ANGULO0 = 84;                      // perfil de partida (grados)
  var suave = function (t) { t = lim(t, 0, 1); return t * t * (3 - 2 * t); };
  var escapar = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // lo que se dice de cada época (solo ref/DATOS-ALDEA-A-CORTINA.md y las fuentes de img/comarca/FUENTES.md)
  var EPOCAS = {
    febrero: { mes: 2, chip: 'Febrero', titulo: 'Entroido: las máscaras de la comarca', boton: 'Ver fechas de febrero' },
    primavera: {
      mes: 4, chip: 'Primavera', titulo: 'Primavera: el valle a pie', boton: 'Ver fechas de primavera', dibujo: 'valle',
      texto: ['El Támega cruza el sur del municipio. Desde el regato de Porto do Carro se llega a pie a una fervenza (una cascada), y en el municipio hay un mirador, Peña Nofre.']
    },
    verano: {
      mes: 7, chip: 'Julio y agosto', titulo: 'Verano: la piscina', boton: 'Ver fechas de verano', dibujo: 'piscina', foto: 'piscina',
      texto: ['La piscina ovalada de la aldea abre en julio y agosto, con el prado y el bosque delante. En el regato de Pepín hay una zona de baño en verano.']
    },
    otono: {
      mes: 10, chip: 'Otoño', titulo: 'Otoño: vendimia y castillo', boton: 'Ver fechas de otoño', dibujo: 'castillo', dibujo2: 'racimo',
      texto: ['La D.O. Monterrei es el vino de la comarca, y su vendimia es a finales de verano o en otoño. A 10,4 km (21 min en coche) está el castillo de Monterrei, con el Parador.']
    }
  };
  var MASCARAS = [
    {
      tipo: 'cigarron', nombre: 'El cigarrón', pueblo: 'Verín', dist: '8,5 km · 14 min', signo: 1,
      texto: 'El personaje del Entroido de Verín. Lleva una careta de madera pintada, con las mejillas rojas y la sonrisa ancha; encima, una mitra de metal con un animal o un astro pintado. A la cintura, un cinturón de chocas (los cencerros) y, en la mano, la zamarra, un látigo.',
      nota: 'El Entroido de Verín es Fiesta de Interés Turístico Nacional (BOE, 2009).'
    },
    {
      tipo: 'peliqueiro', nombre: 'El peliqueiro', pueblo: 'Laza', dist: '15,3 km · 25 min', signo: -1,
      texto: 'El personaje del Entroido de Laza. Se parece mucho al cigarrón: careta de madera pintada, mitra alta, chocas y zamarra. Lo que lo distingue es la pelica, la piel que le cae por detrás de la careta y que le da el nombre.',
      nota: ''
    }
  ];

  var cache = {};
  var pedir = function (url, tipo) {
    if (!cache[url]) {
      cache[url] = fetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error(url + ' ' + r.status);
        return tipo === 'json' ? r.json() : r.text();
      });
      cache[url].catch(function () { delete cache[url]; });
    }
    return cache[url];
  };
  var limpiarSvg = function (texto) { return texto.replace(/^[\s\S]*?(<svg)/, '$1'); };

  var stickyRoto = function (el) {
    // mientras la cortina tapa, <html> y <body> llevan overflow:hidden; es pasajero y no cuenta
    if (document.documentElement.classList.contains('cortina-activa')) return false;
    var htmlVisible = getComputedStyle(document.documentElement).overflowY === 'visible';
    for (var n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      if (n === document.body && htmlVisible) continue;
      var cs = getComputedStyle(n);
      if (/(hidden|auto|scroll)/.test(cs.overflowX + ' ' + cs.overflowY)) return true;
    }
    return false;
  };

  // ---------- los dibujos de las épocas: se trazan en cadena
  var leerDibujo = function (svg) {
    var grupos = svg.querySelectorAll('g[data-g]'), out = [], G = grupos.length || 1;
    for (var i = 0; i < grupos.length; i++) {
      var hijos = grupos[i].querySelectorAll('path'), n = hijos.length;
      var ini = i / G * 0.78, fin = Math.min(1, ini + 0.34);
      for (var j = 0; j < n; j++) {
        var p = hijos[j];
        var relleno = p.classList.contains('rel');
        var punteado = p.hasAttribute('stroke-dasharray');
        if (!relleno && !punteado) p.setAttribute('pathLength', '1');
        var a = ini + (fin - ini) * 0.6 * (n > 1 ? j / (n - 1) : 0);
        out.push({ el: p, a: a, d: Math.max(0.03, (fin - ini) * 0.4), tipo: relleno || punteado ? 'o' : 'd', est: -1 });
      }
    }
    return out;
  };
  var pintarDibujo = function (piezas, v) {
    for (var i = 0; i < piezas.length; i++) {
      var q = piezas[i];
      var lt = (v - q.a) / q.d;
      var est = lt <= 0 ? 0 : lt >= 1 ? 2 : 1;
      if (est === q.est && est !== 1) continue;
      q.est = est;
      var s = q.el.style;
      // con pathLength = 1, el trazo se dibuja moviendo strokeDashoffset de 1 a 0 sobre un guion de largo 1
      if (est === 0) { s.opacity = '0'; if (q.tipo === 'd') { s.strokeDasharray = '1'; s.strokeDashoffset = '1'; } }
      else if (est === 2) { s.opacity = ''; if (q.tipo === 'd') { s.strokeDashoffset = '0'; s.strokeDasharray = ''; } }
      else if (q.tipo === 'd') { s.opacity = ''; s.strokeDasharray = '1'; s.strokeDashoffset = (1 - lt).toFixed(4); }
      else s.opacity = lt.toFixed(3);
    }
  };

  // ---------- fotos opcionales (de las que genera la web)
  var buscarFoto = function (respaldo, nombre) {
    var imgs = respaldo.querySelectorAll('img');
    var re = new RegExp('(^|/)' + nombre + '-\\d+\\.');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      var src = (im.getAttribute('src') || '') + ' ' + (im.getAttribute('srcset') || '') + ' ' + (im.getAttribute('data-foto') || '');
      if (re.test(src) || im.getAttribute('data-foto') === nombre) return im.closest('picture') || im;
    }
    return null;
  };
  var hacerFoto = function (nombre, alt, fotosJson, opc, respaldo) {
    var sizes = '(min-width: 900px) 360px, calc(100vw - 32px)';
    var del = buscarFoto(respaldo, nombre);
    if (del) {
      var cl = del.cloneNode(true);
      var im = cl.tagName === 'IMG' ? cl : cl.querySelector('img');
      if (im) { im.alt = alt; im.setAttribute('sizes', sizes); im.loading = 'lazy'; im.decoding = 'async'; im.removeAttribute('class'); im.removeAttribute('style'); }
      var srcs = cl.querySelectorAll ? cl.querySelectorAll('source') : [];
      for (var i = 0; i < srcs.length; i++) srcs[i].setAttribute('sizes', sizes);
      return cl;
    }
    var info = null;
    if (fotosJson && fotosJson.length) for (var j = 0; j < fotosJson.length; j++) if (fotosJson[j].nombre === nombre) info = fotosJson[j];
    if (!info || !info.anchos || !info.anchos.length) return null;
    var dir = opc.base || base('../img/fotos/');
    var set = function (ext) { return info.anchos.map(function (a) { return dir + nombre + '-' + a + '.' + ext + ' ' + a + 'w'; }).join(', '); };
    var pic = document.createElement('picture');
    ['avif', 'webp'].forEach(function (ext) {
      var so = document.createElement('source');
      so.type = 'image/' + ext; so.srcset = set(ext); so.sizes = sizes;
      pic.appendChild(so);
    });
    var img = document.createElement('img');
    img.src = dir + nombre + '-' + info.anchos[Math.min(1, info.anchos.length - 1)] + '.jpg';
    img.srcset = set('jpg'); img.sizes = sizes; img.alt = alt; img.loading = 'lazy'; img.decoding = 'async';
    pic.appendChild(img);
    return pic;
  };

  /* ---------------- montaje ---------------- */
  function montar(el, opciones) {
    var opc = opciones || {};
    if (!el || el.dataset.montado === '1' || el.__mnt) return { destruir: function () {} };
    el.__mnt = true;
    var raiz = document.documentElement;
    var mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
    var reduce = mqReduce.matches;
    var vivo = true;
    var limpiar = [];
    var nodo = null, respaldo = [];
    var modo = '';
    var raf = 0, ultimo = 0, enVista = false;
    var anchoVista = innerWidth, altoVista = innerHeight;
    var ent = null, escena = null, mks = [];
    var dibujos = [];
    var obj = 0, p = 0, ult = {};

    var quieto = function () {
      return opc.movimiento === false || reduce || opc.densidad === 'sobria' || raiz.classList.contains('densidad-sobria');
    };

    /* ---------- las máscaras */
    var angulo = function (v) { return ANGULO0 * (1 - suave(v / 0.8)); };
    var colorDe = function (v) { return suave((v - 0.18) / 0.62); };
    var pintarMascaras = function (v) {
      var a = angulo(v), c = colorDe(v);
      var clave = a.toFixed(2) + '|' + c.toFixed(3);
      if (ult.clave === clave) return;
      ult.clave = clave;
      for (var i = 0; i < mks.length; i++) {
        var m = mks[i];
        pintarMascara(m.svg, m.tipo, m.signo * a * RAD, c);
        m.fig.dataset.theta = (m.signo * a).toFixed(1);
        m.fig.dataset.color = c.toFixed(3);
      }
      ent.dataset.progreso = v.toFixed(3);
    };

    var objetivo = function () {
      var vh = altoVista, r = ent.getBoundingClientRect();
      if (modo === 'fijo') {
        var cab = escena.__cab == null ? (escena.__cab = parseFloat(getComputedStyle(escena).top) || 0) : escena.__cab;
        var rec = escena.__rec == null ? (escena.__rec = ent.offsetHeight - escena.offsetHeight) : escena.__rec;
        return lim((cab - r.top) / (rec * 0.86), 0, 1);
      }
      // suelto (móvil): se mide con las propias máscaras, no con la escena (que empieza en el título y el texto:
      // al asomar las máscaras ya iba casi al final y salían giradas). De perfil al asomar por abajo, de frente con el centro a media pantalla.
      var rf = (mks[0] && mks[0].svg ? mks[0].svg.parentNode : escena).getBoundingClientRect(); // el lienzo: la figure es display:contents
      var ini = vh * 0.98, fin = Math.min(ini - 1, vh * 0.5 - rf.height / 2);
      return lim((ini - rf.top) / (ini - fin), 0, 1);
    };

    var paso = function (ahora) {
      raf = 0;
      if (!vivo) return;
      var dt = Math.min(0.1, (ahora - (ultimo || ahora)) / 1000) || 1 / 60;
      ultimo = ahora;
      var dif = obj - p;
      if (dif !== 0) {
        p = Math.abs(dif) < 0.0005 ? obj : p + dif * (1 - Math.exp(-dt / 0.11));
        pintarMascaras(p);
      }
      if (p !== obj) raf = requestAnimationFrame(paso); else ultimo = 0;
    };
    var alScroll = function () {
      if (modo === 'quieto' || !enVista) return;
      var o = objetivo();
      if (o !== obj) { obj = o; if (!raf) { ultimo = 0; raf = requestAnimationFrame(paso); } }
    };

    /* ---------- los dibujos de las épocas: se trazan al entrar */
    var trazados = {};
    var animarDibujo = function (d) {
      if (trazados[d.id]) return;
      trazados[d.id] = true;
      if (modo === 'quieto') { pintarDibujo(d.piezas, 1.01); return; }
      var t0 = performance.now(), dur = 2600;
      var cuadro = function (ahora) {
        if (!vivo) return;
        var v = lim((ahora - t0) / dur, 0, 1.01);
        pintarDibujo(d.piezas, v);
        if (v < 1.01) requestAnimationFrame(cuadro);
      };
      requestAnimationFrame(cuadro);
    };

    /* ---------- modos */
    var ponerModo = function () {
      if (!nodo) return;
      var q = quieto();
      var nuevo = q ? 'quieto' : (innerWidth >= 900 && innerHeight >= 640 && !stickyRoto(nodo) ? 'fijo' : 'suelto');
      if (nuevo === modo) return;
      modo = nuevo;
      nodo.classList.toggle('cm--mov', nuevo !== 'quieto');
      nodo.classList.toggle('cm--quieto', nuevo === 'quieto');
      nodo.classList.toggle('cm--fijo', nuevo === 'fijo');
      nodo.classList.toggle('cm--suelto', nuevo === 'suelto');
      nodo.dataset.modo = nuevo;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      escena.__cab = escena.__rec = null;
      ult = {};
      if (nuevo === 'quieto') { p = obj = 1; pintarMascaras(1); }
      else { p = obj = objetivo(); pintarMascaras(p); }
      dibujos.forEach(function (d) {
        if (nuevo === 'quieto') { pintarDibujo(d.piezas, 1.01); trazados[d.id] = true; }
        else if (!trazados[d.id]) pintarDibujo(d.piezas, 0);
      });
      if (window.ScrollTrigger) { try { window.ScrollTrigger.refresh(); } catch (e) {} }
    };
    var alResize = function () {
      // la barra del móvil cambia el alto: no se rehace nada (checklist punto 10)
      if (innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160) return;
      anchoVista = innerWidth; altoVista = innerHeight;
      escena.__cab = escena.__rec = null;
      ponerModo();
      alScroll();
    };

    /* ---------- construir */
    var construir = function (res) {
      if (!vivo) return;
      var fotosJson = res[0], svgs = res.slice(1);
      var respaldoTmp = document.createElement('div');
      Array.prototype.forEach.call(el.children, function (n) { respaldoTmp.appendChild(n.cloneNode(true)); });

      nodo = document.createElement('div');
      nodo.className = 'cm';
      var E = EPOCAS, h = '';
      // --- febrero: el Entroido
      h += '<article class="cm-ep cm-ent" id="cm-febrero" aria-labelledby="cm-t-feb"><div class="cm-ent-pista"><div class="cm-ent-escena">';
      h += '<header class="cm-cab"><p class="cm-mes">' + E.febrero.chip + '</p><h3 class="cm-titulo" id="cm-t-feb">' + E.febrero.titulo + '</h3>' +
        '<p class="cm-intro">En febrero llega el Entroido, el Carnaval gallego, y los pueblos de alrededor (a entre 5 y 25 minutos en coche de la aldea) salen a la calle con sus máscaras. Cada pueblo tiene la suya, y no son intercambiables. Las fechas del Entroido cambian cada año con el calendario: se confirman antes de reservar.</p></header>';
      h += '<div class="cm-mascaras">';
      MASCARAS.forEach(function (m) {
        h += '<figure class="cm-mk cm-mk--' + m.tipo + '" data-mascara="' + m.tipo + '"><div class="cm-mk-lienzo" aria-hidden="true"></div>' +
          '<figcaption><span class="cm-mk-nom">' + m.nombre + '</span><span class="cm-mk-donde">' + m.pueblo + ' · ' + m.dist + '</span>' +
          '<span class="cm-mk-txt">' + m.texto + '</span>' + (m.nota ? '<span class="cm-mk-nota">' + m.nota + '</span>' : '') + '</figcaption></figure>';
      });
      h += '</div></div></div>';
      h += '<div class="cm-maragato"><h4 class="cm-mar-tit">El Maragato <span>Castrelo do Val · 2,6 km · 5 min</span></h4>' +
        '<p>El Sábado Maragato es el primer sábado de febrero (en 2026 fue el 7). Lo encabeza el Maragato, un traje típico del pueblo que el Concello y la asociación O Casteliño recuperaron. Con él desfilan el Rey de Castrelo, que se corona en el Toural, las Madamas y los Chambergos.</p>' +
        '<p class="cm-mar-fecha">La fecha de 2027, por confirmar.</p></div>';
      h += '<p class="cm-pie-dib">Dibujos orientativos, hechos a partir de fotografías libres de las máscaras: los colores y las mitras cambian de una a otra. Minutos en coche calculados con OpenStreetMap.</p>';
      h += '<p class="cm-accion"><a class="cm-boton" href="#reservar" data-mes="' + E.febrero.mes + '">' + E.febrero.boton + '</a></p>';
      h += '</article>';
      // --- primavera, verano y otoño
      h += '<div class="cm-estaciones">';
      ['primavera', 'verano', 'otono'].forEach(function (k) {
        var e = E[k];
        h += '<article class="cm-ep cm-est cm-est--' + k + '" aria-labelledby="cm-t-' + k + '">';
        h += '<div class="cm-dib" aria-hidden="true" data-dib="' + k + '"></div>';
        h += '<p class="cm-mes">' + e.chip + '</p><h3 class="cm-titulo" id="cm-t-' + k + '">' + e.titulo + '</h3>';
        e.texto.forEach(function (t) { h += '<p class="cm-txt">' + t + '</p>'; });
        if (e.foto) h += '<figure class="cm-foto" data-foto="' + e.foto + '"></figure>';
        h += '<p class="cm-accion"><a class="cm-boton" href="#reservar" data-mes="' + e.mes + '">' + e.boton + '</a></p></article>';
      });
      h += '</div>';
      nodo.innerHTML = h;

      // máscaras
      ent = nodo.querySelector('.cm-ent-pista');
      escena = nodo.querySelector('.cm-ent-escena');
      MASCARAS.forEach(function (m) {
        var fig = nodo.querySelector('.cm-mk--' + m.tipo);
        var lienzo = fig.querySelector('.cm-mk-lienzo');
        var mk = crearMascara(m.tipo, { sufijo: '' });
        lienzo.innerHTML = mk.svg;
        var svg = lienzo.querySelector('svg');
        svg.removeAttribute('role'); svg.removeAttribute('aria-label'); svg.setAttribute('aria-hidden', 'true');
        mks.push({ tipo: m.tipo, signo: m.signo, fig: fig, svg: svg });
      });

      // dibujos de las épocas
      var nombres = ['valle', 'piscina', 'castillo', 'racimo'];
      ['primavera', 'verano', 'otono'].forEach(function (k) {
        var cont = nodo.querySelector('[data-dib="' + k + '"]');
        var lista = [E[k].dibujo].concat(E[k].dibujo2 ? [E[k].dibujo2] : []);
        lista.forEach(function (nom, q) {
          var texto = svgs[nombres.indexOf(nom)];
          if (!texto) return;
          var caja = document.createElement('div');
          caja.className = 'cm-dib-svg cm-dib-svg--' + nom;
          caja.innerHTML = limpiarSvg(texto);
          var s = caja.querySelector('svg');
          s.setAttribute('aria-hidden', 'true'); s.removeAttribute('role'); s.removeAttribute('aria-label'); s.setAttribute('focusable', 'false');
          var tt = s.querySelector('title'); if (tt) tt.parentNode.removeChild(tt);
          cont.appendChild(caja);
          dibujos.push({ id: k + q, caja: caja, svg: s, piezas: leerDibujo(s) });
        });
      });

      // fotos (si la web las tiene)
      Array.prototype.forEach.call(nodo.querySelectorAll('.cm-foto'), function (fg) {
        var f = hacerFoto(fg.dataset.foto, 'La piscina ovalada de la aldea, con el prado y el bosque detrás', fotosJson, opc, respaldoTmp);
        if (f) fg.appendChild(f); else fg.parentNode.removeChild(fg);
      });

      // botones → la web (si no existe, el enlace a #reservar)
      Array.prototype.forEach.call(nodo.querySelectorAll('.cm-boton'), function (a) {
        a.addEventListener('click', function (ev) {
          var C = window.Cortina;
          if (C && typeof C.reservar === 'function') { ev.preventDefault(); C.reservar(undefined, { mes: +a.dataset.mes }); }
        });
      });

      // respaldo fuera (se guarda para destruir)
      respaldo = Array.prototype.slice.call(el.children).map(function (n) { var hd = n.hidden; n.hidden = true; return { n: n, h: hd }; });
      el.appendChild(nodo);
      el.dataset.montado = '1';
      ponerModo();

      // observadores
      var io = new IntersectionObserver(function (ent2) {
        ent2.forEach(function (e) { enVista = e.isIntersecting; });
        if (enVista) alScroll();
      }, { rootMargin: '60% 0px 60% 0px' });
      io.observe(ent);
      limpiar.push(function () { io.disconnect(); });
      var ioD = new IntersectionObserver(function (lista) {
        lista.forEach(function (e) {
          if (!e.isIntersecting) return;
          dibujos.forEach(function (d) { if (d.caja.parentNode === e.target || d.caja === e.target) animarDibujo(d); });
          ioD.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -18% 0px', threshold: 0 });
      dibujos.forEach(function (d) { ioD.observe(d.caja); });
      limpiar.push(function () { ioD.disconnect(); });
      window.addEventListener('scroll', alScroll, { passive: true });
      window.addEventListener('resize', alResize);
      limpiar.push(function () { window.removeEventListener('scroll', alScroll); window.removeEventListener('resize', alResize); });
      var mo = new MutationObserver(function () { ponerModo(); alScroll(); });
      mo.observe(raiz, { attributes: true, attributeFilter: ['class'] });
      limpiar.push(function () { mo.disconnect(); });
      var alMq = function () { reduce = mqReduce.matches; ponerModo(); };
      if (mqReduce.addEventListener) { mqReduce.addEventListener('change', alMq); limpiar.push(function () { mqReduce.removeEventListener('change', alMq); }); }
      alScroll();
    };

    var dir = opc.svg || base('../img/comarca/');
    var fotosUrl = opc.fotosJson || base('../img/fotos/fotos.json');
    Promise.all([pedir(fotosUrl, 'json').catch(function () { return null; })]
      .concat(['valle', 'piscina', 'castillo', 'racimo'].map(function (n) { return pedir(dir + n + '.svg').catch(function () { return ''; }); })))
      .then(construir).catch(function (err) {
        if (nodo && nodo.parentNode) nodo.parentNode.removeChild(nodo);
        respaldo.forEach(function (r) { r.n.hidden = r.h; });
        delete el.dataset.montado; el.__mnt = false;
        if (window.console) console.warn('[comarca] se queda el respaldo:', err && err.message);
      });

    return {
      destruir: function () {
        vivo = false;
        if (raf) cancelAnimationFrame(raf);
        limpiar.forEach(function (f) { try { f(); } catch (e) {} });
        if (nodo && nodo.parentNode) nodo.parentNode.removeChild(nodo);
        respaldo.forEach(function (r) { r.n.hidden = r.h; });
        delete el.dataset.montado; el.__mnt = false;
        mks = []; dibujos = [];
        if (window.ScrollTrigger) { try { window.ScrollTrigger.refresh(); } catch (e) {} }
      }
    };
  }

  var api = { CARAS: CARAS, crearMascara: crearMascara, trazos: trazos, mascaraSVG: mascaraSVG, pintarMascara: pintarMascara, K: K, ANCHO: ANCHO, ALTO: ALTO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (enNavegador) {
    window.Cortina = window.Cortina || {};
    window.Cortina.comarca = { montar: montar, EPOCAS: EPOCAS, _motor: api };
  }
})();
