const GLSL_COMMON = `
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+17.1; a*=.5; } return s; }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.); }
`;

const MAIN_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec4 iM0;
layout(location=3) in vec4 iM1;
layout(location=4) in vec4 iM2;
layout(location=5) in vec4 iM3;
layout(location=6) in vec4 iCol;
uniform mat4 uVP;
uniform mat4 uLightVP;
out vec3 vWPos; out vec3 vN; out vec4 vCol; out vec4 vLP; out vec3 vLoc; out vec3 vLN; out vec3 vSz;
void main(){
  mat4 m = mat4(iM0,iM1,iM2,iM3);
  vec4 wp = m*vec4(aPos,1.);
  vec3 s2 = vec3(dot(iM0.xyz,iM0.xyz),dot(iM1.xyz,iM1.xyz),dot(iM2.xyz,iM2.xyz));
  vN = normalize(mat3(m)*(aNor/s2));
  vSz = sqrt(s2); vLoc = aPos*vSz; vLN = aNor;
  vWPos = wp.xyz; vCol = iCol;
  vLP = uLightVP*vec4(wp.xyz + vN*0.2, 1.);
  gl_Position = uVP*wp;
}`;

const MAIN_FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vWPos; in vec3 vN; in vec4 vCol; in vec4 vLP; in vec3 vLoc; in vec3 vLN; in vec3 vSz;
uniform sampler2DShadow uShadow;
uniform float uShadowOn;
uniform float uTexel;
uniform float uCityR;
uniform float uLow;
uniform vec3 uSunDir, uSunCol, uSky, uGround, uFogCol, uCam;
uniform float uFogD;
out vec4 oCol;
${GLSL_COMMON}
float shadowTerm(){
  if(uShadowOn < .5) return 1.;
  vec3 p = vLP.xyz/vLP.w*.5+.5;
  float edge = max(abs(p.x-.5),abs(p.y-.5))*2.;
  if(p.z>=1. || edge>=1.) return 1.;
  float s=0.;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++)
    s += texture(uShadow, vec3(p.xy+vec2(float(x),float(y))*uTexel, p.z-.0006));
  s/=9.;
  return mix(s,1.,smoothstep(.8,1.,edge));
}
void main(){
  vec3 N = normalize(vN);
  vec3 albedo = vCol.rgb;
  int m = int(vCol.a + .5);
  vec3 L = vLoc, sz = vSz;
  bool topF = abs(vLN.y) > .5;
  float v = L.y + sz.y*.5;
  float u = abs(vLN.x) > .5 ? L.z : L.x;
  float ao = 1.;
  float wrap = 0.;
  float spec = 0.;
  if(m == 1){
    float n = fbm(vWPos.xz*.25)*.6 + vnoise(vWPos.xz*1.6)*.4;
    albedo *= .62 + .75*n;
  } else if(m == 2){
    if(!topF){
      float bs = hash(vec2(vCol.r*91.7, vCol.g*53.3));
      float cw = 3.2 + bs*1.6, ch = 3.0 + bs*.8;
      vec2 g = vec2(u/cw, v/ch);
      float fw = max(fwidth(g.x), fwidth(g.y));
      float detail = 1. - smoothstep(.12, .35, fw);
      vec2 id = floor(g), f = fract(g);
      float inX = step(.2,f.x)*step(f.x,.8), inY = step(.26,f.y)*step(f.y,.84);
      float outX = step(.14,f.x)*step(f.x,.86), outY = step(.2,f.y)*step(f.y,.9);
      float valid = step(2.2, v)*step(v, sz.y - 1.6)*detail;
      float glassM = inX*inY*valid;
      float frameM = (outX*outY - inX*inY)*valid;
      float hh = hash(id + bs*37.);
      vec3 glass = mix(vec3(.025,.04,.06), uSky*.55, .3 + .2*hh);
      vec3 frame = hh > .6 ? vec3(.22,.12,.07) : vec3(.55,.5,.42)*albedo*1.6;
      albedo = mix(albedo, frame, clamp(frameM,0.,1.));
      albedo = mix(albedo, glass, glassM);
      albedo = mix(albedo*.62, albedo, detail);
      spec = glassM*.6;
      albedo *= 1. - .12*step(f.y,.06);
      albedo *= .9 + .2*hash(floor(vec2(u*.7, v*.7)));
    }
    ao = mix(.5, 1., smoothstep(0., 5., v));
  } else if(m == 3){
    vec2 p = vWPos.xz; float r = length(p);
    float slope = 1. - N.y;
    float nA = vnoise(p*.05), nB = uLow > .5 ? vnoise(p*.4) : fbm(p*.4);
    vec3 grass = mix(vec3(.09,.19,.04), vec3(.2,.33,.08), nA)*(.75 + .5*nB);
    vec3 rock = vec3(.22,.2,.18)*(.7 + .6*(uLow > .5 ? vnoise(p*.2) : fbm(p*.2)));
    float rm = smoothstep(.16,.38, slope + vWPos.y*.0012);
    vec3 c = mix(grass, rock, rm);
    float far = smoothstep(520.,700.,r);
    float sw = (vnoise(vec2(p.y*.012,3.))-.5)*34.*far;
    float sw2 = (vnoise(vec2(p.x*.012,9.))-.5)*34.*far;
    float road = max(1.-smoothstep(3.5,6.5,abs(p.x-sw)), 1.-smoothstep(3.5,6.5,abs(p.y-sw2)));
    road *= smoothstep(uCityR+14., uCityR+24., r);
    c = mix(c, vec3(.26,.18,.1)*(.8+.4*nB), road*(1.-rm));
    float cm = 1. - smoothstep(uCityR-6., uCityR+6., r);
    vec2 g = p/3.; vec2 f = fract(g);
    float line = max(step(f.x,.06), step(f.y,.06));
    vec3 cob = vec3(.33,.3,.27)*(.78 + .45*hash(floor(g)))*(1. - .3*line)*(.9 + .2*nB);
    albedo = mix(c, cob, cm);
  } else if(m == 4 || m == 5){
    float uu = u, vv = v;
    if(m == 5){ uu = atan(L.z, L.x)*sz.x*.5; }
    if(topF){ uu = L.x; vv = L.z; }
    float bh = 2.2, bw = 4.5;
    float row = floor(vv/bh);
    float uo = uu + mod(row,2.)*bw*.5;
    vec2 id = vec2(floor(uo/bw), row);
    vec2 f = vec2(fract(uo/bw), fract(vv/bh));
    float mortar = 1. - step(.035,f.x)*step(.055,f.y);
    albedo *= .8 + .35*hash(id);
    float sd = 1. - smoothstep(.1, .3, max(fwidth(uo/bw), fwidth(vv/bh)));
    albedo = mix(albedo, albedo*.5, mortar*(topF?.4:1.)*sd);
    albedo *= .92 + .16*vnoise(vWPos.xz*.7 + vWPos.y*.5);
    if(!topF) ao = mix(.55, 1., smoothstep(0., 6., v));
  } else if(m == 6){
    albedo *= .65 + .7*vnoise(vWPos.xz*.5 + vWPos.y*.3);
    wrap = .45;
  } else if(m == 8){
    albedo *= .9 + .22*vnoise(vWPos.xz*1.8 + vWPos.y*1.3);
    wrap = .35;
  } else if(m == 7){
    float rows = fract(v*1.4);
    albedo *= (.78 + .3*smoothstep(0.,.25,rows)*(1.-smoothstep(.9,1.,rows)))*(.85 + .3*hash(vec2(floor(v*1.4), floor((L.x+L.z)*.8))));
  }
  float ndlRaw = dot(N, uSunDir);
  float ndl = max((ndlRaw + wrap)/(1. + wrap), 0.);
  float sh = ndlRaw > -wrap ? shadowTerm() : 1.;
  vec3 hemi = mix(uGround, uSky, N.y*.5 + .5);
  vec3 col = albedo*(hemi*ao + uSunCol*ndl*sh);
  vec3 V = normalize(uCam - vWPos);
  vec3 H = normalize(V + uSunDir);
  col += uSunCol*pow(max(dot(N,H),0.),40.)*(.04 + spec*.5)*sh*step(float(m), 2.5);
  col += spec*uSky*.15*pow(1. - max(dot(N,V),0.), 3.);
  float d = length(uCam - vWPos);
  float f = 1. - exp(-d*uFogD);
  float sunAmt = pow(max(dot(-V,uSunDir),0.),6.);
  vec3 fc = mix(uFogCol, vec3(1.,.78,.52), sunAmt*.45);
  col = mix(col, fc, f);
  col = aces(col*1.05);
  col = pow(col, vec3(1./2.2));
  oCol = vec4(col,1.);
}`;

const SHADOW_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=2) in vec4 iM0;
layout(location=3) in vec4 iM1;
layout(location=4) in vec4 iM2;
layout(location=5) in vec4 iM3;
uniform mat4 uLightVP;
void main(){ gl_Position = uLightVP*(mat4(iM0,iM1,iM2,iM3)*vec4(aPos,1.)); }`;
const SHADOW_FS = `#version 300 es
precision mediump float;
out vec4 o;
void main(){ o = vec4(1.); }`;

const SKY_VS = `#version 300 es
out vec2 vUV;
void main(){
  vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2));
  vUV = p*2.-1.;
  gl_Position = vec4(vUV,1.,1.);
}`;
const SKY_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec3 uRight, uUp, uFwd, uSunDir, uFogCol, uSkyTop;
uniform vec2 uTan;
uniform float uTime;
out vec4 oCol;
${GLSL_COMMON}
void main(){
  vec3 d = normalize(uFwd + uRight*vUV.x*uTan.x + uUp*vUV.y*uTan.y);
  float h = d.y;
  vec3 col = mix(uFogCol, uSkyTop, pow(clamp(h,0.,1.),.45));
  if(h<0.) col = mix(uFogCol, uFogCol*.7, clamp(-h*4.,0.,1.));
  float s = max(dot(d,uSunDir),0.);
  col += vec3(1.,.82,.55)*(pow(s,900.)*10. + pow(s,60.)*.5) + vec3(1.,.6,.3)*pow(s,6.)*.22;
  if(h>.015){
    vec2 uv = d.xz/(h+.12)*1.4 + vec2(uTime*.012, 0.);
    float c = smoothstep(.48,.82,fbm(uv));
    vec3 cc = mix(vec3(.95,.96,1.), vec3(1.,.86,.7), pow(s,3.));
    col = mix(col, cc, c*.7*smoothstep(.015,.2,h));
  }
  col = aces(col);
  col = pow(col, vec3(1./2.2));
  oCol = vec4(col,1.);
}`;

class InstanceBatch {
  constructor(r, mesh, capacity) {
    this.r = r; this.mesh = mesh; this.capacity = capacity;
    this.data = new Float32Array(capacity * 20);
    this.count = 0; this.dirty = true;
    const gl = r.gl;
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    this.vao = r.makeVAO(mesh, this.buf);
  }
  add(x, y, z, yaw, pitch, sx, sy, sz, col, mat) {
    if (this.count >= this.capacity) return -1;
    this.set(this.count, x, y, z, yaw, pitch, sx, sy, sz, col, mat);
    return this.count++;
  }
  set(i, x, y, z, yaw, pitch, sx, sy, sz, col, mat) {
    const o = i * 20;
    M.mat4.trsInto(this.data, o, x, y, z, yaw, pitch, sx, sy, sz);
    this.data[o + 16] = col[0]; this.data[o + 17] = col[1]; this.data[o + 18] = col[2]; this.data[o + 19] = mat || 0;
    this.dirty = true;
  }
  setRaw(arr) { this.data = arr; this.count = arr.length / 20; this.capacity = this.count; this.dirty = true;
    const gl = this.r.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); this.dirty = false; }
  upload() {
    if (!this.dirty) return;
    const gl = this.r.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * 20);
    this.dirty = false;
  }
  draw() {
    if (!this.count) return;
    if (this.dirty) this.upload();
    const gl = this.r.gl;
    gl.bindVertexArray(this.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, this.mesh.count, gl.UNSIGNED_SHORT, 0, this.count);
  }
}

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('هذا الجهاز لا يدعم WebGL2');
    this.gl = gl;
    this.progMain = this.program(MAIN_VS, MAIN_FS);
    this.progShadow = this.program(SHADOW_VS, SHADOW_FS);
    this.progSky = this.program(SKY_VS, SKY_FS);
    this.cube = this.makeCube();
    this.meshes = { cube: this.cube, cyl: Meshes.cylinder(this, 20), cone: Meshes.cone(this, 20), cone4: Meshes.cone(this, 4), prism: Meshes.prism(this), sphere: Meshes.sphere(this, 8, 12) };
    this.planes = new Float32Array(24);
    this.cityR = 512; this.low = false;
    this.skyVAO = gl.createVertexArray();
    this.view = M.mat4.create(); this.proj = M.mat4.create(); this.vp = M.mat4.create(); this.lightVP = M.mat4.create();
    this.shadowSize = 0; this.shadowTex = null; this.shadowFbo = null; this.shadowExtent = 90;
    this.pixelScale = 1;
    this.env = {
      sunDir: normalize3([0.45, 0.62, 0.64]),
      sunCol: scale3(M.rgb(0xffe6bf), 2.5),
      sky: scale3(M.rgb(0x7aa6e8), 0.62),
      ground: scale3(M.rgb(0x6b5a45), 0.38),
      fog: M.rgb(0xb9cde6),
      skyTop: M.rgb(0x3f74c8),
      fogDensity: 0.0016,
    };
  }
  program(vsSrc, fsSrc) {
    const gl = this.gl;
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
    p._u = {};
    return p;
  }
  u(p, name) {
    if (!(name in p._u)) p._u[name] = this.gl.getUniformLocation(p, name);
    return p._u[name];
  }
  makeCube() {
    const gl = this.gl;
    const faces = [
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
      [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
      [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    ];
    const v = [], idx = [];
    faces.forEach(([n, u, w], f) => {
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => {
        v.push(n[0] * .5 + (u[0] * a + w[0] * b) * .5, n[1] * .5 + (u[1] * a + w[1] * b) * .5, n[2] * .5 + (u[2] * a + w[2] * b) * .5, n[0], n[1], n[2]);
      });
      const o = f * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    return this.makeMesh(new Float32Array(v), new Uint16Array(idx));
  }
  makeMesh(verts, indices) {
    const gl = this.gl;
    const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const ebo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    return { vbo, ebo, count: indices.length };
  }
  makeVAO(mesh, instBuf) {
    const gl = this.gl;
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ebo);
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    for (let i = 0; i < 5; i++) {
      gl.enableVertexAttribArray(2 + i); gl.vertexAttribPointer(2 + i, 4, gl.FLOAT, false, 80, i * 16); gl.vertexAttribDivisor(2 + i, 1);
    }
    gl.bindVertexArray(null);
    return vao;
  }
  setShadowSize(size) {
    const gl = this.gl;
    if (size === this.shadowSize) return;
    if (this.shadowTex) { gl.deleteTexture(this.shadowTex); gl.deleteFramebuffer(this.shadowFbo); this.shadowTex = null; }
    this.shadowSize = size;
    if (!size) return;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.shadowTex = t; this.shadowFbo = fb;
  }
  // يحسب مصفوفة الضوء بحيث تتبع الكاميرا مع تثبيت على شبكة البكسلات لمنع الارتجاف
  updateLight(focus) {
    const s = this.env.sunDir, ext = this.shadowExtent, size = this.shadowSize || 1024;
    let up = [0, 1, 0];
    let xx = up[1] * s[2] - up[2] * s[1], xy = up[2] * s[0] - up[0] * s[2], xz = up[0] * s[1] - up[1] * s[0];
    const l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = s[1] * xz - s[2] * xy, yy = s[2] * xx - s[0] * xz, yz = s[0] * xy - s[1] * xx;
    const texel = (2 * ext) / size;
    let cx = focus[0] * xx + focus[1] * xy + focus[2] * xz;
    let cy = focus[0] * yx + focus[1] * yy + focus[2] * yz;
    const cz = focus[0] * s[0] + focus[1] * s[1] + focus[2] * s[2];
    cx = Math.round(cx / texel) * texel; cy = Math.round(cy / texel) * texel;
    const c = [xx * cx + yx * cy + s[0] * cz, xy * cx + yy * cy + s[1] * cz, xz * cx + yz * cy + s[2] * cz];
    const eye = [c[0] + s[0] * 160, c[1] + s[1] * 160, c[2] + s[2] * 160];
    const lv = M.mat4.lookAt(new Float32Array(16), eye, c, up);
    const lp = M.mat4.ortho(new Float32Array(16), -ext, ext, -ext, ext, 1, 330);
    M.mat4.mul(this.lightVP, lp, lv);
  }
  resize(renderHeightCap, factor) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth, cssH = window.innerHeight;
    let ps = Math.min(dpr, renderHeightCap / cssH) * factor;
    ps = Math.max(ps, 0.35);
    const w = Math.max(2, Math.floor(cssW * ps)), h = Math.max(2, Math.floor(cssH * ps));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.pixelScale = ps;
  }
  extractPlanes() {
    const m = this.vp, p = this.planes;
    const rows = [[m[0], m[4], m[8], m[12]], [m[1], m[5], m[9], m[13]], [m[2], m[6], m[10], m[14]], [m[3], m[7], m[11], m[15]]];
    const comb = [[3, 0, 1], [3, 0, -1], [3, 1, 1], [3, 1, -1], [3, 2, 1], [3, 2, -1]];
    comb.forEach(([a, b, sg], i) => {
      let x = rows[a][0] + sg * rows[b][0], y = rows[a][1] + sg * rows[b][1], z = rows[a][2] + sg * rows[b][2], w = rows[a][3] + sg * rows[b][3];
      const l = Math.hypot(x, y, z) || 1;
      p[i * 4] = x / l; p[i * 4 + 1] = y / l; p[i * 4 + 2] = z / l; p[i * 4 + 3] = w / l;
    });
  }
  inFrustum(c) {
    const p = this.planes, x = c.cx, y = c.cy, z = c.cz, r = c.radius;
    for (let i = 0; i < 6; i++) if (p[i * 4] * x + p[i * 4 + 1] * y + p[i * 4 + 2] * z + p[i * 4 + 3] < -r) return false;
    return true;
  }
  render(chunks, cam, time) {
    const gl = this.gl, env = this.env;
    const aspect = this.canvas.width / this.canvas.height;
    const eye = cam.pos;
    const target = [eye[0] + cam.fwd[0], eye[1] + cam.fwd[1], eye[2] + cam.fwd[2]];
    M.mat4.lookAt(this.view, eye, target, [0, 1, 0]);
    M.mat4.perspective(this.proj, cam.fov, aspect, cam.near, cam.far);
    M.mat4.mul(this.vp, this.proj, this.view);
    this.extractPlanes();
    const vis = [];
    for (const c of chunks) if (this.inFrustum(c)) vis.push(c);
    this.stats = { chunks: vis.length, total: chunks.length };

    const shadowOn = !!this.shadowTex;
    if (shadowOn) {
      const focus = cam.focus || eye;
      this.updateLight(focus);
      const lim = this.shadowExtent * 1.5 + 60;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
      gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
      gl.enable(gl.CULL_FACE);
      gl.useProgram(this.progShadow);
      gl.uniformMatrix4fv(this.u(this.progShadow, 'uLightVP'), false, this.lightVP);
      for (const c of chunks) {
        if (c.noShadow) continue;
        const dx = c.cx - focus[0], dz = c.cz - focus[2];
        if (Math.hypot(dx, dz) < lim + c.radius) for (const b of c.batches) b.draw();
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);

    const ps = this.progSky;
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.useProgram(ps);
    const th = Math.tan(cam.fov / 2);
    gl.uniform3fv(this.u(ps, 'uRight'), cam.right); gl.uniform3fv(this.u(ps, 'uUp'), cam.up); gl.uniform3fv(this.u(ps, 'uFwd'), cam.fwd);
    gl.uniform2f(this.u(ps, 'uTan'), th * aspect, th);
    gl.uniform3fv(this.u(ps, 'uSunDir'), env.sunDir); gl.uniform3fv(this.u(ps, 'uFogCol'), env.fog); gl.uniform3fv(this.u(ps, 'uSkyTop'), env.skyTop);
    gl.uniform1f(this.u(ps, 'uTime'), time);
    gl.bindVertexArray(this.skyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const pm = this.progMain;
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE);
    gl.useProgram(pm);
    gl.uniformMatrix4fv(this.u(pm, 'uVP'), false, this.vp);
    gl.uniformMatrix4fv(this.u(pm, 'uLightVP'), false, this.lightVP);
    gl.uniform3fv(this.u(pm, 'uSunDir'), env.sunDir); gl.uniform3fv(this.u(pm, 'uSunCol'), env.sunCol);
    gl.uniform3fv(this.u(pm, 'uSky'), env.sky); gl.uniform3fv(this.u(pm, 'uGround'), env.ground);
    gl.uniform3fv(this.u(pm, 'uFogCol'), env.fog); gl.uniform3fv(this.u(pm, 'uCam'), eye);
    gl.uniform1f(this.u(pm, 'uFogD'), env.fogDensity);
    gl.uniform1f(this.u(pm, 'uCityR'), this.cityR);
    gl.uniform1f(this.u(pm, 'uLow'), this.low ? 1 : 0);
    gl.uniform1f(this.u(pm, 'uShadowOn'), shadowOn ? 1 : 0);
    gl.uniform1f(this.u(pm, 'uTexel'), 1 / (this.shadowSize || 1024));
    if (shadowOn) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
      gl.uniform1i(this.u(pm, 'uShadow'), 0);
    }
    for (const c of vis) for (const b of c.batches) b.draw();
  }
}

function normalize3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function scale3(v, s) { return [v[0] * s, v[1] * s, v[2] * s]; }
