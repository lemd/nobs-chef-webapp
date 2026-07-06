import { watch } from 'vue'
import { state } from '../state.ts'

function storageKey(bookId: number): string {
  return `nobs:pinned:${bookId}`
}

export function loadPinnedForBook(bookId: number): void {
  try {
    const raw = localStorage.getItem(storageKey(bookId))
    state.pinnedFilenames = new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    state.pinnedFilenames = new Set()
  }
  applyPinnedFlags()
}

export function applyPinnedFlags(): void {
  for (const item of state.allRecipes) {
    item.pinned = state.pinnedFilenames.has(item.filename)
  }
}

export function isPinned(filename: string | null | undefined): boolean {
  if (!filename) return false
  return state.pinnedFilenames.has(filename)
}

export function togglePin(filename: string): boolean {
  const bookId = state.currentBook?.id
  if (!bookId) return isPinned(filename)

  const next = new Set(state.pinnedFilenames)
  if (next.has(filename)) next.delete(filename)
  else next.add(filename)
  state.pinnedFilenames = next
  localStorage.setItem(storageKey(bookId), JSON.stringify([...next]))
  applyPinnedFlags()
  return next.has(filename)
}

export function usePinnedRecipes() {
  watch(
    () => state.currentBook?.id,
    (id) => {
      if (id) loadPinnedForBook(id)
      else state.pinnedFilenames = new Set()
    },
    { immediate: true },
  )

  return { isPinned, togglePin }
}
