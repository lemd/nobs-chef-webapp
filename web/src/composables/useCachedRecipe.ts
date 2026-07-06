import { fetchRecipe } from '../api.ts'
import { getRecipe, setRecipe } from './dataCache.ts'
import type { Recipe } from '../types/index.ts'

export async function loadCachedRecipe(filename: string, force = false): Promise<Recipe> {
  if (!force) {
    const cached = getRecipe(filename)
    if (cached) return cached
  }
  const data = await fetchRecipe(filename)
  setRecipe(filename, data)
  return data
}

export function updateCachedRecipe(filename: string, data: Recipe): void {
  setRecipe(filename, data)
}
