// نظام اللعبة: حفظ، ترقيات، موجات، قوائم
const Save = {
  key: 'nm_v1',
  data: { best: 0, bestWave: 0, kills: 0, runs: 0, settings: { quality: 'high', vol: .7, sens: 1, fps: false } },
  load() {
    try {
      let raw = null;
      try { raw = localStorage.getItem(this.key); } catch (e) {}
      if (!raw && window.__nmSaved) raw = window.__nmSaved;
      const s = JSON.parse(raw || 'null');
      if (s) { Object.assign(this.data, s); this.data.settings = Object.assign({ quality: 'high', vol: .7, sens: 1, fps: false }, s.settings || {}); }
    } catch (e) {}
  },
  store() {
    const j = JSON.stringify(this.data);
    try { localStorage.setItem(this.key, j); } catch (e) {}
    try { if (window.NMStore) window.NMStore.postMessage(j); } catch (e) {}
  },
};

const Mods = {
  maxHp: 100, maxGas: 100, gasRegen: 1, speed: 1, reach: 0, reel: 1, slashCd: 1,
  reset() { this.maxHp = 100; this.maxGas = 100; this.gasRegen = 1; this.speed = 1; this.reach = 0; this.reel = 1; this.slashCd = 1; },
};
const UPGRADES = [
  { id: 'hp', name: 'درع أقوى', desc: '+25 صحة قصوى مع تعافٍ كامل', max: 5, apply(g) { Mods.maxHp += 25; g.player.hp = Mods.maxHp; } },
  { id: 'gas', name: 'خزان أكبر', desc: '+25 غاز أقصى', max: 5, apply() { Mods.maxGas += 25; } },
  { id: 'regen', name: 'تعبئة أسرع', desc: 'استعادة الغاز أسرع بنسبة 40%', max: 4, apply() { Mods.gasRegen += .4; } },
  { id: 'speed', name: 'ساقان أسرع', desc: '+10% سرعة الركض', max: 4, apply() { Mods.speed += .1; } },
  { id: 'reach', name: 'نصل أطول', desc: 'مدى الضربة أوسع بـ 0.6 متر', max: 4, apply() { Mods.reach += .6; } },
  { id: 'reel', name: 'سحب أقوى', desc: 'قوة سحب الحبل +20%', max: 4, apply() { Mods.reel += .2; } },
  { id: 'cd', name: 'ضربة أسرع', desc: 'انتظار أقل بين الضربات بنسبة 15%', max: 3, apply() { Mods.slashCd *= .85; } },
  { id: 'heal', name: 'إسعاف', desc: 'استعد 50 صحة فورًا', max: 99, apply(g) { g.player.hp = Math.min(Mods.maxHp, g.player.hp + 50); } },
];

const QUALITY = {
  low:  { name: 'منخفضة', cap: 540,  shadow: 0 },
  mid:  { name: 'متوسطة', cap: 720,  shadow: 1024 },
  high: { name: 'عالية',  cap: 1080, shadow: 2048 },
};

class Game {
  constructor(o) {
    Object.assign(this, o);
    this.$ = id => document.getElementById(id);
    this.s = 'menu'; this.sub = null; this.back = null;
    this.wave = 0; this.score = 0; this.combo = 0; this.comboT = 0; this.queue = []; this.spawnT = 0; this.timer = 0; this.ph = 'none';
    this.runKills = 0; this.upg = {}; this.maxAlive = 6; this.feedT = 0; this.last = {};
    this.combat.onKill = (g, fast) => this.onKill(g, fast);
    this.combat.onDeath = () => { this.ph = 'dead'; this.timer = 1.8; };
    this.bind();
    this.applySettings();
    this.setMenu();
  }
  // ---------- الإعدادات ----------
  applySettings() {
    const S = Save.data.settings;
    Sound.setVolume(S.vol); this.chase.sens = S.sens;
    this.$('fps').style.display = S.fps ? 'block' : 'none';
    this.applyQuality();
    this.refreshSettingsUI();
  }
  refreshSettingsUI() {
    const S = Save.data.settings;
    for (const k of ['low', 'mid', 'high']) this.$('q_' + k).classList.toggle('sel', S.quality === k);
    this.$('volR').value = Math.round(S.vol * 100); this.$('sensR').value = Math.round(S.sens * 100);
    this.$('fpsB').textContent = S.fps ? 'مفعّل' : 'معطّل';
  }
  // ---------- الأزرار ----------
  bind() {
    const on = (id, fn) => this.$(id).addEventListener('click', () => { Sound.init(); Sound.resume(); Sound.ui(); fn(); });
    on('mStart', () => this.startRun());
    on('mHow', () => this.openSub('howto'));
    on('mSet', () => this.openSub('settings'));
    on('howBack', () => this.closeSub());
    on('setBack', () => { Save.store(); this.closeSub(); });
    on('btnPause', () => this.pause());
    on('pResume', () => this.resume());
    on('pSet', () => this.openSub('settings'));
    on('pQuit', () => this.toMenu());
    on('oRetry', () => this.startRun());
    on('oMenu', () => this.toMenu());
    for (const k of ['low', 'mid', 'high']) on('q_' + k, () => { Save.data.settings.quality = k; this.applyQuality(); this.refreshSettingsUI(); Save.store(); });
    on('fpsB', () => { Save.data.settings.fps = !Save.data.settings.fps; this.applySettings(); Save.store(); });
    this.$('volR').addEventListener('input', e => { Save.data.settings.vol = e.target.value / 100; Sound.setVolume(Save.data.settings.vol); });
    this.$('volR').addEventListener('change', () => { Sound.init(); Sound.resume(); Sound.ui(); Save.store(); });
    this.$('sensR').addEventListener('input', e => { Save.data.settings.sens = e.target.value / 100; this.chase.sens = Save.data.settings.sens; });
    this.$('sensR').addEventListener('change', () => Save.store());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.s === 'play') this.pause(); });
  }
  show(id) { for (const e of document.querySelectorAll('.screen')) e.classList.toggle('on', e.id === id); }
  hideAll() { for (const e of document.querySelectorAll('.screen')) e.classList.remove('on'); }
  openSub(id) { this.back = this.s; this.sub = id; this.show(id); if (id === 'settings') this.refreshSettingsUI(); }
  closeSub() {
    this.sub = null;
    if (this.back === 'menu') this.show('menu'); else if (this.back === 'pause') this.show('pause');
  }
  setPlay(on) { document.body.classList.toggle('play', on); }
  // ---------- الحالات ----------
  setMenu() {
    this.s = 'menu'; this.setPlay(false); this.show('menu'); this.sub = null;
    const p = this.player, c = this.combat;
    c.clear(); p.alive = false; p.hp = p.maxHp = 100; p.x = 0; p.z = 330; p.y = groundHeight(0, 330); p.vx = p.vy = p.vz = 0;
    this.gear.releaseAll(); this.chase.base = 12; this.chase.pitch = -.12;
    for (let i = 0; i < 4; i++) c.spawnRandom(i === 3 ? 2 : 0, 70 + i * 25);
    const d = Save.data;
    this.$('mStats').textContent = d.runs ? ('أفضل نتيجة ' + d.best + ' · أعلى موجة ' + d.bestWave + ' · عمالقة مقتولة ' + d.kills) : 'لم تبدأ بعد، أول موجة تنتظرك';
  }
  toMenu() { this.hideAll(); this.setMenu(); }
  startRun() {
    const p = this.player, c = this.combat, g = this.gear;
    Mods.reset(); this.upg = {}; this.applyMods();
    c.clear(); c.kills = 0; this.runKills = 0; this.score = 0; this.combo = 0; this.wave = 0;
    p.alive = true; p.hp = p.maxHp; p.x = 0; p.z = 330; p.y = groundHeight(0, 330); p.vx = p.vy = p.vz = 0; p.face = 0;
    g.releaseAll(); g.gas = g.maxGas;
    this.chase.yaw = 0; this.chase.pitch = -.16; this.chase.base = 8.5; this.chase.init = false;
    this.hideAll(); this.s = 'play'; this.setPlay(true);
    this.nextWave(1);
  }
  applyMods() {
    const p = this.player, g = this.gear, c = this.combat;
    p.maxHp = Mods.maxHp; p.hp = Math.min(p.hp, p.maxHp); p.maxSpeed = 11 * Mods.speed; p.reelPull = 34 * Mods.reel;
    g.maxGas = Mods.maxGas; g.regen = Mods.gasRegen; c.reach = Mods.reach; c.slashCdMul = Mods.slashCd;
  }
  pause() { if (this.s !== 'play') return; this.s = 'pause'; this.show('pause'); Sound.gas(0); Sound.wind(0); }
  resume() { if (this.s !== 'pause') return; this.s = 'play'; this.hideAll(); this.sub = null; }
  // زر الرجوع في أندرويد
  onBack() {
    if (this.sub) { this.closeSub(); return 'handled'; }
    if (this.s === 'play') { this.pause(); return 'handled'; }
    if (this.s === 'pause') { this.resume(); return 'handled'; }
    if (this.s === 'over') { this.toMenu(); return 'handled'; }
    if (this.s === 'upgrade') return 'handled';
    return 'exit';
  }
  // ---------- الموجات ----------
  nextWave(n) {
    this.wave = n; this.ph = 'intro'; this.timer = 2.8; this.spawnT = 0;
    const count = 3 + 2 * n + Math.floor(n / 3);
    this.maxAlive = Math.min(4 + n, 12);
    const runner = Math.min(.1 + .035 * n, .4), brute = Math.min(.04 + .02 * n, .25);
    this.queue = [];
    for (let i = 0; i < count; i++) { const q = Math.random(); this.queue.push(q < brute ? 2 : q < brute + runner ? 1 : 0); }
    this.banner('الموجة ' + n, count + ' عملاق قادم');
    Sound.horn();
  }
  spawnNext() {
    const kind = this.queue.shift();
    const gate = (Math.random() * 4 | 0) * Math.PI / 2, off = (Math.random() - .5) * 50, dist = 600 + Math.random() * 60;
    const x = Math.cos(gate) * dist - Math.sin(gate) * off, z = Math.sin(gate) * dist + Math.cos(gate) * off;
    this.combat.spawnAt(kind, x, z, true);
  }
  onKill(g, fast) {
    this.combo++; this.comboT = 7; this.runKills++;
    const mult = 1 + Math.min(this.combo - 1, 8) * .25;
    const pts = Math.round((60 + g.H * 10 + (fast ? 50 : 0)) * mult);
    this.score += pts;
    this.feed('+' + pts + (fast ? ' ضربة سريعة' : '') + (this.combo > 1 ? ' · تتابع ×' + mult.toFixed(2).replace(/\.?0+$/, '') : ''));
  }
  banner(t, sub) {
    const b = this.$('banner'); b.innerHTML = t + (sub ? '<div class="bs">' + sub + '</div>' : '');
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  feed(t) { const f = this.$('feed'); f.textContent = t; f.style.opacity = 1; this.feedT = 1.6; }
  openUpgrades() {
    const pool = UPGRADES.filter(u => (this.upg[u.id] || 0) < u.max);
    const picks = []; while (picks.length < 3 && pool.length) picks.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    const box = this.$('cards'); box.innerHTML = '';
    for (const u of picks) {
      const lv = this.upg[u.id] || 0, d = document.createElement('button');
      d.className = 'card';
      d.innerHTML = '<div class="ct">' + u.name + '</div><div class="cd">' + u.desc + '</div><div class="cl">' + (u.max < 50 ? 'المستوى ' + lv + ' ← ' + (lv + 1) : 'فوري') + '</div>';
      d.addEventListener('click', () => {
        Sound.init(); Sound.upgrade(); u.apply(this); this.upg[u.id] = lv + 1; this.applyMods();
        this.hideAll(); this.s = 'play'; this.nextWave(this.wave + 1);
      });
      box.appendChild(d);
    }
    this.$('upgTitle').textContent = 'اكتملت الموجة ' + this.wave;
    this.show('upgrade'); this.s = 'upgrade'; Sound.upgrade();
    if (!picks.length) { this.hideAll(); this.s = 'play'; this.nextWave(this.wave + 1); }
  }
  gameOver() {
    const d = Save.data, rec = this.score > d.best;
    d.runs++; d.kills += this.runKills; if (rec) d.best = this.score; if (this.wave > d.bestWave) d.bestWave = this.wave;
    Save.store();
    this.$('oScore').textContent = this.score; this.$('oWave').textContent = this.wave; this.$('oKills').textContent = this.runKills; this.$('oBest').textContent = d.best;
    this.$('oRec').style.display = rec ? 'block' : 'none';
    this.s = 'over'; this.setPlay(false); this.show('over');
  }
  // ---------- التحديث ----------
  update(dt, lx, ly, t) {
    const s = this.s, p = this.player, c = this.combat, g = this.gear, ch = this.chase, ce = this.character;
    const sim = s === 'play' || s === 'menu' || s === 'over';
    if (sim) {
      const playing = s === 'play' && p.alive;
      c.update(dt, t, s === 'play');
      if (playing) {
        ch.look(lx, ly);
        g.control(p, ch.cam, ch, dt);
        let jump = Input.pressed('jump', 'Space');
        if (jump && g.anyAttached()) { g.releaseAll(); jump = false; }
        p.update(dt, Input.getMove(), ch.yaw, jump);
      } else {
        p.boosting = false;
        if (s === 'play') ch.look(lx, ly);
        p.update(dt, [0, 0], ch.yaw, false);
      }
      if (p.impact < -14) {
        const n = Math.min(14, 4 + (-p.impact - 14) * .3) | 0;
        for (let k = 0; k < n; k++) { const a = k / n * 6.28; g.emit(p.x, p.y + .2, p.z, Math.cos(a) * (3 + Math.random() * 3), .6 + Math.random(), Math.sin(a) * (3 + Math.random() * 3), .7, .45, g.dust, .5); }
        Sound.at(p.x, p.y, p.z, (v, pan) => Sound.step(.7, pan), 80);
      }
      g.render(p, dt, t);
      ce.update(p, dt, t);
      for (const tp of ce.tips) g.emit(tp[0], tp[1], tp[2], 0, 0, 0, .18, .1, g.steam, 0);
      c.draw(t);
      if (s === 'menu') { ch.yaw += dt * .18; }
      ch.update(dt, p);
      if (c.shake > 0) { const a = c.shake * .25; ch.cam.pos[0] += (Math.random() - .5) * a; ch.cam.pos[1] += (Math.random() - .5) * a; }
      Sound.gas(s === 'play' && p.boosting ? 1 : 0); Sound.wind(s === 'play' ? Math.min(1, p.speed3 / 50) : 0);
    }
    if (s === 'play') this.updateWave(dt);
    this.hud(dt);
  }
  updateWave(dt) {
    const c = this.combat;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    if (this.ph === 'intro') { this.timer -= dt; if (this.timer <= 0) this.ph = 'fight'; }
    else if (this.ph === 'fight') {
      this.spawnT -= dt;
      if (this.queue.length && c.alive() < this.maxAlive && this.spawnT <= 0) { this.spawnNext(); this.spawnT = 1.2; }
      if (!this.queue.length && c.alive() === 0) {
        this.ph = 'cleared'; this.timer = 2; this.score += this.wave * 150;
        this.player.hp = Math.min(Mods.maxHp, this.player.hp + Mods.maxHp * .25);
        this.banner('اكتملت الموجة ' + this.wave, '+' + (this.wave * 150) + ' نقطة');
      }
    } else if (this.ph === 'cleared') { this.timer -= dt; if (this.timer <= 0) { this.ph = 'upg'; this.openUpgrades(); } }
    else if (this.ph === 'dead') { this.timer -= dt; if (this.timer <= 0) { this.ph = 'none'; this.gameOver(); } }
  }
  hud(dt) {
    const set = (id, v) => { if (this.last[id] !== v) { this.last[id] = v; this.$(id).textContent = v; } };
    const w = (id, v) => { v = Math.round(v * 10) / 10; if (this.last[id] !== v) { this.last[id] = v; this.$(id).style.width = v + '%'; } };
    const p = this.player, g = this.gear, c = this.combat;
    w('hpfill', p.hp / p.maxHp * 100); w('gasfill', g.gas / g.maxGas * 100);
    if (this.s === 'play' || this.s === 'pause' || this.s === 'upgrade') {
      set('waveTxt', 'الموجة ' + this.wave); set('scoreTxt', 'النقاط ' + this.score);
      set('leftTxt', 'متبقٍ ' + (this.queue.length + c.alive()));
      set('comboTxt', this.combo > 1 ? 'تتابع ×' + (1 + Math.min(this.combo - 1, 8) * .25).toFixed(2).replace(/\.?0+$/, '') : '');
    }
    this.$('flash').style.opacity = c.flash * .6;
    this.$('speedfx').style.opacity = M.clamp((p.speed3 - 22) / 28, 0, 1) * .85 * (this.s === 'play' ? 1 : 0);
    this.$('cross').classList.toggle('ok', !!this.gear.aim.hit);
    if (this.feedT > 0) { this.feedT -= dt; if (this.feedT <= 0) this.$('feed').style.opacity = 0; }
  }
}
