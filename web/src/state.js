import { reactive } from 'vue';

export const state = reactive({
    // Auth — will be populated in Phase 5 (Google OAuth)
    session: null,

    // Current recipe context
    currentRecipe: null,
    currentSourceUrl: null,
    currentUnits: 'original',

    // Ingredient panel
    panelOpen: false,
    currentPanelTab: 'ingredients',

    // Dashboard
    allRecipes: [],
    activeFile: null,
    activeFilters: {
        mealType: new Set(),
        dietary: new Set(),
        season: new Set(),
    },
    activeIngredients: new Set(),

    // UI
    drawerOpen: false,
    guideOpen: false,
    loading: false,
});
