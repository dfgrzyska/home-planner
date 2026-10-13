import { PLAN, DEFAULT_ITEMS } from './plan.js';
import { CATALOG, CATALOG_BY_KEY, CATEGORIES } from './catalog.js';
import { drawShape, slatThumb } from './shapes.js';
import { store, encodeDoc, decodeDoc, buildShareUrl, readHashCode, readHashParams } from './storage.js';
import { normalizeStyle, WALL_PALETTE, FLOORS, FRONTS, COUNTERS, FRAMES, paletteName } from './style.js';
import { heightOf, elevationOf } from './dims3d.js';
import { HUE_COLORS, LIGHT_DIRS, lightOf } from './lights.js';
import { DOOR_TYPES, DOOR_FINISHES, DOOR_NAMES, doorOptions, normalizeDoors, doorGeometry, dirOf, isClosed } from './doors.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = (n) => Math.round(n * 10) / 10;
const norm360 = (a) => ((Math.round(a * 10) / 10) % 360 + 360) % 360;

// ---------------------------------------------------------------- stan

let doc = { v: 1, plan: PLAN.id, items: [], demo: [], style: normalizeStyle(), doors: {} };
let selectedDoor = null;
const hashParams = readHashParams(); // v=3d, cam=…, shot=1 (tryb zrzutu dla skryptów)
const shotMode = hashParams.shot === '1';
let nextId = 1;
let selectedId = null;
let lastSnap = null;
const undoStack = [];
const redoStack = [];

const settings = Object.assign(
  { overlay: 0, dims: true, labels: true, snap: true, dist: true, catOpen: {} },
  store.loadSettings(),
);

const view = { tx: 0, ty: 0, k: 1 };
let mode = 'select'; // 'select' | 'measure'
let measure = null;

const svg = $('#canvas');
const world = $('#world');
const L = {
  floor: $('#l-floor'), structure: $('#l-structure'), overlay: $('#l-overlay'), dims: $('#l-dims'),
  labels: $('#l-labels'), items: [$('#l-items0'), $('#l-items1'), $('#l-items2'), $('#l-items3')], sel: $('#l-sel'), measure: $('#l-measure'),
};

const defOf = (it) => CATALOG_BY_KEY[it.t] || CATALOG_BY_KEY.custom;
const layerOf = (it) => defOf(it).layer ?? 1;
const getItem = (id) => doc.items.find((i) => i.id === id);

function normalizeItem(raw) {
  const def = CATALOG_BY_KEY[raw.t] ? CATALOG_BY_KEY[raw.t] : CATALOG_BY_KEY.custom;
  const it = {
    id: raw.id || nextId++,
    t: def.key,
    x: Number(raw.x) || 0, y: Number(raw.y) || 0, r: norm360(Number(raw.r) || 0),
    w: Math.max(1, Number(raw.w) || def.w), d: Math.max(1, Number(raw.d) || def.d),
  };
  if (raw.v !== undefined) it.v = raw.v;
  if (raw.o && Object.keys(raw.o).length) it.o = { ...raw.o };
  else if (def.opts) it.o = { ...def.opts };
  if (raw.n) it.n = String(raw.n).slice(0, 60);
  if (raw.c) it.c = raw.c;
  if (Number.isFinite(Number(raw.h)) && raw.h !== null && raw.h !== '') it.h = Number(raw.h);
  if (Number.isFinite(Number(raw.e)) && raw.e !== null && raw.e !== '') it.e = Number(raw.e);
  nextId = Math.max(nextId, it.id + 1);
  return it;
}

function loadDoc(d, { keepHistory = false } = {}) {
  nextId = 1;
  const items = Array.isArray(d && d.items) ? d.items : [];
  doc = {
    v: 1, plan: PLAN.id,
    items: items.map((i) => normalizeItem({ ...i, id: keepHistory ? i.id : undefined })),
    demo: Array.isArray(d && d.demo) ? d.demo.filter((id) => PLAN.partitions.some((p) => p.id === id)) : [],
    style: normalizeStyle(d && d.style),
    doors: normalizeDoors(d && d.doors),
  };
  if (!keepHistory) {
    undoStack.length = 0; redoStack.length = 0;
    lastSnap = JSON.stringify(doc);
    if (!shotMode) store.saveCurrent(doc);
  }
  if (!getItem(selectedId)) selectedId = null;
  renderAll();
}

// Dokument do udostępnienia: bez identyfikatorów, liczby zaokrąglone
function exportDoc() {
  return {
    v: 1, plan: PLAN.id, demo: doc.demo, style: doc.style, doors: doc.doors,
    items: doc.items.map(({ id, ...rest }) => ({ ...rest, x: r1(rest.x), y: r1(rest.y) })),
  };
}

function commit() {
  const snap = JSON.stringify(doc);
  if (snap === lastSnap) return;
  if (lastSnap) undoStack.push(lastSnap);
  if (undoStack.length > 200) undoStack.shift();
  redoStack.length = 0;
  lastSnap = snap;
  if (!shotMode) store.saveCurrent(doc);
  updateUndoButtons();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(lastSnap);
  lastSnap = undoStack.pop();
  const d = JSON.parse(lastSnap);
  loadDoc(d, { keepHistory: true });
  store.saveCurrent(doc);
  updateUndoButtons();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(lastSnap);
  lastSnap = redoStack.pop();
  loadDoc(JSON.parse(lastSnap), { keepHistory: true });
  store.saveCurrent(doc);
  updateUndoButtons();
}

function updateUndoButtons() {
  $('#btn-undo').disabled = !undoStack.length;
  $('#btn-redo').disabled = !redoStack.length;
}

function saveSettings() { store.saveSettings(settings); }

// ---------------------------------------------------------------- geometria

function corners(it) {
  const a = (it.r * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const hw = it.w / 2, hd = it.d / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => [it.x + x * c - y * s, it.y + x * s + y * c]);
}

function aabbOf(pts) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const [x, y] of pts) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
  return { x1, y1, x2, y2 };
}
const itemBox = (it) => aabbOf(corners(it));
const rectPts = ([x, y, w, h]) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

function polysOverlap(A, B, eps = 0.5) {
  for (const P of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % 4];
      const nx = -(y2 - y1), ny = x2 - x1;
      const len = Math.hypot(nx, ny) || 1;
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const [x, y] of A) { const p = (x * nx + y * ny) / len; aMin = Math.min(aMin, p); aMax = Math.max(aMax, p); }
      for (const [x, y] of B) { const p = (x * nx + y * ny) / len; bMin = Math.min(bMin, p); bMax = Math.max(bMax, p); }
      if (aMax <= bMin + eps || bMax <= aMin + eps) return false;
    }
  }
  return true;
}

function structureRects() {
  const out = [...PLAN.walls, ...PLAN.bathWalls, ...PLAN.context, ...PLAN.windows.map((w) => w.rect), ...PLAN.balcony.railing];
  for (const p of PLAN.partitions) if (!doc.demo.includes(p.id)) out.push(...p.rects);
  return out;
}

function clashesOf(it, rects = structureRects()) {
  const lay = layerOf(it);
  if (lay === 0 || lay === 3) return null; // dywany, lamele, paski LED i elementy sufitowe nie kolidują
  const P = corners(it);
  for (const r of rects) if (polysOverlap(P, rectPts(r))) return 'ściana';
  for (const o of doc.items) {
    if (o === it || layerOf(o) !== lay) continue;
    if (polysOverlap(P, corners(o))) return defOf(o).name;
  }
  return null;
}

const isAxis = (it) => Math.abs(Math.round(it.r / 90) * 90 - it.r) < 0.01;

// Przyciąganie krawędzi elementu do ścian i innych mebli
function snapPosition(it, x, y) {
  x = Math.round(x); y = Math.round(y);
  if (!settings.snap || !isAxis(it)) return { x, y };
  const swap = Math.round(it.r / 90) % 2 !== 0;
  const hw = (swap ? it.d : it.w) / 2, hd = (swap ? it.w : it.d) / 2;
  const thr = 12 / view.k;
  const near = 60;
  let best = { dx: Infinity, dy: Infinity };
  const tryX = (edge, line, lo, hi) => {
    if (lo > y + hd + near || hi < y - hd - near) return;
    const dx = line - edge;
    if (Math.abs(dx) < thr && Math.abs(dx) < Math.abs(best.dx)) best.dx = dx;
  };
  const tryY = (edge, line, lo, hi) => {
    if (lo > x + hw + near || hi < x - hw - near) return;
    const dy = line - edge;
    if (Math.abs(dy) < thr && Math.abs(dy) < Math.abs(best.dy)) best.dy = dy;
  };
  for (const [rx, ry, rw, rh] of structureRects()) {
    tryX(x - hw, rx + rw, ry, ry + rh); // lewa krawędź do prawego lica ściany
    tryX(x + hw, rx, ry, ry + rh);
    tryY(y - hd, ry + rh, rx, rx + rw);
    tryY(y + hd, ry, rx, rx + rw);
  }
  for (const o of doc.items) {
    if (o.id === it.id || layerOf(o) === 0 || layerOf(o) === 3) continue;
    const b = itemBox(o);
    for (const e of [x - hw, x + hw]) { tryX(e, b.x1, b.y1, b.y2); tryX(e, b.x2, b.y1, b.y2); }
    for (const e of [y - hd, y + hd]) { tryY(e, b.y1, b.x1, b.x2); tryY(e, b.y2, b.x1, b.x2); }
  }
  if (Number.isFinite(best.dx)) x += best.dx;
  if (Number.isFinite(best.dy)) y += best.dy;
  return { x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2 };
}

// Odległości od krawędzi zaznaczonego elementu do najbliższych przeszkód
function distances(it) {
  const b = itemBox(it);
  const boxes = structureRects().map(([x, y, w, h]) => ({ x1: x, y1: y, x2: x + w, y2: y + h }));
  for (const o of doc.items) if (o.id !== it.id && layerOf(o) !== 0 && layerOf(o) !== 3) boxes.push(itemBox(o));
  const e = 0.5;
  const res = [];
  const my = (b.y1 + b.y2) / 2, mx = (b.x1 + b.x2) / 2;
  let v;
  v = Math.max(-Infinity, ...boxes.filter((o) => o.y1 < b.y2 - e && o.y2 > b.y1 + e && o.x2 <= b.x1 + e).map((o) => o.x2));
  if (Number.isFinite(v)) res.push([v, my, b.x1, my]);
  v = Math.min(Infinity, ...boxes.filter((o) => o.y1 < b.y2 - e && o.y2 > b.y1 + e && o.x1 >= b.x2 - e).map((o) => o.x1));
  if (Number.isFinite(v)) res.push([b.x2, my, v, my]);
  v = Math.max(-Infinity, ...boxes.filter((o) => o.x1 < b.x2 - e && o.x2 > b.x1 + e && o.y2 <= b.y1 + e).map((o) => o.y2));
  if (Number.isFinite(v)) res.push([mx, v, mx, b.y1]);
  v = Math.min(Infinity, ...boxes.filter((o) => o.x1 < b.x2 - e && o.x2 > b.x1 + e && o.y1 >= b.y2 - e).map((o) => o.y1));
  if (Number.isFinite(v)) res.push([mx, b.y2, mx, v]);
  return res.filter(([x1, y1, x2, y2]) => Math.hypot(x2 - x1, y2 - y1) >= 1 && Math.hypot(x2 - x1, y2 - y1) < 1200);
}

// ---------------------------------------------------------------- widok

function applyView() {
  world.setAttribute('transform', `translate(${view.tx} ${view.ty}) scale(${view.k})`);
  $('#zoom-label').textContent = `${Math.round(view.k * 100)}%`;
  renderSelection();
  renderMeasure();
}

function fitView() {
  const r = svg.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const b = PLAN.bounds;
  const k = Math.min(r.width / b.w, r.height / b.h) * 0.96;
  view.k = k;
  view.tx = (r.width - b.w * k) / 2 - b.x * k;
  view.ty = (r.height - b.h * k) / 2 - b.y * k;
  applyView();
}

function zoomAt(factor, cx, cy) {
  const k = Math.min(8, Math.max(0.15, view.k * factor));
  const f = k / view.k;
  view.tx = cx - (cx - view.tx) * f;
  view.ty = cy - (cy - view.ty) * f;
  view.k = k;
  applyView();
}

function toWorld(clientX, clientY) {
  const r = svg.getBoundingClientRect();
  return [(clientX - r.left - view.tx) / view.k, (clientY - r.top - view.ty) / view.k];
}

// ---------------------------------------------------------------- rysowanie

const svgRect = ([x, y, w, h], cls, extra = '') => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" ${extra}/>`;

function renderStructure() {
  let fl = '';
  for (const r of PLAN.balcony.rects) fl += svgRect(r, 'balcony') + svgRect(r, 'balcony-tiles');
  for (const r of PLAN.floor) fl += svgRect(r, 'floor');
  L.floor.innerHTML = fl;

  let s = '';
  // obniżenie sufitu
  const [sx, sy, sw, sh] = PLAN.soffit.rect;
  s += `<line class="soffit" x1="${sx}" y1="${sy}" x2="${sx + sw}" y2="${sy}"/><line class="soffit" x1="${sx}" y1="${sy + sh}" x2="${sx + sw}" y2="${sy + sh}"/>`;
  s += `<text class="soffit-label" x="${sx + 470}" y="${sy + sh / 2}">${PLAN.soffit.label}</text>`;

  for (const r of PLAN.context) s += svgRect(r, 'ctx');
  for (const r of PLAN.balcony.railing) s += svgRect(r, 'railing');
  for (const r of PLAN.bathWalls) s += svgRect(r, 'bathwall');
  for (const p of PLAN.partitions) {
    const demo = doc.demo.includes(p.id);
    for (const r of p.rects) s += svgRect(r, demo ? 'partition demolished' : 'partition', `data-partition="${p.id}"`);
  }
  for (const r of PLAN.walls) s += svgRect(r, 'wall');

  for (const w of PLAN.windows) {
    const [x, y, ww, hh] = w.rect;
    s += svgRect(w.rect, 'window');
    if (hh > ww) {
      s += `<line class="glass" x1="${x + ww * 0.42}" y1="${y}" x2="${x + ww * 0.42}" y2="${y + hh}"/>`;
      s += `<line class="glass" x1="${x + ww * 0.58}" y1="${y}" x2="${x + ww * 0.58}" y2="${y + hh}"/>`;
    } else {
      s += `<line class="glass" x1="${x}" y1="${y + hh * 0.42}" x2="${x + ww}" y2="${y + hh * 0.42}"/>`;
      s += `<line class="glass" x1="${x}" y1="${y + hh * 0.58}" x2="${x + ww}" y2="${y + hh * 0.58}"/>`;
    }
    for (const m of w.mullions || []) s += `<rect class="mullion" x="${m - 3}" y="${y + hh * 0.35}" width="6" height="${hh * 0.3}"/>`;
  }

  const hiddenDoors = PLAN.partitions.filter((p) => p.door && doc.demo.includes(p.id)).map((p) => p.door);
  for (const d of PLAN.doors) {
    if (hiddenDoors.includes(d.id)) continue;
    s += doorSvg(d);
    if (d.entry) {
      const [hx, hy] = d.hinge;
      s += `<path class="entry-arrow" d="M${hx - 75} ${hy + 30} h22 v-10 l18 22 l-18 22 v-10 h-22 z"/>`;
      s += `<text class="entry-label" x="${hx - 64}" y="${hy + 86}">wejście</text>`;
    }
  }
  const [blx, bly] = PLAN.balcony.label;
  s += `<text class="balcony-label" x="${blx}" y="${bly}">BALKON · ${PLAN.balcony.area.toFixed(2).replace('.', ',')} m²</text>`;
  L.structure.innerHTML = s;

  const o = PLAN.overlay;
  L.overlay.setAttribute('href', o.href);
  L.overlay.setAttribute('x', o.x); L.overlay.setAttribute('y', o.y);
  L.overlay.setAttribute('width', o.w); L.overlay.setAttribute('height', o.h);

  let lab = '';
  for (const r of PLAN.rooms) {
    const [x, y] = r.label;
    lab += `<g class="room-label" transform="translate(${x} ${y})">` +
      `<rect x="-11" y="-30" width="22" height="22" class="room-num-box"/><text class="room-num" x="0" y="-19">${r.n}</text>` +
      `<text class="room-name" x="0" y="8">${esc(r.name)}</text>` +
      `<text class="room-area" x="0" y="24">${r.area.toFixed(2).replace('.', ',')} m²</text></g>`;
  }
  L.labels.innerHTML = lab;
  sync3d();
}

// Drzwi wg ustawień użytkownika: skrzydłowe, ukryte, przesuwne albo sam otwór
function doorSvg(d) {
  const opt = doorOptions(doc.doors, d.id);
  const g = doorGeometry(d, opt);
  const [hx, hy] = g.hinge;
  const at = (deg, r = g.r) => { const [dx, dy] = dirOf(deg); return [r1(hx + dx * r), r1(hy + dy * r)]; };
  const [gx, gy, gw, gh] = g.gap;
  let s = `<g class="door door-${opt.type}${selectedDoor === d.id ? ' selected' : ''}" data-door="${d.id}">`;
  s += `<rect class="door-hit" x="${gx}" y="${gy}" width="${gw}" height="${gh}"/>`;
  if (opt.type === 'swing' || opt.type === 'hidden') {
    const [ox, oy] = at(g.open), [cx, cy] = at(g.closed);
    const sweep = (((g.closed - g.open + 540) % 360) - 180) > 0 ? 1 : 0;
    s += `<path class="door-hit" d="M${r1(hx)} ${r1(hy)} L${ox} ${oy} A${g.r} ${g.r} 0 0 ${sweep} ${cx} ${cy} Z"/>`;
    s += `<path class="door-swing" d="M${ox} ${oy} A${g.r} ${g.r} 0 0 ${sweep} ${cx} ${cy}"/>`;
    s += `<line class="door-leaf" x1="${r1(hx)}" y1="${r1(hy)}" x2="${ox}" y2="${oy}"/>`;
    if (opt.type === 'hidden') {
      const [mx, my] = at(g.closed, g.r / 2);
      const [ux, uy] = dirOf(g.open);
      s += `<text class="door-tag" x="${r1(mx + ux * 16)}" y="${r1(my + uy * 16)}">ukryte</text>`;
    }
  } else if (opt.type === 'sliding') {
    // skrzydło odsunięte na ścianę obok otworu (po stronie zawiasu), szyna nad otworem
    const [cdx, cdy] = dirOf(g.closed), [odx, ody] = dirOf(g.open);
    const ax = hx + odx * 4, ay = hy + ody * 4;
    const p1 = [r1(ax - cdx * (g.r + 4)), r1(ay - cdy * (g.r + 4))], p2 = [r1(ax + cdx * 4), r1(ay + cdy * 4)];
    const rail = [r1(ax + cdx * (g.r + 2)), r1(ay + cdy * (g.r + 2))];
    s += `<path class="door-hit" d="M${p1[0] + odx * 8} ${p1[1] + ody * 8} L${rail[0] + odx * 8} ${rail[1] + ody * 8} L${rail[0] - odx * 6} ${rail[1] - ody * 6} L${p1[0] - odx * 6} ${p1[1] - ody * 6} Z"/>`;
    s += `<line class="door-swing dashed" x1="${p1[0]}" y1="${p1[1]}" x2="${rail[0]}" y2="${rail[1]}"/>`;
    s += `<line class="door-leaf slide" x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}"/>`;
    const [mx, my] = [(p1[0] + p2[0]) / 2 + odx * 12, (p1[1] + p2[1]) / 2 + ody * 12];
    s += `<text class="door-tag" x="${r1(mx)}" y="${r1(my)}">przesuwne</text>`;
  }
  return s + '</g>';
}

function roomAt(x, y) {
  for (const r of PLAN.rooms) for (const [fx, fy, fw, fh] of r.floor) if (x >= fx && x <= fx + fw && y >= fy && y <= fy + fh) return r;
  return null;
}

function renderDims() {
  L.dims.style.display = settings.dims ? '' : 'none';
  let s = '';
  for (const [x1, y1, x2, y2, label] of PLAN.dims) {
    const vert = x1 === x2;
    const t = 5;
    s += `<line class="dim" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    if (vert) s += `<line class="dim" x1="${x1 - t}" y1="${y1}" x2="${x1 + t}" y2="${y1}"/><line class="dim" x1="${x2 - t}" y1="${y2}" x2="${x2 + t}" y2="${y2}"/>`;
    else s += `<line class="dim" x1="${x1}" y1="${y1 - t}" x2="${x1}" y2="${y1 + t}"/><line class="dim" x1="${x2}" y1="${y2 - t}" x2="${x2}" y2="${y2 + t}"/>`;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    s += vert
      ? `<text class="dim-label" transform="translate(${mx - 7} ${my}) rotate(-90)">${label}</text>`
      : `<text class="dim-label" x="${mx}" y="${my - 6}">${label}</text>`;
  }
  L.dims.innerHTML = s;
}

function renderItems() {
  for (const g of L.items) g.textContent = '';
  const rects = structureRects();
  for (const it of doc.items) {
    const def = defOf(it);
    const g = document.createElementNS(SVGNS, 'g');
    const clash = clashesOf(it, rects);
    g.setAttribute('class', `item cat-${def.cat}${it.id === selectedId ? ' selected' : ''}${clash ? ' clash' : ''}${it.o && it.o.lock ? ' locked' : ''}`);
    g.dataset.id = it.id;
    g.setAttribute('transform', `translate(${r1(it.x)} ${r1(it.y)}) rotate(${it.r})`);
    if (it.c) g.style.setProperty('--fill', it.c);
    let inner = drawShape(it, def);
    if (settings.labels && Math.min(it.w, it.d) >= 20 && def.kind !== 'tv') {
      // etykieta jest zawsze pozioma – dopasuj rozmiar do dostępnej szerokości
      const text = it.n || def.name;
      const across = Math.round(it.r / 90) % 2 !== 0 ? it.d : it.w;
      const fs = Math.min(10, Math.min(it.w, it.d) * 0.22, (across * 0.9) / (text.length * 0.56));
      if (fs >= 4.5) inner += `<g transform="rotate(${-it.r})"><text class="ilabel" font-size="${r1(fs)}">${esc(text)}</text></g>`;
    }
    g.innerHTML = inner;
    L.items[layerOf(it)].appendChild(g);
  }
  sync3d();
}

function updateItemNode(it) {
  const g = svg.querySelector(`.item[data-id="${it.id}"]`);
  if (!g) return;
  g.setAttribute('transform', `translate(${r1(it.x)} ${r1(it.y)}) rotate(${it.r})`);
  const lbl = g.querySelector(':scope > g');
  if (lbl) lbl.setAttribute('transform', `rotate(${-it.r})`);
  g.classList.toggle('clash', !!clashesOf(it));
}

function renderSelection() {
  const it = getItem(selectedId);
  if (!it) { L.sel.innerHTML = ''; return; }
  const k = view.k;
  const hw = it.w / 2, hd = it.d / 2, pad = 3 / k;
  const hy = -hd - pad - 26 / k;
  let s = `<g transform="translate(${r1(it.x)} ${r1(it.y)}) rotate(${it.r})">`;
  s += `<rect class="sel-outline" x="${-hw - pad}" y="${-hd - pad}" width="${it.w + 2 * pad}" height="${it.d + 2 * pad}"/>`;
  s += `<line class="sel-outline" x1="0" y1="${-hd - pad}" x2="0" y2="${hy}"/>`;
  s += `<circle class="rot-handle" data-handle="rotate" cx="0" cy="${hy}" r="${7 / k}"/>`;
  s += `<g transform="translate(0 ${hd + pad + 16 / k}) rotate(${-it.r})"><text class="sel-size" font-size="${12 / k}">${Math.round(it.w)} × ${Math.round(it.d)} cm</text></g>`;
  s += '</g>';
  if (settings.dist && isAxis(it)) {
    for (const [x1, y1, x2, y2] of distances(it)) {
      const len = Math.round(Math.hypot(x2 - x1, y2 - y1));
      const vert = x1 === x2, t = 4 / k;
      s += `<line class="dist" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      s += vert ? `<line class="dist" x1="${x1 - t}" y1="${y1}" x2="${x1 + t}" y2="${y1}"/><line class="dist" x1="${x2 - t}" y1="${y2}" x2="${x2 + t}" y2="${y2}"/>`
        : `<line class="dist" x1="${x1}" y1="${y1 - t}" x2="${x1}" y2="${y1 + t}"/><line class="dist" x1="${x2}" y1="${y2 - t}" x2="${x2}" y2="${y2 + t}"/>`;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      s += vert ? `<text class="dist-label" font-size="${11 / k}" transform="translate(${mx + 5 / k} ${my})" text-anchor="start">${len}</text>`
        : `<text class="dist-label" font-size="${11 / k}" x="${mx}" y="${my - 5 / k}">${len}</text>`;
    }
  }
  L.sel.innerHTML = s;
}

function renderMeasure() {
  if (!measure) { L.measure.innerHTML = ''; return; }
  const [x1, y1] = measure.a, [x2, y2] = measure.b;
  const k = view.k;
  const len = Math.hypot(x2 - x1, y2 - y1);
  L.measure.innerHTML =
    `<line class="measure" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>` +
    `<circle class="measure-pt" cx="${x1}" cy="${y1}" r="${3.5 / k}"/><circle class="measure-pt" cx="${x2}" cy="${y2}" r="${3.5 / k}"/>` +
    `<text class="measure-label" font-size="${13 / k}" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8 / k}">${Math.round(len)} cm</text>`;
}

function renderOverlay() {
  L.overlay.style.opacity = settings.overlay;
  L.overlay.style.display = settings.overlay > 0 ? '' : 'none';
}

function renderAll() {
  renderStructure();
  renderDims();
  renderOverlay();
  renderItems();
  renderSelection();
  renderPanel();
  updateUndoButtons();
}

// ---------------------------------------------------------------- operacje na elementach

function selectDoor(id) {
  selectedDoor = id;
  selectedId = null;
  renderStructure();
  renderSelection();
  renderPanel();
  if (view3d) { view3d.setSelected(null); view3d.setSelectedDoor(id); }
}

function select(id) {
  if (selectedDoor) { selectedDoor = null; renderStructure(); if (view3d) view3d.setSelectedDoor(null); }
  selectedId = id;
  for (const g of svg.querySelectorAll('.item.selected')) g.classList.remove('selected');
  if (id) { const g = svg.querySelector(`.item[data-id="${id}"]`); if (g) g.classList.add('selected'); }
  renderSelection();
  renderPanel();
  if (view3d) view3d.setSelected(id);
}

function makeItem(key, x, y) {
  const def = CATALOG_BY_KEY[key];
  const vi = def.variants ? (def.defaultVariant ?? 0) : undefined;
  const v = vi !== undefined ? def.variants[vi] : null;
  return normalizeItem({ t: key, x, y, r: 0, w: v ? v.w : def.w, d: v ? v.d : def.d, h: v && v.h ? v.h : undefined, v: vi, o: def.opts ? { ...def.opts } : undefined });
}

function addItemAtCenter(key) {
  const r = svg.getBoundingClientRect();
  const [cx, cy] = toWorld(r.left + r.width / 2, r.top + r.height / 2);
  const it = makeItem(key, cx, cy);
  const p = snapPosition(it, cx, cy);
  it.x = p.x; it.y = p.y;
  doc.items.push(it);
  selectedId = it.id;
  renderItems(); renderSelection(); renderPanel();
  commit();
  toast(`Dodano: ${defOf(it).name}`);
}

function removeSelected() {
  const it = getItem(selectedId);
  if (!it) return;
  doc.items = doc.items.filter((i) => i !== it);
  selectedId = null;
  renderItems(); renderSelection(); renderPanel();
  commit();
}

function duplicateSelected() {
  const it = getItem(selectedId);
  if (!it) return;
  const copy = normalizeItem({ ...it, id: undefined, x: it.x + 20, y: it.y + 20, o: it.o ? { ...it.o } : undefined });
  doc.items.push(copy);
  selectedId = copy.id;
  renderItems(); renderSelection(); renderPanel();
  commit();
}

function rotateSelected(delta) {
  const it = getItem(selectedId);
  if (!it || (it.o && it.o.lock)) return;
  it.r = norm360(it.r + delta);
  renderItems(); renderSelection(); renderPanel();
  commit();
}

let nudgeTimer = null;
function nudgeSelected(dx, dy) {
  const it = getItem(selectedId);
  if (!it || (it.o && it.o.lock)) return;
  it.x += dx; it.y += dy;
  updateItemNode(it); renderSelection(); renderPanelPosition();
  clearTimeout(nudgeTimer);
  nudgeTimer = setTimeout(() => { renderItems(); commit(); }, 350);
}

// ---------------------------------------------------------------- panel właściwości

const panel = $('#panel');

function renderPanelPosition() {
  const it = getItem(selectedId);
  if (!it) return;
  const px = $('#prop-x'), py = $('#prop-y');
  if (px) px.value = r1(it.x);
  if (py) py.value = r1(it.y);
}

function renderPanel() {
  if (selectedDoor) { renderPanelDoor(); return; }
  const it = getItem(selectedId);
  if (!it) { renderPanelApartment(); return; }
  const def = defOf(it);
  const clash = clashesOf(it);
  const o = it.o || {};
  let h = `<div class="panel-head"><div><div class="eyebrow">${esc(CATEGORIES.find((c) => c.id === def.cat)?.name || '')}</div><h2>${esc(def.name)}</h2></div>` +
    `<button class="icon-btn" id="prop-close" title="Odznacz (Esc)">✕</button></div>`;
  if (clash) h += `<div class="warn">⚠ Nachodzi na: ${esc(clash)}</div>`;
  h += `<label class="field"><span>Nazwa</span><input id="prop-name" type="text" value="${esc(it.n || '')}" placeholder="${esc(def.name)}"></label>`;
  if (def.variants) {
    const fits = (v) => v.w === it.w && v.d === it.d;
    let cur = def.variants.findIndex((v, i) => i === it.v && fits(v));
    if (cur < 0) cur = def.variants.findIndex(fits);
    h += `<label class="field"><span>Wariant</span><select id="prop-variant">`;
    def.variants.forEach((v, i) => { h += `<option value="${i}"${i === cur ? ' selected' : ''}>${esc(v.l)}</option>`; });
    if (cur < 0) h += `<option value="" selected>własny wymiar</option>`;
    h += `</select></label>`;
  }
  if (def.range) {
    const rg = def.range;
    h += `<label class="field"><span>${esc(rg.label)}: <b id="range-val">${Math.round(it.w)} cm</b></span>` +
      `<input id="prop-range" type="range" min="${rg.min}" max="${rg.max}" step="${rg.step}" value="${Math.round(it.w)}"></label>`;
    if (rg.base) h += `<div class="seg"><button data-len="${rg.min}">Złożony ${rg.min}</button><button data-len="${rg.max}">Rozłożony ${rg.max}</button></div>`;
  }
  h += `<div class="grid2">` +
    `<label class="field"><span>Szerokość</span><div class="unit"><input id="prop-w" type="number" min="1" step="1" value="${r1(it.w)}"><i>cm</i></div></label>` +
    `<label class="field"><span>Głębokość</span><div class="unit"><input id="prop-d" type="number" min="1" step="1" value="${r1(it.d)}"><i>cm</i></div></label>` +
    `<label class="field"><span>Środek X</span><div class="unit"><input id="prop-x" type="number" step="1" value="${r1(it.x)}"><i>cm</i></div></label>` +
    `<label class="field"><span>Środek Y</span><div class="unit"><input id="prop-y" type="number" step="1" value="${r1(it.y)}"><i>cm</i></div></label>` +
    `<label class="field"><span>Wysokość (3D)</span><div class="unit"><input id="prop-h" type="number" min="1" step="1" value="${r1(heightOf(it, def))}"><i>cm</i></div></label>` +
    ((def.layer ?? 1) >= 2 || ['led_strip', 'led_strip_v', 'string_lights'].includes(def.kind)
      ? `<label class="field"><span>${(def.layer ?? 1) === 3 ? 'Dół lampy nad podłogą' : 'Montaż od podłogi'}</span><div class="unit"><input id="prop-e" type="number" min="0" step="1" value="${r1(elevationOf(it, def))}"><i>cm</i></div></label>`
      : '') +
    `</div>`;
  h += `<label class="field"><span>Obrót</span><div class="rot-row">` +
    `<button class="btn" data-rot="-90" title="Shift+R">⟲ 90°</button>` +
    `<div class="unit"><input id="prop-r" type="number" step="1" value="${r1(it.r)}"><i>°</i></div>` +
    `<button class="btn" data-rot="90" title="R">⟳ 90°</button></div></label>`;
  if (def.finishes) {
    const cur = (o.finish && def.finishes.some((x) => x.id === o.finish)) ? o.finish : def.opts.finish;
    h += `<label class="field"><span>Wykończenie lameli</span><select data-oselect="finish">` +
      def.finishes.map((x) => `<option value="${x.id}"${x.id === cur ? ' selected' : ''}>${esc(x.name)}</option>`).join('') + `</select></label>`;
  }
  if (def.patterns) {
    const cur = (o.pattern && def.patterns.some((x) => x.id === o.pattern)) ? o.pattern : def.opts.pattern;
    h += `<label class="field"><span>Rozstaw lameli</span><select data-oselect="pattern">` +
      def.patterns.map((x) => `<option value="${x.id}"${x.id === cur ? ' selected' : ''}>${esc(x.name)}</option>`).join('') + `</select></label>`;
  }
  // światło (Hue / lampy) albo podświetlenie TV
  const Lspec = def.light || def.lightOption;
  if (Lspec) {
    const L = lightOf({ ...it, o: { ...o, hue: true } }, def);
    const active = def.light ? true : !!o.hue;
    h += `<div class="light-box"><div class="finish-label"><b>${def.light ? 'Światło' : esc(def.lightOption.name)}</b></div>`;
    if (!def.light) h += `<label class="check"><input type="checkbox" data-lopt="hue"${active ? ' checked' : ''}> zamontowane</label>`;
    if (active) {
      h += `<label class="check"><input type="checkbox" data-lopt="on"${o.on !== false ? ' checked' : ''}> włączone</label>`;
      h += `<div class="finish-label">Kolor${Lspec.gradient ? ' – początek gradientu' : ''}</div>` + swatches(HUE_COLORS, L.color, 'data-lcolor');
      if (Lspec.gradient) h += `<div class="finish-label">Kolor – koniec gradientu</div>` + swatches(HUE_COLORS, L.color2, 'data-lcolor2');
      h += `<label class="field"><span>Jasność: <b id="lbright-val">${Math.round(L.bright)}%</b> · ok. ${Math.round(L.lm)} lm</span><input type="range" min="1" max="100" value="${Math.round(L.bright)}" data-lbright></label>`;
      if (Lspec.type === 'strip' && !Lspec.vertical) {
        h += `<label class="field"><span>Kierunek świecenia</span><select data-ldir>` +
          ['up', 'out', 'down'].map((k) => `<option value="${k}"${L.dir === k ? ' selected' : ''}>${LIGHT_DIRS[k]}</option>`).join('') + `</select></label>`;
      }
    }
    h += `</div>`;
  }
  const checks = [];
  if (def.opts && 'chairs' in def.opts) checks.push(['chairs', 'Pokaż krzesła']);
  if (def.opts && 'mirror' in def.opts) {
    const left = !!o.mirror;
    const label = def.kind === 'sofa_l' ? 'Szezlong (patrząc na front)' : 'Ramię narożnika (patrząc na front)';
    h += `<div class="field"><span>${label}</span><div class="seg"><button data-side="left" class="${left ? 'on' : ''}">po lewej</button><button data-side="right" class="${left ? '' : 'on'}">po prawej</button></div></div>`;
  }
  checks.push(['lock', 'Zablokuj pozycję']);
  h += `<div class="checks">` + checks.map(([key, label]) =>
    `<label class="check"><input type="checkbox" data-opt="${key}"${o[key] ? ' checked' : ''}> ${label}</label>`).join('') + `</div>`;
  h += `<label class="field"><span>Kolor</span><div class="color-row"><input id="prop-color" type="color" value="${it.c || '#e4e7ec'}">` +
    `<button class="link-btn" id="prop-color-reset">domyślny</button></div></label>`;
  h += `<div class="actions"><button class="btn" id="prop-dup">Duplikuj <kbd>Ctrl D</kbd></button>` +
    `<button class="btn danger" id="prop-del">Usuń <kbd>Del</kbd></button></div>`;
  panel.innerHTML = h;

  const num = (id, fn) => $(id).addEventListener('change', (e) => {
    const v = parseFloat(e.target.value);
    if (!Number.isFinite(v)) return;
    fn(v); renderItems(); renderSelection(); renderPanel(); commit();
  });
  $('#prop-close').onclick = () => select(null);
  $('#prop-name').addEventListener('change', (e) => { it.n = e.target.value.trim() || undefined; if (!it.n) delete it.n; renderItems(); commit(); });
  num('#prop-w', (v) => { it.w = Math.max(1, v); delete it.v; });
  num('#prop-d', (v) => { it.d = Math.max(1, v); delete it.v; });
  num('#prop-x', (v) => { it.x = v; });
  num('#prop-y', (v) => { it.y = v; });
  num('#prop-r', (v) => { it.r = norm360(v); });
  num('#prop-h', (v) => { it.h = Math.max(1, v); });
  if ($('#prop-e')) num('#prop-e', (v) => { it.e = Math.max(0, v); });
  if (def.variants) $('#prop-variant').addEventListener('change', (e) => {
    if (e.target.value === '') return;
    const i = +e.target.value, v = def.variants[i];
    it.v = i; it.w = v.w; it.d = v.d;
    if (v.h) it.h = v.h;
    renderItems(); renderSelection(); renderPanel(); commit();
  });
  if (def.range) {
    const rng = $('#prop-range');
    rng.addEventListener('input', () => { it.w = +rng.value; $('#range-val').textContent = `${it.w} cm`; renderItems(); renderSelection(); });
    rng.addEventListener('change', () => { renderPanel(); commit(); });
    for (const b of panel.querySelectorAll('[data-len]')) b.onclick = () => { it.w = +b.dataset.len; renderItems(); renderSelection(); renderPanel(); commit(); };
  }
  for (const b of panel.querySelectorAll('[data-rot]')) b.onclick = () => rotateSelected(+b.dataset.rot);
  const setLight = (fn) => { it.o = { ...(it.o || {}) }; fn(it.o); renderItems(); renderSelection(); renderPanel(); commit(); };
  for (const c of panel.querySelectorAll('[data-lopt]')) c.onchange = () => setLight((oo) => { oo[c.dataset.lopt] = c.checked; });
  for (const b of panel.querySelectorAll('[data-lcolor]')) b.onclick = () => setLight((oo) => { oo.color = b.dataset.lcolor; });
  for (const b of panel.querySelectorAll('[data-lcolor2]')) b.onclick = () => setLight((oo) => { oo.color2 = b.dataset.lcolor2; });
  const lc = panel.querySelector('[data-lcolor-custom]'), lc2 = panel.querySelector('[data-lcolor2-custom]');
  if (lc) lc.onchange = () => setLight((oo) => { oo.color = lc.value; });
  if (lc2) lc2.onchange = () => setLight((oo) => { oo.color2 = lc2.value; });
  const lb = panel.querySelector('[data-lbright]');
  if (lb) {
    lb.oninput = () => { $('#lbright-val').textContent = `${lb.value}%`; };
    lb.onchange = () => setLight((oo) => { oo.bright = +lb.value; });
  }
  const ld = panel.querySelector('[data-ldir]');
  if (ld) ld.onchange = () => setLight((oo) => { oo.dir = ld.value; });
  for (const sel of panel.querySelectorAll('[data-oselect]')) sel.onchange = () => {
    it.o = { ...(it.o || {}), [sel.dataset.oselect]: sel.value };
    renderItems(); renderSelection(); renderPanel(); commit();
  };
  for (const b of panel.querySelectorAll('[data-side]')) b.onclick = () => {
    it.o = { ...(it.o || {}), mirror: b.dataset.side === 'left' };
    renderItems(); renderSelection(); renderPanel(); commit();
  };
  for (const c of panel.querySelectorAll('[data-opt]')) c.onchange = () => {
    it.o = { ...(it.o || {}), [c.dataset.opt]: c.checked };
    renderItems(); renderSelection(); commit();
  };
  $('#prop-color').addEventListener('input', (e) => { it.c = e.target.value; updateColor(it); });
  $('#prop-color').addEventListener('change', () => { renderItems(); commit(); });
  $('#prop-color-reset').onclick = () => { delete it.c; renderItems(); renderPanel(); commit(); };
  $('#prop-dup').onclick = duplicateSelected;
  $('#prop-del').onclick = removeSelected;
}

function updateColor(it) {
  const g = svg.querySelector(`.item[data-id="${it.id}"]`);
  if (g) g.style.setProperty('--fill', it.c);
}

function renderPanelApartment() {
  let h = `<div class="panel-head"><div><div class="eyebrow">Mieszkanie</div><h2>${esc(PLAN.title)}</h2></div></div>`;
  h += `<p class="muted">${esc(PLAN.subtitle)} · wysokość ${(PLAN.height / 100).toFixed(2).replace('.', ',')} m</p>`;
  h += `<table class="rooms">`;
  for (const r of PLAN.rooms) h += `<tr><td class="n">${r.n}</td><td>${esc(r.name)}</td><td class="a">${r.area.toFixed(2).replace('.', ',')} m²</td></tr>`;
  h += `<tr class="sum"><td></td><td>Pow. mieszkania</td><td class="a">${PLAN.area.toFixed(2).replace('.', ',')} m²</td></tr>`;
  h += `<tr><td></td><td>Balkon</td><td class="a">${PLAN.balcony.area.toFixed(2).replace('.', ',')} m²</td></tr></table>`;

  h += finishHtml();
  h += `<h3>Ściany działowe do wyburzenia</h3>`;
  for (const p of PLAN.partitions) {
    h += `<label class="check"><input type="checkbox" data-demo="${p.id}"${doc.demo.includes(p.id) ? ' checked' : ''}> ${esc(p.name)}</label>`;
  }

  h += `<h3>Drzwi</h3><ul class="item-list">`;
  for (const d of PLAN.doors) {
    const opt = doorOptions(doc.doors, d.id);
    h += `<li data-door-select="${d.id}"><span class="dot door-dot"></span>${esc(DOOR_NAMES[d.id])}<span class="muted">${esc(DOOR_TYPES[opt.type].split(' –')[0])}</span></li>`;
  }
  h += `</ul>`;

  const counts = {};
  h += `<h3>Na planie <span class="muted">(${doc.items.length})</span></h3>`;
  if (!doc.items.length) h += `<p class="muted">Przeciągnij elementy z katalogu po lewej na rzut.</p>`;
  h += `<ul class="item-list">`;
  for (const it of doc.items) {
    const def = defOf(it);
    counts[def.cat] = (counts[def.cat] || 0) + 1;
    const clash = clashesOf(it);
    h += `<li data-select="${it.id}"${clash ? ' class="clash"' : ''}><span class="dot cat-${def.cat}"></span>${esc(it.n || def.name)}<span class="muted">${Math.round(it.w)}×${Math.round(it.d)}</span></li>`;
  }
  h += `</ul>`;
  h += `<div class="help"><h3>Skróty</h3><dl>` +
    `<dt>R / Shift R</dt><dd>obrót o 90°</dd><dt>Q / E</dt><dd>obrót o 15°</dd><dt>Strzałki</dt><dd>przesuń o 1 cm (Shift: 10 cm)</dd>` +
    `<dt>Alt + przeciąganie</dt><dd>bez przyciągania</dd><dt>M</dt><dd>miarka</dd><dt>F</dt><dd>dopasuj widok</dd>` +
    `<dt>Spacja / środkowy</dt><dd>przesuwanie widoku</dd><dt>Ctrl Z / Ctrl Y</dt><dd>cofnij / ponów</dd></dl></div>`;
  panel.innerHTML = h;
  for (const c of panel.querySelectorAll('[data-demo]')) c.onchange = () => {
    const id = c.dataset.demo;
    doc.demo = c.checked ? [...doc.demo, id] : doc.demo.filter((x) => x !== id);
    renderStructure(); renderItems(); renderPanel(); commit();
  };
  for (const li of panel.querySelectorAll('[data-select]')) li.onclick = () => select(+li.dataset.select);
  for (const li of panel.querySelectorAll('[data-door-select]')) li.onclick = () => selectDoor(li.dataset.doorSelect);
  bindFinish();
}

// ---------------------------------------------------------------- panel drzwi

function renderPanelDoor() {
  const d = PLAN.doors.find((x) => x.id === selectedDoor);
  const opt = doorOptions(doc.doors, d.id);
  const g = doorGeometry(d, opt);
  const [ux, uy] = dirOf(g.open);
  const into = roomAt(g.hinge[0] + ux * 30, g.hinge[1] + uy * 30);
  const intoName = into ? into.short : (d.entry ? 'klatka schodowa' : '—');
  const sliding = opt.type === 'sliding', none = opt.type === 'none';
  let h = `<div class="panel-head"><div><div class="eyebrow">Drzwi</div><h2>${esc(DOOR_NAMES[d.id])}</h2></div>` +
    `<button class="icon-btn" id="door-close" title="Odznacz (Esc)">✕</button></div>`;
  h += `<p class="muted">Otwór ${Math.round(g.along)} cm · skrzydło ${d.r} cm · wysokość ${PLAN.doorHeight} cm</p>`;
  h += `<div class="field"><span>Typ</span><div class="radio-list">` + Object.entries(DOOR_TYPES).map(([k, l]) =>
    `<label class="check"><input type="radio" name="door-type" value="${k}"${opt.type === k ? ' checked' : ''}> ${esc(l)}</label>`).join('') + `</div></div>`;
  if (!none) {
    h += `<div class="field"><span>${sliding ? 'Skrzydło przesuwa się' : 'Otwiera się do'}: <b>${esc(sliding ? `po stronie: ${intoName}` : intoName)}</b></span>` +
      `<div class="door-btns"><button class="btn" data-flip="hinge">⇄ ${sliding ? 'Przesuw w drugą stronę' : 'Zawiasy na drugą stronę'}</button>` +
      `<button class="btn" data-flip="swing">⇅ ${sliding ? 'Na drugą stronę ściany' : 'Otwieranie do drugiego pomieszczenia'}</button></div></div>`;
  }
  if (opt.type === 'hidden') {
    h += `<p class="note">Drzwi ukryte są zlicowane ze ścianą, bez opasek i ościeżnicy; skrzydło malowane kolorem ścian po obu stronach (zmienisz go w sekcji Wykończenie).</p>`;
  } else if (!none) {
    h += `<div class="finish-label">Skrzydło · <b>${esc(DOOR_FINISHES[opt.finish].name)}</b></div><div class="swatches">` +
      Object.entries(DOOR_FINISHES).map(([k, f]) => `<button class="swatch${opt.finish === k ? ' on' : ''}" style="--c:${f.hex}" data-finish="${k}" title="${esc(f.name)}"></button>`).join('') + `</div>`;
  }
  if (!none) {
    const closed = isClosed(opt);
    h += `<div class="field"><span>W widoku 3D</span><div class="seg"><button data-closed="0" class="${closed ? '' : 'on'}">otwarte</button><button data-closed="1" class="${closed ? 'on' : ''}">zamknięte</button></div></div>`;
  }
  h += `<div class="actions"><button class="btn" id="door-reset">Przywróć jak na rzucie</button></div>`;
  panel.innerHTML = h;

  const setDoor = (fn) => {
    const cur = { ...doorOptions(doc.doors, d.id), ...(doc.doors[d.id] || {}) };
    fn(cur);
    doc.doors = normalizeDoors({ ...doc.doors, [d.id]: cur });
    renderStructure(); renderPanel(); commit();
  };
  $('#door-close').onclick = () => select(null);
  for (const r of panel.querySelectorAll('[name="door-type"]')) r.onchange = () => setDoor((o) => { o.type = r.value; delete o.closed; });
  for (const b of panel.querySelectorAll('[data-flip]')) b.onclick = () => setDoor((o) => { if (b.dataset.flip === 'hinge') o.flipHinge = !o.flipHinge; else o.flipSwing = !o.flipSwing; });
  for (const b of panel.querySelectorAll('[data-finish]')) b.onclick = () => setDoor((o) => { o.finish = b.dataset.finish; });
  for (const b of panel.querySelectorAll('[data-closed]')) b.onclick = () => setDoor((o) => { o.closed = b.dataset.closed === '1'; });
  $('#door-reset').onclick = () => { const next = { ...doc.doors }; delete next[d.id]; doc.doors = next; renderStructure(); renderPanel(); commit(); };
}

// ---------------------------------------------------------------- wykończenie (kolory ścian, posadzki…)

let finishRoom = '1';
const SIDES = [['', 'brak'], ['n', 'północna ↑'], ['s', 'południowa ↓'], ['w', 'zachodnia ←'], ['e', 'wschodnia →']];

function swatches(list, current, attr) {
  let h = `<div class="swatches">`;
  for (const c of list) h += `<button class="swatch${c.hex === current ? ' on' : ''}" style="--c:${c.hex}" ${attr}="${c.hex}" title="${esc(c.name)}"></button>`;
  const custom = !list.some((c) => c.hex === current);
  h += `<label class="swatch custom${custom ? ' on' : ''}" title="Własny kolor" style="--c:${custom ? current : '#ffffff'}"><input type="color" ${attr}-custom value="${current}"></label></div>`;
  return h;
}

function finishHtml() {
  const st = doc.style;
  const room = PLAN.rooms.find((r) => String(r.n) === finishRoom);
  let h = `<h3>Wykończenie</h3><div class="room-tabs">`;
  for (const r of PLAN.rooms) h += `<button class="${String(r.n) === finishRoom ? 'on' : ''}" data-froom="${r.n}">${esc(r.short)}</button>`;
  h += `</div>`;
  h += `<div class="finish-label">Ściany · <b>${esc(paletteName(st.walls[finishRoom]))}</b></div>`;
  h += swatches(WALL_PALETTE, st.walls[finishRoom], 'data-wall');
  h += `<label class="field"><span>Posadzka</span><select data-floor>` +
    Object.entries(FLOORS).map(([k, f]) => `<option value="${k}"${st.floors[finishRoom] === k ? ' selected' : ''}>${esc(f.name)}</option>`).join('') + `</select></label>`;
  const acc = st.accent && st.accent.room === finishRoom ? st.accent : null;
  h += `<div class="field"><span>Ściana akcentowa w: ${esc(room.short)}</span><div class="accent-row"><select data-accent-side>` +
    SIDES.map(([k, l]) => `<option value="${k}"${(acc ? acc.side : '') === k ? ' selected' : ''}>${l}</option>`).join('') +
    `</select><input type="color" data-accent-color value="${acc ? acc.color : '#2f4f40'}"${acc ? '' : ' disabled'}></div></div>`;
  h += `<button class="link-btn" data-walls-all>Ten kolor ścian we wszystkich pomieszczeniach</button>`;
  h += `<div class="finish-label">Fronty kuchenne · <b>${esc(paletteName(st.kitchenFront))}</b></div>`;
  h += swatches(FRONTS, st.kitchenFront, 'data-front');
  h += `<div class="grid2">` +
    `<label class="field"><span>Blat</span><select data-counter>${Object.entries(COUNTERS).map(([k, c]) => `<option value="${k}"${st.counter === k ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` +
    `<label class="field"><span>Ramy okien</span><select data-frames>${Object.entries(FRAMES).map(([k, c]) => `<option value="${k}"${st.frames === k ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` +
    `</div>`;
  h += `<label class="field"><span>Posadzka balkonu</span><select data-balcony>` +
    Object.entries(FLOORS).map(([k, f]) => `<option value="${k}"${st.balcony === k ? ' selected' : ''}>${esc(f.name)}</option>`).join('') + `</select></label>`;
  return h;
}

function setStyle(fn) {
  fn(doc.style);
  sync3d();
  renderPanel();
  commit();
}

function bindFinish() {
  const p = panel;
  for (const b of p.querySelectorAll('[data-froom]')) b.onclick = () => { finishRoom = b.dataset.froom; renderPanel(); };
  for (const b of p.querySelectorAll('[data-wall]')) b.onclick = () => setStyle((st) => { st.walls[finishRoom] = b.dataset.wall; });
  const wc = p.querySelector('[data-wall-custom]');
  if (wc) {
    wc.addEventListener('input', () => { doc.style.walls[finishRoom] = wc.value; wc.parentElement.style.setProperty('--c', wc.value); sync3d(); });
    wc.addEventListener('change', () => setStyle(() => {}));
  }
  for (const b of p.querySelectorAll('[data-front]')) b.onclick = () => setStyle((st) => { st.kitchenFront = b.dataset.front; });
  const fc = p.querySelector('[data-front-custom]');
  if (fc) {
    fc.addEventListener('input', () => { doc.style.kitchenFront = fc.value; fc.parentElement.style.setProperty('--c', fc.value); sync3d(); });
    fc.addEventListener('change', () => setStyle(() => {}));
  }
  const sel = (q, fn) => { const el = p.querySelector(q); if (el) el.onchange = () => setStyle((st) => fn(st, el.value)); };
  sel('[data-floor]', (st, v) => { st.floors[finishRoom] = v; });
  sel('[data-counter]', (st, v) => { st.counter = v; });
  sel('[data-frames]', (st, v) => { st.frames = v; });
  sel('[data-balcony]', (st, v) => { st.balcony = v; });
  const side = p.querySelector('[data-accent-side]'), acol = p.querySelector('[data-accent-color]');
  side.onchange = () => setStyle((st) => {
    if (!side.value) { if (st.accent && st.accent.room === finishRoom) delete st.accent; return; }
    st.accent = { room: finishRoom, side: side.value, color: acol.value };
  });
  acol.addEventListener('input', () => { if (doc.style.accent) { doc.style.accent.color = acol.value; sync3d(); } });
  acol.addEventListener('change', () => setStyle(() => {}));
  const all = p.querySelector('[data-walls-all]');
  if (all) all.onclick = () => setStyle((st) => { for (const k of Object.keys(st.walls)) st.walls[k] = st.walls[finishRoom]; });
}

// ---------------------------------------------------------------- katalog

function renderCatalog(filter = '') {
  const q = filter.trim().toLowerCase();
  const box = $('#catalog');
  let h = '';
  for (const cat of CATEGORIES) {
    const items = CATALOG.filter((c) => c.cat === cat.id && (!q || c.name.toLowerCase().includes(q)));
    if (!items.length) continue;
    const open = q || settings.catOpen[cat.id] !== false;
    h += `<details class="cat" data-cat="${cat.id}"${open ? ' open' : ''}><summary>${esc(cat.name)} <span class="muted">${items.length}</span></summary><div class="cards">`;
    for (const c of items) {
      const v = c.variants ? c.variants[c.defaultVariant ?? 0] : null;
      const w = v ? v.w : c.w, d = v ? v.d : c.d;
      const sz = c.range ? `${c.range.min}–${c.range.max} × ${d}` : c.square ? `Ø ${w}` : `${w} × ${d}`;
      h += `<div class="card cat-${c.cat}" data-key="${c.key}" title="Przeciągnij na plan lub kliknij, aby dodać">` +
        (c.finishes
          ? `<svg class="thumb" viewBox="0 0 60 40" preserveAspectRatio="xMidYMid meet">${slatThumb(c)}</svg>`
          : `<svg class="thumb" viewBox="${-w / 2 - 6} ${-d / 2 - 6} ${w + 12} ${d + 12}" preserveAspectRatio="xMidYMid meet"><g class="item cat-${c.cat}">${drawShape({ w, d, o: { ...(c.opts || {}), chairs: false } }, c)}</g></svg>`) +
        `<div class="card-text"><div class="card-name">${esc(c.name)}</div><div class="card-size">${c.hint ? esc(c.hint) : `${sz} cm${c.variants ? ` · ${c.variants.length} warianty` : ''}`}</div></div></div>`;
    }
    h += `</div></details>`;
  }
  box.innerHTML = h || '<p class="muted pad">Brak wyników.</p>';
  for (const d of box.querySelectorAll('details')) d.addEventListener('toggle', () => {
    if (q) return;
    settings.catOpen[d.dataset.cat] = d.open; saveSettings();
  });
  for (const card of box.querySelectorAll('.card')) card.addEventListener('pointerdown', onCardPointerDown);
}

let catDrag = null;

function onCardPointerDown(e) {
  if (e.button !== 0) return;
  const key = e.currentTarget.dataset.key;
  catDrag = { key, sx: e.clientX, sy: e.clientY, started: false, item: null, touch: e.pointerType === 'touch' };
  if (!catDrag.touch) e.preventDefault();
  window.addEventListener('pointermove', onCatMove);
  window.addEventListener('pointerup', onCatUp, { once: true });
  window.addEventListener('pointercancel', onCatCancel, { once: true });
}

function overCanvas(x, y) {
  const r = svg.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function onCatMove(e) {
  if (!catDrag) return;
  if (!catDrag.started) {
    if (catDrag.touch) return; // na dotyku katalog przewija się, element dodaje się kliknięciem
    if (Math.hypot(e.clientX - catDrag.sx, e.clientY - catDrag.sy) < 5) return;
    catDrag.started = true;
    document.body.classList.add('dragging');
  }
  if (overCanvas(e.clientX, e.clientY)) {
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    if (!catDrag.item) {
      catDrag.item = makeItem(catDrag.key, wx, wy);
      doc.items.push(catDrag.item);
      selectedId = catDrag.item.id;
      renderItems(); renderPanel();
    }
    const p = e.altKey ? { x: Math.round(wx), y: Math.round(wy) } : snapPosition(catDrag.item, wx, wy);
    catDrag.item.x = p.x; catDrag.item.y = p.y;
    updateItemNode(catDrag.item); renderSelection();
  } else if (catDrag.item) {
    doc.items = doc.items.filter((i) => i !== catDrag.item);
    catDrag.item = null; selectedId = null;
    renderItems(); renderSelection(); renderPanel();
  }
}

function onCatUp(e) {
  window.removeEventListener('pointermove', onCatMove);
  window.removeEventListener('pointercancel', onCatCancel);
  document.body.classList.remove('dragging');
  const d = catDrag; catDrag = null;
  if (!d) return;
  if (!d.started) {
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 8) addItemAtCenter(d.key);
    return;
  }
  if (d.item) { renderItems(); renderPanel(); commit(); }
}

function onCatCancel() {
  window.removeEventListener('pointermove', onCatMove);
  document.body.classList.remove('dragging');
  if (catDrag && catDrag.item) { doc.items = doc.items.filter((i) => i !== catDrag.item); selectedId = null; renderAll(); }
  catDrag = null;
}

// ---------------------------------------------------------------- interakcja z planem

const pointers = new Map();
let drag = null; // { type: 'move'|'rotate'|'pan'|'pinch'|'measure', ... }
let spaceDown = false;

svg.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    drag = { type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    return;
  }
  if (pointers.size > 2) return;
  svg.setPointerCapture(e.pointerId);
  const [wx, wy] = toWorld(e.clientX, e.clientY);

  if (e.button === 1 || spaceDown || e.button === 2) {
    drag = { type: 'pan', sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty, moved: false };
    e.preventDefault();
    return;
  }
  if (mode === 'measure') {
    measure = { a: [Math.round(wx), Math.round(wy)], b: [Math.round(wx), Math.round(wy)] };
    drag = { type: 'measure' };
    renderMeasure();
    return;
  }
  const handle = e.target.closest('[data-handle="rotate"]');
  const itemEl = e.target.closest('.item[data-id]');
  if (handle && getItem(selectedId)) {
    const it = getItem(selectedId);
    if (it.o && it.o.lock) return;
    drag = { type: 'rotate', it, start: it.r };
    return;
  }
  if (itemEl) {
    const it = getItem(+itemEl.dataset.id);
    if (selectedId !== it.id) select(it.id);
    if (it.o && it.o.lock) { drag = { type: 'pan', sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty, moved: false }; return; }
    drag = { type: 'move', it, ox: wx - it.x, oy: wy - it.y, sx: e.clientX, sy: e.clientY, moved: false };
    return;
  }
  const doorEl = e.target.closest('[data-door]');
  if (doorEl) {
    if (selectedDoor !== doorEl.dataset.door) selectDoor(doorEl.dataset.door);
    drag = { type: 'pan', sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty, moved: false };
    return;
  }
  drag = { type: 'pan', sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty, moved: false, deselect: true };
});

svg.addEventListener('pointermove', (e) => {
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  $('#cursor-pos').textContent = `x ${Math.round(wx)} · y ${Math.round(wy)} cm`;
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!drag) return;
  if (drag.type === 'pinch') {
    if (pointers.size < 2) return;
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const r = svg.getBoundingClientRect();
    view.tx += cx - drag.cx; view.ty += cy - drag.cy;
    zoomAt(dist / drag.dist, cx - r.left, cy - r.top);
    drag.dist = dist; drag.cx = cx; drag.cy = cy;
    return;
  }
  if (drag.type === 'pan') {
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (Math.hypot(dx, dy) > 3) drag.moved = true;
    view.tx = drag.tx + dx; view.ty = drag.ty + dy;
    applyView();
    return;
  }
  if (drag.type === 'measure') {
    let [bx, by] = [Math.round(wx), Math.round(wy)];
    if (e.shiftKey) { if (Math.abs(bx - measure.a[0]) > Math.abs(by - measure.a[1])) by = measure.a[1]; else bx = measure.a[0]; }
    measure.b = [bx, by];
    renderMeasure();
    return;
  }
  if (drag.type === 'move') {
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
    drag.moved = true;
    const it = drag.it;
    const p = e.altKey ? { x: Math.round(wx - drag.ox), y: Math.round(wy - drag.oy) } : snapPosition(it, wx - drag.ox, wy - drag.oy);
    it.x = p.x; it.y = p.y;
    updateItemNode(it); renderSelection();
    return;
  }
  if (drag.type === 'rotate') {
    const it = drag.it;
    let a = (Math.atan2(wy - it.y, wx - it.x) * 180) / Math.PI + 90;
    a = e.shiftKey ? Math.round(a) : Math.round(a / 15) * 15;
    it.r = norm360(a);
    updateItemNode(it); renderSelection();
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (!drag) return;
  if (drag.type === 'pinch') { if (pointers.size === 0) drag = null; return; }
  const d = drag; drag = null;
  if (d.type === 'pan' && d.deselect && !d.moved) select(null);
  if (d.type === 'move' && d.moved) { renderItems(); renderPanel(); commit(); }
  if (d.type === 'rotate') { renderItems(); renderPanel(); commit(); }
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);
svg.addEventListener('contextmenu', (e) => e.preventDefault());
svg.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = svg.getBoundingClientRect();
  const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
  zoomAt(factor, e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

function setMode(m) {
  mode = m;
  document.body.classList.toggle('mode-measure', m === 'measure');
  $('#btn-measure').classList.toggle('active', m === 'measure');
  if (m !== 'measure') { measure = null; renderMeasure(); }
}

window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  if ($('.modal:not([hidden])')) { if (e.key === 'Escape') closeModals(); return; }
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return; }
  if (ctrl) return;
  if (e.key === ' ') { spaceDown = true; document.body.classList.add('panning'); e.preventDefault(); return; }
  if (e.key === 'Escape') { if (mode === 'measure') setMode('select'); else select(null); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); return; }
  const k = e.key.toLowerCase();
  if (k === 'r') { rotateSelected(e.shiftKey ? -90 : 90); return; }
  if (k === 'q') { rotateSelected(-15); return; }
  if (k === 'e') { rotateSelected(15); return; }
  if (k === 'm') { setMode(mode === 'measure' ? 'select' : 'measure'); return; }
  if (k === 'f') { fitView(); return; }
  if (k === '+' || k === '=') { const r = svg.getBoundingClientRect(); zoomAt(1.2, r.width / 2, r.height / 2); return; }
  if (k === '-') { const r = svg.getBoundingClientRect(); zoomAt(1 / 1.2, r.width / 2, r.height / 2); return; }
  const step = e.shiftKey ? 10 : 1;
  const arrows = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] };
  if (arrows[k] && selectedId) { e.preventDefault(); nudgeSelected(...arrows[k]); }
});
window.addEventListener('keyup', (e) => { if (e.key === ' ') { spaceDown = false; document.body.classList.remove('panning'); } });

// ---------------------------------------------------------------- pasek narzędzi, modale, toasty

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

function openModal(id) { closeModals(); $(id).hidden = false; }
function closeModals() { for (const m of document.querySelectorAll('.modal')) m.hidden = true; }
for (const m of document.querySelectorAll('.modal')) {
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) closeModals(); });
}

function bindToggle(id, key, after) {
  const el = $(id);
  el.checked = !!settings[key];
  el.addEventListener('change', () => { settings[key] = el.checked; saveSettings(); after(); });
}

function setupToolbar() {
  $('#btn-undo').onclick = undo;
  $('#btn-redo').onclick = redo;
  $('#btn-fit').onclick = fitView;
  $('#btn-zoom-in').onclick = () => { const r = svg.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); };
  $('#btn-zoom-out').onclick = () => { const r = svg.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); };
  $('#btn-measure').onclick = () => setMode(mode === 'measure' ? 'select' : 'measure');

  bindToggle('#opt-dims', 'dims', renderDims);
  bindToggle('#opt-labels', 'labels', renderItems);
  bindToggle('#opt-snap', 'snap', () => {});
  bindToggle('#opt-dist', 'dist', renderSelection);
  const ov = $('#opt-overlay');
  ov.value = settings.overlay;
  ov.addEventListener('input', () => { settings.overlay = +ov.value; renderOverlay(); saveSettings(); });

  $('#catalog-search').addEventListener('input', (e) => renderCatalog(e.target.value));

  $('#btn-share').onclick = shareLink;
  $('#btn-projects').onclick = () => { renderProjects(); openModal('#modal-projects'); };
  $('#btn-copy-link').onclick = async () => {
    const input = $('#share-url');
    input.select();
    try { await navigator.clipboard.writeText(input.value); toast('Link skopiowany'); } catch { document.execCommand('copy'); toast('Link skopiowany'); }
  };

  $('#form-save').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#save-name').value.trim();
    if (!name) return;
    store.saveProject(name, exportDoc());
    $('#save-name').value = '';
    renderProjects();
    toast(`Zapisano „${name}”`);
  });
  $('#btn-reset-plan').onclick = () => {
    if (!confirm('Wczytać umeblowanie z rzutu dewelopera? Obecny układ zostanie zastąpiony (można cofnąć Ctrl+Z).')) return;
    replaceDoc({ items: DEFAULT_ITEMS, demo: [] });
    closeModals();
  };
  $('#btn-clear').onclick = () => {
    if (!confirm('Usunąć wszystkie elementy z planu? (można cofnąć Ctrl+Z)')) return;
    replaceDoc({ items: [], demo: doc.demo });
    closeModals();
  };
  $('#btn-export').onclick = () => {
    const blob = new Blob([JSON.stringify(exportDoc(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mieszkanie-${PLAN.id}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#btn-import').onclick = () => $('#file-import').click();
  $('#file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try { replaceDoc(JSON.parse(await file.text())); closeModals(); toast('Zaimportowano projekt'); } catch { toast('Nie udało się odczytać pliku'); }
  });
}

// Podmiana całego dokumentu z zachowaniem historii (da się cofnąć)
function replaceDoc(d) {
  selectedId = null;
  nextId = 1;
  doc = {
    v: 1, plan: PLAN.id,
    items: (d.items || []).map((i) => normalizeItem({ ...i, id: undefined })),
    demo: Array.isArray(d.demo) ? d.demo.filter((id) => PLAN.partitions.some((p) => p.id === id)) : [],
    style: normalizeStyle(d.style),
    doors: normalizeDoors(d.doors),
  };
  renderAll();
  commit();
}

function renderProjects() {
  const list = store.listProjects();
  const box = $('#project-list');
  if (!list.length) { box.innerHTML = '<p class="muted">Brak zapisanych projektów.</p>'; return; }
  box.innerHTML = list.map((p) => `<div class="project-row"><div><b>${esc(p.name)}</b><div class="muted">${new Date(p.savedAt).toLocaleString('pl-PL')} · ${p.count} el.</div></div>` +
    `<div class="row-actions"><button class="btn" data-load="${esc(p.name)}">Wczytaj</button><button class="btn danger" data-del="${esc(p.name)}">Usuń</button></div></div>`).join('');
  for (const b of box.querySelectorAll('[data-load]')) b.onclick = () => {
    const p = list.find((x) => x.name === b.dataset.load);
    replaceDoc(p.doc); closeModals(); toast(`Wczytano „${p.name}”`);
  };
  for (const b of box.querySelectorAll('[data-del]')) b.onclick = () => {
    if (!confirm(`Usunąć projekt „${b.dataset.del}”?`)) return;
    store.deleteProject(b.dataset.del); renderProjects();
  };
}

async function shareLink() {
  const code = await encodeDoc(exportDoc());
  const url = buildShareUrl(code);
  $('#share-url').value = url;
  $('#share-len').textContent = `${url.length} znaków`;
  openModal('#modal-share');
  $('#share-url').select();
}

async function loadFromHash() {
  const code = readHashCode();
  if (!code) return false;
  try {
    const d = await decodeDoc(code);
    const prev = store.loadCurrent();
    if (!shotMode && prev && prev.items && prev.items.length) {
      const stamp = new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
      store.saveProject(`Kopia przed otwarciem linku ${stamp}`, prev);
    }
    loadDoc(d);
    if (shotMode) return true;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    toast('Wczytano projekt z linku (poprzedni układ zapisano w Projektach)');
    return true;
  } catch (err) {
    console.error(err);
    toast('Link jest uszkodzony – nie udało się wczytać projektu');
    return false;
  }
}

window.addEventListener('hashchange', () => { loadFromHash(); });

// ---------------------------------------------------------------- widok 3D

let view3d = null;
let is3D = false;

function sync3d() { if (view3d && is3D) view3d.setData(doc, doc.style); }

async function setViewMode(m) {
  is3D = m === '3d';
  document.body.classList.toggle('mode-3d', is3D);
  for (const b of document.querySelectorAll('[data-viewmode]')) b.classList.toggle('on', b.dataset.viewmode === m);
  if (!shotMode) { settings.view = m; saveSettings(); }
  if (!is3D) { if (view3d) view3d.stop(); return; }
  if (!view3d) {
    $('#loading3d').hidden = false;
    try {
      const { View3D } = await import('./view3d.js');
      view3d = new View3D($('#stage3d'), {
        onSelect: (id) => select(id),
        onSelectDoor: (id) => selectDoor(id),
        onMove: (it, x, y, alt) => {
          const p = alt ? { x: Math.round(x), y: Math.round(y) } : snapPosition(it, x, y);
          it.x = p.x; it.y = p.y;
          renderPanelPosition();
        },
        onCommit: () => { renderItems(); renderSelection(); renderPanel(); commit(); },
      });
      view3d.setOption('ao', settings.ao !== false);
      view3d.setTimeOfDay(hashParams.t || (shotMode ? 'day' : settings.tod) || 'day');
      for (const b of document.querySelectorAll('[data-tod]')) b.classList.toggle('on', b.dataset.tod === view3d.tod);
      view3d.setOption('cut', !shotMode && !!settings.cut);
      const cam = hashParams.cam || settings.cam || 'top';
      view3d.setCamera(cam, false);
      $('#cam3d').value = view3d.cameraId;
    } catch (err) {
      console.error(err);
      $('#loading3d').hidden = true;
      toast('Nie udało się wczytać widoku 3D – sprawdź połączenie z internetem');
      setViewMode('2d');
      return;
    }
    $('#loading3d').hidden = true;
  }
  if (!is3D) return;
  view3d.setData(doc, doc.style);
  view3d.setSelected(selectedId);
  view3d.setSelectedDoor(selectedDoor);
  view3d.resize();
  view3d.start();
}

function setup3dToolbar() {
  for (const b of document.querySelectorAll('[data-viewmode]')) b.onclick = () => setViewMode(b.dataset.viewmode);
  const cam = $('#cam3d');
  cam.innerHTML = PLAN.cameras.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  cam.onchange = () => { settings.cam = cam.value; saveSettings(); if (view3d) view3d.setCamera(cam.value); };
  for (const b of document.querySelectorAll('[data-tod]')) b.onclick = () => {
    settings.tod = b.dataset.tod; saveSettings();
    for (const x of document.querySelectorAll('[data-tod]')) x.classList.toggle('on', x === b);
    if (view3d) view3d.setTimeOfDay(b.dataset.tod);
  };
  const cut = $('#opt3d-cut'), ao = $('#opt3d-ao');
  cut.checked = !!settings.cut;
  ao.checked = settings.ao !== false;
  cut.onchange = () => { settings.cut = cut.checked; saveSettings(); if (view3d) view3d.setOption('cut', cut.checked); };
  ao.onchange = () => { settings.ao = ao.checked; saveSettings(); if (view3d) view3d.setOption('ao', ao.checked); };
  $('#btn-shot').onclick = () => {
    if (!view3d) return;
    const a = document.createElement('a');
    a.href = view3d.snapshot(1920, 1080);
    a.download = `wizualizacja-${PLAN.id}-${view3d.cameraId}.png`;
    a.click();
  };
}

// Dostęp dla skryptów (skill /wizualizacja) i debugowania w konsoli
window.__hp = {
  get doc() { return exportDoc(); },
  get view3d() { return view3d; },
  setViewMode,
  snapshot: (w, h) => view3d && view3d.snapshot(w, h),
  setCamera: (id) => view3d && view3d.setCamera(id, false),
};

// ---------------------------------------------------------------- start

async function init() {
  if (shotMode) document.body.classList.add('shot');
  setupToolbar();
  setup3dToolbar();
  renderCatalog();
  const fromHash = await loadFromHash();
  if (!fromHash) {
    const saved = store.loadCurrent();
    loadDoc(saved && saved.plan === PLAN.id ? saved : { items: DEFAULT_ITEMS, demo: [] });
  }
  fitView();
  new ResizeObserver(() => { if (!svg.dataset.userZoomed) fitView(); }).observe(svg);
  svg.addEventListener('wheel', () => { svg.dataset.userZoomed = '1'; }, { once: true });
  svg.addEventListener('pointerdown', () => { svg.dataset.userZoomed = '1'; }, { once: true });
  if (shotMode || hashParams.v === '3d' || settings.view === '3d') await setViewMode('3d');
  if (shotMode) {
    // tryb zrzutu: sygnał gotowości po kilku wyrenderowanych klatkach
    const wait = () => new Promise((r) => requestAnimationFrame(r));
    for (let i = 0; i < 6; i++) await wait();
    document.title = 'READY';
    window.__shotReady = true;
  }
}

init();
