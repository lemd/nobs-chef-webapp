<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { auth, signOut } from '../composables/useAuth.ts'
import { state } from '../state.ts'

const router = useRouter()
const user = computed(() => auth.user)

const displayName = computed(() =>
  user.value?.user_metadata?.full_name || user.value?.email || 'You'
)
const avatarUrl = computed(() => user.value?.user_metadata?.avatar_url ?? null)
const initial = computed(() => displayName.value.charAt(0).toUpperCase())

const recipeCount = computed(() => state.allRecipes.length)
const bookCount = computed(() => state.books.length)

async function handleSignOut() {
  await signOut()
  router.push('/login')
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
          <span class="profile-stat-value">{{ bookCount }}</span>
          <span class="profile-stat-label">{{ bookCount === 1 ? 'Book' : 'Books' }}</span>
        </div>
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
</style>
