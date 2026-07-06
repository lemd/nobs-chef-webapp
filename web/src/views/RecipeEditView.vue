<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { state } from '../state.js'
import { saveRecipe } from '../api.js'
import { loadCachedRecipe, updateCachedRecipe } from '../composables/useCachedRecipe.ts'
import {
  recipeToListItem,
  upsertRecipeInList,
} from '../composables/dataCache.ts'
import { applyCachedRecipeList } from '../composables/useRecipeList.ts'
import { auth } from '../composables/useAuth.ts'
import { TIME_OF_DAY_OPTIONS } from '../utils/timeOfDay.ts'
import {
  MEAL_TYPE_OPTIONS,
  DIETARY_OPTIONS,
  SEASON_OPTIONS,
  normalizeTagsForEdit,
  cleanTags,
  toggleTagInArray,
} from '../utils/recipeTags.ts'

const props = defineProps({ slug: { type: String, required: true } })
const router = useRouter()

const draft = ref(null)
const saving = ref(false)
const error = ref(null)

const metaFields = [
  { key: 'prepTime', label: 'Prep' },
  { key: 'cookTime', label: 'Cook' },
  { key: 'totalTime', label: 'Total' },
  { key: 'servings', label: 'Servings' },
  { key: 'difficulty', label: 'Difficulty' },
]

function cloneRecipe(data) {
  return JSON.parse(JSON.stringify(data))
}

function cleanDraft(data) {
  const cleaned = cloneRecipe(data)
  cleaned.title = cleaned.title.trim()
  cleaned.description = cleaned.description?.trim() || null
  cleaned.prepTime = cleaned.prepTime?.trim() || null
  cleaned.cookTime = cleaned.cookTime?.trim() || null
  cleaned.totalTime = cleaned.totalTime?.trim() || null
  cleaned.servings = cleaned.servings?.trim() || null
  cleaned.difficulty = cleaned.difficulty?.trim() || null
  cleaned.ingredientGroups = cleaned.ingredientGroups
    .map((g) => ({
      group: g.group?.trim() || null,
      items: g.items
        .map((item) => ({
          ...item,
          quantity: item.quantity?.trim() || null,
          unit: item.unit?.trim() || null,
          name: item.name.trim(),
        }))
        .filter((item) => item.name),
    }))
    .filter((g) => g.items.length > 0)
  cleaned.steps = cleaned.steps
    .map((step, i) => ({
      ...step,
      stepNumber: i + 1,
      instruction: step.instruction.trim(),
      userNote: step.userNote?.trim() || null,
    }))
    .filter((step) => step.instruction)
  cleaned.tags = cleanTags(cleaned.tags)
  return cleaned
}

async function loadRecipe() {
  document.getElementById('app-scroll')?.scrollTo(0, 0)
  const filename = `${props.slug}.json`
  if (!state.currentRecipe || state.activeFile !== filename) {
    try {
      const data = await loadCachedRecipe(filename)
      state.currentRecipe = data
      state.currentSourceUrl = data.sourceUrl ?? null
      state.activeFile = filename
    } catch (e) {
      console.error('Failed to load recipe:', e)
      router.push('/')
      return
    }
  }
  draft.value = cloneRecipe(state.currentRecipe)
  draft.value.tags = normalizeTagsForEdit(draft.value.tags)
  error.value = null
}

onMounted(loadRecipe)
watch(() => props.slug, loadRecipe)

function cancel() {
  router.push(`/r/${props.slug}`)
}

async function save() {
  if (!draft.value || !state.activeFile || saving.value) return
  saving.value = true
  error.value = null
  try {
    const saved = await saveRecipe(state.activeFile, cleanDraft(draft.value))
    state.currentRecipe = saved
    updateCachedRecipe(state.activeFile, saved)
    const userId = auth.user?.id
    const bookId = state.currentBook?.id
    if (userId && bookId) {
      upsertRecipeInList(userId, bookId, recipeToListItem(state.activeFile, saved))
      applyCachedRecipeList(bookId)
    }
    router.push(`/r/${props.slug}`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}

function addIngredient(groupIndex) {
  draft.value.ingredientGroups[groupIndex].items.push({ quantity: null, unit: null, name: '' })
}

function removeIngredient(groupIndex, itemIndex) {
  draft.value.ingredientGroups[groupIndex].items.splice(itemIndex, 1)
}

function addGroup() {
  draft.value.ingredientGroups.push({ group: null, items: [{ quantity: null, unit: null, name: '' }] })
}

function addStep() {
  draft.value.steps.push({ stepNumber: draft.value.steps.length + 1, instruction: '', userNote: null })
}

function removeStep(index) {
  draft.value.steps.splice(index, 1)
  draft.value.steps.forEach((step, i) => { step.stepNumber = i + 1 })
}

function toggleMealType(value) {
  if (!draft.value.tags) draft.value.tags = normalizeTagsForEdit(null)
  draft.value.tags.mealType = draft.value.tags.mealType === value ? null : value
}

function toggleDietary(value) {
  if (!draft.value.tags) draft.value.tags = normalizeTagsForEdit(null)
  draft.value.tags.dietary = toggleTagInArray(draft.value.tags.dietary ?? [], value)
}

function toggleSeason(value) {
  if (!draft.value.tags) draft.value.tags = normalizeTagsForEdit(null)
  draft.value.tags.season = toggleTagInArray(draft.value.tags.season ?? [], value)
}

function toggleTimeOfDay(value) {
  if (!draft.value.tags) draft.value.tags = normalizeTagsForEdit(null)
  draft.value.tags.timeOfDay = toggleTagInArray(
    draft.value.tags.timeOfDay ?? [],
    value,
  ) as typeof draft.value.tags.timeOfDay
}
</script>

<template>
  <div v-if="!draft" class="recipe-edit-page pt-8 text-[var(--dim)] text-sm flex items-center gap-2">
    <span class="spinner"></span> Loading…
  </div>
  <div v-else class="recipe-edit-page">
    <div class="recipe-edit-page-head">
      <button type="button" class="recipe-edit-bar-btn" :disabled="saving" @click="cancel">
        Cancel
      </button>
      <h1 class="recipe-edit-page-title">Edit recipe</h1>
      <button
        type="button"
        class="recipe-edit-bar-btn recipe-edit-bar-btn--save"
        :disabled="saving || !draft.title?.trim()"
        @click="save"
      >
        <i v-if="saving" class="fa-solid fa-spinner fa-spin"></i>
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </div>

    <p v-if="error" class="recipe-edit-bar-error">{{ error }}</p>

    <div class="recipe-edit-body">
      <label class="recipe-edit-field">
        <span class="recipe-edit-label">Title</span>
        <input v-model="draft.title" type="text" class="recipe-edit-input" placeholder="Recipe title" />
      </label>

      <label class="recipe-edit-field">
        <span class="recipe-edit-label">Description</span>
        <textarea
          v-model="draft.description"
          rows="3"
          class="recipe-edit-textarea"
          placeholder="Description (optional)"
        />
      </label>

      <div class="recipe-edit-meta-grid">
        <label v-for="field in metaFields" :key="field.key" class="recipe-edit-field">
          <span class="recipe-edit-label">{{ field.label }}</span>
          <input v-model="draft[field.key]" type="text" class="recipe-edit-input" />
        </label>
      </div>

      <section class="recipe-edit-section">
        <h2 class="recipe-edit-section-title">Tags</h2>

        <div class="recipe-edit-tag-group">
          <p class="recipe-edit-label">Time of day</p>
          <div class="recipe-edit-tag-chips">
            <button
              v-for="t in TIME_OF_DAY_OPTIONS"
              :key="t.id"
              type="button"
              class="filter-chip"
              :class="{ active: draft.tags?.timeOfDay?.includes(t.id) }"
              @click="toggleTimeOfDay(t.id)"
            >{{ t.meal }}</button>
          </div>
        </div>

        <div class="recipe-edit-tag-group">
          <p class="recipe-edit-label">Meal type</p>
          <div class="recipe-edit-tag-chips">
            <button
              v-for="t in MEAL_TYPE_OPTIONS"
              :key="t"
              type="button"
              class="filter-chip"
              :class="{ active: draft.tags?.mealType === t }"
              @click="toggleMealType(t)"
            >{{ t }}</button>
          </div>
        </div>

        <div class="recipe-edit-tag-group">
          <p class="recipe-edit-label">Dietary</p>
          <div class="recipe-edit-tag-chips">
            <button
              v-for="d in DIETARY_OPTIONS"
              :key="d"
              type="button"
              class="filter-chip"
              :class="{ active: draft.tags?.dietary?.includes(d) }"
              @click="toggleDietary(d)"
            >{{ d }}</button>
          </div>
        </div>

        <div class="recipe-edit-tag-group">
          <p class="recipe-edit-label">Season</p>
          <div class="recipe-edit-tag-chips">
            <button
              v-for="s in SEASON_OPTIONS"
              :key="s"
              type="button"
              class="filter-chip"
              :class="{ active: draft.tags?.season?.includes(s) }"
              @click="toggleSeason(s)"
            >{{ s }}</button>
          </div>
        </div>
      </section>

      <section class="recipe-edit-section">
        <div class="recipe-edit-section-head">
          <h2 class="recipe-edit-section-title">Ingredients</h2>
          <button type="button" class="recipe-edit-add-btn" @click="addGroup">Add group</button>
        </div>
        <div v-for="(group, gi) in draft.ingredientGroups" :key="gi" class="recipe-edit-group">
          <input
            v-model="group.group"
            type="text"
            class="recipe-edit-input recipe-edit-group-name"
            placeholder="Group name (optional)"
          />
          <div v-for="(item, ii) in group.items" :key="ii" class="recipe-edit-ing-row">
            <input v-model="item.quantity" type="text" class="recipe-edit-input recipe-edit-qty" placeholder="Qty" />
            <input v-model="item.unit" type="text" class="recipe-edit-input recipe-edit-unit" placeholder="Unit" />
            <input v-model="item.name" type="text" class="recipe-edit-input recipe-edit-name" placeholder="Ingredient" />
            <button type="button" class="recipe-edit-remove" aria-label="Remove" @click="removeIngredient(gi, ii)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <button type="button" class="recipe-edit-add-btn" @click="addIngredient(gi)">Add ingredient</button>
        </div>
      </section>

      <section class="recipe-edit-section">
        <div class="recipe-edit-section-head">
          <h2 class="recipe-edit-section-title">Method</h2>
          <button type="button" class="recipe-edit-add-btn" @click="addStep">Add step</button>
        </div>
        <div v-for="(step, si) in draft.steps" :key="step.stepNumber" class="recipe-edit-step">
          <span class="recipe-edit-step-num">{{ step.stepNumber }}</span>
          <div class="recipe-edit-step-fields">
            <textarea
              v-model="draft.steps[si].instruction"
              rows="3"
              class="recipe-edit-textarea recipe-edit-step-text"
              placeholder="Step instruction"
            />
            <textarea
              v-model="draft.steps[si].userNote"
              rows="2"
              class="recipe-edit-textarea step-note-input"
              placeholder="Your note for this step (optional)"
            />
            <button type="button" class="recipe-edit-add-btn recipe-edit-step-remove" @click="removeStep(si)">
              Remove step
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
