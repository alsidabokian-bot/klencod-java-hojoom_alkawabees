// تصادم ساكن: صناديق مدوّرة (OBB) وأسطوانات، مع شبكة مكانية
const Physics = {
  cell: 40, cols: [], grid: new Map(), stamp: 0,
  reset() { this.cols = []; this.grid = new Map(); this.stamp = 0; },
  _k(xi, zi) { return (zi + 400) * 1000 + (xi + 400); },
  add(c) {
    const i = this.cols.length; c.stamp = 0; this.cols.push(c);
    const e = c.t === 0 ? Math.hypot(c.hx, c.hz) : c.r, cs = this.cell;
    const x0 = Math.floor((c.x - e) / cs), x1 = Math.floor((c.x + e) / cs), z0 = Math.floor((c.z - e) / cs), z1 = Math.floor((c.z + e) / cs);
    for (let zi = z0; zi <= z1; zi++) for (let xi = x0; xi <= x1; xi++) {
      const k = this._k(xi, zi); let a = this.grid.get(k); if (!a) { a = []; this.grid.set(k, a); } a.push(c);
    }
  },
  each(x, z, rad, fn) {
    const cs = this.cell, st = ++this.stamp;
    const x0 = Math.floor((x - rad) / cs), x1 = Math.floor((x + rad) / cs), z0 = Math.floor((z - rad) / cs), z1 = Math.floor((z + rad) / cs);
    for (let zi = z0; zi <= z1; zi++) for (let xi = x0; xi <= x1; xi++) {
      const a = this.grid.get(this._k(xi, zi)); if (!a) continue;
      for (let i = 0; i < a.length; i++) { const c = a[i]; if (c.stamp === st) continue; c.stamp = st; fn(c); }
    }
  },
  _solid(x, y, z, m) {
    const cs = this.cell, rad = m + 1;
    const x0 = Math.floor((x - rad) / cs), x1 = Math.floor((x + rad) / cs), z0 = Math.floor((z - rad) / cs), z1 = Math.floor((z + rad) / cs);
    for (let zi = z0; zi <= z1; zi++) for (let xi = x0; xi <= x1; xi++) {
      const a = this.grid.get(this._k(xi, zi)); if (!a) continue;
      for (let i = 0; i < a.length; i++) {
        const c = a[i];
        if (y < c.y0 - m || y > c.y1 + m) continue;
        const dx = x - c.x, dz = z - c.z;
        if (c.t === 0) { const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c; if (Math.abs(lx) < c.hx + m && Math.abs(lz) < c.hz + m) return true; }
        else { const rr = c.r + m; if (dx * dx + dz * dz < rr * rr) return true; }
      }
    }
    return false;
  },
  pointSolid(x, y, z, margin) { if (y < groundHeight(x, z) + .25) return true; return this._solid(x, y, z, margin || 0); },
  solidStrict(x, y, z) { if (y < groundHeight(x, z)) return true; return this._solid(x, y, z, 0); },
  rayHit(ox, oy, oz, dx, dy, dz, max) {
    let prev = 0, t = .5;
    while (t <= max) {
      if (this.solidStrict(ox + dx * t, oy + dy * t, oz + dz * t)) {
        let lo = prev, hi = t;
        for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (this.solidStrict(ox + dx * m, oy + dy * m, oz + dz * m)) hi = m; else lo = m; }
        return { t: hi, p: [ox + dx * hi, oy + dy * hi, oz + dz * hi] };
      }
      prev = t; t += .3 + t * .01;
    }
    return null;
  },
  // يحلّ تصادم اللاعب: p = {x,y,z,vx,vy,vz,prevY,r,h,grounded}
  resolve(p) {
    const r = p.r, h = p.h;
    this.each(p.x, p.z, r + 1, c => {
      const dx = p.x - c.x, dz = p.z - c.z;
      let lx, lz, inside;
      if (c.t === 0) { lx = dx * c.c - dz * c.s; lz = dx * c.s + dz * c.c; inside = Math.abs(lx) < c.hx + .25 && Math.abs(lz) < c.hz + .25; }
      else inside = Math.hypot(dx, dz) < c.r + .25;
      const top = c.y1, bot = c.y0;
      if (inside && p.y < top && p.y >= top - .55 && p.prevY >= top - .55) {
        p.y = top; if (p.vy < 0) { p.impact = p.vy; p.vy = 0; } p.grounded = true; return;
      }
      if (p.y < top && p.y + h > bot) {
        if (inside && p.prevY + h <= bot + .05 && p.vy > 0) { p.y = bot - h; p.vy = 0; return; }
        let nx = 0, nz = 0, pen = 0;
        if (c.t === 0) {
          const qx = M.clamp(lx, -c.hx, c.hx), qz = M.clamp(lz, -c.hz, c.hz);
          let ox = lx - qx, oz = lz - qz; const d = Math.hypot(ox, oz);
          if (d >= r) return;
          if (d > 1e-5) { ox /= d; oz /= d; pen = r - d; }
          else {
            const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
            if (px < pz) { ox = Math.sign(lx) || 1; oz = 0; pen = px + r; } else { ox = 0; oz = Math.sign(lz) || 1; pen = pz + r; }
          }
          nx = ox * c.c + oz * c.s; nz = -ox * c.s + oz * c.c;
        } else {
          const d = Math.hypot(dx, dz); if (d >= c.r + r) return;
          if (d > 1e-5) { nx = dx / d; nz = dz / d; } else { nx = 1; nz = 0; }
          pen = c.r + r - d;
        }
        p.x += nx * pen; p.z += nz * pen;
        const vd = p.vx * nx + p.vz * nz;
        if (vd < 0) { p.vx -= vd * nx; p.vz -= vd * nz; }
      }
    });
  },
};
