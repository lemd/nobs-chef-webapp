<script setup lang="ts">
import { ref, computed } from 'vue'
import { state } from '../state.ts'
import { createInvite } from '../api.ts'

const book = computed(() => state.currentBook)
const members = computed(() => state.bookMembers)

// Modal state
const modalOpen = ref(false)
const inviteUrl = ref<string | null>(null)
const inviteLoading = ref(false)
const inviteError = ref('')
const copied = ref(false)

async function openModal() {
  if (!book.value) return
  modalOpen.value = true
  inviteUrl.value = null
  inviteError.value = ''
  inviteLoading.value = true
  try {
    const res = await createInvite(book.value.id)
    inviteUrl.value = res.url
  } catch (e) {
    inviteError.value = 'Could not generate invite link.'
  } finally {
    inviteLoading.value = false
  }
}

function closeModal() {
  modalOpen.value = false
  copied.value = false
}

async function copyLink() {
  if (!inviteUrl.value) return
  await navigator.clipboard.writeText(inviteUrl.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2500)
}
</script>

<template>
  <div v-if="book" class="book-banner">
    <div class="book-banner-inner">
      <h2 class="book-banner-title">{{ book.name }}</h2>
      <div class="book-banner-row">
        <div class="member-stack">
          <div
            v-for="m in members"
            :key="m.userId"
            class="member-circle"
            :title="m.name || m.email || ''"
          >
            <img
              v-if="m.avatarUrl"
              :src="m.avatarUrl"
              :alt="m.name || ''"
              referrerpolicy="no-referrer"
            />
            <span v-else>{{ (m.name || m.email || '?').charAt(0).toUpperCase() }}</span>
          </div>
          <button class="member-invite-btn" title="Invite someone" aria-label="Invite someone" @click="openModal">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Invite modal -->
    <Teleport to="body">
      <div v-if="modalOpen" class="invite-modal-backdrop" @click.self="closeModal">
        <div class="invite-modal" role="dialog" aria-modal="true" :aria-label="`Invite to ${book?.name}`">
          <button class="invite-modal-close" aria-label="Close" @click="closeModal">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <h3 class="invite-modal-title">Invite to {{ book?.name }}</h3>
          <p class="invite-modal-hint">Anyone with this link can join this recipe book. Links expire after 7 days.</p>
          <div class="invite-link-row">
            <div v-if="inviteLoading" class="invite-link-loading">
              <span class="spinner"></span> Generating link…
            </div>
            <template v-else-if="inviteUrl">
              <input
                readonly
                :value="inviteUrl"
                class="invite-link-input"
                aria-label="Invite link"
                @focus="($event.target as HTMLInputElement).select()"
              />
              <button
                class="invite-copy-btn"
                :class="{ copied }"
                @click="copyLink"
              >
                <i class="fa-solid" :class="copied ? 'fa-check' : 'fa-copy'"></i>
                {{ copied ? 'Copied!' : 'Copy link' }}
              </button>
            </template>
            <p v-if="inviteError" class="invite-modal-error">{{ inviteError }}</p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
