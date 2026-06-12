<script setup>
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { state } from './state.js'
import MosaicStrip from './components/MosaicStrip.vue'
import AppHeader from './components/AppHeader.vue'
import AppDrawer from './components/AppDrawer.vue'
import GuideModal from './components/GuideModal.vue'
import IngPanel from './components/panel/IngPanel.vue'
import BookSidebar from './components/BookSidebar.vue'

const route = useRoute()
const router = useRouter()

// Close panel when leaving the recipe view
watch(
  () => route.name,
  (name) => { if (name !== 'recipe') state.panelOpen = false },
)

// Init season filter on load
;(function () {
  const m = new Date().getMonth()
  const season =
    m >= 2 && m <= 4 ? 'spring' :
    m >= 5 && m <= 7 ? 'summer' :
    m >= 8 && m <= 10 ? 'autumn' : 'winter'
  state.activeFilters.season.add(season)
})()
</script>

<template>
  <AppDrawer />
  <GuideModal />
  <div class="app-layout">
    <BookSidebar />
    <div id="app-scroll" :class="{ 'ing-open': state.panelOpen }">
      <MosaicStrip :loading="state.loading" />
      <AppHeader />
      <RouterView />
    </div>
    <IngPanel v-if="route.name === 'recipe'" />
  </div>
</template>
