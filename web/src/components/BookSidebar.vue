<script setup>
import { computed, ref } from 'vue'
import { state } from '../state.js'
import { auth, signOut } from '../composables/useAuth.js'
import { createBook } from '../api.js'

const adding = ref(false)
const newBookName = ref('')

const books = computed(() => state.books)
const activeBookId = computed(() => state.currentBook?.id ?? null)

function selectBook(book) {
  state.currentBook = book
}

async function handleAdd() {
  const name = newBookName.value.trim()
  if (!name) return
  try {
    const book = await createBook(name)
    state.books.push(book)
    state.currentBook = book
    newBookName.value = ''
    adding.value = false
  } catch (e) {
    console.error(e)
  }
}

function avatarInitial(book) {
  return book.name?.charAt(0).toUpperCase() ?? '?'
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
    >{{ avatarInitial(book) }}</div>

    <div class="sidebar-gap"></div>

    <template v-if="adding">
      <input
        v-model="newBookName"
        class="book-name-input"
        placeholder="Name"
        maxlength="40"
        autofocus
        @keydown.enter="handleAdd"
        @keydown.esc="adding = false"
      />
      <button class="book-add-btn" title="Create" @click="handleAdd">
        <i class="fa-solid fa-check"></i>
      </button>
      <button class="book-add-btn" title="Cancel" @click="adding = false; newBookName = ''">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </template>
    <button v-else class="book-add-btn" title="Add recipe book" aria-label="Add recipe book" @click="adding = true">
      <i class="fa-solid fa-plus"></i>
    </button>

    <div v-if="auth.user" class="user-avatar" :title="auth.user.email" @click="signOut">
      <img v-if="auth.user.user_metadata?.avatar_url" :src="auth.user.user_metadata.avatar_url" alt="avatar" referrerpolicy="no-referrer" />
      <span v-else>{{ auth.user.email?.charAt(0).toUpperCase() }}</span>
    </div>
  </aside>
</template>

<style scoped>
.book-name-input {
  width: 40px;
  font-size: 0.65rem;
  padding: 3px 4px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--paper);
  color: var(--text);
  text-align: center;
  font-family: var(--font-body);
}
.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--amber);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  margin-top: 4px;
  flex-shrink: 0;
  cursor: pointer;
}
.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
