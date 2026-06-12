import { esc, formatTime, parseTimingToSeconds } from './utils.js';
import { state } from './state.js';
import { switchPanelTab } from './tabs.js';

export function initTimers(steps) {
    state.activeTimers.forEach((t) => clearInterval(t.interval));
    state.activeTimers.length = 0;
    state.timerIdCounter = 0;
    state.timerCarouselIndex = 0;
    (steps ?? []).forEach((s) => {
        const secs = parseTimingToSeconds(s.timingInterval);
        if (!secs) return;
        state.activeTimers.push({
            id: ++state.timerIdCounter,
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

export function tapTimerBtn(stepNum) {
    const idx = state.activeTimers.findIndex((t) => t.stepNum === stepNum);
    if (idx === -1) return;
    state.timerCarouselIndex = idx;
    const t = state.activeTimers[idx];
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

export function carouselNav(dir) {
    const n = state.activeTimers.length;
    if (n < 2) return;
    state.timerCarouselIndex = Math.max(
        0,
        Math.min(state.timerCarouselIndex + dir, n - 1),
    );
    const carousel = document.getElementById('timerCarousel');
    if (carousel)
        carousel.scrollTo({
            left: state.timerCarouselIndex * carousel.clientWidth,
            behavior: 'smooth',
        });
    document
        .querySelectorAll('.timer-dot')
        .forEach((d, i) =>
            d.classList.toggle('active', i === state.timerCarouselIndex),
        );
}

export function startTimer(id) {
    const t = state.activeTimers.find((t) => t.id === id);
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

export function pauseTimer(id) {
    const t = state.activeTimers.find((t) => t.id === id);
    if (!t || !t.running) return;
    t.running = false;
    clearInterval(t.interval);
    t.interval = null;
    renderTimers();
}

export function resetTimer(id) {
    const t = state.activeTimers.find((t) => t.id === id);
    if (!t) return;
    clearInterval(t.interval);
    t.interval = null;
    t.running = false;
    t.remaining = t.total;
    renderTimers();
}

export function removeTimer(id) {
    const idx = state.activeTimers.findIndex((t) => t.id === id);
    if (idx === -1) return;
    clearInterval(state.activeTimers[idx].interval);
    state.activeTimers.splice(idx, 1);
    renderTimers();
}

function buildCarouselHTML() {
    const { activeTimers, timerCarouselIndex } = state;
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
            if (idx !== state.timerCarouselIndex) {
                state.timerCarouselIndex = idx;
                document
                    .querySelectorAll('.timer-dot')
                    .forEach((d, i) => d.classList.toggle('active', i === idx));
            }
        },
        { passive: true },
    );
}

export function renderTimers() {
    const { activeTimers, timerCarouselIndex } = state;
    const listEl = document.getElementById('timersList');
    const hintEl = document.getElementById('timerEmptyHint');
    if (!listEl) return;
    if (!activeTimers.length) {
        if (hintEl) hintEl.style.display = '';
        listEl.innerHTML = '';
        const btn = document.getElementById('otab-timers');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-stopwatch"></i>';
        return;
    }
    if (hintEl) hintEl.style.display = 'none';

    const timerTabBtn = document.getElementById('otab-timers');
    if (timerTabBtn) {
        const running = activeTimers.find((t) => t.running);
        const timeStr = running ? formatTime(running.remaining) : '0:00';
        timerTabBtn.innerHTML = `<i class="fa-solid fa-stopwatch"></i><span class="tab-badge">${activeTimers.length}</span><span class="tab-time${running ? ' tab-time--running' : ''}">${timeStr}</span>`;
    }

    state.timerCarouselIndex = Math.max(
        0,
        Math.min(timerCarouselIndex, activeTimers.length - 1),
    );

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

    listEl.innerHTML = buildCarouselHTML();
    requestAnimationFrame(() => {
        const carousel = document.getElementById('timerCarousel');
        if (!carousel) return;
        const card = carousel.children[state.timerCarouselIndex];
        if (card)
            card.scrollIntoView({
                block: 'nearest',
                inline: 'center',
                behavior: 'instant',
            });
        attachCarouselScroll();
    });
}

Object.assign(window, {
    tapTimerBtn,
    carouselNav,
    startTimer,
    pauseTimer,
    resetTimer,
    removeTimer,
});
