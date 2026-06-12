<script setup>
import { useTimers } from '../../composables/useTimers.js'
import { formatTime } from '../../utils.js'

const { timer, pauseTimer, resumeTimer, resetTimer } = useTimers()
</script>

<template>
  <div class="ing-panel-inner" id="panelTimers">
    <div class="timer-card">
      <span class="timer-card-label">{{ timer.stepNum !== null ? timer.label : 'Timer' }}</span>
      <span class="timer-card-sublabel">{{ timer.stepNum !== null ? timer.sublabel : 'tap a step to start' }}</span>
      <span class="timer-card-display" :class="{ 'timer-done': timer.remaining === 0 && timer.stepNum !== null }">
        <template v-if="timer.remaining === 0 && timer.stepNum !== null">Done</template>
        <template v-else>{{ timer.stepNum !== null ? formatTime(timer.remaining) : '0:00' }}</template>
      </span>
      <div class="timer-card-controls" v-if="timer.stepNum !== null">
        <button v-if="!timer.running && timer.remaining > 0" aria-label="Start" @click="resumeTimer">
          <i class="fa-solid fa-play"></i>
        </button>
        <button v-if="timer.running" aria-label="Pause" @click="pauseTimer">
          <i class="fa-solid fa-pause"></i>
        </button>
        <button aria-label="Reset" @click="resetTimer">
          <i class="fa-solid fa-rotate-left"></i>
        </button>
      </div>
    </div>
  </div>
</template>
