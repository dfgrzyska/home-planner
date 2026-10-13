// Widok 3D lokalu (Three.js). Jednostki sceny: metry; plan (x, y) cm → scena (x/100, wysokość/100, y/100).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PLAN } from './plan.js';
import { CATALOG_BY_KEY } from './catalog.js';
import { FLOORS, COUNTERS, FRAMES } from './style.js';
import { floorCanvas } from './textures.js';
import { buildFurniture, elevationOf, mat } from './furniture3d.js';
import { doorOptions, doorGeometry, dirOf, isClosed, DOOR_FINISHES } from './doors.js';

const M = 0.01;
const REVEAL = '#f1f0ec';
const FACADE = '#e4e1da';
const CAP = '#3a3a3c';
const CEILING = '#f7f6f3';

const inRect = ([x, y, w, h], px, py) => px >= x && px <= x + w && py >= y && py <= y + h;

// ---------------------------------------------------------------- światło sztuczne i pora dnia

// Skala źródeł: lumeny → kandele dopasowane do jasności dziennej sceny (oświetlenie dzienne ma tu wartości ~1–3)
const LIGHT_K = 0.02;
const SHADOW_BUDGET = 8; // liczba świateł z cieniami (limit jednostek tekstur w shaderze)

export const TIMES = {
  day: { name: 'Dzień', bg: '#dfe6ea', hemi: ['#ffffff', '#d6c9b5', 1.1], sun: 2.6, env: 0.55, exposure: 1.05, glow: 0.35 },
  evening: { name: 'Wieczór', bg: '#27324d', hemi: ['#6d7fae', '#3a2f2a', 0.16], sun: 0, env: 0.07, exposure: 1.7, glow: 0.8 },
  night: { name: 'Noc', bg: '#060a12', hemi: ['#33456e', '#141210', 0.055], sun: 0, env: 0.02, exposure: 2.5, glow: 1 },
};

const glowTexCache = new Map();
// Tekstura poświaty: kolor przechodzi z color w color2 wzdłuż x; shape: box (aureola), up / down (zanik w pionie)
function glowTexture(shape, color, color2, vertical) {
  const key = [shape, color, color2, vertical].join('|');
  if (glowTexCache.has(key)) return glowTexCache.get(key);
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const c1 = new THREE.Color(color), c2 = new THREE.Color(color2 || color);
  const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / (S - 1), v = y / (S - 1);
      let a;
      const ex = sm(0, 0.22, u) * sm(0, 0.22, 1 - u);
      if (shape === 'up') a = ex * Math.pow(v, 2.2);           // jasno przy dolnej krawędzi (v=1), zanik w górę
      else if (shape === 'down') a = ex * Math.pow(1 - v, 2.2);
      else {
        // miękka elipsa: pełna jasność w środku, łagodny zanik do krawędzi
        const dd = Math.hypot((u - 0.5) / 0.5, (v - 0.5) / 0.5);
        a = Math.pow(1 - sm(0.05, 1, dd), 1.6);
      }
      const t = vertical ? 1 - v : u;
      const col = c1.clone().lerp(c2, t);
      const i = (y * S + x) * 4;
      img.data[i] = col.r * 255; img.data[i + 1] = col.g * 255; img.data[i + 2] = col.b * 255; img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  glowTexCache.set(key, tex);
  return tex;
}


// ---------------------------------------------------------------- konstrukcja

function collectSolids(doc, cut) {
  const H = PLAN.height;
  const top = cut ? Math.min(cut, H) : H;
  const solids = [];
  const add = (rect, y0, y1, kind) => {
    y1 = Math.min(y1, top);
    if (y1 - y0 > 0.1) solids.push({ rect, y0, y1, kind });
  };
  for (const r of PLAN.walls) add(r, 0, H, 'wall');
  for (const r of PLAN.bathWalls) add(r, 0, H, 'wall');
  for (const r of PLAN.context) add(r, 0, H, 'ctx');
  for (const p of PLAN.partitions) if (!doc.demo.includes(p.id)) for (const r of p.rects) add(r, 0, H, 'wall');
  for (const w of PLAN.windows) {
    if (w.sill > 0) add(w.rect, 0, w.sill, 'wall');
    add(w.rect, w.head, H, 'wall');
  }
  const hidden = PLAN.partitions.filter((p) => p.door && doc.demo.includes(p.id)).map((p) => p.door);
  for (const d of PLAN.doors) if (!hidden.includes(d.id)) add(d.gap, PLAN.doorHeight, H, 'wall');
  if (!cut) add(PLAN.soffit.rect, PLAN.soffit.height, H, 'soffit');
  return solids;
}

function regionAt(x, y) {
  for (const r of PLAN.rooms) for (const f of r.floor) if (inRect(f, x, y)) return String(r.n);
  for (const w of PLAN.windows) if (inRect(w.rect, x, y)) return 'gap';
  for (const d of PLAN.doors) if (inRect(d.gap, x, y) && d.gap[0] < 0) return 'gap';
  if (x > 0 && x < 771 && y > 0 && y < 866) {
    // np. miejsce po wyburzonej ścianie albo otwór drzwiowy w środku lokalu – najbliższe pomieszczenie
    let best = null, bd = Infinity;
    for (const r of PLAN.rooms) for (const [fx, fy, fw, fh] of r.floor) {
      const dx = Math.max(fx - x, 0, x - fx - fw), dy = Math.max(fy - y, 0, y - fy - fh);
      const dd = Math.hypot(dx, dy);
      if (dd < bd) { bd = dd; best = String(r.n); }
    }
    return best;
  }
  for (const r of PLAN.balcony.rects) if (inRect(r, x, y)) return 'out';
  return 'out';
}

function subtract(range, covers) {
  let parts = [range];
  for (const [a, b] of covers) {
    const next = [];
    for (const [p, q] of parts) {
      if (b <= p || a >= q) { next.push([p, q]); continue; }
      if (a > p) next.push([p, a]);
      if (b < q) next.push([b, q]);
    }
    parts = next;
  }
  return parts.filter(([p, q]) => q - p > 0.2);
}

class QuadBatch {
  constructor() { this.groups = new Map(); }
  add(key, pts, n) {
    if (!this.groups.has(key)) this.groups.set(key, { pos: [], nor: [] });
    const g = this.groups.get(key);
    const [a, b, c, d] = pts;
    // kolejność wierzchołków zgodna z normalną
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    const tri = flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
    for (const p of tri) { g.pos.push(p[0] * M, p[1] * M, p[2] * M); g.nor.push(...n); }
  }
  meshes(materialFor) {
    const out = [];
    for (const [key, g] of this.groups) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
      const { material, cast } = materialFor(key);
      const m = new THREE.Mesh(geo, material);
      m.castShadow = cast; m.receiveShadow = true;
      out.push(m);
    }
    return out;
  }
}

// Kolor lica ściany: region po stronie lica + strona bryły (lico 'n' bryły to ściana południowa pokoju powyżej)
const ROOM_SIDE = { n: 's', s: 'n', e: 'w', w: 'e' };
function wallColor(style, region, side) {
  if (region === 'gap') return REVEAL;
  if (region === 'out' || region == null) return FACADE;
  const accent = style.accent;
  if (accent && accent.room === region && accent.side === ROOM_SIDE[side]) return accent.color;
  return style.walls[region] || REVEAL;
}

function wallFaces(doc, style, cut) {
  const solids = collectSolids(doc, cut);
  const batch = new QuadBatch();
  const colorFor = (region, side) => wallColor(style, region, side);
  const STEP = 2;
  for (const S of solids) {
    const [x, y, w, h] = S.rect;
    const faces = [
      { side: 'n', len: w, at: (t) => [x + t, y], out: [0, -1] },
      { side: 's', len: w, at: (t) => [x + t, y + h], out: [0, 1] },
      { side: 'w', len: h, at: (t) => [x, y + t], out: [-1, 0] },
      { side: 'e', len: h, at: (t) => [x + w, y + t], out: [1, 0] },
    ];
    for (const f of faces) {
      const n = Math.max(1, Math.round(f.len / STEP));
      const cell = f.len / n;
      let run = null;
      const flush = (endT) => {
        if (!run) return;
        const [ax, ay] = f.at(run.t0), [bx, by] = f.at(endT);
        for (const [h0, h1] of run.vis) {
          const pts = [[ax, h0, ay], [bx, h0, by], [bx, h1, by], [ax, h1, ay]];
          batch.add(`${run.color}|${S.kind}`, pts, [f.out[0], 0, f.out[1]]);
        }
        run = null;
      };
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) * cell;
        const [px, py] = f.at(t);
        const sx = px + f.out[0] * 1.5, sy = py + f.out[1] * 1.5;
        const covers = [];
        for (const o of solids) if (o !== S && inRect(o.rect, sx, sy)) covers.push([o.y0, o.y1]);
        const vis = subtract([S.y0, S.y1], covers);
        const color = S.kind === 'ctx' ? '#b9b7b2' : colorFor(regionAt(sx, sy), f.side);
        const sig = color + JSON.stringify(vis);
        if (run && run.sig === sig) continue;
        flush(i * cell);
        if (vis.length) run = { t0: i * cell, sig, vis, color };
      }
      flush(f.len);
    }
    // wierzch (przekrój) i spód (nadproża, obniżenie sufitu)
    const top = [[x, S.y1, y], [x + w, S.y1, y], [x + w, S.y1, y + h], [x, S.y1, y + h]];
    if (S.kind !== 'soffit') batch.add(`${CAP}|cap`, top, [0, 1, 0]);
    if (S.y0 > 0) {
      const bot = [[x, S.y0, y], [x + w, S.y0, y], [x + w, S.y0, y + h], [x, S.y0, y + h]];
      batch.add(`${S.kind === 'soffit' ? CEILING : REVEAL}|${S.kind}`, bot, [0, -1, 0]);
    }
  }
  return batch.meshes((key) => {
    const [color, kind] = key.split('|');
    const material = mat(color, { rough: 0.92 });
    return { material, cast: true };
  });
}

// ---------------------------------------------------------------- posadzki

const floorTexCache = new Map();
function floorMaterial(key, aniso) {
  if (!floorTexCache.has(key)) {
    const def = FLOORS[key];
    const { canvas, tile } = floorCanvas(def, key.length * 13 + 5);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = aniso;
    const rough = def.kind === 'tiles' ? 0.35 : def.kind === 'concrete' ? 0.75 : def.kind === 'terrazzo' ? 0.3 : 0.55;
    floorTexCache.set(key, { material: new THREE.MeshStandardMaterial({ map: tex, roughness: rough }), tile });
  }
  return floorTexCache.get(key);
}

function floorMesh(rects, key, elev, aniso) {
  const { material, tile } = floorMaterial(key, aniso);
  const pos = [], uv = [], nor = [];
  for (const [x, y, w, h] of rects) {
    const quad = [[x, y], [x, y + h], [x + w, y + h], [x, y], [x + w, y + h], [x + w, y]];
    for (const [px, py] of quad) { pos.push(px * M, elev * M, py * M); uv.push(px / tile, -py / tile); nor.push(0, 1, 0); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const m = new THREE.Mesh(geo, material);
  m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- widok

export class View3D {
  constructor(container, { onSelect, onMove, onCommit, snap }) {
    this.container = container;
    this.cb = { onSelect, onMove, onCommit, snap };
    this.opts = { cut: false, ao: true };
    this.selectedId = null;
    this.dirty = true;

    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    this.renderer = r;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#dfe6ea');
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    this.scene = scene;

    const hemi = new THREE.HemisphereLight('#ffffff', '#d6c9b5', 1.1);
    scene.add(hemi);
    this.hemi = hemi;
    const sun = new THREE.DirectionalLight('#fff4e2', 2.6);
    sun.position.set(4 + 6, 9, 4.5 + 7.5);
    sun.target.position.set(4, 0, 4.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    this.sun = sun;
    r.shadowMap.autoUpdate = false; // scena statyczna – mapy cieni odświeżane tylko po zmianach
    this.shadowDirty = true;
    this.tod = 'day';
    this.lights = [];
    this.glowMats = new Set();

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.addEventListener('change', () => { this.dirty = true; });

    this.structure = new THREE.Group();
    this.furniture = new THREE.Group();
    this.helpers = new THREE.Group();
    scene.add(this.structure, this.furniture, this.helpers);

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(scene, this.camera));
    try {
      this.ao = new GTAOPass(scene, this.camera, 1, 1);
      this.ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1.2, samples: 16 });
      this.ao.blendIntensity = 0.85;
      this.composer.addPass(this.ao);
    } catch (e) { console.warn('GTAO niedostępne', e); this.ao = null; }
    this.composer.addPass(new OutputPass());

    this.raycaster = new THREE.Raycaster();
    this.setupPointer();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.setCamera('top', false);
    this.running = false;
  }

  // ------------------------------------------------ budowanie sceny

  setData(doc, style) {
    const sKey = JSON.stringify([doc.demo, style, doc.doors, this.opts.cut]);
    if (sKey !== this.structKey) { this.structKey = sKey; this.buildStructure(doc, style); }
    const fKey = JSON.stringify([doc.items, style.kitchenFront, style.counter]);
    if (fKey !== this.furnKey) { this.furnKey = fKey; this.buildFurniture(doc, style); }
    this.doc = doc;
    this.style = style;
    this.updateSelection();
    this.dirty = true;
  }

  clear(group) {
    for (const o of [...group.children]) {
      group.remove(o);
      o.traverse((m) => { if (m.isMesh && m.geometry && m.geometry.type === 'BufferGeometry' && !m.geometry.parameters) m.geometry.dispose(); });
    }
  }

  buildStructure(doc, style) {
    this.clear(this.structure);
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    const cut = this.opts.cut ? 110 : 0;
    this.solids = collectSolids(doc, cut);
    for (const m of wallFaces(doc, style, cut)) this.structure.add(m);
    this.shadowDirty = true;
    this.furnKey = null; // poświaty zależą od położenia ścian

    // posadzki: podkład pod całym lokalem (progi, miejsca po ściankach) + pomieszczenia
    this.structure.add(floorMesh(PLAN.floor, style.floors['5'], -0.4, aniso));
    for (const d of PLAN.doors) if (d.gap[0] < 0) this.structure.add(floorMesh([d.gap], style.floors['5'], -0.4, aniso));
    for (const w of PLAN.windows) if (w.sill === 0) this.structure.add(floorMesh([w.rect], style.balcony, -0.6, aniso));
    for (const r of PLAN.rooms) this.structure.add(floorMesh(r.floor, style.floors[String(r.n)], 0, aniso));
    this.structure.add(floorMesh(PLAN.balcony.rects, style.balcony, -2, aniso));

    // sufit (widoczny tylko od spodu)
    if (!cut) {
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(7.71, 8.66), mat(CEILING, { rough: 0.95 }));
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set(7.71 / 2, PLAN.height * M - 0.001, 8.66 / 2);
      ceil.castShadow = true; // słońce wpada tylko przez okna
      this.structure.add(ceil);
    }

    // okna: rama + szyba
    const frameM = mat(FRAMES[style.frames].hex, { rough: 0.5 });
    const glassM = mat('#d4e4ea', { rough: 0.03, opacity: 0.16 });
    for (const w of PLAN.windows) {
      const [x, y, ww, hh] = w.rect;
      const vertical = hh > ww;
      const len = vertical ? hh : ww, depth = vertical ? ww : hh;
      const h0 = w.sill, h1 = Math.min(w.head, cut || 1e9);
      if (h1 <= h0) continue;
      const g = new THREE.Group();
      const add = (lx, ly, lw, lh, ld, material) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(lw * M, lh * M, ld * M), material);
        b.position.set(lx * M, (ly + lh / 2) * M, 0);
        b.castShadow = material !== glassM;
        g.add(b);
      };
      const fw = 6, fd = 7;
      add(0, h0, len, 1.2, 1.2, glassM);
      g.children[0].scale.y = (h1 - h0) / 1.2;
      g.children[0].position.y = ((h0 + h1) / 2) * M;
      add(-len / 2 + fw / 2, h0, fw, h1 - h0, fd, frameM);
      add(len / 2 - fw / 2, h0, fw, h1 - h0, fd, frameM);
      add(0, h1 - fw, len, fw, fd, frameM);
      add(0, h0, len, fw, fd, frameM);
      for (const mx of w.mullions || []) add((vertical ? mx - y : mx - x) - len / 2, h0, 8, h1 - h0, fd, frameM);
      if (w.sill > 0) {
        // parapet wewnętrzny
        const s = new THREE.Mesh(new THREE.BoxGeometry(len * M, 2 * M, 8 * M), mat('#f3f2ee', { rough: 0.4 }));
        s.position.set(0, (w.sill + 1) * M, 0);
        s.castShadow = true;
        g.add(s);
      }
      g.position.set((x + ww / 2) * M, 0, (y + hh / 2) * M);
      if (vertical) g.rotation.y = Math.PI / 2;
      // parapet wystaje do wnętrza: lokalne +z to +x (ściana wschodnia, po obrocie) lub +y (ściana południowa);
      // w obu przypadkach wnętrze lokalu leży po stronie ujemnej
      if (w.sill > 0) {
        const s = g.children[g.children.length - 1];
        s.position.z = -((vertical ? ww : hh) / 2 + 3) * M;
      }
      this.structure.add(g);
    }

    // drzwi wg ustawień: skrzydłowe / ukryte / przesuwne / sam otwór
    this.doorNodes = new Map();
    const hidden = PLAN.partitions.filter((p) => p.door && doc.demo.includes(p.id)).map((p) => p.door);
    for (const d of PLAN.doors) {
      if (hidden.includes(d.id)) continue;
      const node = this.buildDoor(d, doorOptions(doc.doors, d.id), style, cut);
      if (!node) continue;
      node.userData.door = d.id;
      node.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      this.structure.add(node);
      this.doorNodes.set(d.id, node);
    }

    // balustrada balkonu
    const railM = mat('#3b3e42', { rough: 0.4, metal: 0.6 });
    const railGlass = mat('#cfe0e6', { rough: 0.05, opacity: 0.25 });
    for (const [x, y, w, h] of PLAN.balcony.railing) {
      const g1 = new THREE.Mesh(new THREE.BoxGeometry(w * M, 1.0, h * M), railGlass);
      g1.position.set((x + w / 2) * M, 0.5, (y + h / 2) * M);
      const g2 = new THREE.Mesh(new THREE.BoxGeometry((w + 2) * M, 0.04, (h + 2) * M), railM);
      g2.position.set((x + w / 2) * M, 1.1, (y + h / 2) * M);
      g2.castShadow = true;
      this.structure.add(g1, g2);
    }

    // otoczenie: płyta pod budynkiem
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat('#cfccc5', { rough: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(4, -0.3, 4.5);
    ground.receiveShadow = true;
    this.structure.add(ground);
  }

  buildDoor(d, opt, style, cut) {
    if (opt.type === 'none') return null;
    const g = doorGeometry(d, opt);
    const H = Math.min(PLAN.doorHeight - 1, cut || 1e9);
    const group = new THREE.Group();
    const [hx, hy] = g.hinge;
    const [cdx, cdy] = dirOf(g.closed), [odx, ody] = dirOf(g.open);
    const finish = mat(DOOR_FINISHES[opt.finish].hex, { rough: 0.5 });
    const steel = mat('#9a9da1', { rough: 0.3, metal: 0.9 });
    const leafBox = (len, thick, m) => new THREE.Mesh(new THREE.BoxGeometry(len * M, H * M, thick * M), m);

    if (opt.type === 'hidden' && isClosed(opt)) {
      // skrzydło wypełnia otwór na całą grubość ściany, każde lico w kolorze ściany po swojej stronie
      const [gx, gy, gw, gh] = g.gap;
      const cx = gx + gw / 2, cy = gy + gh / 2;
      const face = (px, py, side) => mat(wallColor(style, regionAt(px, py), side), { rough: 0.92 });
      const mats = [
        face(gx + gw + 3, cy, 'e'), face(gx - 3, cy, 'w'), mat(REVEAL), mat(REVEAL),
        face(cx, gy + gh + 3, 's'), face(cx, gy - 3, 'n'),
      ];
      const leaf = new THREE.Mesh(new THREE.BoxGeometry((gw - 0.6) * M, H * M, (gh - 0.6) * M), mats);
      leaf.position.set(cx * M, (H / 2) * M, cy * M);
      const seams = new THREE.LineSegments(new THREE.EdgesGeometry(leaf.geometry), new THREE.LineBasicMaterial({ color: '#9b9b98' }));
      leaf.add(seams);
      group.add(leaf);
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.012), steel);
      k.position.set((hx + cdx * (g.r - 8) + odx * 0.6) * M, 1.0, (hy + cdy * (g.r - 8) + ody * 0.6) * M);
      group.add(k);
      return group;
    }

    if (opt.type === 'sliding') {
      // skrzydło na ścianie po stronie otwierania: odsunięte za zawias (otwarte) albo na otworze (zamknięte)
      const len = g.r + 8, off = 3;
      const closed = isClosed(opt);
      const start = closed ? -4 : -(g.r + 4);
      const mid = start + len / 2;
      const leaf = leafBox(len, 4, finish);
      leaf.position.set((hx + cdx * mid + odx * off) * M, (H / 2 + 1) * M, (hy + cdy * mid + ody * off) * M);
      leaf.rotation.y = (-g.closed * Math.PI) / 180;
      group.add(leaf);
      const railLen = 2 * g.r + 16, rmid = -(g.r + 8) + railLen / 2;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(railLen * M, 0.04, 0.03), mat('#2c2c2e', { rough: 0.4, metal: 0.7 }));
      rail.position.set((hx + cdx * rmid + odx * off) * M, (H + 4) * M, (hy + cdy * rmid + ody * off) * M);
      rail.rotation.y = leaf.rotation.y;
      group.add(rail);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), steel);
      const hpos = start + len - 10;
      handle.position.set((hx + cdx * hpos + odx * (off + 3.5)) * M, 1.0, (hy + cdy * hpos + ody * (off + 3.5)) * M);
      group.add(handle);
      return group;
    }

    // skrzydłowe (oraz ukryte w pozycji otwartej)
    const leafM = opt.type === 'hidden'
      ? mat(wallColor(style, regionAt(hx + odx * 20, hy + ody * 20), 'n'), { rough: 0.92 })
      : finish;
    const closed = isClosed(opt);
    const ang = closed ? g.closed : g.open;
    const [ax, ay] = dirOf(ang);
    const back = closed ? 2 : 0; // zamknięte: skrzydło 2 cm w głąb otworu od lica po stronie otwierania
    const leaf = leafBox(g.r, 4, leafM);
    leaf.position.set((hx + (ax * g.r) / 2 - odx * back) * M, (H / 2) * M, (hy + (ay * g.r) / 2 - ody * back) * M);
    leaf.rotation.y = (-ang * Math.PI) / 180;
    group.add(leaf);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.07), steel);
    handle.position.set((hx + ax * (g.r - 8) - odx * back) * M, 1.0, (hy + ay * (g.r - 8) - ody * back) * M);
    handle.rotation.y = leaf.rotation.y;
    group.add(handle);
    if (opt.type === 'swing') {
      // opaski po obu stronach otworu
      const [gx, gy, gw, gh] = g.gap;
      const vertical = gh > gw;
      const t = 6, depth = (vertical ? gw : gh) + 2, along = vertical ? gh : gw;
      const a0 = vertical ? gy : gx;
      const trim = (a, y0, lw, lh) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry((vertical ? depth : lw) * M, lh * M, (vertical ? lw : depth) * M), finish);
        b.position.set((vertical ? gx + gw / 2 : a) * M, (y0 + lh / 2) * M, (vertical ? a : gy + gh / 2) * M);
        group.add(b);
      };
      trim(a0 - t / 2 + 1, 0, t, H + t);
      trim(a0 + along + t / 2 - 1, 0, t, H + t);
      trim(a0 + along / 2, H, along + 2 * t - 2, t);
    }
    return group;
  }

  setSelectedDoor(id) { this.selectedDoor = id; this.updateSelection(); this.dirty = true; }


  // Zamienia opisy świateł elementu (userData.lights, cm w układzie lokalnym) na światła sceny i poświaty na ścianach
  attachLights(it, inner) {
    for (const o of [...inner.children]) if (o.userData.hueLight) { inner.remove(o); if (o.isMesh) o.geometry.dispose(); }
    const list = inner.userData.lights || [];
    const made = [];
    const rad = (-it.r * Math.PI) / 180;
    for (const L of list) {
      const color = new THREE.Color(L.color);
      if (L.kind === 'point') {
        const l = new THREE.PointLight(color, (L.lm / (4 * Math.PI)) * LIGHT_K, 4.5, 2);
        l.position.set(...L.pos);
        l.userData.lm = L.lm;
        made.push(l);
      } else if (L.kind === 'spot') {
        const half = Math.min(L.angle / 2, 85) * (Math.PI / 180);
        const l = new THREE.SpotLight(color, (L.lm / (2 * Math.PI * (1 - Math.cos(half)))) * LIGHT_K * (L.k ?? 1), 6, half, 0.6, 2);
        l.position.set(...L.pos);
        l.target.position.set(L.pos[0] + L.dir[0] * 100, L.pos[1] + L.dir[1] * 100, L.pos[2] + L.dir[2] * 100);
        l.target.userData.hueLight = true;
        l.userData.lm = L.lm;
        inner.add(l.target);
        made.push(l);
      } else if (L.kind === 'glow') {
        // poświata na najbliższej ścianie za elementem (szukanie w rzucie wzdłuż -z lokalnego)
        const [lx, ly, lz] = L.pos;
        const px = it.x + lx * Math.cos(rad) + lz * Math.sin(rad), py = it.y - lx * Math.sin(rad) + lz * Math.cos(rad);
        const dx = -Math.sin(rad), dy = -Math.cos(rad); // kierunek -z lokalnego w rzucie
        const h = elevationOf(it, CATALOG_BY_KEY[it.t]) + ly;
        const hit = (t) => (this.solids || []).some((s) => h >= s.y0 && h <= s.y1 && inRect(s.rect, px + dx * t, py + dy * t));
        let dist = null;
        for (let t = 0; t <= 120 && dist === null; t += 1) if (hit(t)) dist = t;
        if (dist === null) continue;
        while (dist > 0 && hit(dist - 0.1)) dist -= 0.1; // dokładne lico ściany (krok 1 mm)
        const [sw, sh] = L.size;
        const m = new THREE.MeshBasicMaterial({ map: glowTexture(L.shape, L.color, L.color2, L.vertical), transparent: true, depthWrite: false,
          blending: THREE.AdditiveBlending, opacity: TIMES[this.tod].glow * Math.min(0.75, 0.25 + L.lm / 4000), toneMapped: false });
        m.userData.glowBase = Math.min(0.75, 0.25 + L.lm / 4000);
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), m);
        const cy = L.shape === 'up' ? ly + sh / 2 - 8 : L.shape === 'down' ? ly - sh / 2 + 8 : ly;
        plane.position.set(lx, cy, lz - dist + 0.6); // 6 mm przed licem ściany
        plane.userData.hueLight = true;
        plane.renderOrder = 2;
        inner.add(plane);
        this.glowMats.add(m);
      }
    }
    for (const l of made) { l.userData.hueLight = true; inner.add(l); this.lights.push(l); }
  }

  // Cienie tylko dla najjaśniejszych świateł (budżet tekstur), reszta bez cieni z ograniczonym zasięgiem
  assignShadows() {
    const sorted = [...this.lights].sort((a, b) => b.userData.lm - a.userData.lm);
    sorted.forEach((l, i) => {
      const cast = i < SHADOW_BUDGET;
      l.castShadow = cast;
      if (cast) {
        l.shadow.mapSize.set(1024, 1024);
        l.shadow.bias = -0.004;
        l.shadow.normalBias = 0.06;
        l.shadow.radius = 3;
        l.shadow.camera.near = 0.05;
      }
    });
  }

  setTimeOfDay(mode) {
    const T = TIMES[mode] || TIMES.day;
    this.tod = TIMES[mode] ? mode : 'day';
    this.scene.background = new THREE.Color(T.bg);
    this.hemi.color.set(T.hemi[0]); this.hemi.groundColor.set(T.hemi[1]); this.hemi.intensity = T.hemi[2];
    this.sun.intensity = T.sun; this.sun.visible = T.sun > 0;
    this.scene.environmentIntensity = T.env;
    this.renderer.toneMappingExposure = T.exposure;
    for (const m of this.glowMats) m.opacity = T.glow * (m.userData.glowBase || 1);
    this.shadowDirty = true;
    this.dirty = true;
  }

  buildFurniture(doc, style) {
    this.clear(this.furniture);
    this.lights = [];
    this.glowMats = new Set();
    const st = { kitchenFront: style.kitchenFront, counterHex: COUNTERS[style.counter].hex, counterWood: !!COUNTERS[style.counter].wood };
    this.nodes = new Map();
    for (const it of doc.items) {
      const def = CATALOG_BY_KEY[it.t] || CATALOG_BY_KEY.custom;
      const inner = buildFurniture(it, def, st);
      inner.scale.setScalar(M);
      const g = new THREE.Group();
      g.add(inner);
      g.userData.id = it.id;
      this.placeNode(g, it, def);
      this.furniture.add(g);
      this.nodes.set(it.id, g);
      this.attachLights(it, inner);
    }
    this.assignShadows();
    this.shadowDirty = true;
  }

  placeNode(g, it, def) {
    g.position.set(it.x * M, elevationOf(it, def || CATALOG_BY_KEY[it.t]) * M, it.y * M);
    g.rotation.y = (-it.r * Math.PI) / 180;
  }

  moveItem(it) {
    const g = this.nodes && this.nodes.get(it.id);
    if (!g) return;
    this.placeNode(g, it);
    const inner = g.children[0];
    if (inner && inner.userData.lights && inner.userData.lights.some((L) => L.kind === 'glow')) {
      this.lights = this.lights.filter((l) => l.parent !== inner);
      this.attachLights(it, inner);
      this.assignShadows();
    }
    this.updateSelection();
    this.shadowDirty = true;
    this.dirty = true;
  }

  setSelected(id) { this.selectedId = id; this.updateSelection(); this.dirty = true; }

  updateSelection() {
    this.clear(this.helpers);
    const g = (this.nodes && this.nodes.get(this.selectedId)) || (this.doorNodes && this.doorNodes.get(this.selectedDoor));
    if (!g) return;
    const box = new THREE.Box3().setFromObject(g);
    const helper = new THREE.Box3Helper(box, new THREE.Color('#2f6fde'));
    this.helpers.add(helper);
  }

  // ------------------------------------------------ kamera

  setCamera(id, animate = true) {
    const c = PLAN.cameras.find((k) => k.id === id) || PLAN.cameras[0];
    this.cameraId = c.id;
    const pos = new THREE.Vector3(c.pos[0] * M, c.pos[2] * M, c.pos[1] * M);
    const tgt = new THREE.Vector3(c.target[0] * M, c.target[2] * M, c.target[1] * M);
    const fov = c.fov || 60;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    if (!animate) {
      this.camera.position.copy(pos); this.controls.target.copy(tgt);
      this.camera.fov = fov; this.camera.updateProjectionMatrix();
      this.controls.update(); this.dirty = true;
      return;
    }
    const p0 = this.camera.position.clone(), t0 = this.controls.target.clone(), f0 = this.camera.fov;
    const start = performance.now(), dur = 700;
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.camera.position.lerpVectors(p0, pos, e);
      this.controls.target.lerpVectors(t0, tgt, e);
      this.camera.fov = f0 + (fov - f0) * e; this.camera.updateProjectionMatrix();
      this.dirty = true;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  setOption(key, value) {
    this.opts[key] = value;
    if (key === 'cut') { this.structKey = null; this.furnKey = null; if (this.doc) this.setData(this.doc, this.style); }
    this.shadowDirty = true;
    this.dirty = true;
  }

  // ------------------------------------------------ renderowanie

  resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  render() {
    if (this.ao) this.ao.enabled = this.opts.ao;
    if (this.shadowDirty) { this.renderer.shadowMap.needsUpdate = true; this.shadowDirty = false; }
    this.composer.render();
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      const moved = this.controls.update();
      if (moved || this.dirty) { this.dirty = false; this.render(); this.frames = (this.frames || 0) + 1; }
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  // Zrzut w zadanej rozdzielczości (PNG data URL)
  snapshot(width = 1920, height = 1080) {
    const r = this.renderer;
    const prevPR = r.getPixelRatio();
    const pw = this.container.clientWidth, ph = this.container.clientHeight;
    r.setPixelRatio(1);
    r.setSize(width, height, false);
    this.composer.setPixelRatio(1);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.helpers.visible = false;
    this.render();
    const url = r.domElement.toDataURL('image/png');
    this.helpers.visible = true;
    r.setPixelRatio(prevPR);
    this.composer.setPixelRatio(prevPR);
    r.setSize(pw, ph);
    this.composer.setSize(pw, ph);
    this.camera.aspect = pw / ph; this.camera.updateProjectionMatrix();
    this.dirty = true;
    return url;
  }

  // ------------------------------------------------ zaznaczanie i przesuwanie mebli

  pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster;
  }

  floorPoint(e) {
    const ray = this.pick(e).ray;
    const p = new THREE.Vector3();
    return ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? [p.x / M, p.z / M] : null;
  }

  setupPointer() {
    const el = this.renderer.domElement;
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const doorObjs = this.doorNodes ? [...this.doorNodes.values()] : [];
      const hits = this.pick(e).intersectObjects([...this.furniture.children, ...doorObjs], true);
      let id = null, door = null;
      for (const h of hits) {
        let o = h.object;
        while (o && o.userData.id === undefined && o.userData.door === undefined) o = o.parent;
        if (o) { id = o.userData.id ?? null; door = o.userData.door ?? null; break; }
      }
      this.pendingDoor = door;
      this.downAt = [e.clientX, e.clientY];
      if (id != null && id === this.selectedId) {
        const p = this.floorPoint(e);
        const it = this.doc.items.find((i) => i.id === id);
        if (p && it && !(it.o && it.o.lock)) {
          drag = { it, ox: p[0] - it.x, oy: p[1] - it.y, moved: false };
          this.controls.enabled = false;
          el.setPointerCapture(e.pointerId);
        }
      }
      this.pendingSelect = id;
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = this.floorPoint(e);
      if (!p) return;
      drag.moved = true;
      this.cb.onMove(drag.it, p[0] - drag.ox, p[1] - drag.oy, e.altKey);
      this.moveItem(drag.it);
    });
    el.addEventListener('pointerup', (e) => {
      const click = this.downAt && Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]) < 4;
      if (drag) { this.controls.enabled = true; if (drag.moved) this.cb.onCommit(); }
      else if (click) { if (this.pendingDoor) this.cb.onSelectDoor(this.pendingDoor); else this.cb.onSelect(this.pendingSelect); }
      drag = null;
    });
  }

  dispose() {
    this.stop();
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
