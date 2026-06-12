import { reactive, computed } from 'vue'
import { parseServingsNum, scaleQty } from '../utils.ts'
import type { Recipe, IngredientGroup } from '../types/index.ts'

const servings = reactive<{ original: number | null; current: number | null }>({
  original: null,
  current: null,
})

export function useServings() {
  function initServings(recipe: Recipe): void {
    servings.original = parseServingsNum(recipe.servings)
    servings.current = servings.original
  }

  function changeServings(delta: number): void {
    if (!servings.current || !servings.original) return
    servings.current = Math.max(1, servings.current + delta)
  }

  const scaleFactor = computed(() =>
    servings.original && servings.current ? servings.current / servings.original : 1,
  )

  function scaleIngredientGroups(groups: IngredientGroup[]): IngredientGroup[] {
    const factor = scaleFactor.value
    return (groups ?? []).map((g) => ({
      ...g,
      items: (g.items ?? []).map((i) => ({
        ...i,
        scaledQty: scaleQty(i.quantity, factor),
        scaledQtyUnit: [scaleQty(i.quantity, factor), i.unit].filter(Boolean).join(' '),
      })),
    }))
  }

  return { servings, initServings, changeServings, scaleFactor, scaleIngredientGroups }
}
