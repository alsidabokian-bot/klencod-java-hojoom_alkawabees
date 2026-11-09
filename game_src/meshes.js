// مجسمات إضافية: أسطوانة، مخروط، منشور سقف، كرة
const Meshes = {
  cylinder(r, seg) {
    const v = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      v.push(c * .5, -.5, s * .5, c, 0, s, c * .5, .5, s * .5, c, 0, s);
    }
    for (let i = 0; i < seg; i++) { const o = i * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
    let base = v.length / 6;
    v.push(0, .5, 0, 0, 1, 0);
    for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; v.push(Math.cos(a) * .5, .5, Math.sin(a) * .5, 0, 1, 0); }
    for (let i = 0; i < seg; i++) idx.push(base, base + 2 + i, base + 1 + i);
    base = v.length / 6;
    v.push(0, -.5, 0, 0, -1, 0);
    for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; v.push(Math.cos(a) * .5, -.5, Math.sin(a) * .5, 0, -1, 0); }
    for (let i = 0; i < seg; i++) idx.push(base, base + 1 + i, base + 2 + i);
    return r.makeMesh(new Float32Array(v), new Uint16Array(idx));
  },
  cone(r, seg) {
    const v = [], idx = [];
    const nl = Math.hypot(1, .5);
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      v.push(c * .5, -.5, s * .5, c / nl, .5 / nl, s / nl, 0, .5, 0, c / nl, .5 / nl, s / nl);
    }
    for (let i = 0; i < seg; i++) { const o = i * 2; idx.push(o, o + 2, o + 1); }
    const base = v.length / 6;
    v.push(0, -.5, 0, 0, -1, 0);
    for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; v.push(Math.cos(a) * .5, -.5, Math.sin(a) * .5, 0, -1, 0); }
    for (let i = 0; i < seg; i++) idx.push(base, base + 1 + i, base + 2 + i);
    return r.makeMesh(new Float32Array(v), new Uint16Array(idx));
  },
  // منشور مثلثي لسقف جملوني: العرض على x والقمة على طول z
  prism(r) {
    const v = [], idx = [];
    const q = (a, b, c, d, n) => { const o = v.length / 6; [a, b, c, d].forEach(p => v.push(p[0], p[1], p[2], n[0], n[1], n[2])); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); };
    const k = Math.hypot(1, .5);
    q([-.5, -.5, .5], [0, .5, .5], [0, .5, -.5], [-.5, -.5, -.5], [-1 / k, .5 / k, 0]);
    q([.5, -.5, -.5], [0, .5, -.5], [0, .5, .5], [.5, -.5, .5], [1 / k, .5 / k, 0]);
    q([-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5], [0, -1, 0]);
    let o = v.length / 6;
    [[-.5, -.5, .5], [.5, -.5, .5], [0, .5, .5]].forEach(p => v.push(p[0], p[1], p[2], 0, 0, 1)); idx.push(o, o + 1, o + 2);
    o = v.length / 6;
    [[.5, -.5, -.5], [-.5, -.5, -.5], [0, .5, -.5]].forEach(p => v.push(p[0], p[1], p[2], 0, 0, -1)); idx.push(o, o + 1, o + 2);
    return r.makeMesh(new Float32Array(v), new Uint16Array(idx));
  },
  sphere(r, lat, lon) {
    const v = [], idx = [];
    for (let i = 0; i <= lat; i++) {
      const t = i / lat * Math.PI, y = Math.cos(t), rr = Math.sin(t);
      for (let j = 0; j <= lon; j++) {
        const p = j / lon * Math.PI * 2, x = rr * Math.cos(p), z = rr * Math.sin(p);
        v.push(x * .5, y * .5, z * .5, x, y, z);
      }
    }
    for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) {
      const a = i * (lon + 1) + j, b = a + lon + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    return r.makeMesh(new Float32Array(v), new Uint16Array(idx));
  },
};
