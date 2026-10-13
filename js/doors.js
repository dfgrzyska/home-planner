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
    if (Object.keys(o).length) out[d.id] = o;
  }
  return out;
}

// Czy skrzydło ma być pokazane jako zamknięte (ukryte domyślnie zamknięte)
export const isClosed = (opt) => (opt.closed ?? (opt.type === 'hidden'));

const rad = (a) => (a * Math.PI) / 180;
export const dirOf = (a) => [Math.cos(rad(a)), Math.sin(rad(a))];

// Geometria drzwi po zastosowaniu odwróceń: zawias, promień, kąt skrzydła otwartego i zamkniętego, grubość ściany
export function doorGeometry(d, opt) {
  let [hx, hy] = d.hinge;
  let closed = d.closed, open = d.open;
  const [gx, gy, gw, gh] = d.gap;
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
