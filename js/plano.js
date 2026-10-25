/* ------------------------------------------------------------------
   Aldea Rural A Cortiña · módulo «La aldea en plano» (js/plano.js)

   El conjunto dibujado a plumilla (img/plano/plano.svg, generado por
   scripts/plano-dibujo.mjs; dibujo ORIENTATIVO, no es un plano): al entrar en
   pantalla se traza de los edificios al detalle; al pasar o tocar uno, se
   rellena con su color real con un rayado que avanza y se abre su ficha.

   Contrato: window.Cortina.plano.montar(el, { movimiento, densidad, foto? })
   → { destruir(), seleccionar(zona), cerrar(), ... }. El HTML de `el` es el
   respaldo (lo escribe la web): se oculta solo cuando el módulo ya está
   montado (`el.dataset.montado = '1'`) y vuelve con destruir() o si algo falla.

   Trazos: stroke-dashoffset escrito a mano en cada fotograma (sin GSAP, así
   que no hay autoRound que apagar; checklist punto 8). Los trazos sueltos llevan
   pathLength=1; los compuestos (rayado, tejas, piedra) crecen todos a la vez
   con el mismo largo de trazo. Con movimiento:false, movimiento reducido o
   densidad sobria: el dibujo ya trazado y coloreado, sin animación.

   Fotos: por nombre, de img/fotos/fotos.json (lo genera la web); opción
   `foto(nombre, ancho)` para pruebas. Visor: Cortina.visor.abrir(lista, nombre)
   con lista = [{ nombre, n, alt, pie }]; sin visor, las miniaturas son enlaces a la
   foto. Reservar: Cortina.reservar('casa'|'apto1'|'apto2'); sin eso, #reservar.
   El resize de la barra del móvil no rehace nada: solo se escucha el cambio de
   la media query del ancho.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var guion = document.currentScript && document.currentScript.src;
  var base = function (ruta) {
    try { return guion ? new URL(ruta, guion).href : ruta.replace(/^\.\.\//, ''); } catch (e) { return ruta.replace(/^\.\.\//, ''); }
  };

  /* ---------- lo que se sabe de cada zona (ref/DATOS-ALDEA-A-CORTINA.md) ---------- */
  var ALT = {
    'casa-fachada': 'La casa por delante: fachada de almagre arriba y piedra abajo, con el césped delante',
    'casa-salon': 'Salón de la casa, con sofás, mesa, vigas de madera y la escalera',
    'casa-dormitorio-1': 'Dormitorio de matrimonio de la casa, con cabecero de madera y dos ventanas',
    'solaina': 'La solaina: balcón de madera sobre piedra y escalera exterior de hierro junto a la fachada roja',
    'apto1-salon': 'Salón-cocina del apartamento 1, con muro de granito y suelo de barro',
    'apto1-dormitorio': 'Dormitorio del apartamento 1, con muro de granito y vigas blancas',
    'apto2-dormitorio': 'Dormitorio del apartamento 2, con cabecero de tablas',
    'apto2-salon': 'Salón del apartamento 2, con muro de granito y sofá de cuero',
    'piscina': 'Piscina ovalada con tumbonas en primer plano; detrás, prado y bosque',
    'cenador': 'El cenador rojo con columnas de granito y placas solares en el tejado, el camino de losas, la casita infantil y el césped',
    'cenador-mesas': 'Bajo el cenador: mesas de madera, la pared roja y la aldea al fondo',
    'vista-aldea': 'Vista desde el cenador: el césped, la valla de la piscina y las casas de Pepín al fondo',
    'sala-juegos': 'Sala de juegos con muro de piedra, ping-pong, futbolín y mesas infantiles',
    'sala-billar': 'Sala de juegos con mesa de billar, futbolín y una entreplanta con barandilla'
  };
  var ZONAS = [
    {
      id: 'casa', nombre: 'La casa', corto: 'hasta 6 + 1', color: 'almagre', unidad: 'casa',
      kicker: 'Alojamiento · la casa entera',
      lead: 'La casa entera, de fachada de almagre y piedra, con el césped delante.',
      datos: [['Dormitorios', '3, cada uno con baño privado'], ['Planta baja', 'un dormitorio de matrimonio adaptado para movilidad reducida, y el salón-cocina'], ['Planta alta', 'un dormitorio de matrimonio y otro con dos camas individuales'], ['Plazas', 'hasta 6, y 1 cama supletoria si se pide (por confirmar)']],
      fotos: ['casa-fachada', 'casa-salon', 'casa-dormitorio-1']
    },
    {
      id: 'apto1', nombre: 'Apartamento 1', corto: 'planta baja · 2 + 1', color: 'piedra', unidad: 'apto1',
      kicker: 'Alojamiento · planta baja',
      lead: 'Un apartamento de un dormitorio en la planta baja del edificio de la solaina.',
      datos: [['Dormitorio', '1, con baño privado'], ['Salón-cocina', 'con muro de granito y suelo de barro'], ['Con', 'calefacción y wifi gratis'], ['Plazas', '2, y 1 cama supletoria si se pide (por confirmar)']],
      fotos: ['solaina', 'apto1-salon', 'apto1-dormitorio']
    },
    {
      id: 'apto2', nombre: 'Apartamento 2', corto: 'planta alta · 2 + sofá cama', color: 'madera', unidad: 'apto2',
      kicker: 'Alojamiento · planta alta',
      lead: 'Un apartamento de un dormitorio en la planta alta, bajo el balcón de madera de la solaina.',
      datos: [['Dormitorio', '1, abuhardillado y con vigas, con baño privado'], ['Salón-cocina', 'con muro de granito'], ['Con', 'calefacción y wifi gratis'], ['Plazas', '2, y sofá cama (por confirmar)']],
      fotos: ['solaina', 'apto2-dormitorio', 'apto2-salon']
    },
    {
      id: 'piscina', nombre: 'Piscina', corto: 'julio y agosto', color: 'agua', unidad: null,
      kicker: 'Zonas comunes',
      lead: 'Piscina al aire libre, ovalada, con tumbonas y vistas al prado y al bosque.',
      datos: [['Abre', 'solo en julio y agosto'], ['Es', 'ovalada, con tumbonas y una valla de madera'], ['Vistas', 'al prado y al bosque']],
      fotos: ['piscina', 'vista-aldea']
    },
    {
      id: 'cenador', nombre: 'Cenador y barbacoa', corto: 'mesas y barbacoa', color: 'almagre', unidad: null,
      kicker: 'Zonas comunes',
      lead: 'El cenador de fachada roja y columnas de granito, con mesas de madera y zona de barbacoa.',
      datos: [['Tiene', 'mesas de madera, zona de barbacoa y placas solares en el tejado'], ['Mira', 'al césped y a las casas de Pepín']],
      fotos: ['cenador', 'cenador-mesas', 'vista-aldea']
    },
    {
      id: 'sala', nombre: 'Sala de juegos', corto: 'billar, futbolín, ping-pong', color: null, unidad: null,
      kicker: 'Zonas comunes',
      lead: 'Una sala de piedra con billar, futbolín y ping-pong.',
      datos: [['Hay', 'billar, futbolín y ping-pong'], ['Para los pequeños', 'mesas y sillas infantiles']],
      fotos: ['sala-juegos', 'sala-billar']
    },
    {
      id: 'cesped', nombre: 'Césped y casita infantil', corto: 'jardín de césped', color: 'prado', unidad: null,
      kicker: 'Zonas comunes',
      lead: 'Un jardín de césped con camino de losas de piedra y una casita infantil.',
      datos: [['Camino', 'de losas de piedra, del cenador a la casa'], ['Para los pequeños', 'casita infantil en el césped']],
      fotos: ['cenador', 'vista-aldea']
    }
  ];
  var POR_ID = {}; ZONAS.forEach(function (z) { POR_ID[z.id] = z; });

  var escapar = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var lim = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var salir = function (t) { return 1 - (1 - t) * (1 - t); };
  var vaiven = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

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

  /* ====================================================================== */
  function montar(el, opc) {
    opc = opc || {};
    if (el.__plano) return el.__plano;
    var reducido = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sobria = opc.densidad === 'sobria';
    var animar = opc.movimiento !== false && !reducido && !sobria;
    var raiz, svg, lienzo, lateral, leyenda, ficha, vivo;
    var zonasEls = {}, rotEls = {}, botones = {};
    var sel = null, hover = null, enFicha = false;
    var rafTrazo = 0, rafVista = 0, io = null, mq = null, vivoTimer = 0;
    var fases = [[], [], [], []];
    var VB0 = null, vbActual = null;
    var fotosJson = null;
    var destruido = false;
    var inst = { el: el, zonas: ZONAS.map(function (z) { return z.id; }) };

    var respaldo = Array.prototype.slice.call(el.children);

    /* ---------- estructura ---------- */
    raiz = document.createElement('div');
    raiz.className = 'pl';
    raiz.dataset.estado = 'cargando';
    raiz.innerHTML =
      '<div class="pl-escena">' +
        '<p class="pl-pista"><span class="pl-pista__trazo" aria-hidden="true"></span>Pasa el cursor o toca un edificio; también puedes elegir en la lista.</p>' +
        '<div class="pl-lienzo" data-trazado="esperando"></div>' +
        '<p class="pl-nota">Dibujo orientativo, no es un plano: no guarda escala ni medidas.</p>' +
      '</div>' +
      '<div class="pl-lateral">' +
        '<div class="pl-leyenda" role="group" aria-label="Zonas de la aldea"><ul class="pl-lista">' +
          ZONAS.map(function (z) {
            return '<li><button type="button" class="pl-zona pl-btn" data-zona="' + z.id + '" aria-expanded="false" aria-controls="pl-ficha">' +
              '<span class="pl-sello' + (z.color ? ' c-' + z.color : ' sin') + '" aria-hidden="true"></span>' +
              '<span class="pl-zona__nombre">' + escapar(z.nombre) + '</span>' +
              '<span class="pl-zona__corto">' + escapar(z.corto) + '</span></button></li>';
          }).join('') +
        '</ul></div>' +
        '<section class="pl-ficha" id="pl-ficha" aria-labelledby="pl-ficha-t" hidden></section>' +
      '</div>' +
      '<p class="pl-vivo" role="status" aria-live="polite"></p>';
    el.appendChild(raiz);
    lienzo = raiz.querySelector('.pl-lienzo');
    lateral = raiz.querySelector('.pl-lateral');
    leyenda = raiz.querySelector('.pl-leyenda');
    ficha = raiz.querySelector('.pl-ficha');
    vivo = raiz.querySelector('.pl-vivo');
    ZONAS.forEach(function (z) { botones[z.id] = raiz.querySelector('.pl-zona[data-zona="' + z.id + '"]'); });

    /* ---------- el dibujo ---------- */
    // la huella ?v= del propio script (la pone versionar.mjs) viaja también al dibujo
    var huella = '';
    try { huella = guion ? new URL(guion).search : ''; } catch (e) { huella = ''; }
    var url = opc.svg || (base('../img/plano/plano.svg') + huella);
    pedir(url, 'texto').then(function (txt) {
      if (destruido) return;
      lienzo.innerHTML = txt;
      svg = lienzo.querySelector('svg');
      if (!svg) throw new Error('plano.svg sin <svg>');
      iniciar();
    }).catch(function (e) {
      if (window.console) console.warn('plano: no se pudo cargar el dibujo, se queda el respaldo', e && e.message);
      if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
      el.classList.remove('pl-hecho');
    });

    function iniciar() {
      var vb = svg.viewBox.baseVal;
      VB0 = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
      vbActual = { x: VB0.x, y: VB0.y, w: VB0.w, h: VB0.h };
      ZONAS.forEach(function (z) {
        zonasEls[z.id] = Array.prototype.slice.call(svg.querySelectorAll('.zona[data-zona="' + z.id + '"]'));
        rotEls[z.id] = Array.prototype.slice.call(svg.querySelectorAll('.rot[data-zona="' + z.id + '"]'));
      });
      if (!animar) svg.classList.add('pl-color');
      svg.addEventListener('pointerover', function (e) { if (e.pointerType && e.pointerType !== 'mouse') return; var z = zonaDe(e.target); if (z) pasar(z); });
      svg.addEventListener('pointerout', function (e) { if (e.pointerType && e.pointerType !== 'mouse') return; var z = zonaDe(e.target); if (z && zonaDe(e.relatedTarget) !== z) salirDe(z); });
      svg.addEventListener('click', function (e) { var z = zonaDe(e.target); if (z) seleccionar(z, 'puntero'); });
      Object.keys(botones).forEach(function (id) {
        var b = botones[id];
        b.addEventListener('click', function () { seleccionar(id, 'boton'); });
        b.addEventListener('focus', function () { if (!enFicha && b.matches(':focus-visible')) pasar(id); });
        b.addEventListener('blur', function () { salirDe(id); });
        b.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') pasar(id); });
        b.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && document.activeElement !== b) salirDe(id); });
      });
      raiz.addEventListener('keydown', teclas);
      document.addEventListener('keydown', teclasDoc);
      mq = window.matchMedia ? matchMedia('(max-width: 759px)') : null;
      if (mq && mq.addEventListener) mq.addEventListener('change', cambioMedia);
      if (animar) prepararTrazo(); else lienzo.dataset.trazado = 'hecho';
      el.classList.add('pl-hecho');
      el.dataset.montado = '1';
      raiz.dataset.estado = animar ? 'esperando' : 'quieto';
      if (animar) vigilar();
      if (mq && mq.matches) vista(null, true);
    }

    var zonaDe = function (n) {
      var g = n && n.closest ? n.closest('.zona, .rot') : null;
      return g ? g.getAttribute('data-zona') : null;
    };

    /* ---------- hover y selección ---------- */
    function marcar(id, on) {
      var cls = 'on';
      (zonasEls[id] || []).forEach(function (g) { g.classList.toggle(cls, on); });
      (rotEls[id] || []).forEach(function (g) { g.classList.toggle(cls, on); });
      if (botones[id]) botones[id].classList.toggle('es-pasa', on);
    }
    function pasar(id) { hover = id; marcar(id, true); }
    function salirDe(id) { if (hover === id) hover = null; if (sel !== id) marcar(id, false); }

    function seleccionar(id, origen) {
      if (!POR_ID[id]) return;
      if (sel === id) { cerrar(origen !== 'puntero'); return; }
      if (fotosJson || typeof opc.foto === 'function') return abrirZona(id, origen);
      return cargarFotos().then(function () { if (!destruido) abrirZona(id, origen); });
    }
    function abrirZona(id, origen) {
      var previa = sel;
      sel = id;
      if (previa) { quitarSel(previa); }
      zonasEls[id].forEach(function (g) { g.classList.add('sel'); });
      rotEls[id].forEach(function (g) { g.classList.add('sel'); });
      marcar(id, true);
      Object.keys(botones).forEach(function (k) { botones[k].setAttribute('aria-expanded', k === id ? 'true' : 'false'); botones[k].classList.toggle('es-sel', k === id); });
      pintarFicha(id);
      ficha.hidden = false;
      enFicha = true;
      raiz.dataset.ficha = '1';
      raiz.dataset.zona = id;
      anunciar('Ficha abierta: ' + POR_ID[id].nombre);
      vista(id);
      // en tableta la ficha queda debajo del dibujo: que asome si se queda fuera de la pantalla
      if (window.matchMedia && matchMedia('(min-width: 760px) and (max-width: 1179px)').matches) {
        var rf = ficha.getBoundingClientRect();
        if (rf.top > innerHeight * 0.55) ficha.scrollIntoView({ block: 'nearest', behavior: reducido ? 'auto' : 'smooth' });
      }
      if (origen === 'boton' || origen === 'teclado') {
        var h = ficha.querySelector('.pl-ficha__tit');
        if (h) h.focus({ preventScroll: true });
      }
    }
    function quitarSel(id) {
      (zonasEls[id] || []).forEach(function (g) { g.classList.remove('sel'); if (hover !== id) g.classList.remove('on'); });
      (rotEls[id] || []).forEach(function (g) { g.classList.remove('sel'); if (hover !== id) g.classList.remove('on'); });
      if (hover !== id && botones[id]) botones[id].classList.remove('es-pasa');
    }
    function cerrar(devolverFoco) {
      if (!sel) return;
      var id = sel;
      var dentro = ficha.contains(document.activeElement);
      sel = null; enFicha = false;
      quitarSel(id);
      Object.keys(botones).forEach(function (k) { botones[k].setAttribute('aria-expanded', 'false'); botones[k].classList.remove('es-sel'); });
      ficha.hidden = true;
      ficha.innerHTML = '';
      delete raiz.dataset.ficha; delete raiz.dataset.zona;
      anunciar('Ficha cerrada');
      vista(null);
      if ((dentro || devolverFoco) && botones[id]) botones[id].focus({ preventScroll: true });
    }
    function anunciar(t) {
      clearTimeout(vivoTimer);
      vivo.textContent = '';
      vivoTimer = setTimeout(function () { vivo.textContent = t; }, 60);
    }
    function teclas(e) {
      if (e.key === 'Escape' && sel) { e.stopPropagation(); cerrar(true); }
    }
    function teclasDoc(e) {
      if (e.key !== 'Escape' || !sel || raiz.contains(e.target)) return;
      // el Esc de un diálogo abierto (el visor de fotos) es del diálogo, no de la ficha
      if ((e.target.closest && e.target.closest('dialog')) || document.querySelector('dialog[open]')) return;
      cerrar(false);
    }

    /* ---------- la ficha ---------- */
    function fuentes(nombre) {
      // → { lista de srcset por formato, src, ancho, alto } o null
      if (typeof opc.foto === 'function') {
        var s = opc.foto(nombre, 640);
        return s ? { jpg: [s, 640], src: s, mayor: opc.foto(nombre, 1280) || s } : null;
      }
      var f = fotosJson && fotosJson.filter(function (x) { return x.nombre === nombre; })[0];
      if (!f) return null;
      var anchos = f.anchos.slice().sort(function (a, b) { return a - b; });
      var chico = anchos.filter(function (a) { return a >= 480; })[0] || anchos[anchos.length - 1];
      var grande = anchos.filter(function (a) { return a >= 1024; })[0] || anchos[anchos.length - 1];
      var mk = function (ext) { return anchos.filter(function (a) { return a <= 800; }).map(function (a) { return base('../img/fotos/' + nombre + '-' + a + '.' + ext) + ' ' + a + 'w'; }).join(', '); };
      return { avif: mk('avif'), webp: mk('webp'), jpg: mk('jpg'), src: base('../img/fotos/' + nombre + '-' + chico + '.jpg'), mayor: base('../img/fotos/' + nombre + '-' + grande + '.jpg'), ancho: f.ancho, alto: f.alto };
    }
    function pintarFicha(id) {
      var z = POR_ID[id];
      var rows = z.datos.map(function (d) { return '<div><dt>' + escapar(d[0]) + '</dt><dd>' + escapar(d[1]) + '</dd></div>'; }).join('');
      var lista = z.fotos.filter(function (n) { return fuentes(n); });
      var thumbs = lista.map(function (n) {
        var f = fuentes(n);
        var pic = '<picture>' +
          (f.avif ? '<source type="image/avif" srcset="' + f.avif + '" sizes="(min-width:1000px) 100px, 30vw">' : '') +
          (f.webp ? '<source type="image/webp" srcset="' + f.webp + '" sizes="(min-width:1000px) 100px, 30vw">' : '') +
          '<img src="' + f.src + '" alt="' + escapar(ALT[n] || n) + '" width="4" height="3" loading="lazy" decoding="async"></picture>';
        return '<li><a class="pl-foto pl-btn" href="' + f.mayor + '" data-nombre="' + n + '" target="_blank" rel="noopener">' + pic + '<span class="pl-foto__ver">Ver</span></a></li>';
      }).join('');
      var unidad = z.unidad;
      var llave = unidad ? (window.Cortina && typeof window.Cortina.reservar === 'function'
        ? '<button type="button" class="pl-llave pl-btn" data-unidad="' + unidad + '">Elegir esta llave</button>'
        : '<a class="pl-llave pl-btn" href="#reservar" data-unidad="' + unidad + '">Elegir esta llave</a>') : '';
      ficha.innerHTML =
        '<div class="pl-ficha__marco">' +
        '<button type="button" class="pl-cerrar pl-btn" aria-label="Cerrar la ficha de ' + escapar(z.nombre) + '"><span class="pl-cerrar__a" aria-hidden="true">←&nbsp;Todas las zonas</span><span class="pl-cerrar__b" aria-hidden="true">Cerrar&nbsp;×</span></button>' +
        '<p class="pl-ficha__kicker">' + escapar(z.kicker) + '</p>' +
        '<h3 class="pl-ficha__tit" id="pl-ficha-t" tabindex="-1">' + escapar(z.nombre) + '</h3>' +
        '<p class="pl-ficha__lead">' + escapar(z.lead) + '</p>' +
        '<dl class="pl-datos">' + rows + '</dl>' +
        (thumbs ? '<ul class="pl-fotos" aria-label="Fotos de ' + escapar(z.nombre) + '">' + thumbs + '</ul>' : '') +
        (llave ? '<div class="pl-acciones">' + llave + '</div>' : '') +
        '</div>';
      ficha.querySelector('.pl-cerrar').addEventListener('click', function () { cerrar(true); });
      var bl = ficha.querySelector('.pl-llave');
      if (bl) bl.addEventListener('click', function (e) { e.preventDefault(); reservar(bl.getAttribute('data-unidad')); });
      Array.prototype.forEach.call(ficha.querySelectorAll('.pl-foto'), function (a) {
        a.addEventListener('click', function (e) {
          var C = window.Cortina;
          if (C && C.visor && typeof C.visor.abrir === 'function') {
            e.preventDefault();
            C.visor.abrir(lista.map(function (n) { return { nombre: n, n: n, alt: ALT[n] || n, pie: z.nombre + ' · ' + (ALT[n] || n) }; }), a.getAttribute('data-nombre'));
          }
        });
      });
    }
    function reservar(u) {
      var C = window.Cortina;
      if (C && typeof C.reservar === 'function') C.reservar(u);
      else location.hash = '#reservar';
    }
    // las fotos se piden cuando se abre la primera ficha (o al acercarse)
    function cargarFotos() {
      if (typeof opc.foto === 'function' || fotosJson) return Promise.resolve();
      return pedir(opc.fotosJson || base('../img/fotos/fotos.json'), 'json').then(function (j) { fotosJson = j; }).catch(function () { fotosJson = []; });
    }
    /* ---------- vista recortada en el móvil ---------- */
    function cambioMedia() { vista(sel, true); }
    function vbDe(id) {
      var A = 4 / 3;
      var els = id ? (zonasEls[id] || []).concat(rotEls[id] || []) : [];
      if (!els.length) return { x: VB0.x, y: VB0.y, w: VB0.w, h: VB0.h };
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      els.forEach(function (g) { var b = g.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); });
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      var w = Math.max(x1 - x0 + 150, 560), h = w / A;
      if (y1 - y0 + 110 > h) { h = y1 - y0 + 110; w = h * A; }
      if (w > VB0.w) { w = VB0.w; h = w / A; }
      var x = Math.min(Math.max(cx - w / 2, VB0.x), VB0.x + VB0.w - w);
      var y = Math.min(Math.max(cy - h / 2, VB0.y), VB0.y + VB0.h - h);
      return { x: x, y: y, w: w, h: h };
    }
    function vista(id, ya) {
      if (!svg) return;
      var estrecho = mq && mq.matches;
      var meta = estrecho ? vbDe(id) : { x: VB0.x, y: VB0.y, w: VB0.w, h: VB0.h };
      if (!estrecho && vbActual.w === VB0.w) { lienzo.classList.remove('pl-recorte'); return; }
      lienzo.classList.toggle('pl-recorte', !!estrecho);
      var ini = { x: vbActual.x, y: vbActual.y, w: vbActual.w, h: vbActual.h };
      var poner = function (v) { vbActual = v; svg.setAttribute('viewBox', v.x.toFixed(1) + ' ' + v.y.toFixed(1) + ' ' + v.w.toFixed(1) + ' ' + v.h.toFixed(1)); };
      cancelAnimationFrame(rafVista);
      if (ya || reducido || opc.movimiento === false) { poner(meta); return; }
      var t0 = performance.now(), dur = 650;
      var paso = function (ahora) {
        var t = lim((ahora - t0) / dur), e = vaiven(t);
        poner({ x: ini.x + (meta.x - ini.x) * e, y: ini.y + (meta.y - ini.y) * e, w: ini.w + (meta.w - ini.w) * e, h: ini.h + (meta.h - ini.h) * e });
        if (t < 1) rafVista = requestAnimationFrame(paso);
      };
      rafVista = requestAnimationFrame(paso);
    }

    /* ---------- el trazado ---------- */
    function prepararTrazo() {
      var els = svg.querySelectorAll('.t');
      Array.prototype.forEach.call(els, function (p) {
        var f = (+p.getAttribute('data-f') || 4) - 1;
        var L = p.hasAttribute('pathLength') ? 1 : (+p.getAttribute('data-l') || 20);
        p.style.strokeDasharray = L + ' ' + L;
        p.style.strokeDashoffset = L;
        fases[f].push({ p: p, L: L, a: 0, b: 0 });
      });
      // ventanas de cada fase (segundos): contornos → tejados → piedra y carpintería → rayado, césped, agua
      var V = [[0, 1.25], [0.55, 1.95], [1.15, 2.45], [1.65, 2.9]];
      fases.forEach(function (lista, i) {
        var a = V[i][0], b = V[i][1], d = Math.min(0.75, (b - a) * 0.5), n = lista.length;
        lista.forEach(function (o, k) { o.a = a + (b - a - d) * (n > 1 ? k / (n - 1) : 0); o.b = o.a + d; });
      });
    }
    function vigilar() {
      var arrancar = function () { if (io) { io.disconnect(); io = null; } trazar(); };
      if (!('IntersectionObserver' in window)) { arrancar(); return; }
      io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) arrancar(); }, { threshold: 0.18 });
      io.observe(lienzo);
    }
    function trazar() {
      if (lienzo.dataset.trazado !== 'esperando') return;
      lienzo.dataset.trazado = 'trazando';
      raiz.dataset.estado = 'trazando';
      var t0 = performance.now(), TOT = 2.95;
      var paso = function (ahora) {
        var t = (ahora - t0) / 1000;
        var vivos = false;
        for (var f = 0; f < 4; f++) {
          var lista = fases[f];
          for (var i = 0; i < lista.length; i++) {
            var o = lista[i];
            if (o.hecho) continue;
            if (t < o.a) { vivos = true; break; }   // los siguientes empiezan aún más tarde
            var e = lim((t - o.a) / (o.b - o.a));
            o.p.style.strokeDashoffset = (o.L * (1 - salir(e))).toFixed(3);
            if (e >= 1) o.hecho = true; else vivos = true;
          }
        }
        if (t < TOT && vivos) { rafTrazo = requestAnimationFrame(paso); return; }
        acabarTrazo();
      };
      rafTrazo = requestAnimationFrame(paso);
    }
    function acabarTrazo() {
      cancelAnimationFrame(rafTrazo);
      fases.forEach(function (lista) { lista.forEach(function (o) { o.p.style.strokeDasharray = ''; o.p.style.strokeDashoffset = ''; o.hecho = true; }); });
      lienzo.dataset.trazado = 'hecho';
      raiz.dataset.estado = 'listo';
    }

    /* ---------- fuera ---------- */
    inst.seleccionar = function (id, origen) { return seleccionar(id, origen || 'boton'); };
    inst.cerrar = function () { cerrar(false); };
    inst.estado = function () { return { sel: sel, trazado: lienzo.dataset.trazado }; };
    inst.terminarTrazo = function () { if (animar && lienzo.dataset.trazado !== 'hecho') { lienzo.dataset.trazado = 'trazando'; acabarTrazo(); } };
    inst.destruir = function () {
      destruido = true;
      cancelAnimationFrame(rafTrazo); cancelAnimationFrame(rafVista); clearTimeout(vivoTimer);
      if (io) io.disconnect();
      document.removeEventListener('keydown', teclasDoc);
      if (mq && mq.removeEventListener) mq.removeEventListener('change', cambioMedia);
      if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
      el.classList.remove('pl-hecho');
      delete el.dataset.montado;
      delete el.__plano;
      respaldo.forEach(function (n) { n.hidden = false; });
    };
    el.__plano = inst;
    return inst;
  }

  var C = (window.Cortina = window.Cortina || {});
  C.plano = { montar: montar, zonas: ZONAS };
})();
