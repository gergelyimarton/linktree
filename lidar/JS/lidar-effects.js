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
      speed: 0.000175,  // 50% slower
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

  // Add CSS for reveal states
  function injectRevealStyles() {
    const style = document.createElement('style');
    style.textContent = `
      [data-reveal] {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease-out, transform 0.6s ease-out;
      }

      [data-reveal].revealed {
        opacity: 1;
        transform: translateY(0);
      }

      [data-reveal="fade"] {
        transform: none;
      }

      [data-reveal="slide-left"] {
        transform: translateX(-20px);
      }

      [data-reveal="slide-left"].revealed {
        transform: translateX(0);
      }

      [data-reveal="slide-right"] {
        transform: translateX(20px);
      }

      [data-reveal="slide-right"].revealed {
        transform: translateX(0);
      }

      /* Stagger children */
      [data-reveal-stagger] > * {
        opacity: 0;
        transform: translateY(15px);
        transition: opacity 0.5s ease-out, transform 0.5s ease-out;
      }

      [data-reveal-stagger].revealed > *:nth-child(1) { transition-delay: 0ms; opacity: 1; transform: translateY(0); }
      [data-reveal-stagger].revealed > *:nth-child(2) { transition-delay: 80ms; opacity: 1; transform: translateY(0); }
      [data-reveal-stagger].revealed > *:nth-child(3) { transition-delay: 160ms; opacity: 1; transform: translateY(0); }
      [data-reveal-stagger].revealed > *:nth-child(4) { transition-delay: 240ms; opacity: 1; transform: translateY(0); }
      [data-reveal-stagger].revealed > *:nth-child(5) { transition-delay: 320ms; opacity: 1; transform: translateY(0); }
      [data-reveal-stagger].revealed > *:nth-child(6) { transition-delay: 400ms; opacity: 1; transform: translateY(0); }
      [data-reveal-stagger].revealed > *:nth-child(7) { transition-delay: 480ms; opacity: 1; transform: translateY(0); }
      [data-reveal-stagger].revealed > *:nth-child(8) { transition-delay: 560ms; opacity: 1; transform: translateY(0); }
      [data-reveal-stagger].revealed > *:nth-child(n+9) { transition-delay: 640ms; opacity: 1; transform: translateY(0); }
    `;
    document.head.appendChild(style);
  }

  // ============================================================
  // PAGE TRANSITIONS
  // ============================================================

  function initPageTransitions() {
    // Add exit animation class to body
    const style = document.createElement('style');
    style.textContent = `
      body.page-exit {
        opacity: 0;
        transform: translateY(-10px);
        transition: opacity ${CONFIG.exitDuration}ms ease-in, transform ${CONFIG.exitDuration}ms ease-in;
      }
    `;
    document.head.appendChild(style);

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

    // Find or create canvas
    particleCanvas = document.querySelector('.ld-ambient-canvas');
    if (!particleCanvas) {
      particleCanvas = document.createElement('canvas');
      particleCanvas.className = 'ld-ambient-canvas';
      particleCanvas.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        opacity: 0.6;
      `;
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
        particleCtx.fillStyle = `rgba(0, 255, 136, ${p.opacity})`;
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
  // HERO SCANNER LINE
  // ============================================================

  function initHeroScanner() {
    if (!CONFIG.scanner.enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const hero = document.querySelector('.ld-hero');
    if (!hero) return;

    // Create scanner element
    const scanner = document.createElement('div');
    scanner.className = 'ld-hero__scanner';
    scanner.style.cssText = `
      position: absolute;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--ld-scan, #00ff88), transparent);
      box-shadow: 0 0 20px var(--ld-scan, #00ff88), 0 0 40px rgba(0, 255, 136, 0.3);
      opacity: 0.5;
      pointer-events: none;
      z-index: 0;
    `;
    hero.appendChild(scanner);

    let position = 0;
    let direction = 1;
    const heroHeight = hero.offsetHeight;

    function animate() {
      position += CONFIG.scanner.speed * direction * 16 * heroHeight;

      if (position > heroHeight) {
        direction = -1;
        position = heroHeight;
      }
      if (position < 0) {
        direction = 1;
        position = 0;
      }

      scanner.style.top = position + 'px';
      requestAnimationFrame(animate);
    }

    animate();
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

  function init() {
    // Wait for lidarReady event (from loader) or DOMContentLoaded
    const start = () => {
      injectRevealStyles();
      initScrollReveal();
      initPageTransitions();
      initCoordinateLabels();
      initAmbientParticles();
      initHeroScanner();
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
