import { esc, parseTimingToSeconds } from './utils.js';
import { state, els } from './state.js';
import { populateIngPanel } from './panel.js';

export function renderRecipe(r) {
    els.emptyEl.classList.add('hidden');
    els.recipeEl.classList.remove('hidden');
    state.currentSourceUrl = r.sourceUrl ?? null;
    state.currentRecipe = r;

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

    els.recipeEl.innerHTML = `
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
    const panel = document.getElementById('ingPanel');
    if (!panel.classList.contains('open')) {
        panel.classList.add('open');
        document.body.classList.add('ing-open');
    }
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
