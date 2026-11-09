const M = (() => {
  const mat4 = {
    create() { const o = new Float32Array(16); o[0] = o[5] = o[10] = o[15] = 1; return o; },
    perspective(o, fovy, aspect, n, f) {
      const t = 1 / Math.tan(fovy / 2);
      o.fill(0); o[0] = t / aspect; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
      return o;
    },
    ortho(o, l, r, b, t, n, f) {
      o.fill(0); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
      o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1;
      return o;
    },
    lookAt(o, e, c, u) {
      let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
      let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
      let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
      l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
      o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
      o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
      o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]);
      o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]);
      o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]);
      o[15] = 1;
      return o;
    },
    mul(o, a, b) {
      const t = mat4._t;
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        t[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
      for (let i = 0; i < 16; i++) o[i] = t[i];
      return o;
    },
    // يكتب مصفوفة (انتقال × دوران(yaw,pitch) × مقياس) داخل المصفوفة o ابتداءً من الإزاحة off
    trsInto(o, off, px, py, pz, yaw, pitch, sx, sy, sz) {
      const cy = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      o[off] = cy * sx; o[off + 1] = 0; o[off + 2] = -sy_ * sx; o[off + 3] = 0;
      o[off + 4] = sy_ * sp * sy; o[off + 5] = cp * sy; o[off + 6] = cy * sp * sy; o[off + 7] = 0;
      o[off + 8] = sy_ * cp * sz; o[off + 9] = -sp * sz; o[off + 10] = cy * cp * sz; o[off + 11] = 0;
      o[off + 12] = px; o[off + 13] = py; o[off + 14] = pz; o[off + 15] = 1;
    },
  };
  mat4._t = new Float32Array(16);

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  // مولّد أرقام عشوائية ثابت (لعالم متطابق في كل مرة)
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // لون sRGB سداسي → خطي
  function rgb(hex) {
    const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
    return [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2)];
  }
  return { mat4, clamp, lerp, smooth, rng, rgb };
})();
