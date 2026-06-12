<script setup>
import { state } from '../../state.js'
import { useTimers } from '../../composables/useTimers.js'
import IngredientsTab from './IngredientsTab.vue'
import TimersTab from './TimersTab.vue'

const { tabLabel } = useTimers()

function selectTab(tab) {
  state.currentPanelTab = tab
  state.panelOpen = true
}
</script>

<template>
  <div id="ingPanel" :class="{ open: state.panelOpen }">
    <!-- Tab bar -->
    <div class="ing-outer-tabs">
      <!-- Ingredients -->
      <button
        class="ing-outer-tab"
        :class="{ active: state.currentPanelTab === 'ingredients' }"
        aria-label="Ingredients"
        @click="selectTab('ingredients')"
      >
        <i class="fa-solid fa-list"></i>
      </button>
      <!-- Timers -->
      <button
        class="ing-outer-tab"
        :class="{ active: state.currentPanelTab === 'timers' }"
        aria-label="Timers"
        @click="selectTab('timers')"
      >
        <i class="fa-solid fa-clock"></i>
        <span v-if="tabLabel?.running" class="tab-time tab-time--running">{{ tabLabel.time }}</span>
      </button>
    </div>

    <!-- Tab content -->
    <div class="panel-section" :id="`panel-${state.currentPanelTab}`">
      <IngredientsTab v-if="state.currentPanelTab === 'ingredients'" />
      <TimersTab v-else-if="state.currentPanelTab === 'timers'" />
    </div>
  </div>
</template>
