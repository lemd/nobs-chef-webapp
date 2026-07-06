<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { state } from '../state.ts'
import { loadCachedRecipe } from '../composables/useCachedRecipe.ts'
import { useDashboard } from '../composables/useDashboard.ts'
import {
  TIME_OF_DAY_OPTIONS,
  getTimeOfDayMeal,
  isSuggestedForNow,
} from '../utils/timeOfDay.ts'
import { DIETARY_OPTIONS, SEASON_OPTIONS } from '../utils/recipeTags.ts'

const router = useRouter()
const {
  toggleFilter, addIngredientChip, removeIngredientChip,
  clearAllFilters, recipeMatchesFilters, sortRecipesForDisplay,
  mealTypes, currentTimeOfDay,
} = useDashboard()

const searchText = ref('')
const filterModalOpen = ref(false)

interface AppliedFilterChip {
  key: string
  label: string
  remove: () => void
}

const appliedFilterChips = computed((): AppliedFilterChip[] => {
  const chips: AppliedFilterChip[] = []
  for (const id of state.activeFilters.timeOfDay) {
    const opt = TIME_OF_DAY_OPTIONS.find((o) => o.id === id)
    chips.push({
      key: `time-${id}`,
      label: opt?.meal ?? id,
      remove: () => toggleFilter('timeOfDay', id),
    })
  }
  for (const t of state.activeFilters.mealType) {
    chips.push({
      key: `meal-${t}`,
      label: t,
      remove: () => toggleFilter('mealType', t),
    })
  }
  for (const d of state.activeFilters.dietary) {
    chips.push({
      key: `diet-${d}`,
      label: d,
      remove: () => toggleFilter('dietary', d),
    })
  }
  for (const s of state.activeFilters.season) {
    chips.push({
      key: `season-${s}`,
      label: s,
      remove: () => toggleFilter('season', s),
    })
  }
  for (const ing of state.activeIngredients) {
    chips.push({
      key: `ing-${ing}`,
      label: ing,
      remove: () => removeIngredientChip(ing),
    })
  }
  return chips
})

const activeFilterCount = computed(() =>
  state.activeFilters.mealType.size +
  state.activeFilters.dietary.size +
  state.activeFilters.season.size +
  state.activeFilters.timeOfDay.size,
)

const filteredRecipes = computed(() =>
  sortRecipesForDisplay(
    state.allRecipes.filter((r) => recipeMatchesFilters(r, searchText.value)),
  ),
)
const bookName = computed(() => state.currentBook?.name ?? '')
const currentMealLabel = computed(() => getTimeOfDayMeal(currentTimeOfDay.value))
const hasSuggestedRecipes = computed(() =>
  state.recipesLoaded && filteredRecipes.value.some((r) => isSuggestedForNow(r.tags)),
)

const DIETARY = DIETARY_OPTIONS
const SEASONS = SEASON_OPTIONS.filter((s) => s !== 'all year')

async function openRecipe(item: { filename: string; title: string; sourceUrl?: string }) {
  if (state.activeFile !== item.filename) {
    state.activeFile = item.filename
    const data = await loadCachedRecipe(item.filename)
    state.currentRecipe = data
    state.currentSourceUrl = data.sourceUrl ?? null
  }
  const slug = item.filename.replace(/\.json$/, '')
  router.push(`/r/${slug}`)
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
    <div class="max-w-[1080px] mx-auto px-0">
      <h1 v-if="bookName" class="dash-book-title">{{ bookName }}</h1>

      <!-- Search + Add row -->
      <div class="dash-search-row">
        <div class="dash-search-wrap">
          <i class="fa-solid fa-magnifying-glass dash-search-icon"></i>
          <input
            v-model="searchText"
            type="search"
            placeholder="Search recipes…"
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
        <button
          class="dash-filter-toggle"
          :class="{ 'dash-filter-toggle--active': activeFilterCount > 0 }"
          aria-haspopup="dialog"
          @click="filterModalOpen = true"
        >
          <i class="fa-solid fa-sliders"></i>
          <span class="dash-filter-toggle-label">Filters</span>
          <span v-if="activeFilterCount" class="dash-filter-badge">{{ activeFilterCount }}</span>
        </button>
        <button class="dash-add-btn" title="Add a recipe" @click="router.push('/new')">
          <i class="fa-solid fa-plus"></i>
          <span class="dash-add-label">Add recipe</span>
        </button>
      </div>

      <!-- Applied filters + clear -->
      <div v-if="appliedFilterChips.length" class="dash-active-filters">
        <button
          v-for="chip in appliedFilterChips"
          :key="chip.key"
          class="applied-filter-chip"
          @click="chip.remove()"
        >{{ chip.label }} ×</button>
        <button class="dash-clear-btn" @click="clearAllFilters(searchText)">
          <i class="fa-solid fa-xmark"></i> Clear all
        </button>
      </div>

      <p v-if="hasSuggestedRecipes" class="dash-suggest-hint">
        <i class="fa-regular fa-clock"></i>
        Suggested for {{ currentMealLabel.toLowerCase() }}
      </p>

      <!-- Recipe grid -->
      <div class="dash-grid pb-8">
        <p v-if="state.recipesLoading" class="dash-no-results">
          <span class="spinner"></span> Loading recipes…
        </p>
        <p v-else-if="state.recipesError" class="dash-no-results">
          {{ state.recipesError }}
        </p>
        <p v-else-if="state.recipesLoaded && !state.allRecipes.length" class="dash-no-results">
          No recipes yet. Tap Add recipe to get started.
        </p>
        <p v-else-if="!filteredRecipes.length" class="dash-no-results">
          No recipes match the current filters.
        </p>
        <button
          v-for="item in filteredRecipes"
          :key="item.filename"
          class="dash-card"
          :class="{ 'dash-card--suggested': isSuggestedForNow(item.tags) }"
          @click="openRecipe(item)"
        >
          <i v-if="item.pinned" class="fa-solid fa-thumbtack dash-card-pin" aria-label="Pinned"></i>
          <span v-if="isSuggestedForNow(item.tags)" class="dash-card-suggest">{{ currentMealLabel }}</span>
          <span v-if="item.forkedFrom" class="dash-card-fork">
            <i class="fa-solid fa-code-branch"></i> {{ item.forkedFrom.bookName }}
          </span>
          <span class="dash-card-title">{{ item.title }}</span>
          <span class="dash-card-meta">
            <span v-if="item.tags?.mealType" class="dash-card-tag">{{ item.tags.mealType }}</span>
            {{ new Date(item.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}
          </span>
        </button>
      </div>
    </div>

    <!-- Filter modal -->
    <Teleport to="body">
      <div
        v-if="filterModalOpen"
        class="invite-modal-backdrop"
        @click.self="filterModalOpen = false"
      >
        <div class="filter-modal" role="dialog" aria-modal="true" aria-label="Filter recipes">
          <button class="invite-modal-close" aria-label="Close" @click="filterModalOpen = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <h3 class="invite-modal-title">Filter recipes</h3>

          <div class="filter-modal-body">
            <section class="filter-modal-section">
              <p class="dash-filter-group-label">Time of day</p>
              <div class="filter-modal-chips">
                <button
                  v-for="t in TIME_OF_DAY_OPTIONS"
                  :key="t.id"
                  class="filter-chip"
                  :class="{ active: state.activeFilters.timeOfDay.has(t.id) }"
                  @click="toggleFilter('timeOfDay', t.id)"
                >{{ t.meal }}</button>
              </div>
            </section>

            <section v-if="mealTypes.length" class="filter-modal-section">
              <p class="dash-filter-group-label">Meal type</p>
              <div class="filter-modal-chips">
                <button
                  v-for="t in mealTypes"
                  :key="t"
                  class="filter-chip"
                  :class="{ active: state.activeFilters.mealType.has(t) }"
                  @click="toggleFilter('mealType', t)"
                >{{ t }}</button>
              </div>
            </section>

            <section class="filter-modal-section">
              <p class="dash-filter-group-label">Dietary</p>
              <div class="filter-modal-chips">
                <button
                  v-for="d in DIETARY"
                  :key="d"
                  class="filter-chip"
                  :class="{ active: state.activeFilters.dietary.has(d) }"
                  @click="toggleFilter('dietary', d)"
                >{{ d }}</button>
              </div>
            </section>

            <section class="filter-modal-section">
              <p class="dash-filter-group-label">Season</p>
              <div class="filter-modal-chips">
                <button
                  v-for="s in SEASONS"
                  :key="s"
                  class="filter-chip"
                  :class="{ active: state.activeFilters.season.has(s) }"
                  @click="toggleFilter('season', s)"
                >{{ s }}</button>
              </div>
            </section>
          </div>

          <div class="filter-modal-footer">
            <button
              v-if="appliedFilterChips.length"
              class="filter-modal-clear"
              @click="clearAllFilters(searchText)"
            >
              Clear all
            </button>
            <button class="filter-modal-done" @click="filterModalOpen = false">
              Done
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
