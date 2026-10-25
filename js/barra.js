/* ------------------------------------------------------------------
   Aldea Rural A Cortiña · módulo «La barra» (Burguer Rural)

   El logo «Burguer Rural · Disfruta como un jabalí» tal cual (el PNG de su web,
   sin redibujar), la frase de su web, las cinco categorías de su carta y la
   «Burguer Rural XXL», que se MONTA CAPA A CAPA con el scroll: pan de abajo,
   carne, queso, tomate, lechuga y pan de arriba, cada una cae y rebota un poco;
   al final se estampa el rótulo «XXL». Es una ILUSTRACIÓN genérica (dibujo a
   plumilla con relleno plano): no consta la receta de la XXL, y lo dice.

   Sin precios, sin ingredientes, sin horarios: nada de eso consta.

   Contrato: window.Cortina.barra.montar(el, { movimiento, densidad, logo? })
   → { destruir() }. El HTML de `el` es el respaldo (lo escribe la web): se oculta
   solo cuando el módulo ya está montado y vuelve con destruir() o si algo falla.
   El logo se toma del respaldo (el <img> cuyo alt o src diga «burguer»); si no hay,
   de opciones.logo.

   Movimiento reducido, movimiento:false o densidad sobria: la hamburguesa ya
   montada y el rótulo puesto. Sin GSAP: cada capa se escribe a mano en cada
   fotograma. El resize de la barra del móvil no rehace nada (checklist punto 10).
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var guion = document.currentScript && document.currentScript.src;
  var base = function (ruta) {
    try { return guion ? new URL(ruta, guion).href : ruta.replace(/^\.\.\//, ''); } catch (e) { return ruta.replace(/^\.\.\//, ''); }
  };

  var TELEFONO = { texto: '988 41 92 15', href: 'tel:+34988419215' };
  var CATEGORIAS = ['Hamburguesas', 'Bocadillos', 'Perritos calientes', 'Raciones', 'Postres'];
  // fases del progreso (0..1): cada capa tiene su ventana; después, el sello
  var CAPA_INI = 0.03, CAPA_PASO = 0.12, CAPA_DUR = 0.16;
  var SELLO = [0.81, 0.93];
  var CAIDA = 330;                        // unidades del dibujo desde las que cae cada capa

  var lim = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var suave = function (t) { t = lim(t, 0, 1); return t * t * (3 - 2 * t); };
  var tramo = function (v, a) { return lim((v - a[0]) / (a[1] - a[0]), 0, 1); };
  var escapar = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* La caída: acelera hasta el golpe (60 % del tiempo), rebota un poco hacia arriba y se posa.
     Devuelve { y: fracción de la caída que falta (1 arriba, 0 en su sitio, un poco más de 0 al rebotar), aplasta } */
  var caida = function (t) {
    if (t <= 0) return { y: 1, aplasta: 0 };
    if (t >= 1) return { y: 0, aplasta: 0 };
    var corte = 0.6;
    if (t < corte) { var s = t / corte; return { y: 1 - s * s, aplasta: 0 }; }
    var u = (t - corte) / (1 - corte);
    return { y: 0.065 * Math.sin(Math.PI * u) * (1 - u) + 0.02 * Math.abs(Math.sin(Math.PI * 3 * u)) * (1 - u) * (1 - u), aplasta: Math.sin(Math.PI * Math.min(1, u * 1.6)) * (1 - u) };
  };
  var salida = function (t) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  var cache = {};
  var pedir = function (url) {
    if (!cache[url]) {
      cache[url] = fetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error(url + ' ' + r.status);
        return r.text();
      });
      cache[url].catch(function () { delete cache[url]; });
    }
    return cache[url];
  };
  var limpiarSvg = function (texto) { return texto.replace(/^[\s\S]*?(<svg)/, '$1'); };

  var stickyRoto = function (el) {
    if (document.documentElement.classList.contains('cortina-activa')) return false;
    var htmlVisible = getComputedStyle(document.documentElement).overflowY === 'visible';
    for (var n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      if (n === document.body && htmlVisible) continue;
      var cs = getComputedStyle(n);
      if (/(hidden|auto|scroll)/.test(cs.overflowX + ' ' + cs.overflowY)) return true;
    }
    return false;
  };

  var buscarLogo = function (respaldo) {
    var imgs = respaldo.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      var t = ((im.getAttribute('alt') || '') + ' ' + (im.getAttribute('src') || '') + ' ' + (im.getAttribute('data-logo') || '')).toLowerCase();
      if (/burguer|gloton|jabal/.test(t)) return im;
    }
    return null;
  };

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
    var pista = null, escena = null, fig = null, capas = [], sello = null;
    var p = 0, obj = 0, ult = {};

    var quieto = function () {
      return opc.movimiento === false || reduce || opc.densidad === 'sobria' || raiz.classList.contains('densidad-sobria');
    };

    /* ---------- pintar la hamburguesa en el progreso v */
    var pintar = function (v) {
      var clave = v.toFixed(4);
      if (ult.clave === clave) return;
      ult.clave = clave;
      var aterrizadas = 0, i;
      for (i = 0; i < capas.length; i++) {
        var c = capas[i];
        var t = lim((v - (CAPA_INI + i * CAPA_PASO)) / CAPA_DUR, 0, 1);
        var cd = caida(t);
        var estado = t <= 0 ? 'oculta' : t >= 1 ? 'posada' : 'cae';
        if (estado === 'posada') aterrizadas++;
        var s = c.el.style;
        if (estado === 'oculta') { if (c.est !== 'oculta') { s.opacity = '0'; s.transform = ''; } }
        else if (estado === 'posada') { if (c.est !== 'posada') { s.opacity = ''; s.transform = ''; } }
        else {
          s.opacity = lim(t * 5, 0, 1).toFixed(3);
          s.transform = 'translateY(' + (-cd.y * (modo === 'fijo' ? CAIDA : CAIDA * 0.62)).toFixed(1) + 'px) rotate(' + ((i % 2 ? 1 : -1) * 3.2 * Math.max(0, cd.y)).toFixed(2) + 'deg) scale(' + (1 + 0.025 * cd.aplasta).toFixed(4) + ',' + (1 - 0.05 * cd.aplasta).toFixed(4) + ')';
        }
        c.est = estado;
        c.el.dataset.estado = estado;
      }
      // el sello «XXL»
      var ts = tramo(v, SELLO);
      var k = ts <= 0 ? 0 : salida(ts);
      sello.style.opacity = ts <= 0 ? '0' : lim(ts * 6, 0, 1).toFixed(3);
      sello.style.transform = ts <= 0 ? 'scale(1) rotate(-8deg)' : 'scale(' + (1 + 1.6 * (1 - k)).toFixed(3) + ') rotate(' + (-8 - 8 * (1 - k)).toFixed(2) + 'deg)';
      sello.dataset.visible = ts > 0 ? '1' : '0';
      // al estamparse, la hamburguesa da un saltito
      var sacude = ts > 0 && ts < 0.6 ? Math.sin(ts / 0.6 * Math.PI) * -5 : 0;
      fig.style.transform = sacude ? 'translateY(' + sacude.toFixed(2) + 'px)' : '';
      pista.dataset.progreso = v.toFixed(3);
      pista.dataset.capas = String(aterrizadas);
    };

    var objetivo = function () {
      var vh = altoVista;
      if (modo === 'fijo') {
        var r = pista.getBoundingClientRect();
        var cab = escena.__cab == null ? (escena.__cab = parseFloat(getComputedStyle(escena).top) || 0) : escena.__cab;
        var rec = escena.__rec == null ? (escena.__rec = pista.offsetHeight - escena.offsetHeight) : escena.__rec;
        return lim((cab - r.top) / (rec * 0.9), 0, 1);
      }
      var rf = fig.getBoundingClientRect();
      var ini = vh * 0.92, fin = Math.max(vh * 0.06, (vh - rf.height) / 2 - vh * 0.04);
      return lim((ini - rf.top) / (ini - fin), 0, 1);
    };

    var paso = function (ahora) {
      raf = 0;
      if (!vivo) return;
      var dt = Math.min(0.1, (ahora - (ultimo || ahora)) / 1000) || 1 / 60;
      ultimo = ahora;
      var dif = obj - p;
      if (dif !== 0) {
        p = Math.abs(dif) < 0.0004 ? obj : p + dif * (1 - Math.exp(-dt / 0.07));
        pintar(p);
      }
      if (p !== obj) raf = requestAnimationFrame(paso); else ultimo = 0;
    };
    var alScroll = function () {
      if (modo === 'quieto' || !enVista) return;
      var o = objetivo();
      if (o !== obj) { obj = o; if (!raf) { ultimo = 0; raf = requestAnimationFrame(paso); } }
    };

    var ponerModo = function () {
      if (!nodo) return;
      var q = quieto();
      var nuevo = q ? 'quieto' : (innerWidth >= 900 && innerHeight >= 600 && !stickyRoto(nodo) ? 'fijo' : 'suelto');
      if (nuevo === modo) return;
      modo = nuevo;
      nodo.classList.toggle('br--mov', nuevo !== 'quieto');
      nodo.classList.toggle('br--quieto', nuevo === 'quieto');
      nodo.classList.toggle('br--fijo', nuevo === 'fijo');
      nodo.classList.toggle('br--suelto', nuevo === 'suelto');
      nodo.dataset.modo = nuevo;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      escena.__cab = escena.__rec = null;
      ult = {};
      capas.forEach(function (c) { c.est = ''; });
      if (nuevo === 'quieto') { p = obj = 1; pintar(1); }
      else { p = obj = objetivo(); pintar(p); }
      if (window.ScrollTrigger) { try { window.ScrollTrigger.refresh(); } catch (e) {} }
    };
    var alResize = function () {
      if (innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160) return;
      anchoVista = innerWidth; altoVista = innerHeight;
      escena.__cab = escena.__rec = null;
      ponerModo();
      alScroll();
    };

    var construir = function (textoSvg) {
      if (!vivo) return;
      var respaldoTmp = document.createElement('div');
      Array.prototype.forEach.call(el.children, function (n) { respaldoTmp.appendChild(n.cloneNode(true)); });
      var logoOrig = buscarLogo(respaldoTmp);

      nodo = document.createElement('div');
      nodo.className = 'br';
      var h = '<div class="br-pista"><div class="br-escena"><div class="br-texto">';
      h += '<figure class="br-logo"></figure>';
      h += '<p class="br-frase">Comida para llevar o a domicilio. Se pide por teléfono.</p>';
      h += '<ul class="br-cartas" aria-label="Categorías de la carta">';
      CATEGORIAS.forEach(function (c, i) { h += '<li><span class="br-num" aria-hidden="true">' + (i < 9 ? '0' : '') + (i + 1) + '</span>' + escapar(c) + '</li>'; });
      h += '</ul>';
      var notaOrig = respaldoTmp.querySelector('.barra__nota');
      if (notaOrig && notaOrig.textContent.trim()) h += '<p class="br-nota">' + escapar(notaOrig.textContent.trim()) + '</p>';
      h += '<p class="br-llamar"><a class="br-boton" href="' + TELEFONO.href + '">Llamar para pedir<span class="br-tel">' + TELEFONO.texto + '</span></a></p>';
      h += '</div>';
      h += '<figure class="br-fig"><div class="br-lienzo" aria-hidden="true">' + limpiarSvg(textoSvg) + '</div>' +
        '<span class="br-xxl" aria-hidden="true">XXL</span>' +
        '<figcaption><b class="br-nombre">Burguer Rural XXL</b><span class="br-ilu">Ilustración: las capas son genéricas, no es la receta.</span></figcaption></figure>';
      h += '</div></div>';
      nodo.innerHTML = h;

      // el logo, tal cual
      var lg = nodo.querySelector('.br-logo');
      var img;
      if (logoOrig) { img = logoOrig.cloneNode(true); img.removeAttribute('class'); img.removeAttribute('style'); }
      else if (opc.logo) { img = document.createElement('img'); img.src = opc.logo; }
      if (img) {
        if (!img.getAttribute('alt')) img.alt = 'Burguer Rural · Disfruta como un jabalí';
        img.decoding = 'async';
        if (!img.getAttribute('width') || !img.getAttribute('height')) { img.setAttribute('width', '420'); img.setAttribute('height', '355'); }
        img.loading = 'lazy';
        lg.appendChild(img);
      } else lg.parentNode.removeChild(lg);

      // capas del dibujo
      var svg = nodo.querySelector('.br-lienzo svg');
      svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); svg.removeAttribute('role'); svg.removeAttribute('aria-label');
      var tt = svg.querySelector('title'); if (tt) tt.parentNode.removeChild(tt);
      capas = Array.prototype.map.call(svg.querySelectorAll('.capa'), function (g) { return { el: g, est: '' }; });
      if (capas.length !== 6) throw new Error('la hamburguesa no tiene seis capas');
      pista = nodo.querySelector('.br-pista');
      escena = nodo.querySelector('.br-escena');
      fig = nodo.querySelector('.br-lienzo');
      sello = nodo.querySelector('.br-xxl');

      // el botón de teléfono se queda con el teléfono de la web si lo hay
      var tel = respaldoTmp.querySelector('a[href^="tel:"]');
      if (tel && tel.getAttribute('href').replace(/\D/g, '').slice(-9) === '988419215') nodo.querySelector('.br-boton').setAttribute('href', tel.getAttribute('href'));

      respaldo = Array.prototype.slice.call(el.children).map(function (n) { var hd = n.hidden; n.hidden = true; return { n: n, h: hd }; });
      el.appendChild(nodo);
      el.dataset.montado = '1';
      ponerModo();

      var io = new IntersectionObserver(function (ent) {
        ent.forEach(function (e) { enVista = e.isIntersecting; });
        if (enVista) alScroll();
      }, { rootMargin: '60% 0px 60% 0px' });
      io.observe(pista);
      limpiar.push(function () { io.disconnect(); });
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

    var dir = opc.svg || base('../img/barra/');
    pedir(dir + 'xxl.svg').then(construir).catch(function (err) {
      if (nodo && nodo.parentNode) nodo.parentNode.removeChild(nodo);
      respaldo.forEach(function (r) { r.n.hidden = r.h; });
      delete el.dataset.montado; el.__mnt = false;
      if (window.console) console.warn('[barra] se queda el respaldo:', err && err.message);
    });

    return {
      destruir: function () {
        vivo = false;
        if (raf) cancelAnimationFrame(raf);
        limpiar.forEach(function (f) { try { f(); } catch (e) {} });
        if (nodo && nodo.parentNode) nodo.parentNode.removeChild(nodo);
        respaldo.forEach(function (r) { r.n.hidden = r.h; });
        delete el.dataset.montado; el.__mnt = false;
        capas = [];
        if (window.ScrollTrigger) { try { window.ScrollTrigger.refresh(); } catch (e) {} }
      }
    };
  }

  window.Cortina = window.Cortina || {};
  window.Cortina.barra = { montar: montar, CATEGORIAS: CATEGORIAS };
})();
