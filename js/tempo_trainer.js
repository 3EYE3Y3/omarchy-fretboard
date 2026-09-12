.pragma library

var MIN_BPM = 30
var MAX_BPM = 300

function finiteNumber(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback
    var number = Number(value)
    return isFinite(number) ? number : fallback
}

function clampBpm(value) {
    return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(finiteNumber(value, MIN_BPM))))
}

function normalizedPlan(plan) {
    var startBpm = clampBpm(plan && plan.startBpm)
    var targetBpm = clampBpm(plan && plan.targetBpm)
    var increment = Math.abs(finiteNumber(plan && plan.incrementBpm, 5))
    var mode = (plan && plan.incrementMode) === "bars" ? "bars" : "time"
    var intervalSeconds = Math.max(1, finiteNumber(plan && plan.intervalSeconds, 120))
    var intervalBars = Math.max(1, Math.round(finiteNumber(plan && plan.intervalBars, 8)))
    var direction = targetBpm >= startBpm ? 1 : -1
    return { startBpm: startBpm, targetBpm: targetBpm, increment: increment, mode: mode, intervalSeconds: intervalSeconds, intervalBars: intervalBars, direction: direction }
}

function clampTowardTarget(value, plan) {
    if (plan.direction >= 0) return Math.min(plan.targetBpm, Math.max(plan.startBpm, value))
    return Math.max(plan.targetBpm, Math.min(plan.startBpm, value))
}

// BPM after `elapsedSeconds` of continuous play under a time-based plan
// (e.g. "80 BPM -> +5 BPM every 2 minutes -> stop at 120 BPM").
function bpmAtElapsedSeconds(plan, elapsedSeconds) {
    var p = normalizedPlan(plan)
    var steps = Math.floor(Math.max(0, finiteNumber(elapsedSeconds, 0)) / p.intervalSeconds)
    var raw = p.startBpm + p.direction * steps * p.increment
    return clampBpm(clampTowardTarget(raw, p))
}

// BPM after `completedBars` of playing under a bar-count-based plan.
function bpmAtCompletedBars(plan, completedBars) {
    var p = normalizedPlan(plan)
    var steps = Math.floor(Math.max(0, finiteNumber(completedBars, 0)) / p.intervalBars)
    var raw = p.startBpm + p.direction * steps * p.increment
    return clampBpm(clampTowardTarget(raw, p))
}

function isComplete(plan, currentBpm) {
    var p = normalizedPlan(plan)
    return p.direction >= 0 ? currentBpm >= p.targetBpm : currentBpm <= p.targetBpm
}

function totalSteps(plan) {
    var p = normalizedPlan(plan)
    if (p.increment <= 0) return 0
    return Math.ceil(Math.abs(p.targetBpm - p.startBpm) / p.increment)
}

// Seconds (time mode) needed to reach the target BPM from the start BPM.
function totalDurationSeconds(plan) {
    var p = normalizedPlan(plan)
    return totalSteps(p) * p.intervalSeconds
}

function totalBars(plan) {
    var p = normalizedPlan(plan)
    return totalSteps(p) * p.intervalBars
}
