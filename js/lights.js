// Światło elementów (Philips Hue i lampy): kolor, gradient, jasność, kierunek – bez zależności od Three.js.
// item.o: { on, color, color2, bright (1–100), dir: 'out'|'up'|'down'|'back' }

export const HUE_COLORS = [
  { name: 'Ciepła biel 2200 K', hex: '#ff9a3c' },
  { name: 'Ciepła biel 2700 K', hex: '#ffb066' },
  { name: 'Biel 3500 K', hex: '#ffc993' },
  { name: 'Neutralna 4000 K', hex: '#ffd6ad' },
  { name: 'Zimna 6500 K', hex: '#f3f5ff' },
  { name: 'Zachód słońca', hex: '#ff6a2b' },
  { name: 'Czerwony', hex: '#ff2d2d' },
  { name: 'Różowy', hex: '#ff4fa0' },
  { name: 'Fioletowy', hex: '#8a4dff' },
  { name: 'Niebieski', hex: '#3d6bff' },
  { name: 'Turkusowy', hex: '#22d3c5' },
  { name: 'Zielony', hex: '#3ddc6a' },
];

export const LIGHT_DIRS = { out: 'od ściany (do pokoju)', up: 'w górę (po ścianie)', down: 'w dół', back: 'na ścianę (za meblem)' };

const HEX = /^#[0-9a-f]{6}$/i;

// Parametry światła elementu albo null, gdy element nie świeci (lub ma wyłączone podświetlenie TV)
export function lightOf(item, def) {
  const spec = def.light || (def.lightOption && item.o && item.o.hue ? def.lightOption : null);
  if (!spec) return null;
  const o = item.o || {};
  const d = def.lightDefaults || {};
  const color = HEX.test(o.color || '') ? o.color : d.color || '#ffb066';
  const color2 = spec.gradient ? (HEX.test(o.color2 || '') ? o.color2 : d.color2 || color) : color;
  const bright = Math.max(1, Math.min(100, Number(o.bright ?? d.bright ?? 100)));
  const dir = LIGHT_DIRS[o.dir] ? o.dir : spec.dir || 'out';
  let lm = spec.lm || 800;
  if (spec.lmPerM) lm = (spec.lmPerM * (spec.vertical ? (item.h || def.h || 200) : item.w)) / 100;
  return { ...spec, on: o.on !== false, color, color2, bright, dir, lm: (lm * bright) / 100 };
}

export const isLight = (def) => !!(def.light || def.lightOption);
