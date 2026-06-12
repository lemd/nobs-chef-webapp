import { state } from './state.js';

export function switchPanelTab(tab) {
    state.currentPanelTab = tab;
    ['Ingredients', 'Timers', 'Servings'].forEach((name) => {
        const t = name.toLowerCase();
        const sec = document.getElementById(`panel${name}`);
        const outerBtn = document.getElementById(`otab-${t}`);
        if (sec) sec.style.display = t === tab ? '' : 'none';
        if (outerBtn) outerBtn.classList.toggle('active', t === tab);
    });
}

export function tapOuterTab(tab) {
    const panel = document.getElementById('ingPanel');
    const isOpen = panel.classList.contains('open');
    if (isOpen && state.currentPanelTab === tab) {
        panel.classList.remove('open');
        document.body.classList.remove('ing-open');
    } else {
        switchPanelTab(tab);
        panel.classList.add('open');
        document.body.classList.add('ing-open');
    }
}

window.tapOuterTab = tapOuterTab;
