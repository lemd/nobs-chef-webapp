import type { RecipeTags } from '../types/index.ts'

export const MEAL_TYPE_OPTIONS = [
  'salad', 'soup', 'pasta', 'rice', 'noodles', 'pizza', 'bread', 'sandwich',
  'burger', 'taco', 'curry', 'stew', 'roast', 'steak', 'chicken', 'fish',
  'seafood', 'eggs', 'breakfast', 'dessert', 'cake', 'cookies', 'snack',
  'side dish', 'sauce', 'dip', 'drink',
] as const

export const DIETARY_OPTIONS = [
  'vegetarian', 'vegan', 'pescatarian', 'gluten-free', 'dairy-free',
  'nut-free', 'low-carb', 'keto',
] as const

export const SEASON_OPTIONS = [
  'spring', 'summer', 'autumn', 'winter', 'all year',
] as const

export function normalizeTagsForEdit(tags: RecipeTags | null | undefined): RecipeTags {
  return {
    mealType: tags?.mealType ?? null,
    dietary: [...(tags?.dietary ?? [])],
    season: [...(tags?.season ?? [])],
    timeOfDay: [...(tags?.timeOfDay ?? [])],
  }
}

export function cleanTags(tags: RecipeTags | null | undefined): RecipeTags | null {
  if (!tags) return null
  const cleaned: RecipeTags = {}
  const mealType = tags.mealType?.trim()
  if (mealType) cleaned.mealType = mealType
  const dietary = tags.dietary?.filter(Boolean) ?? []
  if (dietary.length) cleaned.dietary = dietary
  const season = tags.season?.filter(Boolean) ?? []
  if (season.length) cleaned.season = season
  const timeOfDay = tags.timeOfDay?.filter(Boolean) ?? []
  if (timeOfDay.length) cleaned.timeOfDay = timeOfDay as NonNullable<RecipeTags['timeOfDay']>
  return Object.keys(cleaned).length ? cleaned : null
}

export function toggleTagInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}
