.pragma library

var CURRENT_SCHEMA_VERSION = 1

function finiteNumber(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback
    var number = Number(value)
    return isFinite(number) ? number : fallback
}

var TUNER_SENSITIVITIES = ["quiet", "normal", "noisy_room"]

function defaultPreferences() {
    return {
        a4: 440,
        defaultTuningId: "standard",
        metronomeVolume: 0.8,
        lastTimeSignatureId: "4-4",
        lastSubdivisionId: "quarter",
        tunerInputDevice: "",
        // Added in v0.3.1. An older state.json simply won't have this key,
        // and sanitizedPreferences() below fills it in from the default -
        // no schemaVersion bump or migration step needed for an additive,
        // backward-compatible preference like this one.
        tunerSensitivity: "normal",
        routineSource: "presets",
        routineCategory: "All",
        routinePresetId: "",
        routineUserId: ""
    }
}

function defaultState() {
    return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        preferences: defaultPreferences(),
        customTunings: [],
        routines: [],
        exercises: [],
        songs: [],
        sessions: [],
        exerciseProgress: {}
    }
}

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value)
}

function sanitizedPreferences(raw) {
    var defaults = defaultPreferences()
    if (!isPlainObject(raw)) return defaults
    return {
        a4: finiteNumber(raw.a4, defaults.a4) > 0 ? finiteNumber(raw.a4, defaults.a4) : defaults.a4,
        defaultTuningId: typeof raw.defaultTuningId === "string" && raw.defaultTuningId ? raw.defaultTuningId : defaults.defaultTuningId,
        metronomeVolume: Math.max(0, Math.min(1, finiteNumber(raw.metronomeVolume, defaults.metronomeVolume))),
        lastTimeSignatureId: typeof raw.lastTimeSignatureId === "string" && raw.lastTimeSignatureId ? raw.lastTimeSignatureId : defaults.lastTimeSignatureId,
        lastSubdivisionId: typeof raw.lastSubdivisionId === "string" && raw.lastSubdivisionId ? raw.lastSubdivisionId : defaults.lastSubdivisionId,
        tunerInputDevice: typeof raw.tunerInputDevice === "string" ? raw.tunerInputDevice : defaults.tunerInputDevice,
        tunerSensitivity: TUNER_SENSITIVITIES.indexOf(raw.tunerSensitivity) >= 0 ? raw.tunerSensitivity : defaults.tunerSensitivity,
        routineSource: raw.routineSource === "mine" ? "mine" : defaults.routineSource,
        routineCategory: typeof raw.routineCategory === "string" && raw.routineCategory ? raw.routineCategory : defaults.routineCategory,
        routinePresetId: typeof raw.routinePresetId === "string" ? raw.routinePresetId : defaults.routinePresetId,
        routineUserId: typeof raw.routineUserId === "string" ? raw.routineUserId : defaults.routineUserId
    }
}

function sanitizedArray(raw, isValidEntry) {
    if (!Array.isArray(raw)) return []
    var result = []
    for (var i = 0; i < raw.length; i++) if (isValidEntry(raw[i])) result.push(raw[i])
    return result
}

function looksLikeTuning(entry) {
    return isPlainObject(entry) && typeof entry.id === "string" && Array.isArray(entry.notes) && entry.notes.length > 0
}

function looksLikeRoutine(entry) {
    return isPlainObject(entry) && typeof entry.id === "string" && typeof entry.name === "string" && Array.isArray(entry.items)
}

function looksLikeExercise(entry) {
    return isPlainObject(entry) && typeof entry.id === "string" && typeof entry.name === "string"
}

function looksLikeSong(entry) {
    return isPlainObject(entry) && typeof entry.id === "string" && typeof entry.title === "string"
}

function looksLikeSession(entry) {
    return isPlainObject(entry) && typeof entry.startedAt === "number" && isFinite(entry.startedAt)
}

function sanitizedExerciseProgress(raw) {
    if (!isPlainObject(raw)) return {}
    var result = {}
    var keys = Object.keys(raw)
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i]
        var entry = raw[key]
        if (!isPlainObject(entry)) continue
        result[key] = {
            bestBpm: finiteNumber(entry.bestBpm, null),
            goalBpm: finiteNumber(entry.goalBpm, null),
            history: sanitizedArray(entry.history, function (h) { return isPlainObject(h) && typeof h.at === "number" })
        }
    }
    return result
}

// Fills in any missing top-level keys and drops malformed entries within
// each collection, so a partially corrupted file degrades to "missing some
// rows" instead of failing to load at all.
function sanitizedState(raw) {
    var data = isPlainObject(raw) ? raw : {}
    return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        preferences: sanitizedPreferences(data.preferences),
        customTunings: sanitizedArray(data.customTunings, looksLikeTuning),
        routines: sanitizedArray(data.routines, looksLikeRoutine),
        exercises: sanitizedArray(data.exercises, looksLikeExercise),
        songs: sanitizedArray(data.songs, looksLikeSong),
        sessions: sanitizedArray(data.sessions, looksLikeSession),
        exerciseProgress: sanitizedExerciseProgress(data.exerciseProgress)
    }
}

// Placeholder migration chain: v0 (no schemaVersion, or anything the shape
// checks below don't recognize) is treated as "sanitize into the current
// shape, keep whatever is salvageable." Real version bumps will add a
// migrateVxToVy step here and this function will thread data through each
// one in order before sanitizing.
function migrate(data) {
    var fromVersion = isPlainObject(data) ? finiteNumber(data.schemaVersion, 0) : 0
    var migrated = fromVersion !== CURRENT_SCHEMA_VERSION
    return { value: sanitizedState(data), migrated: migrated, fromVersion: fromVersion }
}

// Parses and migrates a raw state.json payload. Never throws: malformed
// JSON or an unexpected shape yields `ok:false` so the caller can fall back
// to in-memory defaults and keep the plugin usable instead of crashing.
function decode(raw) {
    if (raw === null || raw === undefined || raw === "") {
        return { ok: true, value: defaultState(), migrated: false }
    }
    var data
    try {
        data = JSON.parse(raw)
    } catch (error) {
        return { ok: false, error: "State file is not valid JSON", value: defaultState() }
    }
    var result = migrate(data)
    return { ok: true, value: result.value, migrated: result.migrated }
}

function encode(state) {
    return JSON.stringify(state, null, 2) + "\n"
}
