(() => {
  const tabList = document.querySelector('[data-recruit-tabs]');
  if (!tabList) return;

  const tabs = [...tabList.querySelectorAll('[data-recruit-panel]')];
  const panels = tabs.map((tab) => document.getElementById(tab.dataset.recruitPanel));
  if (!tabs.length || panels.some((panel) => !panel)) return;

  function selectTab(selectedIndex) {
    tabs.forEach((tab, index) => {
      const selected = index === selectedIndex;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[index].hidden = !selected;
    });
  }

  tabs.forEach((tab, index) => {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panels[index].id);
    panels[index].setAttribute('role', 'tabpanel');
    panels[index].setAttribute('aria-labelledby', tab.id);
    panels[index].tabIndex = 0;

    tab.addEventListener('click', () => selectTab(index));
    tab.addEventListener('keydown', (event) => {
      let nextIndex;
      switch (event.key) {
        case 'ArrowRight':
          nextIndex = (index + 1) % tabs.length;
          break;
        case 'ArrowLeft':
          nextIndex = (index - 1 + tabs.length) % tabs.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      selectTab(nextIndex);
      tabs[nextIndex].focus();
    });
  });

  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-label', '採用区分');
  selectTab(0);
  tabList.hidden = false;
})();
