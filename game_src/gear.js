// معدات الخطاف: خطافان بحبال، غاز، جسيمات (بخار وشرر)
class Gear {
  constructor(r) {
    this.rope = new InstanceBatch(r, r.meshes.cube, 16);
    this.sph = new InstanceBatch(r, r.meshes.sphere, 240);
    this.chunk = { cx: 0, cy: 0, cz: 0, radius: 1e5, noShadow: true, batches: [this.rope, this.sph] };
    this.hooks = [0, 1].map(() => ({ s: 0, t: 0, T: 0, hit: false, ox: 0, oy: 0, oz: 0, tx: 0, ty: 0, tz: 0, ax: 0, ay: 0, az: 0, len: 0, reel: false }));
    this.gas = 100; this.maxGas = 100; this.regen = 1;
    this.aim = { hit: false, dist: 140, point: [0, 0, 0] };
    this.pts = []; this.giants = [];
    this.ropeCol = M.rgb(0xcfd6dc); this.headCol = M.rgb(0x2b2f33);
    this.dust = M.rgb(0xb9a98c); this.steam = M.rgb(0xf2f4f6); this.spark = M.rgb(0xffb43a);
  }
  gearPos(p, sd) {
    const cy = Math.cos(p.face), sy = Math.sin(p.face), x = sd * .27;
    return [p.x + cy * x, p.y + 1.0, p.z - sy * x];
  }
  anyAttached() { return this.hooks.some(h => h.s !== 0); }
  releaseAll() { for (const h of this.hooks) h.s = 0; }
  emit(x, y, z, vx, vy, vz, life, size, col, rise) { if (this.pts.length < 230) this.pts.push({ x, y, z, vx, vy, vz, life, max: life, size, col, rise }); }
  // قبل تحديث اللاعب: تصويب + ضغطات الأزرار + الغاز
  control(p, cam, chase, dt) {
    const f = cam.fwd, ds = chase.cur;
    const ox = cam.pos[0] + f[0] * ds, oy = cam.pos[1] + f[1] * ds, oz = cam.pos[2] + f[2] * ds;
    const h = Physics.rayHit(ox, oy, oz, f[0], f[1], f[2], 140);
    this.aim.hit = !!h; this.aim.giant = null;
    this.aim.point = h ? h.p : [ox + f[0] * 140, oy + f[1] * 140, oz + f[2] * 140];
    this.aim.dist = h ? h.t : 140;
    // هل يصيب الشعاع عملاقًا قبل أي سطح؟
    let bt = h ? h.t : 140, bg = null;
    for (const gi of this.giants) {
      if (!gi.alive) continue;
      for (const q of gi.parts) {
        const ex = ox - q.x, ey = oy - q.y, ez = oz - q.z;
        const b = ex * f[0] + ey * f[1] + ez * f[2], c2 = ex * ex + ey * ey + ez * ez - q.r * q.r, disc = b * b - c2;
        if (disc < 0) continue;
        const t = -b - Math.sqrt(disc);
        if (t > .5 && t < bt) { bt = t; bg = gi; }
      }
    }
    if (bg) { this.aim.hit = true; this.aim.dist = bt; this.aim.point = [ox + f[0] * bt, oy + f[1] * bt, oz + f[2] * bt]; this.aim.giant = bg; this.aim.off = [this.aim.point[0] - bg.x, this.aim.point[1] - bg.y, this.aim.point[2] - bg.z]; }
    for (let i = 0; i < 2; i++) {
      const hk = this.hooks[i], sd = i ? 1 : -1;
      if (Input.pressed(i ? 'hookR' : 'hookL', i ? 'KeyE' : 'KeyQ') && p.alive) {
        if (hk.s !== 0) hk.s = 0;
        else {
          const g = this.gearPos(p, sd);
          hk.ox = g[0]; hk.oy = g[1]; hk.oz = g[2];
          hk.tx = this.aim.point[0]; hk.ty = this.aim.point[1]; hk.tz = this.aim.point[2];
          hk.hit = this.aim.hit; hk.giant = this.aim.giant; hk.off = this.aim.off;
          const d = Math.hypot(hk.tx - hk.ox, hk.ty - hk.oy, hk.tz - hk.oz);
          hk.T = hk.hit ? Math.max(.05, d / 170) : .3; hk.t = 0; hk.s = 1; Sound.hook();
        }
      }
    }
    // الغاز
    const wantBoost = Input.held('gas', 'ShiftLeft');
    const attached = this.hooks.some(h => h.s === 2);
    p.boosting = p.alive && wantBoost && this.gas > 0;
    if (p.boosting) {
      let bx = f[0], by = f[1], bz = f[2];
      if (p.grounded) { by = .25; const l = Math.hypot(bx, by, bz); bx /= l; by /= l; bz /= l; }
      p.boostDir = [bx, by, bz];
      this.gas = Math.max(0, this.gas - 24 * dt);
    } else this.gas = Math.min(this.maxGas, this.gas + (p.grounded ? 30 : 3) * this.regen * dt);
    for (const hk of this.hooks) {
      hk.reel = hk.s === 2 && p.boosting;
      if (hk.reel) hk.len = Math.max(3, hk.len - 22 * dt);
    }
    p.hooks = this.hooks;
    return attached;
  }
  // بعد تحديث اللاعب: تقدّم الخطافات ورسم الحبال والجسيمات
  render(p, dt, time) {
    this.rope.count = 0; this.rope.dirty = true;
    this.sph.count = 0; this.sph.dirty = true;
    for (let i = 0; i < 2; i++) {
      const hk = this.hooks[i], g = this.gearPos(p, i ? 1 : -1);
      if (hk.giant && hk.s !== 0) {
        if (!hk.giant.alive) hk.s = 0;
        else { const gx = hk.giant.x + hk.off[0], gy = hk.giant.y + hk.off[1], gz = hk.giant.z + hk.off[2]; if (hk.s === 1) { hk.tx = gx; hk.ty = gy; hk.tz = gz; } else { hk.ax = gx; hk.ay = gy; hk.az = gz; } }
      }
      if (hk.s === 0) continue;
      if (hk.s === 1) {
        hk.t += dt;
        if (hk.t >= hk.T) {
          if (hk.hit) {
            hk.s = 2; Sound.attach(); hk.ax = hk.tx; hk.ay = hk.ty; hk.az = hk.tz;
            hk.len = Math.hypot(p.x - hk.ax, p.y + 1 - hk.ay, p.z - hk.az);
            for (let k = 0; k < 10; k++) this.emit(hk.ax, hk.ay, hk.az, (Math.random() - .5) * 9, Math.random() * 6, (Math.random() - .5) * 9, .35, .12, this.spark, -6);
          } else hk.s = 0;
        }
      }
      if (hk.s === 0) continue;
      let ex, ey, ez;
      if (hk.s === 2) { ex = hk.ax; ey = hk.ay; ez = hk.az; }
      else { const u = Math.min(hk.t / hk.T, 1); ex = hk.ox + (hk.tx - hk.ox) * u; ey = hk.oy + (hk.ty - hk.oy) * u; ez = hk.oz + (hk.tz - hk.oz) * u; }
      this.line(g[0], g[1], g[2], ex, ey, ez, .07);
      this.rope.add(ex, ey, ez, 0, 0, .16, .16, .16, this.headCol, 0);
    }
    // بخار الغاز
    if (p.boosting) {
      const cy = Math.cos(p.face), sy = Math.sin(p.face);
      for (let k = 0; k < 2; k++) {
        const bx = p.x + sy * .35 + (Math.random() - .5) * .3, by = p.y + 1.3 + Math.random() * .2, bz = p.z + cy * .35;
        this.emit(bx, by, bz, -p.boostDir[0] * 4 + (Math.random() - .5) * 2 + p.vx * .3, -p.boostDir[1] * 4 + Math.random() * 2, -p.boostDir[2] * 4 + (Math.random() - .5) * 2 + p.vz * .3, .5 + Math.random() * .25, .17, this.steam, 1.5);
      }
    }
    const pts = this.pts;
    for (let i = pts.length - 1; i >= 0; i--) {
      const q = pts[i]; q.life -= dt;
      if (q.life <= 0) { pts[i] = pts[pts.length - 1]; pts.pop(); continue; }
      const dr = Math.exp(-1.8 * dt);
      q.vx *= dr; q.vy = q.vy * dr + q.rise * dt; q.vz *= dr;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const f = q.life / q.max, s = q.size * (1.6 - f) * Math.min(1, f * 3);
      this.sph.add(q.x, q.y, q.z, 0, 0, s, s, s, q.col, 0);
    }
    this.chunk.cx = p.x; this.chunk.cy = p.y; this.chunk.cz = p.z;
  }
  line(ax, ay, az, bx, by, bz, th) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
    if (len < .01) return;
    this.rope.add((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, Math.atan2(dx, dz), -Math.asin(dy / len), th, th, len, this.ropeCol, 0);
  }
}
