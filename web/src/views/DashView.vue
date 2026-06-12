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
      <!-- Search + Add row -->
      <div class="dash-search-row">
        <div class="dash-search-wrap">
          <i class="fa-solid fa-magnifying-glass dash-search-icon"></i>
          <input
            v-model="searchText"
            type="search"
            placeholder="Search recipes or ingredients…"
            autocomplete="off"
            class="dash-search-input"
            @keydown="onSearchKeydown"
          />
          <span class="dash-recipe-count">
            {{ filteredRecipes.length === state.allRecipes.length
              ? `${state.allRecipes.length} recipe${state.allRecipes.length !== 1 ? 's' : ''}`
              : `${filteredRecipes.length} of ${state.allRecipes.length}` }}
          </span>
        </div>
        <button class="dash-add-btn" title="Add a recipe" @click="router.push('/new')">
          <i class="fa-solid fa-plus"></i>
          Add recipe
        </button>
      </div>

      <!-- Active ingredient chips + clear -->
      <div v-if="hasFilters" class="dash-active-filters">
        <button
          v-for="chip in [...state.activeIngredients]"
          :key="chip"
          class="ingredient-chip"
          @click="removeIngredientChip(chip)"
        >{{ chip }} ×</button>
        <button class="dash-clear-btn" @click="clearAllFilters(searchText)">
          <i class="fa-solid fa-xmark"></i> Clear filters
        </button>
      </div>

      <!-- Filter bar -->
      <div class="mb-6">
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
