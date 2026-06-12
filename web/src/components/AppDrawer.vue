<script setup>
import { state } from '../state.js'
import { fetchRecipe } from '../api.js'
import { useRouter } from 'vue-router'

const router = useRouter()

async function openRecipe(item) {
  state.drawerOpen = false
  const slug = item.filename.replace(/\.json$/, '')
  if (state.activeFile !== item.filename) {
    state.activeFile = item.filename
    const data = await fetchRecipe(item.filename)
    state.currentRecipe = data
    state.currentSourceUrl = data.sourceUrl ?? null
  }
  router.push(`/r/${slug}`)
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      v-if="state.drawerOpen"
      class="fixed inset-0 z-[190] bg-black/20"
      @click="state.drawerOpen = false"
    ></div>
    <!-- Drawer -->
    <nav
      class="fixed top-0 right-0 bottom-0 z-[200] w-72 bg-[var(--bg)] border-l border-[var(--line)] flex flex-col py-8 px-6 overflow-y-auto"
      :class="state.drawerOpen ? '' : 'translate-x-full'"
      style="will-change: transform"
      aria-label="Menu"
    >
      <button
        class="absolute top-4 right-5 text-[var(--dim)] hover:text-[var(--text)] text-lg bg-none border-none cursor-pointer"
        aria-label="Close menu"
        @click="state.drawerOpen = false"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
      <h2 class="font-display text-2xl font-normal mb-6 mt-2">Nobs</h2>
      <p class="text-[0.65rem] font-bold tracking-[0.14em] uppercase text-[var(--dim)] mb-2">Recent</p>
      <ul class="history-list">
        <li v-for="item in state.allRecipes.slice(0, 20)" :key="item.filename">
          <button
            :class="{ active: state.activeFile === item.filename }"
            @click="openRecipe(item)"
          >
            {{ item.title }}
            <span class="hist-date">{{ new Date(item.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
          </button>
        </li>
      </ul>
    </nav>
  </Teleport>
</template>
