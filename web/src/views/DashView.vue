<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { state } from '../state.ts'
import { fetchRecipe } from '../api.ts'
import { useDashboard } from '../composables/useDashboard.ts'
import BookBanner from '../components/BookBanner.vue'

const router = useRouter()
const {
  loadRecipes, toggleFilter, addIngredientChip, removeIngredientChip,
  clearAllFilters, hasActiveFilters, recipeMatchesFilters, mealTypes,
} = useDashboard()

const searchText = ref('')
const ingredientInput = ref('')

const filteredRecipes = computed(() =>
  state.allRecipes.filter((r) => recipeMatchesFilters(r, searchText.value)),
)
const hasFilters = computed(() => hasActiveFilters(searchText.value))

const DIETARY = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'low-carb']
const SEASONS = ['spring', 'summer', 'autumn', 'winter']

onMounted(loadRecipes)

async function openRecipe(item: { filename: string; title: string; sourceUrl?: string }) {
  if (state.activeFile !== item.filename) {
    state.activeFile = item.filename
    const data = await fetchRecipe(item.filename)
    state.currentRecipe = data
    state.currentSourceUrl = data.sourceUrl ?? null
  }
  const slug = item.filename.replace(/\.json$/, '')
  router.push(`/r/${slug}`)
}

function onIngredientKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' && e.key !== ',') return
  e.preventDefault()
  const val = (ingredientInput.value as unknown as HTMLInputElement).toString().trim().toLowerCase()
  if (!val) return
  addIngredientChip(val)
  ingredientInput.value = ''
}

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' && e.key !== ',') return
  e.preventDefault()
  const val = searchText.value.trim().toLowerCase()
  if (!val) return
  addIngredientChip(val)
  searchText.value = ''
}
</script>

<template>
  <div>
    <BookBanner />

    <div class="max-w-[1080px] mx-auto px-0">
      <!-- Filter bar -->
      <div class="mb-6">
        <!-- Search row -->
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <div class="flex items-center gap-1.5 border-b border-[var(--text)] pb-[3px] min-w-[200px] flex-1 max-w-xs">
            <i class="fa-solid fa-magnifying-glass text-[var(--dim)] text-xs"></i>
            <input
              v-model="searchText"
              type="search"
              placeholder="Search recipes or ingredients…"
              autocomplete="off"
              class="bg-transparent border-0 outline-none text-[0.82rem] font-[var(--font-body)] text-[var(--text)] placeholder-[var(--dim)] w-full"
              @keydown="onSearchKeydown"
            />
          </div>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="chip in [...state.activeIngredients]"
              :key="chip"
              class="ingredient-chip"
              @click="removeIngredientChip(chip)"
            >{{ chip }} ×</button>
          </div>
          <span class="text-[0.72rem] text-[var(--dim)] ml-auto whitespace-nowrap">
            {{ filteredRecipes.length === state.allRecipes.length
              ? `${state.allRecipes.length} recipe${state.allRecipes.length !== 1 ? 's' : ''}`
              : `${filteredRecipes.length} of ${state.allRecipes.length}` }}
          </span>
          <button
            v-if="hasFilters"
            class="text-[0.72rem] font-[var(--font-body)] font-semibold tracking-wide text-[var(--dim)] border-0 bg-transparent cursor-pointer hover:text-[var(--text)] whitespace-nowrap"
            @click="clearAllFilters(searchText)"
          >Clear</button>
        </div>
        <!-- Meal type filters -->
        <div v-if="mealTypes.length" class="flex flex-wrap gap-1 mb-2">
          <button
            v-for="t in mealTypes"
            :key="t"
            class="filter-chip"
            :class="{ active: state.activeFilters.mealType.has(t) }"
            @click="toggleFilter('mealType', t)"
          >{{ t }}</button>
        </div>
        <!-- Dietary -->
        <div class="flex flex-wrap gap-1 mb-2">
          <button
            v-for="d in DIETARY"
            :key="d"
            class="filter-chip"
            :class="{ active: state.activeFilters.dietary.has(d) }"
            @click="toggleFilter('dietary', d)"
          >{{ d }}</button>
        </div>
        <!-- Season -->
        <div class="flex flex-wrap gap-1">
          <button
            v-for="s in SEASONS"
            :key="s"
            class="filter-chip"
            :class="{ active: state.activeFilters.season.has(s) }"
            @click="toggleFilter('season', s)"
          >{{ s }}</button>
        </div>
      </div>

      <!-- Recipe grid -->
      <div class="dash-grid pb-8">
        <p v-if="!state.allRecipes.length" class="dash-no-results">
          <span class="spinner"></span> Loading recipes…
        </p>
        <p v-else-if="!filteredRecipes.length" class="dash-no-results">
          No recipes match the current filters.
        </p>
        <button
          v-for="item in filteredRecipes"
          :key="item.filename"
          class="dash-card"
          @click="openRecipe(item)"
        >
          <span class="dash-card-title">{{ item.title }}</span>
          <span class="dash-card-meta">
            <span v-if="item.tags?.mealType" class="dash-card-tag">{{ item.tags.mealType }}</span>
            {{ new Date(item.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
