(function () {
  'use strict';
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
  });
  document.addEventListener('click', (event) => { if (!event.target.closest('.dropdown')) toggles.forEach((toggle) => close(toggle, false)); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') toggles.filter((toggle) => toggle.getAttribute('aria-expanded') === 'true').forEach((toggle) => close(toggle, true)); });
}());
