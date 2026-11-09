function showError(msg) {
  const el = document.getElementById('err');
  el.style.display = 'block'; el.textContent = 'خطأ: ' + msg;
}
window.addEventListener('error', e => showError(e.message + (e.lineno ? ' (سطر ' + e.lineno + ')' : '')));
window.addEventListener('unhandledrejection', e => showError(String(e.reason)));

function start() {
  Save.load();
  const canvas = document.getElementById('c');
  const r = new Renderer(canvas);
  const world = buildWorld(r);
  const chunks = world.chunks;
  Input.init(document.getElementById('stick'), document.getElementById('knob'), document.getElementById('look'));
  Input.bindButton(document.getElementById('btnJump'), 'jump');
  Input.bindButton(document.getElementById('btnHookL'), 'hookL');
  Input.bindButton(document.getElementById('btnHookR'), 'hookR');
  Input.bindButton(document.getElementById('btnGas'), 'gas');
  Input.bindButton(document.getElementById('btnSlash'), 'slash');

  const player = new Player(0, 330, 0);
  const character = new Character(r); chunks.push(character.chunk);
  const chase = new ChaseCam(); chase.yaw = 0; chase.pitch = -0.16;
  const gear = new Gear(r); chunks.push(gear.chunk);
  const combat = new Combat(r, gear, player, chunks);
  Sound.listener = chase.cam;

  let factor = 1, lockUp = 0, slow = 0, fast = 0, avg = 16.7, last = performance.now(), t0 = last, shown = 0;
  const hud = document.getElementById('fps');
  const applyQuality = () => {
    const q = QUALITY[Save.data.settings.quality] || QUALITY.high;
    r.setShadowSize(q.shadow); r.low = q.shadow === 0; r.resize(q.cap, factor);
  };
  const game = new Game({ player, gear, combat, chase, character, applyQuality });
  window.addEventListener('resize', applyQuality);
  window.addEventListener('pointerdown', () => { Sound.init(); Sound.resume(); }, { passive: true });
  window.addEventListener('keydown', () => { Sound.init(); Sound.resume(); });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); showError('فقد الجهاز سياق الرسم، أعد فتح اللعبة'); });
  window.__back = () => game.onBack();
  window.__g = { r, chunks, player, chase, gear, combat, game, character, set(x, y, z, yw, pt) { player.x = x; player.z = z; player.y = y; player.vx = player.vy = player.vz = 0; chase.yaw = yw; chase.pitch = pt; chase.init = false; chase.cur = chase.dist; } };
  applyQuality();

  function frame(now) {
    requestAnimationFrame(frame);
    const rawDt = Math.max(0, now - last); last = now;
    const dt = Math.min(rawDt, 50) / 1000;
    avg += (rawDt - avg) * 0.05;
    // دقة الرسم التكيفية
    if (avg > 19.5) { slow++; fast = 0; } else if (avg < 17.6) { fast++; slow = 0; } else { slow = fast = 0; }
    if (slow > 40 && factor > 0.6) { factor = Math.max(0.6, factor - 0.08); slow = 0; lockUp = now + 15000; applyQuality(); }
    else if (fast > 240 && factor < 1 && now > lockUp) { factor = Math.min(1, factor + 0.04); fast = 0; applyQuality(); }

    const [lx, ly] = Input.consumeLook();
    const t = (now - t0) / 1000;
    game.update(dt, lx, ly, t);
    r.render(chunks, chase.cam, t);

    if (now - shown > 500) {
      shown = now;
      if (Save.data.settings.fps) hud.textContent = 'FPS ' + Math.round(1000 / avg) + '  |  ' + r.canvas.width + 'x' + r.canvas.height + '  |  scale ' + (Math.round(factor * 100) / 100);
    }
  }
  requestAnimationFrame(frame);
}

// شاشة التحميل: تُرسم أولًا ثم يُبنى العالم
setTimeout(() => {
  try { start(); } catch (e) { showError(e.message || String(e)); }
  const l = document.getElementById('loading'); if (l) l.style.display = 'none';
}, 80);
