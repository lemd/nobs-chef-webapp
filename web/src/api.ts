import { getAccessToken } from './composables/useAuth.ts'
import type { Recipe, RecipeBook, RecipeListItem, InviteInfo, InviteResult } from './types/index.ts'

export const API_BASE = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : 'https://vcsuynfbykvncenmhjfh.supabase.co/functions/v1'

function getAuthHeader(): string {
  const token = getAccessToken()
  if (!token) throw new Error('Not signed in.')
  return `Bearer ${token}`
}

export async function fetchRecipes(): Promise<RecipeListItem[]> {
  const res = await fetch(`${API_BASE}/recipes`, {
    headers: { Authorization: getAuthHeader() },
  }).catch(() => null)
  if (!res || !res.ok) return []
  return res.json()
}

export async function fetchRecipe(filename: string): Promise<Recipe> {
  const res = await fetch(
    `${API_BASE}/recipe?file=${encodeURIComponent(filename)}`,
    { headers: { Authorization: getAuthHeader() } },
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to load recipe')
  return data
}

export async function scrapeRecipe({
  url,
  text,
  force = false,
  bookId = null,
}: {
  url?: string
  text?: string
  force?: boolean
  bookId?: number | null
}): Promise<Recipe & { _hash: string }> {
  const body: Record<string, unknown> = text ? { text } : { url, force }
  if (bookId) body.book_id = bookId
  const res = await fetch(`${API_BASE}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Unknown error')
  return data
}

// ── Book API ──────────────────────────────────────────────────────────────────

export async function fetchBooks(): Promise<RecipeBook[]> {
  const res = await fetch(`${API_BASE}/book`, {
    headers: { Authorization: getAuthHeader() },
  })
  if (!res.ok) return []
  return res.json()
}

export async function createBook(name: string): Promise<RecipeBook> {
  const res = await fetch(`${API_BASE}/book`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({ name }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to create book')
  return data
}

export async function createInvite(bookId: number): Promise<{ token: string; url: string }> {
  const res = await fetch(`${API_BASE}/invite/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({ book_id: bookId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to create invite')
  return data
}

export async function fetchInviteInfo(token: string): Promise<InviteInfo> {
  const res = await fetch(`${API_BASE}/invite/info?token=${encodeURIComponent(token)}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Invalid invite')
  return data
}

export async function acceptInvite(token: string): Promise<InviteResult> {
  const res = await fetch(`${API_BASE}/invite/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({ token }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to accept invite')
  return data
}
