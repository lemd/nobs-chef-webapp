import type { RecipeTags } from '../types/index.ts'

export const TIME_OF_DAY_OPTIONS = [
  { id: 'morning', label: 'Morning', meal: 'Breakfast' },
  { id: 'noon', label: 'Noon', meal: 'Lunch' },
  { id: 'evening', label: 'Evening', meal: 'Dinner' },
] as const

export type TimeOfDayId = (typeof TIME_OF_DAY_OPTIONS)[number]['id']

export function getCurrentTimeOfDay(): TimeOfDayId {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 16) return 'noon'
  return 'evening'
}

export function getTimeOfDayLabel(id: TimeOfDayId): string {
  return TIME_OF_DAY_OPTIONS.find((o) => o.id === id)?.label ?? id
}

export function getTimeOfDayMeal(id: TimeOfDayId): string {
  return TIME_OF_DAY_OPTIONS.find((o) => o.id === id)?.meal ?? id
}

export function getRecipeTimeOfDay(tags: RecipeTags | null | undefined): TimeOfDayId[] {
  const tagged = tags?.timeOfDay ?? []
  if (tagged.length) return tagged as TimeOfDayId[]
  // Legacy fallback before tags were scraped
  if (tags?.mealType === 'breakfast') return ['morning']
  return []
}

export function recipeMatchesTimeOfDay(
  tags: RecipeTags | null | undefined,
  timeId: TimeOfDayId,
): boolean {
  return getRecipeTimeOfDay(tags).includes(timeId)
}

export function isSuggestedForNow(tags: RecipeTags | null | undefined): boolean {
  return recipeMatchesTimeOfDay(tags, getCurrentTimeOfDay())
}
