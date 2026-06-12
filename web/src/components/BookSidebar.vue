<script setup>
// Placeholder book list — will be populated from Supabase in Phase 5
const books = [
  { id: 'personal', name: 'My Recipes', initial: 'N', color: '#c8902d' },
]
const activeBook = 'personal'
</script>

<template>
  <aside id="book-sidebar">
    <div
      v-for="book in books"
      :key="book.id"
      class="book-icon"
      :class="{ active: book.id === activeBook }"
      :title="book.name"
      :style="{ '--book-color': book.color }"
    >{{ book.initial }}</div>
    <div class="sidebar-gap"></div>
    <button class="book-add-btn" title="Add recipe book" aria-label="Add recipe book">
      <i class="fa-solid fa-plus"></i>
    </button>
  </aside>
</template>
