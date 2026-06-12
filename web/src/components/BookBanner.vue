<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { state } from '../state.ts'
import { createInvite, saveDrawing, clearDrawing, saveBannerImage, clearBannerImage } from '../api.ts'
import { auth } from '../composables/useAuth.ts'
import { resizeImage } from '../utils/imageUpload.ts'

const book = computed(() => state.currentBook)
const members = computed(() => state.bookMembers)
const isOwner = computed(() => book.value?.owner_id === auth.user?.id)
const router = useRouter()

// Dynamic background — uses uploaded banner_url if present, else fallback Pexels photo
const FALLBACK_BANNER = `url('https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg')`
const bannerStyle = computed(() => {
  const u = book.value?.banner_url
  return u ? `--banner-img: url('${u}')` : ''
})

// ── Banner image upload ───────────────────────────────────────────────────────
const bannerInputEl = ref<HTMLInputElement | null>(null)
const bannerUploading = ref(false)
const bannerError = ref('')

async function onBannerFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !book.value) return
  ;(e.target as HTMLInputElement).value = ''
  bannerUploading.value = true
  bannerError.value = ''
  try {
    const blob = await resizeImage(file, 1400, 0.85, true) // square crop
    const url = await saveBannerImage(book.value.id, blob)
    if (state.currentBook) state.currentBook.banner_url = url
  } catch (err: unknown) {
    bannerError.value = err instanceof Error ? err.message : 'Upload failed'
  } finally {
    bannerUploading.value = false
  }
}

async function resetBannerPhoto() {
  if (!book.value) return
  bannerUploading.value = true
  bannerError.value = ''
  try {
    await clearBannerImage(book.value.id)
    if (state.currentBook) state.currentBook.banner_url = null
  } catch (err: unknown) {
    bannerError.value = err instanceof Error ? err.message : 'Remove failed'
  } finally {
    bannerUploading.value = false
  }
}

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
const fabPillEl = ref<HTMLElement | null>(null)
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
  // Wipe the committed canvas entirely (including any preloaded existing drawing)
  if (committedCtx && committedCanvas) {
    const dpr = window.devicePixelRatio || 1
    committedCtx.clearRect(0, 0, committedCanvas.width / dpr, committedCanvas.height / dpr)
  }
  renderFrame()
}

// Helper: cover-crop drawImage — fills dstW×dstH from the center of img
function drawImageCover(
  c: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dstW: number,
  dstH: number,
) {
  const imgAR = img.naturalWidth / img.naturalHeight
  const dstAR = dstW / dstH
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
  if (imgAR > dstAR) {
    // image wider — crop sides
    sw = sh * dstAR
    sx = (img.naturalWidth - sw) / 2
  } else {
    // image taller — crop top/bottom
    sh = sw / dstAR
    sy = (img.naturalHeight - sh) / 2
  }
  c.drawImage(img, sx, sy, sw, sh, 0, 0, dstW, dstH)
}

// ── FLIP pill-width animation ─────────────────────────────────────────────────
// Captures the pill's current rendered width and, after Vue re-renders, animates
// from that width to the new natural width. Only width changes — height stays
// perfectly constant. The spring easing makes it bounce-overshoot at the end.
function flipPillWidth(pill: HTMLElement, startWidth: number) {
  const endWidth = pill.getBoundingClientRect().width
  if (Math.abs(endWidth - startWidth) < 2) return
  pill.style.overflow = 'hidden'
  const anim = pill.animate(
    [{ width: `${startWidth}px` }, { width: `${endWidth}px` }],
    { duration: 440, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  )
  anim.addEventListener('finish', () => { pill.style.overflow = '' })
}

async function enterDrawMode() {
  const pill = fabPillEl.value
  const startWidth = pill?.getBoundingClientRect().width ?? 0

  drawMode.value = true
  drawError.value = ''
  await nextTick()

  if (pill && startWidth) flipPillWidth(pill, startWidth)

  initCanvas()
  // Preload any existing saved drawing as the base layer on the committed canvas.
  // Use cover-crop drawImage so the preview matches what object-fit:cover shows.
  const savedUrl = book.value?.drawing_url
  if (savedUrl && committedCtx && committedCanvas) {
    const dpr = window.devicePixelRatio || 1
    const w = committedCanvas.width / dpr
    const h = committedCanvas.height / dpr
    await new Promise<void>((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { drawImageCover(committedCtx!, img, w, h); resolve() }
      img.onerror = () => resolve()
      img.src = savedUrl
    })
  }
  startAnts()
}

function exitDrawMode() {
  const pill = fabPillEl.value
  const startWidth = pill?.getBoundingClientRect().width ?? 0

  stopAnts()
  drawMode.value = false
  strokes.value = []
  currentStroke = []
  ctx = null
  committedCtx = null
  committedCanvas = null
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }

  if (pill && startWidth) {
    nextTick().then(() => flipPillWidth(pill, startWidth))
  }
}

async function saveAndExit() {
  if (!book.value) return
  drawSaving.value = true
  drawError.value = ''

  // Always export at a fixed square resolution.
  // Both the drawing PNG and the banner photo are 1:1 squares displayed via
  // object-fit:cover / background-size:cover — so they always crop identically
  // from center regardless of viewport shape.
  const EXPORT = 1400

  try {
    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = EXPORT
    finalCanvas.height = EXPORT
    const fctx = finalCanvas.getContext('2d')!

    // Composite any existing saved drawing first (cover-crop to EXPORT square)
    const savedUrl = book.value.drawing_url
    if (savedUrl) {
      await new Promise<void>((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => { drawImageCover(fctx, img, EXPORT, EXPORT); resolve() }
        img.onerror = () => resolve()
        img.src = savedUrl
      })
    }

    // Replay session strokes at EXPORT scale using normalised coordinates
    for (const s of strokes.value) {
      drawStroke(fctx, s.pts, EXPORT, EXPORT, s.width)
    }

    const blob = await new Promise<Blob | null>(resolve => finalCanvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Could not export canvas')

    const url = await saveDrawing(book.value.id, blob)
    if (state.currentBook) state.currentBook.drawing_url = url
    // Preload the new image so the overlay <img> is ready before canvas unmounts
    await new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => resolve()
      img.src = url
    })
    exitDrawMode()
  } catch (e: unknown) {
    drawError.value = e instanceof Error ? e.message : 'Save failed'
  } finally {
    drawSaving.value = false
  }
}

async function removeDrawing() {
  if (!book.value) return
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
  <div v-if="book" ref="bannerEl" class="book-banner" :style="bannerStyle">

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

    <div class="book-banner-inner">
      <h2 class="book-banner-title">{{ book.name }}</h2>
      <!-- Stats: recipe count + member count with separator line -->
      <div class="meta-row meta-row--hero banner-meta-row">
        <div class="meta-pill">
          <span class="label">Recipes</span>
          <span class="value">{{ state.allRecipes.length }}</span>
        </div>
        <div class="meta-pill">
          <span class="label">Members</span>
          <span class="value">{{ members.length }}</span>
        </div>
      </div>
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

        <input
          ref="bannerInputEl"
          type="file"
          accept="image/*"
          style="display:none"
          @change="onBannerFileChange"
        />
      </div>
    </div>

    <!-- Unified FAB / draw control pill -->
    <Teleport to="body">
      <!-- Error toast floats above pill in draw mode -->
      <div v-if="drawMode && (drawError || bannerError)" class="fab-draw-error">
        {{ drawError || bannerError }}
      </div>

      <div v-if="auth.user && book" ref="fabPillEl" class="fab-pill" :class="{ 'fab-pill--draw': drawMode }">
        <!-- ── Normal FAB ── -->
        <template v-if="!drawMode">
          <template v-if="isOwner">
            <button class="fab-btn" title="Draw on banner" @click="enterDrawMode">
              <i class="fa-solid fa-pen-nib"></i>
            </button>
            <button
              class="fab-btn"
              :title="book.banner_url ? 'Change photo' : 'Upload photo'"
              :disabled="bannerUploading"
              @click="bannerInputEl?.click()"
            >
              <i v-if="bannerUploading" class="fa-solid fa-spinner fa-spin"></i>
              <i v-else class="fa-solid fa-camera"></i>
            </button>
            <span class="fab-divider"></span>
          </template>
          <button class="fab-btn fab-btn--primary" title="Add recipe" @click="router.push('/new')">
            <i class="fa-solid fa-plus"></i>
          </button>
        </template>

        <!-- ── Draw controls ── -->
        <template v-else>
          <button class="fab-btn" title="Undo" :disabled="strokes.length === 0" @click="undoStroke">
            <i class="fa-solid fa-rotate-left"></i>
          </button>
          <button class="fab-btn" title="Clear all" :disabled="strokes.length === 0" @click="clearAll">
            <i class="fa-solid fa-trash-can"></i>
          </button>
          <span class="fab-divider"></span>
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
          <span class="fab-divider"></span>
          <button
            class="fab-btn"
            :title="book.banner_url ? 'Change photo' : 'Upload photo'"
            :disabled="bannerUploading"
            @click="bannerInputEl?.click()"
          >
            <i v-if="bannerUploading" class="fa-solid fa-spinner fa-spin"></i>
            <i v-else class="fa-solid fa-camera"></i>
          </button>
          <button
            v-if="book.banner_url"
            class="fab-btn fab-btn--danger"
            title="Remove custom photo"
            :disabled="bannerUploading"
            @click="resetBannerPhoto"
          >
            <i class="fa-solid fa-image"></i>
          </button>
          <span class="fab-divider"></span>
          <button
            v-if="book.drawing_url || strokes.length > 0"
            class="fab-btn fab-btn--danger"
            title="Remove drawing"
            :disabled="drawSaving"
            @click="removeDrawing"
          >
            <i class="fa-solid fa-eraser"></i>
          </button>
          <button class="fab-btn" title="Cancel" @click="exitDrawMode">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <button class="fab-btn fab-btn--primary" :disabled="drawSaving" title="Save" @click="saveAndExit">
            <i v-if="drawSaving" class="fa-solid fa-spinner fa-spin"></i>
            <i v-else class="fa-solid fa-check"></i>
          </button>
        </template>
      </div>
    </Teleport>

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

