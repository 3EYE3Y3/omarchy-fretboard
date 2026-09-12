.pragma library

// Each tuning lists strings low pitch to high pitch, matching how a
// right-handed player reads a fretboard diagram top-to-bottom is a UI
// concern; the data here is just the lowest string first.
var BUILTIN_TUNINGS = [
    { id: "standard", name: "Standard", notes: ["E2", "A2", "D3", "G3", "B3", "E4"] },
    { id: "drop_d", name: "Drop D", notes: ["D2", "A2", "D3", "G3", "B3", "E4"] },
    { id: "d_standard", name: "D Standard", notes: ["D2", "G2", "C3", "F3", "A3", "D4"] },
    { id: "drop_c", name: "Drop C", notes: ["C2", "G2", "C3", "F3", "A3", "D4"] },
    { id: "eb_standard", name: "Eb Standard", notes: ["Eb2", "Ab2", "Db3", "Gb3", "Bb3", "Eb4"] },
    { id: "open_g", name: "Open G", notes: ["D2", "G2", "D3", "G3", "B3", "D4"] },
    { id: "open_d", name: "Open D", notes: ["D2", "A2", "D3", "F#3", "A3", "D4"] },
    { id: "dadgad", name: "DADGAD", notes: ["D2", "A2", "D3", "G3", "A3", "D4"] }
]

var NOTE_PATTERN = /^[A-Ga-g](#|b)?-?\d+$/

function isValidNoteName(text) {
    return NOTE_PATTERN.test(String(text || "").trim())
}

// A tuning needs at least one string and every entry must parse as a note.
function isValidTuning(notes) {
    if (!Array.isArray(notes) || notes.length === 0) return false
    for (var i = 0; i < notes.length; i++) if (!isValidNoteName(notes[i])) return false
    return true
}

function builtinTuningById(id) {
    for (var i = 0; i < BUILTIN_TUNINGS.length; i++)
        if (BUILTIN_TUNINGS[i].id === id) return BUILTIN_TUNINGS[i]
    return null
}

// Resolves a tuning id against the built-ins first, falling back to a
// user-defined custom tuning list (kept separate in persisted state).
function resolveTuning(id, customTunings) {
    var builtin = builtinTuningById(id)
    if (builtin) return builtin
    var customs = customTunings || []
    for (var i = 0; i < customs.length; i++)
        if (customs[i].id === id) return customs[i]
    return builtinTuningById("standard")
}

function createCustomTuning(name, notes) {
    if (!isValidTuning(notes)) return null
    var slug = String(name || "custom").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    return { id: "custom-" + (slug || "tuning") + "-" + Date.now(), name: String(name || "Custom"), notes: notes.slice(), custom: true }
}
