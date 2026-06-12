<script setup>
const COLORS = [
  '#c8902d','#d4a853','#7a9e7e','#5b8db8','#a0636e',
  '#c4af72','#82a89a','#b56d3f','#6d8ea0','#c8902d',
  '#d4a853','#7a9e7e','#5b8db8','#a0636e','#c4af72',
  '#82a89a','#b56d3f','#6d8ea0','#9a7fb5','#c8902d',
]
const props = defineProps({ loading: { type: Boolean, default: false } })
</script>

<template>
  <div class="mosaic-strip" :class="{ loading: props.loading }">
    <span v-for="(color, i) in COLORS" :key="i" :style="{ background: color }"></span>
  </div>
</template>
