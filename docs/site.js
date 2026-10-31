'use strict';

// Downloads work without JavaScript. No analytics or remote scripts.
const tabs = [...document.querySelectorAll('[data-platform]')];
const panels = [...document.querySelectorAll('[data-panel]')];
document.querySelector('.platform-tabs').setAttribute('role', 'tablist');
tabs.forEach(tab => {
  tab.setAttribute('role', 'tab');
  tab.id = `tab-${tab.dataset.platform}`;
  tab.setAttribute('aria-controls', `panel-${tab.dataset.platform}`);
});
panels.forEach(panel => {
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', `tab-${panel.dataset.panel}`);
  panel.tabIndex = 0;
});
function selectPlatform(platform) {
  tabs.forEach(tab => {
    const active = tab.dataset.platform === platform;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  panels.forEach(panel => { panel.hidden = panel.dataset.panel !== platform; });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectPlatform(tab.dataset.platform));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectPlatform(tabs[next].dataset.platform);
    tabs[next].focus();
  });
});
selectPlatform('windows');
const labels = { arrow: 'Uma seta resolve.', rectangle: 'Enquadre o detalhe.', text: 'Dê contexto à imagem.', pen: 'Marque do seu jeito.' };
document.querySelectorAll('[data-tool]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-tool]').forEach(tool => tool.setAttribute('aria-pressed', String(tool === button)));
    document.querySelectorAll('[data-mark]').forEach(mark => { mark.style.display = mark.dataset.mark === button.dataset.tool ? 'inline' : 'none'; });
    document.getElementById('demo-label').textContent = labels[button.dataset.tool];
  });
});
