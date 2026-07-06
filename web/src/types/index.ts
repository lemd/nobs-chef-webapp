// ── Shared domain types ────────────────────────────────────────────────────

export interface IngredientItem {
  quantity: string | null
  unit: string | null
  name: string
  notes?: string | null
  hint?: string | null
  convertedQuantity?: string | null
  // Added by useServings
  scaledQty?: string | null
  scaledQtyUnit?: string | null
}

export interface IngredientGroup {
  group: string | null
  items: IngredientItem[]
}

export interface RecipeStep {
  stepNumber: number
  instruction: string
  timingInterval?: string | null
  temperatureConversion?: string | null
  userNote?: string | null
}

export interface RecipeTags {
  mealType?: string | null
  dietary?: string[]
  season?: string[]
  timeOfDay?: ('morning' | 'noon' | 'evening')[]
}

export interface Recipe {
  title: string
  description?: string | null
  sourceUrl?: string | null
  imageUrl?: string | null
  servings?: string | null
  prepTime?: string | null
  cookTime?: string | null
  totalTime?: string | null
  difficulty?: string | null
  ingredientGroups: IngredientGroup[]
  steps: RecipeStep[]
  tags?: RecipeTags | null
  forkedFrom?: ForkSource | null
}

// ── Book / auth types ────────────────────────────────────────────────────────

export type BookVisibility = 'public' | 'private'
export type BookRole = 'owner' | 'member'

export interface ForkSource {
  bookId: number
  bookName: string
  recipeHash: string
  recipeTitle: string
}

export interface RecipeBook {
  id: number
  name: string
  owner_id: string
  created_at: string
  role: BookRole
  joinedAt?: string
  drawing_url?: string | null
  banner_url?: string | null
  visibility?: BookVisibility
}

export interface BookMember {
  userId: string
  role: BookRole
  joinedAt: string
  email: string | null
  name: string | null
  avatarUrl: string | null
}

export interface InviteInfo {
  bookId: number
  bookName: string
  expiresAt: string
}

export interface InviteResult {
  book: RecipeBook
  role: BookRole
}

// ── Dashboard list item ──────────────────────────────────────────────────────

export interface RecipeListItem {
  filename: string
  title: string
  sourceUrl: string
  savedAt: string
  tags?: RecipeTags | null
  ingredientNames: string
  pinned?: boolean
  forkedFrom?: ForkSource | null
  // internal
  _ingredientNames?: string
}
