import { reactive, computed } from 'vue'
import { parseTimingToSeconds, formatTime } from '../utils.ts'
import type { RecipeStep } from '../types/index.ts'

interface TimerState {
  stepNum: number | null
  label: string
  sublabel: string
  total: number
  remaining: number
  running: boolean
  interval: ReturnType<typeof setInterval> | null
}

interface StepTiming {
  total: number
  label: string
  sublabel: string
}

// ── localStorage persistence ──────────────────────────────────────────────────
const LS_KEY = 'nobs_timer'

interface PersistedTimer {
  stepNum: number
  label: string
  sublabel: string
  total: number
  remaining: number
  running: boolean
  savedAt: number // epoch ms — used to subtract elapsed time if was running
}

function saveToStorage(): void {
  if (timer.stepNum === null) {
    localStorage.removeItem(LS_KEY)
    return
  }
  const payload: PersistedTimer = {
    stepNum: timer.stepNum,
    label: timer.label,
    sublabel: timer.sublabel,
    total: timer.total,
    remaining: timer.remaining,
    running: timer.running,
    savedAt: Date.now(),
  }
  localStorage.setItem(LS_KEY, JSON.stringify(payload))
}

function loadFromStorage(): void {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return
    const p: PersistedTimer = JSON.parse(raw)
    if (!p || typeof p.remaining !== 'number') return

    let remaining = p.remaining
    // If the timer was running, subtract time elapsed since the page was last active
    if (p.running) {
      const elapsed = Math.floor((Date.now() - p.savedAt) / 1000)
      remaining = Math.max(0, remaining - elapsed)
    }

    timer.stepNum = p.stepNum
    timer.label = p.label
    timer.sublabel = p.sublabel
    timer.total = p.total
    timer.remaining = remaining

    if (p.running && remaining > 0) {
      _start()
    }
  } catch {
    localStorage.removeItem(LS_KEY)
  }
}

// Persist on every tick and on visibility change / unload
function _persistOnVisibilityChange(): void {
  if (document.visibilityState === 'hidden') saveToStorage()
}

// ── Timer state ───────────────────────────────────────────────────────────────
const timer = reactive<TimerState>({
  stepNum: null,
  label: '',
  sublabel: '',
  total: 0,
  remaining: 0,
  running: false,
  interval: null,
})

const stepTimings: Record<number, StepTiming> = {}

function _stop(): void {
  if (timer.interval) clearInterval(timer.interval)
  timer.interval = null
  timer.running = false
}

function _start(): void {
  timer.running = true
  timer.interval = setInterval(() => {
    timer.remaining = Math.max(0, timer.remaining - 1)
    if (timer.remaining === 0) {
      _stop()
      saveToStorage()
    }
  }, 1000)
}

// Restore on module load (runs once when the composable is first imported)
loadFromStorage()
document.addEventListener('visibilitychange', _persistOnVisibilityChange)
window.addEventListener('pagehide', saveToStorage)

// ── Public API ────────────────────────────────────────────────────────────────
export function useTimers() {
  function initTimers(steps: RecipeStep[]): void {
    // Register step timings — do NOT stop a running timer (it may be restored from storage)
    Object.keys(stepTimings).forEach((k) => delete stepTimings[Number(k)])
    ;(steps ?? []).forEach((s) => {
      const secs = parseTimingToSeconds(s.timingInterval)
      if (!secs) return
      stepTimings[s.stepNumber] = {
        total: secs,
        label: `Step ${s.stepNumber}`,
        sublabel: s.timingInterval ?? '',
      }
    })
  }

  function tapTimerBtn(stepNum: number): void {
    const info = stepTimings[stepNum]
    if (!info) return
    _stop()
    timer.stepNum = stepNum
    timer.label = info.label
    timer.sublabel = info.sublabel
    timer.total = info.total
    timer.remaining = info.total
    _start()
    saveToStorage()
  }

  function pauseTimer(): void { if (timer.running) { _stop(); saveToStorage() } }
  function resumeTimer(): void { if (!timer.running && timer.remaining > 0) { _start(); saveToStorage() } }
  function resetTimer(): void {
    _stop()
    timer.stepNum = null
    timer.remaining = 0
    timer.total = 0
    timer.label = ''
    timer.sublabel = ''
    saveToStorage()
  }

  const tabLabel = computed(() => {
    if (timer.stepNum === null) return null
    return {
      time: timer.running ? formatTime(timer.remaining) : null,
      running: timer.running,
    }
  })

  return { timer, stepTimings, initTimers, tapTimerBtn, pauseTimer, resumeTimer, resetTimer, tabLabel }
}
