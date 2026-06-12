<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { state } from '../state.ts'

const router = useRouter()
const books = computed(() => state.books)
const activeBookId = computed(() => state.currentBook?.id ?? null)

function selectBook(book: typeof state.books[0]) {
  state.currentBook = book
}

function avatarInitial(name: string) {
  return name?.charAt(0).toUpperCase() ?? '?'
}
</script>

<template>
  <aside id="book-sidebar">
    <div
      v-for="book in books"
      :key="book.id"
      class="book-icon"
      :class="{ active: book.id === activeBookId }"
      :title="book.name"
      :style="{ '--book-color': '#c8902d' }"
      @click="selectBook(book)"
    >{{ avatarInitial(book.name) }}</div>

    <div class="sidebar-gap"></div>

    <button
      class="book-add-btn sidebar-profile-btn"
      title="Profile"
      aria-label="Profile"
      @click="router.push('/profile')"
    >
      <i class="fa-solid fa-circle-user"></i>
    </button>
  </aside>
</template>

<style scoped>
.sidebar-profile-btn {
  font-size: 1.1rem;
}
</style>
