<script setup>
import { computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { state } from '../state.js'
import { fetchRecipe, scrapeRecipe } from '../api.js'
import { useTimers } from '../composables/useTimers.js'
import { useServings } from '../composables/useServings.js'
import { parseTimingToSeconds, splitInstruction } from '../utils.js'

const props = defineProps({ slug: { type: String, required: true } })
const router = useRouter()
const { initTimers, tapTimerBtn } = useTimers()
const { initServings } = useServings()

const recipe = computed(() => state.currentRecipe)
const showConverted = computed(() => state.currentUnits === 'converted')

async function loadRecipe() {
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
    </div>

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
