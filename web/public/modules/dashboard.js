import { esc } from './utils.js';
import { state, els, API_BASE } from './state.js';
import { setStatus } from './ui.js';
import { showView, closeDrawer } from './views.js';
import { renderRecipe } from './recipe.js';

export function toggleFilter(type, value) {
    const set = state.activeFilters[type];
    if (set.has(value)) {
        set.delete(value);
    } else {
        set.add(value);
    }
    const btn = document.querySelector(`[data-filter="${type}:${value}"]`);
    if (btn) btn.classList.toggle('active', set.has(value));
    renderDashGrid();
}

export function onIngredientKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    const val = e.target.value.trim().toLowerCase();
    if (!val) return;
    addIngredientChip(val);
    e.target.value = '';
}

function addIngredientChip(val) {
    if (state.activeIngredients.has(val)) return;
    state.activeIngredients.add(val);
    const chip = document.createElement('button');
    chip.className = 'ingredient-chip';
    chip.innerHTML = `${esc(val)} <span aria-hidden="true">×</span>`;
    chip.onclick = () => {
        state.activeIngredients.delete(val);
        chip.remove();
        renderDashGrid();
    };
    document.getElementById('ingredientChips').appendChild(chip);
    renderDashGrid();
}

export function buildMealTypeFilters(recipes) {
    const el = document.getElementById('mealTypeFilters');
    if (!el) return;
    const types = [
        ...new Set(recipes.map((r) => r.tags?.mealType).filter(Boolean)),
    ].sort();
    el.innerHTML = types
        .map(
            (t) =>
                `<button onclick="toggleFilter('mealType','${esc(t)}')" data-filter="mealType:${esc(t)}" class="filter-chip${state.activeFilters.mealType.has(t) ? ' active' : ''}">${esc(t)}</button>`,
        )
        .join('');
}

function recipeMatchesFilters(item) {
    const tags = item.tags ?? {};
    if (
        state.activeFilters.mealType.size > 0 &&
        !state.activeFilters.mealType.has(tags.mealType)
    )
        return false;
    if (state.activeFilters.dietary.size > 0) {
        const d = tags.dietary ?? [];
        if (![...state.activeFilters.dietary].every((v) => d.includes(v)))
            return false;
    }
    if (state.activeFilters.season.size > 0) {
        const s = tags.season ?? [];
        const isAllYear = s.includes('all year');
        if (
            !isAllYear &&
            ![...state.activeFilters.season].some((v) => s.includes(v))
        )
            return false;
    }
    const typed =
        document
            .getElementById('ingredientSearch')
            ?.value.trim()
            .toLowerCase() ?? '';
    if (state.activeIngredients.size > 0 || typed) {
        const haystack =
            (item._ingredientNames ?? '').toLowerCase() +
            ' ' +
            item.title.toLowerCase();
        const allTerms = [
            ...state.activeIngredients,
            ...(typed ? [typed] : []),
        ];
        if (!allTerms.every((v) => haystack.includes(v))) return false;
    }
    return true;
}

function hasActiveFilters() {
    return (
        state.activeFilters.mealType.size > 0 ||
        state.activeFilters.dietary.size > 0 ||
        state.activeFilters.season.size > 0 ||
        state.activeIngredients.size > 0 ||
        !!document.getElementById('ingredientSearch')?.value.trim()
    );
}

export function clearAllFilters() {
    state.activeFilters.mealType.clear();
    state.activeFilters.dietary.clear();
    state.activeFilters.season.clear();
    state.activeIngredients.clear();
    const search = document.getElementById('ingredientSearch');
    if (search) search.value = '';
    document.getElementById('ingredientChips').innerHTML = '';
    document
        .querySelectorAll('.filter-chip.active')
        .forEach((b) => b.classList.remove('active'));
    renderDashGrid();
}

export function renderDashGrid() {
    if (!els.dashGridEl) return;
    const filtered = state.allRecipes.filter(recipeMatchesFilters);
    const countEl = document.getElementById('dashCount');
    if (countEl) {
        countEl.textContent =
            filtered.length === state.allRecipes.length
                ? `${state.allRecipes.length} recipe${state.allRecipes.length !== 1 ? 's' : ''}`
                : `${filtered.length} of ${state.allRecipes.length}`;
    }
    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) clearBtn.classList.toggle('hidden', !hasActiveFilters());
    if (filtered.length === 0) {
        els.dashGridEl.innerHTML = `<p class="dash-no-results">No recipes match the current filters.</p>`;
        return;
    }
    els.dashGridEl.innerHTML = filtered
        .map((item) => {
            const date = new Date(item.savedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
            const mealType = item.tags?.mealType
                ? `<span class="dash-card-tag">${esc(item.tags.mealType)}</span>`
                : '';
            return `<button class="dash-card" onclick="loadFile('${esc(item.filename)}')">
            <span class="dash-card-title">${esc(item.title)}</span>
            <span class="dash-card-meta">${mealType}${esc(date)}</span>
        </button>`;
        })
        .join('');
}

export async function loadHistory() {
    const res = await fetch(`${API_BASE}/recipes`).catch(() => null);
    if (!res || !res.ok) return;
    const list = await res.json();
    state.allRecipes = list.map((item) => ({
        ...item,
        _ingredientNames: item.ingredientNames ?? '',
    }));
    if (list.length) {
        els.historyEl.innerHTML = list
            .map(
                (item) => `
        <li>
            <button onclick="loadFile('${esc(item.filename)}')"
                    class="${item.filename === state.activeFile ? 'active' : ''}"
                    id="hist-${esc(item.filename)}">
                ${esc(item.title)}
                <span class="hist-date">${new Date(item.savedAt).toLocaleDateString()}</span>
            </button>
        </li>`,
            )
            .join('');
    }
    buildMealTypeFilters(list);
    renderDashGrid();
}

export async function loadFile(filename) {
    state.activeFile = filename;
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
    const slug = filename.replace(/\.json$/, '');
    if (window.location.pathname !== `/r/${slug}`) {
        history.pushState({ slug }, '', `/r/${slug}`);
    }
}

Object.assign(window, {
    toggleFilter,
    clearAllFilters,
    loadFile,
    renderDashGrid,
    onIngredientKeydown,
});
