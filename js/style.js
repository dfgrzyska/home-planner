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
  tile_anthracite: { name: 'Płytki antracyt 60×60', kind: 'tiles', base: '#4b4d51', size: 60, var: 0.02 },
  gres_dark: { name: 'Gres ciemnoszary 120×60', kind: 'tiles', base: '#5a5c60', size: 120, size2: 60, var: 0.02 },
  oak_dark_grey: { name: 'Dąb ciemnoszary – deska', kind: 'planks', base: '#5e5853', var: 0.06 },
  concrete_dark: { name: 'Mikrocement ciemnoszary', kind: 'concrete', base: '#6b6a67', var: 0.05 },
  concrete: { name: 'Beton / mikrocement', kind: 'concrete', base: '#b4b1ab', var: 0.06 },
  terrazzo: { name: 'Lastryko', kind: 'terrazzo', base: '#e4e0d8', var: 0.03 },
  deck: { name: 'Deska tarasowa', kind: 'planks', base: '#8c6a4c', var: 0.1, plank: 14 },
  balcony_tile: { name: 'Płyty tarasowe szare', kind: 'tiles', base: '#a9a69f', size: 60, var: 0.03 },
};

// Płytki ścienne (gres, cegiełka, zellige…): wymiary płytki w cm, kind = sposób rysowania tekstury
export const WALL_TILES = {
  marble_white: { name: 'Gres marmur biały 60×120', kind: 'slab', base: '#eeece8', w: 60, h: 120, veins: '#b9b6b0', gloss: true },
  concrete_grey: { name: 'Gres beton szary 60×120', kind: 'slab', base: '#a9a7a2', w: 60, h: 120, noise: 0.07 },
  sand_beige: { name: 'Gres beż piaskowy 60×120', kind: 'slab', base: '#d6c8b3', w: 60, h: 120, noise: 0.05 },
  graphite: { name: 'Gres grafitowy mat 60×120', kind: 'slab', base: '#4a4c50', w: 60, h: 120, noise: 0.05 },
  subway_white: { name: 'Cegiełka biała 7,5×30 (połysk)', kind: 'subway', base: '#f3f2ee', w: 30, h: 7.5, gloss: true },
  zellige_green: { name: 'Zellige butelkowa zieleń 10×10', kind: 'zellige', base: '#2f5a46', w: 10, h: 10, gloss: true },
  terrazzo_wall: { name: 'Lastryko 60×60', kind: 'terrazzo', base: '#e4e0d8', w: 60, h: 60 },
};
export const TILE_HEIGHTS = [{ v: 120, l: 'do 120 cm' }, { v: 210, l: 'do 210 cm' }, { v: 272, l: 'do sufitu' }];

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
  oak_light: { name: 'Dąb jasny', hex: '#d9bb91', wood: true },
  walnut: { name: 'Orzech', hex: '#6f4b34', wood: true },
  white_quartz: { name: 'Biały konglomerat', hex: '#eeece8' },
  marble: { name: 'Marmur biały', hex: '#ecebea' },
  terrazzo: { name: 'Lastryko', hex: '#e4e0d8' },
  concrete: { name: 'Beton', hex: '#a9a7a2' },
  grey_stone: { name: 'Szary kamień', hex: '#8e8c88' },
  black_stone: { name: 'Czarny kamień', hex: '#2b2b2d' },
  black_matte: { name: 'Czarny mat', hex: '#1f2022' },
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
  tiles: {}, // { '4': { pattern: 'marble_white', height: 272 } }
  sides: {}, // pojedyncze ściany: { '1:n': { color: '#hex', tile: { pattern, height } | null } }
};

export const WALL_SIDES = [['n', 'północna', '↑'], ['s', 'południowa', '↓'], ['w', 'zachodnia', '←'], ['e', 'wschodnia', '→']];

// Wykończenie konkretnej ściany pomieszczenia (strona n/s/e/w): własne albo jak całe pomieszczenie
export function sideStyle(style, room, side) {
  const o = (style.sides && style.sides[`${room}:${side}`]) || {};
  return {
    color: o.color || style.walls[room],
    tile: 'tile' in o ? o.tile : (style.tiles && style.tiles[room]) || null,
    custom: !!(o.color || 'tile' in o),
  };
}

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
  if (HEX.test(s.counterColor || '')) out.counterColor = s.counterColor.toLowerCase();
  out.balcony = FLOORS[s.balcony] ? s.balcony : d.balcony;
  out.frames = FRAMES[s.frames] ? s.frames : d.frames;
  out.tiles = {};
  if (s.tiles && typeof s.tiles === 'object') {
    for (const [room, t] of Object.entries(s.tiles)) {
      if (out.walls[room] && t && WALL_TILES[t.pattern]) {
        const height = TILE_HEIGHTS.some((x) => x.v === t.height) ? t.height : 272;
        out.tiles[room] = { pattern: t.pattern, height };
      }
    }
  }
  out.sides = {};
  const okTile = (t) => t && WALL_TILES[t.pattern] ? { pattern: t.pattern, height: TILE_HEIGHTS.some((x) => x.v === t.height) ? t.height : 272 } : null;
  if (s.sides && typeof s.sides === 'object') {
    for (const [k, v] of Object.entries(s.sides)) {
      const [room, side] = k.split(':');
      if (!out.walls[room] || !['n', 's', 'e', 'w'].includes(side) || !v || typeof v !== 'object') continue;
      const o = {};
      if (HEX.test(v.color || '')) o.color = v.color.toLowerCase();
      if ('tile' in v) o.tile = okTile(v.tile);
      if (Object.keys(o).length) out.sides[k] = o;
    }
  }
  // starsze projekty: jedna ściana akcentowa → kolor pojedynczej ściany
  if (s.accent && typeof s.accent === 'object') {
    const a = s.accent;
    if (out.walls[a.room] && ['n', 's', 'e', 'w'].includes(a.side) && HEX.test(a.color || '')) {
      const k = `${a.room}:${a.side}`;
      out.sides[k] = { ...(out.sides[k] || {}), color: a.color.toLowerCase() };
    }
  }
  return out;
}

export function paletteName(hex) {
  const p = WALL_PALETTE.find((c) => c.hex === hex) || FRONTS.find((c) => c.hex === hex);
  return p ? p.name : hex;
}
