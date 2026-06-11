const API_BASE = 'https://vcsuynfbykvncenmhjfh.supabase.co/functions/v1';

function getPersonalSecret() {
    let secret = localStorage.getItem('nobs_secret');
    if (!secret) {
        secret = prompt('Enter access password:');
        if (!secret) throw new Error('Password required.');
        localStorage.setItem('nobs_secret', secret);
    }
    return secret;
}

function clearPersonalSecret() {
    localStorage.removeItem('nobs_secret');
}

const form = document.getElementById('scrapeForm');
const urlInput = document.getElementById('urlInput');
const btn = document.getElementById('scrapeBtn');
const status = document.getElementById('status');
const recipeEl = document.getElementById('recipe');
const emptyEl = document.getElementById('empty');
const historyEl = document.getElementById('historyList');
const newViewEl = document.getElementById('newView');
const recipeLayoutEl = document.getElementById('recipeLayout');
const dashViewEl = document.getElementById('dashView');
const dashGridEl = document.getElementById('dashGrid');

let activeFile = null;
let currentSourceUrl = null;
let currentRecipe = null;
let currentUnits = 'original';
let originalServings = null;
let currentServings = null;

const drawer = document.getElementById('drawer');
const backdrop = document.getElementById('drawerBackdrop');
document.getElementById('drawerToggle').addEventListener('click', () => {
    drawer.classList.add('open');
    backdrop.classList.add('open');
});
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
backdrop.addEventListener('click', closeDrawer);
function closeDrawer() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
}

document.getElementById('newBtn').addEventListener('click', () => {
    history.pushState({}, '', '/new');
    showView('new');
});

function showView(view) {
    const isNew = view === 'new';
    const isDash = view === 'dash';
    newViewEl.classList.toggle('hidden', !isNew);
    dashViewEl.classList.toggle('hidden', !isDash);
    recipeLayoutEl.classList.toggle('hidden', isDash || isNew);
    document.body.classList.toggle('new-view', isNew);
    const panel = document.getElementById('ingPanel');
    if (isNew || isDash) {
        panel.classList.remove('open');
        document.body.classList.remove('ing-open');
        if (isNew) setTimeout(() => urlInput?.focus(), 100);
    } else if (document.getElementById('ingPanelBody')?.children.length > 0) {
        panel.style.transition = 'none';
        document.body.style.transition = 'none';
        panel.classList.add('open');
        document.body.classList.add('ing-open');
        requestAnimationFrame(() => {
            panel.style.transition = '';
            document.body.style.transition = '';
        });
    }
}

async function loadHistory() {
    const res = await fetch(`${API_BASE}/recipes`).catch(() => null);
    if (!res || !res.ok) return;
    const list = await res.json();
    // Sidebar
    if (list.length) {
        historyEl.innerHTML = list
            .map(
                (item) => `
        <li>
            <button onclick="loadFile('${esc(item.filename)}')"
                    class="${item.filename === activeFile ? 'active' : ''}"
                    id="hist-${esc(item.filename)}">
                ${esc(item.title)}
                <span class="hist-date">${new Date(item.savedAt).toLocaleDateString()}</span>
            </button>
        </li>`,
            )
            .join('');
    }
    // Dashboard grid
    if (dashGridEl) {
        dashGridEl.innerHTML = list
            .map((item) => {
                let domain = '';
                try { domain = new URL(item.sourceUrl).hostname.replace(/^www\./, ''); } catch {}
                const date = new Date(item.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                return `<button class="dash-card" onclick="loadFile('${esc(item.filename)}')">
                    <span class="dash-card-title">${esc(item.title)}</span>
                    <span class="dash-card-meta">
                        <span class="dash-card-domain">${esc(domain)}</span>
                        <span>${esc(date)}</span>
                    </span>
                </button>`;
            })
            .join('');
    }
}

async function loadFile(filename) {
    activeFile = filename;
    const res = await fetch(
        `${API_BASE}/recipe?file=${encodeURIComponent(filename)}`,
    );
    const data = await res.json();
    if (!res.ok) {
        setStatus(data.error, true);
        return;
    }
    showView('recipe');
    renderRecipe(data);
    loadHistory();
    closeDrawer();
    // Push clean URL without the .json extension
    const slug = filename.replace(/\.json$/, '');
    if (window.location.pathname !== `/r/${slug}`) {
        history.pushState({ slug }, '', `/r/${slug}`);
    }
}

// ── Startup routing ──────────────────────────────────────────────────────────
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

// Handle browser back/forward
window.addEventListener('popstate', (e) => {
    if (window.location.pathname === '/new') {
        showView('new');
    } else if (e.state?.slug) {
        showView('recipe');
        loadFile(e.state.slug + '.json');
    } else {
        showView('dash');
        activeFile = null;
        document.getElementById('ingPanel').classList.remove('open');
        document.body.classList.remove('ing-open');
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;
    setStatus('Extracting…', false, true);
    try {
        const secret = getPersonalSecret();
        const res = await fetch(`${API_BASE}/scrape`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${secret}`,
            },
            body: JSON.stringify({ url }),
        });
        if (res.status === 401) {
            clearPersonalSecret();
            throw new Error('Wrong password.');
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Unknown error');
        const cached = data._cached;
        const hash = data._hash;
        delete data._cached;
        delete data._hash;
        setStatus(cached ? 'Loaded from cache.' : '');
        showView('recipe');
        renderRecipe(data);
        loadHistory();
        if (hash) history.pushState({ slug: hash }, '', `/r/${hash}`);
    } catch (err) {
        setStatus(err.message, true);
    }
});

function setStatus(msg, isError = false, loading = false) {
    btn.disabled = loading;
    status.className = isError ? 'error' : '';
    status.innerHTML = loading
        ? `<span class="spinner"></span>${msg}`
        : isError
          ? `${msg}`
          : msg;
}

async function refetchRecipe() {
    if (!currentSourceUrl) return;
    setStatus('Re-fetching…', false, true);
    try {
        const secret = getPersonalSecret();
        const res = await fetch(`${API_BASE}/scrape`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${secret}`,
            },
            body: JSON.stringify({ url: currentSourceUrl, force: true }),
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

function renderRecipe(r) {
    emptyEl.classList.add('hidden');
    recipeEl.classList.remove('hidden');
    currentSourceUrl = r.sourceUrl ?? null;

    const meta = [
        r.prepTime && { label: 'Prep', value: r.prepTime },
        r.cookTime && { label: 'Cook', value: r.cookTime },
        r.totalTime && { label: 'Total', value: r.totalTime },
        r.servings && { label: 'Serves', value: r.servings },
    ].filter(Boolean);

    const hasConversions =
        (r.ingredientGroups ?? []).some((g) =>
            (g.items ?? []).some((i) => i.conversion),
        ) || (r.steps ?? []).some((s) => s.temperatureConversion);

    const hasHints = (r.ingredientGroups ?? []).some((g) =>
        (g.items ?? []).some((i) => i.hint),
    );

    currentRecipe = r;

    recipeEl.innerHTML = `
        <h1 class="recipe-title">${esc(r.title)}</h1>
        <div class="recipe-source-row">
            ${r.sourceUrl && /^https?:\/\//i.test(r.sourceUrl) ? `<a class="recipe-source" href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">source ↗</a>` : ''}
            ${r.sourceUrl ? `<button class="refetch-btn" onclick="refetchRecipe()">Re-fetch</button>` : ''}
        </div>
        ${r.description ? `<p class="recipe-description">${esc(r.description)}</p>` : ''}
        ${
            meta.length
                ? `
        <div class="meta-row">
            ${meta
                .map(
                    (m) => `
            <div class="meta-pill">
                <span class="label">${esc(m.label)}</span>
                <span class="value">${esc(m.value)}</span>
            </div>`,
                )
                .join('')}
        </div>`
                : ''
        }
        <div class="recipe-body">
            <div class="recipe-steps-col">
                <div class="section-label">Method</div>
                <ol class="steps-list">
                    ${(r.steps ?? [])
                        .map(
                            (s) => `
                    <li class="step">
                        <span class="step-num">${s.stepNumber}</span>
                        <div class="step-body">
                            ${renderStepInstruction(s.instruction)}
                            ${s.temperatureConversion ? `<span class="conv step-temp-conv" style="display:none">→ ${esc(s.temperatureConversion)}</span>` : ''}
                            ${s.timingInterval ? `<span class="step-timing">${esc(s.timingInterval)}</span>` : ''}
                        </div>
                    </li>`,
                        )
                        .join('')}
                </ol>
            </div>
        </div>`;

    populateIngPanel(r, hasConversions, hasHints);
    // Open panel instantly on first load (suppress transition)
    const panel = document.getElementById('ingPanel');
    if (!panel.classList.contains('open')) {
        panel.style.transition = 'none';
        document.body.style.transition = 'none';
        panel.classList.add('open');
        document.body.classList.add('ing-open');
        // Re-enable transitions after layout has settled
        requestAnimationFrame(() => {
            panel.style.transition = '';
            document.body.style.transition = '';
        });
    }
}

function setUnits(mode) {
    currentUnits = mode;
    document.querySelectorAll('.ing-qty-original').forEach((el) => {
        el.style.display = mode === 'original' ? '' : 'none';
    });
    document.querySelectorAll('.ing-qty-converted').forEach((el) => {
        el.style.display = mode === 'converted' ? '' : 'none';
    });
    document.querySelectorAll('.step-temp-conv').forEach((el) => {
        el.style.display = mode === 'converted' ? '' : 'none';
    });
    ['btnOriginal', 'btnOriginalPanel'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.className = mode === 'original' ? 'active' : '';
    });
    ['btnConverted', 'btnConvertedPanel'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.className = mode === 'converted' ? 'active' : '';
    });
}

function renderIngredientGroups(groups) {
    return (groups ?? [])
        .map(
            (g) => `
        <div class="ing-group">
            ${g.group ? `<div class="ing-group-name">${esc(g.group)}</div>` : ''}
            <ul class="ing-list">
                ${(g.items ?? [])
                    .map((i) => {
                        const orig =
                            [i.quantity, i.unit].filter(Boolean).join(' ') ||
                            '—';
                        const conv = i.conversion
                            ? [i.conversion.quantity, i.conversion.unit]
                                  .filter(Boolean)
                                  .join(' ')
                            : null;
                        const origClass = conv
                            ? 'ing-qty ing-qty-original'
                            : 'ing-qty';
                        return `
                <li>
                    <span class="${origClass}">${orig}</span>
                    ${conv ? `<span class="ing-qty ing-qty-converted conv" style="display:none">${conv}</span>` : ''}
                    <span class="ing-name">
                        ${esc(i.name)}${i.notes ? ` <span class="ing-notes">(${esc(i.notes)})</span>` : ''}
                        ${i.hint ? `<span class="ing-hint">${esc(i.hint)}</span>` : ''}
                    </span>
                </li>`;
                    })
                    .join('')}
            </ul>
        </div>`,
        )
        .join('');
}

// ── Guide modal ──────────────────────────────────────────────────────────────
function openGuide() {
    if (!currentRecipe) return;
    const body = document.getElementById('guideModalBody');
    body.innerHTML = renderGuideGroups(currentRecipe.ingredientGroups);
    document.getElementById('guideBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeGuide() {
    document.getElementById('guideBackdrop').classList.remove('open');
    document.body.style.overflow = '';
}

document.getElementById('guideClose').addEventListener('click', closeGuide);
document.getElementById('guideBackdrop').addEventListener('click', (e) => {
    if (e.target === document.getElementById('guideBackdrop')) closeGuide();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeGuide();
});

function renderGuideGroups(groups) {
    return (groups ?? [])
        .map(
            (g) => `
        <div class="guide-group">
            ${g.group ? `<div class="guide-group-name">${esc(g.group)}</div>` : ''}
            ${(g.items ?? [])
                .map((i) => {
                    const qty =
                        [i.quantity, i.unit].filter(Boolean).join('\u00a0') ||
                        '—';
                    return `
        <div class="guide-row">
            <span class="guide-qty">${qty}</span>
            <span class="guide-name">${esc(i.name)}${i.notes ? ` <span class="guide-notes">(${esc(i.notes)})</span>` : ''}</span>
            <span class="guide-hint-cell">${i.hint ? esc(i.hint) : ''}</span>
        </div>`;
                })
                .join('')}
        </div>`,
        )
        .join('');
}

function renderStepInstruction(instruction) {
    if (!instruction) return '';
    const lines = instruction
        .split('\n')
        .flatMap((line) => line.trim().split(/(?<=[.!?])\s+(?=[A-Z])/))
        .map((l) => l.trim())
        .filter(Boolean);
    if (lines.length <= 1) {
        return `<span class="step-instruction">${esc(instruction)}</span>`;
    }
    return `<ul class="step-bullets">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
}

function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Ingredient panel (desktop) ───────────────────────────────────────────────
function toggleIngPanel() {
    const panel = document.getElementById('ingPanel');
    const isOpen = panel.classList.toggle('open');
    document.body.classList.toggle('ing-open', isOpen);
}

function populateIngPanel(r, hasConversions, hasHints) {
    const headEl = document.getElementById('ingPanelHead');
    const bodyEl = document.getElementById('ingPanelBody');
    if (!headEl || !bodyEl) return;
    originalServings = parseServingsNum(r.servings);
    currentServings = originalServings;
    headEl.innerHTML = `
        <div class="ing-panel-title-row">
            <span class="sidebar-label">Ingredients</span>
            ${hasHints ? '<button class="guide-btn" onclick="openGuide()">Guide</button>' : ''}
        </div>
        ${
            originalServings
                ? `
        <div class="servings-scaler">
            <button onclick="changeServings(-1)" aria-label="Fewer">−</button>
            <span class="servings-count" id="servingsCount">${originalServings}</span>
            <span class="servings-label">servings</span>
            <button onclick="changeServings(1)" aria-label="More">+</button>
        </div>`
                : ''
        }
        ${
            hasConversions
                ? `
        <div class="unit-toggle">
            <button id="btnOriginalPanel" class="active" onclick="setUnits('original')">Imperial</button>
            <button id="btnConvertedPanel" onclick="setUnits('converted')">Metric</button>
        </div>
        <p class="unit-toggle-note">Weights &amp; temperatures only</p>`
                : ''
        }
    `;
    bodyEl.innerHTML = renderIngredientGroupsScaled(r.ingredientGroups, 1);
}

// ── Servings scaler ──────────────────────────────────────────────────────────
function parseServingsNum(str) {
    if (!str) return null;
    const m = String(str).match(/\d+/);
    return m ? parseInt(m[0]) : null;
}

function parseFraction(str) {
    if (!str) return null;
    const s = String(str).trim();
    const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed)
        return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
    const frac = s.match(/^(\d+)\/(\d+)$/);
    if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
    const range = s.match(/^(\d+(?:\.\d+)?)[–\-](\d+(?:\.\d+)?)$/);
    if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
    const num = parseFloat(s);
    return isNaN(num) ? null : num;
}

function formatFraction(val) {
    if (val === null || val <= 0) return '0';
    const eighths = Math.round(val * 8);
    if (eighths === 0) return '0';
    const whole = Math.floor(eighths / 8);
    const rem = eighths % 8;
    const f = { 0: '', 1: '⅛', 2: '¼', 3: '⅜', 4: '½', 5: '⅝', 6: '¾', 7: '⅞' };
    const fStr = f[rem] ?? `${rem}/8`;
    if (whole === 0) return fStr;
    return fStr ? `${whole} ${fStr}` : `${whole}`;
}

function scaleQty(qty, factor) {
    if (!qty || factor === 1) return qty;
    const val = parseFraction(qty);
    if (val === null) return qty;
    return formatFraction(val * factor);
}

function changeServings(delta) {
    if (!currentServings || !originalServings) return;
    const next = Math.max(1, currentServings + delta);
    if (next === currentServings) return;
    currentServings = next;
    const factor = currentServings / originalServings;
    const scEl = document.getElementById('servingsCount');
    if (scEl) scEl.textContent = currentServings;
    const bodyEl = document.getElementById('ingPanelBody');
    if (bodyEl) {
        bodyEl.innerHTML = renderIngredientGroupsScaled(
            currentRecipe.ingredientGroups,
            factor,
        );
        document
            .querySelectorAll('#ingPanelBody .ing-qty-original')
            .forEach((el) => {
                el.style.display = currentUnits === 'original' ? '' : 'none';
            });
        document
            .querySelectorAll('#ingPanelBody .ing-qty-converted')
            .forEach((el) => {
                el.style.display = currentUnits === 'converted' ? '' : 'none';
            });
    }
}

function renderIngredientGroupsScaled(groups, factor) {
    return (groups ?? [])
        .map(
            (g) => `
        <div class="ing-group">
            ${g.group ? `<div class="ing-group-name">${esc(g.group)}</div>` : ''}
            <ul class="ing-list">
                ${(g.items ?? [])
                    .map((i) => {
                        const scaledQty = scaleQty(i.quantity, factor);
                        const orig =
                            [scaledQty, i.unit].filter(Boolean).join(' ') ||
                            '—';
                        const conv = i.conversion
                            ? [i.conversion.quantity, i.conversion.unit]
                                  .filter(Boolean)
                                  .join(' ')
                            : null;
                        const origClass = conv
                            ? 'ing-qty ing-qty-original'
                            : 'ing-qty';
                        return `<li>
                    <span class="${origClass}">${orig}</span>
                    ${conv ? `<span class="ing-qty ing-qty-converted conv" style="display:none">${conv}</span>` : ''}
                    <span class="ing-name">
                        ${esc(i.name)}${i.notes ? ` <span class="ing-notes">(${esc(i.notes)})</span>` : ''}
                        ${i.hint ? `<span class="ing-hint">${esc(i.hint)}</span>` : ''}
                    </span>
                </li>`;
                    })
                    .join('')}
            </ul>
        </div>`,
        )
        .join('');
}
