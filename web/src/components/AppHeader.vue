<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isRecipe = computed(() => route.name === 'recipe')
</script>

<template>
  <header v-if="!isRecipe" class="app-header">
    <div class="app-header-left"></div>
  </header>
</template>
