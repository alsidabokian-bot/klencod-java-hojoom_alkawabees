// شخصية «حارس السور»: تصميم أصلي من مجسمات بسيطة بهيكل مفاصل وحركة
const Mx = {
  I(o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; },
  T(o, x, y, z) { Mx.I(o); o[12] = x; o[13] = y; o[14] = z; return o; },
  Rx(o, a) { const c = Math.cos(a), s = Math.sin(a); Mx.I(o); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; },
  Ry(o, a) { const c = Math.cos(a), s = Math.sin(a); Mx.I(o); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; },
  Rz(o, a) { const c = Math.cos(a), s = Math.sin(a); Mx.I(o); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; },
};

class Character {
  constructor(r) {
    this.cubes = new InstanceBatch(r, r.meshes.cube, 200);
    this.spheres = new InstanceBatch(r, r.meshes.sphere, 16);
    this.cyls = new InstanceBatch(r, r.meshes.cyl, 16);
    this.chunk = { cx: 0, cy: 0, cz: 0, radius: 40, batches: [this.cubes, this.spheres, this.cyls] };
    this.tips = []; this.phase = 0; this.pool = []; this.pi = 0; this.tmp = Mx.I(new Float32Array(16)); this.tmp2 = Mx.I(new Float32Array(16));
    this.c = {
      armor: M.rgb(0x7b848d), armorL: M.rgb(0xa2abb3), cloth: M.rgb(0x3b4148), skin: M.rgb(0xdfb089), belt: M.rgb(0x3a2a1e),
      leather: M.rgb(0x4b3322), boot: M.rgb(0x2a1f18), metal: M.rgb(0xa9b3bb), cape: M.rgb(0x16284a), capeE: M.rgb(0xc3cbd2),
      eye: M.rgb(0x1a1a1a), hood: M.rgb(0x16284a), wing: M.rgb(0xe3c15a), wall: M.rgb(0xd5dbe0),
    };
  }
  m() { if (this.pi >= this.pool.length) this.pool.push(new Float32Array(16)); return this.pool[this.pi++]; }
  // مفصل: parent * T * Rx * Rz
  joint(parent, x, y, z, rx, rz) {
    const a = Mx.T(this.tmp, x, y, z), out = this.m();
    M.mat4.mul(out, parent, a);
    if (rx) { M.mat4.mul(out, out, Mx.Rx(this.tmp2, rx)); }
    if (rz) { M.mat4.mul(out, out, Mx.Rz(this.tmp2, rz)); }
    return out;
  }
  put(batch, j, ox, oy, oz, sx, sy, sz, col, mat) {
    const o = this.tmp; Mx.T(o, ox, oy, oz); o[0] = sx; o[5] = sy; o[10] = sz;
    const out = this.m(); M.mat4.mul(out, j, o);
    const i = batch.count * 20; batch.data.set(out, i);
    batch.data[i + 16] = col[0]; batch.data[i + 17] = col[1]; batch.data[i + 18] = col[2]; batch.data[i + 19] = mat || 0;
    batch.count++; batch.dirty = true;
  }
  // شعار الفيلق: جناح واحد أمام سور. dir=+1 للظهر (+z) و -1 للصدر (-z)
  emblem(parent, ox, oy, oz, k, dir) {
    const c = this.c, cu = this.cubes, m = dir > 0 ? 1 : -1, z = oz + dir * .008;
    const base = this.joint(parent, ox, oy, z, 0, 0);
    const feathers = [[-.08, -1.25, .2], [-.04, -.98, .27], [0, -.72, .3], [.04, -.46, .27], [.08, -.22, .2]];
    for (const [fx, ang, len] of feathers) {
      const fj = this.joint(base, fx * k * m, .0 * k, 0, 0, ang * m);
      this.put(cu, fj, 0, len * k / 2, 0, .05 * k, len * k, .012, c.wing);
    }
    this.put(cu, base, 0, -.05 * k, dir * .006, .34 * k, .09 * k, .014, c.wall);
    for (const mx of [-.12, 0, .12]) this.put(cu, base, mx * k, .015 * k, dir * .006, .07 * k, .05 * k, .014, c.wall);
  }
  update(p, dt, time) {
    this.pi = 0; this.cubes.count = this.spheres.count = this.cyls.count = 0;
    const c = this.c, cu = this.cubes, sp = this.spheres, cy = this.cyls;
    const s = Math.min(p.speed / 11, 1), mov = M.clamp(p.speed / 1.5, 0, 1), air = !p.grounded;
    if (p.grounded) this.phase += dt * (6 + p.speed * .9) * mov;
    const sw = Math.sin(this.phase), co = Math.cos(this.phase), amp = (.25 + .65 * s) * mov;
    const breathe = Math.sin(time * 2.2) * .015 * (1 - mov);
    let thL = sw * amp, thR = -sw * amp, knL = (.1 + .9 * Math.max(0, co)) * mov, knR = (.1 + .9 * Math.max(0, -co)) * mov;
    let arL = -sw * amp * 1.1, arR = sw * amp * 1.1, elL = .35 + .6 * s, elR = .35 + .6 * s;
    let lean = .04 + .3 * s, bob = p.grounded ? Math.abs(sw) * .05 * s : 0;
    let tilt = 0;
    if (air && (p.swing || p.boosting)) {
      thL = .95; thR = .45; knL = 1.3; knR = .9; arL = 2.0; arR = 2.0; elL = .25; elR = .25; lean = .2; bob = 0;
      tilt = M.clamp(p.speed3 / 50, 0, 1) * .85;
    } else if (air) {
      const up = p.vy > 0;
      thL = up ? .75 : .35; thR = up ? -.2 : -.05; knL = up ? 1.1 : .5; knR = up ? .5 : .25;
      arL = up ? 1.3 : .6; arR = up ? 1.1 : .4; elL = .5; elR = .5; lean = up ? .15 : .1; bob = 0;
    }
    this.tips.length = 0;
    const sl = p.slash || 0;
    if (sl > 0) {
      const u = easeOut(sl);
      arL = 2.6 + (-.5 - 2.6) * u; arR = 2.4 + (-.3 - 2.4) * u; elL = elR = .25; lean = Math.max(lean, .3);
      if (!air) { thL = .5; thR = -.4; }
    }
    const twist = sl > 0 ? (sl - .5) * 1.5 : 0;
    const top = M.mat4.mul(this.m(), Mx.T(this.tmp, p.x, p.y, p.z), Mx.Ry(this.tmp2, p.face + twist));
    const hipY = .98 + bob;
    const hips = this.joint(top, 0, hipY, 0, -tilt, 0);
    this.put(cu, hips, 0, -.02, 0, .38, .2, .25, c.cloth);
    // الساقان
    for (const [sd, th, kn] of [[-1, thL, knL], [1, thR, knR]]) {
      const hj = this.joint(hips, sd * .15, -.05, 0, th, 0);
      this.put(cu, hj, 0, -.25, 0, .19, .5, .21, c.cloth);
      this.put(cu, hj, 0, -.14, 0, .205, .045, .225, c.leather);
      this.put(cu, hj, 0, -.32, 0, .205, .045, .225, c.leather);
      const kj = this.joint(hj, 0, -.5, 0, -kn, 0);
      this.put(cu, kj, 0, -.23, 0, .16, .46, .18, c.armor);
      this.put(cu, kj, 0, -.47, -.04, .19, .13, .3, c.boot);
    }
    // الجذع
    const torso = this.joint(hips, 0, .06 + breathe, 0, -lean, 0);
    this.put(cu, torso, 0, .3, 0, .42, .56, .27, c.armor);
    this.put(cu, torso, 0, .38, -.15, .44, .3, .05, c.armorL);
    this.put(cu, torso, 0, .02, 0, .45, .1, .29, c.belt);
    this.put(cu, torso, 0, .02, -.15, .08, .08, .02, c.metal);
    for (const sd of [-1, 1]) {
      const st = this.joint(torso, 0, .3, -.141, 0, sd * .62);
      this.put(cu, st, 0, 0, 0, .05, .66, .014, c.leather);
    }
    this.emblem(torso, .12, .42, -.145, .45, -1);
    // الجهاز على الظهر والخصر
    this.put(cu, torso, 0, .3, .24, .32, .4, .2, c.metal);
    this.put(cy, torso, .13, .02, .24, .09, .26, .09, c.leather);
    this.put(cy, torso, -.13, .02, .24, .09, .26, .09, c.leather);
    for (const sd of [-1, 1]) this.put(cy, torso, sd * .27, -.04, .02, .09, .3, .09, c.metal);
    // الرأس والقلنسوة
    const head = this.joint(torso, 0, .7, 0, lean * .6, 0);
    this.put(sp, head, 0, .08, 0, .25, .27, .25, c.skin);
    this.put(sp, head, 0, .11, .035, .32, .31, .32, c.hood);
    this.put(cu, head, -.055, .09, -.118, .035, .035, .02, c.eye);
    this.put(cu, head, .055, .09, -.118, .035, .035, .02, c.eye);
    // الذراعان
    for (const [sd, ar, el] of [[-1, arL, elL], [1, arR, elR]]) {
      const sj = this.joint(torso, sd * .29, .5, 0, ar, sd * .08);
      this.put(cu, sj, 0, .02, 0, .2, .1, .2, c.armorL);
      this.put(cu, sj, 0, -.15, 0, .13, .3, .14, c.armor);
      const ej = this.joint(sj, 0, -.3, 0, el, 0);
      this.put(cu, ej, 0, -.14, 0, .12, .28, .13, c.cloth);
      this.put(cu, ej, 0, -.3, 0, .13, .1, .14, c.boot);
      // السيف: مقبض وواقي ونصل
      const bj = this.joint(ej, 0, -.32, 0, 1.25, 0);
      this.put(cu, bj, 0, -.07, 0, .045, .16, .045, c.leather);
      this.put(cu, bj, 0, -.16, 0, .11, .025, .05, c.metal);
      this.put(cu, bj, 0, -.62, 0, .028, .88, .009, c.capeE);
      if (sl > 0) { const tp = [bj[0] * 0 + bj[4] * -1.04 + bj[12], bj[1] * 0 + bj[5] * -1.04 + bj[13], bj[2] * 0 + bj[6] * -1.04 + bj[14]]; this.tips.push(tp); }
    }
    // العباءة
    const flutter = Math.sin(time * 9 + this.phase) * .08 * (.3 + s) + Math.sin(time * 2) * .02;
    const ca = -(.1 + .8 * s + flutter + (air ? M.clamp(-p.vy * .03, -.3, .5) : 0));
    const cj = this.joint(torso, 0, .58, .36, ca, 0);
    this.put(cu, cj, 0, -.38, .03, .44, .76, .05, c.cape);
    this.put(cu, cj, 0, -.76, .03, .46, .05, .055, c.capeE);
    this.put(cu, cj, -.22, -.38, .03, .02, .76, .056, c.capeE);
    this.put(cu, cj, .22, -.38, .03, .02, .76, .056, c.capeE);
    this.emblem(cj, 0, -.46, .055, 1.25, 1);
    this.chunk.cx = p.x; this.chunk.cy = p.y; this.chunk.cz = p.z;
  }
}
