import { watch } from 'vue'
import { state } from '../state.ts'
import { fetchRecipes } from '../api.ts'
import { auth } from './useAuth.ts'
import { applyPinnedFlags } from './usePinnedRecipes.ts'
import { getRecipeList, setRecipeList } from './dataCache.ts'
import type { RecipeListItem } from '../types/index.ts'

function applyList(bookId: number, list: RecipeListItem[]): void {
  if (state.currentBook?.id !== bookId) return
  state.allRecipes = list.map((item) => ({
    ...item,
    _ingredientNames: item.ingredientNames ?? '',
  }))
  applyPinnedFlags()
  state.recipesLoaded = true
  state.recipesLoading = false
  state.recipesError = null
}

export async function loadRecipesForBook(bookId: number, force = false): Promise<void> {
  const userId = auth.user?.id
  if (!force && userId) {
    const cached = getRecipeList(userId, bookId)
    if (cached) {
      applyList(bookId, cached)
      return
    }
  }

  state.recipesLoading = true
  state.recipesError = null
  try {
    const list: RecipeListItem[] = await fetchRecipes(bookId)
    if (state.currentBook?.id !== bookId) return
    if (userId) setRecipeList(userId, bookId, list)
    applyList(bookId, list)
  } catch (err) {
    if (state.currentBook?.id !== bookId) return
    state.allRecipes = []
    state.recipesError = err instanceof Error ? err.message : 'Failed to load recipes'
    state.recipesLoaded = true
  } finally {
    if (state.currentBook?.id === bookId) {
      state.recipesLoading = false
    }
  }
}

export function applyCachedRecipeList(bookId: number): boolean {
  const userId = auth.user?.id
  if (!userId) return false
  const cached = getRecipeList(userId, bookId)
  if (!cached) return false
  applyList(bookId, cached)
  return true
}

export function useRecipeList() {
  watch(
    () => state.currentBook?.id,
    (bookId) => {
      state.recipesError = null
      if (!bookId) {
        state.allRecipes = []
        state.recipesLoading = false
        state.recipesLoaded = false
        return
      }
      loadRecipesForBook(bookId)
    },
  )
}
