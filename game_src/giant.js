// العمالقة: نموذج بشري ضخم بمفاصل + ذكاء اصطناعي. تصميم أصلي بأحجام وأجساد متنوعة.
const GIANT_SKINS = [0xe6bf9d, 0xd6a37c, 0xc08a62, 0x8a5a3c, 0xf0cfb4, 0xb98462].map(M.rgb);
const GIANT_HAIR = [0x2a1d14, 0x5a3a1e, 0x1b1b1b, 0x8a6a3a, 0xb0a090].map(M.rgb);
const GIANT_SHORTS = [0x5b4a38, 0x3d3a36, 0x6a5642].map(M.rgb);
const easeOut = t => 1 - (1 - t) * (1 - t);

class GiantRig {
  constructor(r) {
    this.cubes = new InstanceBatch(r, r.meshes.cube, 1800);
    this.sph = new InstanceBatch(r, r.meshes.sphere, 600);
    this.cyl = new InstanceBatch(r, r.meshes.cyl, 120);
    this.chunk = { cx: 0, cy: 0, cz: 0, radius: 1e5, batches: [this.cubes, this.sph, this.cyl] };
    this.pool = []; this.pi = 0; this.tmp = new Float32Array(16); this.tmp2 = new Float32Array(16);
    this.eyeW = M.rgb(0xf2efe6); this.pupil = M.rgb(0x101010); this.mouth = M.rgb(0x3a1414); this.teeth = M.rgb(0xf0eadc); this.nape = M.rgb(0xb5594a);
  }
  begin() { this.pi = 0; this.cubes.count = this.sph.count = this.cyl.count = 0; this.cubes.dirty = this.sph.dirty = this.cyl.dirty = true; }
  m() { if (this.pi >= this.pool.length) this.pool.push(new Float32Array(16)); return this.pool[this.pi++]; }
  joint(parent, x, y, z, rx, rz) {
    const out = this.m(); M.mat4.mul(out, parent, Mx.T(this.tmp, x, y, z));
    if (rx) M.mat4.mul(out, out, Mx.Rx(this.tmp2, rx));
    if (rz) M.mat4.mul(out, out, Mx.Rz(this.tmp2, rz));
    return out;
  }
  put(batch, j, ox, oy, oz, sx, sy, sz, col) {
    if (batch.count >= batch.capacity) return;
    const o = this.tmp; Mx.T(o, ox, oy, oz); o[0] = sx; o[5] = sy; o[10] = sz;
    const out = this.m(); M.mat4.mul(out, j, o);
    const i = batch.count * 20; batch.data.set(out, i);
    batch.data[i + 16] = col[0]; batch.data[i + 17] = col[1]; batch.data[i + 18] = col[2]; batch.data[i + 19] = col === this.skinCol ? 8 : 0;
    batch.count++;
  }
  // موضع نقطة محلية بالإحداثيات العالمية
  wp(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }

  draw(g, time) {
    this.pi = 0; this.skinCol = g.skin;
    const cu = this.cubes, sp = this.sph, cy = this.cyl;
    const c = g.col, w = g.w, ll = g.ll, al = g.al, hs = g.hs, belly = g.belly;
    let k = g.H / 1.8;
    const run = g.kind === 1;
    const mv = Math.min(g.speed / g.vmax, 1), sw = Math.sin(g.phase), co = Math.cos(g.phase);
    const amp = (run ? .8 : .42) * mv;
    let thL = sw * amp, thR = -sw * amp;
    let knL = (.15 + .9 * Math.max(0, co)) * mv * (run ? 1.3 : 1), knR = (.15 + .9 * Math.max(0, -co)) * mv * (run ? 1.3 : 1);
    let arL = -sw * amp * (run ? 1.7 : 1.15), arR = sw * amp * (run ? 1.7 : 1.15);
    let elL = .3 + .5 * mv * (run ? 1.5 : 1), elR = elL;
    let lean = g.lean + (run ? .35 : .12) * mv, bob = Math.abs(sw) * .05 * mv, crouch = 0, headP = 0, fall = 0, shrink = 1;
    const breathe = Math.sin(time * 1.6 + g.id) * .012;
    if (g.state === 'attack') {
      const tt = g.stateT;
      if (tt < .75) { const u = easeOut(tt / .75); arR = 2.75 * u; arL = .5 * u; lean = g.lean - .15 * u; elR = .3; thL = .25 * u; thR = -.25 * u; }
      else { const u = Math.min((tt - .75) / .25, 1); arR = 2.75 + (.3 - 2.75) * u * u; arL = .5; lean = g.lean - .15 + .65 * u; elR = .3; headP = .25 * u; }
    } else if (g.state === 'stagger') {
      thL = thR = 1.35; knL = knR = 1.6; crouch = -.5; arL = arR = .25; elL = elR = .5; lean = .38; headP = .35; bob = 0;
    } else if (g.state === 'dying') {
      const t = g.stateT;
      fall = -(Math.PI / 2) * easeOut(Math.min(t / 1.3, 1));
      thL = thR = .15; knL = knR = .2; arL = arR = .3; lean = 0;
      shrink = 1 - M.clamp((t - 2.6) / 1.9, 0, 1) * .98;
    }
    k *= shrink;
    const top = this.m();
    M.mat4.mul(top, Mx.T(this.tmp, g.x, g.y, g.z), Mx.Ry(this.tmp2, g.face));
    if (fall) M.mat4.mul(top, top, Mx.Rx(this.tmp2, fall));
    const S = Mx.I(this.tmp2); S[0] = S[5] = S[10] = k; M.mat4.mul(top, top, S);

    const T = .5 * ll, Sh = .46 * ll, hipJ = T + Sh + .09;
    const hips = this.joint(top, 0, hipJ + .05 + crouch + bob, 0, 0, 0);
    this.put(cu, hips, 0, -.02, 0, .4 * w + .03, .22, .27 * w + .02, g.shorts);
    const parts = [];
    const part = (m, x, y, z, rr, tag) => { const p = this.wp(m, x, y, z); parts.push({ x: p[0], y: p[1], z: p[2], r: rr * k, tag }); };
    part(hips, 0, 0, 0, .3 * w, 'body');
    // الساقان
    for (const [sd, th, kn] of [[-1, thL, knL], [1, thR, knR]]) {
      const hj = this.joint(hips, sd * .15 * w, -.05, 0, th, 0);
      this.put(cu, hj, 0, -T / 2, 0, .2 * w, T, .22 * w, g.skin);
      this.put(cu, hj, 0, -.1, 0, .215 * w, .17, .235 * w, g.shorts);
      const kj = this.joint(hj, 0, -T, 0, -kn, 0);
      this.put(cu, kj, 0, -Sh / 2, 0, .17 * w, Sh, .19 * w, g.skin);
      this.put(cu, kj, 0, -Sh - .04, -.05, .2 * w, .1, .34 * w, g.skin);
      part(hj, 0, -T / 2, 0, .2 * w, 'leg'); part(kj, 0, -Sh / 2, 0, .17 * w, 'leg');
    }
    // الجذع
    const torso = this.joint(hips, 0, .06 + breathe, 0, -lean, 0);
    this.put(cu, torso, 0, .3, 0, .44 * w, .56, .27 * w, g.skin);
    this.put(sp, torso, 0, .42, -.01, .5 * w, .42, .35 * w, g.skin);
    if (belly > .05) this.put(sp, torso, 0, .08, -.07, .4 * w * (1 + belly * .5), .38 * (1 + belly * .4), .34 * w * (1 + belly * .7), g.skin);
    part(torso, 0, .34, 0, .38 * w, 'body'); if (belly > .05) part(torso, 0, .08, -.05, .3 * w * (1 + belly * .4), 'body');
    // الرقبة والرأس
    const neck = this.joint(torso, 0, .68, 0, headP * .5, 0);
    this.put(cy, neck, 0, .02, 0, .13, .14, .13, g.skin);
    const head = this.joint(neck, 0, .06, 0, headP * .6 + lean * .5, 0);
    this.put(sp, head, 0, .11 * hs, 0, .25 * hs, .28 * hs, .25 * hs, g.skin);
    this.put(sp, head, 0, .03 * hs, -.045 * hs, .22 * hs, .17 * hs, .2 * hs, g.skin);
    for (const sd of [-1, 1]) {
      this.put(sp, head, sd * .05 * hs, .14 * hs, -.108 * hs, .08 * hs * g.eye, .07 * hs * g.eye, .05 * hs, this.eyeW);
      this.put(sp, head, sd * .05 * hs, .14 * hs, -.133 * hs, .036 * hs, .036 * hs, .022 * hs, this.pupil);
      this.put(sp, head, sd * .126 * hs, .1 * hs, 0, .05 * hs, .07 * hs, .03 * hs, g.skin);
    }
    this.put(cu, head, 0, .192 * hs, -.113 * hs, .19 * hs, .03 * hs, .035 * hs, g.hair);
    this.put(cu, head, 0, .09 * hs, -.133 * hs, .03 * hs, .05 * hs, .035 * hs, g.skin);
    this.put(cu, head, 0, .03 * hs, -.123 * hs, .14 * hs * g.mw, .04 * hs, .022 * hs, this.mouth);
    this.put(cu, head, 0, .043 * hs, -.128 * hs, .128 * hs * g.mw, .018 * hs, .022 * hs, this.teeth);
    if (g.hairStyle > 0) {
      this.put(sp, head, 0, .17 * hs, .02 * hs, .27 * hs, .2 * hs, .27 * hs, g.hair);
      if (g.hairStyle === 2) { this.put(cu, head, 0, .16 * hs, .06 * hs, .28 * hs, .14 * hs, .2 * hs, g.hair); }
      if (g.hairStyle === 3) { this.put(cu, head, .06 * hs, .3 * hs, 0, .08 * hs, .1 * hs, .08 * hs, g.hair); this.put(cu, head, -.05 * hs, .29 * hs, .03 * hs, .08 * hs, .09 * hs, .08 * hs, g.hair); }
    }
    this.put(cu, head, 0, .015 * hs, .128 * hs, .11 * hs, .11 * hs, .018 * hs, this.nape);
    part(head, 0, .11 * hs, 0, .22 * hs, 'head');
    const nape = this.wp(head, 0, .02 * hs, .12 * hs);
    // الذراعان
    for (const [sd, ar, el] of [[-1, arL, elL], [1, arR, elR]]) {
      const sj = this.joint(torso, sd * .29 * w, .5, 0, ar, sd * .09);
      this.put(sp, sj, 0, 0, 0, .3 * w, .3 * w, .3 * w, g.skin);
      this.put(cu, sj, 0, -.15 * al, 0, .14 * w, .3 * al, .14 * w, g.skin);
      const ej = this.joint(sj, 0, -.3 * al, 0, el, 0);
      this.put(cu, ej, 0, -.14 * al, 0, .13 * w, .28 * al, .13 * w, g.skin);
      this.put(cu, ej, 0, -.3 * al - .02, 0, .15, .17, .09, g.skin);
      this.put(cu, ej, sd * -.09, -.3 * al - .02, -.01, .04, .1, .05, g.skin);
      part(sj, 0, -.15 * al, 0, .15 * w, 'arm'); part(ej, 0, -.14 * al, 0, .14 * w, 'arm');
    }
    g.parts = parts;
    g.nape = [nape[0], nape[1], nape[2]];
    g.napeR = .1 * hs * k;
  }
}

class Giant {
  constructor(id, x, z, kind, rnd) {
    this.id = id; this.kind = kind; this.x = x; this.z = z; this.y = groundHeight(x, z);
    const r = rnd;
    if (kind === 1) { this.H = 4.5 + r() * 2.5; this.w = .78 + r() * .12; this.ll = 1.1; this.al = 1.2; this.hs = 1.25 + r() * .15; this.belly = 0; this.lean = .15; this.vmax = 9.5 + r() * 2; }
    else if (kind === 2) { this.H = 12 + r() * 3; this.w = 1.3 + r() * .2; this.ll = .92; this.al = 1; this.hs = 1.05; this.belly = .25 + r() * .5; this.lean = .05; this.vmax = 2.6 + r() * .6; }
    else { const q = r(); this.H = q < .6 ? 6 + r() * 4 : q < .9 ? 10 + r() * 3 : 13.5 + r() * 1.5; this.w = .88 + r() * .35; this.ll = .95 + r() * .15; this.al = 1 + r() * .2; this.hs = 1 + r() * .3; this.belly = r() < .4 ? r() * .6 : 0; this.lean = .02 + r() * .1; this.vmax = 2.8 + this.H * .17; }
    this.col = null;
    this.skin = GIANT_SKINS[(r() * GIANT_SKINS.length) | 0]; this.hair = GIANT_HAIR[(r() * GIANT_HAIR.length) | 0]; this.shorts = GIANT_SHORTS[(r() * GIANT_SHORTS.length) | 0];
    this.col = true;
    this.hairStyle = (r() * 4) | 0; this.eye = .85 + r() * .55; this.mw = .85 + r() * .5;
    this.face = r() * Math.PI * 2; this.speed = 0; this.phase = r() * 6; this.state = 'wander'; this.stateT = 0; this.cd = 1 + r();
    this.wpx = x; this.wpz = z; this.wpT = 0; this.stun = 0; this.armOff = 0; this.avoid = 1;
    this.hunt = false; this.lastStep = 0; this.onStep = null;
    this.rad = .2 * this.H; this.parts = []; this.nape = [x, this.y + this.H, z]; this.napeR = .3; this.removed = false; this.hit = null;
    this.body = { x, y: this.y, z, vx: 0, vy: 0, vz: 0, prevY: this.y, r: this.rad, h: this.H * .55, grounded: true };
  }
  get alive() { return this.state !== 'dying' && !this.removed; }
  kill() { if (this.state === 'dying') return; this.state = 'dying'; this.stateT = 0; this.speed = 0; }
  stagger(t) { if (this.state === 'dying') return; this.state = 'stagger'; this.stateT = 0; this.stun = t; }
  free(ang, dist) {
    const px = this.x - Math.sin(ang) * dist, pz = this.z - Math.cos(ang) * dist;
    return !Physics.pointSolid(px, this.y + .6, pz, this.rad * .85);
  }
  update(dt, P, hitCb) {
    this.stateT += dt;
    if (this.state === 'dying') { this.y = groundHeight(this.x, this.z); if (this.stateT > 4.6) this.removed = true; return; }
    this.cd -= dt;
    const dx = P.x - this.x, dz = P.z - this.z, d = Math.hypot(dx, dz);
    if (this.state === 'stagger') { this.speed = M.smooth(this.speed, 0, 6, dt); if (this.stateT > this.stun) { this.state = 'chase'; this.stateT = 0; } }
    else if (this.state === 'attack') {
      this.speed = M.smooth(this.speed, 0, 6, dt);
      const want = Math.atan2(-dx, -dz); let df = want - this.face; df = Math.atan2(Math.sin(df), Math.cos(df)); this.face += df * Math.min(1, 3 * dt);
      if (!this.struck && this.stateT >= 1.0) { this.struck = true; hitCb(this); }
      if (this.stateT >= 1.6) { this.state = 'chase'; this.stateT = 0; this.cd = 1.3 + Math.random() * .8; this.struck = false; }
    } else {
      const sense = 230 + this.H * 10, chasing = P.alive && (this.hunt || d < sense);
      let tx, tz;
      if (chasing) {
        tx = P.x; tz = P.z; this.state = 'chase';
        const rg = Math.hypot(this.x, this.z), rp = Math.hypot(P.x, P.z);
        if (rg > 528 && rp < 505) { const ga = Math.round(Math.atan2(this.z, this.x) / (Math.PI / 2)) * Math.PI / 2; tx = Math.cos(ga) * 500; tz = Math.sin(ga) * 500; }
      }
      else {
        this.state = 'wander'; this.wpT -= dt;
        if (this.wpT <= 0 || Math.hypot(this.wpx - this.x, this.wpz - this.z) < 8) {
          const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 120; this.wpx = this.x + Math.cos(a) * r; this.wpz = this.z + Math.sin(a) * r; this.wpT = 8;
          const rr = Math.hypot(this.wpx, this.wpz); if (rr > 480) { this.wpx *= 400 / rr; this.wpz *= 400 / rr; }
        }
        tx = this.wpx; tz = this.wpz;
      }
      const des = Math.atan2(-(tx - this.x), -(tz - this.z));
      let pick = des;
      const L = this.rad * 2.2 + 2;
      if (!this.free(des, L)) {
        let found = false;
        for (const da of [.5, -.5, 1, -1, 1.5, -1.5, 2.2, -2.2]) { const a = des + da * this.avoid; if (this.free(a, L)) { pick = a; found = true; break; } }
        if (!found) { pick = des + 1.6 * this.avoid; if (Math.random() < .02) this.avoid = -this.avoid; }
      }
      let df = pick - this.face; df = Math.atan2(Math.sin(df), Math.cos(df));
      this.face += M.clamp(df, -1, 1) * Math.min(1, (this.kind === 1 ? 5 : 2.4) * dt) * 1.0 + 0;
      const targetSpeed = chasing ? this.vmax : this.vmax * .3;
      const fwd = Math.max(0, Math.cos(df));
      this.speed = M.smooth(this.speed, targetSpeed * (.35 + .65 * fwd), 2.5, dt);
      if (chasing && d < .45 * this.H + 1.6 && P.y < this.y + this.H * .9 && this.cd <= 0) { this.state = 'attack'; this.stateT = 0; this.struck = false; }
    }
    // الحركة والتصادم
    const b = this.body;
    b.x = this.x - Math.sin(this.face) * this.speed * dt; b.z = this.z - Math.cos(this.face) * this.speed * dt;
    b.y = groundHeight(b.x, b.z); b.prevY = b.y; b.vx = b.vy = b.vz = 0; b.grounded = true; b.h = this.H * .55;
    Physics.resolve(b);
    this.x = b.x; this.z = b.z; this.y = groundHeight(this.x, this.z);
    this.phase += dt * this.speed * (this.kind === 1 ? 1.3 : 1.6) / Math.max(.8, this.H * .22) * 2.2;
    const st = Math.floor(this.phase / Math.PI);
    if (st !== this.lastStep) { this.lastStep = st; if (this.speed > .8 && this.onStep) this.onStep(this); }
  }
}
