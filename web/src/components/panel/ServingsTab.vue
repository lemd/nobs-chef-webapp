<script setup>
import { useServings } from '../../composables/useServings.js'

const { servings, changeServings } = useServings()
</script>

<template>
  <div class="ing-panel-inner" id="panelServings">
    <div class="servings-card">
      <span class="servings-card-label">Servings</span>
      <span class="servings-card-display">{{ servings.current ?? '—' }}</span>
      <span class="servings-card-unit">servings</span>
      <div class="servings-card-controls">
        <button aria-label="Fewer servings" @click="changeServings(-1)">−</button>
        <button aria-label="More servings" @click="changeServings(1)">+</button>
      </div>
      <p v-if="servings.original && servings.current !== servings.original" class="servings-card-hint">
        Original: {{ servings.original }} serving{{ servings.original !== 1 ? 's' : '' }}
      </p>
    </div>
  </div>
</template>
