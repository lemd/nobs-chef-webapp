import { els, state } from './state.js';

const drawer = document.getElementById('drawer');
const backdrop = document.getElementById('drawerBackdrop');

document.getElementById('drawerToggle').addEventListener('click', () => {
    drawer.classList.add('open');
    backdrop.classList.add('open');
});
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
backdrop.addEventListener('click', closeDrawer);

export function closeDrawer() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
}

export function showView(view) {
    const isNew = view === 'new';
    const isDash = view === 'dash';
    els.newViewEl.classList.toggle('hidden', !isNew);
    els.dashViewEl.classList.toggle('hidden', !isDash);
    els.recipeLayoutEl.classList.toggle('hidden', isDash || isNew);
    document.body.classList.toggle('new-view', isNew);
    document.body.classList.toggle('dash-view', isDash);
    const panel = document.getElementById('ingPanel');
    if (isNew || isDash) {
        panel.classList.remove('open');
        document.body.classList.remove('ing-open');
        if (isNew) setTimeout(() => els.urlInput?.focus(), 100);
    } else if (document.getElementById('ingPanelBody')?.children.length > 0) {
        panel.classList.add('open');
        document.body.classList.add('ing-open');
    }
}
