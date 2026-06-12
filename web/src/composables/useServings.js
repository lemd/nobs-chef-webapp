import { reactive, computed } from 'vue';
import { parseServingsNum, scaleQty } from '../utils.js';

// Module-level singleton
const servings = reactive({ original: null, current: null });

export function useServings() {
    function initServings(recipe) {
        servings.original = parseServingsNum(recipe.servings);
        servings.current = servings.original;
    }

    function changeServings(delta) {
        if (!servings.current || !servings.original) return;
        servings.current = Math.max(1, servings.current + delta);
    }

    const scaleFactor = computed(() =>
        servings.original && servings.current
            ? servings.current / servings.original
            : 1,
    );

    function scaleIngredientGroups(groups) {
        const factor = scaleFactor.value;
        return (groups ?? []).map((g) => ({
            ...g,
            items: (g.items ?? []).map((i) => ({
                ...i,
                scaledQty: scaleQty(i.quantity, factor),
                // Pre-build the display string so templates stay simple
                scaledQtyUnit: [scaleQty(i.quantity, factor), i.unit]
                    .filter(Boolean)
                    .join(' '),
            })),
        }));
    }

    return {
        servings,
        initServings,
        changeServings,
        scaleFactor,
        scaleIngredientGroups,
    };
}
