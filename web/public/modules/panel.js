import { esc, parseServingsNum, scaleQty } from './utils.js';
import { state } from './state.js';
import { initTimers } from './timers.js';

export function updateServingsTab() {
    const btn = document.getElementById('otab-servings');
    if (!btn) return;
    const count = state.currentServings ?? state.originalServings;
    if (count != null) {
        btn.innerHTML = `<i class="fa-solid fa-users"></i><span class="tab-badge">${count}</span>`;
    } else {
        btn.innerHTML = '<i class="fa-solid fa-users"></i>';
    }
}

export function setUnits(mode) {
    state.currentUnits = mode;
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

export function openGuide() {
    if (!state.currentRecipe) return;
    const body = document.getElementById('guideModalBody');
    body.innerHTML = renderGuideGroups(state.currentRecipe.ingredientGroups);
    document.getElementById('guideBackdrop').classList.add('open');
}

export function closeGuide() {
    document.getElementById('guideBackdrop').classList.remove('open');
}

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

export function renderIngredientGroupsScaled(groups, factor) {
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

export function changeServings(delta) {
    if (!state.currentServings || !state.originalServings) return;
    const next = Math.max(1, state.currentServings + delta);
    if (next === state.currentServings) return;
    state.currentServings = next;
    updateServingsTab();
    const factor = state.currentServings / state.originalServings;
    const scEl = document.getElementById('servingsCount');
    if (scEl) scEl.textContent = state.currentServings;
    const bodyEl = document.getElementById('ingPanelBody');
    if (bodyEl) {
        bodyEl.innerHTML = renderIngredientGroupsScaled(
            state.currentRecipe.ingredientGroups,
            factor,
        );
        document
            .querySelectorAll('#ingPanelBody .ing-qty-original')
            .forEach((el) => {
                el.style.display =
                    state.currentUnits === 'original' ? '' : 'none';
            });
        document
            .querySelectorAll('#ingPanelBody .ing-qty-converted')
            .forEach((el) => {
                el.style.display =
                    state.currentUnits === 'converted' ? '' : 'none';
            });
    }
}

export function populateIngPanel(r, hasConversions, hasHints) {
    const headEl = document.getElementById('ingPanelHead');
    const bodyEl = document.getElementById('ingPanelBody');
    const servingsEl = document.getElementById('servingsSection');
    if (!headEl || !bodyEl) return;
    state.originalServings = parseServingsNum(r.servings);
    state.currentServings = state.originalServings;
    updateServingsTab();

    if (servingsEl) {
        const count = state.originalServings ?? 1;
        servingsEl.innerHTML = `<div class="servings-card">
            <div class="servings-card-label">Servings</div>
            <div class="servings-card-display" id="servingsCount">${count}</div>
            <div class="servings-card-unit">people</div>
            <div class="servings-card-controls">
                <button onclick="changeServings(-1)" aria-label="Fewer">−</button>
                <button onclick="changeServings(1)" aria-label="More">+</button>
            </div>
            ${state.originalServings ? '<p class="servings-card-hint">Ingredient quantities scale automatically.</p>' : '<p class="servings-card-hint">No serving info for this recipe.</p>'}
        </div>`;
    }

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
    initTimers(r.steps);
}

Object.assign(window, { setUnits, openGuide, closeGuide, changeServings });
