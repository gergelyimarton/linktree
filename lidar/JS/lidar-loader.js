/**
 * LIDAR LOADER
 * Point cloud materialization effect with WebGL
 *
 * Phases:
 * 1. VOID      — Scan line only, no points
 * 2. DETECT    — Random scattered points appear
 * 3. FORM      — Points morph toward target shape
 * 4. SOLID     — Full shape visible, subtle glow
 * 5. REVEAL    — Fade out, hand off to main content
 *
 * Fallback: CSS-only animation for non-WebGL devices
 *
 * Production status: 🟢 production-adjacent
 * Tradeoff priority: Performance > Visual fidelity
 */

(function() {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================

  const CONFIG = {
    // Point cloud
    pointCount: 3000,           // Balance: visual density vs performance
    pointSize: 2.5,             // Base size in pixels
    pointSizeVariance: 1.5,     // Random size variation

    // Animation timing (ms)
    minDisplayTime: 1560,       // Minimum loader visibility (+30%)
    phaseVoid: 200,
    phaseDetect: 400,
    phaseForm: 600,
    phaseSolid: 400,
    fadeOutDuration: 500,

    // Scan line
    scanSpeed: 0.00025,         // Viewport units per ms
    scanWidth: 0.15,            // Trail width
    scanBrightness: 1.5,        // Intensity multiplier

    // Shape (relative coordinates -1 to 1)
    // Default: Simple circle/ring — replace with logo geometry
    targetShape: 'circle',

    // Performance
    maxFPS: 60,
    reducedMotionFPS: 30,

    // Colors - these are overridden by getThemeColors()
    colorScan: [0, 1, 0.53],    // #00ff88 in RGB 0-1
    colorDim: [0, 0.3, 0.2],    // Dimmed scan color
    colorVoid: [0.012, 0.012, 0.02] // #030305
  };

  // Get theme-appropriate colors
  function getThemeColors() {
    const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';

    if (isLightTheme) {
      return {
        colorScan: [0.04, 0.04, 0.04],    // #0a0a0a - black
        colorDim: [0.3, 0.3, 0.3],         // gray
        colorVoid: [0.96, 0.96, 0.97]      // #f5f5f7 - light background
      };
    }

    return {
      colorScan: CONFIG.colorScan,
      colorDim: CONFIG.colorDim,
      colorVoid: CONFIG.colorVoid
    };
  }

  // ============================================================
  // STATE
  // ============================================================

  const state = {
    phase: 'void',
    startTime: 0,
    phaseStartTime: 0,
    resourceProgress: 0,
    morphProgress: 0,
    scanY: -0.5,
    scanDirection: 1,
    isComplete: false,
    useFallback: false
  };

  // ============================================================
  // WEBGL SETUP
  // ============================================================

  let gl = null;
  let program = null;
  let pointBuffer = null;
  let targetBuffer = null;
  let canvas = null;
  let animationId = null;

  // Shader sources
  const VERTEX_SHADER = `
    attribute vec3 a_position;
    attribute vec3 a_target;
    attribute float a_size;
    attribute float a_seed;

    uniform float u_morph;
    uniform float u_scanY;
    uniform float u_scanWidth;
    uniform float u_time;
    uniform float u_pointSize;
    uniform vec2 u_resolution;

    varying float v_intensity;
    varying float v_depth;

    void main() {
      // Morph from scattered to target position
      vec3 pos = mix(a_position, a_target, u_morph);

      // Subtle idle float when fully formed
      if (u_morph > 0.95) {
        float floatAmount = 0.008;
        pos.x += sin(u_time * 0.001 + a_seed * 6.28) * floatAmount;
        pos.y += cos(u_time * 0.0013 + a_seed * 6.28) * floatAmount;
      }

      // Uniform brightness - increases with morph progress
      v_intensity = mix(0.2, 0.6, u_morph);

      // Depth for potential color grading
      v_depth = pos.z;

      // Output
      gl_Position = vec4(pos.xy, 0.0, 1.0);
      gl_PointSize = u_pointSize * a_size * (0.8 + v_intensity * 0.4);
    }
  `;

  const FRAGMENT_SHADER = `
    precision mediump float;

    uniform vec3 u_colorScan;
    uniform vec3 u_colorDim;

    varying float v_intensity;
    varying float v_depth;

    void main() {
      // Circular point shape
      vec2 center = gl_PointCoord - 0.5;
      float dist = length(center);
      if (dist > 0.5) discard;

      // Soft edge
      float alpha = 1.0 - smoothstep(0.3, 0.5, dist);

      // Color based on intensity
      vec3 color = mix(u_colorDim, u_colorScan, v_intensity);

      gl_FragColor = vec4(color, alpha * v_intensity);
    }
  `;

  // ============================================================
  // GEOMETRY GENERATION
  // ============================================================

  // ============================================================
  // GEOMETRIC SHAPE GENERATORS
  // ============================================================

  function generateCirclePoints(count) {
    const points = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.28 + Math.random() * 0.02; // Ring shape
      points.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z: (Math.random() - 0.5) * 0.1
      });
    }
    return points;
  }

  function generateTrianglePoints(count) {
    const points = [];
    const size = 0.35;
    // Equilateral triangle vertices
    const vertices = [
      { x: 0, y: size },                           // Top
      { x: -size * 0.866, y: -size * 0.5 },        // Bottom left
      { x: size * 0.866, y: -size * 0.5 }          // Bottom right
    ];

    for (let i = 0; i < count; i++) {
      const edge = Math.floor(Math.random() * 3);
      const t = Math.random();
      const v1 = vertices[edge];
      const v2 = vertices[(edge + 1) % 3];
      points.push({
        x: v1.x + (v2.x - v1.x) * t + (Math.random() - 0.5) * 0.02,
        y: v1.y + (v2.y - v1.y) * t + (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.1
      });
    }
    return points;
  }

  function generateSquarePoints(count) {
    const points = [];
    const size = 0.28;

    for (let i = 0; i < count; i++) {
      const edge = Math.floor(Math.random() * 4);
      const t = Math.random() * 2 - 1; // -1 to 1
      let x, y;

      switch (edge) {
        case 0: x = t * size; y = size; break;    // Top
        case 1: x = t * size; y = -size; break;   // Bottom
        case 2: x = -size; y = t * size; break;   // Left
        case 3: x = size; y = t * size; break;    // Right
      }

      points.push({
        x: x + (Math.random() - 0.5) * 0.02,
        y: y + (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.1
      });
    }
    return points;
  }

  function generateHexagonPoints(count) {
    const points = [];
    const size = 0.3;

    // Hexagon vertices
    const vertices = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      vertices.push({
        x: Math.cos(angle) * size,
        y: Math.sin(angle) * size
      });
    }

    for (let i = 0; i < count; i++) {
      const edge = Math.floor(Math.random() * 6);
      const t = Math.random();
      const v1 = vertices[edge];
      const v2 = vertices[(edge + 1) % 6];
      points.push({
        x: v1.x + (v2.x - v1.x) * t + (Math.random() - 0.5) * 0.02,
        y: v1.y + (v2.y - v1.y) * t + (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.1
      });
    }
    return points;
  }

  function generateRhombusPoints(count) {
    const points = [];
    const width = 0.22;
    const height = 0.35;

    // Diamond/rhombus vertices
    const vertices = [
      { x: 0, y: height },      // Top
      { x: width, y: 0 },       // Right
      { x: 0, y: -height },     // Bottom
      { x: -width, y: 0 }       // Left
    ];

    for (let i = 0; i < count; i++) {
      const edge = Math.floor(Math.random() * 4);
      const t = Math.random();
      const v1 = vertices[edge];
      const v2 = vertices[(edge + 1) % 4];
      points.push({
        x: v1.x + (v2.x - v1.x) * t + (Math.random() - 0.5) * 0.02,
        y: v1.y + (v2.y - v1.y) * t + (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.1
      });
    }
    return points;
  }

  function generatePentagonPoints(count) {
    const points = [];
    const size = 0.3;

    // Pentagon vertices
    const vertices = [];
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
      vertices.push({
        x: Math.cos(angle) * size,
        y: Math.sin(angle) * size
      });
    }

    for (let i = 0; i < count; i++) {
      const edge = Math.floor(Math.random() * 5);
      const t = Math.random();
      const v1 = vertices[edge];
      const v2 = vertices[(edge + 1) % 5];
      points.push({
        x: v1.x + (v2.x - v1.x) * t + (Math.random() - 0.5) * 0.02,
        y: v1.y + (v2.y - v1.y) * t + (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.1
      });
    }
    return points;
  }

  function generateCrossPoints(count) {
    const points = [];
    const length = 0.35;
    const thickness = 0.08;

    for (let i = 0; i < count; i++) {
      const isVertical = Math.random() > 0.5;
      let x, y;

      if (isVertical) {
        x = (Math.random() - 0.5) * thickness;
        y = (Math.random() - 0.5) * length * 2;
      } else {
        x = (Math.random() - 0.5) * length * 2;
        y = (Math.random() - 0.5) * thickness;
      }

      // Add to edges for outline effect
      const edge = Math.random();
      if (edge > 0.7) {
        if (isVertical) {
          x = (Math.random() > 0.5 ? 1 : -1) * thickness / 2;
        } else {
          y = (Math.random() > 0.5 ? 1 : -1) * thickness / 2;
        }
      }

      points.push({
        x: x + (Math.random() - 0.5) * 0.015,
        y: y + (Math.random() - 0.5) * 0.015,
        z: (Math.random() - 0.5) * 0.1
      });
    }
    return points;
  }

  function generateRandomGeometricShape(count) {
    const shapes = [
      generateCirclePoints,
      generateTrianglePoints,
      generateSquarePoints,
      generateHexagonPoints,
      generateRhombusPoints,
      generatePentagonPoints,
      generateCrossPoints
    ];
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    return randomShape(count);
  }

  function generateScatteredPoints(count) {
    const points = [];
    for (let i = 0; i < count; i++) {
      points.push({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z: (Math.random() - 0.5) * 0.5
      });
    }
    return points;
  }

  /**
   * Generate point cloud from text string
   * Renders text to canvas and samples pixels
   */
  function generateFromText(text, count) {
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');

    // Canvas size for text rendering
    const canvasWidth = 512;
    const canvasHeight = 128;
    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Configure text rendering
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Calculate font size to fit text
    let fontSize = 80;
    ctx.font = `bold ${fontSize}px "Space Grotesk", "Arial Black", sans-serif`;

    // Measure and adjust font size if text is too wide
    let textWidth = ctx.measureText(text).width;
    while (textWidth > canvasWidth * 0.9 && fontSize > 20) {
      fontSize -= 4;
      ctx.font = `bold ${fontSize}px "Space Grotesk", "Arial Black", sans-serif`;
      textWidth = ctx.measureText(text).width;
    }

    // Draw text centered
    ctx.fillText(text, canvasWidth / 2, canvasHeight / 2);

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight).data;

    // Collect valid (white) pixels
    const validPixels = [];
    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const idx = (y * canvasWidth + x) * 4;
        const brightness = imageData[idx]; // Red channel (white text = 255)

        if (brightness > 128) {
          validPixels.push({ x, y });
        }
      }
    }

    // Generate points from valid pixels
    const points = [];
    const aspectRatio = canvasWidth / canvasHeight;

    for (let i = 0; i < count; i++) {
      if (validPixels.length > 0) {
        const pixel = validPixels[Math.floor(Math.random() * validPixels.length)];
        points.push({
          // Normalize to -1 to 1 range, adjust for aspect ratio
          x: ((pixel.x / canvasWidth) - 0.5) * 1.2,
          y: ((0.5 - pixel.y / canvasHeight)) * (1.2 / aspectRatio),
          z: (Math.random() - 0.5) * 0.08
        });
      } else {
        // Fallback: random point
        points.push({
          x: (Math.random() - 0.5) * 0.8,
          y: (Math.random() - 0.5) * 0.3,
          z: 0
        });
      }
    }

    return points;
  }

  function generateFromImage(img, count) {
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    const size = 128; // Sample resolution
    tempCanvas.width = size;
    tempCanvas.height = size;

    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size).data;

    const validPixels = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const alpha = imageData[idx + 3];
        const brightness = (imageData[idx] + imageData[idx + 1] + imageData[idx + 2]) / 3;

        if (alpha > 128 && brightness > 30) {
          validPixels.push({ x, y });
        }
      }
    }

    const points = [];
    for (let i = 0; i < count; i++) {
      const pixel = validPixels[Math.floor(Math.random() * validPixels.length)];
      if (pixel) {
        points.push({
          x: (pixel.x / size - 0.5) * 0.6,
          y: (0.5 - pixel.y / size) * 0.6, // Flip Y
          z: (Math.random() - 0.5) * 0.05
        });
      } else {
        // Fallback if no valid pixels
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.3;
        points.push({
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r,
          z: 0
        });
      }
    }
    return points;
  }

  // ============================================================
  // WEBGL INITIALIZATION
  // ============================================================

  function initWebGL() {
    canvas = document.querySelector('.ld-loader__canvas');
    if (!canvas) return false;

    // Try WebGL2, fall back to WebGL1
    gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;

    // Create shader program
    const vs = createShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Shader link error:', gl.getProgramInfoLog(program));
      return false;
    }

    // Generate geometry
    const scattered = generateScatteredPoints(CONFIG.pointCount);
    let target;

    // Priority: 1. Text attribute, 2. Image, 3. Circle fallback
    const loader = document.querySelector('.ld-loader');
    const loaderText = loader ? loader.dataset.loaderText : null;

    if (loaderText && loaderText.trim()) {
      // Generate from text (e.g., "NITEBORK", "DUPLAJÉZUS")
      target = generateFromText(loaderText.trim().toUpperCase(), CONFIG.pointCount);
    } else {
      // Check for custom logo image
      const logoImg = document.querySelector('.ld-loader__logo-source');
      if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
        target = generateFromImage(logoImg, CONFIG.pointCount);
      } else {
        // Index page: circle shape
        target = generateCirclePoints(CONFIG.pointCount);
      }
    }

    // Build buffer data
    const positionData = [];
    const targetData = [];
    const sizeData = [];
    const seedData = [];

    for (let i = 0; i < CONFIG.pointCount; i++) {
      positionData.push(scattered[i].x, scattered[i].y, scattered[i].z);
      targetData.push(target[i].x, target[i].y, target[i].z);
      sizeData.push(0.5 + Math.random() * CONFIG.pointSizeVariance);
      seedData.push(Math.random());
    }

    // Create buffers
    pointBuffer = createBuffer(positionData);
    targetBuffer = createBuffer(targetData);
    const sizeBuffer = createBuffer(sizeData);
    const seedBuffer = createBuffer(seedData);

    // Setup attributes
    gl.useProgram(program);

    setupAttribute('a_position', pointBuffer, 3);
    setupAttribute('a_target', targetBuffer, 3);
    setupAttribute('a_size', sizeBuffer, 1);
    setupAttribute('a_seed', seedBuffer, 1);

    // Get theme-appropriate colors
    const themeColors = getThemeColors();

    // Initial uniform values
    setUniform('u_colorScan', '3f', ...themeColors.colorScan);
    setUniform('u_colorDim', '3f', ...themeColors.colorDim);
    setUniform('u_pointSize', '1f', CONFIG.pointSize * window.devicePixelRatio);
    setUniform('u_scanWidth', '1f', CONFIG.scanWidth);

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Set clear color
    gl.clearColor(...themeColors.colorVoid, 1.0);

    return true;
  }

  function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createBuffer(data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return buffer;
  }

  function setupAttribute(name, buffer, size) {
    const location = gl.getAttribLocation(program, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  }

  function setUniform(name, type, ...values) {
    const location = gl.getUniformLocation(program, name);
    gl['uniform' + type](location, ...values);
  }

  // ============================================================
  // RESIZE HANDLING
  // ============================================================

  function resize() {
    if (!canvas || !gl) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth * dpr;
    const height = canvas.clientHeight * dpr;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      setUniform('u_resolution', '2f', width, height);
    }
  }

  // ============================================================
  // ANIMATION LOOP
  // ============================================================

  function animate(timestamp) {
    if (state.isComplete) return;

    if (!state.startTime) {
      state.startTime = timestamp;
      state.phaseStartTime = timestamp;
    }

    const elapsed = timestamp - state.startTime;
    const phaseElapsed = timestamp - state.phaseStartTime;

    // Update phase based on timing
    updatePhase(elapsed, phaseElapsed);

    // Update scan line
    state.scanY += CONFIG.scanSpeed * state.scanDirection * 16; // ~16ms frame
    if (state.scanY > 0.6) state.scanDirection = -1;
    if (state.scanY < -0.6) state.scanDirection = 1;

    // Render
    render(timestamp);

    // Continue loop
    animationId = requestAnimationFrame(animate);
  }

  function updatePhase(elapsed, phaseElapsed) {
    const { phaseVoid, phaseDetect, phaseForm, phaseSolid } = CONFIG;
    const totalPhaseTime = phaseVoid + phaseDetect + phaseForm + phaseSolid;

    // Calculate morph progress based on elapsed time - smooth transitions
    if (elapsed < phaseVoid) {
      state.phase = 'void';
      state.morphProgress = 0;
    } else if (elapsed < phaseVoid + phaseDetect) {
      state.phase = 'detect';
      // Gradual increase from 0 to 0.1 during detect phase
      const detectProgress = (elapsed - phaseVoid) / phaseDetect;
      state.morphProgress = detectProgress * 0.1;
    } else if (elapsed < phaseVoid + phaseDetect + phaseForm) {
      state.phase = 'form';
      const formProgress = (elapsed - phaseVoid - phaseDetect) / phaseForm;
      state.morphProgress = 0.1 + formProgress * 0.85; // 0.1 -> 0.95
    } else {
      state.phase = 'solid';
      state.morphProgress = 0.95 + (Math.min(phaseElapsed, phaseSolid) / phaseSolid) * 0.05;
    }

    // Check for completion
    if (elapsed >= CONFIG.minDisplayTime && state.resourceProgress >= 1) {
      beginFadeOut();
    }
  }

  function render(timestamp) {
    if (!gl || !program) return;

    resize();

    gl.clear(gl.COLOR_BUFFER_BIT);

    // Update uniforms
    setUniform('u_time', '1f', timestamp);
    setUniform('u_morph', '1f', easeOutCubic(state.morphProgress));
    setUniform('u_scanY', '1f', state.scanY);

    // Draw points
    gl.drawArrays(gl.POINTS, 0, CONFIG.pointCount);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // ============================================================
  // RESOURCE TRACKING
  // ============================================================

  function trackResources() {
    const images = Array.from(document.images).filter(img => !img.classList.contains('ld-loader__logo-source'));
    const stylesheets = Array.from(document.styleSheets);

    let loaded = 0;
    const total = images.length + stylesheets.length;

    if (total === 0) {
      state.resourceProgress = 1;
      return;
    }

    function update() {
      loaded++;
      state.resourceProgress = loaded / total;
      updateProgressUI();
    }

    images.forEach(img => {
      if (img.complete) {
        update();
      } else {
        img.addEventListener('load', update, { once: true });
        img.addEventListener('error', update, { once: true });
      }
    });

    // Stylesheets are typically loaded by the time JS runs
    stylesheets.forEach(() => update());
  }

  function updateProgressUI() {
    const fill = document.querySelector('.ld-loader__progress-fill');
    const text = document.querySelector('.ld-loader__progress-text');
    const status = document.querySelector('.ld-loader__status');

    const percent = Math.round(state.resourceProgress * 100);

    if (fill) fill.style.width = percent + '%';
    if (text) text.textContent = percent + '%';

    if (status) {
      if (percent < 30) status.textContent = 'SCANNING...';
      else if (percent < 60) status.textContent = 'MAPPING...';
      else if (percent < 90) status.textContent = 'RENDERING...';
      else status.textContent = 'COMPLETE';
    }
  }

  // ============================================================
  // FADE OUT & CLEANUP
  // ============================================================

  function beginFadeOut() {
    if (state.isComplete) return;
    state.isComplete = true;

    const loader = document.querySelector('.ld-loader');
    const content = document.querySelector('.ld-main-content');

    if (loader) {
      loader.classList.add('fade-out');

      loader.addEventListener('transitionend', () => {
        cleanup();
        loader.classList.add('hidden');

        if (content) {
          content.classList.add('visible');
          // Dispatch event for page-specific initialization
          window.dispatchEvent(new CustomEvent('lidarReady'));
        }
      }, { once: true });
    }
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    if (gl) {
      // Delete WebGL resources
      if (pointBuffer) gl.deleteBuffer(pointBuffer);
      if (targetBuffer) gl.deleteBuffer(targetBuffer);
      if (program) gl.deleteProgram(program);

      // Lose context to free memory
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }

    gl = null;
    program = null;
    pointBuffer = null;
    targetBuffer = null;
  }

  // ============================================================
  // FALLBACK MODE
  // ============================================================

  function initFallback() {
    state.useFallback = true;
    const loader = document.querySelector('.ld-loader');
    if (loader) {
      loader.classList.add('ld-loader--fallback');
    }

    // Simple timeout-based completion for fallback
    trackResources();

    window.addEventListener('load', () => {
      setTimeout(() => {
        state.resourceProgress = 1;
        beginFadeOut();
      }, CONFIG.minDisplayTime);
    });
  }

  // ============================================================
  // CAPABILITY DETECTION
  // ============================================================

  function canUseWebGL() {
    try {
      const testCanvas = document.createElement('canvas');
      const testGL = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      if (!testGL) return false;

      // Check for sufficient capability
      const maxPoints = testGL.getParameter(testGL.MAX_ELEMENTS_VERTICES);
      if (maxPoints < CONFIG.pointCount) return false;

      return true;
    } catch (e) {
      return false;
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isMobile() {
    return window.innerWidth <= 768 || window.matchMedia('(max-width: 768px)').matches;
  }

  function isIndexPage() {
    const loader = document.querySelector('.ld-loader');
    return loader && !loader.dataset.loaderText;
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    const loader = document.querySelector('.ld-loader');
    if (!loader) {
      // No loader element, skip entirely
      const content = document.querySelector('.ld-main-content');
      if (content) content.classList.add('visible');
      return;
    }

    // Skip WebGL on index page or mobile - use CSS fallback
    if (isIndexPage() || isMobile() || !canUseWebGL() || prefersReducedMotion()) {
      initFallback();
      return;
    }

    // Initialize WebGL
    if (!initWebGL()) {
      initFallback();
      return;
    }

    // Start tracking resources
    trackResources();

    // Handle window resize
    window.addEventListener('resize', resize);

    // Start animation loop
    animationId = requestAnimationFrame(animate);

    // Ensure completion even if resources stall
    window.addEventListener('load', () => {
      setTimeout(() => {
        state.resourceProgress = 1;
      }, 500);
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
