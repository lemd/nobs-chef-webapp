<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { state } from '../state.ts'
import { createBook } from '../api.ts'

const router = useRouter()
const books = computed(() => state.books)
const activeBookId = computed(() => state.currentBook?.id ?? null)

function avatarInitial(name: string) {
  return name?.charAt(0).toUpperCase() ?? '?'
}

// Desktop: select book
function selectBook(book: typeof state.books[0]) {
  state.currentBook = book
  router.push('/')
}

// Mobile drawer
const mobileOpen = ref(false)
function openMobile() { mobileOpen.value = true }
function closeMobile() { mobileOpen.value = false }
function selectBookMobile(book: typeof state.books[0]) {
  state.currentBook = book
  router.push('/')
  closeMobile()
}

// Create-book modal
const modalOpen = ref(false)
const newBookName = ref('')
const creating = ref(false)
const createError = ref('')

function openCreateModal(fromMobile = false) {
  if (fromMobile) closeMobile()
  newBookName.value = ''
  createError.value = ''
  modalOpen.value = true
}

function closeCreateModal() {
  modalOpen.value = false
  creating.value = false
}

async function submitCreate() {
  const name = newBookName.value.trim()
  if (!name) { createError.value = 'Please enter a book name.'; return }
  creating.value = true
  createError.value = ''
  try {
    const book = await createBook(name)
    state.books.push(book)
    state.currentBook = book
    closeCreateModal()
    router.push('/')
  } catch (e) {
    createError.value = (e as Error).message ?? 'Could not create book.'
    creating.value = false
  }
}

function goProfile(fromMobile = false) {
  if (fromMobile) closeMobile()
  router.push('/profile')
}
</script>

<template>
  <!-- Desktop sidebar (hidden on mobile) -->
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

    <button
      class="book-add-btn"
      title="New recipe book"
      aria-label="New recipe book"
      @click="openCreateModal()"
    >
      <i class="fa-solid fa-plus"></i>
    </button>

    <div class="sidebar-gap"></div>

    <button
      class="book-add-btn sidebar-profile-btn"
      title="Profile"
      aria-label="Profile"
      @click="goProfile()"
    >
      <i class="fa-solid fa-circle-user"></i>
    </button>
  </aside>

  <!-- Mobile hamburger button (fixed, shown only on mobile) -->
  <Teleport to="body">
    <button class="mobile-menu-btn" aria-label="Open books menu" @click="openMobile">
      <i class="fa-solid fa-bars"></i>
    </button>

    <!-- Mobile drawer overlay -->
    <Transition name="mobile-drawer">
      <div v-if="mobileOpen" class="mobile-drawer-backdrop" @click.self="closeMobile">
        <nav class="mobile-drawer">
          <div class="mobile-drawer-header">
            <span class="mobile-drawer-wordmark">Nobs</span>
            <button class="mobile-drawer-close" aria-label="Close" @click="closeMobile">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="mobile-drawer-books">
            <button
              v-for="book in books"
              :key="book.id"
              class="mobile-book-row"
              :class="{ active: book.id === activeBookId }"
              @click="selectBookMobile(book)"
            >
              <span class="mobile-book-initial">{{ avatarInitial(book.name) }}</span>
              <span class="mobile-book-name">{{ book.name }}</span>
              <i v-if="book.id === activeBookId" class="fa-solid fa-check mobile-book-check"></i>
            </button>
          </div>

          <div class="mobile-drawer-actions">
            <button class="mobile-drawer-action-btn" @click="openCreateModal(true)">
              <i class="fa-solid fa-plus"></i>
              New recipe book
            </button>
            <button class="mobile-drawer-action-btn" @click="goProfile(true)">
              <i class="fa-solid fa-circle-user"></i>
              Profile
            </button>
          </div>
        </nav>
      </div>
    </Transition>
  </Teleport>

  <!-- Create book modal -->
  <Teleport to="body">
    <div v-if="modalOpen" class="invite-modal-backdrop" @click.self="closeCreateModal">
      <div class="invite-modal" role="dialog" aria-modal="true" aria-label="New recipe book">
        <button class="invite-modal-close" aria-label="Close" @click="closeCreateModal">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <h3 class="invite-modal-title">New recipe book</h3>
        <p class="invite-modal-hint">Give your book a name. You can always change it later.</p>
        <div class="invite-link-row">
          <input
            v-model="newBookName"
            class="invite-link-input"
            placeholder="e.g. Weekend Dinners"
            maxlength="60"
            autofocus
            @keydown.enter="submitCreate"
            @keydown.esc="closeCreateModal"
          />
          <button
            class="invite-copy-btn"
            :disabled="creating"
            @click="submitCreate"
          >
            <i v-if="creating" class="fa-solid fa-spinner fa-spin"></i>
            <i v-else class="fa-solid fa-check"></i>
            {{ creating ? 'Creating…' : 'Create book' }}
          </button>
          <p v-if="createError" class="invite-modal-error">{{ createError }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sidebar-profile-btn {
  font-size: 1.1rem;
}
</style>
