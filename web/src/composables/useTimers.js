import { reactive, computed } from 'vue';
import { parseTimingToSeconds, formatTime } from '../utils.js';
import { state as appState } from '../state.js';

// Single running timer — module-level singleton
const timer = reactive({
    stepNum: null,
    label: '',
    sublabel: '',
    total: 0,
    remaining: 0,
    running: false,
    interval: null,
});

// Map of stepNum → { total, label, sublabel } — populated by initTimers
const stepTimings = {};

function _stop() {
    if (timer.interval) clearInterval(timer.interval);
    timer.interval = null;
    timer.running = false;
}

function _start() {
    timer.running = true;
    timer.interval = setInterval(() => {
        timer.remaining = Math.max(0, timer.remaining - 1);
        if (timer.remaining === 0) _stop();
    }, 1000);
}

export function useTimers() {
    function initTimers(steps) {
        _stop();
        Object.keys(stepTimings).forEach((k) => delete stepTimings[k]);
        timer.stepNum = null;
        timer.remaining = 0;
        timer.total = 0;
        (steps ?? []).forEach((s) => {
            const secs = parseTimingToSeconds(s.timingInterval);
            if (!secs) return;
            stepTimings[s.stepNumber] = {
                total: secs,
                label: `Step ${s.stepNumber}`,
                sublabel: s.timingInterval,
            };
        });
    }

    function tapTimerBtn(stepNum) {
        const info = stepTimings[stepNum];
        if (!info) return;

        if (timer.stepNum === stepNum) {
            // Same step — reset and stop
            _stop();
            timer.remaining = timer.total;
        } else {
            // Different step — replace and start
            _stop();
            timer.stepNum = stepNum;
            timer.label = info.label;
            timer.sublabel = info.sublabel;
            timer.total = info.total;
            timer.remaining = info.total;
            _start();
        }

        appState.panelOpen = true;
        appState.currentPanelTab = 'timers';
    }

    function pauseTimer() {
        if (timer.running) _stop();
    }

    function resumeTimer() {
        if (!timer.running && timer.remaining > 0) _start();
    }

    function resetTimer() {
        _stop();
        timer.remaining = timer.total;
    }

    const tabLabel = computed(() => {
        if (timer.stepNum === null) return null;
        return {
            time: timer.running ? formatTime(timer.remaining) : null,
            running: timer.running,
        };
    });

    return {
        timer,
        stepTimings,
        initTimers,
        tapTimerBtn,
        pauseTimer,
        resumeTimer,
        resetTimer,
        tabLabel,
    };
}
