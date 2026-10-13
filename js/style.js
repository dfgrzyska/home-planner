// Wykończenie wnętrza: kolory ścian, posadzki, fronty kuchenne, blaty.
// doc.style = { walls: { '1': '#hex', … }, floors: { '1': 'oak_light', … }, kitchenFront, counter, balcony, frames }

export const WALL_PALETTE = [
  { name: 'Biel złamana', hex: '#f2efe8' },
  { name: 'Ciepła biel', hex: '#f4ede0' },
  { name: 'Jasna szarość', hex: '#dcdcd8' },
  { name: 'Greige', hex: '#cbc2b4' },
  { name: 'Beż piaskowy', hex: '#d9c8ae' },
  { name: 'Kaszmir', hex: '#c9b8a6' },
  { name: 'Pudrowy róż', hex: '#e3c6be' },
  { name: 'Terakota', hex: '#bf7457' },
  { name: 'Musztardowy', hex: '#d0a240' },
  { name: 'Szałwia', hex: '#a6b29c' },
  { name: 'Oliwkowy', hex: '#7c7f5b' },
  { name: 'Butelkowa zieleń', hex: '#2f4f40' },
  { name: 'Szaroniebieski', hex: '#9fb1bf' },
  { name: 'Granat', hex: '#24324b' },
  { name: 'Mokka', hex: '#7b5f4f' },
  { name: 'Grafit', hex: '#4a4d52' },
];

export const FLOORS = {
  oak_light: { name: 'Dąb jasny – deska', kind: 'planks', base: '#d9bb91', var: 0.07 },
  oak_natural: { name: 'Dąb naturalny – deska', kind: 'planks', base: '#bb8b5b', var: 0.08 },
  walnut: { name: 'Orzech – deska', kind: 'planks', base: '#6f4b34', var: 0.08 },
  oak_herringbone: { name: 'Dąb – jodełka', kind: 'herringbone', base: '#c9a273', var: 0.08 },
  oak_grey: { name: 'Dąb szarobielony', kind: 'planks', base: '#bdb3a5', var: 0.05 },
  tile_light: { name: 'Płytki jasne 60×60', kind: 'tiles', base: '#e7e4dd', size: 60, var: 0.02 },
  tile_grey: { name: 'Płytki szare 60×60', kind: 'tiles', base: '#9d9a95', size: 60, var: 0.02 },
  tile_large: { name: 'Gres 120×60 beżowy', kind: 'tiles', base: '#d6cbbb', size: 120, size2: 60, var: 0.02 },
  concrete: { name: 'Beton / mikrocement', kind: 'concrete', base: '#b4b1ab', var: 0.06 },
  terrazzo: { name: 'Lastryko', kind: 'terrazzo', base: '#e4e0d8', var: 0.03 },
  deck: { name: 'Deska tarasowa', kind: 'planks', base: '#8c6a4c', var: 0.1, plank: 14 },
  balcony_tile: { name: 'Płyty tarasowe szare', kind: 'tiles', base: '#a9a69f', size: 60, var: 0.03 },
};

export const FRONTS = [
  { name: 'Biały mat', hex: '#f1f0ec' },
  { name: 'Kaszmir', hex: '#cbbfae' },
  { name: 'Szałwia', hex: '#9fae98' },
  { name: 'Butelkowa zieleń', hex: '#33503f' },
  { name: 'Granat', hex: '#2a3650' },
  { name: 'Grafit', hex: '#45484d' },
  { name: 'Czarny mat', hex: '#232427' },
  { name: 'Dąb', hex: '#b88b5d' },
];

export const COUNTERS = {
  oak: { name: 'Dąb', hex: '#b98a5a', wood: true },
  white_quartz: { name: 'Biały konglomerat', hex: '#eeece8' },
  black_stone: { name: 'Czarny kamień', hex: '#2b2b2d' },
  concrete: { name: 'Beton', hex: '#a9a7a2' },
  marble: { name: 'Marmur biały', hex: '#ecebea' },
};

export const FRAMES = {
  anthracite: { name: 'Antracyt', hex: '#3b3e42' },
  white: { name: 'Białe', hex: '#f3f3f1' },
  black: { name: 'Czarne', hex: '#1f1f21' },
};

export const DEFAULT_STYLE = {
  walls: { 1: '#f2efe8', 2: '#f2efe8', 3: '#f2efe8', 4: '#f2efe8', 5: '#f2efe8' },
  floors: { 1: 'oak_light', 2: 'oak_light', 3: 'oak_light', 4: 'tile_light', 5: 'oak_light' },
  kitchenFront: '#f1f0ec',
  counter: 'oak',
  balcony: 'balcony_tile',
  frames: 'anthracite',
};

const HEX = /^#[0-9a-f]{6}$/i;

// Uzupełnia brakujące pola i odrzuca błędne wartości (np. z linku)
export function normalizeStyle(s) {
  const d = DEFAULT_STYLE;
  s = s && typeof s === 'object' ? s : {};
  const out = { walls: {}, floors: {} };
  for (const k of Object.keys(d.walls)) {
    const v = s.walls && s.walls[k];
    out.walls[k] = HEX.test(v || '') ? v.toLowerCase() : d.walls[k];
    const f = s.floors && s.floors[k];
    out.floors[k] = FLOORS[f] ? f : d.floors[k];
  }
  out.kitchenFront = HEX.test(s.kitchenFront || '') ? s.kitchenFront.toLowerCase() : d.kitchenFront;
  out.counter = COUNTERS[s.counter] ? s.counter : d.counter;
  out.balcony = FLOORS[s.balcony] ? s.balcony : d.balcony;
  out.frames = FRAMES[s.frames] ? s.frames : d.frames;
  if (s.accent && typeof s.accent === 'object') {
    // ściana akcentowa: { room: '1', side: 'n'|'s'|'e'|'w', color: '#hex' }
    const a = s.accent;
    if (out.walls[a.room] && ['n', 's', 'e', 'w'].includes(a.side) && HEX.test(a.color || '')) out.accent = { room: String(a.room), side: a.side, color: a.color.toLowerCase() };
  }
  return out;
}

export function paletteName(hex) {
  const p = WALL_PALETTE.find((c) => c.hex === hex) || FRONTS.find((c) => c.hex === hex);
  return p ? p.name : hex;
}
