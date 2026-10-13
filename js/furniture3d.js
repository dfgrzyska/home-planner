// Bryły mebli 3D. Budowane w centymetrach w układzie lokalnym: środek podstawy w (0,0,0),
// szerokość wzdłuż x, głębokość wzdłuż z (front = +z), wysokość wzdłuż y.
import * as THREE from 'three';
import { heightOf, elevationOf } from './dims3d.js';
import { lightOf } from './lights.js';
import { slatSpec, mirrorOutline } from './shapes.js';
export { heightOf, elevationOf } from './dims3d.js';

// ---------------------------------------------------------------- światło

const glowCache = new Map();
// Materiał świecącej powierzchni (dioda, klosz, ekran Signe); off = wyłączona
export function glowMat(color, on = true, k = 1.6) {
  const key = `${color}|${on}|${k}`;
  if (!glowCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color: on ? '#ffffff' : '#d8d6d0', roughness: 0.4 });
    if (on) { m.emissive = new THREE.Color(color); m.emissiveIntensity = k; }
    m.userData.glow = true;
    glowCache.set(key, m);
  }
  return glowCache.get(key);
}

const lerpHex = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

// Opis źródeł światła w układzie lokalnym elementu (cm); view3d zamienia je na światła sceny.
// kind: point | spot (dir = kierunek) | rect (taśma LED) | glow (poświata na ścianie: dir = kierunek do ściany,
// shape = box – elipsa wokół lampy, line / vline – pas wzdłuż taśmy, up / down – zanik w pionie)
function addLight(g, L) { (g.userData.lights ||= []).push(L); }

// Taśma LED = liniowe źródło światła (RectAreaLight) na całej długości taśmy,
// przy gradiencie 3 odcinki w kolejnych kolorach. normal = kierunek świecenia.
// Liniowe źródło świecące na ścianę za elementem (Signe, Play, TV): odcinki w kolorach gradientu
function wallRun(g, L, len, vertical, center, k, thick = 2) {
  const n = L.color === L.color2 ? 1 : 3;
  const seg = len / n;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const p = -len / 2 + seg * (i + 0.5);
    const pos = vertical ? [center[0], center[1] + p, center[2]] : [center[0] + p, center[1], center[2]];
    addLight(g, { kind: 'rect', pos, normal: [0, 0, -1], len: seg, thick, vertical, color: lerpHex(L.color, L.color2, t), lm: L.lm / n, k });
  }
}

function stripLights(g, L, len, y, z, vertical) {
  const n = L.color === L.color2 ? 1 : 3;
  const normal = vertical || L.dir === 'out' ? [0, 0, 1] : L.dir === 'up' ? [0, 1, 0] : [0, -1, 0];
  const seg = len / n;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const p = -len / 2 + seg * (i + 0.5);
    const pos = vertical ? [0, y + len / 2 + p, z + 1.5] : [p, y + normal[1] * 1.2, z + (normal[2] ? 1.5 : 0)];
    addLight(g, { kind: 'rect', pos, normal, len: seg, vertical, color: lerpHex(L.color, L.color2, t), lm: L.lm / n });
  }
}

// ---------------------------------------------------------------- rośliny

const leafGeo = new THREE.SphereGeometry(1, 12, 8);
const GREENS = ['#4f8a3f', '#5b9447', '#447a36', '#6a9e50'];
function leaf(g, L, W, x, y, z, rotY, tilt, color, thick = 0.12) {
  const m = new THREE.Mesh(leafGeo, mat(color, { rough: 0.7 }));
  m.scale.set(W / 2, thick * W / 2, L / 2);
  m.position.set(x, y, z);
  m.rotation.set(tilt, rotY, 0, 'YXZ');
  g.add(m);
  return m;
}
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// łodyga / gałązka między dwoma punktami
const UP = new THREE.Vector3(0, 1, 0);
function stick(g, a, b, r, m) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A), len = dir.length();
  const o = new THREE.Mesh(cylGeo, m);
  o.scale.set(r, len, r);
  o.quaternion.setFromUnitVectors(UP, dir.normalize());
  o.position.copy(A).add(B).multiplyScalar(0.5);
  g.add(o);
  return o;
}

function pot(g, r, h, color) {
  cyl(g, r, h, 0, 0, 0, mat(color, { rough: 0.85 }), r * 1.12);
  cyl(g, r * 1.02, 2, 0, h - 2, 0, mat('#3d2d22', { rough: 1 }));
}

function buildPlant(sp, w, d, H, col) {
  const g = new THREE.Group();
  const R = Math.min(w, d) / 2;
  const potC = col || '#c9845f';
  switch (sp) {
    case 'monstera': {
      pot(g, 16, 30, col || '#e9e6df');
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + rnd(i) * 0.5, rad = 18 + rnd(i + 1) * (R - 30), y = 55 + rnd(i + 2) * (H - 75);
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        stick(g, [x * 0.15, 28, z * 0.15], [x * 0.85, y - 4, z * 0.85], 0.7, mat('#5b7f3a'));
        leaf(g, 34, 30, x, y, z, -a + Math.PI / 2, -0.7, GREENS[i % 4], 0.08);
      }
      break;
    }
    case 'fikus': {
      pot(g, 15, 30, potC);
      cyl(g, 1.8, H - 40, 0, 30, 0, mat('#6b5440'));
      for (let i = 0; i < 26; i++) {
        const y = 75 + (i / 26) * (H - 85), a = i * 2.4, r = 6 + rnd(i) * 14;
        leaf(g, 22, 15, Math.cos(a) * r, y, Math.sin(a) * r, -a, -0.9 + rnd(i + 3) * 0.6, GREENS[i % 4], 0.15);
      }
      break;
    }
    case 'strelicja': {
      pot(g, 18, 35, potC);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + rnd(i), h = H * (0.65 + rnd(i + 2) * 0.35), r = 8 + rnd(i) * 14;
        cyl(g, 0.7, h - 45, Math.cos(a) * r * 0.5, 35, Math.sin(a) * r * 0.5, mat('#5c7f45'));
        leaf(g, 45, 14, Math.cos(a) * r, h - 5, Math.sin(a) * r, -a, -1.3, GREENS[i % 4], 0.1);
      }
      const fl = cyl(g, 1.5, 14, 6, H * 0.7, 2, mat('#ff7b1c', { rough: 0.5 }), 0.2);
      fl.rotation.z = 1.1;
      break;
    }
    case 'oliwka': {
      pot(g, 17, 35, col || '#8c8a85');
      cyl(g, 2.5, H * 0.5, 0, 35, 0, mat('#7a6a55'));
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7, r = rnd(i) * 18;
        sphere(g, 14 + rnd(i + 5) * 8, Math.cos(a) * r, H * 0.72 + rnd(i + 1) * H * 0.2, Math.sin(a) * r, mat(i % 2 ? '#8a9a6f' : '#7d8c63', { rough: 0.9 }), 0.8);
      }
      break;
    }
    case 'kentia': {
      pot(g, 18, 35, potC);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + rnd(i) * 0.4;
        const fr = new THREE.Group();
        for (let k = 0; k < 7; k++) leaf(fr, 22, 5, 0, 0, 8 + k * 10, 0.3, 0, GREENS[(i + k) % 4], 0.15).position.set(k % 2 ? 6 : -6, -k * k * 0.5, 8 + k * 10);
        cyl(fr, 0.6, 1, 0, 0, 0, mat('#5c7f45'));
        fr.position.set(0, H * (0.7 + rnd(i) * 0.25), 0);
        fr.rotation.set(-0.5 - rnd(i + 2) * 0.4, a, 0, 'YXZ');
        g.add(fr);
        const st = cyl(g, 0.7, H * 0.7 - 30, 0, 32, 0, mat('#5c7f45'));
        st.rotation.set(0.2 * Math.cos(a), 0, 0.2 * Math.sin(a));
      }
      break;
    }
    case 'sansewieria': {
      pot(g, 12, 25, col || '#2e2f31');
      for (let i = 0; i < 10; i++) {
        const a = i * 2.1, r = 2 + rnd(i) * 6, h = H * (0.6 + rnd(i + 1) * 0.4) - 20;
        const b = box(g, 5, h, 1.2, Math.cos(a) * r, 23, Math.sin(a) * r, mat(i % 2 ? '#3f6b3a' : '#4c7a3c', { rough: 0.6 }));
        b.rotation.set((rnd(i + 3) - 0.5) * 0.25, a, (rnd(i + 4) - 0.5) * 0.25);
      }
      break;
    }
    case 'zamiokulkas': {
      pot(g, 14, 25, col || '#e9e6df');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, tilt = 0.25 + rnd(i) * 0.25, h = H - 30 - rnd(i + 2) * 15;
        const st = new THREE.Group();
        cyl(st, 0.8, h, 0, 0, 0, mat('#4f6f35'));
        for (let k = 0; k < 6; k++) { leaf(st, 9, 5, 3, h * 0.35 + k * h * 0.11, 0, 0.9, 0, '#3f7a3a', 0.2); leaf(st, 9, 5, -3, h * 0.35 + k * h * 0.11 + 3, 0, -0.9, 0, '#3f7a3a', 0.2); }
        st.position.y = 24; st.rotation.set(tilt * Math.cos(a), 0, tilt * Math.sin(a));
        g.add(st);
      }
      break;
    }
    case 'storczyk': {
      pot(g, 7, 12, col || '#f4f3ef');
      leaf(g, 18, 6, 4, 13, 0, Math.PI / 2, -0.2, '#3f6b3a', 0.15); leaf(g, 18, 6, -4, 13, 0, -Math.PI / 2, -0.2, '#3f6b3a', 0.15);
      cyl(g, 0.4, H - 15, 0, 12, 0, mat('#5f7f40'));
      for (let k = 0; k < 6; k++) sphere(g, 3.2, 3 + k * 1.6, H - 8 - k * 4, k % 2 ? 2 : -2, mat(k % 3 ? '#f5eef5' : '#e9b7d6', { rough: 0.5 }), 0.35);
      break;
    }
    case 'bukiet': {
      cyl(g, 7, 24, 0, 0, 0, mat('#d4e6ea', { rough: 0.05, opacity: 0.45 }), 6);
      for (let k = 0; k < 11; k++) {
        const a = k * 2.3, r = rnd(k) * 9;
        cyl(g, 0.35, H - 30, Math.cos(a) * r * 0.4, 20, Math.sin(a) * r * 0.4, mat('#5f8a3f'));
        sphere(g, 4 + rnd(k + 1) * 2, Math.cos(a) * r, H - 10 + rnd(k + 2) * 8, Math.sin(a) * r, mat(col || '#f2a7c0', { rough: 0.6 }), 0.85);
      }
      break;
    }
    case 'ziola': case 'lawenda': {
      box(g, w, 15, d, 0, 0, 0, mat(col || (sp === 'lawenda' ? '#b5b0a6' : '#c9845f'), { rough: 0.85 }));
      for (let x = -w / 2 + 6; x < w / 2 - 3; x += 8) {
        if (sp === 'ziola') sphere(g, 6, x, 20, 0, mat(GREENS[Math.round(x) & 3], { rough: 0.9 }), 0.9);
        else for (let k = 0; k < 4; k++) { cyl(g, 0.3, H - 18, x + (k - 1.5) * 1.5, 15, (k % 2) * 3 - 1.5, mat('#7d8c63')); sphere(g, 1.2, x + (k - 1.5) * 1.5, H - 4, (k % 2) * 3 - 1.5, mat('#9b7fd0'), 3); }
      }
      break;
    }
    default: pot(g, R * 0.6, 30, potC); sphere(g, R, 0, H * 0.6, 0, mat('#5f8a4a'), 1.3);
  }
  return g;
}


const matCache = new Map();
export function mat(color, { rough = 0.8, metal = 0, opacity = 1, emissive = null } = {}) {
  const key = `${color}|${rough}|${metal}|${opacity}|${emissive}`;
  if (!matCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    if (opacity < 1) { m.transparent = true; m.opacity = opacity; m.depthWrite = false; }
    if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 0.6; }
    matCache.set(key, m);
  }
  return matCache.get(key);
}

const C = {
  fabric: '#8f9297', linen: '#f2efe9', duvet: '#e7e1d6', pillow: '#faf8f4',
  oak: '#b98b5f', white: '#f1f0ec', black: '#232325', metal: '#a2a5a9', steel: '#c9cbcd',
  ceramic: '#fbfbfa', glassTint: '#cfe0e6', plant: '#5f8a4a', pot: '#b56f4f', rug: '#d6cfc3',
};

const fabric = (c) => mat(c, { rough: 0.95 });
const wood = (c = C.oak) => mat(c, { rough: 0.6 });
const lacquer = (c = C.white) => mat(c, { rough: 0.45 });
const ceramic = () => mat(C.ceramic, { rough: 0.15 });
const metal = (c = C.metal) => mat(c, { rough: 0.35, metal: 0.85 });
const dark = () => mat(C.black, { rough: 0.5 });
const glass = () => mat(C.glassTint, { rough: 0.05, opacity: 0.22 });

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 32);

// pudełko: szerokość, wysokość, głębokość, środek x, dół y, środek z
function box(g, w, h, d, x, y, z, m) {
  if (w <= 0 || h <= 0 || d <= 0) return null;
  const o = new THREE.Mesh(boxGeo, m);
  o.scale.set(w, h, d);
  o.position.set(x, y + h / 2, z);
  g.add(o);
  return o;
}
function cyl(g, r, h, x, y, z, m, rTop = r) {
  const o = new THREE.Mesh(rTop === r ? cylGeo : new THREE.CylinderGeometry(rTop, r, 1, 32), m);
  o.scale.set(rTop === r ? r : 1, h, rTop === r ? r : 1);
  o.position.set(x, y + h / 2, z);
  g.add(o);
  return o;
}
function sphere(g, r, x, y, z, m, sy = 1) {
  const o = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), m);
  o.scale.y = sy;
  o.position.set(x, y, z);
  g.add(o);
  return o;
}
function legs(g, w, d, h, inset, m, s = 5) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, s, h, s, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), m);
}

function chair(g, x, z, rotY, color) {
  const c = new THREE.Group();
  const m = wood(color || '#9b7a58');
  legs(c, 42, 42, 45, 3, m, 3.5);
  box(c, 44, 4, 44, 0, 45, 0, fabric(color ? color : '#c9c2b6'));
  box(c, 44, 42, 4, 0, 49, -20, m);
  c.position.set(x, 0, z);
  c.rotation.y = rotY;
  g.add(c);
}

function tableChairs(g, w, d) {
  const gap = 8, cd = 42;
  const n = Math.max(1, Math.floor((w + 5) / 60));
  const step = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + step * (i + 0.5);
    chair(g, x, -d / 2 - gap - cd / 2 + 10, 0);
    chair(g, x, d / 2 + gap + cd / 2 - 10, Math.PI);
  }
  if (w >= 170 || (w >= 140 && d >= 90)) {
    chair(g, -w / 2 - gap - cd / 2 + 10, 0, Math.PI / 2);
    chair(g, w / 2 + gap + cd / 2 - 10, 0, -Math.PI / 2);
  }
}

function roundChairs(g, dia) {
  const n = Math.max(2, Math.min(8, Math.floor((Math.PI * dia) / 62)));
  const r = dia / 2 + 12;
  for (let i = 0; i < n; i++) {
    const a = ((360 / n) * i * Math.PI) / 180;
    chair(g, Math.sin(a) * r, -Math.cos(a) * r, -a);
  }
}

export function buildFurniture(it, def, style) {
  const g = new THREE.Group();
  const w = it.w, d = it.d, hw = w / 2, hd = d / 2;
  const H = heightOf(it, def);
  const o = it.o || {};
  const col = it.c;
  const front = lacquer(col || style.kitchenFront);
  const counter = mat(style.counterHex, { rough: style.counterWood ? 0.55 : 0.3 });

  switch (def.kind) {
    case 'bed': {
      const frame = fabric(col || '#cbbfae');
      box(g, w, 28, d, 0, 8, 0, frame);
      legs(g, w, d, 8, 6, dark(), 4);
      box(g, w, H, 8, 0, 8, -hd + 4, frame);
      box(g, w - 8, 20, d - 14, 0, 36, 4, fabric(C.linen));
      const pw = w >= 120 ? (w - 26) / 2 : w - 18;
      if (w >= 120) { box(g, pw, 13, 38, -w / 4 + 2, 56, -hd + 32, fabric(C.pillow)); box(g, pw, 13, 38, w / 4 - 2, 56, -hd + 32, fabric(C.pillow)); }
      else box(g, pw, 13, 38, 0, 56, -hd + 32, fabric(C.pillow));
      box(g, w - 4, 7, (d - 14) * 0.66, 0, 55, hd - ((d - 14) * 0.66) / 2 - 3, fabric(C.duvet));
      break;
    }
    case 'crib': {
      const m = lacquer(col || C.white);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 4, H, 4, sx * (hw - 2), 0, sz * (hd - 2), m);
      box(g, w, 3, d, 0, 30, 0, m);
      box(g, w - 6, 10, d - 6, 0, 33, 0, fabric(C.linen));
      for (let x = -hw + 8; x < hw - 4; x += 8) { box(g, 2, H - 35, 2, x, 35, hd - 2, m); box(g, 2, H - 35, 2, x, 35, -hd + 2, m); }
      box(g, w, 4, 4, 0, H - 4, hd - 2, m); box(g, w, 4, 4, 0, H - 4, -hd + 2, m);
      break;
    }
    case 'sofa': case 'armchair': {
      const m = fabric(col || C.fabric);
      const arm = Math.min(def.kind === 'armchair' ? 15 : 18, w * 0.15), back = Math.min(22, d * 0.25);
      legs(g, w, d, 10, 8, dark(), 4);
      box(g, w, 30, d, 0, 10, 0, m);
      box(g, w - 2 * arm, 14, d - back, 0, 40, back / 2, m);
      box(g, w, H - 10, back, 0, 10, -hd + back / 2, m);
      box(g, arm, 62 - 10, d, -hw + arm / 2, 10, 0, m);
      box(g, arm, 62 - 10, d, hw - arm / 2, 10, 0, m);
      break;
    }
    case 'sofa_l': {
      const m = fabric(col || C.fabric);
      const sd = Math.min(95, d * 0.6), cw = Math.min(95, w * 0.4), back = 20, arm = 16;
      const s = o.mirror ? -1 : 1;
      box(g, w, 40, sd, 0, 0, -hd + sd / 2, m);
      box(g, cw, 40, d - sd, s * (hw - cw / 2), 0, -hd + sd + (d - sd) / 2, m);
      box(g, w, H - 40, back, 0, 40, -hd + back / 2, m);
      box(g, arm, 22, sd, s * (-hw + arm / 2), 40, -hd + sd / 2, m);
      box(g, w - arm - back * 0, 12, sd - back, s * (arm / 2), 40, -hd + back + (sd - back) / 2, m);
      box(g, cw, 12, d - sd, s * (hw - cw / 2), 40, -hd + sd + (d - sd) / 2, m);
      break;
    }
    case 'table': {
      const top = wood(col || C.oak);
      box(g, w, 4, d, 0, H - 4, 0, top);
      legs(g, w, d, H - 4, 6, wood(col || C.oak), 6);
      if (o.chairs) tableChairs(g, w, d);
      break;
    }
    case 'round': {
      if (def.cat === 'przedpokoj') {
        const m = metal('#2c2c2e');
        cyl(g, 18, 2, 0, 0, 0, m); cyl(g, 1.5, H, 0, 0, 0, m);
        for (let i = 0; i < 4; i++) box(g, 2, 2, 20, 0, H - 15, 0, m).rotation.y = (i * Math.PI) / 4;
        break;
      }
      const top = wood(col || C.oak);
      cyl(g, hw, 4, 0, H - 4, 0, top);
      cyl(g, 5, H - 4, 0, 0, 0, top);
      cyl(g, Math.min(hw * 0.6, 28), 2, 0, 0, 0, top);
      if (o.chairs) roundChairs(g, w);
      break;
    }
    case 'chair': {
      const m = wood(col || '#9b7a58');
      legs(g, w - 2, d - 2, 45, 3, m, 3.5);
      box(g, w, 4, d, 0, 45, 0, fabric(col || '#c9c2b6'));
      box(g, w, H - 49, 4, 0, 49, -hd + 2, m);
      break;
    }
    case 'stool': {
      const m = metal('#2e2f31');
      cyl(g, Math.min(hw, hd), 5, 0, H - 5, 0, fabric(col || '#a08a73'));
      cyl(g, 2, H - 5, 0, 0, 0, m); cyl(g, 18, 1.5, 0, 0, 0, m);
      break;
    }
    case 'office_chair': {
      const m = dark();
      cyl(g, 30, 3, 0, 4, 0, m); cyl(g, 2.5, 45, 0, 4, 0, metal());
      box(g, w - 10, 8, d - 10, 0, 48, 2, fabric(col || '#3b3d42'));
      box(g, w - 14, 55, 6, 0, 56, -hd + 6, fabric(col || '#3b3d42'));
      break;
    }
    case 'tv': {
      const sh = w * 0.5625 + 2;
      box(g, w, sh, 4, 0, 0, 0, mat('#151517', { rough: 0.25 }));
      box(g, w - 2, sh - 2, 0.4, 0, 1, 2.1, mat('#0b0c10', { rough: 0.12, metal: 0.3 }));
      const L = lightOf(it, def);
      if (L && L.on) {
        const n = 6;
        for (let i = 0; i < n; i++) box(g, (w - 10) / n, 1, 0.4, -hw + 5 + ((w - 10) / n) * (i + 0.5), sh - 3, -2.2, glowMat(lerpHex(L.color, L.color2, i / (n - 1)), true, 2));
        // taśma na obwodzie tylnej ścianki: diody skierowane skośnie na zewnątrz, więc aureola wychodzi poza obrys TV
        const z = -hd - 0.5, s2 = Math.SQRT1_2;
        const edge = (pos, normal, len, vertical, color) => addLight(g, { kind: 'rect', pos, normal, len, thick: 2, vertical, color, lm: L.lm / 4, k: 0.9 });
        edge([0, sh - 6, z], [0, s2, -s2], w - 16, false, lerpHex(L.color, L.color2, 0.5));
        edge([0, 6, z], [0, -s2, -s2], w - 16, false, lerpHex(L.color, L.color2, 0.5));
        edge([-hw + 6, sh / 2, z], [-s2, 0, -s2], sh - 16, true, L.color);
        edge([hw - 6, sh / 2, z], [s2, 0, -s2], sh - 16, true, L.color2);
        addLight(g, { kind: 'glow', pos: [0, sh / 2, -hd], dir: [0, 0, -1], size: [w + 90, sh + 80], shape: 'box', color: L.color, color2: L.color2, lm: L.lm });
      }
      break;
    }
    case 'cabinet': {
      const m = lacquer(col || (def.key === 'tv_stand' ? '#ece9e3' : C.white));
      box(g, w, H - 8, d, 0, 8, 0, m);
      box(g, w - 10, 8, d - 6, 0, 0, -3, dark());
      const n = Math.max(1, Math.round(w / 45));
      for (let i = 1; i < n; i++) box(g, 0.4, H - 10, 0.4, -hw + (w / n) * i, 9, hd + 0.1, dark());
      break;
    }
    case 'shelf': {
      const m = wood(col || C.oak);
      box(g, 2, H, d, -hw + 1, 0, 0, m); box(g, 2, H, d, hw - 1, 0, 0, m);
      box(g, w, H, 1, 0, 0, -hd + 0.5, m);
      for (let y = 0; y <= H - 2; y += 38) box(g, w - 4, 2, d - 1, 0, y, 0.5, m);
      box(g, w, 2, d, 0, H - 2, 0, m);
      // książki
      const r = (i) => (Math.sin(i * 12.9898) * 43758.5453) % 1;
      for (let y = 2; y < H - 30; y += 38) {
        let x = -hw + 4;
        let i = Math.round(y);
        while (x < hw - 12) {
          const bw = 2 + Math.abs(r(i)) * 4, bh = 20 + Math.abs(r(i + 1)) * 12;
          const cols = ['#8c4a3c', '#3f5a6e', '#c9b38a', '#2f3f35', '#b8b3a8', '#6b5a7a'];
          box(g, bw, bh, d * 0.7, x + bw / 2, y + 2, 0, fabric(cols[Math.floor(Math.abs(r(i + 2)) * cols.length)]));
          x += bw + 0.4; i += 3;
          if (Math.abs(r(i)) > 0.92) x += 15;
        }
      }
      break;
    }
    case 'wardrobe': {
      const m = lacquer(col || C.white);
      box(g, w, H - 6, d, 0, 6, 0, m);
      box(g, w - 4, 6, d - 6, 0, 0, -3, dark());
      const n = Math.max(1, Math.round(w / 50));
      for (let i = 1; i < n; i++) box(g, 0.4, H - 8, 0.4, -hw + (w / n) * i, 7, hd + 0.1, dark());
      break;
    }
    case 'nightstand': {
      box(g, w, H - 10, d, 0, 10, 0, wood(col || C.oak));
      legs(g, w, d, 10, 4, dark(), 2.5);
      box(g, w - 6, 0.4, 0.4, 0, H - 18, hd + 0.1, dark());
      break;
    }
    case 'desk': {
      const m = wood(col || C.oak);
      box(g, w, 3, d, 0, H - 3, 0, m);
      legs(g, w, d, H - 3, 4, metal('#2e2f31'), 4);
      break;
    }
    case 'bench': {
      box(g, w, 6, d, 0, H - 6, 0, wood(col || C.oak));
      legs(g, w, d, H - 6, 5, wood(col || C.oak), 4);
      break;
    }
    case 'k_base': case 'k_appliance': case 'k_sink': case 'k_hob': {
      box(g, w, 10, d - 6, 0, 0, -3, dark());
      box(g, w - 0.4, 76, d - 2, 0, 10, -1, front);
      box(g, w, 4, d, 0, 86, 0, counter);
      if (def.kind !== 'k_appliance') box(g, Math.min(w * 0.5, 30), 1.2, 1.5, 0, 80, hd, metal());
      if (def.kind === 'k_sink') {
        const bw = Math.min(w - 16, 48);
        const bx = w >= 90 ? -hw + 8 + bw / 2 : 0;
        box(g, bw, 0.4, d - 22, bx, 90, -2, mat('#8f9396', { rough: 0.25, metal: 0.8 }));
        cyl(g, 1.6, 26, bx, 90, -hd + 6, metal(C.steel));
        box(g, 2.5, 2.5, 18, bx, 113, -hd + 14, metal(C.steel));
      }
      if (def.kind === 'k_hob') box(g, w - 6, 0.6, d - 12, 0, 90, -1, mat('#141416', { rough: 0.1 }));
      break;
    }
    case 'k_corner': {
      const s = o.mirror ? -1 : 1, dd = 60;
      box(g, w, 10, dd - 6, 0, 0, -hd + dd / 2 - 3, dark());
      box(g, w, 76, dd - 2, 0, 10, -hd + dd / 2 - 1, front);
      box(g, dd - 2, 76, d - dd, s * (hw - dd / 2), 10, -hd + dd + (d - dd) / 2, front);
      box(g, w, 4, dd, 0, 86, -hd + dd / 2, counter);
      box(g, dd, 4, d - dd, s * (hw - dd / 2), 86, -hd + dd + (d - dd) / 2, counter);
      break;
    }
    case 'k_oven': {
      box(g, w, 10, d - 6, 0, 0, -3, dark());
      box(g, w - 0.4, H - 10, d - 2, 0, 10, -1, front);
      box(g, w - 6, 46, 0.6, 0, 82, hd - 1.6, mat('#121214', { rough: 0.1 }));
      box(g, w - 6, 36, 0.6, 0, 132, hd - 1.6, mat('#121214', { rough: 0.1 }));
      break;
    }
    case 'k_fridge': {
      const m = col ? lacquer(col) : (w > 80 ? metal(C.steel) : lacquer('#eeeeec'));
      box(g, w, H, d, 0, 0, 0, m);
      box(g, w - 2, 0.4, 0.4, 0, H * 0.62, hd + 0.1, dark());
      if (w > 80) box(g, 0.4, H - 4, 0.4, 0, 2, hd + 0.1, dark());
      break;
    }
    case 'k_wall': {
      box(g, w - 0.4, H, d, 0, 0, 0, front);
      box(g, Math.min(w * 0.5, 30), 1.2, 1.5, 0, 4, hd, metal());
      break;
    }
    case 'k_island': {
      box(g, w - 6, 10, d - 36, 0, 0, -12, dark());
      box(g, w - 2, 76, d - 30, 0, 10, -14, front);
      box(g, w, 4, d, 0, 86, 0, counter);
      break;
    }
    case 'bath': {
      const m = ceramic();
      box(g, w, 45, d, 0, 0, 0, m);
      box(g, w, 10, 6, 0, 45, -hd + 3, m); box(g, w, 10, 6, 0, 45, hd - 3, m);
      box(g, 6, 10, d, -hw + 3, 45, 0, m); box(g, 6, 10, d, hw - 3, 45, 0, m);
      box(g, w - 12, 0.5, d - 12, 0, 45, 0, mat('#e3eaec', { rough: 0.2 }));
      cyl(g, 1.5, 12, -hw + 3, 55, 0, metal(C.steel));
      break;
    }
    case 'shower': {
      box(g, w, 4, d, 0, 0, 0, ceramic());
      box(g, w, H - 4, 0.8, 0, 4, hd - 0.4, glass());
      box(g, 0.8, H - 4, d, hw - 0.4, 4, 0, glass());
      cyl(g, 1.2, H, -hw + 6, 0, -hd + 6, metal(C.steel));
      cyl(g, 12, 1.2, -hw + 18, H - 10, -hd + 18, metal(C.steel));
      break;
    }
    case 'washbasin': {
      box(g, w, 45, d - 3, 0, 38, -1.5, wood(col || C.oak));
      box(g, w, 12, d, 0, 83, 0, ceramic());
      box(g, w * 0.6, 0.5, d * 0.55, 0, 95, 2, mat('#e6eced', { rough: 0.15 }));
      cyl(g, 1.4, 16, 0, 95, -hd + 6, metal(C.steel));
      box(g, w * 0.92, 70, 1.5, 0, 112, -hd + 0.8, mat('#dfe8ec', { rough: 0.03, metal: 0.95 }));
      break;
    }
    case 'wc': {
      const m = ceramic();
      box(g, w, 40, 14, 0, 0, -hd + 7, m);
      const bowl = cyl(g, hw - 1, 34, 0, 6, 6, m);
      bowl.scale.z = (d - 14) / 2;
      bowl.scale.x = hw - 1;
      box(g, 22, 15, 1, 0, 95, -hd + 0.5, lacquer('#f4f4f2'));
      break;
    }
    case 'washer': {
      box(g, w, H, d, 0, 0, 0, lacquer('#f2f2f0'));
      const door = cyl(g, Math.min(w, H) * 0.24, 2, 0, 48, hd, mat('#3c4248', { rough: 0.15, metal: 0.4 }));
      door.rotation.x = Math.PI / 2; door.position.set(0, 48, hd + 1);
      box(g, w - 6, 8, 0.4, 0, H - 12, hd + 0.2, mat('#d8d9da', { rough: 0.4 }));
      break;
    }
    case 'lounger': {
      const m = fabric(col || '#d8d0c2');
      legs(g, w, d, 25, 5, wood(), 4);
      box(g, w, 8, d * 0.7, 0, 25, hd - (d * 0.7) / 2, m);
      const back = box(g, w, 8, d * 0.32, 0, 30, -hd + d * 0.16, m);
      back.rotation.x = -0.6; back.position.y = 45;
      break;
    }
    case 'plant': {
      if (Math.abs(w - d) > 10) {
        box(g, w, 40, d, 0, 0, 0, mat(col || '#5d5e60', { rough: 0.8 }));
        for (let x = -hw + 12; x < hw - 6; x += 18) sphere(g, 14, x, 52, 0, mat(C.plant, { rough: 0.9 }), 1.3);
        break;
      }
      const r = Math.min(hw, hd);
      cyl(g, r * 0.62, H * 0.3, 0, 0, 0, mat(col || C.pot, { rough: 0.8 }), r * 0.75);
      sphere(g, r * 0.9, 0, H * 0.55, 0, mat(C.plant, { rough: 0.9 }), 1.4);
      sphere(g, r * 0.7, r * 0.3, H * 0.82, -r * 0.2, mat('#6f9a56', { rough: 0.9 }), 1.2);
      break;
    }
    case 'lamp': {
      const m = metal('#2c2c2e');
      cyl(g, 14, 2, 0, 0, 0, m); cyl(g, 1.2, H - 25, 0, 0, 0, m);
      const L = lightOf(it, def);
      cyl(g, 20, 28, 0, H - 28, 0, L && L.on ? glowMat(L.color, true, 0.9) : mat(col || '#f3ede2', { rough: 0.9 }), 15);
      if (L && L.on) addLight(g, { kind: 'point', pos: [0, H - 16, 0], color: L.color, lm: L.lm });
      break;
    }
    case 'led_strip': case 'string_lights': {
      const L = lightOf(it, def);
      const on = L && L.on;
      const n = Math.max(1, Math.min(12, Math.round(w / 40)));
      if (def.kind === 'string_lights') {
        box(g, w, 0.4, 0.4, 0, 0, -hd + 0.5, dark());
        for (let i = 0; i < Math.round(w / 20); i++) {
          const t = i / Math.max(1, Math.round(w / 20) - 1);
          sphere(g, 1.6, -hw + 10 + i * 20, -3, -hd + 1, glowMat(lerpHex(L.color, L.color2, t), on, 2));
        }
      } else {
        box(g, w, 1.5, 1.8, 0, 0, -hd + 0.9, metal('#cfd1d3'));
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0.5 : i / (n - 1);
          const m = glowMat(lerpHex(L.color, L.color2, t), on, 0.75);
          const sx = -hw + (w / n) * (i + 0.5);
          if (L.dir === 'up') box(g, w / n, 0.3, 1.2, sx, 1.5, -hd + 0.9, m);
          else if (L.dir === 'down') box(g, w / n, 0.3, 1.2, sx, -0.3, -hd + 0.9, m);
          else box(g, w / n, 1.1, 0.3, sx, 0.2, -hd + 1.95, m);
        }
      }
      if (on) {
        stripLights(g, L, w, 0.8, -hd + 1, false);
        addLight(g, { kind: 'glow', pos: [0, 0.8, -hd], dir: [0, 0, -1], size: [w + 50, L.dir === 'out' ? 60 : 110], shape: L.dir === 'up' ? 'up' : L.dir === 'down' ? 'down' : 'line', color: L.color, color2: L.color2, lm: L.lm });
      }
      break;
    }
    case 'led_strip_v': {
      const L = lightOf(it, def);
      const on = L && L.on;
      box(g, 1.8, H, 1.8, 0, 0, 0, metal('#cfd1d3'));
      const n = 8;
      for (let i = 0; i < n; i++) box(g, 0.3, H / n, 1.2, 0.95, (H / n) * i, 0, glowMat(lerpHex(L.color, L.color2, i / (n - 1)), on, 0.75));
      if (on) {
        stripLights(g, { ...L, dir: 'out' }, H, 0, 0, true);
        addLight(g, { kind: 'glow', pos: [0, H / 2, -hd], dir: [0, 0, -1], size: [70, H + 40], shape: 'vline', color: L.color, color2: L.color2, lm: L.lm, vertical: true });
      }
      break;
    }
    case 'light_tube': case 'light_bar': {
      const L = lightOf(it, def);
      const on = L && L.on;
      const tube = def.kind === 'light_tube';
      const len = tube ? w : H, n = tube ? 6 : 3;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), m = glowMat(lerpHex(L.color, L.color2, t), on, 1.8);
        if (tube) cyl(g, Math.min(hd, 2.5), w / n, -hw + (w / n) * (i + 0.5), 2.5, 0, m).rotation.z = Math.PI / 2;
        else box(g, w, H / n, d, 0, (H / n) * i, 0, m);
      }
      if (tube) { box(g, 3, 5, 3, -hw + 4, 0, 0, dark()); box(g, 3, 5, 3, hw - 4, 0, 0, dark()); }
      if (on) {
        if (tube) wallRun(g, L, w - 6, false, [0, 2.5, -3], 0.5, 4);
        else wallRun(g, L, H - 2, true, [0, H / 2, -hd - 0.5], 0.5, 4);
        addLight(g, { kind: 'glow', pos: [0, tube ? 3 : H * 0.6, -hd], dir: [0, 0, -1], size: [tube ? w + 80 : 90, tube ? 90 : H + 70], shape: tube ? 'up' : 'box', color: L.color, color2: L.color2, lm: L.lm });
      }
      break;
    }
    case 'signe': {
      const L = lightOf(it, def);
      const on = L && L.on;
      const floor = H > 100;
      const m = metal(col || '#2e2f31');
      if (floor) cyl(g, Math.min(hw, hd) * 0.9, 2, 0, 0, 0, m); else box(g, w, 2.5, d, 0, 0, 0, m);
      box(g, 3.2, H - 2, 3.2, 0, 2, 0, m);
      const n = 8;
      for (let i = 0; i < n; i++) box(g, 1.6, (H - 6) / n, 0.4, 0, 3 + ((H - 6) / n) * i, -1.8, glowMat(lerpHex(L.color, L.color2, i / (n - 1)), on, 2));
      if (on) {
        // dioda wzdłuż słupka świeci na ścianę: wydłużona poświata, nie okrągła plama
        wallRun(g, L, H - 10, true, [0, H / 2 + 2, -3], 0.5);
        addLight(g, { kind: 'glow', pos: [0, H * 0.55, -hd], dir: [0, 0, -1], size: [floor ? 140 : 90, H + (floor ? 80 : 50)], shape: 'box', color: L.color, color2: L.color2, lm: L.lm, vertical: true });
      }
      break;
    }
    case 'iris': case 'go': case 'bloom': case 'twilight': {
      const L = lightOf(it, def);
      const on = L && L.on;
      const r = Math.min(hw, hd);
      if (def.kind === 'iris') { cyl(g, r * 0.7, 3, 0, 0, 0, dark()); sphere(g, r * 0.95, 0, H * 0.55, 0, glowMat(L.color, on, 1.4), 0.85); }
      else if (def.kind === 'go') { cyl(g, r, H * 0.35, 0, 0, 0, lacquer('#f4f3ef')); sphere(g, r * 0.95, 0, H * 0.45, 0, glowMat(L.color, on, 1.3), 0.6); }
      else if (def.kind === 'bloom') { const b = cyl(g, r, H, 0, 0, 0, glowMat(L.color, on, 1.2), r * 0.85); b.rotation.x = -0.5; b.position.z = 1; }
      else { box(g, w, 3, d, 0, 0, 0, dark()); cyl(g, hd * 0.8, H - 3, 0, 3, 0, glowMat(L.color, on, 1.2), hd * 0.6); }
      if (on) {
        if (def.kind === 'bloom' || def.kind === 'twilight') {
          addLight(g, { kind: 'spot', pos: [0, H, 10], dir: [0, 1, -0.6], angle: 90, color: L.color, lm: L.lm, k: 0.4 });
          addLight(g, { kind: 'glow', pos: [0, H, -hd], dir: [0, 0, -1], size: [100, 140], shape: 'up', color: L.color, color2: L.color2 || L.color, lm: L.lm });
        } else addLight(g, { kind: 'point', pos: [0, H * 0.6, 0], color: L.color, lm: L.lm });
      }
      break;
    }
    case 'pendant': case 'being': case 'ceiling_round': case 'ceiling_panel': case 'centris': case 'downlight': {
      const L = lightOf(it, def);
      const on = L && L.on;
      const ceil = 272 - elevationOf(it, def); // odległość do sufitu – kabel / montaż
      if (def.kind === 'pendant') {
        cyl(g, 0.3, Math.max(0, ceil - H), 0, H, 0, dark());
        cyl(g, hw, H * 0.85, 0, H * 0.15, 0, mat(col || '#2c2c2e', { rough: 0.5 }), hw * 0.12);
        sphere(g, Math.min(6, hw * 0.3), 0, H * 0.25, 0, glowMat(L.color, on, 2.5));
        if (on) addLight(g, { kind: 'spot', pos: [0, H * 0.2, 0], dir: [0, -1, 0], angle: 70, color: L.color, lm: L.lm });
      } else if (def.kind === 'being') {
        for (const x of [-hw + 10, hw - 10]) cyl(g, 0.2, Math.max(0, ceil - H), x, H, 0, dark());
        box(g, w, H, d, 0, 0, 0, mat(col || '#2c2c2e', { rough: 0.4 }));
        box(g, w - 4, 0.4, d - 3, 0, -0.4, 0, glowMat(L.color, on, 2.2));
        if (on) for (const x of [-w / 4, w / 4]) addLight(g, { kind: 'spot', pos: [x, -2, 0], dir: [0, -1, 0], angle: 120, color: L.color, lm: L.lm / 2 });
      } else if (def.kind === 'centris') {
        box(g, w, 3, d, 0, H - 3, 0, lacquer('#f4f4f2'));
        box(g, w - 6, 0.4, d - 6, 0, H - 3.4, 0, glowMat(L.color, on, 1.6));
        for (const x of [-w / 3, 0, w / 3]) { cyl(g, 4, 9, x, H - 12, 0, lacquer('#f4f4f2')); cyl(g, 3, 0.3, x, H - 12.3, 0, glowMat(L.color, on, 2.5)); }
        if (on) for (const x of [-w / 3, 0, w / 3]) addLight(g, { kind: 'spot', pos: [x, H - 14, 0], dir: [0, -1, 0], angle: 45, color: L.color, lm: L.lm / 3 });
      } else {
        // plafon / panel / oczko: świecąca dolna powierzchnia
        const round = def.kind !== 'ceiling_panel';
        if (round) cyl(g, hw, H, 0, 0, 0, lacquer('#f4f4f2')); else box(g, w, H, d, 0, 0, 0, lacquer('#f4f4f2'));
        if (round) cyl(g, hw * 0.92, 0.3, 0, -0.3, 0, glowMat(L.color, on, 1.6)); else box(g, w - 2, 0.3, d - 2, 0, -0.3, 0, glowMat(L.color, on, 1.6));
        if (on) addLight(g, { kind: 'spot', pos: [0, -2, 0], dir: [0, -1, 0], angle: def.light.angle, color: L.color, lm: L.lm });
      }
      break;
    }
    case 'plant3': g.add(buildPlant(def.plant, w, d, H, col)); break;
    case 'mirror': {
      const pts = mirrorOutline(def.shape, w, H);
      const shp = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      const geo = new THREE.ExtrudeGeometry(shp, { depth: 2, bevelEnabled: false, curveSegments: 1 });
      const mesh = new THREE.Mesh(geo, [mat('#e6edf0', { rough: 0.03, metal: 1 }), dark()]);
      mesh.position.z = -hd + 0.5;
      g.add(mesh);
      const L = lightOf(it, def);
      if (L && L.on) {
        // pasek LED za lustrem świeci na ścianę: odcinki wzdłuż krawędzi obrysu (prostokąt otaczający)
        const z = -hd + 0.3, s2 = Math.SQRT1_2;
        const edge = (pos, normal, len, vertical) => addLight(g, { kind: 'rect', pos, normal, len, thick: 1.5, vertical, color: L.color, lm: L.lm / 4, k: 0.7 });
        edge([0, H - 4, z], [0, s2, -s2], w * 0.7, false);
        edge([0, 4, z], [0, -s2, -s2], w * 0.7, false);
        edge([-hw + 4, H / 2, z], [-s2, 0, -s2], H * 0.7, true);
        edge([hw - 4, H / 2, z], [s2, 0, -s2], H * 0.7, true);
        addLight(g, { kind: 'glow', pos: [0, H / 2, -hd], dir: [0, 0, -1], size: [w + 45, H + 45], shape: 'box', color: L.color, color2: L.color, lm: L.lm });
        // świecąca krawędź widoczna przy ścianie
        const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: 0.4, bevelEnabled: false, curveSegments: 1 }), glowMat(L.color, true, 1.2));
        rim.scale.set(1.02, 1.02, 1); rim.position.set(0, -H * 0.01, -hd + 0.1);
        g.add(rim);
      }
      break;
    }
    case 'washer_tower': {
      const cab = H > 185;
      const appl = (y0) => {
        box(g, cab ? w - 6 : w, 85, cab ? d - 6 : d, 0, y0, cab ? -3 : 0, lacquer('#f2f2f0'));
        const door = cyl(g, Math.min(w, 85) * 0.22, 2, 0, 0, 0, mat('#3c4248', { rough: 0.15, metal: 0.4 }));
        door.rotation.x = Math.PI / 2; door.position.set(0, y0 + 45, (cab ? d / 2 - 3 : hd) + 1);
        box(g, (cab ? w - 6 : w) - 6, 8, 0.4, 0, y0 + 73, (cab ? d / 2 - 3 : hd) + 0.2, mat('#d8d9da', { rough: 0.4 }));
      };
      appl(0);
      box(g, cab ? w - 6 : w, 2, cab ? d - 6 : d, 0, 85, cab ? -3 : 0, metal('#b7b9bb'));
      appl(87);
      if (cab) {
        const m = lacquer(col || '#f1f0ec');
        box(g, 3, H, d, -hw + 1.5, 0, 0, m); box(g, 3, H, d, hw - 1.5, 0, 0, m);
        box(g, w, 3, d, 0, H - 3, 0, m);
        box(g, w - 6, H - 175, d - 2, 0, 175, -1, m);
      }
      break;
    }

    case 'slats': case 'slat_partition': {
      const { fin, pat, slat } = slatSpec(it, def);
      const m = fin.mdf || col ? lacquer(slat) : wood(slat);
      const pitch = pat.slat + pat.gap;
      const n = Math.max(1, Math.floor((w + pat.gap) / pitch));
      const x0 = -(n * pitch - pat.gap) / 2 + pat.slat / 2;
      const wall = def.kind === 'slats';
      const back = wall && fin.back ? 1 : 0;
      if (back) box(g, w, H, 1, 0, 0, -hd + 0.5, fabric(fin.back));
      const sd = d - back;
      const inst = new THREE.InstancedMesh(boxGeo, m, n);
      const mx = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (let i = 0; i < n; i++) {
        mx.compose(new THREE.Vector3(x0 + i * pitch, H / 2, -hd + back + sd / 2), q, new THREE.Vector3(pat.slat, H, sd));
        inst.setMatrixAt(i, mx);
      }
      g.add(inst);
      if (!wall) { box(g, w, 1.5, d, 0, 0, 0, m); box(g, w, 1.5, d, 0, H - 1.5, 0, m); }
      break;
    }
    case 'pet_bed': {
      const m = fabric(col || '#7b6f63');
      const b = Math.min(14, Math.min(w, d) * 0.16);
      box(g, w, 9, d, 0, 0, 0, m);
      box(g, w - 2 * b, 6, d - b - 4, 0, 9, b / 2 - 2, fabric('#d9d1c4'));
      box(g, w, H - 9, b, 0, 9, -hd + b / 2, m);
      box(g, b, H - 9, d, -hw + b / 2, 9, 0, m);
      box(g, b, H - 9, d, hw - b / 2, 9, 0, m);
      box(g, w - 2 * b, 5, 6, 0, 9, hd - 3, m);
      break;
    }
    case 'pet_bed_round': {
      const m = fabric(col || '#7b6f63');
      cyl(g, hw, 8, 0, 0, 0, m);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(hw * 0.82, hw * 0.16, 16, 48), m);
      ring.rotation.x = Math.PI / 2; ring.scale.z = 0.9; ring.position.y = 13;
      g.add(ring);
      cyl(g, hw * 0.68, 4, 0, 8, 0, fabric('#d9d1c4'));
      break;
    }
    case 'pet_bowls': {
      box(g, w, H - 6, d, 0, 0, 0, wood(col || C.oak));
      for (const x of [-w / 4, w / 4]) cyl(g, Math.min(w / 4, d / 2) - 2, 7, x, H - 7, 0, metal(C.steel), Math.min(w / 4, d / 2));
      break;
    }
    case 'rug': box(g, w, 1, d, 0, 0, 0, mat(col || C.rug, { rough: 1 })); break;
    case 'rug_round': cyl(g, hw, 1, 0, 0, 0, mat(col || C.rug, { rough: 1 })); break;
    case 'radiator': {
      const m = lacquer(col || '#f4f4f2');
      for (let x = -hw + 2.5; x < hw; x += 5) box(g, 4, H, d, x, 0, 0, m);
      break;
    }
    default: box(g, w, H, d, 0, 0, 0, lacquer(col || '#d9d6cf'));
  }
  const lit = !!(g.userData.lights && g.userData.lights.length);
  g.traverse((m) => {
    if (!m.isMesh) return;
    const glow = m.material.userData && m.material.userData.glow;
    m.castShadow = !m.material.transparent && !glow && !(lit && ['pendant', 'iris', 'go', 'lamp', 'ceiling_round', 'ceiling_panel', 'centris', 'downlight', 'being', 'bloom', 'twilight', 'signe', 'light_bar', 'light_tube', 'led_strip', 'led_strip_v', 'string_lights'].includes(def.kind));
    m.receiveShadow = !glow;
  });
  return g;
}
