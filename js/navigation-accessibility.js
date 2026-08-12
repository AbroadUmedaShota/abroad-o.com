(function () {
  'use strict';
  document.documentElement.dataset.navAccessibilityReady = 'true';
  const navigationToggles = [...document.querySelectorAll('.navbar-toggler, .navbar-toggle')];
  navigationToggles.forEach((toggle) => {
    const legacy = toggle.classList.contains('navbar-toggle');
    const collapse = document.getElementById(toggle.getAttribute('aria-controls')) || document.querySelector('.navbar-main-collapse');
    if (!collapse) return;
    const sync = (open) => toggle.setAttribute('aria-expanded', String(open));
    if (legacy) window.jQuery?.(collapse).on('shown.bs.collapse', () => sync(true)).on('hidden.bs.collapse', () => sync(false));
    else {
      collapse.addEventListener('shown.bs.collapse', () => sync(true));
      collapse.addEventListener('hidden.bs.collapse', () => sync(false));
    }
    const hide = () => {
      if (legacy) window.jQuery?.(collapse).collapse('hide');
      else window.bootstrap?.Collapse.getOrCreateInstance(collapse).hide();
    };
    toggle.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); hide(); toggle.focus(); }
    });
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape' && (legacy ? collapse.classList.contains('in') : collapse.classList.contains('show'))) { hide(); toggle.focus(); }
    });
    collapse.addEventListener('click', (event) => { if (event.target.closest('a') && window.innerWidth < 768) { hide(); toggle.focus(); } });
  });
  const toggles = [...document.querySelectorAll('.nav-submenu-toggle, .legacy-submenu-toggle')];
  const close = (toggle, returnFocus) => {
    const menu = document.getElementById(toggle.getAttribute('aria-controls'));
    toggle.setAttribute('aria-expanded', 'false');
    toggle.closest('.dropdown')?.classList.remove('open');
    menu?.classList.remove('show');
    if (returnFocus) toggle.focus();
  };
  const open = (toggle) => {
    toggles.filter((other) => other !== toggle).forEach((other) => close(other, false));
    const menu = document.getElementById(toggle.getAttribute('aria-controls'));
    toggle.setAttribute('aria-expanded', 'true');
    toggle.closest('.dropdown')?.classList.add('open');
    menu?.classList.add('show');
    return menu;
  };
  toggles.forEach((toggle) => {
    const menu = document.getElementById(toggle.getAttribute('aria-controls'));
    toggle.addEventListener('click', (event) => {
      event.preventDefault(); event.stopImmediatePropagation();
      toggle.getAttribute('aria-expanded') === 'true' ? close(toggle, false) : open(toggle);
    });
    toggle.addEventListener('keydown', (event) => {
      if (!['Enter', ' ', 'ArrowDown', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Escape') return close(toggle, true);
      const menu = open(toggle);
      if (event.key === 'ArrowDown') menu?.querySelector('a')?.focus();
    });
    menu?.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close(toggle, true);
    });
  });
  document.addEventListener('click', (event) => { if (!event.target.closest('.dropdown')) toggles.forEach((toggle) => close(toggle, false)); });
  document.addEventListener('keydown', (event) => { if (!event.defaultPrevented && event.key === 'Escape') toggles.filter((toggle) => toggle.getAttribute('aria-expanded') === 'true').forEach((toggle) => close(toggle, true)); });
  const syncSlickFocus = () => document.querySelectorAll('.slick-slide').forEach((slide) => {
    const hidden = slide.getAttribute('aria-hidden') === 'true';
    if (hidden) {
      if (!slide.hasAttribute('data-pr4-tabindex')) slide.setAttribute('data-pr4-tabindex', slide.getAttribute('tabindex') || '');
      slide.setAttribute('tabindex', '-1');
    } else if (slide.hasAttribute('data-pr4-tabindex')) {
      const value = slide.getAttribute('data-pr4-tabindex');
      value ? slide.setAttribute('tabindex', value) : slide.removeAttribute('tabindex');
      slide.removeAttribute('data-pr4-tabindex');
    }
    slide.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach((element) => {
      if (hidden) {
        if (!element.hasAttribute('data-pr4-tabindex')) element.setAttribute('data-pr4-tabindex', element.getAttribute('tabindex') || '0');
        element.setAttribute('tabindex', '-1');
      } else if (element.hasAttribute('data-pr4-tabindex')) {
        const value = element.getAttribute('data-pr4-tabindex');
        value === '0' ? element.removeAttribute('tabindex') : element.setAttribute('tabindex', value);
        element.removeAttribute('data-pr4-tabindex');
      }
    });
  });
  new MutationObserver(syncSlickFocus).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-hidden', 'class'] });
  syncSlickFocus();
}());
