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

type Point = { x: number; y: number }
type Stroke = { pts: Point[]; width: number }

const PEN_SIZES = { s: 2.5, m: 5, l: 10 } as const
type PenKey = keyof typeof PEN_SIZES
const penSize = ref<PenKey>('m')

const strokes = ref<Stroke[]>([])
let currentStroke: Point[] = []
let isDrawing = false
let ctx: CanvasRenderingContext2D | null = null

// Offscreen canvas holds all committed (completed) strokes.
// Only the current in-progress stroke is drawn on top each rAF frame.
// This means each stroke is painted exactly once as a full bezier path —
// no per-segment overlap, so the line is perfectly solid.
let committedCanvas: HTMLCanvasElement | null = null
let committedCtx: CanvasRenderingContext2D | null = null
let rafId: number | null = null
let antOffset = 0  // animated dash offset for marching ants border
let antRafId: number | null = null

const STROKE_COLOR = '#ffffff'

// ── Draw a single stroke as one complete smooth bezier path ──────────────────
function drawStroke(c: CanvasRenderingContext2D, stroke: Point[], w: number, h: number, lineWidth: number) {
  if (stroke.length === 0) return
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.strokeStyle = STROKE_COLOR
  c.lineWidth = lineWidth
  if (stroke.length === 1) {
    c.beginPath()
    c.arc(stroke[0].x * w, stroke[0].y * h, lineWidth / 2, 0, Math.PI * 2)
    c.fillStyle = STROKE_COLOR
    c.fill()
    return
  }
  c.beginPath()
  c.moveTo(stroke[0].x * w, stroke[0].y * h)
  for (let i = 1; i < stroke.length - 1; i++) {
    const mx = ((stroke[i].x + stroke[i + 1].x) / 2) * w
    const my = ((stroke[i].y + stroke[i + 1].y) / 2) * h
    c.quadraticCurveTo(stroke[i].x * w, stroke[i].y * h, mx, my)
  }
  c.lineTo(stroke[stroke.length - 1].x * w, stroke[stroke.length - 1].y * h)
  c.stroke()
}

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

  // Mirror size on offscreen committed canvas
  committedCanvas = document.createElement('canvas')
  committedCanvas.width = w * dpr
  committedCanvas.height = h * dpr
  committedCtx = committedCanvas.getContext('2d')
  if (!committedCtx) return
  committedCtx.scale(dpr, dpr)

  // Replay any existing strokes onto the committed canvas
  replayStrokes()
}

function replayStrokes() {
  if (!committedCtx || !committedCanvas) return
  const dpr = window.devicePixelRatio || 1
  const w = committedCanvas.width / dpr
  const h = committedCanvas.height / dpr
  committedCtx.clearRect(0, 0, w, h)
  for (const s of strokes.value) {
    drawStroke(committedCtx, s.pts, w, h, s.width)
  }
  renderFrame()
}

// ── Marching ants border ──────────────────────────────────────────────────────
function drawMarchingAnts(c: CanvasRenderingContext2D, w: number, h: number) {
  const inset = 6
  c.save()
  c.setLineDash([14, 8])
  c.lineDashOffset = -antOffset
  c.strokeStyle = 'rgba(255,255,255,0.55)'
  c.lineWidth = 1.5
  c.strokeRect(inset, inset, w - inset * 2, h - inset * 2)
  c.restore()
}

function renderFrame() {
  const canvas = canvasEl.value
  if (!ctx || !canvas || !committedCanvas) return
  const dpr = window.devicePixelRatio || 1
  const w = canvas.width / dpr
  const h = canvas.height / dpr
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(committedCanvas, 0, 0, w, h)
  if (currentStroke.length > 0) {
    drawStroke(ctx, currentStroke, w, h, PEN_SIZES[penSize.value])
  }
  drawMarchingAnts(ctx, w, h)
}

// Keep the ants moving even when not drawing
function startAnts() {
  if (antRafId !== null) return
  const tick = () => {
    antOffset = (antOffset + 0.35) % 22
    renderFrame()
    antRafId = requestAnimationFrame(tick)
  }
  antRafId = requestAnimationFrame(tick)
}
function stopAnts() {
  if (antRafId !== null) { cancelAnimationFrame(antRafId); antRafId = null }
}

function scheduleRender() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => { rafId = null; renderFrame() })
}

function getPosFromPointer(e: PointerEvent): Point | null {
  const canvas = canvasEl.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
}

function onPointerDown(e: PointerEvent) {
  if (!drawMode.value) return
  e.preventDefault()
  ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
  isDrawing = true
  currentStroke = []
  const p = getPosFromPointer(e)
  if (p) { currentStroke.push(p); scheduleRender() }
}

function onPointerMove(e: PointerEvent) {
  if (!isDrawing || !drawMode.value) return
  e.preventDefault()
  const p = getPosFromPointer(e)
  if (!p) return
  currentStroke.push(p)
  scheduleRender()
}

function onPointerUp(e: PointerEvent) {
  if (!isDrawing) return
  e.preventDefault()
  isDrawing = false
  if (currentStroke.length > 0 && committedCtx && committedCanvas) {
    const dpr = window.devicePixelRatio || 1
    const w = committedCanvas.width / dpr
    const h = committedCanvas.height / dpr
    const width = PEN_SIZES[penSize.value]
    drawStroke(committedCtx, currentStroke, w, h, width)
    strokes.value.push({ pts: [...currentStroke], width })
    currentStroke = []
    scheduleRender()
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
  await nextTick()
  initCanvas()
  startAnts()
}

function exitDrawMode() {
  stopAnts()
  drawMode.value = false
  strokes.value = []
  currentStroke = []
  ctx = null
  committedCtx = null
  committedCanvas = null
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
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
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    for (const s of strokes.value) {
      drawStroke(fctx, s.pts, w, h, s.width)
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
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    />

    <!-- Draw mode toolbar -->
    <div v-if="drawMode" class="draw-toolbar">
      <button class="draw-tool-btn" title="Undo last stroke" :disabled="strokes.length === 0" @click="undoStroke">
        <i class="fa-solid fa-rotate-left"></i>
      </button>
      <button class="draw-tool-btn draw-tool-btn--danger" title="Clear all" :disabled="strokes.length === 0" @click="clearAll">
        <i class="fa-solid fa-trash-can"></i>
      </button>
      <span class="draw-toolbar-divider"></span>
      <!-- Pen size picker -->
      <div class="draw-size-group" role="group" aria-label="Pen size">
        <button
          v-for="sz in (['s','m','l'] as const)"
          :key="sz"
          class="draw-size-btn"
          :class="{ active: penSize === sz }"
          :title="{ s: 'Small', m: 'Medium', l: 'Large' }[sz]"
          @click="penSize = sz"
        >
          <span class="draw-size-dot" :data-size="sz"></span>
        </button>
      </div>
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

