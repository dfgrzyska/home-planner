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

const M = 0.01;
const REVEAL = '#f1f0ec';
const FACADE = '#e4e1da';
const CAP = '#3a3a3c';
const CEILING = '#f7f6f3';

const inRect = ([x, y, w, h], px, py) => px >= x && px <= x + w && py >= y && py <= y + h;

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

function wallFaces(doc, style, cut) {
  const solids = collectSolids(doc, cut);
  const batch = new QuadBatch();
  const accent = style.accent;
  // strona ściany pomieszczenia, którą tworzy dana ściana bryły (lico 'n' bryły to ściana południowa pokoju powyżej)
  const roomSide = { n: 's', s: 'n', e: 'w', w: 'e' };
  const colorFor = (region, side) => {
    if (region === 'gap') return REVEAL;
    if (region === 'out' || region == null) return FACADE;
    if (accent && accent.room === region && accent.side === roomSide[side]) return accent.color;
    return style.walls[region] || REVEAL;
  };
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
    const sun = new THREE.DirectionalLight('#fff4e2', 2.6);
    sun.position.set(4 + 6, 9, 4.5 + 7.5);
    sun.target.position.set(4, 0, 4.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);

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
    const sKey = JSON.stringify([doc.demo, style, this.opts.cut]);
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
    for (const m of wallFaces(doc, style, cut)) this.structure.add(m);

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

    // drzwi (skrzydła otwarte jak na rzucie)
    const hidden = PLAN.partitions.filter((p) => p.door && doc.demo.includes(p.id)).map((p) => p.door);
    for (const d of PLAN.doors) {
      if (hidden.includes(d.id)) continue;
      const leafH = Math.min(PLAN.doorHeight - 2, cut || 1e9);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(d.r * M, leafH * M, 4 * M), mat(d.entry ? '#5b534b' : '#f4f3ef', { rough: 0.5 }));
      const a = (d.open * Math.PI) / 180;
      leaf.position.set((d.hinge[0] + (Math.cos(a) * d.r) / 2) * M, (leafH / 2) * M, (d.hinge[1] + (Math.sin(a) * d.r) / 2) * M);
      leaf.rotation.y = -a;
      leaf.castShadow = true; leaf.receiveShadow = true;
      this.structure.add(leaf);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.07), mat('#9a9da1', { rough: 0.3, metal: 0.9 }));
      handle.position.set((d.hinge[0] + Math.cos(a) * (d.r - 8)) * M, 1.0, (d.hinge[1] + Math.sin(a) * (d.r - 8)) * M);
      handle.rotation.y = -a;
      this.structure.add(handle);
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

  buildFurniture(doc, style) {
    this.clear(this.furniture);
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
    }
  }

  placeNode(g, it, def) {
    g.position.set(it.x * M, elevationOf(it, def || CATALOG_BY_KEY[it.t]) * M, it.y * M);
    g.rotation.y = (-it.r * Math.PI) / 180;
  }

  moveItem(it) {
    const g = this.nodes && this.nodes.get(it.id);
    if (!g) return;
    this.placeNode(g, it);
    this.updateSelection();
    this.dirty = true;
  }

  setSelected(id) { this.selectedId = id; this.updateSelection(); this.dirty = true; }

  updateSelection() {
    this.clear(this.helpers);
    const g = this.nodes && this.nodes.get(this.selectedId);
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
    if (key === 'cut') { this.structKey = null; if (this.doc) this.setData(this.doc, this.style); }
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
      const hits = this.pick(e).intersectObjects(this.furniture.children, true);
      let id = null;
      for (const h of hits) {
        let o = h.object;
        while (o && o.userData.id === undefined) o = o.parent;
        if (o) { id = o.userData.id; break; }
      }
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
      else if (click) this.cb.onSelect(this.pendingSelect);
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
