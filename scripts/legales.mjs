/* Genera los *.src.html de las páginas legales y el 404 con una plantilla común.
   Uso: node scripts/legales.mjs  (después, node construir.mjs)
   El titular sale del aviso legal de su web actual (Alberto Piñeiro Álvarez; su NIF va como lo tienen ellos,
   marcado por confirmar). El número de registro de turismo NO se afirma: TR-OR-97 solo aparece en Trip.com. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const TITULAR = `<dl>
  <dt>Titular</dt><dd>Alberto Piñeiro Álvarez</dd>
  <dt>NIF</dt><dd>76713146G <span class="aviso-corto">por confirmar</span></dd>
  <dt>Nombre comercial</dt><dd>Aldea Rural A Cortiña</dd>
  <dt>Dirección</dt><dd>Pepín, 40 · 32625 Castrelo do Val (Ourense)</dd>
  <dt>Teléfonos</dt><dd><a href="tel:+34988419215">988 41 92 15</a> · <a href="tel:+34645263522">645 263 522</a></dd>
  <dt>Correo</dt><dd><a href="mailto:a.p.pepin@hotmail.com">a.p.pepin@hotmail.com</a></dd>
  <dt>Actividad</dt><dd>Alojamiento y restauración</dd>
  <dt>Registro de turismo</dt><dd><span class="aviso-corto">por confirmar</span></dd>
</dl>
<p class="aviso">PENDIENTE: confirmar el NIF (se ha tomado del aviso legal de su web actual), la dirección postal y el número de registro de turismo vigente (un portal da TR-OR-97, que no se ha podido comprobar).</p>`;

const paginas = {
  'aviso-legal': {
    titulo: 'Aviso legal',
    cuerpo: `
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), estos son los datos del titular de esta web:</p>
${TITULAR}
<h2>Uso de la web</h2>
<p>Esta web informa sobre Aldea Rural A Cortiña, alojamiento rural en Pepín (Castrelo do Val, Ourense). Los precios y las condiciones pueden cambiar: los que valen son los que se confirman al reservar.</p>
<p>Por ahora, la reserva de esta web es una demostración: la ocupación es de ejemplo, los precios son supuestos y no se envía, se guarda ni se cobra nada.</p>
<h2>Propiedad intelectual</h2>
<p>Los textos, el logotipo y las fotografías son del titular o se usan con su permiso. Las letras Ibarra Real Nova, Libre Franklin y Overpass Mono se usan con su licencia libre (SIL Open Font License). El relieve y la ortofoto de «Alrededor» son del Instituto Geográfico Nacional (CC BY 4.0) y las rutas, de OpenStreetMap (ODbL). Las texturas de piedra y de almagre de la web están generadas y no son fotografías.</p>
<p class="aviso">PENDIENTE: confirmar que todas las fotos son de la aldea y se pueden usar (vienen de su web actual), y que los carteles de ayudas del pie son los que deben publicarse.</p>
<h2>Responsabilidad</h2>
<p>Los enlaces a otras webs (Google Maps, las opiniones de Google) llevan a servicios de terceros con sus propias condiciones.</p>
<h2>Ley aplicable</h2>
<p>Estas condiciones se rigen por la ley española. Para cualquier reclamación, llámanos: buscaremos siempre una solución amistosa.</p>`,
  },
  privacidad: {
    titulo: 'Política de privacidad',
    cuerpo: `
<h2>Responsable</h2>
${TITULAR}
<h2>Qué datos tratamos y para qué</h2>
<p>Los que nos das al reservar, al escribirnos o al llamarnos: nombre, teléfono, correo, las fechas, cuántos venís y lo que quieras contarnos. Los usamos para gestionar tu reserva y atenderte.</p>
<p>Al alojarte, la ley obliga a registrar los datos de los viajeros y comunicarlos a las autoridades (Real Decreto 933/2021).</p>
<p>La reserva de esta web es, por ahora, una demostración: lo que escribas en ella no sale de tu navegador ni se guarda.</p>
<h2>Base legal y plazos</h2>
<p>La base es tu consentimiento al reservar, la ejecución de la reserva y, para el registro de viajeros, una obligación legal. Los datos se conservan mientras dura la relación y, después, el tiempo que exige la ley.</p>
<h2>Con quién se comparten</h2>
<p>Con nadie, salvo obligación legal (el registro de viajeros) y siempre con lo imprescindible.</p>
<h2>Tus derechos</h2>
<p>Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación o la portabilidad de tus datos escribiendo a <a href="mailto:a.p.pepin@hotmail.com">a.p.pepin@hotmail.com</a> o llamando al <a href="tel:+34645263522">645 263 522</a>. Si crees que no se han respetado, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).</p>
<h2>Lo que guarda esta web en tu navegador</h2>
<p>Una sola cosa: <code>acortina-cookies</code> en el almacenamiento local, para recordar que ya has visto el aviso de cookies. Más detalles en <a href="cookies.html">cookies</a>.</p>`,
  },
  cookies: {
    titulo: 'Política de cookies',
    cuerpo: `
<p>Esta web no usa cookies propias de análisis ni de publicidad.</p>
<h2>Lo que se guarda en tu navegador</h2>
<ul>
  <li><b>acortina-cookies</b> (almacenamiento local): recuerda que has visto el aviso, para no enseñártelo en cada visita. Es técnica y no caduca sola; puedes borrarla desde tu navegador.</li>
</ul>
<h2>Servicios de terceros</h2>
<ul>
  <li><b>Google Fonts</b>: las letras de la web (Ibarra Real Nova, Libre Franklin y Overpass Mono) se cargan desde los servidores de Google, que reciben tu dirección IP.</li>
  <li><b>Google Maps</b>: el mapa de «Cómo llegar» solo se carga si pulsas «Ver el mapa». A partir de ese momento, Google puede instalar sus cookies.</li>
  <li><b>jsDelivr</b>: las librerías que suavizan el desplazamiento y mueven las animaciones (Lenis y GSAP) se descargan de jsDelivr, que recibe tu dirección IP. No instalan cookies.</li>
</ul>
<h2>El 3D de «Alrededor»</h2>
<p>El relieve en 3D se dibuja en tu navegador con datos del Instituto Geográfico Nacional (relieve MDT05 y ortofoto PNOA, CC BY 4.0) que van con esta misma web: no se conecta a ningún servicio de fuera ni instala cookies. Los caminos y los minutos en coche se calcularon de antemano con OpenStreetMap (OSRM) y también van con la web. La posición del sol y de la luna se calcula en tu navegador.</p>
<p>Puedes volver a ver el aviso desde «Preferencias de cookies», en el pie de la página.</p>`,
  },
  accesibilidad: {
    titulo: 'Declaración de accesibilidad',
    cuerpo: `
<p>El titular se compromete a que esta web sea accesible conforme a la norma UNE-EN 301 549 (nivel AA de las WCAG 2.1).</p>
<h2>Situación de cumplimiento</h2>
<p class="aviso">PENDIENTE: completar tras la revisión de accesibilidad previa a la publicación.</p>
<p>La web se ha construido para poder usarse entera con el teclado y con lector de pantalla: contrastes de al menos 4,5:1 en sus tres superficies (papel, piedra y almagre), foco visible, textos alternativos en las fotos, formularios con etiquetas y animaciones que se desactivan si tu sistema pide reducir el movimiento. Los dibujos, la puerta de entrada, las láminas de piedra y el 3D son un adorno: la información está también en el texto.</p>
<h2>La aldea</h2>
<p>Uno de los tres dormitorios de la casa, en la planta baja, está adaptado para personas con movilidad reducida.</p>
<p class="aviso">PENDIENTE: confirmar qué tiene exactamente su baño y los accesos a la casa, al cenador y a la piscina.</p>
<h2>Contacto</h2>
<p>Si encuentras una barrera, escribe a <a href="mailto:a.p.pepin@hotmail.com">a.p.pepin@hotmail.com</a> o llama al <a href="tel:+34645263522">645 263 522</a>. Te responderemos y te daremos la información en un formato accesible.</p>`,
  },
};

const cabeza = (titulo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · Aldea Rural A Cortiña</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ibarra+Real+Nova:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Libre+Franklin:wght@400;500;600&family=Overpass+Mono&display=swap">
<link rel="stylesheet" href="css/estilos.css">
<link rel="stylesheet" href="css/legal.css">
<link rel="icon" href="marca/favicon.svg" type="image/svg+xml">
<link rel="icon" href="marca/favicon-32.png" sizes="32x32" type="image/png">
</head>`;

const MARCA = `<a class="marca" href="./"><img class="marca__logo" src="marca/logo-160.png" srcset="marca/logo-160.png 2x, marca/logo-240.png 3x" width="84" height="61" alt="Aldea Rural A Cortiña, a la portada"></a>`;

for (const [nombre, p] of Object.entries(paginas)) {
  const html = `${cabeza(p.titulo)}
<body>
<header class="legal-cab sup-papel">
  <div class="env">
    ${MARCA}
    <a class="volver" href="./">Volver a la portada</a>
  </div>
</header>
<main class="legal sup-papel">
  <div class="env">
    <h1>${p.titulo}</h1>
${p.cuerpo}
  </div>
</main>
<footer class="legal-pie sup-piedra">
  <div class="env">
    <a href="aviso-legal.html">Aviso legal</a>
    <a href="privacidad.html">Privacidad</a>
    <a href="cookies.html">Cookies</a>
    <a href="accesibilidad.html">Accesibilidad</a>
  </div>
</footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(RAIZ, `${nombre}.src.html`), html);
  console.log(`${nombre}.src.html`);
}

fs.writeFileSync(path.join(RAIZ, '404.src.html'), `${cabeza('Página no encontrada')}
<body class="no-hay sup-piedra">
<style>
  .no-hay { min-height: 100svh; display: grid; place-items: center; text-align: center; padding: 24px; }
  .no { display: grid; gap: 22px; justify-items: center; max-width: 32em; }
  .no__logo { background: var(--papel); padding: 10px 14px; }
  .no__logo img { width: 200px; height: auto; }
  .no h1 { font: 400 clamp(2.4rem, 7vw, 3.6rem)/1.04 var(--f-tit); }
  .no p { color: var(--texto-2); }
  .no a:not(.btn) { color: var(--texto); }
</style>
  <main class="no">
    <p class="no__logo"><img src="marca/logo-480.png" alt="Aldea Rural A Cortiña" width="200" height="144"></p>
    <h1>Esta llave no abre ninguna puerta</h1>
    <p>La página que buscas no existe o ha cambiado de sitio. La aldea sigue donde estaba: en Pepín, en el concello de Castrelo do Val.</p>
    <a class="btn btn--marca" href="./#reservar">Elegir llave</a>
    <a href="./">Volver a la portada</a>
  </main>
</body>
</html>
`);
console.log('404.src.html');
