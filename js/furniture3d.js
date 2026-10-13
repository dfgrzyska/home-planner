// Bryły mebli 3D. Budowane w centymetrach w układzie lokalnym: środek podstawy w (0,0,0),
// szerokość wzdłuż x, głębokość wzdłuż z (front = +z), wysokość wzdłuż y.
import * as THREE from 'three';
import { heightOf } from './dims3d.js';
export { heightOf, elevationOf } from './dims3d.js';

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
      cyl(g, 20, 28, 0, H - 28, 0, mat(col || '#f3ede2', { rough: 0.9, emissive: '#fff1d6' }), 15);
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
  g.traverse((m) => { if (m.isMesh && !(m.material.transparent)) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}
