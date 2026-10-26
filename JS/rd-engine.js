/**
 * RD ENGINE
 * Gray-Scott reaction-diffusion on WebGL2.
 *
 * Every setting is numeric, and the engine always renders a blend of two
 * settings (A, B, t), so presets can morph into each other continuously —
 * including the k/f map mode and the color palette.
 *
 * Pad coordinates (k1, f1, k2, f2) and most sliders live in [-1, 1].
 */

(function() {
  'use strict';

  const SIM_LONG_SIDE = 640;
  const SEED_RADIUS = 6;

  // Parameter schema: key -> default. Enum keys are blended by the engine itself.
  const DEFAULTS = {
    k1: 0, f1: 0, k2: 0.6, f2: -0.6, kfMap: 0,
    scale: 0, scaleRadial: 0, scaleRandom: 0, scaleRing: 0,
    flowRadial: 0, flowRotate: 0, flowSwirl: 0, flowVortex: 0, flowWave: 0, flowVert: 0,
    orientRadial: 0, orientSwirl: 0, orientVert: 0, orientRandom: 0,
    palette: 0, emboss: 1, invert: 0,
    hue: 0, saturation: 0, brightness: 0, contrast: 0, colorFreq: 0, colorPhase: 0,
    speed: 0
  };
  const ENUM_KEYS = ['kfMap', 'palette'];

  const KF_MAPS = ['none', 'radial', 'random', 'ring', 'horizontal', 'vertical'];

  // Palettes: color stops spread evenly from low to high concentration.
  const PALETTES = [
    { name: 'Ink',     stops: ['#08080c', '#2a2a36', '#d8d4c8', '#f6f3ea'] },
    { name: 'Scan',    stops: ['#030305', '#003d22', '#00ff88', '#eafff4'] },
    { name: 'Ember',   stops: ['#120408', '#7a1020', '#ff6b35', '#ffd27a'] },
    { name: 'Ocean',   stops: ['#020b18', '#0a4b78', '#3fb5c9', '#e6fbff'] },
    { name: 'Neon',    stops: ['#10002b', '#7b2cbf', '#ff2e88', '#ffe066'] },
    { name: 'Moss',    stops: ['#0f1a0c', '#3c6e33', '#a7c957', '#f2e8cf'] },
    { name: 'Ice',     stops: ['#0d1b2a', '#415a77', '#a9d6e5', '#ffffff'] },
    { name: 'Dusk',    stops: ['#1a1033', '#6a2c70', '#f08a5d', '#f9ed69'] },
    { name: 'Candy',   stops: ['#2b1055', '#ff7eb3', '#7afcff', '#feff9c'] },
    { name: 'Rust',    stops: ['#1b0e07', '#8a3b12', '#e3a46b', '#f5e6d3'] },
    { name: 'Bone',    stops: ['#f4efe6', '#c9bfae', '#4a4036', '#0e0c0a'] },
    { name: 'Toxic',   stops: ['#050a00', '#1f3b00', '#b6ff00', '#f7ffe0'] }
  ];

  const VERT = `#version 300 es
    in vec2 aPos;
    out vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }`;

  const COMMON = `#version 300 es
    precision highp float;
    precision highp int;
    uniform ivec2 uRes;

    // Centered position, short side spans [-1, 1]
    vec2 centered(vec2 cell) {
      vec2 res = vec2(uRes);
      return (cell - res * 0.5) / (min(res.x, res.y) * 0.5);
    }
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) {
      return 0.65 * vnoise(p) + 0.35 * vnoise(p * 2.03 + 7.1);
    }
  `;

  // Per-cell parameters: k, f, diffusion scale, flow velocity, anisotropy
  const FIELD_FRAG = COMMON + `
    uniform vec4 uKF;          // k1 f1 k2 f2 (pad space)
    uniform ivec2 uMap;        // kf map mode A, B
    uniform float uMapT;
    uniform vec4 uScale;       // all radial random ring
    uniform vec3 uFlow0;       // radial rotate swirl
    uniform vec3 uFlow1;       // vortex wave vertical
    uniform vec4 uOrient;      // radial swirl vertical random
    uniform vec2 uSeed;
    layout(location = 0) out vec4 oField0;
    layout(location = 1) out vec4 oField1;

    const float PI = 3.14159265;

    // Pad -> Gray-Scott (k, f). x walks across the pattern band left of the
    // saddle-node line k = sqrt(f)/2 - f, y spans the feed rate.
    vec2 padToKF(vec2 pad) {
      float f = mix(0.01, 0.07, pad.y * 0.5 + 0.5);
      float kc = sqrt(f) * 0.5 - f;
      float k = kc + mix(-0.004, 0.008, pad.x * 0.5 + 0.5);
      return vec2(k, f);
    }

    float mapWeight(int mode, vec2 p, float rmax) {
      float r = length(p);
      if (mode == 1) return clamp(r / rmax, 0.0, 1.0);
      if (mode == 2) return smoothstep(0.2, 0.8, fbm(p * 1.2 + uSeed));
      if (mode == 3) return 0.5 + 0.5 * cos(r * PI * 2.5);
      if (mode == 4) return clamp(p.x / (rmax * 0.8) * 0.5 + 0.5, 0.0, 1.0);
      if (mode == 5) return p.y * 0.5 + 0.5;
      return 0.0;
    }

    void main() {
      vec2 cell = gl_FragCoord.xy;
      vec2 p = centered(cell);
      vec2 res = vec2(uRes);
      float rmax = length(res * 0.5) / (min(res.x, res.y) * 0.5);
      float r = length(p);

      float w = mix(mapWeight(uMap.x, p, rmax), mapWeight(uMap.y, p, rmax), uMapT);
      vec2 kf = padToKF(mix(uKF.xy, uKF.zw, w));

      float s = uScale.x
              + uScale.y * (r / rmax * 2.0 - 1.0)
              + uScale.z * (fbm(p * 1.5 + uSeed.yx) * 2.0 - 1.0)
              + uScale.w * cos(r * PI * 3.0);
      float m = min(exp2(clamp(s, -1.0, 1.0) * 1.5 - 1.0), 1.0);

      vec2 perp = vec2(-p.y, p.x);
      vec2 v = uFlow0.x * p * 0.12
             + uFlow0.y * perp * 0.12
             + uFlow0.z * perp / (dot(p, p) + 0.12) * 0.03;
      float a = 1.5 * PI;
      v += uFlow1.x * 0.04 * vec2(sin(a * p.x) * cos(a * p.y), -cos(a * p.x) * sin(a * p.y));
      v += uFlow1.y * vec2(sin(PI * p.y * 2.5), 0.0) * 0.12;
      v += uFlow1.z * vec2(0.0, 0.12);
      float vl = length(v);
      if (vl > 0.35) v *= 0.35 / vl;

      // Anisotropy as (cos 2θ, sin 2θ) weighted by strength
      float th = atan(p.y, p.x);
      vec2 o = uOrient.x * vec2(cos(2.0 * th), sin(2.0 * th))
             + uOrient.y * vec2(cos(2.0 * th + PI * 0.5), sin(2.0 * th + PI * 0.5))
             + uOrient.z * vec2(-1.0, 0.0);
      float tr = fbm(p * 1.3 + uSeed + 3.7) * 4.0 * PI;
      o += uOrient.w * vec2(cos(tr), sin(tr));
      float ol = length(o);
      if (ol > 0.85) o *= 0.85 / ol;

      oField0 = vec4(kf, m, 0.0);
      oField1 = vec4(v, o);
    }`;

  const SIM_FRAG = COMMON + `
    uniform sampler2D uState;
    uniform sampler2D uField0;
    uniform sampler2D uField1;
    out vec4 oState;

    vec2 at(ivec2 p) {
      return texelFetch(uState, clamp(p, ivec2(0), uRes - 1), 0).xy;
    }

    void main() {
      ivec2 p = ivec2(gl_FragCoord.xy);
      vec2 C = at(p);
      vec2 E = at(p + ivec2(1, 0)), W = at(p - ivec2(1, 0));
      vec2 N = at(p + ivec2(0, 1)), S = at(p - ivec2(0, 1));
      vec2 NE = at(p + ivec2(1, 1)), NW = at(p + ivec2(-1, 1));
      vec2 SE = at(p + ivec2(1, -1)), SW = at(p + ivec2(-1, -1));

      vec4 f0 = texelFetch(uField0, p, 0);
      vec4 f1 = texelFetch(uField1, p, 0);

      vec2 lap = 0.2 * (E + W + N + S) + 0.05 * (NE + NW + SE + SW) - C;
      vec2 uxx = E + W - 2.0 * C, uyy = N + S - 2.0 * C;
      vec2 uxy = (NE - NW - SE + SW) * 0.25;
      lap += 0.3 * (f1.z * (uxx - uyy) + 2.0 * f1.w * uxy);

      // Upwind advection
      vec2 gx = f1.x > 0.0 ? C - W : E - C;
      vec2 gy = f1.y > 0.0 ? C - S : N - C;
      vec2 adv = f1.x * gx + f1.y * gy;

      float a = C.x, b = C.y;
      float abb = a * b * b;
      float k = f0.x, f = f0.y, m = f0.z;
      float na = a + m * lap.x - abb + f * (1.0 - a) - adv.x;
      float nb = b + 0.5 * m * lap.y + abb - (k + f) * b - adv.y;
      oState = vec4(clamp(na, 0.0, 1.0), clamp(nb, 0.0, 1.0), 0.0, 1.0);
    }`;

  const PAINT_FRAG = COMMON + `
    uniform sampler2D uState;
    uniform vec3 uBrush;       // x y radius (cells)
    uniform int uMode;         // 0 seed, 1 erase, 2 reset
    out vec4 oState;
    void main() {
      ivec2 p = ivec2(gl_FragCoord.xy);
      vec2 s = texelFetch(uState, p, 0).xy;
      if (uMode == 2) { oState = vec4(1.0, 0.0, 0.0, 1.0); return; }
      float d = length(gl_FragCoord.xy - uBrush.xy);
      float w = 1.0 - smoothstep(uBrush.z * 0.6, uBrush.z, d);
      vec2 target = uMode == 1 ? vec2(1.0, 0.0) : vec2(0.5, 0.25);
      oState = vec4(mix(s, target, w), 0.0, 1.0);
    }`;

  // Min/max of B over each block, so a single small seed is never missed
  const PROBE_FRAG = COMMON + `
    uniform sampler2D uState;
    uniform ivec2 uProbeRes;
    out vec4 o;
    void main() {
      ivec2 size = (uRes + uProbeRes - 1) / uProbeRes;
      ivec2 base = ivec2(gl_FragCoord.xy) * size;
      float lo = 1.0, hi = 0.0;
      for (int y = 0; y < 64; y++) {
        if (y >= size.y) break;
        for (int x = 0; x < 64; x++) {
          if (x >= size.x) break;
          float b = texelFetch(uState, min(base + ivec2(x, y), uRes - 1), 0).y;
          lo = min(lo, b);
          hi = max(hi, b);
        }
      }
      o = vec4(hi * 2.0, lo * 2.0, 0.0, 1.0);
    }`;

  const RENDER_FRAG = COMMON + `
    uniform sampler2D uState;
    uniform sampler2D uPal;
    uniform vec3 uPalette;     // row A, row B, t
    uniform float uPalRows;
    uniform float uEmboss, uInvert;
    uniform vec3 uColor0;      // hue saturation brightness
    uniform vec3 uColor1;      // contrast freq phase
    uniform vec2 uOut;         // output size in pixels
    in vec2 vUv;
    out vec4 o;

    vec2 st(ivec2 p) {
      return texelFetch(uState, clamp(p, ivec2(0), uRes - 1), 0).xy;
    }
    // Bilinear sample of the concentration value
    float value(vec2 cell) {
      vec2 c = cell - 0.5;
      ivec2 i = ivec2(floor(c));
      vec2 f = c - floor(c);
      vec2 s = mix(mix(st(i), st(i + ivec2(1, 0)), f.x),
                   mix(st(i + ivec2(0, 1)), st(i + ivec2(1, 1)), f.x), f.y);
      return clamp((1.0 - s.x + s.y) * 0.85, 0.0, 1.0);
    }
    vec3 palette(float x, float row) {
      return texture(uPal, vec2(x, (row + 0.5) / uPalRows)).rgb;
    }
    vec3 hueRotate(vec3 c, float a) {
      const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
      const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
      vec3 yiq = toYIQ * c;
      float cs = cos(a), sn = sin(a);
      yiq.yz = mat2(cs, sn, -sn, cs) * yiq.yz;
      return toRGB * yiq;
    }

    // Fill the output without stretching if its aspect differs from the grid
    vec2 coverUv(vec2 uv) {
      float simAr = float(uRes.x) / float(uRes.y);
      float outAr = uOut.x / uOut.y;
      if (outAr > simAr) uv.y = (uv.y - 0.5) * simAr / outAr + 0.5;
      else uv.x = (uv.x - 0.5) * outAr / simAr + 0.5;
      return uv;
    }

    void main() {
      vec2 cell = coverUv(vUv) * vec2(uRes);
      float t = value(cell);
      float gx = value(cell + vec2(1, 0)) - value(cell - vec2(1, 0));
      float gy = value(cell + vec2(0, 1)) - value(cell - vec2(0, 1));

      t = clamp((t - 0.5) * exp2(uColor1.x * 1.5) + 0.5, 0.0, 1.0);
      float x = t * exp2(uColor1.y * 2.0) + uColor1.z;
      x = 1.0 - abs(mod(x, 2.0) - 1.0);
      vec3 col = mix(palette(x, uPalette.x), palette(x, uPalette.y), uPalette.z);

      col = hueRotate(col, uColor0.x * 3.14159265);
      float gray = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(gray), col, 1.0 + uColor0.y);
      col *= exp2(uColor0.z * 1.2);

      vec3 n = normalize(vec3(-gx * 6.0, -gy * 6.0, 1.0));
      vec3 L = normalize(vec3(-0.5, 0.7, 0.6));
      float diff = max(dot(n, L), 0.0);
      float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
      vec3 lit = col * (0.35 + 0.75 * diff) + spec * 0.35;
      col = mix(col, lit, uEmboss);

      col = mix(col, 1.0 - col, uInvert);
      o = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`;

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  class RDEngine {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
      if (!gl) throw new Error('WebGL2 is not available');
      this.gl = gl;

      const full = gl.getExtension('EXT_color_buffer_float');
      const half = full || gl.getExtension('EXT_color_buffer_half_float');
      if (!half) throw new Error('Float render targets are not supported');
      this.floatFormat = full ? gl.RGBA32F : gl.RGBA16F;

      this.quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

      this.progs = {
        field: this._program(FIELD_FRAG),
        sim: this._program(SIM_FRAG),
        paint: this._program(PAINT_FRAG),
        probe: this._program(PROBE_FRAG),
        render: this._program(RENDER_FRAG)
      };

      this._initPalettes();
      this.probeRes = [32, 18];
      this.probeTex = this._texture(this.probeRes[0], this.probeRes[1], gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
      this.probeFbo = this._fbo([this.probeTex]);
      this.probeBuf = new Uint8Array(this.probeRes[0] * this.probeRes[1] * 4);

      this.noiseSeed = [3.1, 7.7];
      this.setAspect(16, 9);
      this.setParams(DEFAULTS);
    }

    // --- GL helpers -------------------------------------------------------

    _program(fragSrc) {
      const gl = this.gl;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragSrc));
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const uniforms = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const name = gl.getActiveUniform(p, i).name;
        uniforms[name] = gl.getUniformLocation(p, name);
      }
      return { p, u: uniforms };
    }

    _texture(w, h, internal, format, type, filter) {
      const gl = this.gl;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }

    _fbo(textures) {
      const gl = this.gl;
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      textures.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
      gl.drawBuffers(textures.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Incomplete framebuffer');
      return f;
    }

    _floatTex() {
      const gl = this.gl;
      return this._texture(this.simW, this.simH, this.floatFormat, gl.RGBA, gl.FLOAT);
    }

    _draw(prog, fbo, w, h) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, w, h);
      gl.useProgram(prog.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    _bindTex(prog, name, tex, unit) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(prog.u[name], unit);
    }

    _initPalettes() {
      const gl = this.gl;
      const W = 256, rows = PALETTES.length;
      const data = new Uint8Array(W * rows * 4);
      PALETTES.forEach((pal, r) => {
        const stops = pal.stops.map(hexToRgb);
        for (let x = 0; x < W; x++) {
          const pos = x / (W - 1) * (stops.length - 1);
          const i = Math.min(Math.floor(pos), stops.length - 2);
          const f = pos - i;
          for (let c = 0; c < 3; c++) data[(r * W + x) * 4 + c] = stops[i][c] + (stops[i + 1][c] - stops[i][c]) * f;
          data[(r * W + x) * 4 + 3] = 255;
        }
      });
      this.palTex = this._texture(W, rows, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, rows, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }

    // --- Public API ---------------------------------------------------------

    /** Sets the simulation grid aspect ratio; resets the state. */
    setAspect(aw, ah) {
      const gl = this.gl;
      const long = SIM_LONG_SIDE;
      this.simW = aw >= ah ? long : Math.round(long * aw / ah);
      this.simH = aw >= ah ? Math.round(long * ah / aw) : long;
      [this.state, this.field0, this.field1].flat().filter(Boolean).forEach(t => gl.deleteTexture(t));
      [this.stateFbo, this.fieldFbo].flat().filter(Boolean).forEach(f => gl.deleteFramebuffer(f));
      this.state = [this._floatTex(), this._floatTex()];
      this.stateFbo = this.state.map(t => this._fbo([t]));
      this.field0 = this._floatTex();
      this.field1 = this._floatTex();
      this.fieldFbo = this._fbo([this.field0, this.field1]);
      this.cur = 0;
      this.fieldDirty = true;
      this.reset();
    }

    /** Output (canvas) size in pixels. */
    resizeOutput(w, h) {
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
    }

    /** Blend of two settings: a -> b by t in [0, 1]. */
    setParams(a, b, t) {
      b = b || a;
      t = t || 0;
      const p = {};
      for (const key in DEFAULTS) {
        const va = a[key] ?? DEFAULTS[key], vb = b[key] ?? DEFAULTS[key];
        p[key] = ENUM_KEYS.includes(key) ? [va, vb] : va + (vb - va) * t;
      }
      p.t = t;
      this.p = p;
      this.fieldDirty = true;
    }

    /** Simulation iterations per 1/60 s at the current speed. */
    itersPer60() {
      return 8 * Math.pow(2, this.p.speed * 2);
    }

    /** Clears the field and plants a single seed in the center. */
    reset() {
      this._paint(2, 0, 0, 0);
      this._paint(0, this.simW / 2, this.simH / 2, SEED_RADIUS);
    }

    clear() {
      this._paint(2, 0, 0, 0);
    }

    addSeeds(count, rng) {
      rng = rng || Math.random;
      for (let i = 0; i < count; i++) {
        this._paint(0, rng() * this.simW, rng() * this.simH, 3 + rng() * 5);
      }
    }

    /** Brush at normalized canvas coords (0..1, y down). */
    paint(nx, ny, radius, erase) {
      const simAr = this.simW / this.simH;
      const outAr = this.canvas.width / this.canvas.height;
      let u = nx, v = 1 - ny;
      if (outAr > simAr) v = (v - 0.5) * simAr / outAr + 0.5;
      else u = (u - 0.5) * outAr / simAr + 0.5;
      this._paint(erase ? 1 : 0, u * this.simW, v * this.simH, radius);
    }

    _paint(mode, x, y, r) {
      const gl = this.gl, prog = this.progs.paint;
      const src = this.cur, dst = 1 - this.cur;
      gl.useProgram(prog.p);
      gl.uniform2i(prog.u.uRes, this.simW, this.simH);
      gl.uniform3f(prog.u.uBrush, x, y, r);
      gl.uniform1i(prog.u.uMode, mode);
      this._bindTex(prog, 'uState', this.state[src], 0);
      this._draw(prog, this.stateFbo[dst], this.simW, this.simH);
      this.cur = dst;
    }

    _updateField() {
      const gl = this.gl, prog = this.progs.field, p = this.p;
      gl.useProgram(prog.p);
      gl.uniform2i(prog.u.uRes, this.simW, this.simH);
      gl.uniform4f(prog.u.uKF, p.k1, p.f1, p.k2, p.f2);
      gl.uniform2i(prog.u.uMap, p.kfMap[0], p.kfMap[1]);
      gl.uniform1f(prog.u.uMapT, p.t);
      gl.uniform4f(prog.u.uScale, p.scale, p.scaleRadial, p.scaleRandom, p.scaleRing);
      gl.uniform3f(prog.u.uFlow0, p.flowRadial, p.flowRotate, p.flowSwirl);
      gl.uniform3f(prog.u.uFlow1, p.flowVortex, p.flowWave, p.flowVert);
      gl.uniform4f(prog.u.uOrient, p.orientRadial, p.orientSwirl, p.orientVert, p.orientRandom);
      gl.uniform2f(prog.u.uSeed, this.noiseSeed[0], this.noiseSeed[1]);
      this._draw(prog, this.fieldFbo, this.simW, this.simH);
      this.fieldDirty = false;
    }

    step(iterations) {
      if (iterations <= 0) return;
      const gl = this.gl, prog = this.progs.sim;
      if (this.fieldDirty) this._updateField();
      gl.useProgram(prog.p);
      gl.uniform2i(prog.u.uRes, this.simW, this.simH);
      this._bindTex(prog, 'uField0', this.field0, 1);
      this._bindTex(prog, 'uField1', this.field1, 2);
      for (let i = 0; i < iterations; i++) {
        this._bindTex(prog, 'uState', this.state[this.cur], 0);
        this._draw(prog, this.stateFbo[1 - this.cur], this.simW, this.simH);
        this.cur = 1 - this.cur;
      }
    }

    render() {
      const gl = this.gl, prog = this.progs.render, p = this.p;
      gl.useProgram(prog.p);
      gl.uniform2i(prog.u.uRes, this.simW, this.simH);
      this._bindTex(prog, 'uState', this.state[this.cur], 0);
      this._bindTex(prog, 'uPal', this.palTex, 1);
      gl.uniform3f(prog.u.uPalette, p.palette[0], p.palette[1], p.t);
      gl.uniform1f(prog.u.uPalRows, PALETTES.length);
      gl.uniform1f(prog.u.uEmboss, p.emboss);
      gl.uniform1f(prog.u.uInvert, p.invert);
      gl.uniform3f(prog.u.uColor0, p.hue, p.saturation, p.brightness);
      gl.uniform3f(prog.u.uColor1, p.contrast, p.colorFreq, p.colorPhase);
      gl.uniform2f(prog.u.uOut, this.canvas.width, this.canvas.height);
      this._draw(prog, null, this.canvas.width, this.canvas.height);
    }

    /** True when the pattern has died out into a uniform field. */
    isDead() {
      const gl = this.gl, prog = this.progs.probe;
      gl.useProgram(prog.p);
      gl.uniform2i(prog.u.uRes, this.simW, this.simH);
      gl.uniform2i(prog.u.uProbeRes, this.probeRes[0], this.probeRes[1]);
      this._bindTex(prog, 'uState', this.state[this.cur], 0);
      this._draw(prog, this.probeFbo, this.probeRes[0], this.probeRes[1]);
      gl.readPixels(0, 0, this.probeRes[0], this.probeRes[1], gl.RGBA, gl.UNSIGNED_BYTE, this.probeBuf);
      let lo = 255, hi = 0;
      for (let i = 0; i < this.probeBuf.length; i += 4) {
        hi = Math.max(hi, this.probeBuf[i]);
        lo = Math.min(lo, this.probeBuf[i + 1]);
      }
      return hi - lo < 6;
    }
  }

  RDEngine.DEFAULTS = DEFAULTS;
  RDEngine.ENUM_KEYS = ENUM_KEYS;
  RDEngine.KF_MAPS = KF_MAPS;
  RDEngine.PALETTES = PALETTES;
  RDEngine.mulberry32 = mulberry32;
  window.RDEngine = RDEngine;
})();
