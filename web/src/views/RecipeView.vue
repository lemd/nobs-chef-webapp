<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { state } from '../state.js'
import { fetchRecipe, scrapeRecipe, saveRecipeImage } from '../api.js'
import { useTimers } from '../composables/useTimers.js'
import { useServings } from '../composables/useServings.js'
import { parseTimingToSeconds, splitInstruction, formatTime } from '../utils.js'
import { auth } from '../composables/useAuth.ts'
import { resizeImage } from '../utils/imageUpload.ts'

const props = defineProps({ slug: { type: String, required: true } })
const router = useRouter()
const { initTimers, tapTimerBtn, timer, resetTimer } = useTimers()
const { initServings } = useServings()

const recipe = computed(() => state.currentRecipe)
const showConverted = computed(() => state.currentUnits === 'converted')

async function loadRecipe() {
  // Always scroll to top when entering/switching a recipe
  document.getElementById('app-scroll')?.scrollTo(0, 0)
  const filename = `${props.slug}.json`
  if (!state.currentRecipe || state.activeFile !== filename) {
    try {
      const data = await fetchRecipe(filename)
      state.currentRecipe = data
      state.currentSourceUrl = data.sourceUrl ?? null
      state.activeFile = filename
    } catch (e) {
      console.error('Failed to load recipe:', e)
      router.push('/')
      return
    }
  }
  state.panelOpen = true
  state.currentPanelTab = 'ingredients'
  initTimers(state.currentRecipe.steps)
  initServings(state.currentRecipe)
}

onMounted(loadRecipe)

watch(() => props.slug, loadRecipe)

onBeforeUnmount(() => {
  // Don't reset currentRecipe — drawer needs it for history
})

async function refetchRecipe() {
  if (!state.currentSourceUrl) return
  const old = state.currentRecipe
  try {
    state.loading = true
    const data = await scrapeRecipe({ url: state.currentSourceUrl, force: true })
    const hash = data._hash
    delete data._cached
    delete data._hash
    state.currentRecipe = data
    initTimers(data.steps)
    initServings(data)
    if (hash && hash !== props.slug) router.replace(`/r/${hash}`)
  } catch (e) {
    state.currentRecipe = old
    console.error('Refetch failed:', e)
  } finally {
    state.loading = false
  }
}

function formatMeta(label, value) {
  return value ? { label, value } : null
}

const metaPills = computed(() => {
  if (!recipe.value) return []
  return [
    formatMeta('Prep', recipe.value.prepTime),
    formatMeta('Cook', recipe.value.cookTime),
    formatMeta('Total', recipe.value.totalTime),
    formatMeta('Servings', recipe.value.servings),
    formatMeta('Difficulty', recipe.value.difficulty),
  ].filter(Boolean)
})

// ── Recipe image upload ──────────────────────────────────────────────────────
const imageInputEl = ref(null)
const imageUploading = ref(false)
const fabPillEl = ref(null)

// FLIP width animation when timer starts/stops
watch(() => timer.running, () => {
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
    if (state.currentRecipe) state.currentRecipe.imageUrl = url
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
    <!-- Intro: full viewport height hero -->
    <div class="recipe-hero" :style="recipe.imageUrl ? `--hero-img: url('${recipe.imageUrl}')` : ''">
      <div class="recipe-hero-inner">
        <h1 class="recipe-title recipe-title--hero">{{ recipe.title }}</h1>
        <p v-if="recipe.description" class="recipe-description recipe-description--hero">{{ recipe.description }}</p>

        <!-- Meta row + scroll hint inline -->
        <div class="meta-row meta-row--hero">
          <div v-for="pill in metaPills" :key="pill.label" class="meta-pill">
            <span class="label">{{ pill.label }}</span>
            <span class="value">{{ pill.value }}</span>
          </div>
          <div class="recipe-hero-scroll-hint">
            <i class="fa-solid fa-chevron-down"></i>
          </div>
        </div>
      </div>

      <!-- Image upload button (any signed-in member, bottom-right of hero) -->
      <button
        v-if="auth.user"
        class="recipe-hero-img-btn"
        :title="recipe.imageUrl ? 'Change photo' : 'Add photo'"
        :disabled="imageUploading"
        @click="imageInputEl?.click()"
      >
        <i v-if="imageUploading" class="fa-solid fa-spinner fa-spin"></i>
        <i v-else class="fa-solid fa-camera"></i>
      </button>
      <input ref="imageInputEl" type="file" accept="image/*" style="display:none" @change="onImageFileChange" />
    </div>

    <!-- Floating action pill -->
    <Teleport to="body">
      <div v-if="recipe && auth.user" ref="fabPillEl" class="fab-pill">
        <button class="fab-btn" title="Draw (coming soon)" disabled>
          <i class="fa-solid fa-pen-nib"></i>
        </button>
        <button
          class="fab-btn"
          :title="recipe.imageUrl ? 'Change photo' : 'Add photo'"
          :disabled="imageUploading"
          @click="imageInputEl?.click()"
        >
          <i v-if="imageUploading" class="fa-solid fa-spinner fa-spin"></i>
          <i v-else class="fa-solid fa-camera"></i>
        </button>
        <span class="fab-divider"></span>
        <button
          class="fab-btn fab-btn--primary"
          :class="{ 'fab-btn--timer-active': timer.running }"
          :title="timer.running ? 'Stop timer' : 'Timers'"
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

    <!-- Steps -->
    <div class="recipe-body">
      <div class="recipe-steps-col">
        <p class="section-label">Method</p>
        <ol class="steps-list">
          <li v-for="step in (recipe.steps ?? [])" :key="step.stepNumber" class="step">
            <span class="step-num">{{ step.stepNumber }}</span>
            <div class="step-body">
              <!-- Single line vs multi-sentence bullets -->
              <template v-if="splitInstruction(step.instruction).length > 1">
                <ul class="step-bullets">
                  <li v-for="(line, i) in splitInstruction(step.instruction)" :key="i">{{ line }}</li>
                </ul>
              </template>
              <span v-else class="step-instruction">{{ step.instruction }}</span>
              <!-- Temperature conversion -->
              <span
                v-if="step.temperatureConversion && showConverted"
                class="conv"
              >→ {{ step.temperatureConversion }}</span>
              <!-- Timing: if parseable → single clickable pill; otherwise plain label -->
              <span v-if="step.timingInterval" class="step-timing">
                <button
                  v-if="parseTimingToSeconds(step.timingInterval)"
                  class="timer-start-btn timer-start-btn--label"
                  :aria-label="`Start ${step.timingInterval} timer`"
                  @click="tapTimerBtn(step.stepNumber)"
                ><i class="fa-solid fa-stopwatch"></i> {{ step.timingInterval }}</button>
                <span v-else class="step-timing-label">{{ step.timingInterval }}</span>
              </span>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </article>
</template>
