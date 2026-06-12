import { reactive } from 'vue'
import type { Recipe, RecipeBook, RecipeListItem, BookMember } from './types/index.ts'

type FilterKey = 'mealType' | 'dietary' | 'season'
type PanelTab = 'ingredients' | 'timers'

export const state = reactive({
  // Auth — populated by useAuth / App.vue on init
  session: null as null | object,

  // Books
  books: [] as RecipeBook[],
  currentBook: null as RecipeBook | null,
  bookMembers: [] as BookMember[],

  // Current recipe context
  currentRecipe: null as Recipe | null,
  currentSourceUrl: null as string | null,
  currentUnits: 'original' as 'original' | 'metric' | 'imperial',

  // Ingredient panel
  panelOpen: false,
  currentPanelTab: 'ingredients' as PanelTab,

  // Dashboard
  allRecipes: [] as RecipeListItem[],
  activeFile: null as string | null,
  activeFilters: {
    mealType: new Set<string>(),
    dietary: new Set<string>(),
    season: new Set<string>(),
  } as Record<FilterKey, Set<string>>,
  activeIngredients: new Set<string>(),

  // UI
  drawerOpen: false,
  guideOpen: false,
  loading: false,
})
