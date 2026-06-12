<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { signInWithGoogle, auth } from '../composables/useAuth.js'
import { fetchInviteInfo, acceptInvite } from '../api.js'

const route = useRoute()
const inviteToken = route.query.token ?? null

const error = ref(null)
const inviteInfo = ref(null)
const accepting = ref(false)

// If arriving via an invite link, fetch book info to show context
if (inviteToken) {
  fetchInviteInfo(inviteToken)
    .then(info => { inviteInfo.value = info })
    .catch(e => { error.value = e.message })
}

async function handleSignIn() {
  try {
    error.value = null
    // After OAuth redirect, App.vue will call acceptInvite if token is present
    if (inviteToken) {
      sessionStorage.setItem('pendingInviteToken', inviteToken)
    }
    await signInWithGoogle()
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <div class="max-w-sm mx-auto pt-16 text-center px-4">
    <h1 class="font-display text-4xl font-normal mb-3">
      {{ inviteInfo ? 'Join a recipe book' : 'Sign in' }}
    </h1>

    <p v-if="inviteInfo" class="text-[var(--muted)] text-sm mb-8">
      Join <strong>{{ inviteInfo.bookName }}</strong> on Nobs Chef.
    </p>
    <p v-else class="text-[var(--dim)] text-sm mb-8">
      Sign in to access your recipe books.
    </p>

    <button
      class="google-signin-btn"
      :disabled="auth.loading"
      @click="handleSignIn"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Continue with Google
    </button>

    <p v-if="error" class="mt-4 text-red-500 text-sm">{{ error }}</p>
  </div>
</template>

<style scoped>
.google-signin-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  background: #fff;
  color: #3c4043;
  border: 1px solid #dadce0;
  border-radius: 8px;
  font-size: 0.92rem;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--font-body);
  transition: box-shadow 0.15s ease;
}
.google-signin-btn:hover {
  box-shadow: 0 1px 6px rgba(0,0,0,0.12);
}
.google-signin-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

