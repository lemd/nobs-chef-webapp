<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { state } from '../state.js'

const route = useRoute()
const router = useRouter()

const isRecipe = computed(() => route.name === 'recipe')

function goHome() {
  state.panelOpen = false
  router.push('/')
}
</script>

<template>
  <header class="app-header" :class="{ 'app-header--recipe': isRecipe }">
    <!-- Recipe view: back + truncated title + ingredients toggle -->
    <template v-if="isRecipe">
      <div class="app-header-left">
        <button class="header-btn header-back" aria-label="Back to recipes" @click="goHome">
          <i class="fa-solid fa-arrow-left"></i>
          <span>Recipes</span>
        </button>
      </div>
      <div class="app-header-centre">
        <span class="header-recipe-title">{{ state.currentRecipe?.title }}</span>
      </div>
      <div class="app-header-right">
      </div>
    </template>

    <!-- Dash / New / everything else: empty header (no title, no buttons) -->
    <template v-else>
      <div class="app-header-left"></div>
    </template>
  </header>
</template>
