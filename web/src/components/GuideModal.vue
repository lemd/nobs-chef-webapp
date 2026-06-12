<script setup>
import { computed } from 'vue'
import { state } from '../state.js'
import { useServings } from '../composables/useServings.js'

const { servings, scaleIngredientGroups } = useServings()

const recipe = computed(() => state.currentRecipe)

const scaledGroups = computed(() => {
  if (!recipe.value?.ingredientGroups) return []
  return scaleIngredientGroups(recipe.value.ingredientGroups)
})

// Build structured shopping guide grouped by ingredient
const guideGroups = computed(() => {
  if (!recipe.value?.ingredientGroups) return []
  const groups = scaleIngredientGroups(recipe.value.ingredientGroups)
  return groups.map((g) => ({
    name: g.group ?? '',
    items: g.items ?? [],
  })).filter((g) => g.items.length > 0)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.guideOpen"
      class="fixed inset-0 z-[300] bg-black/35 flex items-end md:items-center justify-center"
      @click.self="state.guideOpen = false"
    >
      <div class="bg-[var(--bg)] rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[var(--line)] shrink-0">
          <h2 class="font-display text-2xl font-normal m-0">Shopping guide</h2>
          <button
            class="text-[var(--dim)] hover:text-[var(--text)] bg-none border-none cursor-pointer text-xl"
            aria-label="Close guide"
            @click="state.guideOpen = false"
          ><i class="fa-solid fa-xmark"></i></button>
        </div>
        <!-- Content -->
        <div class="flex-1 overflow-y-auto px-6 py-4">
          <div v-for="(grp, gi) in guideGroups" :key="gi" class="guide-group">
            <p v-if="grp.name" class="guide-group-name">{{ grp.name }}</p>
            <div v-for="(item, ii) in grp.items" :key="ii" class="guide-row">
              <span class="guide-qty">{{ item.scaledQtyUnit || item.scaledQty || item.quantity }}</span>
              <span class="guide-name">{{ item.name }}</span>
              <span class="guide-hint-cell">{{ item.hint ?? '' }}</span>
            </div>
          </div>
          <p v-if="!guideGroups.length" class="text-[var(--dim)] text-sm italic pt-4">No ingredient data.</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
