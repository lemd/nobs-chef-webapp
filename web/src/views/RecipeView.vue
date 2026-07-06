<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { state } from '../state.js'
import { saveRecipeImage, saveRecipe, forkRecipe } from '../api.js'
import { loadCachedRecipe, updateCachedRecipe } from '../composables/useCachedRecipe.ts'
import {
  recipeToListItem,
  upsertRecipeInList,
} from '../composables/dataCache.ts'
import { applyCachedRecipeList } from '../composables/useRecipeList.ts'
import { useTimers } from '../composables/useTimers.js'
import { useServings } from '../composables/useServings.js'
import { parseTimingToSeconds, splitInstruction, formatTime } from '../utils.js'
import { auth } from '../composables/useAuth.ts'
import { resizeImage } from '../utils/imageUpload.ts'
import { isPinned, togglePin } from '../composables/usePinnedRecipes.ts'
import { getOwnedBook } from '../utils/books.ts'

const props = defineProps({ slug: { type: String, required: true } })
const router = useRouter()
const { initTimers, tapTimerBtn, timer, resetTimer } = useTimers()
const { initServings } = useServings()

const recipe = computed(() => state.currentRecipe)
const showConverted = computed(() => state.currentUnits === 'converted')

async function loadRecipe() {
  document.getElementById('app-scroll')?.scrollTo(0, 0)
  const filename = `${props.slug}.json`
  noteEditingStep.value = null
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
  state.panelOpen = window.matchMedia('(min-width: 761px)').matches
  state.currentPanelTab = 'ingredients'
  initTimers(state.currentRecipe.steps)
  initServings(state.currentRecipe)
}

onMounted(loadRecipe)
watch(() => props.slug, loadRecipe)

function cloneRecipe(data) {
  return JSON.parse(JSON.stringify(data))
}

async function persistRecipe(updated) {
  if (!state.activeFile) return
  noteSaving.value = true
  try {
    const saved = await saveRecipe(state.activeFile, updated)
    state.currentRecipe = saved
    updateCachedRecipe(state.activeFile, saved)
    const userId = auth.user?.id
    const bookId = state.currentBook?.id
    if (userId && bookId) {
      upsertRecipeInList(userId, bookId, recipeToListItem(state.activeFile, saved))
      applyCachedRecipeList(bookId)
    }
    initTimers(saved.steps)
    initServings(saved)
    noteEditingStep.value = null
    noteDraft.value = ''
  } catch (err) {
    console.error('Failed to save note:', err)
  } finally {
    noteSaving.value = false
  }
}

// ── Step sticky notes ───────────────────────────────────────────────────────
const noteEditingStep = ref(null)
const noteDraft = ref('')
const noteSaving = ref(false)

function openStepNote(step) {
  if (!auth.user) return
  noteEditingStep.value = step.stepNumber
  noteDraft.value = step.userNote ?? ''
}

function cancelStepNote() {
  noteEditingStep.value = null
  noteDraft.value = ''
}

async function saveStepNote(stepNumber) {
  if (!state.currentRecipe || noteSaving.value) return
  const text = noteDraft.value.trim()
  const updated = cloneRecipe(state.currentRecipe)
  updated.steps = updated.steps.map((s) =>
    s.stepNumber === stepNumber ? { ...s, userNote: text || null } : s,
  )
  await persistRecipe(updated)
}

async function removeStepNote(stepNumber) {
  noteDraft.value = ''
  noteEditingStep.value = stepNumber
  await saveStepNote(stepNumber)
}

// ── Meta / display ──────────────────────────────────────────────────────────
function formatMeta(label, value) {
  return value ? { label, value } : null
}

const metaFields = [
  { key: 'prepTime', label: 'Prep' },
  { key: 'cookTime', label: 'Cook' },
  { key: 'totalTime', label: 'Total' },
  { key: 'servings', label: 'Servings' },
  { key: 'difficulty', label: 'Difficulty' },
]

const metaPills = computed(() => {
  if (!recipe.value) return []
  return metaFields
    .map(({ key, label }) => formatMeta(label, recipe.value[key]))
    .filter(Boolean)
})

const DEFAULT_HERO =
  'https://images.pexels.com/photos/10048690/pexels-photo-10048690.jpeg?auto=compress&cs=tinysrgb&w=1400&h=1400&fit=crop'

const heroPhotoUrl = computed(() => recipe.value?.imageUrl || DEFAULT_HERO)
const activeFilename = computed(() => `${props.slug}.json`)
const pinned = computed(() => isPinned(activeFilename.value))

function goHome() {
  state.panelOpen = false
  router.push('/')
}

function togglePinned() {
  togglePin(activeFilename.value)
}

function goEdit() {
  if (!auth.user) return
  router.push(`/r/${props.slug}/edit`)
}

const forkSaving = ref(false)
const forkError = ref(null)

const canFork = computed(() => {
  if (!auth.user || !state.currentBook || !recipe.value) return false
  if (state.currentBook.visibility !== 'public') return false
  if (state.currentBook.owner_id === auth.user.id) return false
  if (recipe.value.forkedFrom) return false
  return true
})

async function handleFork() {
  if (!canFork.value || forkSaving.value || !state.currentBook) return
  forkSaving.value = true
  forkError.value = null
  try {
    const result = await forkRecipe(activeFilename.value, state.currentBook.id)
    const ownedBook =
      state.books.find((b) => b.id === result.ownedBookId) ??
      getOwnedBook(state.books, auth.user?.id)
    if (ownedBook) state.currentBook = ownedBook
    const filename = `${result.hash}.json`
    state.currentRecipe = result
    state.activeFile = filename
    updateCachedRecipe(filename, result)
    const userId = auth.user?.id
    if (userId && ownedBook) {
      upsertRecipeInList(userId, ownedBook.id, recipeToListItem(filename, result))
      applyCachedRecipeList(ownedBook.id)
    }
    router.push(`/r/${result.hash}`)
  } catch (e) {
    forkError.value = e instanceof Error ? e.message : 'Failed to fork recipe'
  } finally {
    forkSaving.value = false
  }
}

function goToForkSource() {
  const src = recipe.value?.forkedFrom
  if (!src) return
  const book = state.books.find((b) => b.id === src.bookId)
  if (book) state.currentBook = book
  router.push(`/r/${src.recipeHash}`)
}

// ── Image upload ────────────────────────────────────────────────────────────
const imageInputEl = ref(null)
const imageUploading = ref(false)
const fabPillEl = ref(null)

watch(() => [timer.running, timer.stepNum], () => {
  const pill = fabPillEl.value
  if (!pill) return
  const startWidth = pill.getBoundingClientRect().width
  nextTick().then(() => {
    const endWidth = pill.getBoundingClientRect().width
    if (Math.abs(endWidth - startWidth) < 2) return
    pill.style.overflow = 'hidden'
    const anim = pill.animate(
      [{ width: `${startWidth}px` }, { width: `${endWidth}px` }],
      { duration: 260, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    )
    anim.addEventListener('finish', () => { pill.style.overflow = '' })
  })
})

async function onImageFileChange(e) {
  const file = e.target.files?.[0]
  if (!file || !state.activeFile) return
  e.target.value = ''
  imageUploading.value = true
  try {
    const blob = await resizeImage(file, 1600, 0.85)
    const hash = state.activeFile.replace(/\.json$/, '')
    const url = await saveRecipeImage(hash, blob)
    if (state.currentRecipe) {
      state.currentRecipe.imageUrl = url
      if (state.activeFile) updateCachedRecipe(state.activeFile, state.currentRecipe)
    }
  } catch (err) {
    console.error('Image upload failed:', err)
  } finally {
    imageUploading.value = false
  }
}
</script>

<template>
  <div v-if="!recipe" class="pt-8 text-[var(--dim)] text-sm flex items-center gap-2">
    <span class="spinner"></span> Loading…
  </div>
  <article v-else class="recipe-article pb-16">
    <div class="recipe-hero">
      <div class="recipe-hero-art">
        <img :src="heroPhotoUrl" class="recipe-hero-photo" alt="" aria-hidden="true" />
      </div>

      <div class="recipe-nav">
        <button class="header-btn header-back" aria-label="Back to recipes" @click="goHome">
          <i class="fa-solid fa-arrow-left"></i>
          <span>Recipes</span>
        </button>
      </div>

      <div class="recipe-hero-inner recipe-hero-head">
        <button
          v-if="recipe.forkedFrom"
          type="button"
          class="recipe-fork-badge"
          @click="goToForkSource"
        >
          <i class="fa-solid fa-code-branch"></i>
          Forked from {{ recipe.forkedFrom.bookName }}
        </button>
        <h1 class="recipe-title">{{ recipe.title }}</h1>
      </div>

      <div class="recipe-hero-inner">
        <p v-if="recipe.description" class="recipe-description">{{ recipe.description }}</p>

        <div class="meta-row">
          <div v-for="pill in metaPills" :key="pill.label" class="meta-pill">
            <span class="label">{{ pill.label }}</span>
            <span class="value">{{ pill.value }}</span>
          </div>
        </div>
      </div>

      <input ref="imageInputEl" type="file" accept="image/*" style="display:none" @change="onImageFileChange" />
    </div>

    <Teleport to="body">
      <div v-if="recipe && auth.user" ref="fabPillEl" class="fab-pill">
        <button
          class="fab-btn fab-btn--ingredients-toggle"
          :class="{ 'fab-btn--active': state.panelOpen }"
          :title="state.panelOpen ? 'Hide ingredients' : 'Show ingredients'"
          :data-tooltip="state.panelOpen ? 'Hide' : 'Ingredients'"
          @click="state.panelOpen = !state.panelOpen"
        >
          <i class="fa-solid fa-list"></i>
        </button>
        <button
          class="fab-btn"
          :class="{ 'fab-btn--active': pinned }"
          :title="pinned ? 'Unpin recipe' : 'Pin recipe'"
          :data-tooltip="pinned ? 'Unpin' : 'Pin'"
          @click="togglePinned"
        >
          <i class="fa-solid fa-thumbtack"></i>
        </button>
        <button
          class="fab-btn"
          title="Edit recipe"
          data-tooltip="Edit"
          @click="goEdit"
        >
          <i class="fa-solid fa-pen"></i>
        </button>
        <button
          v-if="canFork"
          class="fab-btn"
          title="Fork to your book"
          data-tooltip="Fork"
          :disabled="forkSaving"
          @click="handleFork"
        >
          <i v-if="forkSaving" class="fa-solid fa-spinner fa-spin"></i>
          <i v-else class="fa-solid fa-code-branch"></i>
        </button>
        <button
          class="fab-btn"
          :title="recipe.imageUrl ? 'Change photo' : 'Add photo'"
          :data-tooltip="recipe.imageUrl ? 'Change photo' : 'Add photo'"
          :disabled="imageUploading"
          @click="imageInputEl?.click()"
        >
          <i v-if="imageUploading" class="fa-solid fa-spinner fa-spin"></i>
          <i v-else class="fa-solid fa-camera"></i>
        </button>
        <span class="fab-divider"></span>
        <button
          class="fab-btn fab-btn--primary fab-btn--timer"
          :class="{ 'fab-btn--timer-active': timer.running }"
          :title="timer.running ? 'Stop timer' : 'Timers'"
          :data-tooltip="timer.running ? 'Stop' : 'Timer'"
          @click="timer.running && resetTimer()"
        >
          <i v-if="!timer.running" class="fa-solid fa-stopwatch"></i>
          <template v-else>
            <i class="fa-solid fa-stop"></i>
            <span class="fab-timer-time">{{ formatTime(timer.remaining) }}</span>
          </template>
        </button>
      </div>
    </Teleport>

    <div class="recipe-body">
      <div class="recipe-steps-col">
        <div class="recipe-steps-head">
          <p class="section-label">Method</p>
        </div>
        <ol class="steps-list">
          <li v-for="step in (recipe.steps ?? [])" :key="step.stepNumber" class="step">
            <span class="step-num">{{ step.stepNumber }}</span>
            <div
              class="step-body"
              :class="{
                'step-body--noteable':
                  auth.user &&
                  !step.userNote &&
                  noteEditingStep !== step.stepNumber,
              }"
            >
              <template v-if="splitInstruction(step.instruction).length > 1">
                <ul class="step-bullets">
                  <li v-for="(line, i) in splitInstruction(step.instruction)" :key="i">{{ line }}</li>
                </ul>
              </template>
              <span v-else class="step-instruction">{{ step.instruction }}</span>
              <span
                v-if="step.temperatureConversion && showConverted"
                class="conv"
              >→ {{ step.temperatureConversion }}</span>
              <span v-if="step.timingInterval" class="step-timing">
                <button
                  v-if="parseTimingToSeconds(step.timingInterval)"
                  class="timer-start-btn timer-start-btn--label"
                  :aria-label="`Start ${step.timingInterval} timer`"
                  @click="tapTimerBtn(step.stepNumber)"
                ><i class="fa-solid fa-stopwatch"></i> {{ step.timingInterval }}</button>
                <span v-else class="step-timing-label">{{ step.timingInterval }}</span>
              </span>

              <button
                v-if="auth.user && !step.userNote && noteEditingStep !== step.stepNumber"
                type="button"
                class="step-note-trigger"
                aria-label="Add note to this step"
                title="Add note"
                @click="openStepNote(step)"
              >
                <i class="fa-solid fa-plus"></i>
                <i class="fa-solid fa-note-sticky"></i>
              </button>

              <div v-if="step.userNote && noteEditingStep !== step.stepNumber" class="step-note">
                <p class="step-note-label">my note</p>
                <p class="step-note-text">{{ step.userNote }}</p>
                <div v-if="auth.user" class="step-note-actions">
                  <button type="button" class="step-note-btn" @click="openStepNote(step)">Edit</button>
                  <button type="button" class="step-note-btn step-note-btn--remove" @click="removeStepNote(step.stepNumber)">Remove</button>
                </div>
              </div>
              <div v-else-if="noteEditingStep === step.stepNumber" class="step-note step-note--editing">
                <p class="step-note-label">my note</p>
                <textarea
                  v-model="noteDraft"
                  rows="3"
                  class="step-note-textarea"
                  placeholder="Add a tip, substitution, or reminder…"
                />
                <div class="step-note-actions">
                  <button type="button" class="step-note-btn" :disabled="noteSaving" @click="cancelStepNote">Cancel</button>
                  <button type="button" class="step-note-btn step-note-btn--save" :disabled="noteSaving" @click="saveStepNote(step.stepNumber)">
                    {{ noteSaving ? 'Saving…' : 'Save note' }}
                  </button>
                </div>
              </div>

            </div>
          </li>
        </ol>
      </div>
    </div>
  </article>
</template>
