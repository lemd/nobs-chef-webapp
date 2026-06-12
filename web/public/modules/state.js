export const API_BASE = 'https://vcsuynfbykvncenmhjfh.supabase.co/functions/v1';

export function getPersonalSecret() {
    let secret = localStorage.getItem('nobs_secret');
    if (!secret) {
        secret = prompt('Enter access password:');
        if (!secret) throw new Error('Password required.');
        localStorage.setItem('nobs_secret', secret);
    }
    return secret;
}

export function clearPersonalSecret() {
    localStorage.removeItem('nobs_secret');
}

export const els = {
    form: document.getElementById('scrapeForm'),
    urlInput: document.getElementById('urlInput'),
    btn: document.getElementById('scrapeBtn'),
    status: document.getElementById('status'),
    recipeEl: document.getElementById('recipe'),
    emptyEl: document.getElementById('empty'),
    historyEl: document.getElementById('historyList'),
    newViewEl: document.getElementById('newView'),
    recipeLayoutEl: document.getElementById('recipeLayout'),
    dashViewEl: document.getElementById('dashView'),
    dashGridEl: document.getElementById('dashGrid'),
    appScroll: document.getElementById('app-scroll'),
};

export const state = {
    activeFile: null,
    currentSourceUrl: null,
    currentRecipe: null,
    currentUnits: 'original',
    originalServings: null,
    currentServings: null,
    currentPanelTab: 'ingredients',
    timerIdCounter: 0,
    timerCarouselIndex: 0,
    activeTimers: [],
    allRecipes: [],
    activeFilters: {
        mealType: new Set(),
        dietary: new Set(),
        season: new Set(),
    },
    activeIngredients: new Set(),
};
