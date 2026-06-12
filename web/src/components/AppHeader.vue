<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { state } from '../state.js'

const route = useRoute()
const router = useRouter()

const isRecipe = computed(() => route.name === 'recipe')
const scrolled = ref(false)
let scroller = null

function onScroll() {
  if (!scroller) return
  scrolled.value = scroller.scrollTop > scroller.clientHeight * 0.7
}

onMounted(() => {
  scroller = document.getElementById('app-scroll')
  scroller?.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  scroller?.removeEventListener('scroll', onScroll)
})

// Reset scrolled state when navigating away from recipe
watch(isRecipe, (v) => { if (!v) scrolled.value = false })

function goHome() {
  state.panelOpen = false
  router.push('/')
}
</script>

<template>
  <header class="app-header" :class="{ 'app-header--recipe': isRecipe, 'app-header--scrolled': isRecipe && scrolled }">
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
