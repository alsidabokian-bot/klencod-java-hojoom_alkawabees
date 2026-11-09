// القتال: الضربة، إصابة نقطة الضعف، الصحة، إدارة العمالقة
class Combat {
  constructor(r, gear, player, chunks) {
    this.rig = new GiantRig(r); chunks.push(this.rig.chunk);
    this.gear = gear; this.p = player;
    this.giants = []; this.kills = 0; this.rnd = M.rng(5150); this.nextId = 1;
    this.slashT = 0; this.slashCd = 0; this.hitSet = new Set(); this.inv = 0; this.flash = 0; this.shake = 0;
    this.reach = 0; this.slashCdMul = 1; this.onKill = null; this.onDeath = null; this.diedNotified = false;
    player.hp = player.maxHp = 100; player.alive = true; player.slash = 0;
    gear.giants = this.giants;
  }
  clear() { this.giants.length = 0; this.diedNotified = false; this.inv = 0; this.slashT = 0; }
  spawnAt(kind, x, z, hunt) {
    const g = new Giant(this.nextId++, x, z, kind, this.rnd);
    g.hunt = !!hunt;
    g.onStep = gg => {
      Sound.at(gg.x, gg.y, gg.z, (v, pan) => Sound.step(v * Math.min(1, gg.H / 9), pan), 260);
      const sz = .3 + gg.H * .04;
      for (let k = 0; k < 3; k++) this.gear.emit(gg.x + (Math.random() - .5) * gg.rad, gg.y + .3, gg.z + (Math.random() - .5) * gg.rad, (Math.random() - .5) * 3, .8 + Math.random(), (Math.random() - .5) * 3, .8, sz, this.gear.dust, .6);
      const d = Math.hypot(gg.x - this.p.x, gg.z - this.p.z);
      if (d < 70 && gg.H > 8) this.shake = Math.max(this.shake, .22 * (1 - d / 70));
    };
    for (let i = 0; i < this.giants.length; i++) if (this.giants[i].removed) { this.giants[i] = g; return g; }
    this.giants.push(g); return g;
  }
  // يظهر في مكان عشوائي حر داخل المدينة (للقائمة الرئيسية)
  spawnRandom(kind, minDist) {
    const p = this.p;
    for (let n = 0; n < 60; n++) {
      const a = this.rnd() * Math.PI * 2, rad = 120 + this.rnd() * 300;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (Math.hypot(x - p.x, z - p.z) < (minDist || 100)) continue;
      if (Physics.pointSolid(x, 1, z, 4)) continue;
      return this.spawnAt(kind, x, z, false);
    }
    return null;
  }
  alive() { let n = 0; for (const g of this.giants) if (g.alive) n++; return n; }
  hurt(g) {
    const p = this.p;
    if (!p.alive || this.inv > 0) return;
    const reach = .75 * g.H + 1.5, cx = g.x - Math.sin(g.face) * .3 * g.H, cz = g.z - Math.cos(g.face) * .3 * g.H;
    if (Math.hypot(p.x - cx, p.z - cz) > reach || p.y > g.y + g.H * 1.0) return;
    p.hp -= 34; this.inv = 1.1; this.flash = 1; this.shake = .6;
    Sound.hurt();
    const ax = p.x - g.x, az = p.z - g.z, al = Math.hypot(ax, az) || 1;
    p.vx = ax / al * 14; p.vz = az / al * 14; p.vy = 9; p.grounded = false;
    this.gear.releaseAll();
    for (let k = 0; k < 8; k++) this.gear.emit(p.x, p.y + 1, p.z, (Math.random() - .5) * 8, Math.random() * 5, (Math.random() - .5) * 8, .4, .14, this.gear.spark, -6);
    if (p.hp <= 0) { p.hp = 0; p.alive = false; }
  }
  update(dt, time, active) {
    const p = this.p, gear = this.gear;
    this.inv = Math.max(0, this.inv - dt); this.flash = Math.max(0, this.flash - dt * 2.2); this.shake = Math.max(0, this.shake - dt * 2);
    if (!p.alive && active && !this.diedNotified) { this.diedNotified = true; Sound.over(); if (this.onDeath) this.onDeath(); }
    for (const g of this.giants) {
      if (g.removed) continue;
      g.update(dt, p, gg => this.hurt(gg));
      if (g.state === 'dying' && g.parts.length && Math.random() < dt * 40) {
        const q = g.parts[(Math.random() * g.parts.length) | 0];
        gear.emit(q.x, q.y, q.z, (Math.random() - .5) * 3, 2 + Math.random() * 3, (Math.random() - .5) * 3, 1.1, Math.max(.5, g.H * .08), gear.steam, 2.5);
      }
    }
    // الضربة
    this.slashCd -= dt;
    if (active && p.alive && Input.pressed('slash', 'KeyF') && this.slashCd <= 0) { this.slashT = .3; this.slashCd = .42 * this.slashCdMul; this.hitSet.clear(); Sound.slash(); }
    p.slash = 0;
    if (this.slashT > 0) {
      this.slashT -= dt; p.slash = 1 - Math.max(this.slashT, 0) / .3;
      const cx = p.x, cy = p.y + 1.2, cz = p.z;
      for (const g of this.giants) {
        if (!g.alive || this.hitSet.has(g)) continue;
        const dn = Math.hypot(cx - g.nape[0], cy - g.nape[1], cz - g.nape[2]);
        if (dn < 3.6 + this.reach + g.napeR) {
          this.hitSet.add(g); g.kill(); this.kills++; this.flashKill(g);
          Sound.kill();
          if (this.onKill) this.onKill(g, p.speed3 > 25);
          continue;
        }
        for (const q of g.parts) {
          if (Math.hypot(cx - q.x, cy - q.y, cz - q.z) < q.r + 2.6 + this.reach * .5) {
            this.hitSet.add(g); Sound.clang();
            if (q.tag === 'leg') g.stagger(2.8);
            else if (q.tag === 'arm' && g.state === 'attack') { g.state = 'chase'; g.stateT = 0; g.cd = 2.2; g.struck = false; }
            for (let k = 0; k < 6; k++) gear.emit(q.x, q.y, q.z, (Math.random() - .5) * 7, Math.random() * 5, (Math.random() - .5) * 7, .3, .12, gear.spark, -6);
            break;
          }
        }
      }
    }
  }
  flashKill(g) {
    const gear = this.gear;
    for (let k = 0; k < 26; k++) gear.emit(g.nape[0], g.nape[1], g.nape[2], (Math.random() - .5) * 12, Math.random() * 8, (Math.random() - .5) * 12, .6, .16, gear.spark, -4);
    for (let k = 0; k < 14; k++) gear.emit(g.nape[0], g.nape[1], g.nape[2], (Math.random() - .5) * 6, Math.random() * 4, (Math.random() - .5) * 6, 1.2, .5, gear.steam, 2);
  }
  draw(time) {
    this.rig.begin();
    for (const g of this.giants) if (!g.removed) this.rig.draw(g, time);
  }
}
