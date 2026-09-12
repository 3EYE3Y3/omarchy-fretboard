.pragma library

var MIN_BPM = 30
var MAX_BPM = 300
var TAP_RESET_MS = 2000
var TAP_MAX_SAMPLES = 8

var TIME_SIGNATURES = [
    { id: "2-4", label: "2/4", numerator: 2, beatsPerBar: 2, beatUnit: 4 },
    { id: "3-4", label: "3/4", numerator: 3, beatsPerBar: 3, beatUnit: 4 },
    { id: "4-4", label: "4/4", numerator: 4, beatsPerBar: 4, beatUnit: 4 },
    { id: "5-4", label: "5/4", numerator: 5, beatsPerBar: 5, beatUnit: 4 },
    { id: "6-8", label: "6/8", numerator: 6, beatsPerBar: 2, beatUnit: 8, compound: true },
    { id: "7-8", label: "7/8", numerator: 7, beatsPerBar: 7, beatUnit: 8 },
    { id: "9-8", label: "9/8", numerator: 9, beatsPerBar: 3, beatUnit: 8, compound: true },
    { id: "12-8", label: "12/8", numerator: 12, beatsPerBar: 4, beatUnit: 8, compound: true }
]

var SUBDIVISIONS = [
    // IDs remain stable for persisted v0.1-v0.3 state. Labels describe the
    // actual click multiplier in every meter; written note values depend on
    // whether the selected beat is a quarter, eighth or dotted quarter.
    { id: "quarter", label: "Beat", ticksPerBeat: 1 },
    { id: "eighth", label: "2 / beat", ticksPerBeat: 2 },
    { id: "triplet", label: "3 / beat", ticksPerBeat: 3 },
    { id: "sixteenth", label: "4 / beat", ticksPerBeat: 4 }
]

function finiteNumber(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback
    var number = Number(value)
    return isFinite(number) ? number : fallback
}

function clampBpm(value) {
    var number = Math.round(finiteNumber(value, MIN_BPM))
    return Math.max(MIN_BPM, Math.min(MAX_BPM, number))
}

function adjustBpm(bpm, delta) {
    return clampBpm(clampBpm(bpm) + finiteNumber(delta, 0))
}

function timeSignatureById(id) {
    for (var i = 0; i < TIME_SIGNATURES.length; i++)
        if (TIME_SIGNATURES[i].id === id) return TIME_SIGNATURES[i]
    return TIME_SIGNATURES[2]
}

function subdivisionById(id) {
    for (var i = 0; i < SUBDIVISIONS.length; i++)
        if (SUBDIVISIONS[i].id === id) return SUBDIVISIONS[i]
    return SUBDIVISIONS[0]
}

// BPM measures the musical beat: a quarter in simple /4 meters and a dotted
// quarter in compound 6/8, 9/8 and 12/8. Selecting three subdivisions per
// beat therefore produces the written eighth notes in those compound meters.
function beatDurationSeconds(bpm) {
    return 60 / clampBpm(bpm)
}

function tickDurationSeconds(bpm, subdivisionId) {
    var subdivision = subdivisionById(subdivisionId)
    return beatDurationSeconds(bpm) / subdivision.ticksPerBeat
}

// Builds `count` ticks starting at absolute tick index `startTick` (0-based,
// counted in subdivision ticks since the start of playback). Each tick
// reports its bar-relative beat/sub-beat position and whether it is the
// downbeat (beat 1, first subdivision) that should be accented.
function buildClickSchedule(options) {
    var bpm = clampBpm(options && options.bpm)
    var timeSignature = timeSignatureById(options && options.timeSignatureId)
    var subdivision = subdivisionById(options && options.subdivisionId)
    var startTick = Math.max(0, Math.floor(finiteNumber(options && options.startTick, 0)))
    var count = Math.max(0, Math.floor(finiteNumber(options && options.count, 0)))
    var ticksPerBar = timeSignature.beatsPerBar * subdivision.ticksPerBeat
    var tickSeconds = tickDurationSeconds(bpm, subdivision.id)

    var ticks = []
    for (var i = 0; i < count; i++) {
        var tickIndex = startTick + i
        var withinBar = tickIndex % ticksPerBar
        var beatIndex = Math.floor(withinBar / subdivision.ticksPerBeat)
        var subIndex = withinBar % subdivision.ticksPerBeat
        ticks.push({
            tickIndex: tickIndex,
            beatIndex: beatIndex,
            subIndex: subIndex,
            accent: beatIndex === 0 && subIndex === 0,
            offsetSeconds: i * tickSeconds
        })
    }
    return ticks
}

function pruneTaps(taps, now) {
    var kept = []
    for (var i = 0; i < (taps || []).length; i++) {
        var t = taps[i]
        if (kept.length === 0 || (t - kept[kept.length - 1]) <= TAP_RESET_MS) kept.push(t)
        else kept = [t]
    }
    while (kept.length > TAP_MAX_SAMPLES) kept.shift()
    return kept
}

// Records one tap-tempo press. If the gap since the previous tap exceeds
// the reset window, tapping starts over from this press. Returns the
// updated tap list and the BPM implied by the average interval, or null
// while there are not yet two taps to measure an interval from.
function recordTap(existingTaps, now) {
    var previous = existingTaps && existingTaps.length ? existingTaps[existingTaps.length - 1] : null
    var next = (previous !== null && (now - previous) > TAP_RESET_MS) ? [now] : (existingTaps || []).concat([now])
    next = pruneTaps(next, now)

    if (next.length < 2) return { taps: next, bpm: null }

    var intervals = []
    for (var i = 1; i < next.length; i++) intervals.push(next[i] - next[i - 1])
    var sum = 0
    for (var j = 0; j < intervals.length; j++) sum += intervals[j]
    var averageMs = sum / intervals.length
    var bpm = averageMs > 0 ? clampBpm(60000 / averageMs) : null
    return { taps: next, bpm: bpm }
}
