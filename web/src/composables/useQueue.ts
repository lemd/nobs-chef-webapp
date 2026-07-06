import { reactive } from 'vue'
import { scrapeRecipe } from '../api.ts'
import { state as appState } from '../state.ts'
import { auth } from './useAuth.ts'
import {
  recipeToListItem,
  setRecipe,
  upsertRecipeInList,
} from './dataCache.ts'
import { applyCachedRecipeList } from './useRecipeList.ts'
import type { Recipe } from '../types/index.ts'

interface QueueItem {
  url?: string
  text?: string
  label: string
  qstate: 'pending' | 'processing' | 'done' | 'error'
  error: string | null
  result: { data: Recipe; hash: string } | null
}

export const queue = reactive<{ items: QueueItem[]; running: boolean }>({
  items: [],
  running: false,
})

export function useQueue() {
  function addToQueue(item: { url?: string; text?: string }): void {
    queue.items.push({
      ...item,
      label: item.url ?? 'Pasted text',
      qstate: 'pending',
      error: null,
      result: null,
    })
    if (!queue.running) _process()
  }

  async function _process(): Promise<void> {
    queue.running = true
    appState.loading = true
    while (queue.items.some((i) => i.qstate === 'pending')) {
      const item = queue.items.find((i) => i.qstate === 'pending')
      if (!item) break
      item.qstate = 'processing'
      try {
        const data = await scrapeRecipe({
          ...(item.url ? { url: item.url } : { text: item.text }),
          bookId: appState.currentBook?.id ?? null,
        })
        const hash = data._hash
        delete (data as Partial<typeof data>)._hash
        const filename = `${hash}.json`
        setRecipe(filename, data)
        const bookId = appState.currentBook?.id
        const userId = auth.user?.id
        if (userId && bookId) {
          upsertRecipeInList(
            userId,
            bookId,
            recipeToListItem(filename, data),
          )
          applyCachedRecipeList(bookId)
        }
        item.qstate = 'done'
        item.result = { data, hash }
        window.dispatchEvent(new CustomEvent('recipe-scraped', { detail: { data, hash } }))
      } catch (err) {
        item.qstate = 'error'
        item.error = err instanceof Error ? err.message : String(err)
      }
    }
    queue.running = false
    appState.loading = false
  }

  return { queue, addToQueue }
}
