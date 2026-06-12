<script setup>
import { computed } from 'vue'
import { state } from '../../state.js'
import { useServings } from '../../composables/useServings.js'

const { servings, changeServings, scaleIngredientGroups } = useServings()

const recipe = computed(() => state.currentRecipe)

const hasConversions = computed(() =>
  !!(recipe.value?.ingredientGroups ?? []).some((g) =>
    (g.items ?? []).some((i) => i.convertedQuantity),
  ),
)

const scaledGroups = computed(() => {
  if (!recipe.value?.ingredientGroups) return []
  return scaleIngredientGroups(recipe.value.ingredientGroups)
})

const showConverted = computed(() => state.currentUnits === 'converted')

function setUnits(mode) {
  state.currentUnits = mode
}
</script>

<template>
  <div class="ing-panel-inner" id="panelIngredients">
    <div class="ing-panel-head">
      <div class="ing-panel-title-row">
        <div class="ing-head-actions">
          <span v-if="servings.original" class="ing-servings-inline">
            <button class="guide-btn" aria-label="Fewer servings" @click="changeServings(-1)">−</button>
            <span class="ing-servings-inline-count">{{ servings.current }}</span>
            <button class="guide-btn" aria-label="More servings" @click="changeServings(1)">+</button>
            <span class="ing-servings-inline-label">serves</span>
          </span>
          <button class="guide-btn" @click="state.guideOpen = true">
            <i class="fa-solid fa-list-check mr-1"></i>Shopping guide
          </button>
        </div>
      </div>
      <!-- no separate servings row needed -->
      <div v-if="hasConversions" class="unit-toggle">
        <button :class="{ active: !showConverted }" @click="setUnits('original')">Original</button>
        <button :class="{ active: showConverted }" @click="setUnits('converted')">Converted</button>
      </div>
      <p v-if="hasConversions && showConverted" class="unit-toggle-note">Showing metric conversions where available.</p>
    </div>
    <div v-for="(group, gi) in scaledGroups" :key="gi" class="ing-group">
      <p v-if="group.group" class="ing-group-name">{{ group.group }}</p>
      <ul class="ing-list">
        <li v-for="(item, ii) in group.items" :key="ii">
          <span class="ing-qty">
            <template v-if="showConverted && item.convertedQuantity">{{ item.convertedQuantity }}</template>
            <template v-else>{{ item.scaledQtyUnit || item.scaledQty || item.quantity }}</template>
          </span>
          <span class="ing-name">
            {{ item.name }}
            <span v-if="item.notes" class="ing-notes"> — {{ item.notes }}</span>
            <span v-if="item.hint" class="ing-hint">{{ item.hint }}</span>
          </span>
        </li>
      </ul>
    </div>
    <p v-if="!scaledGroups.length" class="text-[var(--dim)] text-sm italic mt-4">No ingredients found.</p>
  </div>
</template>
