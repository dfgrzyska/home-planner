// Proceduralne tekstury posadzek (canvas) – bez zewnętrznych plików.
// Każda tekstura pokrywa kafel o rozmiarze `tile` cm; UV posadzek liczone są w cm świata, więc wzór jest ciągły między pomieszczeniami.

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + f))));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

function grain(ctx, x, y, w, h, base, r, vertical = false) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const lines = Math.round((vertical ? w : h) / 3);
  for (let i = 0; i < lines; i++) {
    ctx.strokeStyle = shade(base, (r() - 0.5) * 0.18);
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.6 + r() * 1.2;
    ctx.beginPath();
    if (vertical) {
      const gx = x + r() * w;
      ctx.moveTo(gx, y);
      ctx.bezierCurveTo(gx + (r() - 0.5) * 6, y + h / 3, gx + (r() - 0.5) * 6, y + (2 * h) / 3, gx + (r() - 0.5) * 4, y + h);
    } else {
      const gy = y + r() * h;
      ctx.moveTo(x, gy);
      ctx.bezierCurveTo(x + w / 3, gy + (r() - 0.5) * 6, x + (2 * w) / 3, gy + (r() - 0.5) * 6, x + w, gy + (r() - 0.5) * 4);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Płytki ścienne: tekstura obejmuje kilka płytek; zwraca { canvas, tw, th } – rozmiar tekstury w cm
export function wallTileCanvas(def, seed = 11) {
  const r = rng(seed);
  const cols = def.kind === 'slab' || def.kind === 'terrazzo' ? 2 : 4;
  const rows = def.kind === 'subway' ? 4 : def.kind === 'slab' ? 1 : def.kind === 'terrazzo' ? 2 : 4;
  const tw = def.w * cols, th = def.h * rows;
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S; c.height = Math.round((S * th) / tw);
  const ctx = c.getContext('2d');
  const px = S / tw;
  ctx.fillStyle = shade(def.base, -0.12);
  ctx.fillRect(0, 0, c.width, c.height);
  const grout = Math.max(1.5, 0.3 * px);
  for (let j = 0; j < rows; j++) {
    const off = def.kind === 'subway' && j % 2 ? def.w / 2 : 0;
    for (let i = -1; i <= cols; i++) {
      const x = (i * def.w + off) * px, y = j * def.h * px, w = def.w * px, h = def.h * px;
      const tone = def.kind === 'zellige' ? (r() - 0.5) * 0.35 : (r() - 0.5) * 0.04;
      ctx.fillStyle = shade(def.base, tone);
      ctx.fillRect(x + grout / 2, y + grout / 2, w - grout, h - grout);
      ctx.save();
      ctx.beginPath(); ctx.rect(x + grout / 2, y + grout / 2, w - grout, h - grout); ctx.clip();
      if (def.noise) for (let k = 0; k < 900; k++) {
        ctx.fillStyle = shade(def.base, (r() - 0.5) * def.noise * 3); ctx.globalAlpha = 0.2;
        ctx.beginPath(); ctx.arc(x + r() * w, y + r() * h, 2 + r() * 18, 0, Math.PI * 2); ctx.fill();
      }
      if (def.veins) for (let k = 0; k < 5; k++) {
        ctx.strokeStyle = def.veins; ctx.globalAlpha = 0.35 + r() * 0.3; ctx.lineWidth = 0.8 + r() * 2.2;
        ctx.beginPath();
        let vx = x + r() * w, vy = y;
        ctx.moveTo(vx, vy);
        for (let q = 0; q < 6; q++) { vx += (r() - 0.5) * w * 0.5; vy += h / 6; ctx.lineTo(vx, vy); }
        ctx.stroke();
      }
      if (def.kind === 'zellige') {
        // ręcznie robione płytki: jaśniejsze krawędzie i plamy szkliwa
        const g = ctx.createRadialGradient(x + w * (0.3 + r() * 0.4), y + h * (0.3 + r() * 0.4), 2, x + w / 2, y + h / 2, w * 0.8);
        g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      }
      if (def.kind === 'terrazzo') {
        const tc = ['#b9b2a6', '#8f8a82', '#c46f4f', '#6f7d73', '#f5f2ec'];
        for (let k = 0; k < 160; k++) {
          ctx.fillStyle = tc[Math.floor(r() * tc.length)]; ctx.globalAlpha = 0.85;
          const sz = 1.5 + r() * 5;
          ctx.beginPath(); ctx.ellipse(x + r() * w, y + r() * h, sz, sz * 0.7, r() * 3, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
  return { canvas: c, tw, th };
}

// Zwraca { canvas, tile } – tile = rozmiar kafla w cm
export function floorCanvas(def, seed = 7) {
  const r = rng(seed);
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = def.base;
  ctx.fillRect(0, 0, S, S);

  if (def.kind === 'planks') {
    // deski: szerokość `plank` cm, długości 120–180 cm, przesunięte; kafel 240 cm
    const tile = 240, px = S / tile;
    const pw = (def.plank || 20) * px;
    const rows = Math.round(S / pw);
    for (let i = 0; i < rows; i++) {
      let x = -r() * 150 * px;
      while (x < S) {
        const len = (120 + r() * 60) * px;
        const col = shade(def.base, (r() - 0.5) * def.var * 2);
        ctx.fillStyle = col;
        ctx.fillRect(x, i * pw, len, pw);
        grain(ctx, x, i * pw, len, pw, def.base, r);
        ctx.strokeStyle = shade(def.base, -0.35); ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2;
        ctx.strokeRect(x, i * pw, len, pw);
        ctx.globalAlpha = 1;
        x += len;
      }
    }
    return { canvas: c, tile };
  }

  if (def.kind === 'herringbone') {
    // jodełka: klepki L×W (60×10 cm). Wzór 90° to sieć t1=(W,W), t2=(L,-L) z motywem {pozioma, pionowa};
    // po obrocie o 45° jest okresowy co (L√2, 0) i (0, W√2) – przy L = 6W kafel ma bok L√2.
    const Lcm = 60, Wcm = 10;
    const tile = Lcm * Math.SQRT2, px = S / tile;
    const L = Lcm * px, W = Wcm * px;
    ctx.save();
    ctx.rotate(Math.PI / 4);
    const plank = (x, y, w, h, vertical, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h);
      grain(ctx, x, y, w, h, def.base, r, vertical);
      ctx.strokeStyle = shade(def.base, -0.35); ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2;
      ctx.strokeRect(x, y, w, h);
      ctx.globalAlpha = 1;
    };
    // odcienie klepek powtarzają się z okresem wzoru (i mod L/W), więc kafel jest bezszwowy
    const nI = Math.round(Lcm / Wcm);
    const cols = [];
    for (let k = 0; k < nI; k++) cols.push([shade(def.base, (r() - 0.5) * def.var * 2), shade(def.base, (r() - 0.5) * def.var * 2)]);
    for (let j = -3; j <= 3; j++) {
      for (let i = -nI * 2; i <= nI * 3; i++) {
        const ox = i * W + j * L, oy = i * W - j * L;
        const [c1, c2] = cols[((i % nI) + nI) % nI];
        plank(ox, oy, L, W, false, c1);
        plank(ox + L, oy + W - L, W, L, true, c2);
      }
    }
    ctx.restore();
    return { canvas: c, tile };
  }

  if (def.kind === 'tiles') {
    const a = def.size || 60, b = def.size2 || a;
    const tile = Math.max(a, b) * 2, px = S / tile;
    for (let y = 0; y < tile; y += b) {
      for (let x = 0; x < tile; x += a) {
        ctx.fillStyle = shade(def.base, (r() - 0.5) * def.var * 2);
        ctx.fillRect(x * px, y * px, a * px, b * px);
        // delikatna faktura
        for (let i = 0; i < 400; i++) {
          ctx.fillStyle = shade(def.base, (r() - 0.5) * 0.08);
          ctx.globalAlpha = 0.25;
          ctx.fillRect(x * px + r() * a * px, y * px + r() * b * px, 2, 2);
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.strokeStyle = shade(def.base, -0.25); ctx.lineWidth = 0.4 * px;
    for (let y = 0; y <= tile; y += b) { ctx.beginPath(); ctx.moveTo(0, y * px); ctx.lineTo(S, y * px); ctx.stroke(); }
    for (let x = 0; x <= tile; x += a) { ctx.beginPath(); ctx.moveTo(x * px, 0); ctx.lineTo(x * px, S); ctx.stroke(); }
    return { canvas: c, tile };
  }

  if (def.kind === 'terrazzo') {
    const tile = 120;
    const cols = ['#b9b2a6', '#8f8a82', '#d8cfc2', '#c46f4f', '#6f7d73', '#f5f2ec'];
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = cols[Math.floor(r() * cols.length)];
      ctx.globalAlpha = 0.85;
      const s = 2 + r() * 9;
      ctx.beginPath();
      ctx.ellipse(r() * S, r() * S, s, s * (0.5 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return { canvas: c, tile };
  }

  // beton / mikrocement
  const tile = 200;
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = shade(def.base, (r() - 0.5) * def.var * 3);
    ctx.globalAlpha = 0.18;
    const s = 4 + r() * 40;
    ctx.beginPath(); ctx.arc(r() * S, r() * S, s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  return { canvas: c, tile };
}
