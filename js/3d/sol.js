// El sol y la luna en Pepín (fórmulas de SunCalc) y la hora de Madrid. Sin Three.js.
//
// «Ahora» se puede fijar para probar: ?hora=2026-10-25T19:00 (el mismo parámetro que el resto de la web) o ?ahora3d=…,
// en hora de Madrid. Si la web pasa opciones.hora (Date) al montar, manda esa.

const rad = Math.PI / 180, OBL = rad * 23.4397;
export const LAT = 42.00832, LON = -7.41637;   // Aldea Rural A Cortiña, Pepín (ortofoto del IGN; DATOS)

const diasDe = d => d.valueOf() / 864e5 - .5 + 2440588 - 2451545;
function aCielo(dias, ra, dec) {   // ascensión recta y declinación → acimut (desde el norte) y altura, en grados
  const H = rad * (280.16 + 360.9856235 * dias) - rad * -LON - ra, phi = rad * LAT;
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  return { az: (az / rad + 180 + 360) % 360, alt: alt / rad };
}
function solEq(dias) {
  const M = rad * (357.5291 + .98560028 * dias);
  const Lc = M + rad * (1.9148 * Math.sin(M) + .02 * Math.sin(2 * M) + .0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
  return { dec: Math.asin(Math.sin(OBL) * Math.sin(Lc)), ra: Math.atan2(Math.sin(Lc) * Math.cos(OBL), Math.cos(Lc)) };
}
function lunaEq(dias) {
  const Lm = rad * (218.316 + 13.176396 * dias), M = rad * (134.963 + 13.064993 * dias), F = rad * (93.272 + 13.22935 * dias);
  const l = Lm + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
  return { ra: Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l)),
    dec: Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l)), dist: 385001 - 20905 * Math.cos(M) };
}
/** { az, alt } del sol en grados */
export const sol = d => { const dd = diasDe(d), e = solEq(dd); return aCielo(dd, e.ra, e.dec); };
/** { az, alt, luz (0–1 iluminada), crece } de la luna */
export function luna(d) {
  const dd = diasDe(d), s = solEq(dd), m = lunaEq(dd), p = aCielo(dd, m.ra, m.dec);
  const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(149598000 * Math.sin(phi), m.dist - 149598000 * Math.cos(phi));
  const ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  return { ...p, luz: (1 + Math.cos(inc)) / 2, crece: ang < 0 };
}

const TZ = 'Europe/Madrid';
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const partes = d => Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
// minutos que Madrid va por delante de UTC en ese instante (60 o 120)
const desfase = d => { const t = Math.floor(d.getTime() / 6e4) * 6e4, p = partes(new Date(t)); return Math.round((Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) - t) / 6e4); };

let corrimiento = 0;
try {
  const q = new URLSearchParams(location.search), v = q.get('hora') || q.get('ahora3d');
  const m = v && /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(v);
  if (m) { const b = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]); corrimiento = b - desfase(new Date(b)) * 6e4 - Date.now(); }
} catch (e) { /* sin URL: hora real */ }
/** La web puede fijar «ahora» con opciones.hora (Date) */
export function fijarAhora(fecha) { if (fecha instanceof Date && !isNaN(fecha)) corrimiento = fecha.getTime() - Date.now(); }
export const ahora = () => new Date(Date.now() + corrimiento);
export const minutoDe = d => { const p = partes(d); return +p.hour * 60 + +p.minute; };
export const hhmm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

/** Salida y puesta del sol del día de «d» (minutos de Madrid) */
export function dia(d = ahora()) {
  const p = partes(d), en = m => { const b = Date.UTC(+p.year, p.month - 1, +p.day, 0, m); return new Date(b - desfase(new Date(b)) * 6e4); };
  let sale = null, pone = null, ant = sol(en(0)).alt;
  for (let m = 2; m < 1440; m += 2) { const a = sol(en(m)).alt; if (ant < -.833 && a >= -.833) sale = m; if (ant >= -.833 && a < -.833) pone = m; ant = a; }
  return { sale, pone };
}

export const RUMBO = az => ['norte', 'nordeste', 'este', 'sudeste', 'sur', 'suroeste', 'oeste', 'noroeste'][Math.round(az / 45) % 8];
export const FASE = l => (l.luz < .04 ? 'luna nueva' : l.luz > .96 ? 'luna llena' : (l.crece ? 'luna creciente' : 'luna menguante'));

/** Texto del chip: «Ahora en Pepín · 18:42 · sol a 12° por el oeste» */
export function textoChip() {
  const f = ahora(), m = minutoDe(f), s = sol(f);
  let cielo;
  if (s.alt > 0) cielo = `sol a ${Math.round(s.alt)}° por el ${RUMBO(s.az)}`;
  else if (s.alt > -6) cielo = 'crepúsculo';
  else { const l = luna(f); cielo = l.alt > 0 ? `${FASE(l)} por el ${RUMBO(l.az)}` : 'noche sin luna'; }
  return `Ahora en Pepín · ${hhmm(m)} · ${cielo}`;
}
