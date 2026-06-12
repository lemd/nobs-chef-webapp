<script setup>
import { state } from '../../state.js'
import IngredientsTab from './IngredientsTab.vue'
</script>

<template>
  <div id="ingPanel" :class="{ open: state.panelOpen }">
    <div class="ing-panel-inner-wrap">
      <IngredientsTab />
    </div>
  </div>
</template>
