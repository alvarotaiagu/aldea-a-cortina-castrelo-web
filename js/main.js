/* ------------------------------------------------------------------
   Aldea Rural A Cortiña · Pepín · «Almagre y piedra» · lo común de la página
   - Las láminas de piedra: --p (0 → 1) con el scroll en cada [data-lamina].
   - La cabecera cambia de tinta según la superficie que tiene debajo (data-sup).
   - Monta los módulos (dibujo, plano, barra, ruta, comarca y el círculo del pie) con su respaldo.
   - La cortina es del módulo Entrada (js/llave.js); el puente con ella está en partes/cabeza.html
     (Cortina.abrir, Cortina.retirarCortina, Cortina.alAbrirse).
   - El visor de fotos (Cortina.visor.abrir(lista, nombre)), las pestañas de «Por dentro»,
     Cortina.reservar(unidad, { mes }) y el foco del teclado con su rayado de plumilla.
   - El motor de reservas va en js/reserva.js.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !quieto;
  const sobria = () => raiz.classList.contains('densidad-sobria');
  const params = new URLSearchParams(location.search);
  const sin3d = params.has('sin-3d');

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const C = (window.Cortina = window.Cortina || {});
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 1. titulares que se escriben (solo con movimiento) ============ */
  // «con-movimiento» se pone DESPUÉS de dejar los observadores listos: si algo fallara, los titulares no se quedan escondidos
  const titulares = $$('[data-partir]');
  if (motion && 'IntersectionObserver' in window) {
    const vistos = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('es-visto'); vistos.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    titulares.forEach((h) => vistos.observe(h));
    raiz.classList.add('con-movimiento');
  } else titulares.forEach((h) => h.classList.add('es-visto'));

  /* ============ 2. Lenis (y el ScrollTrigger de los módulos) ============ */
  const G = window.gsap, ST = window.ScrollTrigger;
  if (G && ST) G.registerPlugin(ST);
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !quieto) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true, lerp: 0.11 });
    if (G && ST) {
      lenis.on('scroll', ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
    } else {
      const bucle = (t) => { lenis.raf(t); requestAnimationFrame(bucle); };
      requestAnimationFrame(bucle);
    }
    if (raiz.classList.contains('cortina-activa')) lenis.stop();
  }
  const cabAlto = () => parseFloat(getComputedStyle(raiz).getPropertyValue('--cab')) || 72;
  const irA = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - cabAlto() - 8;
    if (lenis) lenis.scrollTo(y, { duration: 1.3 });
    else scrollTo({ top: y, behavior: quieto ? 'auto' : 'smooth' });
  };

  /* ============ 3. las láminas de piedra: --p con el scroll ============ */
  // p = 0 cuando la lámina entra por abajo (la losa la cubre entera) y 1 cuando está al 38 % de la pantalla
  // (la losa ya se ha metido bajo la sección de arriba). Solo transform, nunca height. Sin movimiento o en la sobria,
  // no se pone --p: el CSS deja la losa quieta, con su borde de laja a medio camino.
  const laminas = $$('[data-lamina]');
  const visibles = new Set();
  if ('IntersectionObserver' in window) {
    const ioL = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) visibles.add(e.target); else visibles.delete(e.target); }), { rootMargin: '0px 0px 5% 0px' });
    laminas.forEach((l) => ioL.observe(l));
  } else laminas.forEach((l) => visibles.add(l));
  const laminasViva = () => motion && !sobria();
  let lamViva = null;
  function pintarLaminas(forzar) {
    const viva = laminasViva();
    if (viva !== lamViva || forzar) {
      lamViva = viva;
      if (!viva) laminas.forEach((l) => l.style.removeProperty('--p'));
    }
    if (!viva) return;
    visibles.forEach((l) => {
      const r = l.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (altoVista - r.top) / (altoVista * 0.62)));
      const v = String(Math.round(p * 200) / 200);
      if (l.__p !== v) { l.__p = v; l.style.setProperty('--p', v); }
    });
  }

  /* ============ 4. la cabecera: tinta según la superficie de debajo ============ */
  const cab = $('#cab');
  const superficies = $$('main [data-sup], footer[data-sup]');
  let supActual = '';
  function pintarCabecera() {
    cab.classList.toggle('sc', scrollY > 24);
    const y = cabAlto() / 2;
    let sup = 'papel';
    for (const s of superficies) {
      const r = s.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) { sup = s.dataset.sup; break; }
    }
    if (sup !== supActual) { supActual = sup; cab.dataset.sup = sup; }
  }

  /* ============ 5. módulos: dibujo (portada), plano, barra, ruta, comarca y el círculo del pie ============ */
  // Se montan al acercarse; el de la portada, cuando la puerta EMPIEZA a abrirse. Si su JS falla o no está,
  // se queda el respaldo del HTML. Se guarda el respaldo para volver a montar al cambiar de densidad.
  const montados = new Map();     // el → { inst, respaldo }
  const esperando = new Set();    // cerca de la pantalla, pero su JS aún no ha llegado (el 3D es un módulo diferido)
  function modulo(nombre) {
    if (nombre === 'circulo') {
      if (C.dibujo && typeof C.dibujo.circulo === 'function') return { montar: (el, op) => C.dibujo.circulo(el, op) };
      return null;
    }
    const m = C[nombre];
    return m && typeof m.montar === 'function' ? m : null;
  }
  const opciones = (el) => {
    const op = { movimiento: motion, densidad: sobria() ? 'sobria' : 'aldea' };
    if (el.dataset.modulo === 'ruta' && sin3d) { op.gl = false; op.sin3d = true; }
    return op;
  };
  function montarModulo(el) {
    if (montados.has(el)) return;
    const mod = modulo(el.dataset.modulo);
    if (!mod) { esperando.add(el); return; }
    esperando.delete(el);
    const respaldo = el.innerHTML;
    try {
      const inst = mod.montar(el, opciones(el));
      montados.set(el, { inst, respaldo });
    } catch (er) {
      console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er);
      montados.set(el, { inst: null, respaldo });
    }
  }
  const reintentar = () => { if (esperando.size) [...esperando].forEach(montarModulo); };
  addEventListener('load', reintentar);
  document.addEventListener('cortina:listo', reintentar);
  function remontarTodos() {
    // sobre una copia: montar otra vez mete la entrada de nuevo en el Map
    [...montados].forEach(([el, { inst, respaldo }]) => {
      try { inst && inst.destruir && inst.destruir(); } catch (er) { console.warn(er); }
      el.innerHTML = respaldo;
      delete el.dataset.montado;
      montados.delete(el);
      montarModulo(el);
    });
    if (ST) ST.refresh();
  }
  const portadaMod = $('#portada [data-modulo="dibujo"]');
  const todos = $$('[data-modulo]').filter((el) => el !== portadaMod);
  if ('IntersectionObserver' in window) {
    const ioMod = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { ioMod.unobserve(e.target); montarModulo(e.target); }
    }), { rootMargin: '900px 0px' });
    // el círculo del pie dibuja con la lectura de toda la página: se monta mucho antes
    const ioCirc = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { ioCirc.unobserve(e.target); montarModulo(e.target); }
    }), { rootMargin: '4000px 0px' });
    todos.forEach((el) => (el.dataset.modulo === 'circulo' ? ioCirc : ioMod).observe(el));
  } else todos.forEach(montarModulo);

  /* ============ 6. la cortina (del módulo Entrada): alAbrirse() y su retirada ============ */
  C.alAbrirse(() => {
    const p = $('#portada');
    if (p) p.classList.add('abierta');
    if (portadaMod) montarModulo(portadaMod);
  });
  let fuera = false;
  function alSalir() {
    if (fuera) return;
    fuera = true;
    const c = $('#cortina, .cortina, [data-cortina]');
    if (c && !c.hidden && getComputedStyle(c).display !== 'none') c.hidden = true;
    // con la cortina el scroll estaba bloqueado: si algo movió la página (restauración del navegador), se vuelve arriba
    if (!location.hash && scrollY > 0) { if (lenis) lenis.scrollTo(0, { immediate: true, force: true }); scrollTo(0, 0); }
    if (lenis) lenis.start();
    if (G) G.ticker.lagSmoothing(0);      // al retirar la cortina, nunca antes
    if (ST) ST.refresh();
    alScroll();
    mostrarCookies();
  }
  document.addEventListener('cortina:fuera-ya', alSalir);
  const retirarCortina = () => { try { if (C.cortina && typeof C.cortina.retirar === 'function') C.cortina.retirar(); } catch (e) {} C.retirarCortina(); alSalir(); };

  /* ============ 7. menú y anclas ============ */
  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
    if (lenis) abierto ? lenis.stop() : lenis.start();
  });

  /* ============ 8. reservar: Cortina.reservar(unidad?, { mes }?) ============ */
  // unidad: 'casa' | 'apto1' | 'apto2' | 'aldea'. Acepta reservar('casa'), reservar({ mes: 2 }) y reservar('casa', { mes: 2 }).
  C.reservar = function (a, b) {
    let unidad, op = {};
    if (a && typeof a === 'object') op = a; else { unidad = a; if (b && typeof b === 'object') op = b; }
    if (C.motor) {
      if (unidad) C.motor.elegir(unidad);
      if (op.mes != null) C.motor.mes(op.mes);
    }
    cerrarMenu();
    irA('#reservar');
  };
  document.addEventListener('click', (e) => {
    const r = e.target.closest('[data-reservar]');
    if (r) { e.preventDefault(); C.reservar(r.dataset.reservar); return; }
    const m = e.target.closest('[data-reservar-mes]');
    if (m) { e.preventDefault(); C.reservar(undefined, { mes: m.dataset.reservarMes }); return; }
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const destino = a.getAttribute('href');
    if (destino.length < 2 || !$(destino)) return;
    e.preventDefault();
    cerrarMenu();
    irA(destino);
    setTimeout(() => {
      const t = $(destino);
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }, 1000);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); } });

  /* ============ 9. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'acortina-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) {} };
  const mando = $('#mando');
  const verMando = () => { if (mando && raiz.classList.contains('revision')) mando.hidden = !ck.hidden; };
  let cookiesPendientes = !leer();
  function mostrarCookies() {
    if (!cookiesPendientes) { verMando(); return; }
    cookiesPendientes = false;
    ck.hidden = false;
    verMando();
  }
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); $('#ck-si').focus(); });

  /* ============ 10. mapa de Google solo al pedirlo ============ */
  $('#mapa-btn').addEventListener('click', () => {
    const marco = document.createElement('iframe');
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent('42.0083,-7.4163') + '&z=15&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con Aldea Rural A Cortiña en Pepín';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-consent').remove();
  });

  /* ============ 11. visor de fotos: se abre por el NOMBRE de la foto ============ */
  // Cortina.visor.abrir(lista, nombre): lista = nombres de foto (o { nombre, alt, pie }) y nombre = con cuál empieza.
  // Los textos y los anchos salen de las fotos de la propia página; los que falten, de img/fotos/fotos.json.
  const visor = $('#visor');
  const vImg = $('#visor-img'), vPie = $('#visor-pie'), vN = $('#visor-n');
  const FOTOS = new Map();         // nombre → { anchos, ancho, alto }
  let fotosCargadas = false;
  function cargarFotos() {
    if (fotosCargadas) return;
    fotosCargadas = true;
    fetch('img/fotos/fotos.json').then((r) => r.json()).then((l) => l.forEach((f) => FOTOS.set(f.nombre, f))).catch(() => {});
  }
  (window.requestIdleCallback || ((f) => setTimeout(f, 2500)))(cargarFotos);
  function infoFoto(n) {
    const img = $('picture[data-foto="' + n + '"] img');
    const f = FOTOS.get(n);
    let anchos = f ? f.anchos.slice() : null, ancho = f ? f.ancho : 0, alto = f ? f.alto : 0, alt = '', pie = '';
    if (img) {
      const a = (img.getAttribute('srcset') || '').split(',').map((x) => parseInt(x.trim().split(/\s+/)[1], 10)).filter(Boolean).sort((p, q) => p - q);
      if (a.length) anchos = a;
      ancho = +img.getAttribute('width') || ancho; alto = +img.getAttribute('height') || alto;
      alt = img.alt;
      const cont = img.closest('figure, article, li');
      const cap = cont && cont.querySelector('figcaption, h3');
      pie = cap ? cap.textContent.replace(/\s+/g, ' ').trim() : alt;
    }
    return { n, alt, pie: pie || alt, anchos: anchos && anchos.length ? anchos : [800], ancho: ancho || 1024, alto: alto || 768 };
  }
  let lista = [], actual = 0, origen = null;
  function poner(i) {
    actual = (i + lista.length) % lista.length;
    const f = lista[actual];
    const peq = f.anchos.includes(800) ? 800 : f.anchos[0], gran = f.anchos[f.anchos.length - 1];
    // primero la de 800 (o la menor, ya en caché), y la grande al cargar
    vImg.src = `img/fotos/${f.n}-${peq}.jpg`;
    vImg.dataset.nombre = f.n;
    vImg.alt = f.alt;
    vImg.width = f.ancho; vImg.height = f.alto;
    vImg.style.setProperty('--nat', f.ancho + 'px');
    if (gran !== peq) {
      const grande = new Image();
      grande.onload = () => { if (vImg.dataset.nombre === f.n) vImg.src = grande.src; };
      grande.src = `img/fotos/${f.n}-${gran}.jpg`;
    }
    vPie.textContent = f.pie;
    vN.textContent = (actual + 1) + ' / ' + lista.length;
  }
  function abrirVisor(nombres, nombre, desde) {
    if (!visor || typeof visor.showModal !== 'function') return;
    const vistos = new Set();
    lista = [];
    (nombres || []).forEach((x) => {
      const o = typeof x === 'string' ? { nombre: x } : x;
      const n = o.nombre || o.n;
      if (!n || vistos.has(n)) return;
      vistos.add(n);
      const f = infoFoto(n);
      if (o.alt) f.alt = o.alt;
      if (o.pie) f.pie = o.pie;
      lista.push(f);
    });
    if (!lista.length) return;
    let i = lista.findIndex((f) => f.n === nombre);
    if (i < 0) i = 0;
    origen = desde || document.activeElement;
    poner(i);
    if (!visor.open) visor.showModal();
    if (lenis) lenis.stop();
  }
  C.visor = { abrir: (l, n) => abrirVisor(l, n) };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-visor]');
    if (!b) return;
    const g = b.getAttribute('data-grupo');
    const cont = b.closest('[data-grupo]');
    const botones = g ? $$('[data-visor][data-grupo="' + g + '"]') : cont ? $$('[data-visor]', cont) : $$('[data-visor]', b.closest('section') || document);
    abrirVisor(botones.map((x) => x.dataset.visor), b.dataset.visor, b);
  });
  if (visor) {
    $('#visor-ant').addEventListener('click', () => poner(actual - 1));
    $('#visor-sig').addEventListener('click', () => poner(actual + 1));
    $('#visor-cerrar').addEventListener('click', () => visor.close());
    visor.addEventListener('click', (e) => { if (e.target === visor || e.target.classList.contains('visor__fig')) visor.close(); });
    visor.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') poner(actual - 1); else if (e.key === 'ArrowRight') poner(actual + 1); });
    visor.addEventListener('close', () => { if (lenis && !document.body.classList.contains('menu')) lenis.start(); if (origen && document.contains(origen)) origen.focus({ preventScroll: true }); });
  }

  /* ============ 12. pestañas de «Por dentro» ============ */
  const pestanas = $$('.pestana');
  function elegirPestana(p, enfocar) {
    pestanas.forEach((t) => {
      const on = t === p;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (enfocar) p.focus();
  }
  pestanas.forEach((p, i) => {
    p.addEventListener('click', () => elegirPestana(p));
    p.addEventListener('keydown', (e) => {
      let j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % pestanas.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + pestanas.length) % pestanas.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = pestanas.length - 1;
      if (j >= 0) { e.preventDefault(); elegirPestana(pestanas[j], true); }
    });
  });

  /* ============ 13. el foco del teclado: contorno de 2 px y un rayado de plumilla debajo ============ */
  const rayado = $('#foco-rayado');
  let enfocado = null;
  function ponerRayado() {
    if (!rayado) return;
    const el = enfocado;
    if (!el || !document.contains(el) || el.closest('dialog')) { rayado.classList.remove('es-visible'); return; }
    const r = el.getBoundingClientRect();
    if (!r.width) { rayado.classList.remove('es-visible'); return; }
    const fijo = !!el.closest('.cab, .cookies, .mando, .menu-movil, .saltar');
    rayado.classList.toggle('es-fijo', fijo);
    const ancho = Math.max(32, Math.min(r.width + 8, 420));
    rayado.style.width = ancho + 'px';
    rayado.style.left = (r.left + r.width / 2 - ancho / 2 + (fijo ? 0 : scrollX)) + 'px';
    rayado.style.top = (r.bottom + 6 + (fijo ? 0 : scrollY)) + 'px';
    rayado.style.color = getComputedStyle(el).getPropertyValue('--foco').trim() || '';
    rayado.classList.add('es-visible');
  }
  // :focus-visible se decide al terminar de moverse el foco: se mira un instante después
  let tFoco = 0;
  const mirarFoco = () => {
    clearTimeout(tFoco);
    tFoco = setTimeout(() => {
      const el = document.activeElement;
      let visible = false;
      try { visible = !!el && el !== document.body && el.matches(':focus-visible'); } catch (er) {}
      enfocado = visible ? el : null;
      ponerRayado();
    }, 0);
  };
  document.addEventListener('focusin', mirarFoco);
  document.addEventListener('focusout', mirarFoco);

  /* ============ 14. con el scroll: cabecera, láminas y módulos que esperan ============ */
  let pend = 0;
  function alScroll() {
    pend = 0;
    pintarCabecera();
    pintarLaminas();
    reintentar();
    if (enfocado && rayado.classList.contains('es-fijo')) ponerRayado();
  }
  addEventListener('scroll', () => { if (!pend) pend = requestAnimationFrame(alScroll); }, { passive: true });
  // los módulos cambian de alto al montarse: se vuelve a medir (solo se lee, no se rehace nada)
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (!pend) pend = requestAnimationFrame(alScroll); }).observe($('#principal'));
  alScroll();

  /* ============ 15. MANDO DE MAQUETA (no viaja al cliente) ============ */
  if (mando && raiz.classList.contains('revision')) {
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === sobria())));
    botones.forEach((b) => b.addEventListener('click', () => {
      const antes = sobria();
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (antes === sobria()) return;
      pintarLaminas(true);
      remontarTodos();
      document.dispatchEvent(new CustomEvent('cortina:densidad', { detail: sobria() ? 'sobria' : 'aldea' }));
    }));
    pintarMando();
    verMando();
  }
  /* fin del MANDO DE MAQUETA */

  /* ============ 16. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => {
      anchoVista = innerWidth; altoVista = innerHeight;
      document.dispatchEvent(new CustomEvent('cortina:resize'));
      alScroll();
      ponerRayado();
    }, 200);
  });

  /* ============ 17. la cortina: lo que depende de todo lo anterior ============ */
  if (C.cortinaFuera) setTimeout(alSalir, 0);
  // si la cortina se esconde o desaparece por su cuenta, también cuenta como retirada
  const cortinaEl = $('#cortina, .cortina, [data-cortina]');
  if (cortinaEl && 'MutationObserver' in window) {
    const mo = new MutationObserver(() => {
      if (!document.contains(cortinaEl) || cortinaEl.hidden || cortinaEl.dataset.estado === 'fuera') { mo.disconnect(); retirarCortina(); }
    });
    mo.observe(document.body, { childList: true });
    mo.observe(cortinaEl, { attributes: true, attributeFilter: ['hidden', 'data-estado'] });
  }
  // sin cortina, con movimiento reducido o si el JS de la cortina no llega: fuera ya
  if ((!cortinaEl && !raiz.classList.contains('cortina-activa')) || !motion) retirarCortina();
  addEventListener('load', () => { if (cortinaEl && !(C.llave && typeof C.llave.montar === 'function')) setTimeout(() => { if (!C.cortinaFuera) retirarCortina(); }, 2500); });
  // red de seguridad propia por si la cortina se atasca
  setTimeout(retirarCortina, 7000);


  // lo que pueden usar los módulos y las pruebas
  C.web = {
    motion, quieto, sobria, lenis, irA, montados,
    alAbrirse: C.alAbrirse, abrir: C.abrir, retirarCortina,
    get fuera() { return fuera; }, get altoVista() { return altoVista; },
  };
  document.dispatchEvent(new CustomEvent('cortina:web'));
})();
