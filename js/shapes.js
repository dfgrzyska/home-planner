// Rysunki elementów w układzie lokalnym: środek w (0,0), szerokość w wzdłuż x, głębokość d wzdłuż y,
// tył elementu przy -d/2 (przy ścianie), front przy +d/2.

const f = (n) => Math.round(n * 10) / 10;
const rect = (x, y, w, h, cls = 'body', rx = 0) =>
  `<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(Math.max(w, 0))}" height="${f(Math.max(h, 0))}"${rx ? ` rx="${f(rx)}"` : ''}/>`;
const line = (x1, y1, x2, y2, cls = 'ln') => `<line class="${cls}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
const circle = (cx, cy, r, cls = 'ln') => `<circle class="${cls}" cx="${f(cx)}" cy="${f(cy)}" r="${f(Math.max(r, 0))}"/>`;
const ellipse = (cx, cy, rx, ry, cls = 'ln') => `<ellipse class="${cls}" cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}"/>`;
const path = (d, cls = 'ln') => `<path class="${cls}" d="${d}"/>`;

function chairShape(cx, cy, angle, w = 42, d = 42) {
  // krzesło zwrócone frontem do (cx,cy) + kierunek angle; oparcie po stronie przeciwnej do stołu
  return `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${f(angle)})">` +
    rect(-w / 2, -d / 2, w, d, 'body chair', 6) + line(-w / 2 + 3, d / 2 - 5, w / 2 - 3, d / 2 - 5, 'ln strong') + '</g>';
}

function tableChairs(w, d) {
  const out = [];
  const gap = 8, cd = 42;
  const n = Math.max(1, Math.floor((w + 5) / 60));
  const step = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + step * (i + 0.5);
    out.push(chairShape(x, -d / 2 - gap - cd / 2 + 10, 180));
    out.push(chairShape(x, d / 2 + gap + cd / 2 - 10, 0));
  }
  if (w >= 170 || (w >= 140 && d >= 90)) {
    out.push(chairShape(-w / 2 - gap - cd / 2 + 10, 0, 90));
    out.push(chairShape(w / 2 + gap + cd / 2 - 10, 0, 270));
  }
  return out.join('');
}

function roundChairs(dia) {
  const n = Math.max(2, Math.min(8, Math.floor((Math.PI * dia) / 62)));
  const r = dia / 2 + 12;
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i;
    const rad = (a * Math.PI) / 180;
    s += chairShape(Math.sin(rad) * r, -Math.cos(rad) * r, a + 180);
  }
  return s;
}

import { lightOf } from './lights.js';

// Rośliny w rzucie: liście promieniście wokół donicy, kształt zależny od gatunku
const PLANT2D = {
  monstera: { n: 9, len: 0.5, wid: 0.3, col: '#4f8a3f' },
  fikus: { n: 14, len: 0.32, wid: 0.18, col: '#4c7d3a' },
  strelicja: { n: 10, len: 0.48, wid: 0.12, col: '#4f7f4a' },
  oliwka: { n: 22, len: 0.22, wid: 0.06, col: '#8a9a6f' },
  kentia: { n: 9, len: 0.5, wid: 0.07, col: '#5b8f45' },
  sansewieria: { n: 9, len: 0.4, wid: 0.08, col: '#3f6b3a' },
  zamiokulkas: { n: 8, len: 0.42, wid: 0.12, col: '#3f7a3a' },
};
function drawPlant(sp, w, d, potColor) {
  const hw = w / 2, hd = d / 2;
  let s = '';
  if (sp === 'storczyk') return ellipse(0, 0, hw * 0.45, hd * 0.55, 'body pot') + ellipse(-hw * 0.3, 0, hw * 0.5, hd * 0.25, 'leaf2d') + circle(hw * 0.35, -hd * 0.2, 3, 'flower2d') + circle(hw * 0.55, 0, 3, 'flower2d') + circle(hw * 0.4, hd * 0.25, 3, 'flower2d');
  if (sp === 'bukiet') {
    s += circle(0, 0, hw * 0.35, 'body pot');
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; s += `<circle class="flower2d" cx="${f(Math.cos(a) * hw * 0.55)}" cy="${f(Math.sin(a) * hd * 0.55)}" r="${f(hw * 0.22)}"${potColor ? ` style="fill:${potColor}"` : ''}/>`; }
    return s + circle(0, 0, hw * 0.2, 'flower2d');
  }
  if (sp === 'ziola' || sp === 'lawenda') {
    s += rect(-hw, -hd, w, d, 'body pot', 2);
    const cls = sp === 'lawenda' ? 'lavender2d' : 'leaf2d';
    for (let x = -hw + 6; x < hw - 3; x += 8) s += circle(x, 0, Math.min(hd * 0.7, 5), cls);
    return s;
  }
  const P = PLANT2D[sp] || PLANT2D.monstera;
  for (let i = 0; i < P.n; i++) {
    const a = (i / P.n) * 360 + (i % 2) * 17;
    const L = Math.min(hw, hd) * (P.len + ((i * 37) % 10) / 60), W = Math.min(hw, hd) * P.wid * 1.6;
    s += `<ellipse class="leaf2d" cx="${f(L * 0.55)}" cy="0" rx="${f(L * 0.55)}" ry="${f(W)}" transform="rotate(${f(a)})" style="fill:${P.col}"/>`;
  }
  s += circle(0, 0, Math.min(hw, hd) * 0.32, 'body pot');
  return s;
}

// Poświata światła na rzucie (pod elementem)
function glow2d(item, def) {
  const L = lightOf(item, def);
  if (!L || !L.on) return '';
  const hw = item.w / 2, hd = item.d / 2;
  const r = 35 + Math.sqrt(L.lm) * 1.6;
  if (L.type === 'strip') return `<ellipse class="glow" cx="0" cy="${f(hd + 12)}" rx="${f(hw + 25)}" ry="${f(28 + Math.sqrt(L.lm / Math.max(1, item.w)) * 6)}" style="fill:${L.color}"/>`;
  if (L.type === 'tv') return `<ellipse class="glow" cx="0" cy="${f(-hd - 6)}" rx="${f(hw + 30)}" ry="30" style="fill:${L.color}"/>`;
  if (L.type === 'wall') return `<ellipse class="glow" cx="0" cy="${f(-hd - 10)}" rx="${f(r * 0.8)}" ry="${f(r * 0.45)}" style="fill:${L.color}"/>`;
  return `<circle class="glow" cx="0" cy="0" r="${f(r)}" style="fill:${L.color}"/>`;
}

// Wykończenie i rozstaw lameli elementu (z domyślnymi z katalogu)
export function slatSpec(item, def) {
  const o = item.o || {};
  const fin = def.finishes.find((f) => f.id === o.finish) || def.finishes.find((f) => f.id === def.opts.finish);
  const pat = def.patterns.find((p) => p.id === o.pattern) || def.patterns.find((p) => p.id === def.opts.pattern);
  return { fin, pat, slat: item.c || fin.slat };
}

// Miniatura lameli w katalogu – widok z przodu (z góry to tylko cienka kreska)
export function slatThumb(def) {
  const { fin, pat, slat } = slatSpec({ o: def.opts }, def);
  const half = def.key === 'lamele_half';
  const W = 60, H = 40, top = half ? 22 : 2;
  let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#f2efe8" stroke="#c9c7c0" stroke-width=".6"/>`;
  if (fin.back && def.kind === 'slats') s += `<rect x="4" y="${top}" width="${W - 8}" height="${H - top - 2}" fill="${fin.back}"/>`;
  const k = 1.4, pitch = (pat.slat + pat.gap) * k;
  for (let x = 4; x + pat.slat * k <= W - 4 + 0.01; x += pitch) s += `<rect x="${f(x)}" y="${top}" width="${f(pat.slat * k)}" height="${H - top - 2}" fill="${slat}"/>`;
  return s;
}

export function drawShape(item, def) {
  const { w, d } = item;
  const hw = w / 2, hd = d / 2;
  const kind = def.kind;
  const opts = item.o || {};
  let s = '';
  const glow = glow2d(item, def);
  switch (kind) {
    case 'bed': {
      s += rect(-hw, -hd, w, d, 'body', 3);
      s += rect(-hw + 5, -hd + 5, w - 10, d - 10, 'ln', 3);
      const pw = w >= 120 ? (w - 22) / 2 : w - 16;
      s += rect(-hw + 8, -hd + 10, pw, 32, 'body2', 6);
      if (w >= 120) s += rect(hw - 8 - pw, -hd + 10, pw, 32, 'body2', 6);
      s += path(`M${f(-hw + 5)} ${f(-hd + 55)} L${f(hw - 5)} ${f(-hd + 55)} M${f(-hw + 5)} ${f(-hd + 55)} L${f(-hw + 30)} ${f(-hd + 75)} L${f(hw - 5)} ${f(-hd + 75)}`);
      break;
    }
    case 'crib': {
      s += rect(-hw, -hd, w, d, 'body', 2);
      s += rect(-hw + 4, -hd + 4, w - 8, d - 8, 'ln');
      for (let x = -hw + 10; x < hw - 4; x += 8) s += line(x, -hd, x, -hd + 4, 'ln') + line(x, hd - 4, x, hd, 'ln');
      break;
    }
    case 'sofa': {
      const back = Math.min(22, d * 0.25), arm = Math.min(18, w * 0.1);
      s += rect(-hw, -hd, w, d, 'body', 6);
      s += rect(-hw, -hd, w, back, 'body2', 5);
      s += rect(-hw, -hd, arm, d, 'body2', 5) + rect(hw - arm, -hd, arm, d, 'body2', 5);
      const n = Math.max(1, Math.round((w - 2 * arm) / 65));
      const cw = (w - 2 * arm) / n;
      for (let i = 1; i < n; i++) s += line(-hw + arm + cw * i, -hd + back, -hw + arm + cw * i, hd - 4);
      break;
    }
    case 'sofa_l': {
      const sd = Math.min(95, d * 0.6), cw = Math.min(95, w * 0.4), back = 20, arm = 16;
      const m = opts.mirror ? -1 : 1;
      const X = (x) => f(x * m);
      s += path(`M${X(-hw)} ${f(-hd)} L${X(hw)} ${f(-hd)} L${X(hw)} ${f(hd)} L${X(hw - cw)} ${f(hd)} L${X(hw - cw)} ${f(-hd + sd)} L${X(-hw)} ${f(-hd + sd)} Z`, 'body');
      s += path(`M${X(-hw)} ${f(-hd)} L${X(hw)} ${f(-hd)} L${X(hw)} ${f(hd)} L${X(hw - back)} ${f(hd)} L${X(hw - back)} ${f(-hd + back)} L${X(-hw)} ${f(-hd + back)} Z`, 'body2');
      s += `<rect class="body2" x="${f(m > 0 ? -hw : hw - arm)}" y="${f(-hd)}" width="${arm}" height="${f(sd)}" rx="4"/>`;
      s += line((hw - cw) * m, -hd + back, (hw - cw) * m, -hd + sd);
      s += line((hw - cw) * m, -hd + sd, (hw - back) * m, -hd + sd);
      const seatW = w - cw - arm;
      const n = Math.max(1, Math.round(seatW / 65));
      for (let i = 1; i < n; i++) { const x = (-hw + arm + (seatW / n) * i) * m; s += line(x, -hd + back, x, -hd + sd); }
      break;
    }
    case 'armchair': {
      s += rect(-hw, -hd, w, d, 'body', 8);
      s += rect(-hw, -hd, w, 18, 'body2', 6);
      s += rect(-hw, -hd, 15, d, 'body2', 6) + rect(hw - 15, -hd, 15, d, 'body2', 6);
      break;
    }
    case 'table': {
      if (opts.chairs) s += tableChairs(w, d);
      s += rect(-hw, -hd, w, d, 'body', 2);
      const base = def.range && def.range.base;
      if (base && w > base) {
        // wkładki rozkładane w środku blatu
        const ext = w - base;
        s += rect(-ext / 2, -hd, ext, d, 'leaf');
        s += line(-ext / 2, -hd, -ext / 2, hd, 'ln dash') + line(ext / 2, -hd, ext / 2, hd, 'ln dash');
      } else if (base) {
        s += line(0, -hd, 0, hd, 'ln dash');
      }
      break;
    }
    case 'round': {
      if (opts.chairs) s += roundChairs(w);
      s += ellipse(0, 0, hw, hd, 'body');
      if (def.cat === 'przedpokoj') s += circle(0, 0, 4, 'ln strong');
      break;
    }
    case 'chair': {
      s += rect(-hw, -hd, w, d, 'body', 6);
      s += rect(-hw, -hd, w, 8, 'body2', 3);
      break;
    }
    case 'stool': s += circle(0, 0, Math.min(hw, hd), 'body') + circle(0, 0, Math.min(hw, hd) - 6); break;
    case 'office_chair': {
      s += circle(0, 4, Math.min(hw, hd) - 4, 'body');
      s += rect(-hw + 8, -hd, w - 16, 12, 'body2', 5);
      break;
    }
    case 'tv': {
      s += rect(-hw, -hd, w, d, 'body tvbody', 1);
      s += line(-hw + 2, hd - 1.5, hw - 2, hd - 1.5, 'ln screen');
      // pole widzenia (ok. 30°)
      s += path(`M${f(-hw)} ${f(hd)} L${f(-hw - 55)} ${f(hd + 205)} M${f(hw)} ${f(hd)} L${f(hw + 55)} ${f(hd + 205)}`, 'ln view');
      break;
    }
    case 'cabinet': {
      s += rect(-hw, -hd, w, d, 'body', 1);
      s += line(-hw, hd - 3, hw, hd - 3);
      const n = Math.max(1, Math.round(w / 45));
      for (let i = 1; i < n; i++) s += line(-hw + (w / n) * i, hd - 3, -hw + (w / n) * i, hd - 10);
      break;
    }
    case 'shelf': {
      s += rect(-hw, -hd, w, d, 'body', 1);
      const n = Math.max(1, Math.round(w / 40));
      for (let i = 1; i < n; i++) s += line(-hw + (w / n) * i, -hd, -hw + (w / n) * i, hd);
      s += line(-hw, 0, hw, 0, 'ln dash');
      break;
    }
    case 'wardrobe': {
      s += rect(-hw, -hd, w, d, 'body', 1);
      s += line(-hw + 4, 0, hw - 4, 0, 'ln dash'); // drążek
      const n = Math.max(1, Math.round(w / 50));
      for (let i = 1; i < n; i++) s += line(-hw + (w / n) * i, hd - 6, -hw + (w / n) * i, hd);
      s += line(-hw, hd - 6, hw, hd - 6);
      break;
    }
    case 'nightstand': s += rect(-hw, -hd, w, d, 'body', 2) + circle(0, -2, Math.min(w, d) * 0.22); break;
    case 'desk': {
      s += rect(-hw, -hd, w, d, 'body', 1);
      if (w >= 100) s += rect(hw - 40, -hd + 2, 38, d - 4, 'ln');
      break;
    }
    case 'bench': s += rect(-hw, -hd, w, d, 'body', 4) + line(-hw + 4, 0, hw - 4, 0, 'ln dash'); break;
    case 'k_base': {
      s += rect(-hw, -hd, w, d, 'body');
      s += line(-hw, hd - 4, hw, hd - 4);
      s += line(-hw + 2, -hd + 2, hw - 2, -hd + 2, 'ln dash');
      break;
    }
    case 'k_corner': {
      const m = opts.mirror ? -1 : 1;
      const dd = 60;
      const X = (x) => f(x * m);
      s += path(`M${X(-hw)} ${f(-hd)} L${X(hw)} ${f(-hd)} L${X(hw)} ${f(hd)} L${X(hw - dd)} ${f(hd)} L${X(hw - dd)} ${f(-hd + dd)} L${X(-hw)} ${f(-hd + dd)} Z`, 'body');
      s += line((hw - dd) * m, -hd + dd, hw * m, -hd, 'ln dash');
      break;
    }
    case 'k_sink': {
      s += rect(-hw, -hd, w, d, 'body');
      const bw = Math.min(w - 16, 48);
      const bx = w >= 90 ? -hw + 8 : -bw / 2;
      s += rect(bx, -hd + 8, bw, d - 20, 'body2', 6);
      s += circle(bx + bw / 2, -hd + 8 + (d - 20) / 2, 2.5);
      s += circle(bx + bw / 2, -hd + 5, 2, 'ln strong');
      if (w >= 90) for (let y = -hd + 12; y < hd - 14; y += 5) s += line(bx + bw + 6, y, hw - 6, y);
      break;
    }
    case 'k_hob': {
      s += rect(-hw, -hd, w, d, 'body');
      s += rect(-hw + 4, -hd + 4, w - 8, d - 12, 'body2', 2);
      const r1 = Math.min(w, d) * 0.13;
      const xs = [-hw + w * 0.3, hw - w * 0.3];
      s += circle(xs[0], -hd + d * 0.3, r1) + circle(xs[1], -hd + d * 0.3, r1 * 0.75);
      s += circle(xs[0], -hd + d * 0.65, r1 * 0.75) + circle(xs[1], -hd + d * 0.65, r1);
      break;
    }
    case 'k_oven': {
      s += rect(-hw, -hd, w, d, 'body');
      s += rect(-hw + 6, -hd + 6, w - 12, d - 12, 'ln');
      s += line(-hw, -hd, hw, hd, 'ln thin') + line(hw, -hd, -hw, hd, 'ln thin');
      break;
    }
    case 'k_fridge': {
      s += rect(-hw, -hd, w, d, 'body');
      s += line(-hw, hd - 5, hw, hd - 5);
      if (w > 80) s += line(0, hd - 5, 0, hd);
      s += `<text class="mark" x="0" y="${f(2)}">LOD</text>`;
      break;
    }
    case 'k_appliance': {
      s += rect(-hw, -hd, w, d, 'body');
      s += line(-hw, hd - 5, hw, hd - 5);
      s += `<text class="mark" x="0" y="${f(2)}">${def.mark || ''}</text>`;
      break;
    }
    case 'k_wall': {
      s += rect(-hw, -hd, w, d, 'body wall-mounted');
      s += line(-hw, -hd, hw, hd, 'ln dash') + line(hw, -hd, -hw, hd, 'ln dash');
      break;
    }
    case 'k_island': {
      s += rect(-hw, -hd, w, d, 'body', 2);
      s += line(-hw, -hd + 60, hw, -hd + 60, 'ln dash');
      break;
    }
    case 'bath': {
      s += rect(-hw, -hd, w, d, 'body', 3);
      s += rect(-hw + 6, -hd + 6, w - 12, d - 12, 'body2', Math.min(d, w) * 0.35);
      s += circle(-hw + 22, 0, 3);
      break;
    }
    case 'shower': {
      s += rect(-hw, -hd, w, d, 'body');
      s += line(-hw + 4, -hd + 4, hw - 4, hd - 4, 'ln thin') + line(hw - 4, -hd + 4, -hw + 4, hd - 4, 'ln thin');
      s += circle(0, 0, 4, 'body2');
      s += line(-hw, hd - 1, hw, hd - 1, 'ln strong');
      break;
    }
    case 'washbasin': {
      s += rect(-hw, -hd, w, d, 'body', 2);
      if (w >= 110) {
        s += ellipse(-hw / 2, 2, w * 0.17, d * 0.3, 'body2') + ellipse(hw / 2, 2, w * 0.17, d * 0.3, 'body2');
      } else s += ellipse(0, 2, Math.min(w * 0.35, 22), d * 0.3, 'body2');
      break;
    }
    case 'wc': {
      s += rect(-hw + 2, -hd, w - 4, 14, 'body2', 3);
      s += ellipse(0, -hd + 14 + (d - 14) / 2, hw - 1, (d - 14) / 2, 'body');
      s += ellipse(0, -hd + 16 + (d - 14) / 2, hw - 7, (d - 14) / 2 - 7, 'ln');
      break;
    }
    case 'washer': {
      s += rect(-hw, -hd, w, d, 'body', 2);
      s += circle(0, 2, Math.min(w, d) * 0.32, 'body2') + circle(0, 2, Math.min(w, d) * 0.22);
      break;
    }
    case 'lounger': {
      s += rect(-hw, -hd, w, d, 'body', 8);
      s += rect(-hw + 4, -hd + 4, w - 8, 50, 'body2', 6);
      break;
    }
    case 'plant': {
      s += ellipse(0, 0, hw, hd, 'body plant');
      if (Math.abs(w - d) < 5) for (let a = 0; a < 360; a += 60) {
        const r = (a * Math.PI) / 180;
        s += line(0, 0, Math.cos(r) * hw * 0.8, Math.sin(r) * hd * 0.8, 'ln leaf');
      } else s += line(-hw + 8, 0, hw - 8, 0, 'ln leaf');
      break;
    }
    case 'led_strip': case 'string_lights': {
      const L = lightOf(item, def) || {};
      s += rect(-hw, -hd, w, d, 'body strip', 1);
      s += `<line class="strip-led" x1="${f(-hw + 1)}" y1="0" x2="${f(hw - 1)}" y2="0" style="stroke:${L.color || '#ffb066'}"/>`;
      if (def.kind === 'string_lights') for (let x = -hw + 10; x < hw; x += 20) s += circle(x, 0, 1.6, 'body2');
      break;
    }
    case 'led_strip_v': {
      const L = lightOf(item, def) || {};
      s += circle(0, 0, Math.max(hw, 1.5), 'body strip') + circle(0, 0, 1, 'strip-dot') ;
      s = s.replace('class="strip-dot"', `class="strip-dot" style="fill:${L.color || '#ffb066'}"`);
      break;
    }
    case 'light_tube': case 'light_bar': s += rect(-hw, -hd, w, d, 'body lamp-body', Math.min(hw, hd)); break;
    case 'signe': s += rect(-hw, -hd, w, d, 'body lamp-body', 3) + rect(-2, -hd + 2, 4, d - 4, 'lamp-led'); break;
    case 'iris': case 'go': case 'bloom': s += ellipse(0, 0, hw, hd, 'body lamp-body') + ellipse(0, 0, hw * 0.55, hd * 0.55, 'lamp-led'); break;
    case 'twilight': s += rect(-hw, -hd, w, d, 'body lamp-body', 6) + ellipse(0, -hd * 0.2, hw * 0.6, hd * 0.5, 'lamp-led'); break;
    case 'pendant': case 'ceiling_round': case 'downlight': {
      s += ellipse(0, 0, hw, hd, 'body ceiling');
      s += line(-hw * 0.7, 0, hw * 0.7, 0, 'ln thin') + line(0, -hd * 0.7, 0, hd * 0.7, 'ln thin');
      break;
    }
    case 'being': case 'ceiling_panel': s += rect(-hw, -hd, w, d, 'body ceiling', 2) + line(-hw + 4, 0, hw - 4, 0, 'ln thin'); break;
    case 'centris': {
      s += rect(-hw, -hd, w, d, 'body ceiling', 6);
      for (const x of [-w / 3, 0, w / 3]) s += circle(x, 0, Math.min(5, hd - 2), 'lamp-led');
      break;
    }
    case 'plant3': s += drawPlant(def.plant, w, d, item.c); break;
    case 'slats': case 'slat_partition': {
      const { fin, pat, slat } = slatSpec(item, def);
      const pitch = pat.slat + pat.gap;
      const n = Math.max(1, Math.floor((w + pat.gap) / pitch));
      const x0 = -(n * pitch - pat.gap) / 2;
      if (def.kind === 'slats') {
        s += `<rect class="body slat-panel" x="${f(-hw)}" y="${f(-hd)}" width="${f(w)}" height="${f(d)}" style="fill:${fin.back || slat}"/>`;
        for (let i = 0; i < n; i++) s += `<rect class="slat" x="${f(x0 + i * pitch)}" y="${f(-hd + (fin.back ? 1 : 0))}" width="${f(pat.slat)}" height="${f(d - (fin.back ? 1 : 0))}" style="fill:${slat}"/>`;
      } else {
        s += `<rect class="body slat-outline" x="${f(-hw)}" y="${f(-hd)}" width="${f(w)}" height="${f(d)}"/>`;
        for (let i = 0; i < n; i++) s += `<rect class="slat" x="${f(x0 + i * pitch)}" y="${f(-hd)}" width="${f(pat.slat)}" height="${f(d)}" style="fill:${slat}"/>`;
      }
      break;
    }
    case 'pet_bed': {
      // legowisko z obrzeżem z trzech stron i niższym wejściem z przodu
      const b = Math.min(14, Math.min(w, d) * 0.16);
      s += rect(-hw, -hd, w, d, 'body', 12);
      s += rect(-hw + b, -hd + b, w - 2 * b, d - b - 5, 'body2', 8);
      s += line(-hw + b, hd - 5, hw - b, hd - 5, 'ln dash');
      const px = 0, py = 2, k = Math.min(w, d) * 0.06;
      s += ellipse(px, py + k * 0.8, k * 1.1, k * 0.9, 'ln') + circle(px - k * 1.2, py - k * 0.6, k * 0.42) + circle(px - k * 0.4, py - k * 1.3, k * 0.42) + circle(px + k * 0.4, py - k * 1.3, k * 0.42) + circle(px + k * 1.2, py - k * 0.6, k * 0.42);
      break;
    }
    case 'pet_bed_round': {
      s += ellipse(0, 0, hw, hd, 'body');
      s += ellipse(0, 2, hw * 0.72, hd * 0.72, 'body2');
      break;
    }
    case 'pet_bowls': {
      s += rect(-hw, -hd, w, d, 'body', 4);
      const r = Math.min(w / 4, d / 2) - 3;
      s += circle(-w / 4, 0, r, 'body2') + circle(w / 4, 0, r, 'body2');
      break;
    }
    case 'lamp': s += circle(0, 0, Math.min(hw, hd), 'body') + line(-hw * 0.7, 0, hw * 0.7, 0) + line(0, -hd * 0.7, 0, hd * 0.7); break;
    case 'rug': s += rect(-hw, -hd, w, d, 'rug', 2) + rect(-hw + 6, -hd + 6, w - 12, d - 12, 'ln dash'); break;
    case 'rug_round': s += ellipse(0, 0, hw, hd, 'rug') + ellipse(0, 0, hw - 6, hd - 6, 'ln dash'); break;
    case 'radiator': {
      s += rect(-hw, -hd, w, d, 'body');
      for (let x = -hw + 5; x < hw; x += 5) s += line(x, -hd, x, hd, 'ln thin');
      break;
    }
    default: {
      s += rect(-hw, -hd, w, d, 'body', 2);
      s += line(-hw, hd - 3, hw, hd - 3, 'ln thin');
    }
  }
  return glow + s;
}
