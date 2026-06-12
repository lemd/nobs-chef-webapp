import { computed } from 'vue'
import { state } from '../state.ts'
import { fetchRecipes } from '../api.ts'
import type { RecipeListItem } from '../types/index.ts'

export function useDashboard() {
  async function loadRecipes(): Promise<void> {
    const list: RecipeListItem[] = await fetchRecipes()
    state.allRecipes = list.map((item) => ({
      ...item,
      _ingredientNames: item.ingredientNames ?? '',
    }))
  }

  function toggleFilter(type: 'mealType' | 'dietary' | 'season', value: string): void {
    const set = state.activeFilters[type]
    if (set.has(value)) set.delete(value)
    else set.add(value)
  }

  function addIngredientChip(val: string): void {
    state.activeIngredients.add(val.trim().toLowerCase())
  }

  function removeIngredientChip(val: string): void {
    state.activeIngredients.delete(val)
  }

  function clearAllFilters(searchText?: { value: string }): void {
    state.activeFilters.mealType.clear()
    state.activeFilters.dietary.clear()
    state.activeFilters.season.clear()
    state.activeIngredients.clear()
    if (searchText) searchText.value = ''
  }

  function hasActiveFilters(searchText = ''): boolean {
    return (
      state.activeFilters.mealType.size > 0 ||
      state.activeFilters.dietary.size > 0 ||
      state.activeFilters.season.size > 0 ||
      state.activeIngredients.size > 0 ||
      !!searchText.trim()
    )
  }

  function recipeMatchesFilters(item: RecipeListItem, searchText = ''): boolean {
    const tags = item.tags ?? {}
    if (state.activeFilters.mealType.size > 0 && !state.activeFilters.mealType.has(tags.mealType ?? ''))
      return false
    if (state.activeFilters.dietary.size > 0) {
      const d = tags.dietary ?? []
      if (![...state.activeFilters.dietary].every((v) => d.includes(v))) return false
    }
    if (state.activeFilters.season.size > 0) {
      const s = tags.season ?? []
      if (!s.includes('all year') && ![...state.activeFilters.season].some((v) => s.includes(v)))
        return false
    }
    const typed = searchText.trim().toLowerCase()
    if (state.activeIngredients.size > 0 || typed) {
      const haystack =
        (item._ingredientNames ?? '').toLowerCase() + ' ' + item.title.toLowerCase()
      const terms = [...state.activeIngredients, ...(typed ? [typed] : [])]
      if (!terms.every((v) => haystack.includes(v))) return false
    }
    return true
  }

  const mealTypes = computed(() =>
    [...new Set(state.allRecipes.map((r) => r.tags?.mealType).filter((v): v is string => !!v))].sort(),
  )

  return {
    loadRecipes,
    toggleFilter,
    addIngredientChip,
    removeIngredientChip,
    clearAllFilters,
    hasActiveFilters,
    recipeMatchesFilters,
    mealTypes,
  }
}
