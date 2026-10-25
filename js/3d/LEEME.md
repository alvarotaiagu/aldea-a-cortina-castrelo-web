# «A un cuarto de hora de la aldea» · el 3D de Aldea Rural A Cortiña

Una sola sección: `#alrededor` (módulo `ruta`), nunca de portada. Con el scroll, **anillos de tinta a pulso** (0,5 · 2 · 4 · 6 · 8 km en línea recta) se dibujan sobre el relieve del IGN alrededor de la aldea de Pepín y la cámara visita en orden **Castrelo do Val (5 min), Verín (14), el castillo de Monterrei (21) y Laza (25)**, siempre **mirando atrás, hacia la aldea**: el sitio cerca y con su cartela a plumilla, la aldea al fondo y, entre los dos, el camino de hoy por carretera (OSRM) dibujándose en almagre. Se ve que Laza está a 6,9 km en línea recta y a 25 minutos en coche. Al final, todo el valle con Invernadeiro y Chaves como **dirección** (flecha en el borde del mapa); después, el explorador libre. El cielo es el de ahora en Pepín (sol y luna reales, estrellas de noche). Relieve MDT05 y ortofoto PNOA del IGN (CC BY 4.0), altura ×1,6.

Honestidad del texto: los anillos son **distancias en línea recta**, no tiempos; los **minutos** son en coche, calculados con OpenStreetMap (OSRM), y así lo dice la tabla («Los anillos miden kilómetros en línea recta. Los minutos son en coche, calculados con OpenStreetMap.»). Invernadeiro **no** está al noroeste: desde Pepín queda al **nordeste** (rumbo 36°, hacia Vilariño de Conso), y así se rotula.

No repite el recorrido del grano de Tulla (hilo que sigue una carretera con la cámara detrás) ni el vuelo por el río de Pontillón (tiempo propio): aquí todo lo mueve el scroll, la cámara da una vuelta de compás alrededor de la aldea y todo lo que se dibuja es tinta y papel. Motor, cielo, calidad automática y explorador vienen de `../a-casa-da-tulla-gomesende-web/js/3d/` (que viene de Pontillón); lo demás es nuevo.

## Ficheros

| Fichero | Qué hace |
|---|---|
| `arranque.js` | Lo único que carga la web. Pone `window.Cortina.ruta.montar(el, opciones)` y lanza `cortina:listo`. Al montar: la pista fijada, la tabla de minutos, los botones, el progreso del scroll y la elección 3D / plano. Lleva `VERSION`. |
| `guion.js` | Sin Three.js. `PARADAS` (ritmo del scroll: se retoca ahí), `fase(p)`, los anillos a pulso, la tabla de minutos, el itinerario en texto y los rótulos (seis sitios de prueba cada uno, sin choques, dentro del marco). |
| `poses.js` | Solo Three.js, sin renderer: a dónde mira la cámara en cada parada (la distancia más corta a la que caben el sitio, la aldea y la cartela), y cómo se mezclan. Lo usa también `pruebas/3d-encuadre.mjs` en Node. |
| `plano.js` | Sin WebGL. El plano de tinta (`plano-base`) con los anillos y los caminos en SVG que avanzan con el scroll y una «cámara» (el `viewBox`) que visita lo mismo que el 3D. Es el plan B y el botón «En plano». |
| `sol.js` | Sol y luna (SunCalc) en Pepín, hora de Madrid, el chip «Ahora en Pepín · …». Acepta `?hora=` o `?ahora3d=` (`2026-10-25T19:00`) y `opciones.hora`. |
| `escena.js` | El motor: un renderer, relieve con cantos, la aldea y el castillo de Monterrei de cerca (parches a 0,35 m/px), cúpula de cielo, estrellas, sombras, una aguja por sitio, calidad automática, proyección a pantalla. |
| `anillos.js` | Las cintas de tinta (shader propio: papel con filo de tinta, borde de pluma irregular, ancho variable, punta que dibuja), los caminos en almagre, la bruma según la distancia, las poses, los rótulos y el explorador (OrbitControls). |
| `vendor/` | Three.js r160 y `OrbitControls.js` (copiados de Tulla). |
| `../../css/3d.css` | Todo lo que mete el módulo, bajo `[data-modulo="ruta"]`. |
| `../../scripts/terreno.py` | Descarga (una vez) y prepara `img/terreno/`. |
| `../../pruebas/3d-*` | Banco, prueba sin pintar WebGL y comprobación de encuadres en Node. |

## Contrato con la web

**Marcado** (lo escribe la web en `index.src.html`):

```html
<section id="alrededor" class="… sup-…" aria-labelledby="t-alrededor">
  <div class="env">…eyebrow, <h2 id="t-alrededor">, texto…</div>
  <div class="ruta__modulo" data-modulo="ruta">
    <div class="modulo__respaldo ruta__respaldo">
      <picture>
        <source type="image/webp" srcset="img/terreno/plano.webp">
        <img class="ruta__plano" src="img/terreno/plano.jpg" width="1800" height="1975" loading="lazy" decoding="async" alt="…">
      </picture>
      <ul class="ruta__lista">…las distancias…</ul>
      <p class="ruta__fuente">Relieve y ortofoto: Instituto Geográfico Nacional (CC BY 4.0). Minutos en coche: OpenStreetMap.</p>
    </div>
  </div>
</section>
```

- `css/3d.css` en el `<head>`; `<script type="module" src="js/3d/arranque.js">` diferido, con la huella de `versionar.mjs`.
- Al montar, el módulo mete **delante** del respaldo `.ruta-pista` (alto = la pantalla + 400 svh) y esconde la imagen del plano (`.ruta__plano` o cualquier `<img>` cuyo `src` contenga `terreno/plano`, junto con su `<picture>`); la lista y la fuente se quedan debajo. `montar` es idempotente y `destruir()` deja el respaldo como estaba (para el mando de densidades). Llama a `ScrollTrigger.refresh()` si existe.
- **Sticky:** `.ruta-fijo` es `position: sticky; top: var(--cab)`. Ningún antepasado (`.ruta`, `.ruta__modulo`, `main`…) puede llevar `overflow: hidden/auto` ni `transform`; `overflow: clip` sí vale. El marco ocupa todo el ancho (sin el padding de `.env`).
- Opciones: `{ movimiento, densidad: 'aldea'|'sobria', hora?: Date, gl?: false }`. Con `movimiento:false` o «sobria», la pista no se fija: el marco se queda quieto con todo dibujado y el explorador.
- **Cuándo montar:** `main.js` lo hace al acercarse (900 px). Si `window.Cortina.ruta` aún no existe, escuchar `cortina:listo` (document) o reintentar; `arranque.js` es un módulo diferido.
- **La cortina:** el 3D espera a que se retire (6 s de red de seguridad) antes de crear el motor. Vale cualquiera de: `window.Cortina.cortinaFuera = true`, que `#cortina` no exista / esté `hidden` / `aria-hidden="true"` / `display:none`, o el evento `cortina:fuera` en `document`.
- Lee de la web (con respaldo si faltan): `--cab`, `--lado`, `--papel`, `--papel-2`, `--tinta`, `--tinta-2`, `--almagre`, `--almagre-hondo`, `--almagre-texto`, `--liquen`, `--f-tit`, `--f-txt`, `--f-mono`.
- Ids propios: `ruta-marco`, `ruta-lienzo`, `ruta-rotulos`, `ruta-plano`, `ruta-chip`, `ruta-carga`, `ruta-3d`, `ruta-2d`, `ruta-mover`, `ruta-volver`, `ruta-cuaderno`, `ruta-itinerario`, `ruta-poster`.
- Clases que pone en `#ruta-marco`: `con-3d` (primer fotograma), `sin-3d`, `en-plano`, `libre` (explorador), `mapa-suelto` (táctil), `rotulos-compactos`. Eventos en `document`: `cortina:listo` (al cargar `arranque.js`) y `cortina:ruta-lista` (primer fotograma del 3D).
- Para las pruebas: `window.CORTINA_3D` = `{ estado: 'montando'|'cargando'|'listo'|'plano'|'sin-3d'|'respaldo', motivo, vista: '3d'|'plano', progreso, quieto, motor, anillos, plano }`.
- Para reservar no hace falta nada: el módulo no llama a `Cortina.reservar` (no tiene botones de reserva).

## Cómo se comporta

- **Con movimiento y densidad «aldea»:** la pista se fija y el scroll es el recorrido (0–5 % la aldea de cerca con su anillo de 0,5 km; luego Castrelo, Verín, Monterrei y Laza, cada una con su parada quieta; 87–97 % el viaje a la vista de todo). La tabla (abajo a la izquierda; abajo a lo ancho en el móvil) da los minutos del sitio, los km por carretera y en línea recta, y marca la fila activa. Mientras carga, el «póster» es el propio plano de tinta (no se pinta WebGL para hacerlo).
- **Movimiento reducido o «sobria»:** no se fija; el marco se queda quieto con todo dibujado, la vista de todo y el explorador.
- **Explorador:** arrastrar con el ratón suelta el mapa (gira; botón derecho mueve); Ctrl + rueda o el pellizco del trackpad acercan (la rueda sola sigue siendo el scroll de la página); en táctil, «Mover el mapa» (y dos dedos acercan); teclado en el lienzo: flechas, + y −, Escape. «Volver al recorrido» lo devuelve al scroll.
- **Plano:** sin WebGL2, con ahorro de datos, con `?sin-3d` (u `opciones.gl === false`) o con el botón «En plano». Mismo guion, mismos rótulos, en 2D.
- **Foco del teclado:** contorno de 2 px de tinta sobre un halo de papel y un rayado corto de plumilla debajo, en botones y en el lienzo.

## Cómo se regenera

```
python -I scripts/terreno.py     # descarga a pruebas/3d-fuente/ (si falta) y genera img/terreno/
node pruebas/3d-encuadre.mjs     # en Node, sin navegador: caben el sitio y la aldea en cada pantalla
node pruebas/3d-probar.mjs       # la prueba sin pintar WebGL (puerto 8915)
```
Después, **subir `VERSION` en `arranque.js`**. `pruebas/3d-fuente/` (MDT de 38 MB, ortofotos, rutas y la rejilla de OSRM) no se publica: va al `.gitignore` (y `pruebas/` entera, como en Tulla).

Para retocar: `PARADAS` y `ANILLO_P` en `guion.js` (cuándo para la cámara y cuándo se dibuja cada anillo); `MIRA` (a qué fracción de la línea sitio → aldea mira) y la inclinación en `parada()`; los límites de encuadre en `poses.js` (`lim`); la tabla y las cartelas en `guion.js` + `css/3d.css`.

## Rendimiento

- Nada pesado antes de `load` + un rato libre + la cortina. `arranque.js` pesa 12 KB; `guion.js`, `sol.js` y `terreno.json` (23 KB), al montar; Three.js (166 KB gzip) y los datos, solo con WebGL2.
- Móvil (`pointer: coarse` o pantalla < 700 px): malla 384×421, ortofoto 1536 (385 KB WebP), parches 1024 (191 + 214 KB), sombras 1024, densidad ≤ 1,5, sin antialias. Escritorio: 576×632, 3072 (1,4 MB), 1536 (402 + 457 KB), sombras 2048, densidad ≤ 1,75.
- Pinta solo si se ve y algo se mueve; fuera de pantalla, con la pestaña oculta o en plano, nada. La luz se rehace cada minuto.
- Calidad automática (media de 45 fotogramas > 30 ms): densidad −0,25 hasta 1 → sin sombras → densidad 0,75.
- La barra del móvil no rehace el búfer (cambio de alto < 160 px) ni el cálculo del progreso.

## No probado

El 3D **no se ha pintado nunca** (regla de `WEBS NEGOCIOS/CLAUDE.md): se ha comprobado sin WebGL todo lo demás, incluido `anillos.js` entero con un motor de mentira y los encuadres con el relieve real en Node. Lo mira Álvaro en su Chrome y en un móvil real: que las cintas se vean sobre el monte (anchura, contraste del papel con filo de tinta sobre bosque oscuro), que la cámara «mirando atrás» se entienda, el barrido de Monterrei a Laza, la bruma, la noche y la fluidez.
