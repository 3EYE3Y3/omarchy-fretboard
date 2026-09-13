.pragma library

// Generic multi-stage progression engine (v0.4). A "stage" is an opaque,
// caller-defined object - this module only decides *which index* is active
// right now and *when* that changes. It knows nothing about scales, boxes,
// triads, BPM or chords; a dynamic practice item's stages are patches
// resolved elsewhere (js/routines.js's resolveStageItem). The same engine is
// intended to drive a v0.5 Jam Session's chord-change timing later - advancing
// "which chord is current" is the same problem as advancing "which box is
// current", just with a different stage payload.
//
// Two advance modes, matching js/tempo_trainer.js's existing elapsed/bar
// authority so a dynamic routine reuses the same real-time/metronome-bar
// clock rather than a UI animation timer:
//   { mode: "time", everySeconds: 120 } - advance after N seconds of
//     accumulated *active* (unpaused) elapsed time.
//   { mode: "bars", everyBars: 8 } - advance after N completed metronome
//     bars (bar-start beats), so tempo changes don't skew the schedule.

function finiteNumber(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback
    var number = Number(value)
    return isFinite(number) ? number : fallback
}

function normalizedAdvance(advance) {
    var a = advance || {}
    var mode = a.mode === "bars" ? "bars" : "time"
    return {
        mode: mode,
        everySeconds: Math.max(1, finiteNumber(a.everySeconds, 120)),
        everyBars: Math.max(1, Math.round(finiteNumber(a.everyBars, 8)))
    }
}

function stageCount(stages) {
    return (stages || []).length
}

function clampIndex(stages, index) {
    var count = stageCount(stages)
    if (count === 0) return 0
    return Math.max(0, Math.min(count - 1, Math.floor(finiteNumber(index, 0))))
}

function stageAt(stages, index) {
    var count = stageCount(stages)
    if (count === 0) return null
    return stages[clampIndex(stages, index)] || null
}

// The stage index implied by `elapsedSeconds` of continuous active time
// under a time-based plan - one step per `everySeconds`, held at the last
// stage once elapsed time exceeds the full sequence.
function stageIndexAtElapsedSeconds(stages, advance, elapsedSeconds) {
    var count = stageCount(stages)
    if (count === 0) return 0
    var a = normalizedAdvance(advance)
    var steps = Math.floor(Math.max(0, finiteNumber(elapsedSeconds, 0)) / a.everySeconds)
    return Math.max(0, Math.min(count - 1, steps))
}

// The stage index implied by `completedBars` of metronome bars under a
// bar-based plan - one step per `everyBars`.
function stageIndexAtCompletedBars(stages, advance, completedBars) {
    var count = stageCount(stages)
    if (count === 0) return 0
    var a = normalizedAdvance(advance)
    var steps = Math.floor(Math.max(0, finiteNumber(completedBars, 0)) / a.everyBars)
    return Math.max(0, Math.min(count - 1, steps))
}

// Single entry point a caller ticks on a timer: dispatches to the elapsed-
// time or completed-bars calculation depending on the plan's mode.
function autoStageIndex(stages, advance, elapsedSeconds, completedBars) {
    var a = normalizedAdvance(advance)
    return a.mode === "bars"
        ? stageIndexAtCompletedBars(stages, advance, completedBars)
        : stageIndexAtElapsedSeconds(stages, advance, elapsedSeconds)
}

// Looping variants (v0.5, Jam Sessions): a backing-track progression
// repeats for the whole session instead of holding at the last stage like a
// practice routine's stage sequence does. Same clock, same per-stage
// duration math - only the wraparound differs (`%` instead of clamping) -
// so a Jam Session is not a second sequencing engine, just this one used
// with `loop: true`.
function loopedStageIndexAtElapsedSeconds(stages, advance, elapsedSeconds) {
    var count = stageCount(stages)
    if (count === 0) return 0
    var a = normalizedAdvance(advance)
    var steps = Math.floor(Math.max(0, finiteNumber(elapsedSeconds, 0)) / a.everySeconds)
    return steps % count
}

function loopedStageIndexAtCompletedBars(stages, advance, completedBars) {
    var count = stageCount(stages)
    if (count === 0) return 0
    var a = normalizedAdvance(advance)
    var steps = Math.floor(Math.max(0, finiteNumber(completedBars, 0)) / a.everyBars)
    return steps % count
}

function loopedAutoStageIndex(stages, advance, elapsedSeconds, completedBars) {
    var a = normalizedAdvance(advance)
    return a.mode === "bars"
        ? loopedStageIndexAtCompletedBars(stages, advance, completedBars)
        : loopedStageIndexAtElapsedSeconds(stages, advance, elapsedSeconds)
}

// How many times the full sequence has completed - a Jam Session's "chorus"
// or "time through the form" counter.
function completedCycles(stages, advance, elapsedSeconds, completedBars) {
    var count = stageCount(stages)
    if (count === 0) return 0
    var a = normalizedAdvance(advance)
    var steps = a.mode === "bars"
        ? Math.floor(Math.max(0, finiteNumber(completedBars, 0)) / a.everyBars)
        : Math.floor(Math.max(0, finiteNumber(elapsedSeconds, 0)) / a.everySeconds)
    return Math.floor(steps / count)
}

// The elapsed-seconds (time mode) or completed-bars (bar mode) value at
// which `index` first becomes the active stage - used to "rebase" the
// running clock when the user manually jumps to a stage with Previous/Next,
// so automatic progression continues naturally from the new position
// instead of immediately jumping back.
function stageStartElapsedSeconds(advance, index) {
    var a = normalizedAdvance(advance)
    return clampIndexRaw(index) * a.everySeconds
}
function stageStartBars(advance, index) {
    var a = normalizedAdvance(advance)
    return clampIndexRaw(index) * a.everyBars
}
function clampIndexRaw(index) {
    return Math.max(0, Math.floor(finiteNumber(index, 0)))
}

// Seconds remaining in the current stage (time mode only; null otherwise).
function stageSecondsRemaining(stages, advance, elapsedSeconds) {
    var a = normalizedAdvance(advance)
    if (a.mode !== "time") return null
    var index = stageIndexAtElapsedSeconds(stages, advance, elapsedSeconds)
    var stageEnd = (index + 1) * a.everySeconds
    return Math.max(0, stageEnd - finiteNumber(elapsedSeconds, 0))
}

// Bars remaining in the current stage (bar mode only; null otherwise).
function stageBarsRemaining(stages, advance, completedBars) {
    var a = normalizedAdvance(advance)
    if (a.mode !== "bars") return null
    var index = stageIndexAtCompletedBars(stages, advance, completedBars)
    var stageEnd = (index + 1) * a.everyBars
    return Math.max(0, stageEnd - finiteNumber(completedBars, 0))
}

// Looped counterparts of stageSecondsRemaining/stageBarsRemaining: time/bars
// left in the *current* stage is identical math whether the sequence loops
// or clamps at the end, only which index is "current" differs.
function loopedStageSecondsRemaining(stages, advance, elapsedSeconds) {
    var a = normalizedAdvance(advance)
    if (a.mode !== "time") return null
    var index = loopedStageIndexAtElapsedSeconds(stages, advance, elapsedSeconds)
    var cycles = completedCycles(stages, advance, elapsedSeconds, 0)
    var stageEnd = (cycles * stageCount(stages) + index + 1) * a.everySeconds
    return Math.max(0, stageEnd - finiteNumber(elapsedSeconds, 0))
}

function loopedStageBarsRemaining(stages, advance, completedBars) {
    var a = normalizedAdvance(advance)
    if (a.mode !== "bars") return null
    var index = loopedStageIndexAtCompletedBars(stages, advance, completedBars)
    var cycles = completedCycles(stages, advance, 0, completedBars)
    var stageEnd = (cycles * stageCount(stages) + index + 1) * a.everyBars
    return Math.max(0, stageEnd - finiteNumber(completedBars, 0))
}

// Total planned duration in seconds for a time-based plan (stages * every
// seconds); null for bar-based plans, whose real duration depends on BPM
// and time signature and is the caller's to compute if needed.
function totalDurationSeconds(stages, advance) {
    var a = normalizedAdvance(advance)
    if (a.mode !== "time") return null
    return stageCount(stages) * a.everySeconds
}

function totalBars(stages, advance) {
    var a = normalizedAdvance(advance)
    if (a.mode !== "bars") return null
    return stageCount(stages) * a.everyBars
}

function isLastStage(stages, index) {
    var count = stageCount(stages)
    return count === 0 || clampIndex(stages, index) === count - 1
}
