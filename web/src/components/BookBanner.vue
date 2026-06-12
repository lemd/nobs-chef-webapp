<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { state } from '../state.ts'
import { createInvite, saveDrawing, clearDrawing } from '../api.ts'
import { auth } from '../composables/useAuth.ts'

const book = computed(() => state.currentBook)
const members = computed(() => state.bookMembers)
const isOwner = computed(() => book.value?.owner_id === auth.user?.id)

// ── Invite modal ─────────────────────────────────────────────────────────────
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
  } catch {
    inviteError.value = 'Could not generate invite link.'
  } finally {
    inviteLoading.value = false
  }
}
function closeModal() { modalOpen.value = false; copied.value = false }
async function copyLink() {
  if (!inviteUrl.value) return
  await navigator.clipboard.writeText(inviteUrl.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2500)
}

// ── Drawing layer ─────────────────────────────────────────────────────────────
const drawMode = ref(false)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const bannerEl = ref<HTMLElement | null>(null)
const drawSaving = ref(false)
const drawError = ref('')

// Each stroke is an array of {x,y} normalised to [0..1] so we can replay at any DPR
type Point = { x: number; y: number }
const strokes = ref<Point[][]>([])
let currentStroke: Point[] = []
let isDrawing = false
let ctx: CanvasRenderingContext2D | null = null

function initCanvas() {
  const canvas = canvasEl.value
  const banner = bannerEl.value
  if (!canvas || !banner) return
  const dpr = window.devicePixelRatio || 1
  const w = banner.offsetWidth
  const h = banner.offsetHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  replayStrokes()
}

function replayStrokes() {
  const canvas = canvasEl.value
  if (!ctx || !canvas) return
  const dpr = window.devicePixelRatio || 1
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
  const w = canvas.offsetWidth
  const h = canvas.offsetHeight
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = 3
  for (const stroke of strokes.value) {
    if (stroke.length < 2) continue
    ctx.beginPath()
    ctx.moveTo(stroke[0].x * w, stroke[0].y * h)
    for (let i = 1; i < stroke.length; i++) {
      // Smooth bezier through midpoints
      const prev = stroke[i - 1]
      const curr = stroke[i]
      const mx = ((prev.x + curr.x) / 2) * w
      const my = ((prev.y + curr.y) / 2) * h
      ctx.quadraticCurveTo(prev.x * w, prev.y * h, mx, my)
    }
    const last = stroke[stroke.length - 1]
    ctx.lineTo(last.x * w, last.y * h)
    ctx.stroke()
  }
}

function getPos(e: MouseEvent | TouchEvent): Point | null {
  const canvas = canvasEl.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  if (e instanceof TouchEvent) {
    const t = e.touches[0]
    if (!t) return null
    return { x: (t.clientX - rect.left) / rect.width, y: (t.clientY - rect.top) / rect.height }
  }
  return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
}

function onPointerDown(e: MouseEvent | TouchEvent) {
  if (!drawMode.value) return
  e.preventDefault()
  isDrawing = true
  currentStroke = []
  const p = getPos(e)
  if (p) {
    currentStroke.push(p)
    // draw a dot for taps
    if (ctx && canvasEl.value) {
      ctx.beginPath()
      ctx.arc(p.x * canvasEl.value.offsetWidth, p.y * canvasEl.value.offsetHeight, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.fill()
    }
  }
}

function onPointerMove(e: MouseEvent | TouchEvent) {
  if (!isDrawing || !drawMode.value) return
  e.preventDefault()
  const p = getPos(e)
  if (!p || !ctx || !canvasEl.value) return
  currentStroke.push(p)
  const w = canvasEl.value.offsetWidth
  const h = canvasEl.value.offsetHeight
  if (currentStroke.length >= 2) {
    const prev = currentStroke[currentStroke.length - 2]
    const curr = currentStroke[currentStroke.length - 1]
    const mx = ((prev.x + curr.x) / 2) * w
    const my = ((prev.y + curr.y) / 2) * h
    ctx.beginPath()
    ctx.moveTo(prev.x * w, prev.y * h)
    ctx.quadraticCurveTo(prev.x * w, prev.y * h, mx, my)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'
    ctx.lineWidth = 3
    ctx.stroke()
  }
}

function onPointerUp(e: MouseEvent | TouchEvent) {
  if (!isDrawing) return
  e.preventDefault()
  isDrawing = false
  if (currentStroke.length > 0) {
    strokes.value.push([...currentStroke])
    currentStroke = []
  }
}

function undoStroke() {
  if (strokes.value.length === 0) return
  strokes.value.pop()
  replayStrokes()
}

async function clearAll() {
  strokes.value = []
  replayStrokes()
}

async function enterDrawMode() {
  drawMode.value = true
  drawError.value = ''
  // Load existing strokes from drawing_url is not needed client-side —
  // we just render the saved PNG as an overlay and start fresh on top.
  // (Existing strokes are flattened into the saved PNG.)
  await nextTick()
  initCanvas()
}

function exitDrawMode() {
  drawMode.value = false
  strokes.value = []
  currentStroke = []
  ctx = null
}

async function saveAndExit() {
  const canvas = canvasEl.value
  if (!canvas || !book.value) return
  drawSaving.value = true
  drawError.value = ''
  try {
    // If there's an existing saved drawing, we need to composite it under our new strokes
    // so nothing is lost. We do this by drawing the saved PNG onto a temp canvas first.
    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = canvas.width
    finalCanvas.height = canvas.height
    const fctx = finalCanvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    fctx.scale(dpr, dpr)

    // Draw existing saved PNG as base if present
    const savedUrl = book.value.drawing_url
    if (savedUrl) {
      await new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          fctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight)
          resolve()
        }
        img.onerror = () => resolve() // ignore — start fresh if load fails
        img.src = savedUrl
      })
    }

    // Draw current session strokes on top
    fctx.lineCap = 'round'
    fctx.lineJoin = 'round'
    fctx.strokeStyle = 'rgba(255,255,255,0.92)'
    fctx.lineWidth = 3
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    for (const stroke of strokes.value) {
      if (stroke.length < 2) continue
      fctx.beginPath()
      fctx.moveTo(stroke[0].x * w, stroke[0].y * h)
      for (let i = 1; i < stroke.length; i++) {
        const prev = stroke[i - 1]
        const curr = stroke[i]
        const mx = ((prev.x + curr.x) / 2) * w
        const my = ((prev.y + curr.y) / 2) * h
        fctx.quadraticCurveTo(prev.x * w, prev.y * h, mx, my)
      }
      const last = stroke[stroke.length - 1]
      fctx.lineTo(last.x * w, last.y * h)
      fctx.stroke()
    }

    const blob = await new Promise<Blob | null>(resolve => finalCanvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Could not export canvas')

    const url = await saveDrawing(book.value.id, blob)
    // Update state so overlay renders immediately without re-fetch
    if (state.currentBook) state.currentBook.drawing_url = url
    exitDrawMode()
  } catch (e: unknown) {
    drawError.value = e instanceof Error ? e.message : 'Save failed'
  } finally {
    drawSaving.value = false
  }
}

async function removeDrawing() {
  if (!book.value) return
  if (!confirm('Remove the drawing from this banner?')) return
  drawSaving.value = true
  drawError.value = ''
  try {
    await clearDrawing(book.value.id)
    if (state.currentBook) state.currentBook.drawing_url = null
    exitDrawMode()
  } catch (e: unknown) {
    drawError.value = e instanceof Error ? e.message : 'Failed to remove drawing'
  } finally {
    drawSaving.value = false
  }
}

// Resize canvas if window resizes while in draw mode
function onResize() { if (drawMode.value) initCanvas() }
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

// Exit draw mode when book changes
watch(() => book.value?.id, () => { if (drawMode.value) exitDrawMode() })
</script>

<template>
  <div v-if="book" ref="bannerEl" class="book-banner">

    <!-- Saved drawing overlay (shown when NOT in draw mode) -->
    <img
      v-if="book.drawing_url && !drawMode"
      :src="book.drawing_url"
      class="book-banner-drawing"
      alt=""
      aria-hidden="true"
    />

    <!-- Live canvas (shown in draw mode) -->
    <canvas
      v-if="drawMode"
      ref="canvasEl"
      class="book-banner-canvas"
      @mousedown="onPointerDown"
      @mousemove="onPointerMove"
      @mouseup="onPointerUp"
      @mouseleave="onPointerUp"
      @touchstart.passive="false"
      @touchmove.passive="false"
      @touchend.passive="false"
      v-on="{ touchstart: onPointerDown, touchmove: onPointerMove, touchend: onPointerUp }"
    />

    <!-- Draw mode toolbar -->
    <div v-if="drawMode" class="draw-toolbar">
      <button class="draw-tool-btn" title="Undo last stroke" :disabled="strokes.length === 0" @click="undoStroke">
        <i class="fa-solid fa-rotate-left"></i>
      </button>
      <button class="draw-tool-btn draw-tool-btn--danger" title="Clear all" :disabled="strokes.length === 0" @click="clearAll">
        <i class="fa-solid fa-trash-can"></i>
      </button>
      <span class="draw-toolbar-spacer"></span>
      <span v-if="drawError" class="draw-toolbar-error">{{ drawError }}</span>
      <button class="draw-tool-btn draw-tool-btn--muted" title="Cancel" @click="exitDrawMode">
        Cancel
      </button>
      <button class="draw-tool-btn draw-tool-btn--save" :disabled="drawSaving" title="Save drawing" @click="saveAndExit">
        <i v-if="drawSaving" class="fa-solid fa-spinner fa-spin"></i>
        <i v-else class="fa-solid fa-check"></i>
        {{ drawSaving ? 'Saving…' : 'Save' }}
      </button>
    </div>

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

        <!-- Draw toggle (owner only, not in draw mode) -->
        <button
          v-if="isOwner && !drawMode"
          class="banner-draw-btn"
          :title="book.drawing_url ? 'Edit drawing' : 'Draw on banner'"
          @click="enterDrawMode"
        >
          <i class="fa-solid fa-pen-nib"></i>
        </button>

        <!-- Remove drawing (owner only, has drawing, not in draw mode) -->
        <button
          v-if="isOwner && book.drawing_url && !drawMode"
          class="banner-draw-btn banner-draw-btn--remove"
          title="Remove drawing"
          @click="removeDrawing"
        >
          <i class="fa-solid fa-eraser"></i>
        </button>
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
              <button class="invite-copy-btn" :class="{ copied }" @click="copyLink">
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

