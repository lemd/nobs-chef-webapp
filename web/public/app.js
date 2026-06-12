import { API_BASE, getPersonalSecret, clearPersonalSecret, els, state } from './modules/state.js';
import { esc } from './modules/utils.js';
import { setStatus, mosaicLoading } from './modules/ui.js';
import { showView } from './modules/views.js';
import { renderRecipe } from './modules/recipe.js';
import { loadHistory, loadFile } from './modules/dashboard.js';
import { closeGuide } from './modules/panel.js';

// ── Guide modal close handlers ────────────────────────────────────────────────
document.getElementById('guideClose').addEventListener('click', closeGuide);
document.getElementById('guideBackdrop').addEventListener('click', (e) => {
    if (e.target === document.getElementById('guideBackdrop')) closeGuide();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeGuide();
});

// ── Nav ───────────────────────────────────────────────────────────────────────
document.getElementById('homeBtn').addEventListener('click', (e) => {
    e.preventDefault();
    history.pushState({}, '', '/');
    showView('dash');
});

document.getElementById('newBtn').addEventListener('click', () => {
    history.pushState({}, '', '/new');
    showView('new');
});

// ── Input mode toggle ────────────────────────────────────────────────────────
const pasteInput = document.getElementById('pasteInput');

function setInputMode(mode) {
    const urlForm = document.getElementById('scrapeForm');
    const pasteFormEl = document.getElementById('pasteForm');
    const btnUrl = document.getElementById('modeUrl');
    const btnPaste = document.getElementById('modePaste');
    const isUrl = mode === 'url';
    urlForm.classList.toggle('hidden', !isUrl);
    pasteFormEl.classList.toggle('hidden', isUrl);
    btnUrl.classList.toggle('text-[#111]', isUrl);
    btnUrl.classList.toggle('border-[#111]', isUrl);
    btnUrl.classList.toggle('text-[#8a7d72]', !isUrl);
    btnUrl.classList.toggle('border-transparent', !isUrl);
    btnPaste.classList.toggle('text-[#111]', !isUrl);
    btnPaste.classList.toggle('border-[#111]', !isUrl);
    btnPaste.classList.toggle('text-[#8a7d72]', isUrl);
    btnPaste.classList.toggle('border-transparent', isUrl);
    setTimeout(() => (isUrl ? els.urlInput : pasteInput)?.focus(), 50);
}
window.setInputMode = setInputMode;

// ── Scrape forms ─────────────────────────────────────────────────────────────
const pasteForm = document.getElementById('pasteForm');

els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = els.urlInput.value.trim();
    if (!url) return;
    els.urlInput.value = '';
    els.urlInput.focus();
    queueAdd({ url });
});

pasteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = pasteInput.value.trim();
    if (!text) return;
    pasteInput.value = '';
    pasteInput.focus();
    queueAdd({ text });
});

// ── Scrape queue ──────────────────────────────────────────────────────────────
const scrapeQueue = [];
let queueRunning = false;
const queueListEl = document.getElementById('scrapeQueue');

window.addEventListener('beforeunload', (e) => {
    if (queueRunning || scrapeQueue.length > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});

function queueAdd(item) {
    const label = item.url ?? 'Pasted text';
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.dataset.state = 'pending';
    li.innerHTML = `<span class="queue-item-url" title="${esc(label)}">${esc(label)}</span><span class="queue-item-state">Pending</span>`;
    queueListEl.appendChild(li);
    scrapeQueue.push({ ...item, label, el: li });
    if (!queueRunning) queueProcess();
}

async function queueProcess() {
    queueRunning = true;
    mosaicLoading(true);
    while (scrapeQueue.length > 0) {
        const item = scrapeQueue[0];
        item.el.dataset.state = 'processing';
        item.el.querySelector('.queue-item-state').innerHTML =
            '<span class="spinner"></span>Extracting';
        try {
            const secret = getPersonalSecret();
            const res = await fetch(`${API_BASE}/scrape`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${secret}`,
                },
                body: JSON.stringify(
                    item.text ? { text: item.text } : { url: item.url },
                ),
            });
            if (res.status === 401) {
                clearPersonalSecret();
                throw new Error('Wrong password.');
            }
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Unknown error');
            const hash = data._hash;
            delete data._cached;
            delete data._hash;
            item.el.dataset.state = 'done';
            item.el.querySelector('.queue-item-state').textContent = 'Done';
            loadHistory();
            renderRecipe(data);
            if (hash) history.replaceState({ slug: hash }, '', `/new`);
        } catch (err) {
            item.el.dataset.state = 'error';
            item.el.querySelector('.queue-item-state').textContent =
                err.message.length < 30 ? err.message : 'Error';
            item.el.title = err.message;
        }
        scrapeQueue.shift();
    }
    queueRunning = false;
    mosaicLoading(false);
    setStatus('');
}

// ── Refetch recipe ────────────────────────────────────────────────────────────
async function refetchRecipe() {
    if (!state.currentSourceUrl) return;
    setStatus('Re-fetching\u2026', false, true);
    try {
        const secret = getPersonalSecret();
        const res = await fetch(`${API_BASE}/scrape`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${secret}`,
            },
            body: JSON.stringify({ url: state.currentSourceUrl, force: true }),
        });
        if (res.status === 401) {
            clearPersonalSecret();
            throw new Error('Wrong password.');
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Unknown error');
        const hash = data._hash;
        delete data._cached;
        delete data._hash;
        setStatus('');
        renderRecipe(data);
        loadHistory();
        if (hash) history.pushState({ slug: hash }, '', `/r/${hash}`);
    } catch (err) {
        setStatus(err.message, true);
    }
}
window.refetchRecipe = refetchRecipe;

// ── Startup routing ───────────────────────────────────────────────────────────
(function initSeasonFilter() {
    const month = new Date().getMonth(); // 0=Jan
    const season =
        month >= 2 && month <= 4
            ? 'spring'
            : month >= 5 && month <= 7
              ? 'summer'
              : month >= 8 && month <= 10
                ? 'autumn'
                : 'winter';
    state.activeFilters.season.add(season);
    const btn = document.querySelector(`[data-filter="season:${season}"]`);
    if (btn) btn.classList.add('active');
})();

const routeMatch = window.location.pathname.match(/^\/r\/([a-zA-Z0-9_-]+)$/);
if (routeMatch) {
    showView('recipe');
    loadFile(routeMatch[1] + '.json');
} else if (window.location.pathname === '/new') {
    showView('new');
} else {
    showView('dash');
}
loadHistory();

window.addEventListener('popstate', (e) => {
    if (window.location.pathname === '/new') {
        showView('new');
    } else if (e.state?.slug) {
        showView('recipe');
        loadFile(e.state.slug + '.json');
    } else {
        showView('dash');
        state.activeFile = null;
        document.getElementById('ingPanel').classList.remove('open');
        document.body.classList.remove('ing-open');
    }
});
