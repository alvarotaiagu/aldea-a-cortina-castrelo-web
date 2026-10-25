# Aldea Rural A Cortiña · Pepín, Castrelo do Val (Ourense) · «Almagre y piedra»

Web nueva para Aldea Rural A Cortiña: una **casa** (3 dormitorios con baño, uno adaptado en la planta baja), **dos apartamentos** de un dormitorio, un cenador rojo con barbacoa y placas solares, piscina ovalada (solo en julio y agosto), sala de juegos, césped y un bar con comida para llevar («Burguer Rural»), todo dentro de la aldea de Pepín. No la han encargado: es una propuesta que Álvaro les enseñará (su WordPress actual está roto). En local, con `noindex, nofollow` en todas las páginas, **sin publicar y sin commits**.

- **Datos y fuentes:** `ref/DATOS-ALDEA-A-CORTINA.md`; fotos: `ref/FOTOS.md`. Lo que no está ahí no se afirma: va a `PENDIENTES.md` o sale como «supuesto» / «por confirmar».
- **Encargo:** `ENCARGO.md` (cinco agentes: Web, Entrada, Aldea, Ruta y Comarca). **Una sola página** (`index.html`) más legales y 404. Solo castellano.
- **Nada de historia inventada:** no sabemos la edad de las casas ni si el dibujo del logo es un edificio concreto. La web no lo dice.

## Concepto

Toda la web está hecha con **los dos materiales de la aldea, el almagre de sus fachadas y su piedra**, y con **la tinta de su logo** (un dibujo a plumilla de una solaina). Se entra **con su llave** (cortina), se **atraviesa el dibujo del logo** hasta la aldea real (portada), y la aldea se entiende en **un plano dibujado a plumilla** donde cada edificio se toca. Alrededor, el valle en 3D con el cielo de ahora, **cuándo venir** con las máscaras del Entroido y **la barra** de su Burguer Rural.

### Las tres superficies (y solo tres)

| Superficie | Color | Qué es | Dónde |
|---|---|---|---|
| **Papel** (`sup-papel`; `sup-papel-2` para variar) | `#F4EFE6` / `#EAE2D4` | claro, cálido; donde vive la tinta | La cortiña, La aldea, Por dentro, Cuándo venir, Lo que dicen, el pie |
| **Piedra** (`sup-piedra`) | `#2A2420` | lajas pardo-pizarra oscuras, **generadas** (`img/piedra/fondo.webp`), nunca foto | Fuera, Alrededor, Cómo llegar |
| **Almagre** (`sup-almagre`) | `#A3302C` | paño rojo de fachada (`img/piedra/almagre.webp`) | La barra, Reservar |

Cada `<section>` lleva su clase y `data-sup`; la hoja define en cada superficie `--fondo --texto --texto-2 --acento --linea --btn-f --btn-t --foco --sup-tinta --marco`, que leen los módulos con `var(--x, valor)`.

**El paso entre secciones es una lámina de piedra** (`.lamina`, `img/piedra/losa.webp`): una losa con borde irregular de laja que se desliza con el scroll (`transform: translateY(--p × −100%)`, `--p` de 0 a 1, nunca animando `height`) y destapa debajo el almagre o la piedra de la sección. Tres variantes de borde (`--borde-1/2/3` en `css/piedra.css`). De piedra a papel, el papel sube con su canto de laja, quieto (`--canto-1/2`). Con movimiento reducido o en la sobria, la losa se queda quieta con su borde a medio camino.

**La tinta:** titulares en tinta casi negra parda que se «escriben» de izquierda a derecha al llegar (clip-path, sin partir el texto); filetes y eyebrows con rayado de plumilla (máscaras SVG con el color del texto); fotos con marco fino de tinta o a sangre, nunca con sombras de tarjeta.

**Letras** (Google Fonts, `display=swap`): **Ibarra Real Nova** (titulares), **Libre Franklin** (texto) y **Overpass Mono** (rótulos, distancias, horas).

**§5 bis:** fuera la pila sticky, el marquee, el cursor propio y los contadores que suben. Gesto táctil del hero (la foto a plumilla bajo el dedo) y círculo del logo que se cierra en el pie: módulo Entrada. **Foco del teclado con forma propia:** contorno de 2 px y, debajo del elemento, un rayado corto de plumilla (`#foco-rayado`, lo coloca `main.js`), con el color de cada superficie. LCP medido abajo.

### La página, de arriba abajo

| # | Sección | Quién | Qué lleva |
|---|---|---|---|
| — | **Cortina «La llave»** | Entrada | Puerta de madera, cerradura de hierro y la llave de su foto (`partes/cortina.html`, `css/entrada.css`, `js/llave.js`). |
| 1 | **Portada** | Entrada + Web | El dibujo de la solaina, el viaje por el hueco hasta `casa-fachada`, y el gesto de la plumilla. Respaldo web: la foto con velo, el titular «Una aldea de piedra y almagre en Pepín» y los botones. |
| 2 | **La cortiña** | Web | La palabra explicada, qué hay, **las cuentas de la aldea** (1 casa · 2 apartamentos · 5 dormitorios · 10 + 3 plazas (por confirmar) · piscina en julio y agosto · 8,5 km a Verín), notas al margen con las palabras de los huéspedes y dos detalles (`ventana-granito`, `llave`). |
| — | *De un vistazo* | Web | Solo en la versión sobria: unidades, camas, baños, adaptado, plazas, piscina, sala de juegos, mascotas, horarios y distancias. |
| 3 | **La aldea en plano** | Aldea | El conjunto dibujado a plumilla con edificios que se tocan y fichas. Respaldo web: tres fichas (casa, apartamento 1, apartamento 2) y las zonas comunes. |
| 4 | **Por dentro** | Web | Tres pestañas accesibles (flechas, Inicio, Fin) con galería, lista de lo que tiene cada una y «Elegir esta llave». Visor por nombre. |
| 5 | **Fuera** (piedra) | Web | Piscina (abre en julio y agosto), cenador y barbacoa, vista a Pepín, sala de juegos, wifi y aparcamiento. |
| 6 | **La barra** (almagre) | Comarca | El logo de Burguer Rural tal cual, las cinco categorías y la XXL que se monta. Respaldo web: logo, frase, categorías y «Llamar para pedir». |
| 7 | **Alrededor** (piedra) | Ruta | **Arranca en el plano 2D** de tinta con los anillos (fluido en cualquier equipo); el 3D del IGN con el cielo de ahora solo se descarga al pulsar «En 3D» (o con `?en-3d`). Respaldo: plano 2D y distancias. **Nunca de portada.** |
| 8 | **Cuándo venir** (papel) | Comarca | Entroido (máscaras), primavera, verano, otoño. Respaldo web: las cuatro épocas en texto con «Ver fechas de …». |
| 9 | **Lo que dicen** | Web | **4,6 en Google · 216 opiniones** y **9,5 en Booking · 66 opiniones**, la cita de José Luis M. (abril de 2026) y las cuatro etiquetas literales de Kayak. Enlace a Google. |
| 10 | **Reservar «Elige tu llave»** (almagre) | Web | Motor de DEMOSTRACIÓN con cuatro llaves (ver abajo). |
| 11 | **Cómo llegar** (piedra) | Web | Pepín, 40 · 32625 Castrelo do Val; distancias; teléfonos; mapa de Google solo al pedirlo. |
| 12 | **Pie «El círculo se cierra»** | Entrada + Web | Hueco `data-modulo="circulo"` con el logo real de respaldo; registro «por confirmar»; «Proyectos con ayudas públicas» con los tres carteles; legales. |

## Cómo se trabaja

- **Edita siempre los `*.src.html` o las `partes/`** (cabeza, cabecera, reserva, llegar, pie y guiones; la cortina es de Entrada). `node construir.mjs` incluye las partes (`<!--parte:…-->`), convierte `<img data-foto>` en `<picture>` AVIF/WebP/JPG, pone el plano de «Alrededor» en `<!--plano-ruta-->` si existe `img/terreno/plano.*`, **quita los `<link>`/`<script>` propios que aún no existan** (con aviso) y pone `?v=<huella>` (`versionar.mjs`, también a `js/3d/arranque.js`). Recuerda «Ctrl+F5» si se publica. Cuando cambie algo en `js/3d/` o `img/terreno/`, sube `VERSION` en `js/3d/arranque.js`.
- **Fotos:** `scripts/fotos-lista.json` + `node scripts/fotos.mjs` (o `node scripts/fotos.mjs piscina llave`). Salen 26 fotos con los nombres de `ref/FOTOS.md` (`img/fotos/<nombre>-<ancho>.{avif,webp,jpg}` + `img/fotos/fotos.json`), **nunca ampliadas** (`ventana-granito` y `llave`, a 900 px). Gradación común: los exteriores bajan el verde del césped (el `#3D662D`) y comprimen las luces para recuperar algo de cielo; los interiores, medio balance de blancos. **Verticales:** `python -I scripts/rectas.py` (receta de la memoria) miró `casa-fachada`, `solaina` y `cenador`: están a plomo (la solaina y el cenador son gran angular de esquina, pero los postes caen rectos), así que no se tocó ninguna.
- **Marca:** `node scripts/marca.mjs` → el logo real (`favicon.jpg`, 512 px) pasado de «tinta negra sobre blanco» a **tinta `#1F1A17` sobre transparente** (sin redibujar un trazo): `marca/logo-160/240/480.png`, `logo-papel-480.png` (para fondos oscuros), `logo-512.png`; los iconos salen del dibujo de la solaina sola; `burguer-rural-*.png` (tal cual), `img/ayudas/*.png` (los carteles, tal cual) e `img/og.jpg`.
- **Texturas de piedra:** `python -I scripts/piedra.py` (semilla fija) → `img/piedra/{losa,fondo,almagre,papel}.webp` y `css/piedra.css`.
- **Legales y 404:** `node scripts/legales.mjs` y después `node construir.mjs`.
- **`node verificar.mjs`** (puerto 8911, una vez al terminar; `node verificar.mjs 4 5` solo corre esos bloques; sin capturas; navegador con `--disable-3d-apis` y la página con `?sin-3d`).
- **`node scripts/rendimiento.mjs`** (puerto 8912): móvil de gama media (Pixel 7, 4G lento, CPU ×4), sin WebGL.
- **`node scripts/probar-borrado-mando.mjs`**: comprueba la receta de borrado del mando.
- **`pruebas/3d-fuente/` (unos 38 MB de descargas del IGN) no se publica nunca.** Está dentro de `pruebas/`, que `.gitignore` deja fuera; no la metas en ninguna lista de ficheros de publicación.

## Contrato web ↔ módulos

- `window.Cortina.<mod>.montar(el, { movimiento, densidad: 'aldea'|'sobria', gl?, sin3d? })` → `{ destruir() }`; el HTML de `el` es el respaldo. Módulos: `llave`, `dibujo` (portada y `dibujo.circulo(el, op)` en el pie), `plano`, `ruta`, `comarca`, `barra`. `main.js` monta cada uno **al acercarse** (900 px de margen; el círculo del pie, 4000 px) y el de la portada **en `alAbrirse`**. Si el JS de un módulo aún no ha llegado (el 3D es un módulo diferido), reintenta al `load` y con `cortina:listo`. Guarda cada respaldo: al cambiar de densidad, `destruir()`, devuelve el respaldo y vuelve a montar.
- **El puente con la cortina** está en `partes/cabeza.html`, desde el primer momento: `Cortina.alAbrirse(fn)`, `Cortina.abrir()`, `Cortina.retirarCortina()` y los eventos `cortina:abre` / `cortina:fuera` (los que lanza `Cortina.cortina` de Entrada). Si la web retira la cortina por su red de seguridad, lanza `cortina:fuera` para los módulos (el 3D la espera). Redes: 6,5 s en la cabeza, 7 s en `main.js` y las de la propia cortina.
- La web pone: `Cortina.reservar(unidad?, { mes }?)` (acepta `reservar('casa')`, `reservar({ mes: 2 })` y `reservar('casa', { mes: 'julio' })`; `unidad` = `'casa'|'apto1'|'apto2'|'aldea'`), `Cortina.visor.abrir(lista, nombre)` (lista de nombres de foto o `{ nombre, alt, pie }`; abre por nombre), `Cortina.motor.elegir(unidad)` / `.mes(…)` y `Cortina.web` (lenis, irA, motion, sobria…). Los botones `[data-reservar="casa"]` y `[data-reservar-mes="2"]` del HTML llaman a `reservar`.
- Tokens que leen los módulos: `--cab --lado --papel --papel-2 --tinta --tinta-2 --almagre --almagre-hondo --almagre-texto --piedra --piedra-2 --liquen --madera --prado --agua --teja --f-tit --f-txt --f-mono` y las clases `sup-papel|sup-piedra|sup-almagre`. `--prado` y `--agua` no los usa la web: son del plano y de las épocas.
- **Sticky del 3D:** ningún antepasado de `.ruta-fijo` lleva `overflow:hidden/auto` ni `transform` (el `body` usa `overflow-x: clip`); `verificar.mjs` lo comprueba cuando la pista existe.

## Reservar «Elige tu llave» (DEMOSTRACIÓN)

Cinco pasos: **llave → fechas → personas → datos → confirmación** con localizador `COR-AAMMDD-NNN`. Cuatro llaves (`img/llave/llave-*.svg`, de Entrada; si falta una, el motor dibuja una de repuesto): **La casa** (hasta 6 + 1 supletoria), **Apartamento 1** (2 + 1), **Apartamento 2** (2 + sofá cama) y **La aldea entera** (10 + 3). Calendario de 12 meses con noches libres y ocupadas **inventadas, siempre las mismas y por unidad; la aldea entera solo está libre si lo están las tres**. **No envía, guarda ni cobra nada, y lo dice** (encima del motor, junto al botón y en la confirmación).

**Supuestos** (marcados junto al motor y en `PENDIENTES.md`): 27 € por persona y noche en temporada baja y 32 € en alta (los portales piden de 26 a 30 €); temporada alta = Semana Santa, puentes y festivos nacionales, julio y agosto; mínimo 2 noches; **mínimo facturable de 4 personas en la casa, 2 en cada apartamento y 8 en la aldea** (la suma); plazas por confirmar. **Reales** (de su web y de los portales): cuna a 10 € por noche, menores de 2 años gratis en las camas existentes, entrada de 16:00 a 20:00, salida antes de las 12:00, sin mascotas, piscina solo en julio y agosto (si las fechas caen fuera, aviso amable).

## Mando de densidades (solo con `?revision`)

- **«Aldea»:** la llave, el viaje por el dibujo, las láminas que se deslizan, los titulares que se escriben, el plano vivo, las máscaras que giran, la hamburguesa que se monta y el círculo que se cierra.
- **«Sobria»:** todo quieto y completo (el dibujo ya atravesado, láminas quietas con su borde, plano coloreado, máscaras de frente, hamburguesa montada, logo entero). **Añade** la tabla «A Cortiña, de un vistazo».
- `?revision&densidad=sobria` abre ya en la sobria. La cortina se retira al instante en la sobria.

### Receta de borrado del mando

1. En `partes/cabeza.html`, en el script, el `try { … }` de `// MANDO DE MAQUETA`.
2. En `partes/pie.html`, el bloque `<!-- MANDO DE MAQUETA` … `<!-- fin del MANDO DE MAQUETA -->`.
3. En `js/main.js`, el bloque `MANDO DE MAQUETA` hasta `fin del MANDO DE MAQUETA`.
4. Opcional: `.mando` y `.vistazo` en `css/estilos.css` y la sección `#vistazo` de `index.src.html`.
5. `node construir.mjs`. (`node scripts/probar-borrado-mando.mjs` lo comprueba en memoria: pasa.)

## Comprobaciones

- **`verificar.mjs`:** archivos, noindex, ids, fotos (26, nunca ampliadas, sin la piscina rectangular ni fotos de banco), textos prohibidos (WhatsApp, aire, desayuno, número de módulos de las placas, registro, historia inventada, superlativos), las opiniones con su recuento, la cita literal, el contrato de módulos (sitios, orden, JS con `defer`, CSS), CSS de cookies/mando/menú/dvh/cortina, contraste WCAG y **APCA** en papel, piedra y almagre, la cabecera que cambia de tinta, el foco (2 px y rayado) en las tres superficies, el motor de punta a punta (cuatro llaves, ocupación por unidad, plazas, mínimo facturable, cuna, piscina, `COR-AAMMDD-NNN`, `Cortina.reservar` con unidad y mes), visor por nombre (cada miniatura y la API), pestañas con teclado, cookies en 4 pasos, mando y sobria, móvil a 360/375/390/768 (sin scroll lateral, menú con la cabecera fija, barra del navegador sin rehacer nada), legales y, al final y con movimiento: la cortina, el dibujo montado al abrirse, los titulares que se escriben, la lámina que se desliza de verdad (`--p` y `transform` muestreados), sin Lenis ni GSAP y sin JavaScript.
- **Resultado:** ver «Resultado de la última pasada» al final.

## Qué mirar en Chrome

- **La cortina y la portada** (Entrada): la llave que gira, la puerta que se abre, el viaje por el hueco del dibujo hasta la foto. Con `?revision&densidad=sobria`, todo quieto.
- **Las láminas de piedra** al bajar de «Por dentro» a «Fuera», de «Fuera» a «La barra» y de «Cuándo venir» a «Reservar»: que se deslicen sin saltos y destapen el almagre o la piedra; que la textura de laja no parezca «de juego» (si lo parece, se regenera con otra semilla en `scripts/piedra.py`).
- **El papel que sube con su canto de laja** al volver de la piedra (antes de «Cuándo venir» y del pie).
- **La cabecera** cambiando de tinta sobre piedra y almagre, con el logo en su etiqueta de papel.
- **Las fotos** corregidas de color: si el césped sigue demasiado verde o el cielo muy apagado, se ajusta en `scripts/fotos.mjs`.
- **El foco del teclado** (Tab): contorno de 2 px y rayado debajo en las tres superficies.
- **«Elige tu llave»:** las cuatro llaves, el calendario por unidad y los botones «Ver fechas de febrero/…» de «Cuándo venir».
- **El 3D de «Alrededor»** en su banco (`pruebas/3d-banco.html`): no se prueba pintándolo aquí.
- **El tamaño de la cabecera:** el logo real a ~84 px de ancho es pequeño (la plumilla fina casi no se lee); si molesta, se sube la altura de la cabecera.

## Para publicar

Repo propio y GitHub Pages sobre la rama real (como las anteriores). Antes, `PENDIENTES.md` y la receta de borrado del mando. Quitar el `noindex` solo si se vende.

## Resultado de la última pasada (2026-10-25, con los cinco módulos ya puestos)

- **`node construir.mjs && node verificar.mjs`: 177 ok, 0 fallos.**
- **`scripts/rendimiento.mjs`** (Pixel 7, 4G lento, CPU ×4, sin WebGL, tres pasadas): **LCP 1,85–1,90 s**, siempre el titular (`h1`); 30 peticiones y ~1,5 MB (sin las letras de Google). Ojo: bajo esa limitación la cortina tarda ~7,3 s en irse (la red de seguridad de `main.js` a los 7 s es la que la retira) y hay tareas largas de 80–320 ms mientras tanto: es cosa del módulo Entrada (`llave.js`), no de la web; la foto de la portada se pinta a ~4,2 s (va dentro del viaje del dibujo, no es el LCP).
- APCA: mínimo Lc 62 en todas las parejas de texto medidas (papel sobre almagre, Lc 78).
