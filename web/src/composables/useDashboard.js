import { computed } from 'vue';
import { state } from '../state.js';
import { fetchRecipes } from '../api.js';

export function useDashboard() {
    async function loadRecipes() {
        const list = await fetchRecipes();
        state.allRecipes = list.map((item) => ({
            ...item,
            _ingredientNames: item.ingredientNames ?? '',
        }));
    }

    function toggleFilter(type, value) {
        const set = state.activeFilters[type];
        if (set.has(value)) set.delete(value);
        else set.add(value);
    }

    function addIngredientChip(val) {
        state.activeIngredients.add(val.trim().toLowerCase());
    }

    function removeIngredientChip(val) {
        state.activeIngredients.delete(val);
    }

    function clearAllFilters(searchText) {
        state.activeFilters.mealType.clear();
        state.activeFilters.dietary.clear();
        state.activeFilters.season.clear();
        state.activeIngredients.clear();
        if (searchText) searchText.value = '';
    }

    function hasActiveFilters(searchText = '') {
        return (
            state.activeFilters.mealType.size > 0 ||
            state.activeFilters.dietary.size > 0 ||
            state.activeFilters.season.size > 0 ||
            state.activeIngredients.size > 0 ||
            !!searchText.trim()
        );
    }

    function recipeMatchesFilters(item, searchText = '') {
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
            if (
                !s.includes('all year') &&
                ![...state.activeFilters.season].some((v) => s.includes(v))
            )
                return false;
        }
        const typed = searchText.trim().toLowerCase();
        if (state.activeIngredients.size > 0 || typed) {
            const haystack =
                (item._ingredientNames ?? '').toLowerCase() +
                ' ' +
                item.title.toLowerCase();
            const terms = [
                ...state.activeIngredients,
                ...(typed ? [typed] : []),
            ];
            if (!terms.every((v) => haystack.includes(v))) return false;
        }
        return true;
    }

    const mealTypes = computed(() =>
        [
            ...new Set(
                state.allRecipes.map((r) => r.tags?.mealType).filter(Boolean),
            ),
        ].sort(),
    );

    return {
        loadRecipes,
        toggleFilter,
        addIngredientChip,
        removeIngredientChip,
        clearAllFilters,
        hasActiveFilters,
        recipeMatchesFilters,
        mealTypes,
    };
}
