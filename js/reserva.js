/* ------------------------------------------------------------------
   Aldea Rural A Cortiña · reserva.js · «Elige tu llave»
   Motor de reservas de DEMOSTRACIÓN (el de casa entera de Tulla y Casa de Agosto, llevado a cuatro opciones,
   cada una con su llave dibujada). Pasos: llave → fechas → personas → datos → confirmación.
   Las noches ocupadas se generan (siempre las mismas para cada año y cada unidad; la aldea entera solo está
   libre si lo están las tres); no hay servidor: no se envía, se guarda ni se cobra nada.

   SUPUESTOS (marcados también en la página y en el README; ni su web ni sus fichas publican tarifas):
   - precio por persona y noche: 27 € en temporada baja y 32 € en alta (los portales piden de 26 a 30 €);
   - temporada alta = Semana Santa, puentes y festivos nacionales, julio y agosto; mínimo 2 noches;
   - mínimo facturable: 2 personas en cada apartamento, 4 en la casa y 8 en la aldea entera (la suma);
   - plazas: casa 6 (+1 supletoria), cada apartamento 2 (+1 supletoria o sofá cama), aldea 10 (+3): POR CONFIRMAR.
   DATOS REALES (de su web y de las fichas): cuna a 10 € por noche, menores de 2 años gratis en las camas
   existentes, entrada de 16:00 a 20:00, salida antes de las 12:00, sin mascotas, piscina solo en julio y agosto.
   Al conectar el motor real, solo cambian ocupada() y la confirmación.

   API (la usa main.js): Cortina.motor.elegir('casa'|'apto1'|'apto2'|'aldea'), Cortina.motor.mes(2 | 'febrero' | '2027-02').
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const raiz = document.getElementById('motor');
  if (!raiz) return;
  const C = (window.Cortina = window.Cortina || {});

  /* ---------- fechas ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const clave = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deClave = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const mas = (k, n) => { const d = deClave(k); d.setDate(d.getDate() + n); return clave(d); };
  const entre = (a, b) => Math.round((deClave(b) - deClave(a)) / 864e5);
  const hoy = clave(new Date());
  const fCorta = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const fLarga = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const fEur = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const corta = (k) => fCorta.format(deClave(k));
  const larga = (k) => fLarga.format(deClave(k));
  const eur = (n) => fEur.format(Math.round(n * 100) / 100) + ' €';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // Domingo de Pascua (algoritmo anónimo gregoriano)
  function pascua(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return clave(new Date(y, mes - 1, dia));
  }

  /* ---------- las cuatro llaves ---------- */
  const UNIDADES = {
    casa: { nombre: 'La casa', corto: 'Casa', max: 6, sup: 1, min: 4, cunas: 3, llave: 'img/llave/llave-casa.svg', datos: 'Tres dormitorios con baño, uno adaptado en la planta baja.', plazas: 'Hasta 6 + 1 supletoria' },
    apto1: { nombre: 'Apartamento 1', corto: 'Apto. 1', max: 2, sup: 1, min: 2, cunas: 1, llave: 'img/llave/llave-apto1.svg', datos: 'Planta baja. Un dormitorio con baño y salón-cocina.', plazas: '2 + 1 supletoria' },
    apto2: { nombre: 'Apartamento 2', corto: 'Apto. 2', max: 2, sup: 1, min: 2, cunas: 1, llave: 'img/llave/llave-apto2.svg', datos: 'Planta alta. Un dormitorio con baño y salón-cocina.', plazas: '2 + sofá cama' },
    aldea: { nombre: 'La aldea entera', corto: 'Aldea', max: 10, sup: 3, min: 8, cunas: 5, llave: 'img/llave/llave-aldea.svg', datos: 'La casa y los dos apartamentos: las tres llaves en una argolla.', plazas: 'Hasta 10 + 3' },
  };
  const ORDEN = ['casa', 'apto1', 'apto2', 'aldea'];

  /* ---------- tarifas y temporada (SUPUESTOS) ---------- */
  const PRECIO = { baja: 27, alta: 32 };     // por persona y noche
  const CUNA = 10;                           // por noche y cuna (dato real)
  const MIN_NOCHES = 2, VENTANA = 12;
  const festivos = new Map();
  function festivosDe(y) {
    if (festivos.has(y)) return festivos.get(y);
    const s = new Set(['01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'].map((md) => `${y}-${md}`));
    s.add(mas(pascua(y), -2));
    [...s].forEach((k) => { const w = deClave(k).getDay(); if (w === 2) s.add(mas(k, -1)); if (w === 4) s.add(mas(k, 1)); });
    festivos.set(y, s);
    return s;
  }
  const cacheAlta = new Map();
  // una noche es de temporada alta si cae en Semana Santa, en julio o agosto, o si esa noche o la siguiente es festivo o puente
  function esAlta(k) {
    if (cacheAlta.has(k)) return cacheAlta.get(k);
    const y = +k.slice(0, 4), md = k.slice(5), p = pascua(y);
    const f = festivosDe(y), sig = mas(k, 1), fs = festivosDe(+sig.slice(0, 4));
    const v = (k >= mas(p, -7) && k <= p) || (md >= '07-01' && md <= '08-31') || f.has(k) || fs.has(sig);
    cacheAlta.set(k, v);
    return v;
  }

  /* ---------- noches ocupadas de ejemplo (siempre las mismas, por unidad) ---------- */
  function azar(s) { return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // casa: más pedida; apartamentos: menos, y cada uno con su calendario
  const SEMILLA = { casa: [2022, 0.30, 0.85], apto1: [1759, 0.22, 0.55], apto2: [1871, 0.20, 0.5] };
  function generar(unidad) {
    const [sem, pFin, pSS] = SEMILLA[unidad];
    const set = new Set();
    const tomar = (a, n) => { for (let i = 0; i < n; i++) set.add(mas(a, i)); };
    const anios = new Set();
    for (let k = mas(hoy, -40), fin = mas(hoy, 400); k <= fin; k = mas(k, 1)) anios.add(+k.slice(0, 4));
    anios.forEach((y) => {
      const r = azar(y * 1000 + sem);
      for (let k = `${y}-01-01`; k <= `${y}-12-31`; k = mas(k, 1)) if (deClave(k).getDay() === 5 && r() < pFin) tomar(k, 2);
      if (r() < pSS) tomar(mas(pascua(y), -3), 4);
      let k = `${y}-07-01`;
      while (k < `${y}-09-01`) { const n = 3 + Math.floor(r() * 6); if (r() < 0.78) tomar(k, n); k = mas(k, n + (r() < 0.4 ? 1 : 0)); }
      [[`${y}-02-06`, 2], [`${y}-10-10`, 3], [`${y}-10-31`, 3], [`${y}-12-05`, 4], [`${y}-12-30`, 3], [`${y}-05-01`, 2]].forEach(([a, n]) => { if (r() < 0.7) tomar(a, n); });
    });
    return set;
  }
  const OCUP = { casa: generar('casa'), apto1: generar('apto1'), apto2: generar('apto2') };
  const ocupadaDe = (u, k) => (u === 'aldea' ? OCUP.casa.has(k) || OCUP.apto1.has(k) || OCUP.apto2.has(k) : OCUP[u].has(k));

  /* ---------- estado ---------- */
  const b0 = deClave(hoy);
  const st = { y: b0.getFullYear(), m: b0.getMonth(), unidad: null, ini: null, fin: null, pers: 2, cunas: 0, paso: 'llave', msg: '', datos: {}, loc: '' };
  const minMes = st.y * 12 + st.m, maxMes = minMes + VENTANA - 1;
  const limite = clave(new Date(b0.getFullYear(), b0.getMonth() + VENTANA, 0));
  const U = () => UNIDADES[st.unidad || 'casa'];
  const ocupada = (k) => ocupadaDe(st.unidad || 'casa', k);
  const libreEntre = (a, b) => { for (let k = a; k < b; k = mas(k, 1)) if (ocupada(k)) return false; return true; };
  const noches = () => { if (!st.ini || !st.fin) return []; const r = []; for (let k = st.ini; k < st.fin; k = mas(k, 1)) r.push(k); return r; };
  const maxPers = () => U().max + U().sup;
  const cuenta = () => {
    const n = noches(), alta = n.filter(esAlta).length, baja = n.length - alta;
    const fact = Math.max(st.pers, U().min);
    const cunas = st.cunas * CUNA * n.length;
    const total = (alta * PRECIO.alta + baja * PRECIO.baja) * fact + cunas;
    return { n: n.length, alta, baja, fact, cunas, total };
  };
  // la piscina solo abre en julio y agosto
  function notaPiscina() {
    const n = noches();
    if (!n.length) return '';
    const dentro = n.filter((k) => k.slice(5, 7) === '07' || k.slice(5, 7) === '08').length;
    if (dentro === n.length) return 'La piscina estará abierta durante tu estancia (abre en julio y agosto).';
    if (!dentro) return 'Un aviso: la piscina solo abre en julio y agosto, y estas noches caen fuera. El resto de la aldea sigue ahí.';
    return 'Un aviso: la piscina solo abre en julio y agosto, y parte de tu estancia cae fuera.';
  }
  function primeraLibre(u) {
    for (let k = mas(hoy, 1), i = 0; i < 400; k = mas(k, 1), i++) {
      if (deClave(k).getDay() === 5 && k <= mas(limite, -2) && !ocupadaDe(u, k) && !ocupadaDe(u, mas(k, 1))) return k;
    }
    return null;
  }

  /* ---------- pintar ---------- */
  const DSEM = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const PASOS = [['llave', 'Llave'], ['fechas', 'Fechas'], ['personas', 'Personas'], ['datos', 'Tus datos'], ['hecho', 'Confirmación']];
  const SUP = '<span class="sup">supuesto</span>';
  const PCONF = '<span class="sup">por confirmar</span>';
  const AVISO = '<p class="motor__fino motor__aviso">Demostración: no se envía, no se guarda ni se cobra nada.</p>';
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  // por si el dibujo de la llave aún no existe (o no carga): una llave de hierro sencilla, en línea
  const LLAVE_SVG = '<svg viewBox="0 0 70 150" width="70" height="150" aria-hidden="true" focusable="false"><g fill="none" stroke="#1F1A17" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="35" cy="24" rx="19" ry="17"/><ellipse cx="35" cy="24" rx="9" ry="7.5"/><path d="M35 41v96M35 106h17v9h-17M35 124h13v8h-13"/></g></svg>';
  const imgLlave = (u) => `<img src="${UNIDADES[u].llave}" alt="" width="70" height="136" loading="lazy" decoding="async">`;

  function mesHTML(y, m) {
    const primero = new Date(y, m, 1), dias = new Date(y, m + 1, 0).getDate();
    const off = (primero.getDay() + 6) % 7;
    const nombre = primero.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    let h = `<div class="mes"><h4 class="mes__tit">${nombre[0].toUpperCase() + nombre.slice(1)}</h4><div class="dias" role="group" aria-label="${nombre}">`;
    h += DSEM.map((d) => `<span class="dsem" aria-hidden="true">${d}</span>`).join('');
    for (let i = 0; i < off; i++) h += '<span class="vacio"></span>';
    for (let d = 1; d <= dias; d++) {
      const k = `${y}-${pad(m + 1)}-${pad(d)}`;
      const c = ['dia'];
      let dis = false, et = larga(k);
      if (k < hoy || k > limite) { c.push('pasado'); dis = true; }
      else if (ocupada(k)) {
        if (st.ini && !st.fin && k > st.ini && libreEntre(st.ini, k)) { c.push('solo-salida'); et += ', libre para salir'; }
        else { c.push('ocupado'); dis = true; et += ', ocupado'; }
      } else et += ', libre';
      if (esAlta(k) && !dis) { c.push('alta'); et += ', temporada alta'; }
      if (st.ini && k === st.ini) { c.push('ini'); et += ', llegada'; }
      if (st.fin && k === st.fin) { c.push('fin'); et += ', salida'; }
      if (st.ini && st.fin && k > st.ini && k < st.fin) c.push('rango');
      h += `<button type="button" class="${c.join(' ')}" data-k="${k}" aria-label="${et}"${dis ? ' aria-disabled="true" tabindex="-1"' : ''}${(k === st.ini || k === st.fin) ? ' aria-pressed="true"' : ''}>${d}</button>`;
    }
    return h + '</div></div>';
  }

  const resumenFechas = () => `<div class="fechas"><div><small>Llegada</small><b>${st.ini ? corta(st.ini) : '—'}</b></div><div><small>Salida</small><b>${st.fin ? corta(st.fin) : '—'}</b></div></div>`;
  function desglose() {
    const c = cuenta();
    let d = '<div class="desglose" id="desglose">';
    if (!c.n) d += `<div class="nada">${st.ini ? 'Ahora, el día de salida.' : 'Elige el día de llegada en el calendario.'}</div>`;
    else {
      const per = c.fact === 1 ? '1 persona' : c.fact + ' personas';
      if (c.baja) d += `<div><span>${c.baja} ${c.baja === 1 ? 'noche' : 'noches'} × ${per} × ${eur(PRECIO.baja)}</span><span>${eur(c.baja * PRECIO.baja * c.fact)}</span></div>`;
      if (c.alta) d += `<div><span>${c.alta} ${c.alta === 1 ? 'noche' : 'noches'} de temporada alta × ${per} × ${eur(PRECIO.alta)}</span><span>${eur(c.alta * PRECIO.alta * c.fact)}</span></div>`;
      if (st.cunas) d += `<div><span>${st.cunas === 1 ? 'Cuna' : st.cunas + ' cunas'} × ${c.n} noches × ${eur(CUNA)}</span><span>${eur(c.cunas)}</span></div>`;
      d += `<div class="tot"><span>Total estimado</span><span data-total>${eur(c.total)}</span></div>`;
    }
    return d + '</div>';
  }
  const chipUnidad = () => {
    const u = U();
    return `<div class="motor__unidad">${imgLlave(st.unidad)}<span><b>${u.nombre}</b><small>${u.plazas}</small></span><button type="button" class="btn btn--linea" data-acc="cambiar-llave">Cambiar de llave</button></div>`;
  };

  function panelLlaves() {
    return `<div class="motor__llaves"><h3 id="motor-tit-paso" tabindex="-1">¿Qué puerta quieres abrir?</h3>
      <div class="llaves" role="radiogroup" aria-labelledby="motor-tit-paso">${ORDEN.map((k) => {
        const u = UNIDADES[k];
        return `<label class="llave"><input type="radio" name="llave" value="${k}"${st.unidad === k ? ' checked' : ''}><span class="llave__dib">${imgLlave(k)}</span><span><span class="llave__nom">${u.nombre}</span><span class="llave__datos">${u.datos}</span><span class="llave__plazas">${u.plazas}</span></span></label>`;
      }).join('')}</div>
      <p class="motor__fino">Las plazas son las que salen de su web y de las fichas de los portales ${PCONF}.</p>
      <p><button type="button" class="btn btn--marca" data-acc="a-fechas" aria-disabled="${!st.unidad}">Seguir: las noches</button></p></div>`;
  }
  function panelFechas() {
    const c = cuenta(), listo = c.n >= MIN_NOCHES, piscina = notaPiscina();
    return `<h3 id="motor-tit-paso" tabindex="-1">Tu estancia</h3>
      ${chipUnidad()}
      ${resumenFechas()}
      ${desglose()}
      ${piscina ? `<p class="motor__piscina">${piscina}</p>` : ''}
      <button type="button" class="btn btn--marca" data-acc="seguir" aria-disabled="${!listo}">Seguir: cuántos sois</button>
      <p class="motor__fino">Mínimo ${MIN_NOCHES} noches ${SUP}. Precio por persona y noche: ${eur(PRECIO.baja)} en temporada baja y ${eur(PRECIO.alta)} en alta ${SUP}.</p>`;
  }
  function panelPersonas() {
    const u = U(), extra = st.pers > u.max;
    return `<h3 id="motor-tit-paso" tabindex="-1">¿Cuántas personas?</h3>
      ${chipUnidad()}
      ${resumenFechas()}
      <div class="pers"><div><small>Personas · hasta ${u.max}${u.sup ? ' + ' + u.sup + ' con supletoria' : ''}</small><b aria-live="polite" id="motor-pers">${st.pers}</b></div>
        <button type="button" data-acc="menos" aria-label="Una persona menos"${st.pers <= 1 ? ' disabled' : ''}>−</button>
        <button type="button" data-acc="mas" aria-label="Una persona más"${st.pers >= maxPers() ? ' disabled' : ''}>+</button></div>
      ${extra ? `<p class="motor__fino">A partir de la persona ${u.max + 1}, se usan las camas supletorias o el sofá cama ${PCONF}.</p>` : ''}
      ${st.pers < u.min ? `<p class="motor__fino">Se factura como mínimo por ${u.min} personas ${SUP}.</p>` : ''}
      <div class="pers"><div><small>Cunas · ${eur(CUNA)} por noche cada una</small><b aria-live="polite" id="motor-cunas">${st.cunas}</b></div>
        <button type="button" data-acc="menos-cuna" aria-label="Una cuna menos"${st.cunas <= 0 ? ' disabled' : ''}>−</button>
        <button type="button" data-acc="mas-cuna" aria-label="Una cuna más"${st.cunas >= u.cunas ? ' disabled' : ''}>+</button></div>
      <p class="motor__fino">Los menores de 2 años duermen gratis en las camas existentes y no cuentan como persona. Máximo una cuna o una supletoria por habitación; no hay en todas.</p>
      ${desglose()}
      <p class="motor__fino">Mascotas: no se admiten.</p>
      <button type="button" class="btn btn--marca" data-acc="a-datos">Seguir: tus datos</button>
      <button type="button" class="btn btn--linea" data-acc="volver">Cambiar fechas</button>`;
  }
  function panelDatos() {
    const c = cuenta(), v = st.datos;
    return `<h3 id="motor-tit-paso" tabindex="-1">Tus datos</h3>
      <p class="motor__fino"><b>${U().nombre}</b> · ${corta(st.ini)} → ${corta(st.fin)} · ${c.n} noches · ${st.pers} ${st.pers === 1 ? 'persona' : 'personas'} · <b>${eur(c.total)}</b></p>
      <form class="form" id="motor-form" novalidate>
        <label for="m-nombre">Nombre y apellidos<input type="text" id="m-nombre" autocomplete="name" required value="${esc(v.nombre)}"></label>
        <label for="m-correo">Correo<input type="email" id="m-correo" autocomplete="email" required value="${esc(v.correo)}"></label>
        <label for="m-tel">Teléfono<input type="tel" id="m-tel" autocomplete="tel" inputmode="tel" required value="${esc(v.tel)}"></label>
        <label for="m-nota">¿Algo que debamos saber? <span>(opcional)</span><textarea id="m-nota" rows="2">${esc(v.nota)}</textarea></label>
        <label class="check" for="m-ok"><input type="checkbox" id="m-ok" required${v.ok ? ' checked' : ''}><span>He leído la <a class="enlace" href="privacidad.html">política de privacidad</a>.</span></label>
        <p class="motor__msg" id="m-error" aria-live="assertive"></p>
        <button type="submit" class="btn btn--marca">Pedir la reserva</button>
        ${AVISO}
        <button type="button" class="btn btn--linea" data-acc="volver-pers">Volver</button>
      </form>`;
  }
  function panelHecho() {
    const c = cuenta();
    return `<div class="confirmacion">
      <h3 id="motor-tit-paso" tabindex="-1">Llave pedida <small>(de demostración)</small></h3>
      <p class="confirmacion__loc" id="motor-loc">${st.loc}</p>
      <p><b>${U().nombre}</b><br>${larga(st.ini)} → ${larga(st.fin)}<br>${c.n} noches · ${st.pers} ${st.pers === 1 ? 'persona' : 'personas'}${st.cunas ? ' · ' + (st.cunas === 1 ? '1 cuna' : st.cunas + ' cunas') : ''} · ${eur(c.total)}</p>
      <p>La casa te escribiría para confirmarla. Entrada de 16:00 a 20:00 y salida antes de las 12:00. La cancelación y la señal las acordaría contigo la casa ${PCONF}.</p>
      <p class="motor__fino" id="motor-demo-hecho">Demostración: no se ha enviado, guardado ni cobrado nada. En la web de verdad te llegaría la confirmación por correo.</p>
      <button type="button" class="btn btn--linea" data-acc="otra">Hacer otra reserva</button>
    </div>`;
  }

  function pintar(foco) {
    const y2 = st.m === 11 ? st.y + 1 : st.y, m2 = (st.m + 1) % 12, actual = st.y * 12 + st.m;
    const iPaso = PASOS.findIndex((p) => p[0] === st.paso);
    const pasos = '<ol class="motor__pasos" aria-label="Pasos">' + PASOS.map(([k, t], i) => `<li${i === iPaso ? ' aria-current="step"' : ''}${i < iPaso ? ' class="hecho"' : ''}>${t}</li>`).join('') + '</ol>';
    if (st.paso === 'llave') raiz.innerHTML = pasos + panelLlaves();
    else {
      const panel = { fechas: panelFechas, personas: panelPersonas, datos: panelDatos, hecho: panelHecho }[st.paso]();
      raiz.innerHTML = pasos + `<div class="motor__in">
        <div class="motor__cal"${st.paso !== 'fechas' ? ' inert' : ''}>
          <div class="motor__top"><h3>Noches libres · ${U().nombre}</h3>
            <button type="button" class="motor__nav" data-acc="prev" aria-label="Mes anterior"${actual <= minMes ? ' disabled' : ''}>‹</button>
            <button type="button" class="motor__nav" data-acc="next" aria-label="Mes siguiente"${actual + 1 >= maxMes ? ' disabled' : ''}>›</button></div>
          <div class="motor__meses">${mesHTML(st.y, st.m)}${mesHTML(y2, m2)}</div>
          <div class="motor__ley"><span><i style="background:var(--almagre-hondo)"></i>Tu estancia</span><span><i style="background:repeating-linear-gradient(135deg,#EAE2D4 0 4px,#D4C9B8 4px 6px)"></i>Ocupado (de ejemplo)</span><span><i style="background:var(--almagre-texto);border-radius:50%;width:6px;height:6px"></i>Temporada alta</span></div>
          <p class="motor__msg" aria-live="polite">${st.msg}</p>
        </div>
        <div class="motor__res">${panel}</div></div>`;
    }
    if (foco) {
      const el = raiz.querySelector(foco);
      if (el) el.focus({ preventScroll: true });
    }
  }

  /* ---------- cambios de unidad y de mes ---------- */
  function cambiarUnidad(u) {
    if (!UNIDADES[u]) return false;
    const antes = st.unidad;
    st.unidad = u;
    st.pers = Math.max(1, Math.min(st.pers, maxPers()));
    st.cunas = Math.min(st.cunas, UNIDADES[u].cunas);
    // si las noches elegidas chocan con las ocupadas de esta llave, se borran
    if (st.ini && st.fin && !libreEntre(st.ini, st.fin)) { st.ini = st.fin = null; st.msg = 'Esas noches no están libres para esta llave: elige otras.'; }
    else if (antes !== u) st.msg = '';
    if (!st.ini) {
      const k = primeraLibre(u);
      if (k) { st.ini = k; st.fin = mas(k, 2); const d = deClave(k); st.y = d.getFullYear(); st.m = d.getMonth(); if (st.y * 12 + st.m + 1 > maxMes) { st.y = b0.getFullYear(); st.m = b0.getMonth(); } }
    }
    return true;
  }
  function aMes(v) {
    let y, m;
    const s = String(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    if (/^\d{4}-\d{1,2}$/.test(s)) { [y, m] = s.split('-').map(Number); m -= 1; }
    else {
      let n = /^\d{1,2}$/.test(s) ? +s - 1 : MESES.findIndex((x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '') === s);
      if (n < 0 || n > 11) return false;
      m = n; y = b0.getFullYear(); if (y * 12 + m < minMes) y++;
    }
    let idx = y * 12 + m;
    idx = Math.max(minMes, Math.min(maxMes - 1, idx));   // se ven dos meses: el último que cabe es maxMes - 1
    st.y = Math.floor(idx / 12); st.m = idx % 12;
    return true;
  }

  /* ---------- acciones ---------- */
  raiz.addEventListener('error', (e) => {
    const im = e.target;
    if (im && im.tagName === 'IMG' && im.closest('.llave__dib, .motor__unidad')) { const s = document.createElement('span'); s.innerHTML = LLAVE_SVG; im.replaceWith(s.firstChild); }
  }, true);
  raiz.addEventListener('change', (e) => {
    if (e.target.name === 'llave') { cambiarUnidad(e.target.value); pintar(`input[name="llave"][value="${e.target.value}"]`); }
  });
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !raiz.contains(b)) return;
    if (b.dataset.k) {
      if (b.getAttribute('aria-disabled') === 'true' || st.paso !== 'fechas') return;
      const k = b.dataset.k;
      st.msg = '';
      if (!st.ini || st.fin || k <= st.ini) {
        if (ocupada(k)) return;
        st.ini = k; st.fin = null;
      } else if (!libreEntre(st.ini, k)) {
        st.msg = 'Hay noches ocupadas entre medias: elige otra salida.';
        if (!ocupada(k)) { st.ini = k; st.fin = null; }
      } else if (entre(st.ini, k) < MIN_NOCHES) {
        st.msg = `La estancia mínima es de ${MIN_NOCHES} noches.`;
      } else st.fin = k;
      pintar(`[data-k="${k}"]`);
      return;
    }
    const a = b.dataset.acc;
    if (!a) return;
    if (b.getAttribute('aria-disabled') === 'true') {
      if (a === 'seguir') { st.msg = st.ini ? 'Falta el día de salida.' : 'Elige primero el día de llegada.'; pintar(); }
      return;
    }
    let foco = `[data-acc="${a}"]:not(:disabled)`;
    if (a === 'prev') { if (st.y * 12 + st.m <= minMes) return; if (st.m === 0) { st.m = 11; st.y--; } else st.m--; }
    else if (a === 'next') { if (st.y * 12 + st.m + 1 >= maxMes) return; if (st.m === 11) { st.m = 0; st.y++; } else st.m++; }
    else if (a === 'menos') st.pers = Math.max(1, st.pers - 1);
    else if (a === 'mas') st.pers = Math.min(maxPers(), st.pers + 1);
    else if (a === 'menos-cuna') st.cunas = Math.max(0, st.cunas - 1);
    else if (a === 'mas-cuna') st.cunas = Math.min(U().cunas, st.cunas + 1);
    else if (a === 'a-fechas') { if (!st.unidad) return; st.paso = 'fechas'; st.msg = ''; foco = '#motor-tit-paso'; }
    else if (a === 'cambiar-llave') { st.paso = 'llave'; foco = '#motor-tit-paso'; }
    else if (a === 'seguir') { st.paso = 'personas'; st.msg = ''; foco = '#motor-tit-paso'; }
    else if (a === 'a-datos') { st.paso = 'datos'; foco = '#motor-tit-paso'; }
    else if (a === 'volver') { st.paso = 'fechas'; foco = '#motor-tit-paso'; }
    else if (a === 'volver-pers') { guardarDatos(); st.paso = 'personas'; foco = '#motor-tit-paso'; }
    else if (a === 'otra') { st.paso = 'llave'; st.unidad = null; st.ini = st.fin = null; st.datos = {}; st.cunas = 0; st.pers = 2; foco = '#motor-tit-paso'; }
    else return;
    pintar(foco);
    if (['a-fechas', 'cambiar-llave', 'seguir', 'a-datos', 'volver', 'volver-pers', 'otra'].includes(a) && C.web && C.web.irA) {
      const r = raiz.getBoundingClientRect();
      if (r.top < 0 || r.top > innerHeight * 0.5) C.web.irA(raiz);
    }
  });

  function guardarDatos() {
    const v = (id) => { const el = raiz.querySelector('#' + id); return el ? (el.type === 'checkbox' ? el.checked : el.value) : undefined; };
    if (!raiz.querySelector('#m-nombre')) return;
    st.datos = { nombre: v('m-nombre'), correo: v('m-correo'), tel: v('m-tel'), nota: v('m-nota'), ok: v('m-ok') };
  }

  raiz.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target, err = f.querySelector('#m-error');
    guardarDatos();
    const campos = ['m-nombre', 'm-correo', 'm-tel'].map((id) => f.querySelector('#' + id));
    campos.forEach((c) => c.removeAttribute('aria-invalid'));
    const falta = [];
    if (!st.datos.nombre.trim()) falta.push([campos[0], 'el nombre']);
    if (!/^\S+@\S+\.\S{2,}$/.test(st.datos.correo.trim())) falta.push([campos[1], 'un correo válido']);
    if (st.datos.tel.replace(/\D/g, '').length < 9) falta.push([campos[2], 'un teléfono de al menos 9 cifras']);
    if (falta.length) {
      falta.forEach(([c]) => c.setAttribute('aria-invalid', 'true'));
      err.textContent = 'Falta ' + falta.map((x) => x[1]).join(', ') + '.';
      falta[0][0].focus();
      return;
    }
    if (!st.datos.ok) { err.textContent = 'Falta aceptar la política de privacidad.'; f.querySelector('#m-ok').focus(); return; }
    // localizador COR-AAMMDD-NNN (de la llegada); en la demostración no se guarda en ningún sitio
    st.loc = 'COR-' + st.ini.slice(2).replace(/-/g, '') + '-' + String((entre(st.ini, st.fin) * 37 + st.pers * 11 + ORDEN.indexOf(st.unidad) * 53 + st.datos.nombre.length * 7) % 1000).padStart(3, '0');
    st.paso = 'hecho';
    pintar('#motor-tit-paso');
  });

  /* ---------- API para la web y los módulos ---------- */
  C.motor = {
    elegir(u) {
      if (st.paso === 'hecho') { st.ini = null; st.fin = null; st.datos = {}; st.cunas = 0; }
      if (!cambiarUnidad(u)) return false;
      if (st.paso === 'llave' || st.paso === 'hecho') st.paso = 'fechas';
      pintar();
      return true;
    },
    mes(v) { if (!aMes(v)) return false; pintar(); return true; },
    get unidad() { return st.unidad; },
  };

  pintar();

  // para las pruebas
  window.__motor = { st, ocupada: (k, u) => ocupadaDe(u || st.unidad || 'casa', k), ocupadaDe, esAlta, cuenta, pascua, PRECIO, CUNA, UNIDADES, MIN_NOCHES, MAX: () => maxPers(), hoy, limite };
})();
