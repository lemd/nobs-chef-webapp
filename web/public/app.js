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
const appScroll = document.getElementById('app-scroll');

let activeFile = null;
let currentSourceUrl = null;
let currentRecipe = null;
let currentUnits = 'original';
let originalServings = null;
let currentServings = null;
let currentPanelTab = 'ingredients';
const activeTimers = [];
let timerIdCounter = 0;
let timerCarouselIndex = 0;

const PANEL_TAB_CONFIG = {}; // kept for safety, no longer used

function initTimers(steps) {
    // Clear any running timers
    activeTimers.forEach((t) => clearInterval(t.interval));
    activeTimers.length = 0;
    timerIdCounter = 0;
    timerCarouselIndex = 0;
    (steps ?? []).forEach((s) => {
        const secs = parseTimingToSeconds(s.timingInterval);
        if (!secs) return;
        activeTimers.push({
            id: ++timerIdCounter,
            stepNum: s.stepNumber,
            label: `Step ${s.stepNumber}`,
            sublabel: s.timingInterval,
            total: secs,
            remaining: secs,
            running: false,
            interval: null,
        });
    });
    renderTimers();
}

function tapTimerBtn(stepNum) {
    const idx = activeTimers.findIndex((t) => t.stepNum === stepNum);
    if (idx === -1) return;
    timerCarouselIndex = idx;
    const t = activeTimers[idx];
    // Reset if already done so tapping always restarts
    if (t.remaining === 0) {
        clearInterval(t.interval);
        t.interval = null;
        t.running = false;
        t.remaining = t.total;
    }
    const panel = document.getElementById('ingPanel');
    if (!panel.classList.contains('open')) {
        panel.classList.add('open');
        document.body.classList.add('ing-open');
    }
    switchPanelTab('timers');
    startTimer(t.id);
    // Scroll carousel to this timer (even if panel was already open)
    requestAnimationFrame(() => {
        const carousel = document.getElementById('timerCarousel');
        if (carousel)
            carousel.scrollTo({
                left: idx * carousel.clientWidth,
                behavior: 'smooth',
            });
        document
            .querySelectorAll('.timer-dot')
            .forEach((d, i) => d.classList.toggle('active', i === idx));
    });
}

function carouselNav(dir) {
    const n = activeTimers.length;
    if (n < 2) return;
    timerCarouselIndex = Math.max(0, Math.min(timerCarouselIndex + dir, n - 1));
    const carousel = document.getElementById('timerCarousel');
    if (carousel)
        carousel.scrollTo({
            left: timerCarouselIndex * carousel.clientWidth,
            behavior: 'smooth',
        });
    document
        .querySelectorAll('.timer-dot')
        .forEach((d, i) =>
            d.classList.toggle('active', i === timerCarouselIndex),
        );
}

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

document.getElementById('homeBtn').addEventListener('click', (e) => {
    e.preventDefault();
    history.pushState({}, '', '/');
    showView('dash');
});

document.getElementById('newBtn').addEventListener('click', () => {
    history.pushState({}, '', '/new');
    showView('new');
});

function switchPanelTab(tab) {
    currentPanelTab = tab;
    ['Ingredients', 'Timers', 'Servings'].forEach((name) => {
        const t = name.toLowerCase();
        const sec = document.getElementById(`panel${name}`);
        const outerBtn = document.getElementById(`otab-${t}`);
        if (sec) sec.style.display = t === tab ? '' : 'none';
        if (outerBtn) outerBtn.classList.toggle('active', t === tab);
    });
}

function tapOuterTab(tab) {
    const panel = document.getElementById('ingPanel');
    const isOpen = panel.classList.contains('open');
    if (isOpen && currentPanelTab === tab) {
        panel.classList.remove('open');
        document.body.classList.remove('ing-open');
    } else {
        switchPanelTab(tab);
        panel.classList.add('open');
        document.body.classList.add('ing-open');
    }
}

function parseTimingToSeconds(str) {
    if (!str) return null;
    let secs = 0;
    const h = str.match(/(\d+)\s*h(?:our|r)?s?/i);
    if (h) secs += parseInt(h[1]) * 3600;
    const m = str.match(/(?:\d+[\u2013\-])?((\d+))\s*min/i);
    if (m) secs += parseInt(m[1]) * 60;
    const s = str.match(/(\d+)\s*sec/i);
    if (s) secs += parseInt(s[1]);
    return secs > 0 ? secs : null;
}

function formatTime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0)
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function addTimer(stepNum, seconds) {
    // Legacy shim — just call tapTimerBtn if the timer already exists
    tapTimerBtn(stepNum);
}

function startTimer(id) {
    const t = activeTimers.find((t) => t.id === id);
    if (!t || t.running || t.remaining === 0) return;
    t.running = true;
    t.interval = setInterval(() => {
        t.remaining = Math.max(0, t.remaining - 1);
        if (t.remaining === 0) {
            t.running = false;
            clearInterval(t.interval);
            t.interval = null;
        }
        renderTimers();
    }, 1000);
    renderTimers();
}

function pauseTimer(id) {
    const t = activeTimers.find((t) => t.id === id);
    if (!t || !t.running) return;
    t.running = false;
    clearInterval(t.interval);
    t.interval = null;
    renderTimers();
}

function resetTimer(id) {
    const t = activeTimers.find((t) => t.id === id);
    if (!t) return;
    clearInterval(t.interval);
    t.interval = null;
    t.running = false;
    t.remaining = t.total;
    renderTimers();
}

function removeTimer(id) {
    const idx = activeTimers.findIndex((t) => t.id === id);
    if (idx === -1) return;
    clearInterval(activeTimers[idx].interval);
    activeTimers.splice(idx, 1);
    renderTimers();
}

function buildCarouselHTML() {
    const hasMultiple = activeTimers.length > 1;
    const navPrev = hasMultiple
        ? '<button class="timer-nav-btn" onclick="carouselNav(-1)" aria-label="Previous timer">&#8249;</button>'
        : '';
    const navNext = hasMultiple
        ? '<button class="timer-nav-btn" onclick="carouselNav(1)" aria-label="Next timer">&#8250;</button>'
        : '';
    return `
        <div class="timer-carousel-nav-wrap">
            ${navPrev}
            <div class="timer-carousel" id="timerCarousel">
                ${activeTimers
                    .map((t) => {
                        const done = t.remaining === 0;
                        const toggleFn = t.running
                            ? `pauseTimer(${t.id})`
                            : `startTimer(${t.id})`;
                        const toggleIcon = t.running
                            ? '<i class="fa-solid fa-pause"></i>'
                            : '<i class="fa-solid fa-play"></i>';
                        return `<div class="timer-card${done ? ' timer-done' : ''}" data-timer-id="${t.id}">
                        <div class="timer-card-label">${esc(t.label)}</div>
                        ${t.sublabel ? `<div class="timer-card-sublabel">${esc(t.sublabel)}</div>` : ''}
                        <div class="timer-card-display">${done ? 'Done' : formatTime(t.remaining)}</div>
                        <div class="timer-card-controls">
                            ${!done ? `<button class="timer-toggle-btn" onclick="${toggleFn}" aria-label="${t.running ? 'Pause' : 'Start'}">${toggleIcon}</button>` : ''}
                            <button onclick="resetTimer(${t.id})" aria-label="Reset"><i class="fa-solid fa-rotate-right"></i></button>
                        </div>
                    </div>`;
                    })
                    .join('')}
            </div>
            ${navNext}
        </div>
        ${
            hasMultiple
                ? `<div class="timer-dots" id="timerDots">
            ${activeTimers.map((_, i) => `<div class="timer-dot${i === timerCarouselIndex ? ' active' : ''}"></div>`).join('')}
        </div>`
                : ''
        }
    `;
}

function attachCarouselScroll() {
    const carousel = document.getElementById('timerCarousel');
    if (!carousel) return;
    carousel.addEventListener(
        'scroll',
        () => {
            const idx = Math.round(carousel.scrollLeft / carousel.clientWidth);
            if (idx !== timerCarouselIndex) {
                timerCarouselIndex = idx;
                document
                    .querySelectorAll('.timer-dot')
                    .forEach((d, i) => d.classList.toggle('active', i === idx));
            }
        },
        { passive: true },
    );
}

function renderTimers() {
    const listEl = document.getElementById('timersList');
    const hintEl = document.getElementById('timerEmptyHint');
    if (!listEl) return;
    if (!activeTimers.length) {
        if (hintEl) hintEl.style.display = '';
        listEl.innerHTML = '';
        // Reset tab label
        const btn = document.getElementById('otab-timers');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-stopwatch"></i>';
        return;
    }
    if (hintEl) hintEl.style.display = 'none';

    // Update timers tab label
    const timerTabBtn = document.getElementById('otab-timers');
    if (timerTabBtn) {
        const running = activeTimers.find((t) => t.running);
        timerTabBtn.innerHTML = running
            ? `<i class="fa-solid fa-stopwatch"></i><span style="font-size:0.6rem;font-weight:700;letter-spacing:0.04em;margin-top:0.1rem">${formatTime(running.remaining)}</span>`
            : '<i class="fa-solid fa-stopwatch"></i>';
    }

    // Clamp carousel index
    timerCarouselIndex = Math.max(
        0,
        Math.min(timerCarouselIndex, activeTimers.length - 1),
    );

    // In-place update if carousel already has the right cards — preserves swipe state
    const existingCarousel = document.getElementById('timerCarousel');
    if (
        existingCarousel &&
        existingCarousel.children.length === activeTimers.length
    ) {
        activeTimers.forEach((t, i) => {
            const card = existingCarousel.children[i];
            if (!card) return;
            const done = t.remaining === 0;
            card.classList.toggle('timer-done', done);
            const disp = card.querySelector('.timer-card-display');
            if (disp)
                disp.textContent = done ? 'Done' : formatTime(t.remaining);
            const controls = card.querySelector('.timer-card-controls');
            if (controls) {
                const toggleBtn = controls.querySelector('.timer-toggle-btn');
                if (done) {
                    if (toggleBtn) toggleBtn.remove();
                } else if (toggleBtn) {
                    toggleBtn.setAttribute(
                        'onclick',
                        t.running
                            ? `pauseTimer(${t.id})`
                            : `startTimer(${t.id})`,
                    );
                    toggleBtn.setAttribute(
                        'aria-label',
                        t.running ? 'Pause' : 'Start',
                    );
                    toggleBtn.innerHTML = t.running
                        ? '<i class="fa-solid fa-pause"></i>'
                        : '<i class="fa-solid fa-play"></i>';
                }
            }
        });
        return;
    }

    // Full rebuild (first render or timer count changed)
    listEl.innerHTML = buildCarouselHTML();
    requestAnimationFrame(() => {
        const carousel = document.getElementById('timerCarousel');
        if (!carousel) return;
        const card = carousel.children[timerCarouselIndex];
        if (card)
            card.scrollIntoView({
                block: 'nearest',
                inline: 'center',
                behavior: 'instant',
            });
        attachCarouselScroll();
    });
}

function showView(view) {
    const isNew = view === 'new';
    const isDash = view === 'dash';
    newViewEl.classList.toggle('hidden', !isNew);
    dashViewEl.classList.toggle('hidden', !isDash);
    recipeLayoutEl.classList.toggle('hidden', isDash || isNew);
    document.body.classList.toggle('new-view', isNew);
    document.body.classList.toggle('dash-view', isDash);
    const panel = document.getElementById('ingPanel');
    if (isNew || isDash) {
        panel.classList.remove('open');
        document.body.classList.remove('ing-open');
        if (isNew) setTimeout(() => urlInput?.focus(), 100);
    } else if (document.getElementById('ingPanelBody')?.children.length > 0) {
        panel.style.transition = 'none';
        if (appScroll) appScroll.style.transition = 'none';
        panel.classList.add('open');
        document.body.classList.add('ing-open');
        requestAnimationFrame(() => {
            panel.style.transition = '';
            if (appScroll) appScroll.style.transition = '';
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
                const date = new Date(item.savedAt).toLocaleDateString(
                    undefined,
                    { month: 'short', day: 'numeric', year: 'numeric' },
                );
                return `<button class="dash-card" onclick="loadFile('${esc(item.filename)}')">
                    <span class="dash-card-title">${esc(item.title)}</span>
                    <span class="dash-card-meta">${esc(date)}</span>
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

// ── Scrape queue ──────────────────────────────
const scrapeQueue = []; // { url, el }
let queueRunning = false;
const queueListEl = document.getElementById('scrapeQueue');

window.addEventListener('beforeunload', (e) => {
    if (queueRunning || scrapeQueue.length > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});

function queueAdd(url) {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.dataset.state = 'pending';
    li.innerHTML = `<span class="queue-item-url" title="${esc(url)}">${esc(url)}</span><span class="queue-item-state">Pending</span>`;
    queueListEl.appendChild(li);
    scrapeQueue.push({ url, el: li });
    if (!queueRunning) queueProcess();
}

async function queueProcess() {
    queueRunning = true;
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
                body: JSON.stringify({ url: item.url }),
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
            // Silently cache the recipe but stay on the add page
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
    setStatus('');
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;
    urlInput.value = '';
    urlInput.focus();
    queueAdd(url);
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
                            ${renderStepTiming(s.stepNumber, s.timingInterval)}
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
        if (appScroll) appScroll.style.transition = 'none';
        panel.classList.add('open');
        document.body.classList.add('ing-open');
        requestAnimationFrame(() => {
            panel.style.transition = '';
            if (appScroll) appScroll.style.transition = '';
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
}

function closeGuide() {
    document.getElementById('guideBackdrop').classList.remove('open');
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

function renderStepTiming(stepNum, interval) {
    if (!interval) return '';
    const secs = parseTimingToSeconds(interval);
    const btn = secs
        ? ` <button class="timer-start-btn" onclick="tapTimerBtn(${stepNum})" aria-label="Start timer"><i class="fa-solid fa-stopwatch"></i></button>`
        : '';
    return `<span class="step-timing">${esc(interval)}${btn}</span>`;
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
    const servingsEl = document.getElementById('servingsSection');
    if (!headEl || !bodyEl) return;
    originalServings = parseServingsNum(r.servings);
    currentServings = originalServings;

    // Servings tab content
    if (servingsEl) {
        const count = originalServings ?? 1;
        servingsEl.innerHTML = `<div class="servings-card">
            <div class="servings-card-label">Servings</div>
            <div class="servings-card-display" id="servingsCount">${count}</div>
            <div class="servings-card-unit">people</div>
            <div class="servings-card-controls">
                <button onclick="changeServings(-1)" aria-label="Fewer">−</button>
                <button onclick="changeServings(1)" aria-label="More">+</button>
            </div>
            ${originalServings ? '<p class="servings-card-hint">Ingredient quantities scale automatically.</p>' : '<p class="servings-card-hint">No serving info for this recipe.</p>'}
        </div>`;
    }

    // Ingredients head: guide + unit toggle
    const headContent = [
        hasHints
            ? '<button class="guide-btn" onclick="openGuide()" style="display:block;margin-bottom:0.75rem">Guide</button>'
            : '',
        hasConversions
            ? `<div class="unit-toggle">
            <button id="btnOriginalPanel" class="active" onclick="setUnits('original')">Imperial</button>
            <button id="btnConvertedPanel" onclick="setUnits('converted')">Metric</button>
        </div>
        <p class="unit-toggle-note">Weights &amp; temperatures only</p>`
            : '',
    ].join('');
    headEl.innerHTML = headContent;
    headEl.style.display = headContent.trim() ? '' : 'none';

    bodyEl.innerHTML = renderIngredientGroupsScaled(r.ingredientGroups, 1);

    // Pre-load timers for all timed steps
    initTimers(r.steps);
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
