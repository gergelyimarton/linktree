/**
 * LIDAR EFFECTS
 * Scroll-triggered reveals, page transitions, ambient effects
 *
 * Production status: 🟢 production-adjacent
 * Tradeoff priority: Simplicity > Visual richness
 */

(function() {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================

  const CONFIG = {
    // Scroll reveal
    revealThreshold: 0.15,
    revealRootMargin: '0px 0px -50px 0px',

    // Page transitions
    exitDuration: 300,

    // Ambient particles (optional, very subtle)
    particles: {
      enabled: true,
      count: 40,
      speed: 0.0003,
      size: [1.5, 3],
      opacity: [0.25, 0.5]
    },

    // Hero scanner
    scanner: {
      enabled: true,
      speed1: 0.00012,  // Scanner 1 speed (20% slower)
      speed2: 0.00016,  // Scanner 2 speed (slightly faster)
      width: 100
    }
  };

  // ============================================================
  // SCROLL REVEAL
  // ============================================================

  function initScrollReveal() {
    const revealElements = document.querySelectorAll('[data-reveal]');
    if (!revealElements.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: CONFIG.revealThreshold,
      rootMargin: CONFIG.revealRootMargin
    });

    revealElements.forEach(el => observer.observe(el));
  }

  // Reveal styles are now in lidar-components.css
  function injectRevealStyles() {
    // Styles moved to CSS file - no longer needed
  }

  // ============================================================
  // PAGE TRANSITIONS
  // ============================================================

  function initPageTransitions() {
    // Exit animation styles in CSS

    // Intercept link clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href');

      // Skip external links, anchors, and special protocols
      if (!href ||
          href.startsWith('#') ||
          href.startsWith('http') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          link.target === '_blank') {
        return;
      }

      e.preventDefault();
      document.body.classList.add('page-exit');

      setTimeout(() => {
        window.location.href = href;
      }, CONFIG.exitDuration);
    });
  }

  // ============================================================
  // AMBIENT PARTICLES (Canvas)
  // ============================================================

  let particleCanvas = null;
  let particleCtx = null;
  let particles = [];
  let particleAnimationId = null;

  function initAmbientParticles() {
    if (!CONFIG.particles.enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Find or create canvas (styles in CSS)
    particleCanvas = document.querySelector('.ld-ambient-canvas');
    if (!particleCanvas) {
      particleCanvas = document.createElement('canvas');
      particleCanvas.className = 'ld-ambient-canvas';
      document.body.insertBefore(particleCanvas, document.body.firstChild);
    }

    particleCtx = particleCanvas.getContext('2d');

    // Generate particles
    particles = [];
    for (let i = 0; i < CONFIG.particles.count; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        size: CONFIG.particles.size[0] + Math.random() * (CONFIG.particles.size[1] - CONFIG.particles.size[0]),
        opacity: CONFIG.particles.opacity[0] + Math.random() * (CONFIG.particles.opacity[1] - CONFIG.particles.opacity[0]),
        vx: (Math.random() - 0.5) * CONFIG.particles.speed,
        vy: (Math.random() - 0.5) * CONFIG.particles.speed
      });
    }

    // Handle resize
    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      particleCanvas.width = window.innerWidth * dpr;
      particleCanvas.height = window.innerHeight * dpr;
      particleCtx.scale(dpr, dpr);
    }

    resize();
    window.addEventListener('resize', resize);

    // Animation loop
    function animate() {
      particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

      // Check theme for particle color
      const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
      const particleColor = isLightTheme ? '10, 10, 10' : '0, 255, 136';

      particles.forEach(p => {
        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1;
        if (p.y > 1) p.y = 0;

        // Draw
        const x = p.x * window.innerWidth;
        const y = p.y * window.innerHeight;

        particleCtx.beginPath();
        particleCtx.arc(x, y, p.size, 0, Math.PI * 2);
        particleCtx.fillStyle = `rgba(${particleColor}, ${p.opacity})`;
        particleCtx.fill();
      });

      particleAnimationId = requestAnimationFrame(animate);
    }

    animate();

    // Pause when tab not visible
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(particleAnimationId);
      } else {
        animate();
      }
    });
  }

  // ============================================================
  // SCANNER LINES (Hero only, dual scanners from opposite directions)
  // ============================================================

  function initScanner() {
    if (!CONFIG.scanner.enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const hero = document.querySelector('.ld-hero');
    if (!hero) return; // Only on index page with hero

    // Check if scanners already exist
    if (hero.querySelector('.ld-hero__scanner')) return;

    let heroHeight = hero.offsetHeight;

    // Scanner 1: starts from top, moves down
    const scanner1 = document.createElement('div');
    scanner1.className = 'ld-hero__scanner';
    hero.appendChild(scanner1);

    // Scanner 2: starts from bottom, moves up
    const scanner2 = document.createElement('div');
    scanner2.className = 'ld-hero__scanner';
    hero.appendChild(scanner2);

    let pos1 = 0;
    let dir1 = 1;
    let pos2 = heroHeight;
    let dir2 = -1;
    let lastTime = performance.now();

    function animate(currentTime) {
      // Calculate delta time for smooth animation
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Recalculate hero height in case of resize
      heroHeight = hero.offsetHeight;

      // Scanner 1 - slower
      const speed1 = CONFIG.scanner.speed1 * deltaTime * heroHeight;
      pos1 += speed1 * dir1;
      if (pos1 > heroHeight) { dir1 = -1; pos1 = heroHeight; }
      if (pos1 < 0) { dir1 = 1; pos1 = 0; }
      scanner1.style.top = pos1 + 'px';

      // Scanner 2 - faster
      const speed2 = CONFIG.scanner.speed2 * deltaTime * heroHeight;
      pos2 += speed2 * dir2;
      if (pos2 > heroHeight) { dir2 = -1; pos2 = heroHeight; }
      if (pos2 < 0) { dir2 = 1; pos2 = 0; }
      scanner2.style.top = pos2 + 'px';

      requestAnimationFrame(animate);
    }

    // Start animation
    requestAnimationFrame(animate);
  }

  // ============================================================
  // COORDINATE LABELS (Clinical aesthetic)
  // ============================================================

  function initCoordinateLabels() {
    const cards = document.querySelectorAll('.ld-card[data-id], .ld-link-card[data-id], .ld-project-card[data-id]');
    cards.forEach((card, index) => {
      if (!card.dataset.id) {
        const x = String(Math.floor(Math.random() * 999)).padStart(3, '0');
        const y = String(Math.floor(Math.random() * 999)).padStart(3, '0');
        card.dataset.id = `${x}:${y}`;
      }
    });
  }

  // ============================================================
  // TYPING EFFECT (Optional, for hero subtitle)
  // ============================================================

  function initTypingEffect() {
    const typeElements = document.querySelectorAll('[data-type]');

    typeElements.forEach(el => {
      const text = el.textContent;
      el.textContent = '';
      el.style.visibility = 'visible';

      let i = 0;
      const speed = parseInt(el.dataset.typeSpeed) || 50;

      function type() {
        if (i < text.length) {
          el.textContent += text.charAt(i);
          i++;
          setTimeout(type, speed);
        }
      }

      // Start typing when visible
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setTimeout(type, 300);
          observer.disconnect();
        }
      });
      observer.observe(el);
    });
  }

  // ============================================================
  // LANGUAGE SWITCHER INTEGRATION
  // ============================================================

  function initLanguageIntegration() {
    // Listen for language change events from legacy system
    window.addEventListener('languageChanged', (e) => {
      // Could update any dynamic content here
      console.log('Language changed to:', e.detail?.lang);
    });
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  let initialized = false;

  function init() {
    // Wait for lidarReady event (from loader) or DOMContentLoaded
    const start = () => {
      if (initialized) return;
      initialized = true;

      injectRevealStyles();
      initScrollReveal();
      initPageTransitions();
      initCoordinateLabels();
      initAmbientParticles();
      initScanner();
      initTypingEffect();
      initLanguageIntegration();
    };

    // If loader exists, wait for it
    if (document.querySelector('.ld-loader')) {
      window.addEventListener('lidarReady', start, { once: true });

      // Fallback if lidarReady never fires
      setTimeout(start, 5000);
    } else {
      // No loader, start immediately
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
      } else {
        start();
      }
    }
  }

  init();

})();
