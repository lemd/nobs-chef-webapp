import type { Recipe, RecipeBook, RecipeListItem } from '../types/index.ts'

const BOOKS_PREFIX = 'nobs:books:'
const LIST_PREFIX = 'nobs:list:'

let activeUserId: string | null = null
let books: RecipeBook[] | null = null
const recipeLists = new Map<number, RecipeListItem[]>()
const recipes = new Map<string, Recipe>()

function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeSession(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota exceeded or private mode — memory cache still works
  }
}

function removeSession(prefix: string): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(prefix)) keys.push(key)
    }
    keys.forEach((k) => sessionStorage.removeItem(k))
  } catch {
    // ignore
  }
}

function listKey(userId: string, bookId: number): string {
  return `${LIST_PREFIX}${userId}:${bookId}`
}

function ensureUser(userId: string): void {
  if (activeUserId === userId) return
  activeUserId = userId
  books = readSession<RecipeBook[]>(`${BOOKS_PREFIX}${userId}`)
  recipeLists.clear()
  recipes.clear()
}

export function clearCache(): void {
  activeUserId = null
  books = null
  recipeLists.clear()
  recipes.clear()
  removeSession(BOOKS_PREFIX)
  removeSession(LIST_PREFIX)
}

export function getBooks(userId: string): RecipeBook[] | null {
  ensureUser(userId)
  return books
}

export function setBooks(userId: string, list: RecipeBook[]): void {
  ensureUser(userId)
  books = list
  writeSession(`${BOOKS_PREFIX}${userId}`, list)
}

export function invalidateBooks(userId: string): void {
  ensureUser(userId)
  books = null
  sessionStorage.removeItem(`${BOOKS_PREFIX}${userId}`)
}

export function getRecipeList(userId: string, bookId: number): RecipeListItem[] | null {
  ensureUser(userId)
  const mem = recipeLists.get(bookId)
  if (mem) return mem
  const stored = readSession<RecipeListItem[]>(listKey(userId, bookId))
  if (stored) recipeLists.set(bookId, stored)
  return stored
}

export function setRecipeList(userId: string, bookId: number, list: RecipeListItem[]): void {
  ensureUser(userId)
  recipeLists.set(bookId, list)
  writeSession(listKey(userId, bookId), list)
}

export function invalidateRecipeList(userId: string, bookId: number): void {
  ensureUser(userId)
  recipeLists.delete(bookId)
  sessionStorage.removeItem(listKey(userId, bookId))
}

export function getRecipe(filename: string): Recipe | null {
  return recipes.get(filename) ?? null
}

export function setRecipe(filename: string, data: Recipe): void {
  recipes.set(filename, data)
}

export function invalidateRecipe(filename: string): void {
  recipes.delete(filename)
}

export function recipeToListItem(
  filename: string,
  data: Recipe,
  savedAt = new Date().toISOString(),
  forkedFrom: ForkSource | null = data.forkedFrom ?? null,
): RecipeListItem {
  const ingredientNames = (data.ingredientGroups ?? [])
    .flatMap((g) => g.items.map((i) => i.name.toLowerCase()))
    .join(' ')
  return {
    filename,
    title: data.title,
    sourceUrl: data.sourceUrl ?? '',
    savedAt,
    tags: data.tags ?? null,
    ingredientNames,
    forkedFrom,
  }
}

export function upsertRecipeInList(
  userId: string,
  bookId: number,
  item: RecipeListItem,
): RecipeListItem[] {
  const existing = getRecipeList(userId, bookId) ?? []
  const next = [item, ...existing.filter((r) => r.filename !== item.filename)]
  setRecipeList(userId, bookId, next)
  return next
}

export function removeRecipeFromList(
  userId: string,
  bookId: number,
  filename: string,
): RecipeListItem[] {
  const existing = getRecipeList(userId, bookId) ?? []
  const next = existing.filter((r) => r.filename !== filename)
  setRecipeList(userId, bookId, next)
  invalidateRecipe(filename)
  return next
}
