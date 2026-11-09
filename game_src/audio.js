// أصوات مولّدة بالكود (WebAudio): لا ملفات صوتية خارجية
const Sound = {
  ctx: null, master: null, vol: .7, noise: null, gasG: null, windG: null, listener: null,
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(c.destination);
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      const loop = (type, freq, q) => {
        const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
        const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
        const g = c.createGain(); g.gain.value = 0;
        s.connect(f); f.connect(g); g.connect(this.master); s.start();
        return g;
      };
      this.gasG = loop('bandpass', 2400, .7);
      this.windG = loop('lowpass', 700, .4);
    } catch (e) { this.ctx = null; }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; },
  _pan(node, pan) {
    const c = this.ctx;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = M.clamp(pan, -1, 1); node.connect(p); p.connect(this.master); }
    else node.connect(this.master);
  },
  noiseHit(dur, type, f0, f1, g, pan) {
    const c = this.ctx; if (!c || g <= .001) return;
    const t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const gn = c.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + Math.min(.015, dur / 4)); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(gn); this._pan(gn, pan); s.start(t, Math.random()); s.stop(t + dur + .05);
  },
  tone(f0, f1, dur, g, type, pan, delay) {
    const c = this.ctx; if (!c || g <= .001) return;
    const t = c.currentTime + (delay || 0), o = c.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const gn = c.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + .01); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(gn); this._pan(gn, pan); o.start(t); o.stop(t + dur + .05);
  },
  hook() { this.noiseHit(.12, 'highpass', 1500, 5200, .16); this.tone(1000, 420, .07, .07, 'square'); },
  attach() { this.tone(1500, 1000, .14, .12, 'sine'); this.tone(2300, 1800, .09, .07, 'triangle'); this.noiseHit(.08, 'highpass', 3000, 6000, .1); },
  slash() { this.noiseHit(.2, 'bandpass', 800, 4200, .3); },
  clang() { this.tone(1900, 1500, .12, .1, 'triangle'); this.tone(2650, 2100, .1, .06, 'square'); },
  kill() { this.noiseHit(.5, 'lowpass', 1800, 120, .45); this.tone(110, 38, .6, .35, 'sawtooth'); this.tone(1500, 600, .25, .1, 'triangle'); },
  hurt() { this.tone(160, 45, .35, .5, 'sawtooth'); this.noiseHit(.3, 'lowpass', 900, 100, .45); },
  step(vol, pan) { this.tone(70, 28, .28, .5 * vol, 'sine', pan); this.noiseHit(.22, 'lowpass', 500, 80, .4 * vol, pan); },
  ui() { this.tone(660, 880, .07, .1, 'triangle'); },
  horn() { this.tone(196, 190, .9, .22, 'sawtooth'); this.tone(294, 288, .9, .16, 'sawtooth', 0, .02); },
  over() { this.tone(330, 110, 1.2, .25, 'sawtooth'); this.tone(247, 82, 1.4, .2, 'triangle', 0, .15); },
  upgrade() { this.tone(523, 523, .12, .12, 'triangle'); this.tone(659, 659, .12, .12, 'triangle', 0, .1); this.tone(784, 784, .2, .12, 'triangle', 0, .2); },
  gas(level) { if (!this.gasG) return; this.gasG.gain.setTargetAtTime(level * .16, this.ctx.currentTime, .06); },
  wind(level) { if (!this.windG) return; this.windG.gain.setTargetAtTime(.025 + level * .22, this.ctx.currentTime, .15); },
  // صوت مكاني لحدث في العالم
  at(x, y, z, fn, range) {
    const L = this.listener; if (!L || !this.ctx) return;
    const dx = x - L.pos[0], dy = y - L.pos[1], dz = z - L.pos[2], d = Math.hypot(dx, dy, dz);
    const vol = M.clamp(1 - d / (range || 200), 0, 1);
    if (vol <= .02) return;
    fn(vol * vol, M.clamp((dx * L.right[0] + dz * L.right[2]) / Math.max(d, 1), -1, 1));
  },
};
