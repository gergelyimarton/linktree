/**
 * Language Switcher — Shared Module
 * Supports Hungarian (hu) and English (en)
 * Works with both Legacy and LiDAR design systems
 * Persists language choice in localStorage
 */

(function() {
  'use strict';

  const DEFAULT_LANG = 'hu';
  const STORAGE_KEY = 'linktree-language';

  // Get saved language or default
  function getSavedLanguage() {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
  }

  // Save language preference
  function saveLanguage(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
  }

  // Apply language to the page
  function applyLanguage(lang) {
    // Set data attribute on html element
    document.documentElement.setAttribute('data-lang', lang);

    // Update button states
    document.querySelectorAll('.language-switcher button, .ld-lang-switcher button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Update elements with data-hu and data-en attributes
    document.querySelectorAll('[data-hu][data-en]').forEach(el => {
      el.textContent = el.dataset[lang];
    });

    // Update placeholders
    document.querySelectorAll('[data-placeholder-hu][data-placeholder-en]').forEach(el => {
      el.placeholder = el.dataset[`placeholder${lang.charAt(0).toUpperCase() + lang.slice(1)}`];
    });

    // Update select options if they have translations
    document.querySelectorAll('option[data-hu][data-en]').forEach(option => {
      option.textContent = option.dataset[lang];
    });

    // Trigger custom event for pages that need additional handling
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: lang } }));
  }

  // Detect if we're in LiDAR mode
  function isLidarMode() {
    return document.querySelector('.ld-main-content') !== null ||
           document.querySelector('[class^="ld-"]') !== null;
  }

  // Get or create the shared switcher container
  function getOrCreateContainer() {
    let container = document.querySelector('.ld-switcher-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'ld-switcher-container';
      document.body.appendChild(container);
    }
    return container;
  }

  // Create LiDAR-styled switcher
  function createLidarSwitcher() {
    const switcher = document.createElement('div');
    switcher.className = 'ld-lang-switcher';
    switcher.innerHTML = `
      <button data-lang="hu" type="button">HU</button>
      <button data-lang="en" type="button">EN</button>
    `;

    // Inject styles if not already present
    if (!document.querySelector('#ld-switcher-styles')) {
      const style = document.createElement('style');
      style.id = 'ld-switcher-styles';
      style.textContent = `
        .ld-switcher-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 100;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .ld-lang-switcher {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: var(--ld-panel, #0c0c12);
          border: 1px solid var(--ld-border, rgba(0, 255, 136, 0.1));
          border-radius: 2px;
        }

        .ld-lang-switcher button {
          padding: 8px 12px;
          font-family: var(--font-mono, 'JetBrains Mono', monospace);
          font-size: 10px;
          letter-spacing: 0.1em;
          color: var(--ld-text-dim, #505060);
          background: transparent;
          border: 1px solid transparent;
          border-radius: 1px;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s, background-color 0.15s;
        }

        .ld-lang-switcher button:hover {
          color: var(--ld-text, #c8c8d0);
          border-color: var(--ld-border, rgba(0, 255, 136, 0.1));
        }

        .ld-lang-switcher button.active {
          color: var(--ld-scan, #00ff88);
          border-color: var(--ld-scan, #00ff88);
          background: rgba(0, 255, 136, 0.05);
        }

        @media (max-width: 480px) {
          .ld-switcher-container {
            bottom: 16px;
            right: 16px;
          }

          .ld-lang-switcher button {
            padding: 6px 10px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    return switcher;
  }

  // Create legacy-styled switcher
  function createLegacySwitcher() {
    const switcher = document.createElement('div');
    switcher.className = 'language-switcher';

    // Check if page uses dark theme
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    const isDarkPage = document.body.classList.contains('dark-theme') ||
                       bodyBg.includes('rgb(11') ||
                       bodyBg.includes('rgb(15') ||
                       bodyBg.includes('rgb(0,') ||
                       bodyBg.includes('rgb(3,');

    if (isDarkPage) {
      switcher.classList.add('dark-theme');
    }

    switcher.innerHTML = `
      <button data-lang="hu" type="button">HU</button>
      <button data-lang="en" type="button">EN</button>
    `;

    return switcher;
  }

  // Create and inject the language switcher HTML
  function createSwitcher() {
    // Check if switcher already exists
    if (document.querySelector('.language-switcher') || document.querySelector('.ld-lang-switcher')) {
      return;
    }

    const switcher = isLidarMode() ? createLidarSwitcher() : createLegacySwitcher();

    // For LiDAR mode, use the shared container
    if (isLidarMode()) {
      const container = getOrCreateContainer();
      container.appendChild(switcher);
    } else {
      document.body.appendChild(switcher);
    }

    // Add click handlers
    switcher.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        saveLanguage(lang);
        applyLanguage(lang);
      });
    });
  }

  // Initialize on DOM ready
  function init() {
    createSwitcher();
    applyLanguage(getSavedLanguage());
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose functions globally for custom handling if needed
  window.LanguageSwitcher = {
    getLanguage: getSavedLanguage,
    setLanguage: function(lang) {
      saveLanguage(lang);
      applyLanguage(lang);
    },
    applyLanguage: applyLanguage
  };
})();
