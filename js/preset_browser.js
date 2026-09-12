.pragma library

// Pure selector state shared by QML and regression tests. The UI renders one
// selected routine only; no list-row/detail coupling is allowed here.
var SOURCES = ["presets", "mine"]

function normalizeSource(source) {
    return SOURCES.indexOf(source) >= 0 ? source : "presets"
}

function normalizeCategory(categories, category) {
    var values = ["All"].concat(categories || [])
    return values.indexOf(category) >= 0 ? category : "All"
}

function filteredPresets(presets, category) {
    var all = presets || []
    return !category || category === "All" ? all.slice() : all.filter(function (p) { return p.category === category })
}

function selectedRoutine(routines, selectedId) {
    var all = routines || []
    for (var i = 0; i < all.length; i++) if (all[i].id === selectedId) return all[i]
    return all.length ? all[0] : null
}

function selectedPreset(presets, category, selectedId) {
    return selectedRoutine(filteredPresets(presets, category), selectedId)
}

function routineOptions(routines) {
    return (routines || []).map(function (routine) {
        return { value: routine.id, label: routine.name }
    })
}

function selectorState(source, presets, categories, routines, preferences) {
    var prefs = preferences || {}
    var normalizedSource = normalizeSource(source || prefs.routineSource)
    if (normalizedSource === "mine") {
        var userRoutine = selectedRoutine(routines, prefs.routineUserId || "")
        return { source: normalizedSource, category: "All", routines: (routines || []).slice(),
            selected: userRoutine, selectedId: userRoutine ? userRoutine.id : "" }
    }
    var category = normalizeCategory(categories, prefs.routineCategory || "All")
    var visible = filteredPresets(presets, category)
    var preset = selectedRoutine(visible, prefs.routinePresetId || "")
    return { source: normalizedSource, category: category, routines: visible,
        selected: preset, selectedId: preset ? preset.id : "" }
}

function totalMinutes(preset) {
    var total = 0
    var items = preset && preset.items ? preset.items : []
    for (var i = 0; i < items.length; i++) total += Number(items[i].durationMinutes || 0)
    return total
}
