.pragma library

var MIN_BPM = 30
var MAX_BPM = 300
var DAY_MS = 86400000

var OUTCOMES = ["clean", "nearly", "needs_work"]

function finiteNumber(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback
    var number = Number(value)
    return isFinite(number) ? number : fallback
}

function clampBpm(value) {
    return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(finiteNumber(value, MIN_BPM))))
}

function normalizedOutcome(outcome) {
    var value = String(outcome || "").toLowerCase().replace(/[\s-]+/g, "_")
    return OUTCOMES.indexOf(value) >= 0 ? value : "nearly"
}

// This is deliberately simple, user-recorded progress bookkeeping, not an
// objective performance measurement: the player self-reports how a tempo
// felt and this suggests a conservative starting point next time.
//   clean       -> nudge up (the small range from the spec example)
//   nearly      -> hold roughly where it was
//   needs_work  -> back off a little
function suggestNextBpm(lastBpm, outcome) {
    var last = clampBpm(lastBpm)
    var kind = normalizedOutcome(outcome)
    if (kind === "clean") {
        var min = clampBpm(last + 2)
        var max = clampBpm(last + 5)
        return { outcome: kind, min: min, max: max, recommended: min }
    }
    if (kind === "needs_work") {
        var reduced = clampBpm(Math.round(last * 0.93))
        var lowered = reduced === last ? clampBpm(last - 2) : reduced
        return { outcome: kind, min: clampBpm(lowered - 2), max: lowered, recommended: lowered }
    }
    // nearly
    return { outcome: kind, min: clampBpm(last - 2), max: clampBpm(last + 2), recommended: last }
}

function dayKey(timestampMs) {
    var date = new Date(timestampMs)
    return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate()
}

function startOfDay(timestampMs) {
    var date = new Date(timestampMs)
    date.setHours(0, 0, 0, 0)
    return date.getTime()
}

function totalMinutesInRange(sessions, startMs, endMs) {
    var total = 0
    for (var i = 0; i < (sessions || []).length; i++) {
        var session = sessions[i]
        var at = finiteNumber(session && session.startedAt, NaN)
        if (!isFinite(at) || at < startMs || at >= endMs) continue
        total += finiteNumber(session && session.durationMinutes, 0)
    }
    return total
}

function minutesToday(sessions, now) {
    var start = startOfDay(now)
    return totalMinutesInRange(sessions, start, start + DAY_MS)
}

function minutesThisWeek(sessions, now) {
    var today = startOfDay(now)
    var weekday = new Date(today).getDay() // 0 = Sunday
    var start = today - weekday * DAY_MS
    return totalMinutesInRange(sessions, start, start + 7 * DAY_MS)
}

function sessionsThisWeek(sessions, now) {
    var today = startOfDay(now)
    var weekday = new Date(today).getDay()
    var start = today - weekday * DAY_MS
    var end = start + 7 * DAY_MS
    var count = 0
    for (var i = 0; i < (sessions || []).length; i++) {
        var at = finiteNumber(sessions[i] && sessions[i].startedAt, NaN)
        if (isFinite(at) && at >= start && at < end) count++
    }
    return count
}

// Consecutive days (ending today or yesterday, so a streak isn't broken
// just because today's practice hasn't happened yet) with at least one
// completed session.
function currentStreak(sessions, now) {
    var days = {}
    for (var i = 0; i < (sessions || []).length; i++) {
        var at = finiteNumber(sessions[i] && sessions[i].startedAt, NaN)
        if (isFinite(at)) days[dayKey(at)] = true
    }
    var cursor = startOfDay(now)
    if (!days[dayKey(cursor)]) cursor -= DAY_MS // today empty yet - check from yesterday
    var streak = 0
    while (days[dayKey(cursor)]) {
        streak++
        cursor -= DAY_MS
    }
    return streak
}

function totalPracticeMinutes(sessions) {
    var total = 0
    for (var i = 0; i < (sessions || []).length; i++) total += finiteNumber(sessions[i] && sessions[i].durationMinutes, 0)
    return total
}

// BPM improvement for one tracked exercise: earliest recorded bestBpm vs.
// the most recent one, from a chronological list of progress snapshots.
function bpmImprovement(progressEntries) {
    var entries = (progressEntries || []).slice().sort(function (a, b) { return a.at - b.at })
    if (entries.length === 0) return 0
    return finiteNumber(entries[entries.length - 1].bestBpm, 0) - finiteNumber(entries[0].bestBpm, 0)
}
