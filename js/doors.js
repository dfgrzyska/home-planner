// Konfiguracja drzwi: typ, strona zawiasów, kierunek otwierania, wykończenie skrzydła.
// doc.doors = { d2: { type, flipHinge, flipSwing, finish, closed }, … } – tylko drzwi zmienione przez użytkownika.

import { PLAN } from './plan.js';

export const DOOR_TYPES = {
  swing: 'Skrzydłowe',
  hidden: 'Ukryte – zlicowane ze ścianą',
  sliding: 'Przesuwne naścienne',
  none: 'Brak skrzydła (sam otwór)',
};

export const DOOR_FINISHES = {
  white: { name: 'Białe', hex: '#f4f3ef' },
  oak: { name: 'Dąb', hex: '#b98b5f' },
  walnut: { name: 'Orzech', hex: '#6f4b34' },
  graphite: { name: 'Grafit', hex: '#45484d' },
  black: { name: 'Czarne', hex: '#232427' },
  entrance: { name: 'Antywłamaniowe brązowe', hex: '#5b534b' },
};

export const DOOR_NAMES = { d1: 'Drzwi wejściowe', d2: 'Łazienka', d3: 'Pokój 2', d4: 'Pokój 3' };

// `closed` nie ma stałej wartości domyślnej – zależy od typu (patrz isClosed)
const defaults = (d) => ({ type: 'swing', flipHinge: false, flipSwing: false, finish: d.entry ? 'entrance' : 'white' });

export function doorOptions(doors, id) {
  const d = PLAN.doors.find((x) => x.id === id);
  return { ...defaults(d), ...((doors && doors[id]) || {}) };
}

// Zachowuje tylko poprawne pola różne od domyślnych (krótszy link)
export function normalizeDoors(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const d of PLAN.doors) {
    const r = raw[d.id];
    if (!r || typeof r !== 'object') continue;
    const def = defaults(d), o = {};
    if (DOOR_TYPES[r.type] && r.type !== def.type) o.type = r.type;
    if (r.flipHinge === true) o.flipHinge = true;
    if (r.flipSwing === true) o.flipSwing = true;
    if (DOOR_FINISHES[r.finish] && r.finish !== def.finish) o.finish = r.finish;
    if (typeof r.closed === 'boolean' && r.closed !== (r.type === 'hidden')) o.closed = r.closed;
    if (d.host && Number.isFinite(Number(r.shift)) && Math.round(Number(r.shift)) !== 0) o.shift = clampShift(d, Math.round(Number(r.shift)));
    if (Object.keys(o).length) out[d.id] = o;
  }
  return out;
}

// Czy skrzydło ma być pokazane jako zamknięte (ukryte domyślnie zamknięte)
export const isClosed = (opt) => (opt.closed ?? (opt.type === 'hidden'));

const rad = (a) => (a * Math.PI) / 180;
export const dirOf = (a) => [Math.cos(rad(a)), Math.sin(rad(a))];

// Przesunięcie otworu wzdłuż ściany: oś x dla ściany poziomej, y dla pionowej; otwór zostaje w obrębie ściany
const hostAxisX = (d) => d.host[2] > d.host[3];
export function shiftRange(d) {
  if (!d.host) return [0, 0];
  const [hx, hy, hw, hh] = d.host, [gx, gy, gw, gh] = d.gap;
  return hostAxisX(d) ? [hx - gx, hx + hw - (gx + gw)] : [hy - gy, hy + hh - (gy + gh)];
}
export function clampShift(d, s) {
  const [a, b] = shiftRange(d);
  return Math.max(a, Math.min(b, s));
}
// Odległość otworu od początku i końca ściany (cm) po przesunięciu
export function doorDistances(d, shift = 0) {
  if (!d.host) return null;
  const [hx, hy, hw, hh] = d.host, [gx, gy, gw, gh] = d.gap;
  const s = clampShift(d, shift);
  return hostAxisX(d) ? [gx + s - hx, hx + hw - (gx + gw + s)] : [gy + s - hy, hy + hh - (gy + gh + s)];
}

// Geometria drzwi po zastosowaniu przesunięcia i odwróceń: zawias, promień, kąt skrzydła otwartego i zamkniętego, grubość ściany
export function doorGeometry(d, opt) {
  let [hx, hy] = d.hinge;
  let closed = d.closed, open = d.open;
  let [gx, gy, gw, gh] = d.gap;
  const s = d.host ? clampShift(d, opt.shift || 0) : 0;
  if (s) {
    if (hostAxisX(d)) { gx += s; hx += s; } else { gy += s; hy += s; }
  }
  const along = gw > gh ? gw : gh; // długość otworu
  const thick = gw > gh ? gh : gw;
  if (opt.flipHinge) {
    const [cx, cy] = dirOf(closed);
    hx += cx * d.r; hy += cy * d.r;
    closed = (closed + 180) % 360;
  }
  if (opt.flipSwing) {
    const [ox, oy] = dirOf(open);
    hx -= ox * thick; hy -= oy * thick;
    open = (open + 180) % 360;
  }
  return { hinge: [hx, hy], r: d.r, open, closed, thick, along, gap: [gx, gy, gw, gh] };
}

// Ściany działowe i ściany łazienki z otworami drzwiowymi w aktualnych miejscach
export function wallLayout(doc) {
  const gapOf = (d) => doorGeometry(d, doorOptions(doc.doors, d.id)).gap;
  const split = (host, gap) => {
    const [hx, hy, hw, hh] = host, [gx, gy, gw, gh] = gap;
    const parts = hw > hh
      ? [[hx, hy, gx - hx, hh], [gx + gw, hy, hx + hw - (gx + gw), hh]]
      : [[hx, hy, hw, gy - hy], [hx, gy + gh, hw, hy + hh - (gy + gh)]];
    return parts.filter((r) => r[2] > 0.5 && r[3] > 0.5);
  };
  const inside = ([x, y, w, h], [hx, hy, hw, hh]) => x >= hx - 0.01 && y >= hy - 0.01 && x + w <= hx + hw + 0.01 && y + h <= hy + hh + 0.01;
  let bathWalls = PLAN.bathWalls;
  const partitions = {};
  for (const d of PLAN.doors) {
    if (d.hostOf === 'bath') bathWalls = [...bathWalls.filter((r) => !inside(r, d.host)), ...split(d.host, gapOf(d))];
  }
  for (const p of PLAN.partitions) {
    if (doc.demo.includes(p.id)) { partitions[p.id] = []; continue; }
    const d = p.door && PLAN.doors.find((x) => x.id === p.door);
    partitions[p.id] = d && d.host ? split(d.host, gapOf(d)) : p.rects;
  }
  return { bathWalls, partitions, gaps: Object.fromEntries(PLAN.doors.map((d) => [d.id, gapOf(d)])) };
}
