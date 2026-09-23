/**
 * LIDAR SELECT
 * Replaces the native dropdown popup of <select data-ld-select> with a
 * themed listbox. The native <select> stays in the DOM (visually hidden)
 * as the source of truth: its value is updated and a `change` event is
 * dispatched, so existing onchange handlers and .value reads keep working.
 */

(function() {
  'use strict';

  const CHEVRON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  let uid = 0;
  const instances = [];

  function enhance(select) {
    const id = 'ld-select-' + (++uid);

    const wrapper = document.createElement('div');
    wrapper.className = 'ld-select';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.classList.add('ld-select__native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'ld-select__trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', id);
    trigger.innerHTML = '<span class="ld-select__value"></span><span class="ld-select__chevron">' + CHEVRON + '</span>';

    const list = document.createElement('ul');
    list.className = 'ld-select__list';
    list.id = id;
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;

    wrapper.appendChild(trigger);
    wrapper.appendChild(list);

    // Labels pointing at the native select now focus the trigger
    if (select.id) {
      document.querySelectorAll('label[for="' + select.id + '"]').forEach(label => {
        label.addEventListener('click', (e) => {
          e.preventDefault();
          trigger.focus();
        });
        if (!label.id) label.id = id + '-label';
        trigger.setAttribute('aria-labelledby', label.id);
        list.setAttribute('aria-labelledby', label.id);
      });
    }

    let activeIndex = select.selectedIndex;

    function render() {
      list.innerHTML = '';
      Array.from(select.options).forEach((opt, i) => {
        const li = document.createElement('li');
        li.className = 'ld-select__option';
        li.id = id + '-opt-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(i === select.selectedIndex));
        li.textContent = opt.textContent;
        li.addEventListener('click', () => {
          choose(i);
          close(true);
        });
        li.addEventListener('mousemove', () => setActive(i, false));
        list.appendChild(li);
      });
      trigger.querySelector('.ld-select__value').textContent =
        select.options[select.selectedIndex] ? select.options[select.selectedIndex].textContent : '';
      setActive(activeIndex, false);
    }

    function setActive(i, scroll) {
      const items = list.children;
      if (!items.length) return;
      activeIndex = Math.max(0, Math.min(items.length - 1, i));
      Array.from(items).forEach((li, j) => li.classList.toggle('is-active', j === activeIndex));
      list.setAttribute('aria-activedescendant', items[activeIndex].id);
      if (scroll) items[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    function choose(i) {
      if (i === select.selectedIndex) return;
      select.selectedIndex = i;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      render();
    }

    function isOpen() {
      return wrapper.classList.contains('is-open');
    }

    function open() {
      if (isOpen()) return;
      instances.forEach(inst => inst !== api && inst.close(false));

      // Open upwards when there is not enough room below
      wrapper.classList.remove('ld-select--up');
      wrapper.classList.add('is-open');
      const rect = trigger.getBoundingClientRect();
      const listHeight = list.offsetHeight;
      const below = window.innerHeight - rect.bottom;
      if (below < listHeight + 8 && rect.top > below) {
        wrapper.classList.add('ld-select--up');
      }

      const host = wrapper.closest('.ld-card, [data-reveal]');
      if (host) host.classList.add('ld-select-host--open');

      trigger.setAttribute('aria-expanded', 'true');
      setActive(select.selectedIndex, true);
      list.focus({ preventScroll: true });
    }

    function close(returnFocus) {
      if (!isOpen()) return;
      wrapper.classList.remove('is-open', 'ld-select--up');
      const host = wrapper.closest('.ld-select-host--open');
      if (host) host.classList.remove('ld-select-host--open');
      trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) trigger.focus();
    }

    trigger.addEventListener('click', () => (isOpen() ? close(true) : open()));

    trigger.addEventListener('keydown', (e) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        open();
      }
    });

    list.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); setActive(activeIndex + 1, true); break;
        case 'ArrowUp': e.preventDefault(); setActive(activeIndex - 1, true); break;
        case 'Home': e.preventDefault(); setActive(0, true); break;
        case 'End': e.preventDefault(); setActive(list.children.length - 1, true); break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          choose(activeIndex);
          close(true);
          break;
        case 'Escape': e.preventDefault(); close(true); break;
        case 'Tab': close(false); break;
      }
    });

    document.addEventListener('pointerdown', (e) => {
      if (!wrapper.contains(e.target)) close(false);
    });

    // Keep in sync with programmatic changes and the language switcher
    select.addEventListener('change', render);
    window.addEventListener('languageChanged', () => setTimeout(render, 0));

    render();

    const api = { close };
    instances.push(api);
  }

  function init() {
    document.querySelectorAll('select[data-ld-select]').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
