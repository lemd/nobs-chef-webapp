<script setup lang="ts">
import { watch, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { state } from './state.ts'
import { auth } from './composables/useAuth.ts'
import { usePinnedRecipes } from './composables/usePinnedRecipes.ts'
import { useRecipeList } from './composables/useRecipeList.ts'
import { fetchBooks, acceptInvite, fetchBookMembers, createBook } from './api.ts'
import { clearCache, getBooks, setBooks, invalidateBooks } from './composables/dataCache.ts'
import MosaicStrip from './components/MosaicStrip.vue'
import AppHeader from './components/AppHeader.vue'
import AppDrawer from './components/AppDrawer.vue'
import GuideModal from './components/GuideModal.vue'
import IngPanel from './components/panel/IngPanel.vue'
import BookSidebar from './components/BookSidebar.vue'

const route = useRoute()
const router = useRouter()
usePinnedRecipes()
useRecipeList()

const bookInitial = computed(() =>
  state.currentBook?.name?.charAt(0).toUpperCase() ?? 'B',
)

// Close panel when leaving the recipe view
watch(
  () => route.name,
  (name) => { if (name !== 'recipe') state.panelOpen = false },
)

// Init season filter on load
;(function () {
  const m = new Date().getMonth()
  const season =
    m >= 2 && m <= 4 ? 'spring' :
    m >= 5 && m <= 7 ? 'summer' :
    m >= 8 && m <= 10 ? 'autumn' : 'winter'
  state.activeFilters.season.add(season)
})()

// Load members whenever the active book changes
watch(() => state.currentBook, async (book) => {
  if (!book) { state.bookMembers = []; return }
  state.bookMembers = await fetchBookMembers(book.id).catch(() => [])
})

onMounted(() => {
  // Auth is already initialised by main.ts — just watch for sign-in/out
  watch(() => auth.user?.id, async (userId) => {
    if (!userId) {
      clearCache()
      state.books = []
      state.currentBook = null
      state.bookMembers = []
      return
    }

    // Accept a pending invite (set before OAuth redirect)
    const pendingToken = sessionStorage.getItem('pendingInviteToken')
    if (pendingToken) {
      sessionStorage.removeItem('pendingInviteToken')
      try {
        await acceptInvite(pendingToken)
        invalidateBooks(userId)
      } catch (e) {
        console.warn('Invite accept failed:', (e as Error).message)
      }
    }

    const previousBookId = state.currentBook?.id
    const cachedBooks = getBooks(userId)
    if (cachedBooks?.length) {
      state.books = cachedBooks
      state.currentBook =
        cachedBooks.find((b) => b.id === previousBookId) ?? cachedBooks[0]
    }

    let books = cachedBooks
    if (!books?.length) {
      books = await fetchBooks().catch(() => [])
      if (books.length === 0) {
        try {
          const newBook = await createBook('My Recipes')
          books = [newBook]
        } catch (e) {
          console.warn('Auto-create book failed:', (e as Error).message)
        }
      }
      if (books.length) setBooks(userId, books)
    }

    state.books = books
    if (books.length > 0) {
      state.currentBook = books.find((b) => b.id === previousBookId) ?? books[0]
    }

    // Redirect away from login
    if (route.name === 'login' || route.name === 'join') {
      router.push('/')
    }
  }, { immediate: true })
})
</script>

<template>
  <AppDrawer />
  <GuideModal />
  <div class="app-layout">
    <BookSidebar />
    <div class="app-main">
      <div id="app-scroll" :class="{ 'ing-open': state.panelOpen, 'recipe-view': route.name === 'recipe' }">
        <header class="mobile-top-bar">
          <button
            class="mobile-menu-btn"
            aria-label="Open books menu"
            @click="state.mobileBookMenuOpen = true"
          >
            <span class="menu-book-label">{{ bookInitial }}</span>
            <i class="fa-solid fa-bars"></i>
          </button>
        </header>
        <MosaicStrip v-if="route.name !== 'recipe'" :loading="state.loading" />
        <AppHeader v-if="route.name !== 'recipe'" />
        <RouterView />
      </div>
    </div>
    <IngPanel v-if="route.name === 'recipe'" />
  </div>
</template>
