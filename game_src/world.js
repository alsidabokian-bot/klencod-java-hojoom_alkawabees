const WORLD = { half: 1000, chunk: 125, n: 16, cityR: 512, wallR: 520, wallH: 52, wallT: 16 };

// ---------- ضوضاء وارتفاعات التضاريس ----------
function _h(a, b) {
  let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = _h(xi, zi), b = _h(xi + 1, zi), c = _h(xi, zi + 1), d = _h(xi + 1, zi + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm2(x, z, o) {
  let s = 0, a = .5;
  for (let i = 0; i < o; i++) { s += a * noise2(x, z); x = x * 2.03 + 17.1; z = z * 2.03 + 17.1; a *= .5; }
  return s;
}
const sstep = (a, b, x) => { const t = M.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const w = sstep(545, 780, r);
  if (w <= 0) return 0;
  const hills = fbm2(x * .004, z * .004, 4) * 120 + fbm2(x * .012 + 9, z * .012, 3) * 20;
  const far = sstep(850, 1100, r);
  const mount = far * (fbm2(x * .006 + 3, z * .006, 4) * 260 + 50);
  return w * hills + mount;
}
// بُعد الطريق عن المحاور خارج السور (يطابق الشيدر تقريبًا)
function roadDist(x, z) {
  const r = Math.hypot(x, z), far = sstep(520, 700, r);
  const sw = (noise2(z * .012, 3) - .5) * 34 * far, sw2 = (noise2(x * .012, 9) - .5) * 34 * far;
  return Math.min(Math.abs(x - sw), Math.abs(z - sw2));
}

// ---------- بنّاء العالم: يجمع المجسمات في قطع مكانية ----------
class WorldBuilder {
  constructor(r) { this.r = r; this.chunks = new Map(); this.tmp = new Float32Array(20); this.count = 0; }
  key(x, z) {
    const n = WORLD.n, ci = M.clamp(Math.floor((x + WORLD.half) / WORLD.chunk), 0, n - 1), cj = M.clamp(Math.floor((z + WORLD.half) / WORLD.chunk), 0, n - 1);
    return cj * n + ci;
  }
  chunk(x, z) {
    const k = this.key(x, z);
    let c = this.chunks.get(k);
    if (!c) { c = { lists: {}, mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9], terrain: null }; this.chunks.set(k, c); }
    return c;
  }
  add(mesh, x, y, z, yaw, pitch, sx, sy, sz, col, mat) {
    const c = this.chunk(x, z);
    const t = this.tmp;
    M.mat4.trsInto(t, 0, x, y, z, yaw, pitch, sx, sy, sz);
    t[16] = col[0]; t[17] = col[1]; t[18] = col[2]; t[19] = mat || 0;
    const l = c.lists[mesh] || (c.lists[mesh] = []);
    for (let i = 0; i < 20; i++) l.push(t[i]);
    if (mesh === 'cube' || mesh === 'prism') {
      const cy = Math.cos(yaw), sy2 = Math.sin(yaw);
      if (mesh === 'cube') Physics.add({ t: 0, x, z, c: cy, s: sy2, hx: sx / 2, hz: sz / 2, y0: y - sy / 2, y1: y + sy / 2 });
      else Physics.add({ t: 0, x, z, c: cy, s: sy2, hx: sx * .22, hz: sz / 2, y0: y - sy / 2, y1: y - sy / 2 + sy * .55 });
    } else if (mesh === 'cyl') Physics.add({ t: 1, x, z, r: sx / 2, y0: y - sy / 2, y1: y + sy / 2 });
    const e = .5 * Math.hypot(sx, sy, sz);
    c.mn[0] = Math.min(c.mn[0], x - e); c.mn[1] = Math.min(c.mn[1], y - e); c.mn[2] = Math.min(c.mn[2], z - e);
    c.mx[0] = Math.max(c.mx[0], x + e); c.mx[1] = Math.max(c.mx[1], y + e); c.mx[2] = Math.max(c.mx[2], z + e);
    this.count++;
  }
  // قطعة تضاريس لكل خلية مكانية
  terrainFor(ci, cj) {
    const S = WORLD.chunk, N = 24, step = S / N;
    const x0 = -WORLD.half + ci * S, z0 = -WORLD.half + cj * S;
    const V = N + 1, verts = new Float32Array(V * V * 6);
    let lo = 1e9, hi = -1e9;
    const H = (x, z) => groundHeight(x, z);
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
      const x = x0 + i * step, z = z0 + j * step, y = H(x, z);
      const dx = H(x + 1.5, z) - H(x - 1.5, z), dz = H(x, z + 1.5) - H(x, z - 1.5);
      const nl = Math.hypot(dx, 3, dz), o = (j * V + i) * 6;
      verts[o] = x; verts[o + 1] = y; verts[o + 2] = z; verts[o + 3] = -dx / nl; verts[o + 4] = 3 / nl; verts[o + 5] = -dz / nl;
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    const idx = new Uint16Array(N * N * 6);
    let k = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * V + i, b = a + 1, c = a + V, d = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
    return { mesh: this.r.makeMesh(verts, idx), lo, hi, x0, z0 };
  }
  finalize() {
    const r = this.r, out = [], n = WORLD.n, S = WORLD.chunk;
    for (let cj = 0; cj < n; cj++) for (let ci = 0; ci < n; ci++) {
      const key = cj * n + ci;
      let c = this.chunks.get(key);
      if (!c) { c = { lists: {}, mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] }; }
      const batches = [];
      const T = this.terrainFor(ci, cj);
      const tb = new InstanceBatch(r, T.mesh, 1);
      const id = new Float32Array(20); id[0] = id[5] = id[10] = id[15] = 1; id[16] = id[17] = id[18] = 1; id[19] = 3;
      tb.setRaw(id); batches.push(tb);
      c.mn[0] = Math.min(c.mn[0], T.x0); c.mx[0] = Math.max(c.mx[0], T.x0 + S);
      c.mn[2] = Math.min(c.mn[2], T.z0); c.mx[2] = Math.max(c.mx[2], T.z0 + S);
      c.mn[1] = Math.min(c.mn[1], T.lo); c.mx[1] = Math.max(c.mx[1], T.hi);
      for (const name in c.lists) {
        const b = new InstanceBatch(r, r.meshes[name], 1);
        b.setRaw(new Float32Array(c.lists[name])); batches.push(b);
      }
      const cx = (c.mn[0] + c.mx[0]) / 2, cy = (c.mn[1] + c.mx[1]) / 2, cz = (c.mn[2] + c.mx[2]) / 2;
      out.push({ cx, cy, cz, radius: .5 * Math.hypot(c.mx[0] - c.mn[0], c.mx[1] - c.mn[1], c.mx[2] - c.mn[2]), batches });
    }
    return out;
  }
}

// ---------- ألوان ----------
const COL = {
  plaster: [0xd8c9a8, 0xc9b896, 0xbfa987, 0xe0d3b6, 0xb7a78c, 0xcdbba0, 0xa89a86, 0xa5705a, 0x9aa0a4].map(M.rgb),
  roofs: [0xa9483a, 0x9a4034, 0x4a5666, 0x6b4a3a, 0x4c7a70, 0x7a3b2e].map(M.rgb),
  stone: M.rgb(0xb4aea2), stoneD: M.rgb(0x9a958a), slate: M.rgb(0x3e5470), wood: M.rgb(0x6b4a2e),
  trunk: M.rgb(0x5a4128), pine: [0x2f5a2c, 0x3a6a30, 0x26502a].map(M.rgb), leaf: [0x4f7a2c, 0x5f8a34, 0x6a8f3a, 0x8a8a2c].map(M.rgb),
  banner: M.rgb(0x16284a), gold: M.rgb(0xe3c15a),
  awn: [0xb83a2e, 0x2e5aa8, 0xd8a62a, 0x3a8a4a, 0xe8e2d0].map(M.rgb),
};

// ---------- الأسوار والأبراج والبوابات ----------
function buildWalls(wb) {
  const R = WORLD.wallR, H = WORLD.wallH, T = WORLD.wallT, K = 48;
  const pts = [];
  for (let k = 0; k < K; k++) { const a = k / K * Math.PI * 2; pts.push([R * Math.cos(a), R * Math.sin(a)]); }
  const gate = k => k % 12 === 0;
  const GAP = 15;
  for (let k = 0; k < K; k++) {
    const p = pts[k], q = pts[(k + 1) % K];
    let dx = q[0] - p[0], dz = q[1] - p[1];
    const len = Math.hypot(dx, dz); dx /= len; dz /= len;
    const s0 = gate(k) ? GAP : 0, s1 = gate((k + 1) % K) ? GAP : 0;
    const L = len - s0 - s1, mid = s0 + L / 2;
    const cx = p[0] + dx * mid, cz = p[1] + dz * mid, yaw = Math.atan2(-dz, dx);
    wb.add('cube', cx, H / 2, cz, yaw, 0, L + 1, H, T, COL.stone, 4);
    // الشرفات (merlons) على الحافتين
    const nx = -dz, nz = dx;
    for (const side of [-1, 1]) {
      const m = Math.max(2, Math.floor(L / 6.5));
      for (let i = 0; i < m; i++) {
        const t = s0 + (i + .5) * L / m;
        wb.add('cube', p[0] + dx * t + nx * side * (T / 2 - .8), H + 1.7, p[1] + dz * t + nz * side * (T / 2 - .8), yaw, 0, 3, 3.4, 1.6, COL.stoneD, 4);
      }
    }
    // الأبراج على الزوايا غير البوابات
    if (!gate(k)) {
      wb.add('cyl', p[0], (H + 14) / 2, p[1], 0, 0, 26, H + 14, 26, COL.stone, 5);
      wb.add('cyl', p[0], H + 14 + 1, p[1], 0, 0, 29, 2.4, 29, COL.stoneD, 5);
      wb.add('cone', p[0], H + 14 + 2.4 + 11, p[1], 0, 0, 31, 22, 31, COL.slate, 7);
    }
  }
  // رايات على الأبراج الدائرية (كل ثالث برج)
  for (let k = 0; k < K; k += 3) {
    if (gate(k)) continue;
    const a = k / K * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), yaw = Math.atan2(-c, -s);
    const bx = pts[k][0] + c * 13.4, bz = pts[k][1] + s * 13.4;
    wb.add('cube', bx, 52, bz, yaw, 0, 4.6, 14, .35, COL.banner, 0);
    wb.add('cube', bx, 52, bz, yaw, 0, 1.1, 14.2, .42, COL.gold, 0);
    wb.add('cube', bx, 44.6, bz, yaw, 0, 4.9, .6, .45, COL.gold, 0);
  }
  // بوابات: برجان مربعان وعتبة علوية
  for (let k = 0; k < K; k += 12) {
    const a = k / K * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const tx = -s, tz = c, yaw = Math.atan2(-tz, tx);
    for (const side of [-1, 1]) {
      const bx = R * c + tx * side * (GAP + 9), bz = R * s + tz * side * (GAP + 9);
      wb.add('cube', bx, 40, bz, yaw, 0, 24, 80, 26, COL.stone, 4);
      wb.add('cube', bx, 81.2, bz, yaw, 0, 27, 2.4, 29, COL.stoneD, 4);
      wb.add('cone4', bx, 81.2 + 1.2 + 12, bz, yaw + Math.PI / 4, 0, 34, 24, 34, COL.slate, 7);
      const ox = c * 13.4, oz = s * 13.4;
      wb.add('cube', bx + ox, 58, bz + oz, yaw, 0, 6, 20, .4, COL.banner, 0);
      wb.add('cube', bx + ox, 58, bz + oz, yaw, 0, 1.4, 20.2, .48, COL.gold, 0);
      wb.add('cube', bx + ox, 47, bz + oz, yaw, 0, 6.4, .8, .5, COL.gold, 0);
    }
    wb.add('cube', R * c, H - 4, R * s, yaw, 0, GAP * 2 + 1, 16, T, COL.stoneD, 4);
    wb.add('cube', R * c, H + 1.7, R * s, yaw, 0, GAP * 2 + 1, 3.4, 2, COL.stoneD, 4);
  }
}

// ---------- المباني ----------
function buildCity(wb) {
  const rand = M.rng(7731), P = 28, IN = 468;
  const pick = a => a[(rand() * a.length) | 0];
  for (let i = -17; i <= 17; i++) for (let j = -17; j <= 17; j++) {
    if (i % 5 === 0 || j % 5 === 0) continue;
    const x = i * P + (rand() - .5) * 2, z = j * P + (rand() - .5) * 2;
    const d = Math.hypot(x, z);
    if (d > IN || d < 118) continue;
    const yaw = (rand() - .5) * .12;
    const w = 14 + rand() * 7, dd = 14 + rand() * 7;
    let h = 9 + rand() * 10 + (1 - d / IN) * rand() * 26;
    if (rand() < .07) h += 18 + rand() * 20;
    const wall = pick(COL.plaster);
    if (h < 22) {
      const hh = Math.floor(h / 3) * 3 + 1;
      wb.add('cube', x, hh / 2, z, yaw, 0, w, hh, dd, wall, 2);
      const rh = Math.min(w, dd) * (.38 + rand() * .15), roof = pick(COL.roofs);
      if (dd >= w) wb.add('prism', x, hh + rh / 2 - .1, z, yaw, 0, w + 1.6, rh, dd + 1.6, roof, 7);
      else wb.add('prism', x, hh + rh / 2 - .1, z, yaw + Math.PI / 2, 0, dd + 1.6, rh, w + 1.6, roof, 7);
      if (rand() < .5) wb.add('cube', x + (rand() - .5) * w * .5, hh + rh + 1.2, z + (rand() - .5) * dd * .3, yaw, 0, 1.6, 4.5, 1.6, COL.stoneD, 0);
    } else {
      const hh = Math.floor(h / 3) * 3 + 1;
      wb.add('cube', x, hh / 2, z, yaw, 0, w, hh, dd, wall, 2);
      wb.add('cube', x, hh + .8, z, yaw, 0, w + 1.4, 1.6, dd + 1.4, COL.stone, 4);
      if (rand() < .55) {
        const roof = pick(COL.roofs);
        wb.add('cone4', x, hh + 1.6 + 6, z, yaw + Math.PI / 4, 0, w * 1.05, 12, dd * 1.05, roof, 7);
      } else wb.add('cube', x, hh + 1.6 + 1.5, z, yaw, 0, w * .4, 3, dd * .4, COL.stoneD, 0);
    }
    if (rand() < .35) {
      const ax = x + (rand() < .5 ? -1 : 1) * (w / 2 + 3), az = z + (rand() - .5) * 6;
      wb.add('cube', ax, 2.6, az, yaw, 0, 6, 5.2, 8, pick(COL.plaster), 2);
      wb.add('prism', ax, 5.2 + 1.1, az, yaw + Math.PI / 2, 0, 9, 2.2, 7.4, pick(COL.roofs), 7);
    }
  }
}

// ---------- القلعة المركزية والساحة ----------
function buildKeep(wb) {
  wb.add('cube', 0, 32, 0, 0, 0, 46, 64, 46, COL.stone, 4);
  wb.add('cube', 0, 65, 0, 0, 0, 50, 2.4, 50, COL.stoneD, 4);
  for (let i = 0; i < 8; i++) for (const sd of [-1, 1]) {
    const o = -21 + i * 6;
    wb.add('cube', o, 67.4, sd * 24, 0, 0, 3, 3, 1.6, COL.stoneD, 4);
    wb.add('cube', sd * 24, 67.4, o, 0, 0, 1.6, 3, 3, COL.stoneD, 4);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    wb.add('cyl', sx * 26, 42, sz * 26, 0, 0, 14, 84, 14, COL.stone, 5);
    wb.add('cone', sx * 26, 84 + 14, sz * 26, 0, 0, 18, 28, 18, COL.slate, 7);
  }
  wb.add('cyl', 0, 60, 0, 0, 0, 20, 120, 20, COL.stone, 5);
  wb.add('cyl', 0, 120.6, 0, 0, 0, 23, 2.4, 23, COL.stoneD, 5);
  wb.add('cone', 0, 121.8 + 17, 0, 0, 0, 25, 34, 25, COL.slate, 7);
  // سور القلعة المنخفض (مفتوح من جهة الجنوب)
  const W = 90, hh = 14, t = 5;
  wb.add('cube', 0, hh / 2, -W, 0, 0, W * 2 + t, hh, t, COL.stone, 4);
  wb.add('cube', -W, hh / 2, 0, 0, 0, t, hh, W * 2, COL.stone, 4);
  wb.add('cube', W, hh / 2, 0, 0, 0, t, hh, W * 2, COL.stone, 4);
  wb.add('cube', -W / 2 - 8, hh / 2, W, 0, 0, W - 16, hh, t, COL.stone, 4);
  wb.add('cube', W / 2 + 8, hh / 2, W, 0, 0, W - 16, hh, t, COL.stone, 4);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    wb.add('cyl', sx * W, 12, sz * W, 0, 0, 13, 24, 13, COL.stone, 5);
    wb.add('cone', sx * W, 24 + 6, sz * W, 0, 0, 16, 12, 16, COL.slate, 7);
  }
  // أكشاك السوق
  const rand = M.rng(99);
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2, r = 150 + (i % 2) * 14;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, yaw = -a + Math.PI / 2;
    wb.add('cube', x, 1.2, z, yaw, 0, 5.5, 2.4, 3, COL.wood, 0);
    wb.add('prism', x, 3.2, z, yaw + Math.PI / 2, 0, 3.6, 1.6, 6, COL.awn[(rand() * COL.awn.length) | 0], 0);
  }
}

// ---------- الغابات خارج السور ----------
function buildForest(wb) {
  const rand = M.rng(4242);
  let placed = 0;
  for (let n = 0; n < 9000 && placed < 3600; n++) {
    const a = rand() * Math.PI * 2, r = 575 + Math.sqrt(rand()) * 400;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (roadDist(x, z) < 12) continue;
    if (fbm2(x * .01 + 40, z * .01, 3) < .46) continue;
    const y = groundHeight(x, z);
    if (Math.abs(groundHeight(x + 3, z) - y) + Math.abs(groundHeight(x, z + 3) - y) > 4.5) continue;
    if (y > 130) continue;
    placed++;
    const s = .75 + rand() * .7;
    if (rand() < .6) {
      const c = COL.pine[(rand() * 3) | 0];
      wb.add('cyl', x, y + 2.2 * s, z, 0, 0, 1.1 * s, 4.4 * s, 1.1 * s, COL.trunk, 0);
      wb.add('cone', x, y + (4 + 4) * s, z, 0, 0, 9 * s, 8 * s, 9 * s, c, 6);
      wb.add('cone', x, y + (7 + 3.5) * s, z, 0, 0, 7 * s, 7 * s, 7 * s, c, 6);
      wb.add('cone', x, y + (10 + 3) * s, z, 0, 0, 5 * s, 6 * s, 5 * s, c, 6);
    } else {
      wb.add('cyl', x, y + 2.6 * s, z, 0, 0, 1.3 * s, 5.2 * s, 1.3 * s, COL.trunk, 0);
      wb.add('sphere', x, y + 8 * s, z, 0, 0, 10 * s, 8.5 * s, 10 * s, COL.leaf[(rand() * 4) | 0], 6);
    }
  }
}

function buildWorld(r) {
  r.cityR = WORLD.cityR; Physics.reset();
  const wb = new WorldBuilder(r);
  buildWalls(wb); buildCity(wb); buildKeep(wb); buildForest(wb);
  const chunks = wb.finalize();
  return { chunks, instances: wb.count };
}
