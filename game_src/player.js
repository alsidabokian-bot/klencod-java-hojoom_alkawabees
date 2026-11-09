class Player {
  constructor(x, z, yaw) {
    this.x = x; this.z = z; this.y = groundHeight(x, z);
    this.vx = this.vy = this.vz = 0; this.prevY = this.y;
    this.r = .45; this.h = 1.8; this.face = yaw || 0;
    this.grounded = true; this.coyote = 0; this.speed = 0;
    this.maxSpeed = 11; this.jumpV = 9.5; this.gravity = 28;
    this.impact = 0; this.reelPull = 34; this.hooks = []; this.boosting = false; this.boostDir = [0, 0, 0]; this.speed3 = 0; this.swing = false;
  }
  update(dt, move, camYaw, jumpPressed) {
    this.impact = 0;
    if (!(dt > 0)) return;
    let steps = Math.max(1, Math.ceil(dt / 0.016)); const h = dt / steps;
    for (let i = 0; i < steps; i++) this._step(h, move, camYaw, i === 0 && jumpPressed);
    this.speed = Math.hypot(this.vx, this.vz); this.speed3 = Math.hypot(this.vx, this.vy, this.vz);
    this.swing = this.hooks.some(h => h.s === 2);
  }
  _step(dt, move, camYaw, jump) {
    const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
    const wx = -sy * move[1] + cy * move[0], wz = -cy * move[1] - sy * move[0];
    const wl = Math.hypot(wx, wz), mag = Math.min(1, wl);
    if (this.grounded) {
      let tx = 0, tz = 0;
      if (mag > .001) { tx = wx / wl * mag * this.maxSpeed; tz = wz / wl * mag * this.maxSpeed; }
      const accel = 55 * dt; let dx = tx - this.vx, dz = tz - this.vz; const dl = Math.hypot(dx, dz);
      if (dl > accel && dl > 1e-9) { dx *= accel / dl; dz *= accel / dl; }
      this.vx += dx; this.vz += dz;
    } else {
      if (mag > .001) {
        const ux = wx / wl, uz = wz / wl, al = this.vx * ux + this.vz * uz;
        if (al < this.maxSpeed) { const a = 16 * dt * mag; this.vx += ux * a; this.vz += uz * a; }
      }
      const k = Math.exp(-.06 * dt); this.vx *= k; this.vz *= k;
    }
    // اتجاه الوجه
    let want = null, rate = 16;
    const hs = Math.hypot(this.vx, this.vz);
    if (!this.grounded && hs > 5) { want = Math.atan2(-this.vx, -this.vz); rate = 7; }
    else if (mag > .15) want = Math.atan2(-wx, -wz);
    if (want !== null) { let d = want - this.face; d = Math.atan2(Math.sin(d), Math.cos(d)); this.face += d * Math.min(1, rate * dt); }
    this.coyote = this.grounded ? .1 : this.coyote - dt;
    if (jump && this.coyote > 0) { this.vy = this.jumpV; this.grounded = false; this.coyote = 0; }
    // دفعة الغاز
    if (this.boosting) { const A = 42 * dt; this.vx += this.boostDir[0] * A; this.vy += this.boostDir[1] * A; this.vz += this.boostDir[2] * A; }
    // السحب بالحبل
    for (const hk of this.hooks) if (hk.s === 2 && hk.reel) {
      const dx = hk.ax - this.x, dy = hk.ay - (this.y + 1), dz = hk.az - this.z, d = Math.hypot(dx, dy, dz);
      if (d > .5) { const k = this.reelPull * dt / d; this.vx += dx * k; this.vy += dy * k; this.vz += dz * k; }
    }
    this.vy -= this.gravity * dt;
    const sp = Math.hypot(this.vx, this.vy, this.vz);
    if (sp > 58) { const f = 58 / sp; this.vx *= f; this.vy *= f; this.vz *= f; }
    this.prevY = this.y;
    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
    // قيد الحبل (بندول)
    for (const hk of this.hooks) if (hk.s === 2) {
      let dx = this.x - hk.ax, dy = this.y + 1 - hk.ay, dz = this.z - hk.az;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > hk.len && dist > 1e-4) {
        dx /= dist; dy /= dist; dz /= dist;
        const ex = dist - hk.len;
        this.x -= dx * ex; this.y -= dy * ex; this.z -= dz * ex;
        const vn = this.vx * dx + this.vy * dy + this.vz * dz;
        if (vn > 0) { this.vx -= dx * vn; this.vy -= dy * vn; this.vz -= dz * vn; }
      }
    }
    this.grounded = false;
    Physics.resolve(this);
    const gh = groundHeight(this.x, this.z);
    if (this.y <= gh + (this.vy <= 0 ? .12 : 0)) { if (this.vy <= 0 || this.y < gh) { this.y = gh; if (this.vy < 0) { this.impact = this.vy; this.vy = 0; } this.grounded = true; } }
    const rr = Math.hypot(this.x, this.z);
    if (rr > 985) { this.x *= 985 / rr; this.z *= 985 / rr; }
  }
}

class ChaseCam {
  constructor() {
    this.yaw = 0; this.pitch = -.18; this.base = 8.5; this.sens = 1; this.dist = 8.5; this.cur = 8.5;
    this.tx = 0; this.ty = 0; this.tz = 0; this.init = false;
    this.cam = { pos: [0, 0, 0], fwd: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0], fov: 1.05, near: .3, far: 1800, focus: [0, 0, 0] };
  }
  look(dx, dy) { const k = .0042 * this.sens; this.yaw -= dx * k; this.pitch = M.clamp(this.pitch - dy * k, -1.25, .6); }
  update(dt, p) {
    const gx = p.x, gy = p.y + 1.55, gz = p.z;
    if (!this.init) { this.tx = gx; this.ty = gy; this.tz = gz; this.init = true; }
    const fr = 22 + p.speed3 * .9;
    this.tx = M.smooth(this.tx, gx, fr, dt); this.ty = M.smooth(this.ty, gy, 10 + p.speed3 * .5, dt); this.tz = M.smooth(this.tz, gz, fr, dt);
    this.dist = this.base + M.clamp(p.speed3 - 15, 0, 40) * .06;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch), sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fwd = [-sy * cp, sp, -cy * cp], right = [cy, 0, -sy];
    const so = .55; // إزاحة خفيفة فوق الكتف
    const ox = this.tx + right[0] * so, oy = this.ty, oz = this.tz + right[2] * so;
    // أقرب مسافة بلا اصطدام
    let free = this.dist;
    for (let i = 1; i <= 12; i++) {
      const t = this.dist * i / 12;
      if (Physics.pointSolid(ox - fwd[0] * t, oy - fwd[1] * t, oz - fwd[2] * t, .3)) { free = Math.max(1.2, this.dist * (i - 1) / 12 - .3); break; }
    }
    this.cur = free < this.cur ? M.smooth(this.cur, free, 30, dt) : M.smooth(this.cur, free, 3.5, dt);
    const c = this.cam;
    c.pos[0] = ox - fwd[0] * this.cur; c.pos[1] = oy - fwd[1] * this.cur; c.pos[2] = oz - fwd[2] * this.cur;
    c.pos[1] = Math.max(c.pos[1], groundHeight(c.pos[0], c.pos[2]) + .5);
    c.fwd = fwd; c.right = right;
    c.up = [sy * fwd[1], -sy * fwd[0] - cy * fwd[2], cy * fwd[1]];
    c.fov = M.smooth(c.fov, 1.05 + M.clamp(p.speed3 - 12, 0, 45) / 45 * .3, 3, dt);
    c.focus = [p.x + fwd[0] * 30, p.y, p.z + fwd[2] * 30];
  }
}
