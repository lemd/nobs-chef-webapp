<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { state } from '../state.js'
import { useQueue } from '../composables/useQueue.js'

const router = useRouter()
const { queue, addToQueue } = useQueue()

const urlInput = ref('')
const textInput = ref('')
const tab = ref('url') // 'url' | 'text'
const statusMsg = ref('')
const statusError = ref(false)

function submitUrl() {
  const raw = urlInput.value.trim()
  if (!raw) return
  // Support pasting multiple URLs (one per line or comma-separated)
  const urls = raw.split(/[\n,]+/).map((u) => u.trim()).filter((u) => u.startsWith('http'))
  if (!urls.length) {
    statusMsg.value = 'Please enter a valid URL.'
    statusError.value = true
    return
  }
  urls.forEach((url) => addToQueue({ url }))
  urlInput.value = ''
  statusMsg.value = ''
  statusError.value = false
}

function submitText() {
  const raw = textInput.value.trim()
  if (!raw) return
  addToQueue({ text: raw })
  textInput.value = ''
  statusMsg.value = ''
  statusError.value = false
}

// Navigate to recipe when scraping completes
window.addEventListener('recipe-scraped', (e) => {
  const { data, hash } = e.detail
  state.currentRecipe = data
  state.currentSourceUrl = data.sourceUrl ?? null
  state.activeFile = hash ? `${hash}.json` : null
  router.push(`/r/${hash}`)
}, { once: false })

const pendingCount = computed(() => queue.items.filter((i) => i.qstate === 'pending' || i.qstate === 'processing').length)
const queueItems = computed(() => [...queue.items].reverse())
</script>

<template>
  <div class="max-w-xl mx-auto px-0">
    <!-- Tab toggle -->
    <div class="flex gap-0 mb-6 border-b border-[var(--line)]">
      <button
        class="text-[0.72rem] font-bold tracking-[0.1em] uppercase pb-2 px-0 mr-6 border-b-2 bg-none border-none cursor-pointer font-[var(--font-body)]"
        :class="tab === 'url' ? 'border-[var(--amber)] text-[var(--amber)]' : 'border-transparent text-[var(--dim)] hover:text-[var(--text)]'"
        @click="tab = 'url'"
      >From URL</button>
      <button
        class="text-[0.72rem] font-bold tracking-[0.1em] uppercase pb-2 px-0 border-b-2 bg-none border-none cursor-pointer font-[var(--font-body)]"
        :class="tab === 'text' ? 'border-[var(--amber)] text-[var(--amber)]' : 'border-transparent text-[var(--dim)] hover:text-[var(--text)]'"
        @click="tab = 'text'"
      >Paste text</button>
    </div>

    <!-- URL tab -->
    <div v-if="tab === 'url'">
      <label class="block text-[0.65rem] font-bold tracking-[0.14em] uppercase text-[var(--dim)] mb-1">
        Recipe URL
      </label>
      <textarea
        v-model="urlInput"
        rows="3"
        placeholder="https://example.com/recipe&#10;(one per line or comma-separated)"
        class="w-full border border-[var(--line)] rounded-lg bg-white text-[var(--text)] font-[var(--font-body)] text-sm p-3 resize-none outline-none focus:border-[var(--amber)]"
        @keydown.ctrl.enter.prevent="submitUrl"
        @keydown.meta.enter.prevent="submitUrl"
      ></textarea>
      <p class="text-[0.68rem] text-[var(--dim)] mt-1">Tip: Paste multiple URLs, one per line.</p>
      <button
        class="mt-3 bg-[var(--amber)] text-white font-[var(--font-body)] font-semibold text-sm tracking-wide px-5 py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90 disabled:opacity-50"
        :disabled="queue.running"
        @click="submitUrl"
      >
        <span v-if="queue.running" class="spinner"></span>
        {{ queue.running ? 'Scraping…' : 'Scrape' }}
      </button>
    </div>

    <!-- Text tab -->
    <div v-else>
      <label class="block text-[0.65rem] font-bold tracking-[0.14em] uppercase text-[var(--dim)] mb-1">
        Paste recipe text
      </label>
      <textarea
        v-model="textInput"
        rows="12"
        placeholder="Paste the full recipe text here…"
        class="w-full border border-[var(--line)] rounded-lg bg-white text-[var(--text)] font-[var(--font-body)] text-sm p-3 resize-none outline-none focus:border-[var(--amber)]"
      ></textarea>
      <button
        class="mt-3 bg-[var(--amber)] text-white font-[var(--font-body)] font-semibold text-sm tracking-wide px-5 py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90 disabled:opacity-50"
        :disabled="queue.running"
        @click="submitText"
      >
        <span v-if="queue.running" class="spinner"></span>
        {{ queue.running ? 'Processing…' : 'Parse recipe' }}
      </button>
    </div>

    <!-- Status / error -->
    <p v-if="statusMsg" class="mt-3 text-sm" :class="statusError ? 'text-red-600' : 'text-[var(--dim)]'">
      {{ statusMsg }}
    </p>

    <!-- Queue -->
    <div v-if="queue.items.length" class="mt-6">
      <p class="text-[0.65rem] font-bold tracking-[0.14em] uppercase text-[var(--dim)] mb-2">Queue</p>
      <ul class="queue-list">
        <li
          v-for="(item, i) in queueItems"
          :key="i"
          class="queue-item"
          :data-state="item.qstate"
        >
          <span class="queue-item-url">{{ item.label }}</span>
          <span class="queue-item-state">
            <span v-if="item.qstate === 'processing'" class="spinner"></span>
            <template v-else-if="item.qstate === 'done'">✓</template>
            <template v-else-if="item.qstate === 'error'">{{ item.error }}</template>
            <template v-else>—</template>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
