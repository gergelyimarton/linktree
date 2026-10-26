/**
 * RD STUDIO
 * UI for the reaction-diffusion engine: settings, presets (built-in + saved
 * in localStorage), a looping transition playlist and frame-exact MP4
 * rendering with WebCodecs. Everything runs client side.
 */

(function() {
  'use strict';

  const DEFAULTS = RDEngine.DEFAULTS;
  const PALETTES = RDEngine.PALETTES;
  const MAX_RENDER_SEC = 3600;
  // Phones can't hold a big file in memory (and have no save picker)
  const MEMORY_LIMIT_BYTES = matchMedia('(pointer: coarse)').matches ? 4e8 : 1.8e9;
  const STORE = {
    presets: 'rd-studio:presets',
    playlist: 'rd-studio:playlist',
    current: 'rd-studio:current',
    render: 'rd-studio:render'
  };

  const BUILTIN = [
    { hu: 'Ujjlenyomat', en: 'Fingerprint', p: { k1: -0.4, f1: -0.1, orientRadial: -0.6, flowRotate: 0.15, palette: 0 } },
    { hu: 'Korall', en: 'Coral', p: { k1: -0.4, f1: 0.25, scaleRandom: 0.6, palette: 2 } },
    { hu: 'Sejtek', en: 'Cells', p: { k1: 0.6, f1: -0.2, scale: 0.3, palette: 3 } },
    { hu: 'Galaxis', en: 'Galaxy', p: { k1: 0.1, f1: -0.2, flowSwirl: 0.6, palette: 4 } },
    { hu: 'Gleccser', en: 'Glacier', p: { k1: -0.6, f1: -0.75, flowWave: 0.4, palette: 6 } },
    { hu: 'Alkony', en: 'Dusk', p: { kfMap: 1, k1: 0.6, f1: -0.6, k2: -0.4, f2: 0.25, palette: 7 } },
    { hu: 'Buborékok', en: 'Bubbles', p: { k1: -0.05, f1: 0.15, palette: 11 } },
    { hu: 'Örvények', en: 'Vortices', p: { k1: -0.4, f1: -0.2, flowVortex: 0.7, palette: 8 } },
    { hu: 'Zebra', en: 'Zebra', p: { k1: 0.1, f1: -0.2, orientVert: 0.45, palette: 10, emboss: 0.5 } },
    { hu: 'Évgyűrűk', en: 'Tree rings', p: { kfMap: 3, k1: 0.1, f1: -0.2, k2: 0.6, f2: -0.65, scaleRing: 0.5, palette: 9 } },
    { hu: 'Szkenner', en: 'Scanner', p: { k1: -0.4, f1: -0.2, orientRandom: 0.7, flowRotate: 0.2, palette: 1 } },
    { hu: 'Moha', en: 'Moss', p: { kfMap: 2, k1: -0.4, f1: 0.25, k2: 0.6, f2: -0.65, palette: 5 } }
  ].map(b => ({ hu: b.hu, en: b.en, params: Object.assign({}, DEFAULTS, b.p) }));

  const SLIDERS = {
    'group-pattern': [
      ['speed', 'Sebesség', 'Speed']
    ],
    'group-color': [
      ['emboss', 'Dombornyomás', 'Emboss', 0, 1],
      ['hue', 'Árnyalat', 'Hue'],
      ['saturation', 'Telítettség', 'Saturation'],
      ['brightness', 'Fényerő', 'Brightness'],
      ['contrast', 'Kontraszt', 'Contrast'],
      ['colorFreq', 'Színsűrűség', 'Color frequency'],
      ['colorPhase', 'Színfázis', 'Color phase']
    ],
    'group-scale': [
      ['scale', 'Méret', 'Size'],
      ['scaleRadial', 'Sugaras', 'Radial'],
      ['scaleRandom', 'Véletlen', 'Random'],
      ['scaleRing', 'Gyűrűs', 'Rings']
    ],
    'group-flow': [
      ['flowRadial', 'Sugaras', 'Radial'],
      ['flowRotate', 'Forgás', 'Rotate'],
      ['flowSwirl', 'Örvény', 'Swirl'],
      ['flowVortex', 'Örvényrács', 'Vortex grid'],
      ['flowWave', 'Hullám', 'Wave'],
      ['flowVert', 'Függőleges', 'Vertical']
    ],
    'group-orient': [
      ['orientRadial', 'Sugár ↔ kör', 'Radial ↔ circle'],
      ['orientSwirl', 'Spirál', 'Spiral'],
      ['orientVert', 'Függ. ↔ vízsz.', 'Vert. ↔ horiz.'],
      ['orientRandom', 'Véletlen', 'Random']
    ]
  };

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  const $ = id => document.getElementById(id);
  const lang = () => document.documentElement.getAttribute('data-lang') || 'hu';
  const tr = (hu, en) => (lang() === 'en' ? en : hu);
  const clone = o => JSON.parse(JSON.stringify(o));
  const ease = u => u * u * u * (u * (u * 6 - 15) + 10);
  const clamp = (x, a, b) => Math.min(Math.max(x, a), b);

  function bilingual(el, hu, en) {
    el.dataset.hu = hu;
    el.dataset.en = en;
    el.textContent = tr(hu, en);
    return el;
  }

  function load(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable (private mode) — the page still works
    }
  }

  function sanitizeParams(obj) {
    const p = {};
    for (const key in DEFAULTS) {
      let v = Number(obj && obj[key]);
      if (!Number.isFinite(v)) v = DEFAULTS[key];
      if (key === 'palette') v = clamp(Math.round(v), 0, PALETTES.length - 1);
      else if (key === 'kfMap') v = clamp(Math.round(v), 0, RDEngine.KF_MAPS.length - 1);
      else if (key === 'emboss' || key === 'invert') v = clamp(v, 0, 1);
      else v = clamp(v, -1, 1);
      p[key] = Math.round(v * 1000) / 1000;
    }
    return p;
  }

  function sanitizeStep(s) {
    return {
      name: String(s && s.name || 'Preset').slice(0, 40),
      params: sanitizeParams(s && s.params),
      hold: clamp(Number(s && s.hold) || 0, 0, 3600),
      trans: clamp(Number(s && s.trans) || 0, 0, 3600)
    };
  }

  function padToKF(x, y) {
    const f = 0.01 + 0.06 * (y * 0.5 + 0.5);
    const kc = Math.sqrt(f) * 0.5 - f;
    return [kc - 0.004 + 0.012 * (x * 0.5 + 0.5), f];
  }

  function fmtTime(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function fmtBytes(b) {
    return b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.max(1, Math.round(b / 1e6)) + ' MB';
  }

  // Yield to the event loop without timer throttling in background tabs
  const channel = new MessageChannel();
  const waiting = [];
  channel.port1.onmessage = () => waiting.shift()?.();
  const yieldNow = () => new Promise(r => { waiting.push(r); channel.port2.postMessage(0); });

  // ---------------------------------------------------------------------
  // Timeline
  // ---------------------------------------------------------------------

  function cycleLength(steps) {
    return steps.reduce((s, st) => s + st.hold + st.trans, 0);
  }

  /** Which settings are visible at time t: blend a -> b by u. */
  function stateAt(steps, fallback, t) {
    const n = steps.length;
    const cycle = cycleLength(steps);
    if (n === 0) return { a: fallback, b: fallback, u: 0, i: -1 };
    if (n === 1 || cycle <= 0) return { a: steps[0].params, b: steps[0].params, u: 0, i: 0 };
    let tau = t % cycle;
    for (let i = 0; i < n; i++) {
      const st = steps[i];
      if (tau < st.hold) return { a: st.params, b: st.params, u: 0, i };
      tau -= st.hold;
      if (tau < st.trans) return { a: st.params, b: steps[(i + 1) % n].params, u: ease(tau / st.trans), i, next: (i + 1) % n };
      tau -= st.trans;
    }
    return { a: steps[0].params, b: steps[0].params, u: 0, i: 0 };
  }

  // A "source" tells what is on screen at time t: { a, b, u, i, nameA, nameB }.
  // Live playback and rendering both read from one.

  function listSource(getSteps, fallback) {
    return {
      kind: 'list',
      at(t) {
        const steps = getSteps();
        const st = stateAt(steps, fallback, t);
        st.nameA = steps[st.i] && steps[st.i].name;
        st.nameB = st.next !== undefined ? steps[st.next].name : undefined;
        return st;
      }
    };
  }

  function staticSource(params) {
    return { kind: 'current', at: () => ({ a: params, b: params, u: 0, i: -1 }) };
  }

  // In True Random the palette changes freely; color and light adjustments
  // only drift within these small bounds
  const RANDOM_COLOR = { hue: 0.12, saturation: 0.15, brightness: 0.1, contrast: 0.15, colorFreq: 0.12, colorPhase: 0.08 };

  /** Endless, seeded random timeline: random settings at random intervals. */
  function randomSource(seed, base, startName) {
    const rng = RDEngine.mulberry32(seed);
    const r = (a, b) => a + (b - a) * rng();
    const maybe = (p, a, b) => (rng() < p ? r(a, b) : 0);
    let palette = base.palette;

    // A different palette at every change
    function nextPalette() {
      const pick = Math.floor(rng() * (PALETTES.length - 1));
      palette = pick >= palette ? pick + 1 : pick;
      return palette;
    }

    function make() {
      const p = {
        k1: r(-0.5, 0.6), f1: r(-0.75, 0.3),
        k2: r(-0.5, 0.6), f2: r(-0.75, 0.3),
        scale: r(-0.5, 0.6),
        scaleRadial: maybe(0.3, -0.6, 0.6), scaleRandom: maybe(0.3, -0.6, 0.6), scaleRing: maybe(0.2, -0.5, 0.5),
        flowRadial: maybe(0.25, -0.5, 0.5), flowRotate: maybe(0.35, -0.6, 0.6), flowSwirl: maybe(0.3, -0.7, 0.7),
        flowVortex: maybe(0.25, -0.7, 0.7), flowWave: maybe(0.25, -0.5, 0.5), flowVert: maybe(0.15, -0.4, 0.4),
        orientRadial: maybe(0.3, -0.7, 0.7), orientSwirl: maybe(0.25, -0.7, 0.7), orientVert: maybe(0.2, -0.5, 0.5),
        orientRandom: maybe(0.3, 0, 0.8),
        emboss: r(0.6, 1),
        speed: r(-0.15, 0.35)
      };
      for (const key in RANDOM_COLOR) p[key] = r(-RANDOM_COLOR[key], RANDOM_COLOR[key]);
      for (const key in p) p[key] = Math.round(p[key] * 1000) / 1000;
      p.kfMap = rng() < 0.5 ? 0 : 1 + Math.floor(rng() * 5);
      p.invert = 0;
      p.palette = nextPalette();
      return Object.assign({}, DEFAULTS, p);
    }

    const steps = [{ name: startName || tr('Kezdés', 'Start'), params: clone(base), start: 0, hold: r(3, 8), trans: r(10, 20) }];
    function extend() {
      const prev = steps[steps.length - 1];
      const params = make();
      steps.push({ name: `Random #${steps.length}`, params, start: prev.start + prev.hold + prev.trans, hold: r(4, 20), trans: r(8, 22) });
    }

    let k = 0;
    return {
      kind: 'random',
      seed,
      base,
      at(t) {
        while (steps[steps.length - 1].start <= t) extend();
        if (t < steps[k].start) k = 0;
        while (steps[k + 1].start <= t) k++;
        const A = steps[k], B = steps[k + 1], tau = t - A.start;
        const u = tau < A.hold ? 0 : ease(Math.min((tau - A.hold) / A.trans, 1));
        return { a: A.params, b: B.params, u, i: k, nameA: A.name, nameB: B.name };
      }
    };
  }

  const newSeed = () => 1 + Math.floor(Math.random() * 999999);

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------

  const canvas = $('rd-canvas');
  const stage = $('stage');
  let engine;
  try {
    engine = new RDEngine(canvas);
  } catch (err) {
    $('status').textContent = tr('A böngésződ nem támogatja a WebGL2-t.', 'Your browser does not support WebGL2.');
    console.error(err);
    return;
  }

  const current = load(STORE.current, {});
  const S = {
    params: sanitizeParams(current.params || BUILTIN[0].params),
    name: current.name || tr(BUILTIN[0].hu, BUILTIN[0].en),
    aspect: ['16:9', '9:16', '1:1'].includes(current.aspect) ? current.aspect : '16:9',
    morph: null,
    mode: 'edit',          // edit | play | render
    play: null,            // source while playing (list or random)
    paused: false,
    playT: 0,
    playIndex: -1,
    iterAcc: 0,
    presets: (load(STORE.presets, []) || []).filter(p => p && p.name).map(p => ({ name: String(p.name).slice(0, 40), params: sanitizeParams(p.params) })),
    playlist: (load(STORE.playlist, null) || [0, 3, 7, 1].map(i => ({ name: tr(BUILTIN[i].hu, BUILTIN[i].en), params: BUILTIN[i].params, hold: 30, trans: 15 }))).map(sanitizeStep),
    syncing: false,
    render: null
  };

  // A shared link overrides the stored settings
  if (location.hash.startsWith('#rd=')) {
    try {
      const json = atob(location.hash.slice(4).replace(/-/g, '+').replace(/_/g, '/'));
      S.params = sanitizeParams(Object.assign({}, DEFAULTS, JSON.parse(json)));
      S.name = tr('Megosztott', 'Shared');
    } catch {
      // ignore malformed links
    }
  }

  let saveTimer = 0;
  function saveCurrent() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(STORE.current, { params: S.params, name: S.name, aspect: S.aspect }), 300);
  }

  // ---------------------------------------------------------------------
  // Settings UI
  // ---------------------------------------------------------------------

  const controls = {};

  function setSelect(sel, value) {
    S.syncing = true;
    sel.value = String(value);
    sel.dispatchEvent(new Event('change'));
    S.syncing = false;
  }

  function buildSliders() {
    for (const groupId in SLIDERS) {
      const box = $(groupId);
      for (const [key, hu, en, min = -1, max = 1] of SLIDERS[groupId]) {
        const row = document.createElement('label');
        row.className = 'rd-slider';
        const name = bilingual(document.createElement('span'), hu, en);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.step = '0.01';
        const out = document.createElement('output');
        input.addEventListener('input', () => setParam(key, +input.value));
        input.addEventListener('dblclick', () => setParam(key, DEFAULTS[key]));
        row.append(name, input, out);
        box.append(row);
        controls[key] = v => {
          input.value = v;
          out.textContent = (+v).toFixed(2);
        };
      }
    }

    const invert = document.createElement('label');
    invert.className = 'rd-check';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.addEventListener('change', () => setParam('invert', box.checked ? 1 : 0));
    invert.append(box, bilingual(document.createElement('span'), 'Invertálás', 'Invert'));
    $('group-color').prepend(invert);
    controls.invert = v => { box.checked = v >= 0.5; };

    const pal = $('palettes');
    PALETTES.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rd-swatch';
      b.title = p.name;
      b.setAttribute('aria-label', p.name);
      b.style.background = `linear-gradient(90deg, ${p.stops.join(', ')})`;
      b.addEventListener('click', () => setParam('palette', i));
      pal.append(b);
    });
    controls.palette = v => pal.querySelectorAll('.rd-swatch').forEach((b, i) => b.classList.toggle('is-on', i === v));

    $('kfmap').addEventListener('change', e => {
      if (!S.syncing) setParam('kfMap', +e.target.value);
    });
    controls.kfMap = v => {
      if ($('kfmap').value !== String(v)) setSelect($('kfmap'), v);
      $('pad-h2').hidden = v === 0;
    };
  }

  function updatePad() {
    const p = S.params;
    const place = (el, x, y) => {
      el.style.left = (x * 0.5 + 0.5) * 100 + '%';
      el.style.top = (0.5 - y * 0.5) * 100 + '%';
    };
    place($('pad-h1'), p.k1, p.f1);
    place($('pad-h2'), p.k2, p.f2);
    const kf1 = padToKF(p.k1, p.f1), kf2 = padToKF(p.k2, p.f2);
    let txt = `k=${kf1[0].toFixed(4)}  f=${kf1[1].toFixed(4)}`;
    if (p.kfMap) txt += `\n2: k=${kf2[0].toFixed(4)}  f=${kf2[1].toFixed(4)}`;
    $('kf-readout').textContent = txt;
    $('kf-readout').style.whiteSpace = 'pre';
  }

  function initPad() {
    const pad = $('pad');
    let which = 1;
    const pos = e => {
      const r = pad.getBoundingClientRect();
      return [clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1), clamp(1 - (e.clientY - r.top) / r.height * 2, -1, 1)];
    };
    const move = e => {
      const [x, y] = pos(e);
      const r3 = v => Math.round(v * 1000) / 1000;
      if (which === 1) setParams({ k1: r3(x), f1: r3(y) });
      else setParams({ k2: r3(x), f2: r3(y) });
    };
    pad.addEventListener('pointerdown', e => {
      const [x, y] = pos(e);
      const p = S.params;
      which = p.kfMap && Math.hypot(x - p.k2, y - p.f2) < Math.hypot(x - p.k1, y - p.f1) ? 2 : 1;
      pad.setPointerCapture(e.pointerId);
      move(e);
    });
    pad.addEventListener('pointermove', e => {
      if (pad.hasPointerCapture(e.pointerId)) move(e);
    });
  }

  function syncUI() {
    for (const key in controls) controls[key](S.params[key]);
    updatePad();
  }

  /** Any manual edit leaves playback and finishes a running preset morph. */
  function beginEdit() {
    if (S.mode === 'play') stopPlay(true);
    S.morph = null;
  }

  function setParams(obj) {
    if (S.mode === 'render') return;
    beginEdit();
    Object.assign(S.params, obj);
    S.name = null;
    for (const key in obj) controls[key] && controls[key](S.params[key]);
    updatePad();
    saveCurrent();
  }

  function setParam(key, value) {
    setParams({ [key]: value });
  }

  /** Morph from the current settings to new ones over ~1.5 s. */
  function morphTo(params, name) {
    if (S.mode === 'render') return;
    beginEdit();
    S.morph = { from: clone(S.params), to: clone(params), start: performance.now(), dur: 1500 };
    S.params = clone(params);
    S.name = name;
    syncUI();
    saveCurrent();
  }

  // ---------------------------------------------------------------------
  // Presets
  // ---------------------------------------------------------------------

  function chip(label, onLoad, onAdd, onDelete, user) {
    const c = document.createElement('span');
    c.className = 'rd-chip' + (user ? ' rd-chip--user' : '');
    const name = document.createElement('button');
    name.type = 'button';
    if (typeof label === 'string') name.textContent = label;
    else bilingual(name, label.hu, label.en);
    name.addEventListener('click', onLoad);
    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = '+';
    add.title = tr('Hozzáadás a listához', 'Add to playlist');
    add.addEventListener('click', onAdd);
    c.append(name, add);
    if (onDelete) {
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '×';
      del.title = tr('Törlés', 'Delete');
      del.addEventListener('click', onDelete);
      c.append(del);
    }
    return c;
  }

  function renderPresets() {
    const builtin = $('chips-builtin');
    builtin.replaceChildren(...BUILTIN.map(b => chip(b, () => morphTo(b.params, tr(b.hu, b.en)), () => addStep(tr(b.hu, b.en), b.params))));
    const user = $('chips-user');
    if (!S.presets.length) {
      user.replaceChildren(bilingual(document.createElement('span'), 'Még nincs mentett preseted.', 'No saved presets yet.'));
      user.firstChild.className = 'rd-muted';
      return;
    }
    user.replaceChildren(...S.presets.map((p, i) => chip(p.name,
      () => morphTo(p.params, p.name),
      () => addStep(p.name, p.params),
      () => {
        S.presets.splice(i, 1);
        save(STORE.presets, S.presets);
        renderPresets();
      }, true)));
  }

  function savePreset() {
    const input = $('preset-name');
    const name = input.value.trim().slice(0, 40) || S.name || tr('Saját', 'Custom') + ' ' + (S.presets.length + 1);
    const existing = S.presets.find(p => p.name === name);
    if (existing) existing.params = clone(S.params);
    else S.presets.push({ name, params: clone(S.params) });
    S.name = name;
    input.value = '';
    save(STORE.presets, S.presets);
    saveCurrent();
    renderPresets();
  }

  function exportJSON() {
    const data = { app: 'rd-studio', version: 1, presets: S.presets, playlist: S.playlist, current: S.params };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'rd-studio.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importJSON(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.app !== 'rd-studio') throw new Error('format');
      for (const p of data.presets || []) {
        const name = String(p.name || '').slice(0, 40);
        if (!name) continue;
        const existing = S.presets.find(x => x.name === name);
        if (existing) existing.params = sanitizeParams(p.params);
        else S.presets.push({ name, params: sanitizeParams(p.params) });
      }
      if (Array.isArray(data.playlist) && data.playlist.length) {
        if (S.mode === 'play') stopPlay(false);
        S.playlist = data.playlist.slice(0, 200).map(sanitizeStep);
      }
      save(STORE.presets, S.presets);
      savePlaylist();
      renderPresets();
      renderSteps();
    } catch {
      showInfo(tr('Ez nem egy RD Stúdió export fájl.', 'This is not an RD Studio export file.'), true);
    }
  }

  async function copyLink() {
    const compact = {};
    for (const key in DEFAULTS) if (S.params[key] !== DEFAULTS[key]) compact[key] = S.params[key];
    const code = btoa(JSON.stringify(compact)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const url = location.href.split('#')[0] + '#rd=' + code;
    history.replaceState(null, '', url);
    const btn = $('btn-share');
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = tr('Kimásolva ✓', 'Copied ✓');
    } catch {
      btn.textContent = tr('Link a címsorban', 'Link in address bar');
    }
    setTimeout(() => { btn.textContent = tr(btn.dataset.hu, btn.dataset.en); }, 1800);
  }

  // ---------------------------------------------------------------------
  // Playlist
  // ---------------------------------------------------------------------

  function savePlaylist() {
    save(STORE.playlist, S.playlist);
    updateCycleInfo();
    updateRenderInfo();
  }

  function addStep(name, params) {
    S.playlist.push({ name, params: clone(params), hold: 30, trans: 15 });
    savePlaylist();
    renderSteps();
  }

  function numField(value, onChange, hu, en) {
    const wrap = document.createElement('span');
    wrap.className = 'rd-step__time';
    const label = bilingual(document.createElement('span'), hu, en);
    const input = document.createElement('input');
    input.className = 'rd-input rd-input--num';
    input.type = 'number';
    input.min = '0';
    input.max = '3600';
    input.step = '1';
    input.value = value;
    input.addEventListener('change', () => {
      const v = clamp(Math.round(Number(input.value) || 0), 0, 3600);
      input.value = v;
      onChange(v);
    });
    wrap.append(label, input);
    return wrap;
  }

  function iconBtn(op, text, title, disabled) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rd-icon-btn';
    b.dataset.op = op;
    b.textContent = text;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.disabled = !!disabled;
    return b;
  }

  /** Briefly highlights a row so reorders and overwrites are visible. */
  function flashStep(i) {
    const li = $('steps').children[i];
    if (!li) return;
    li.classList.remove('is-flash');
    void li.offsetWidth;
    li.classList.add('is-flash');
  }

  /** Playback only moves the highlight — rebuilding rows would swallow clicks. */
  function markActiveStep() {
    const listPlaying = S.mode === 'play' && S.play.kind === 'list';
    [...$('steps').children].forEach((li, i) => li.classList.toggle('is-active', listPlaying && S.playIndex === i));
  }

  function renderSteps() {
    const list = $('steps');
    if (!S.playlist.length) {
      const empty = bilingual(document.createElement('li'), 'A lista üres — adj hozzá presetet a + jellel.', 'The list is empty — add presets with +.');
      empty.className = 'rd-muted';
      list.replaceChildren(empty);
      updateCycleInfo();
      return;
    }
    const last = S.playlist.length - 1;
    list.replaceChildren(...S.playlist.map((st, i) => {
      const li = document.createElement('li');
      li.className = 'rd-step';
      li.dataset.i = i;
      const n = document.createElement('span');
      n.className = 'rd-step__n';
      n.textContent = i + 1;
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'rd-step__name';
      name.dataset.op = 'load';
      name.textContent = st.name;
      name.title = tr('Betöltés szerkesztésre', 'Load for editing');
      const hold = numField(st.hold, v => { st.hold = v; savePlaylist(); }, 'tart', 'hold');
      const trans = numField(st.trans, v => { st.trans = v; savePlaylist(); }, 'átm', 'fade');
      const ops = document.createElement('span');
      ops.className = 'rd-step__ops';
      ops.append(
        iconBtn('overwrite', '⟳', tr('Lépés felülírása a jelenlegi beállítással', 'Overwrite step with the current settings')),
        iconBtn('up', '↑', tr('Feljebb', 'Move up'), i === 0),
        iconBtn('down', '↓', tr('Lejjebb', 'Move down'), i === last),
        iconBtn('remove', '×', tr('Eltávolítás', 'Remove'))
      );
      li.append(n, name, hold, trans, ops);
      return li;
    }));
    markActiveStep();
    updateCycleInfo();
  }

  // One delegated handler, so it survives any re-render of the rows
  function onStepClick(e) {
    const btn = e.target.closest('button[data-op]');
    const li = btn && btn.closest('.rd-step');
    if (!li || btn.disabled) return;
    const i = Number(li.dataset.i);
    const st = S.playlist[i];
    if (!st) return;
    switch (btn.dataset.op) {
      case 'load':
        morphTo(st.params, st.name);
        return;
      case 'overwrite':
        st.params = clone(S.params);
        if (S.name) st.name = S.name;
        savePlaylist();
        renderSteps();
        flashStep(i);
        return;
      case 'up':
      case 'down': {
        const j = i + (btn.dataset.op === 'up' ? -1 : 1);
        if (j < 0 || j >= S.playlist.length) return;
        [S.playlist[i], S.playlist[j]] = [S.playlist[j], S.playlist[i]];
        savePlaylist();
        renderSteps();
        flashStep(j);
        $('steps').children[j].querySelector(`[data-op="${btn.dataset.op}"]:not(:disabled)`)?.focus();
        return;
      }
      case 'remove':
        S.playlist.splice(i, 1);
        if (S.mode === 'play' && S.play.kind === 'list' && S.playlist.length < 2) stopPlay(false);
        savePlaylist();
        renderSteps();
        return;
    }
  }

  function updateCycleInfo() {
    const cycle = cycleLength(S.playlist);
    const el = $('cycle-info');
    if (S.playlist.length < 2) {
      el.textContent = tr('Átmenethez legalább 2 lépés kell.', 'Transitions need at least 2 steps.');
      return;
    }
    el.textContent = tr(`Egy kör: ${fmtTime(cycle)} · ${S.playlist.length} lépés`, `One loop: ${fmtTime(cycle)} · ${S.playlist.length} steps`);
  }

  function playButtons() {
    const list = S.mode === 'play' && S.play.kind === 'list';
    const random = S.mode === 'play' && S.play.kind === 'random';
    $('btn-play').classList.toggle('is-on', list);
    bilingual($('btn-play'), list ? 'Leállítás' : 'Lejátszás', list ? 'Stop' : 'Play');
    $('btn-random').classList.toggle('is-on', random);
    $('btn-random').setAttribute('aria-pressed', String(random));
  }

  function startPlay() {
    if (S.playlist.length < 2 || cycleLength(S.playlist) <= 0) {
      updateCycleInfo();
      return;
    }
    if (S.mode === 'play') stopPlay(false);
    S.morph = null;
    S.play = listSource(() => S.playlist, S.params);
    S.mode = 'play';
    S.playT = 0;
    S.playIndex = -1;
    engine.reset();
    playButtons();
    setSelect($('render-source'), 'list');
    updateRenderInfo();
  }

  /** Endless random morphing, continuing from what is on screen. */
  function startRandom() {
    if (S.mode === 'play') stopPlay(true);
    S.morph = null;
    S.play = randomSource(newSeed(), clone(S.params), S.name);
    S.mode = 'play';
    S.playT = 0;
    S.playIndex = -1;
    playButtons();
    setSelect($('render-source'), 'random');
    updateRenderInfo();
  }

  /** Leaves playback; keepVisual adopts the settings on screen for editing. */
  function stopPlay(keepVisual) {
    if (keepVisual && S.play) {
      const st = S.play.at(S.playT);
      const first = st.u < 0.5;
      S.params = clone(first ? st.a : st.b);
      S.name = (first ? st.nameA : st.nameB) || null;
      syncUI();
      saveCurrent();
    }
    S.mode = 'edit';
    S.play = null;
    S.playIndex = -1;
    playButtons();
    renderSteps();
    updateRenderInfo();
  }

  // ---------------------------------------------------------------------
  // Stage: preview loop, drawing, toolbar
  // ---------------------------------------------------------------------

  function aspectDims(a) {
    return a.split(':').map(Number);
  }

  function applyAspect() {
    const [aw, ah] = aspectDims(S.aspect);
    stage.style.setProperty('--ar', (aw / ah).toFixed(4));
    engine.setAspect(aw, ah);
    resizePreview();
    updateRenderInfo();
  }

  function resizePreview() {
    if (S.mode === 'render') return;
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = r.width * dpr, h = r.height * dpr;
    const s = Math.min(1, 2560 / Math.max(w, h, 1));
    engine.resizeOutput(Math.max(2, Math.round(w * s)), Math.max(2, Math.round(h * s)));
  }

  function setPaused(v) {
    S.paused = v;
    $('btn-pause').classList.toggle('is-on', v);
    bilingual($('btn-pause'), v ? 'Folytatás' : 'Szünet', v ? 'Resume' : 'Pause');
  }

  function initStage() {
    let drawing = false;
    const brush = e => {
      const r = canvas.getBoundingClientRect();
      const erase = e.altKey || (e.buttons & 2) === 2;
      engine.paint((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, 7, erase);
    };
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      if (S.mode === 'render') return;
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      brush(e);
    });
    canvas.addEventListener('pointermove', e => {
      if (drawing) brush(e);
    });
    const end = () => { drawing = false; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    $('btn-pause').addEventListener('click', () => setPaused(!S.paused));
    $('btn-regrow').addEventListener('click', () => {
      if (S.mode !== 'render') engine.reset();
    });
    $('btn-clear').addEventListener('click', () => {
      if (S.mode !== 'render') engine.clear();
    });
    const nativeFs = () => document.fullscreenElement || document.webkitFullscreenElement;
    const syncExit = () => {
      $('btn-exit-fs').hidden = !(nativeFs() || stage.classList.contains('is-pseudo-fs'));
    };
    const pseudoFs = on => {
      stage.classList.toggle('is-pseudo-fs', on);
      document.body.style.overflow = on ? 'hidden' : '';
      syncExit();
    };
    const exitFs = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
      pseudoFs(false);
    };
    $('btn-fullscreen').addEventListener('click', () => {
      if (nativeFs()) exitFs();
      else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => pseudoFs(true));
      else if (stage.webkitRequestFullscreen) stage.webkitRequestFullscreen();
      else pseudoFs(true);
    });
    $('btn-exit-fs').addEventListener('click', exitFs);
    document.addEventListener('fullscreenchange', syncExit);
    document.addEventListener('webkitfullscreenchange', syncExit);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && stage.classList.contains('is-pseudo-fs')) pseudoFs(false);
    });
    $('aspect').addEventListener('change', e => {
      if (S.syncing || S.mode === 'render') return;
      S.aspect = e.target.value;
      applyAspect();
      saveCurrent();
    });
    document.addEventListener('keydown', e => {
      if (e.code !== 'Space' || e.target.closest('input, textarea, select, button, [role="listbox"]')) return;
      e.preventDefault();
      setPaused(!S.paused);
    });
    new ResizeObserver(resizePreview).observe(canvas);
  }

  let last = performance.now();
  let statusAt = 0, fpsFrames = 0, fpsShown = 0, deadAt = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (S.mode === 'render') return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    if (S.mode === 'play') {
      if (!S.paused) S.playT += dt;
      const st = S.play.at(S.playT);
      engine.setParams(st.a, st.b, st.u);
      const idx = S.play.kind === 'list' ? st.i : -1;
      if (idx !== S.playIndex) {
        S.playIndex = idx;
        markActiveStep();
      }
      if (now - deadAt > 2000) {
        deadAt = now;
        if (engine.isDead()) engine.addSeeds(16);
      }
    } else if (S.morph) {
      const u = (now - S.morph.start) / S.morph.dur;
      if (u >= 1) S.morph = null;
      if (S.morph) engine.setParams(S.morph.from, S.morph.to, ease(u));
      else engine.setParams(S.params);
    } else {
      engine.setParams(S.params);
    }

    if (!S.paused) {
      S.iterAcc += engine.itersPer60() * dt * 60;
      const n = Math.min(Math.floor(S.iterAcc), 64);
      S.iterAcc -= Math.floor(S.iterAcc);
      engine.step(n);
    }
    engine.render();

    fpsFrames++;
    if (now - statusAt > 500) {
      fpsShown = Math.round(fpsFrames * 1000 / (now - statusAt));
      fpsFrames = 0;
      statusAt = now;
      updateStatus();
    }
  }

  function updateStatus() {
    const el = $('status');
    if (S.mode === 'render') return;
    if (S.mode === 'play') {
      const st = S.play.at(S.playT);
      const label = S.play.kind === 'random' ? `True Random · seed ${S.play.seed}` : tr('Lejátszás', 'Playing');
      el.textContent = `${label} · ${fmtTime(S.playT)} · ${st.nameA || ''}${st.nameB && st.u > 0 ? ' → ' + st.nameB : ''}`;
      return;
    }
    el.textContent = S.paused ? tr('Szünet', 'Paused') : `${tr('Élő', 'Live')} · ${fpsShown} fps${S.name ? ' · ' + S.name : ''}`;
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------

  function renderSettings() {
    const min = clamp(Math.floor(Number($('dur-min').value) || 0), 0, 60);
    const sec = clamp(Math.floor(Number($('dur-sec').value) || 0), 0, 59);
    const duration = clamp(min * 60 + sec, 1, MAX_RENDER_SEC);
    const res = Number($('res').value);
    const fps = Number($('fps').value);
    const bpp = Number($('quality').value);
    const [aw, ah] = aspectDims(S.aspect);
    let w, h;
    if (aw === ah) { w = h = res; }
    else if (aw > ah) { h = res; w = Math.round(res * aw / ah / 2) * 2; }
    else { w = res; h = Math.round(res * ah / aw / 2) * 2; }
    const bitrate = Math.round(clamp(w * h * fps * bpp, 1e6, 80e6));
    const warmup = clamp(Math.floor(Number($('warmup').value) || 0), 0, 120);
    const source = $('render-source').value;
    return { duration, w, h, fps, bitrate, warmup, source, bytes: bitrate * duration / 8 };
  }

  function saveRenderSettings() {
    save(STORE.render, {
      min: $('dur-min').value, sec: $('dur-sec').value, res: $('res').value,
      fps: $('fps').value, quality: $('quality').value, warmup: $('warmup').value,
      source: $('render-source').value
    });
  }

  function showInfo(text, error) {
    const el = $('render-info');
    el.textContent = text;
    el.classList.toggle('is-error', !!error);
  }

  function supportsRender() {
    return 'VideoEncoder' in window && 'VideoFrame' in window && window.Mp4Muxer;
  }

  function updateRenderInfo() {
    if (S.render) return;
    if (!supportsRender()) {
      showInfo(tr('Ez a böngésző nem tud videót kódolni (WebCodecs hiányzik). Használj friss Chrome-ot, Edge-et vagy Safarit.',
        'This browser cannot encode video (WebCodecs missing). Use a recent Chrome, Edge or Safari.'), true);
      $('btn-render').disabled = true;
      return;
    }
    const r = renderSettings();
    const direct = 'showSaveFilePicker' in window;
    const steps = S.playlist.length;
    const liveRandom = S.mode === 'play' && S.play.kind === 'random';
    let content;
    if (r.source === 'random') {
      content = tr('Tartalom: True Random — véletlen beállítások véletlen időközönként', 'Content: True Random — random settings at random intervals')
        + (liveRandom ? ` (seed ${S.play.seed})` : '');
    } else if (r.source === 'list' && steps >= 2) {
      const loops = (r.duration / Math.max(1, cycleLength(S.playlist))).toFixed(1);
      content = tr(`Tartalom: ${steps} lépéses lista, ${loops} kör`, `Content: ${steps}-step playlist, ${loops} loops`);
    } else {
      content = tr('Tartalom: a jelenlegi beállítás', 'Content: the current settings')
        + (r.source === 'list' ? tr(' (a listában nincs 2 lépés)', ' (the list has fewer than 2 steps)') : '');
    }
    const lines = [
      `${tr('Kimenet', 'Output')}: ${r.w}×${r.h} · ${r.fps} fps · H.264 MP4 · ${fmtTime(r.duration)}`,
      `${tr('Becsült méret', 'Estimated size')}: ~${fmtBytes(r.bytes)} (${(r.bitrate / 1e6).toFixed(1)} Mbps)`,
      content,
      direct
        ? tr('Mentés: közvetlenül lemezre, bármekkora fájl mehet.', 'Saving: straight to disk, any size works.')
        : tr(`Mentés: memóriába, ezért max. ~${fmtBytes(MEMORY_LIMIT_BYTES)}. Hosszú videóhoz Chrome vagy Edge ajánlott.`,
          `Saving: in memory, so max. ~${fmtBytes(MEMORY_LIMIT_BYTES)}. Use Chrome or Edge for long videos.`)
    ];
    const tooBig = !direct && r.bytes > MEMORY_LIMIT_BYTES;
    if (tooBig) lines.push(tr('Túl nagy ehhez a böngészőhöz — csökkentsd a hosszt vagy a minőséget.', 'Too large for this browser — reduce the length or quality.'));
    showInfo(lines.join('\n'), tooBig);
    $('btn-render').disabled = tooBig;
  }

  /** A random render replays the live True Random run (same seed) if one is going. */
  function renderSource(kind) {
    if (kind === 'random') {
      const live = S.mode === 'play' && S.play.kind === 'random' ? S.play : null;
      return randomSource(live ? live.seed : newSeed(), clone(live ? live.base : S.params), S.name);
    }
    if (kind === 'list' && S.playlist.length >= 2) {
      const steps = clone(S.playlist);
      return listSource(() => steps, clone(S.params));
    }
    return staticSource(clone(S.params));
  }

  async function pickCodec(w, h, fps, bitrate) {
    const codecs = ['avc1.640034', 'avc1.640033', 'avc1.640032', 'avc1.64002A', 'avc1.640028', 'avc1.4D4028', 'avc1.42E028'];
    for (const codec of codecs) {
      try {
        const r = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate, framerate: fps });
        if (r.supported) return codec;
      } catch {
        // try the next one
      }
    }
    return null;
  }

  function setRenderUI(running) {
    $('btn-render').disabled = running;
    $('btn-cancel').disabled = !running;
    ['aspect', 'res', 'fps', 'quality', 'render-source'].forEach(id => { $(id).disabled = running; });
    ['dur-min', 'dur-sec', 'warmup'].forEach(id => { $(id).disabled = running; });
  }

  async function startRender() {
    if (S.render || !supportsRender()) return;
    const r = renderSettings();
    saveRenderSettings();
    const codec = await pickCodec(r.w, r.h, r.fps, r.bitrate);
    if (!codec) {
      showInfo(tr(`A böngésző nem tud ${r.w}×${r.h} H.264 videót kódolni. Próbálj kisebb felbontást.`, `The browser cannot encode ${r.w}×${r.h} H.264. Try a lower resolution.`), true);
      return;
    }

    const seedTag = r.source === 'random' ? '-random' : '';
    const fileName = `reaction-diffusion${seedTag}-${r.w}x${r.h}-${r.fps}fps-${fmtTime(r.duration).replace(/:/g, '-')}.mp4`;
    let fileStream = null;
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'MP4', accept: { 'video/mp4': ['.mp4'] } }] });
        fileStream = await handle.createWritable();
      } catch {
        return; // picker dismissed
      }
    }

    // Snapshot what to render, so edits during rendering don't leak in
    const src = renderSource(r.source);
    if (S.mode === 'play') stopPlay(false);
    S.morph = null;

    const job = { cancel: false, error: null };
    S.render = job;
    S.mode = 'render';
    setRenderUI(true);
    let wakeLock = null;
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* optional */ }
    const onUnload = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onUnload);

    let encoder = null;
    const waitForEncoder = async () => {
      while (encoder.encodeQueueSize > 4 && !job.error) {
        if ('ondequeue' in encoder) await new Promise(res => encoder.addEventListener('dequeue', res, { once: true }));
        else await yieldNow();
      }
    };

    const total = Math.round(r.duration * r.fps);
    const rng = RDEngine.mulberry32(7);
    const t0 = performance.now();
    let lastUi = 0;
    const progress = (frac, text) => {
      $('progress').style.width = (frac * 100).toFixed(1) + '%';
      $('status').textContent = `Render · ${(frac * 100).toFixed(0)}%`;
      showInfo(text);
    };

    try {
      const target = fileStream ? new Mp4Muxer.FileSystemWritableFileStreamTarget(fileStream) : new Mp4Muxer.ArrayBufferTarget();
      const muxer = new Mp4Muxer.Muxer({
        target,
        video: { codec: 'avc', width: r.w, height: r.h, frameRate: r.fps },
        fastStart: fileStream ? false : 'in-memory',
        firstTimestampBehavior: 'offset'
      });
      encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: e => { job.error = e; }
      });
      encoder.configure({ codec, width: r.w, height: r.h, bitrate: r.bitrate, framerate: r.fps, latencyMode: 'quality', avc: { format: 'avc' } });

      engine.resizeOutput(r.w, r.h);
      engine.reset();
      let acc = 0;

      // Warm-up: let the first pattern grow before recording
      const start = src.at(0);
      engine.setParams(start.a, start.b, start.u);
      const warmIters = Math.round(engine.itersPer60() * 60 * r.warmup);
      for (let done = 0; done < warmIters && !job.cancel; done += 200) {
        engine.step(Math.min(200, warmIters - done));
        engine.render();
        progress(0, tr(`Előfutás… ${Math.round(done / Math.max(1, warmIters) * 100)}%`, `Warming up… ${Math.round(done / Math.max(1, warmIters) * 100)}%`));
        await yieldNow();
      }

      for (let i = 0; i < total && !job.cancel && !job.error; i++) {
        const st = src.at(i / r.fps);
        engine.setParams(st.a, st.b, st.u);
        acc += engine.itersPer60() * 60 / r.fps;
        const n = Math.floor(acc);
        acc -= n;
        engine.step(n);
        if (i % r.fps === 0 && engine.isDead()) engine.addSeeds(16, rng);
        engine.render();

        const vf = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / r.fps), duration: Math.round(1e6 / r.fps) });
        encoder.encode(vf, { keyFrame: i % (r.fps * 2) === 0 });
        vf.close();
        await waitForEncoder();
        await yieldNow();

        const now = performance.now();
        if (now - lastUi > 250 || i === total - 1) {
          lastUi = now;
          const el = (now - t0) / 1000;
          const speed = (i + 1) / el;
          const eta = (total - i - 1) / speed;
          progress((i + 1) / total, tr(
            `Renderelés: ${fmtTime((i + 1) / r.fps)} / ${fmtTime(r.duration)}\nSebesség: ${speed.toFixed(1)} képkocka/mp\nHátralévő idő: ~${fmtTime(eta)}\nA lap maradjon nyitva.`,
            `Rendering: ${fmtTime((i + 1) / r.fps)} / ${fmtTime(r.duration)}\nSpeed: ${speed.toFixed(1)} frames/s\nTime left: ~${fmtTime(eta)}\nKeep this tab open.`));
        }
      }

      if (job.error) throw job.error;
      if (job.cancel) {
        encoder.close();
        if (fileStream) await fileStream.abort();
        showInfo(tr('Megszakítva.', 'Cancelled.'));
      } else {
        await encoder.flush();
        encoder.close();
        muxer.finalize();
        if (fileStream) {
          await fileStream.close();
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([target.buffer], { type: 'video/mp4' }));
          a.download = fileName;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 60000);
        }
        const took = (performance.now() - t0) / 1000;
        showInfo(tr(`Kész: ${fileName}\nRenderidő: ${fmtTime(took)}`, `Done: ${fileName}\nRender time: ${fmtTime(took)}`));
      }
    } catch (err) {
      console.error(err);
      try { encoder?.close(); } catch { /* already closed */ }
      try { if (fileStream) await fileStream.abort(); } catch { /* ignore */ }
      showInfo(tr('Hiba a renderelés közben: ', 'Error while rendering: ') + (err && err.message || err), true);
    } finally {
      window.removeEventListener('beforeunload', onUnload);
      try { await wakeLock?.release(); } catch { /* ignore */ }
      S.render = null;
      S.mode = 'edit';
      setRenderUI(false);
      $('progress').style.width = '0';
      engine.reset();
      resizePreview();
      last = performance.now();
    }
  }

  function initRender() {
    const saved = load(STORE.render, null);
    if (saved) {
      $('dur-min').value = saved.min ?? 5;
      $('dur-sec').value = saved.sec ?? 0;
      $('warmup').value = saved.warmup ?? 0;
      ['res', 'fps', 'quality', 'render-source'].forEach(id => {
        if (saved[id] && [...$(id).options].some(o => o.value === String(saved[id]))) $(id).value = saved[id];
      });
    }
    ['dur-min', 'dur-sec', 'warmup', 'res', 'fps', 'quality', 'render-source'].forEach(id => $(id).addEventListener('change', () => {
      if (S.syncing) return;
      if (id === 'dur-min' || id === 'dur-sec') {
        const sec = clamp((Number($('dur-min').value) || 0) * 60 + (Number($('dur-sec').value) || 0), 1, MAX_RENDER_SEC);
        $('dur-min').value = Math.floor(sec / 60);
        $('dur-sec').value = sec % 60;
      }
      saveRenderSettings();
      updateRenderInfo();
    }));
    $('dur-quick').addEventListener('click', e => {
      const b = e.target.closest('[data-dur]');
      if (!b || S.render) return;
      let sec = b.dataset.dur === 'cycle' ? Math.round(cycleLength(S.playlist)) : Number(b.dataset.dur);
      sec = clamp(sec || 60, 1, MAX_RENDER_SEC);
      $('dur-min').value = Math.floor(sec / 60);
      $('dur-sec').value = sec % 60;
      saveRenderSettings();
      updateRenderInfo();
    });
    $('btn-render').addEventListener('click', startRender);
    $('btn-cancel').addEventListener('click', () => { if (S.render) S.render.cancel = true; });
  }

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------

  buildSliders();
  initPad();
  initStage();
  initRender();

  $('btn-defaults').addEventListener('click', () => morphTo(DEFAULTS, null));
  $('btn-share').addEventListener('click', copyLink);
  $('btn-save-preset').addEventListener('click', savePreset);
  $('preset-name').addEventListener('keydown', e => { if (e.key === 'Enter') savePreset(); });
  $('btn-export').addEventListener('click', exportJSON);
  $('btn-import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) importJSON(f);
    e.target.value = '';
  });
  $('btn-add-current').addEventListener('click', () => addStep(S.name || tr('Saját', 'Custom') + ' ' + (S.playlist.length + 1), S.params));
  $('btn-play').addEventListener('click', () => (S.mode === 'play' && S.play.kind === 'list' ? stopPlay(true) : startPlay()));
  $('btn-random').addEventListener('click', () => {
    if (S.mode === 'render') return;
    if (S.mode === 'play' && S.play.kind === 'random') stopPlay(true);
    else startRandom();
  });
  $('steps').addEventListener('click', onStepClick);

  window.addEventListener('languageChanged', () => {
    renderSteps();
    updateCycleInfo();
    updateRenderInfo();
    updateStatus();
  });

  setSelect($('aspect'), S.aspect);
  applyAspect();
  syncUI();
  renderPresets();
  renderSteps();
  updateRenderInfo();
  requestAnimationFrame(frame);
})();
