// Zapis w localStorage + kodowanie projektu w linku (#p=...).

const KEY_CURRENT = 'hp:current';
const KEY_PROJECTS = 'hp:projects';
const KEY_SETTINGS = 'hp:settings';

function safeGet(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const store = {
  loadCurrent: () => safeGet(KEY_CURRENT),
  saveCurrent: (doc) => safeSet(KEY_CURRENT, doc),
  loadSettings: () => safeGet(KEY_SETTINGS) || {},
  saveSettings: (s) => safeSet(KEY_SETTINGS, s),
  listProjects() {
    const all = safeGet(KEY_PROJECTS) || {};
    return Object.entries(all)
      .map(([name, p]) => ({ name, savedAt: p.savedAt, count: (p.doc.items || []).length, doc: p.doc }))
      .sort((a, b) => b.savedAt - a.savedAt);
  },
  saveProject(name, doc) {
    const all = safeGet(KEY_PROJECTS) || {};
    all[name] = { savedAt: Date.now(), doc };
    return safeSet(KEY_PROJECTS, all);
  },
  deleteProject(name) {
    const all = safeGet(KEY_PROJECTS) || {};
    delete all[name];
    return safeSet(KEY_PROJECTS, all);
  },
};

// --- link -------------------------------------------------------------

const b64url = {
  encode(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(str) {
    const s = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s + '==='.slice((s.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function encodeDoc(doc) {
  const json = new TextEncoder().encode(JSON.stringify(doc));
  if ('CompressionStream' in window) {
    try { return 'z' + b64url.encode(await pipe(json, new CompressionStream('deflate-raw'))); } catch { /* fallback */ }
  }
  return 'j' + b64url.encode(json);
}

export async function decodeDoc(str) {
  const kind = str[0];
  const bytes = b64url.decode(str.slice(1));
  const raw = kind === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
  return JSON.parse(new TextDecoder().decode(raw));
}

export function buildShareUrl(code) {
  const url = new URL(window.location.href);
  url.hash = 'p=' + code;
  return url.toString();
}

export function readHashParams() {
  const out = {};
  for (const part of window.location.hash.replace(/^#/, '').split('&')) {
    const i = part.indexOf('=');
    if (i > 0) out[decodeURIComponent(part.slice(0, i))] = decodeURIComponent(part.slice(i + 1));
  }
  return out;
}

export function readHashCode() {
  const m = window.location.hash.match(/[#&]p=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}
