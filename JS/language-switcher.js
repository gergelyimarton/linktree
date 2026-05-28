/**
 * Language Switcher for Linktree Project
 * Supports Hungarian (hu) and English (en)
 * Persists language choice in localStorage
 * Uses .ld-switcher-container (bottom-right) — groups with theme-switcher.js
 */

(function() {
    'use strict';

    const DEFAULT_LANG = 'hu';
    const STORAGE_KEY = 'linktree-language';

    function getSavedLanguage() {
        return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
    }

    function saveLanguage(lang) {
        localStorage.setItem(STORAGE_KEY, lang);
    }

    function applyLanguage(lang) {
        document.documentElement.setAttribute('data-lang', lang);

        document.querySelectorAll('.language-switcher button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        document.querySelectorAll('[data-hu][data-en]').forEach(el => {
            el.textContent = el.dataset[lang];
        });

        document.querySelectorAll('[data-placeholder-hu][data-placeholder-en]').forEach(el => {
            el.placeholder = el.dataset[`placeholder${lang.charAt(0).toUpperCase() + lang.slice(1)}`];
        });

        document.querySelectorAll('option[data-hu][data-en]').forEach(option => {
            option.textContent = option.dataset[lang];
        });

        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }

    function createSwitcher() {
        if (document.querySelector('.language-switcher')) return;

        // .ld-switcher-container-t a theme-switcher.js már létrehozza/kezeli;
        // ha még nincs, mi hozzuk létre
        let container = document.querySelector('.ld-switcher-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'ld-switcher-container';
            document.body.appendChild(container);
        }

        const switcher = document.createElement('div');
        switcher.className = 'language-switcher';
        switcher.innerHTML = `
            <button data-lang="hu" type="button">HU</button>
            <button data-lang="en" type="button">EN</button>
        `;

        // A theme toggle után adjuk hozzá (theme toggle van balra, lang jobbra)
        container.appendChild(switcher);

        switcher.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                saveLanguage(btn.dataset.lang);
                applyLanguage(btn.dataset.lang);
            });
        });
    }

    function init() {
        createSwitcher();
        applyLanguage(getSavedLanguage());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.LanguageSwitcher = {
        getLanguage: getSavedLanguage,
        setLanguage: function(lang) {
            saveLanguage(lang);
            applyLanguage(lang);
        },
        applyLanguage: applyLanguage
    };
})();
