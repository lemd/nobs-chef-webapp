import type { RecipeBook } from '../types/index.ts'

export function getOwnedBook(
  books: RecipeBook[],
  userId: string | undefined,
): RecipeBook | null {
  if (!userId) return null
  return books
    .filter((b) => b.owner_id === userId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null
}

export function isPublicBook(book: RecipeBook | null | undefined): boolean {
  return book?.visibility === 'public'
}
