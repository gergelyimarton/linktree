/**
 * THEME SWITCHER
 * Handles dark/light mode switching with localStorage persistence
 * Default: follows system preference (auto)
 * Two modes only: light (sun icon) / dark (moon icon)
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'linktree-theme';

  // Get system preference
  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  // Get saved theme or system default
  function getSavedTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
      // No saved preference - use system
      return getSystemTheme();
    } catch {
      return getSystemTheme();
    }
  }

  // Check if user has explicitly set a preference
  function hasUserPreference() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'light' || saved === 'dark';
    } catch {
      return false;
    }
  }

  // Save theme preference
  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage not available
    }
  }

  // Apply theme to document
  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // Update toggle button state
    updateToggleState(theme);
  }

  // Update toggle button appearance
  function updateToggleState(theme) {
    const toggle = document.querySelector('.ld-theme-toggle');
    if (!toggle) return;

    toggle.setAttribute('data-mode', theme);
    toggle.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
  }

  // Toggle between light and dark
  function toggleTheme() {
    const currentTheme = getSavedTheme();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    saveTheme(newTheme);
    applyTheme(newTheme);
  }

  // Create and inject toggle button
  function createToggleButton() {
    // Check if button already exists
    if (document.querySelector('.ld-theme-toggle')) return;

    const button = document.createElement('button');
    button.className = 'ld-theme-toggle';
    button.setAttribute('aria-label', 'Toggle theme');
    button.setAttribute('data-mode', getSavedTheme());
    button.innerHTML = `
      <svg class="ld-theme-toggle__sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
      <svg class="ld-theme-toggle__moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    `;

    button.addEventListener('click', toggleTheme);

    // Inject styles
    injectStyles();

    // Find or create the shared container
    let container = document.querySelector('.ld-switcher-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'ld-switcher-container';
      document.body.appendChild(container);
    }

    // Insert at the beginning of the container (before language switcher)
    container.insertBefore(button, container.firstChild);
  }

  // Inject CSS styles
  function injectStyles() {
    if (document.querySelector('#ld-theme-toggle-styles')) return;

    const style = document.createElement('style');
    style.id = 'ld-theme-toggle-styles';
    style.textContent = `
      .ld-theme-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        padding: 0;
        background: var(--ld-panel, #0c0c12);
        border: 1px solid var(--ld-border, rgba(0, 255, 136, 0.1));
        border-radius: 2px;
        color: var(--ld-text-dim, #505060);
        cursor: pointer;
        transition: color 0.15s, border-color 0.15s;
      }

      .ld-theme-toggle:hover {
        color: var(--ld-text, #c8c8d0);
        border-color: var(--ld-border-hover, rgba(0, 255, 136, 0.3));
      }

      .ld-theme-toggle svg {
        width: 18px;
        height: 18px;
      }

      /* Hide both icons by default */
      .ld-theme-toggle .ld-theme-toggle__sun,
      .ld-theme-toggle .ld-theme-toggle__moon {
        display: none !important;
      }

      /* Light mode: show sun, hide moon */
      .ld-theme-toggle[data-mode="light"] .ld-theme-toggle__sun {
        display: block !important;
      }

      /* Dark mode: show moon, hide sun */
      .ld-theme-toggle[data-mode="dark"] .ld-theme-toggle__moon {
        display: block !important;
      }

      @media (max-width: 480px) {
        .ld-theme-toggle {
          width: 36px;
          height: 36px;
        }

        .ld-theme-toggle svg {
          width: 16px;
          height: 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Listen for system theme changes (when user hasn't set preference)
  function listenForSystemChanges() {
    if (!window.matchMedia) return;

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      // Only follow system if user hasn't explicitly chosen
      if (!hasUserPreference()) {
        applyTheme(getSystemTheme());
      }
    });
  }

  // Initialize
  function init() {
    // Apply theme immediately (before DOM ready to prevent flash)
    applyTheme(getSavedTheme());

    // Listen for system preference changes
    listenForSystemChanges();

    // Create button when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createToggleButton);
    } else {
      createToggleButton();
    }
  }

  // Run immediately
  init();

  // Expose for external use
  window.themeSwitcher = {
    toggle: toggleTheme,
    set: (theme) => {
      saveTheme(theme);
      applyTheme(theme);
    },
    get: getSavedTheme
  };

})();
