<script setup>
import { state } from '../../state.js'
import IngredientsTab from './IngredientsTab.vue'
</script>

<template>
  <div id="ingPanel" :class="{ open: state.panelOpen }">
    <!-- Collapse handle (desktop only, via CSS) -->
    <button class="panel-collapse-btn" title="Collapse" @click="state.panelOpen = false">
      <i class="fa-solid fa-xmark"></i>
    </button>
    <div class="ing-panel-inner-wrap">
      <IngredientsTab />
    </div>
  </div>
</template>
