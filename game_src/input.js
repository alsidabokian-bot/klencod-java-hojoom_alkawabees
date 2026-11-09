const Input = {
  stick: { x: 0, y: 0 },
  keys: {},
  lookDX: 0, lookDY: 0,
  init(stickEl, knobEl, lookEl) {
    const R = () => stickEl.getBoundingClientRect().width * 0.36;
    let stickId = null, cx = 0, cy = 0;
    const setKnob = (dx, dy) => { knobEl.style.transform = `translate(${dx}px,${dy}px)`; };
    stickEl.addEventListener('pointerdown', e => {
      if (stickId !== null) return;
      stickId = e.pointerId; stickEl.setPointerCapture(e.pointerId);
      const r = stickEl.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      this._stickMove(e, cx, cy, R(), setKnob); e.preventDefault();
    });
    stickEl.addEventListener('pointermove', e => { if (e.pointerId === stickId) this._stickMove(e, cx, cy, R(), setKnob); });
    const end = e => { if (e.pointerId === stickId) { stickId = null; this.stick.x = this.stick.y = 0; setKnob(0, 0); } };
    stickEl.addEventListener('pointerup', end); stickEl.addEventListener('pointercancel', end);

    const looks = new Map();
    lookEl.addEventListener('pointerdown', e => {
      looks.set(e.pointerId, [e.clientX, e.clientY]); lookEl.setPointerCapture(e.pointerId); e.preventDefault();
    });
    lookEl.addEventListener('pointermove', e => {
      const p = looks.get(e.pointerId); if (!p) return;
      this.lookDX += e.clientX - p[0]; this.lookDY += e.clientY - p[1]; p[0] = e.clientX; p[1] = e.clientY;
    });
    const lend = e => looks.delete(e.pointerId);
    lookEl.addEventListener('pointerup', lend); lookEl.addEventListener('pointercancel', lend);

    window.addEventListener('keydown', e => { if (!e.repeat) this._kd[e.code] = true; this.keys[e.code] = true; });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  },
  btn: {}, _pressed: {}, _kd: {},
  bindButton(el, name) {
    el.addEventListener('pointerdown', e => { this.btn[name] = true; this._pressed[name] = true; el.setPointerCapture(e.pointerId); el.classList.add('on'); e.preventDefault(); });
    const up = e => { this.btn[name] = false; el.classList.remove('on'); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  },
  held(name, key) { return !!this.btn[name] || (!!key && !!this.keys[key]); },
  pressed(name, key) { const p = this._pressed[name] || (key && this._kd[key]); this._pressed[name] = false; if (key) this._kd[key] = false; return !!p; },
  _stickMove(e, cx, cy, radius, setKnob) {
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const l = Math.hypot(dx, dy);
    if (l > radius) { dx *= radius / l; dy *= radius / l; }
    setKnob(dx, dy);
    this.stick.x = dx / radius; this.stick.y = -dy / radius;
  },
  getMove() {
    let x = this.stick.x, y = this.stick.y;
    const k = this.keys;
    if (k.KeyW || k.ArrowUp) y += 1; if (k.KeyS || k.ArrowDown) y -= 1;
    if (k.KeyD || k.ArrowRight) x += 1; if (k.KeyA || k.ArrowLeft) x -= 1;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return [x, y];
  },
  consumeLook() { const r = [this.lookDX, this.lookDY]; this.lookDX = this.lookDY = 0; return r; },
};
