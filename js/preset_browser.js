.pragma library

// Selection belongs to the detail pane. Compact list rows are a stable
// projection of the source presets and never absorb description/visual state.
function filteredPresets(presets, category) {
    var all = presets || []
    return !category || category === "All" ? all.slice() : all.filter(function (p) { return p.category === category })
}

function selectedPreset(presets, category, selectedId) {
    var visible = filteredPresets(presets, category)
    for (var i = 0; i < visible.length; i++) if (visible[i].id === selectedId) return visible[i]
    return visible.length ? visible[0] : null
}

function totalMinutes(preset) {
    var total = 0
    var items = preset && preset.items ? preset.items : []
    for (var i = 0; i < items.length; i++) total += Number(items[i].durationMinutes || 0)
    return total
}

function visualLabel(mode) {
    var labels = {
        FULL_FRETBOARD_SCALE: "map", POSITION: "position", PENTATONIC_BOX: "box",
        THREE_NOTES_PER_STRING: "3NPS", TRIAD_SHAPE: "triad", CHORD_SHAPE: "chord",
        PATTERN: "pattern", FRETBOARD_PATH: "path", RHYTHM_GRID: "rhythm", PICKING_PATTERN: "picking"
    }
    return labels[mode] || "visual"
}

function compactRows(presets, category, selectedId) {
    return filteredPresets(presets, category).map(function (preset) {
        var bpm = preset.items && preset.items.length ? preset.items[0].targetBpm : null
        var mode = preset.items && preset.items.length && preset.items[0].visualAid ? preset.items[0].visualAid.mode : ""
        return { id: preset.id, name: preset.name, category: preset.category,
            durationMinutes: totalMinutes(preset), bpm: bpm, visualMode: mode, visualLabel: visualLabel(mode),
            selected: preset.id === selectedId, rowKind: "compact" }
    })
}
