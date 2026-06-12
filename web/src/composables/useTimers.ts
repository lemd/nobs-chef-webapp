import { reactive, computed } from 'vue'
import { parseTimingToSeconds, formatTime } from '../utils.ts'
import { state as appState } from '../state.ts'
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
    if (timer.remaining === 0) _stop()
  }, 1000)
}

export function useTimers() {
  function initTimers(steps: RecipeStep[]): void {
    _stop()
    Object.keys(stepTimings).forEach((k) => delete stepTimings[Number(k)])
    timer.stepNum = null
    timer.remaining = 0
    timer.total = 0
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
    if (timer.stepNum === stepNum) {
      _stop()
      timer.remaining = timer.total
    } else {
      _stop()
      timer.stepNum = stepNum
      timer.label = info.label
      timer.sublabel = info.sublabel
      timer.total = info.total
      timer.remaining = info.total
      _start()
    }
    appState.panelOpen = false
  }

  function pauseTimer(): void { if (timer.running) _stop() }
  function resumeTimer(): void { if (!timer.running && timer.remaining > 0) _start() }
  function resetTimer(): void { _stop(); timer.remaining = timer.total }

  const tabLabel = computed(() => {
    if (timer.stepNum === null) return null
    return {
      time: timer.running ? formatTime(timer.remaining) : null,
      running: timer.running,
    }
  })

  return { timer, stepTimings, initTimers, tapTimerBtn, pauseTimer, resumeTimer, resetTimer, tabLabel }
}
