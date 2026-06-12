<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth, signOut } from '../composables/useAuth.ts'
import { state } from '../state.ts'
import { leaveBook } from '../api.ts'

const router = useRouter()
const user = computed(() => auth.user)

const displayName = computed(() =>
  user.value?.user_metadata?.full_name || user.value?.email || 'You'
)
const avatarUrl = computed(() => user.value?.user_metadata?.avatar_url ?? null)
const initial = computed(() => displayName.value.charAt(0).toUpperCase())

const recipeCount = computed(() => state.allRecipes.length)
// All books with role info for displaying correct actions
const allBooks = computed(() => state.books.map(b => ({
  ...b,
  isOwner: b.owner_id === user.value?.id,
})))

async function handleSignOut() {
  await signOut()
  router.push('/login')
}

const leavingBookId = ref<number | null>(null)
const leaveError = ref('')

async function handleLeaveBook(bookId: number) {
  if (leavingBookId.value) return
  leavingBookId.value = bookId
  leaveError.value = ''
  try {
    const { deleted } = await leaveBook(bookId)
    state.books = state.books.filter(b => b.id !== bookId)
    if (state.currentBook?.id === bookId) {
      state.currentBook = state.books[0] ?? null
    }
    if (deleted && state.books.length === 0) {
      router.push('/')
    }
  } catch (e) {
    leaveError.value = (e as Error).message
  } finally {
    leavingBookId.value = null
  }
}
</script>

<template>
  <div class="profile-page">
    <div class="profile-card">
      <div class="profile-avatar">
        <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" referrerpolicy="no-referrer" />
        <span v-else>{{ initial }}</span>
      </div>
      <h1 class="profile-name">{{ displayName }}</h1>
      <p v-if="user?.email" class="profile-email">{{ user.email }}</p>

      <div class="profile-stats">
        <div class="profile-stat">
          <span class="profile-stat-value">{{ recipeCount }}</span>
          <span class="profile-stat-label">Recipes</span>
        </div>
        <div class="profile-stat-divider"></div>
        <div class="profile-stat">
          <span class="profile-stat-value">{{ state.books.length }}</span>
          <span class="profile-stat-label">{{ state.books.length === 1 ? 'Book' : 'Books' }}</span>
        </div>
      </div>

      <!-- All books with leave/delete actions -->
      <div v-if="allBooks.length" class="shared-books">
        <p class="shared-books-label">Recipe books</p>
        <div v-for="book in allBooks" :key="book.id" class="shared-book-row">
          <span class="shared-book-name">{{ book.name }}</span>
          <span v-if="book.isOwner" class="shared-book-owner-tag">owner</span>
          <button
            class="leave-btn"
            :class="{ 'leave-btn--delete': book.isOwner }"
            :disabled="leavingBookId === book.id"
            :title="book.isOwner ? 'Delete this book' : 'Leave this book'"
            @click="handleLeaveBook(book.id)"
          >
            <i class="fa-solid" :class="leavingBookId === book.id ? 'fa-spinner fa-spin' : book.isOwner ? 'fa-trash' : 'fa-right-from-bracket'"></i>
            {{ book.isOwner ? 'Delete' : 'Leave' }}
          </button>
        </div>
        <p v-if="leaveError" class="leave-error">{{ leaveError }}</p>
      </div>

      <button class="signout-btn" @click="handleSignOut">
        <i class="fa-solid fa-right-from-bracket"></i>
        Sign out
      </button>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  display: flex;
  justify-content: center;
  padding-top: 4rem;
}
.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
  max-width: 320px;
  width: 100%;
}
.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--amber);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.5rem;
}
.profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
.profile-name {
  font-family: var(--font-display);
  font-size: 1.8rem;
  font-weight: 400;
  margin: 0;
}
.profile-email {
  font-size: 0.82rem;
  color: var(--dim);
  margin: 0 0 0.75rem;
}
.profile-stats {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin: 0.75rem 0 1.5rem;
  padding: 1rem 2rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  width: 100%;
}
.profile-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}
.profile-stat-value {
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1;
}
.profile-stat-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dim);
}
.profile-stat-divider {
  width: 1px;
  height: 2rem;
  background: var(--line);
}
.signout-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 20px;
  background: none;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--muted);
  font-size: 0.85rem;
  font-family: var(--font-body);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.signout-btn:hover {
  border-color: var(--text);
  color: var(--text);
}
.shared-books {
  width: 100%;
  margin-bottom: 1rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
}
.shared-books-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dim);
  margin: 0;
  padding: 0.6rem 1rem 0.4rem;
}
.shared-book-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 1rem;
  border-top: 1px solid var(--line);
  gap: 0.5rem;
}
.shared-book-name { font-size: 0.88rem; color: var(--text); }
.leave-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  color: var(--dim);
  background: none;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 3px 10px;
  cursor: pointer;
  font-family: var(--font-body);
  white-space: nowrap;
  flex-shrink: 0;
}
.leave-btn:hover { color: #c0392b; border-color: #c0392b; }
.leave-btn:disabled { opacity: 0.5; cursor: default; }
.leave-btn--delete:hover { color: #c0392b; border-color: #c0392b; }
.leave-error { font-size: 0.78rem; color: #c0392b; margin: 0.25rem 0.75rem 0.5rem; }
.shared-book-owner-tag {
  font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--amber); border: 1px solid rgba(200,144,45,0.35);
  border-radius: 999px; padding: 0.1rem 0.5rem; white-space: nowrap;
}
</style>
