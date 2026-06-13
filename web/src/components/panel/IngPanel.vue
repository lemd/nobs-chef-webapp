<script setup>
import { state } from '../../state.js'
import IngredientsTab from './IngredientsTab.vue'
</script>

<template>
  <div v-if="state.panelOpen" class="ing-panel-backdrop" @click="state.panelOpen = false" />
  <div id="ingPanel" :class="{ open: state.panelOpen }">
    <div class="ing-panel-inner-wrap">
      <IngredientsTab />
    </div>
  </div>
</template>
