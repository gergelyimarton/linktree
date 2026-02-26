/**
 * Language Switcher for Linktree Project
 * Supports Hungarian (hu) and English (en)
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
        document.querySelectorAll('.language-switcher button').forEach(btn => {
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
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }

    // Create and inject the language switcher HTML
    function createSwitcher() {
        // Check if switcher already exists
        if (document.querySelector('.language-switcher')) {
            return;
        }

        const switcher = document.createElement('div');
        switcher.className = 'language-switcher';

        // Check if page uses dark theme
        const isDarkPage = document.body.classList.contains('dark-theme') ||
                          document.querySelector('body[style*="background: linear-gradient(180deg, var(--bg)"]') ||
                          window.getComputedStyle(document.body).backgroundColor.includes('rgb(11') ||
                          window.getComputedStyle(document.body).backgroundColor.includes('rgb(15');

        if (isDarkPage) {
            switcher.classList.add('dark-theme');
        }

        switcher.innerHTML = `
            <button data-lang="hu" type="button">HU</button>
            <button data-lang="en" type="button">EN</button>
        `;

        document.body.appendChild(switcher);

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
