.pragma library

var ITEM_TYPES = ["warmup", "scales", "chord_changes", "technique", "song", "free_practice", "ear_training", "custom"]

function finiteNumber(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback
    var number = Number(value)
    return isFinite(number) ? number : fallback
}

function makeId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36)
}

function createItem(overrides) {
    var o = overrides || {}
    return {
        id: o.id || makeId("item"),
        type: ITEM_TYPES.indexOf(o.type) >= 0 ? o.type : "custom",
        label: o.label || "",
        durationMinutes: o.durationMinutes !== undefined ? finiteNumber(o.durationMinutes, null) : null,
        targetBpm: o.targetBpm !== undefined ? finiteNumber(o.targetBpm, null) : null,
        metronome: o.metronome || null,
        notes: o.notes || "",
        scaleKey: o.scaleKey || null,
        // A chord/progression item: { key, chordId }, same shape as scaleKey.
        chordKey: o.chordKey || null,
        // Exact visual semantics. A scale pitch set is not a guitar shape.
        tuningId: o.tuningId || null,
        visualAid: o.visualAid ? JSON.parse(JSON.stringify(o.visualAid)) : null,
        // Optional [startFret, endFret] window the visual aid should default
        // to for this item, instead of computing one automatically.
        fretWindow: Array.isArray(o.fretWindow) && o.fretWindow.length === 2 ? o.fretWindow.slice() : null,
        // Optional short sequence lines shown as a textual/visual practice
        // pattern (e.g. ["1-2-3", "2-3-4", "3-4-5"] or picking-direction hints).
        pattern: Array.isArray(o.pattern) ? o.pattern.slice() : null,
        // Optional dynamic/staged progression (v0.4). Each stage is a partial
        // item patch (label, notes, visualAid, scaleKey, chordKey, metronome,
        // targetBpm, fretWindow, pattern, ...) applied on top of this item's
        // own fields - see resolveStageItem(). `advance` says how the active
        // stage changes over time; see js/stage_engine.js. An item with no
        // stages behaves exactly as before (unchanged static behavior).
        stages: Array.isArray(o.stages) && o.stages.length > 0
            ? o.stages.map(function (s) { return s ? JSON.parse(JSON.stringify(s)) : {} }) : null,
        advance: o.advance ? {
            mode: o.advance.mode === "bars" ? "bars" : "time",
            everySeconds: finiteNumber(o.advance.everySeconds, 120),
            everyBars: Math.max(1, Math.round(finiteNumber(o.advance.everyBars, 8)))
        } : null,
        status: o.status || "pending"
    }
}

function hasStages(item) {
    return !!(item && Array.isArray(item.stages) && item.stages.length > 0 && item.advance)
}

// Resolves the effective item for `stageIndex` of a dynamic item: every
// stage-defined field overrides the base item's, everything else is
// inherited. `metronome` merges shallowly (so a stage can change only e.g.
// subdivisionId while keeping the base item's timeSignatureId/startBpm).
// The resolved item is never itself dynamic - `stages`/`advance` are cleared
// so every existing item consumer (visual aid, scale/chord key, metronome,
// notes, duration) can treat it exactly like a plain static item, with zero
// changes required at the render layer.
function resolveStageItem(item, stageIndex) {
    if (!hasStages(item)) return item
    var stages = item.stages
    var index = Math.max(0, Math.min(stages.length - 1, Math.floor(stageIndex) || 0))
    var stage = stages[index] || {}
    var merged = Object.assign({}, item, stage)
    if (item.metronome || stage.metronome) merged.metronome = Object.assign({}, item.metronome || {}, stage.metronome || {})
    merged.stages = null
    merged.advance = null
    return merged
}

function createRoutine(name, items) {
    var now = Date.now()
    return {
        id: makeId("routine"),
        name: String(name || "Untitled Routine"),
        items: (items || []).map(createItem),
        createdAt: now,
        updatedAt: now
    }
}

// Built-in preset routines need a stable id (so they can be looked up by
// name across restarts and never collide with a fresh makeId() call), and
// carry category/description metadata a user-created routine doesn't need.
// Presets are authored as code (see js/presets.js) and are never persisted
// or mutated in place - "editing" one means duplicateRoutine()-ing it into
// the user's own routines first.
function createPresetRoutine(id, name, category, description, items) {
    return {
        id: id,
        name: name,
        category: category,
        description: description || "",
        items: (items || []).map(createItem),
        preset: true,
        createdAt: 0,
        updatedAt: 0
    }
}

function cloneRoutine(routine) {
    return JSON.parse(JSON.stringify(routine))
}

function addItem(routine, item) {
    var next = cloneRoutine(routine)
    next.items.push(createItem(item))
    next.updatedAt = Date.now()
    return next
}

function removeItem(routine, itemId) {
    var next = cloneRoutine(routine)
    next.items = next.items.filter(function (i) { return i.id !== itemId })
    next.updatedAt = Date.now()
    return next
}

function updateItem(routine, itemId, patch) {
    var next = cloneRoutine(routine)
    for (var i = 0; i < next.items.length; i++) {
        if (next.items[i].id === itemId) {
            next.items[i] = createItem(Object.assign({}, next.items[i], patch, { id: itemId }))
            break
        }
    }
    next.updatedAt = Date.now()
    return next
}

// Moves the item at `fromIndex` to `toIndex`, shifting the rest. Silently
// no-ops on an out-of-range index rather than throwing, since this is
// normally driven by drag-and-drop where transient out-of-range values
// can occur mid-drag.
function reorderItem(routine, fromIndex, toIndex) {
    var next = cloneRoutine(routine)
    var items = next.items
    if (fromIndex < 0 || fromIndex >= items.length) return next
    var clampedTo = Math.max(0, Math.min(items.length - 1, toIndex))
    var moved = items.splice(fromIndex, 1)[0]
    items.splice(clampedTo, 0, moved)
    next.updatedAt = Date.now()
    return next
}

// Used both for "duplicate one of my routines" and "copy a built-in preset
// into My Routines" - either way the result is an ordinary, fully editable
// user routine: a fresh id, "preset" cleared, and every item re-issued a
// fresh id so it never aliases the source's.
function duplicateRoutine(routine) {
    var next = cloneRoutine(routine)
    next.id = makeId("routine")
    next.name = routine.name + " Copy"
    next.preset = false
    next.items = next.items.map(function (item) { return createItem(Object.assign({}, item, { id: makeId("item"), status: "pending" })) })
    next.createdAt = Date.now()
    next.updatedAt = Date.now()
    return next
}

// --- Runtime state machine for "start entire routine" -----------------

function startRun(routine) {
    return { routineId: routine.id, currentIndex: 0, startedAt: Date.now(), itemStartedAt: Date.now(), completed: false }
}

function currentItem(routine, run) {
    if (!run || run.completed) return null
    return routine.items[run.currentIndex] || null
}

function nextItem(routine, run) {
    if (!run) return null
    return routine.items[run.currentIndex + 1] || null
}

function advance(routine, run) {
    var next = Object.assign({}, run)
    if (next.currentIndex + 1 >= routine.items.length) {
        next.completed = true
    } else {
        next.currentIndex += 1
        next.itemStartedAt = Date.now()
    }
    return next
}

function progressFraction(routine, run) {
    if (!routine.items.length) return 1
    if (run.completed) return 1
    return run.currentIndex / routine.items.length
}
