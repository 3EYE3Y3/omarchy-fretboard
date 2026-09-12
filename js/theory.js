.pragma library

var SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
var FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

// Generic fallback only. Built-in scales/chords use their formula tokens so
// enharmonically distinct functions (#4 vs b5, #5 vs b6, 9 vs 2) display
// correctly even when they share a pitch class.
var INTERVAL_LABELS = ["R", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"]

// `degrees` preserves diatonic letter spelling. It is deliberately separate
// from pitch-class membership: a C# major scale must spell E# and B#, while a
// fretboard cell may still use the enharmonic pitch classes F and C.
var SCALES = [
    { id: "major", name: "Major", formula: "1 2 3 4 5 6 7", intervals: [0, 2, 4, 5, 7, 9, 11], degrees: [0, 1, 2, 3, 4, 5, 6] },
    { id: "natural_minor", name: "Natural Minor", formula: "1 2 b3 4 5 b6 b7", intervals: [0, 2, 3, 5, 7, 8, 10], degrees: [0, 1, 2, 3, 4, 5, 6] },
    { id: "major_pentatonic", name: "Major Pentatonic", formula: "1 2 3 5 6", intervals: [0, 2, 4, 7, 9], degrees: [0, 1, 2, 4, 5] },
    { id: "minor_pentatonic", name: "Minor Pentatonic", formula: "1 b3 4 5 b7", intervals: [0, 3, 5, 7, 10], degrees: [0, 2, 3, 4, 6] },
    { id: "blues", name: "Blues", formula: "1 b3 4 b5 5 b7", intervals: [0, 3, 5, 6, 7, 10], degrees: [0, 2, 3, 4, 4, 6] },
    { id: "harmonic_minor", name: "Harmonic Minor", formula: "1 2 b3 4 5 b6 7", intervals: [0, 2, 3, 5, 7, 8, 11], degrees: [0, 1, 2, 3, 4, 5, 6] },
    { id: "melodic_minor", name: "Melodic Minor (ascending)", formula: "1 2 b3 4 5 6 7", intervals: [0, 2, 3, 5, 7, 9, 11], degrees: [0, 1, 2, 3, 4, 5, 6] },
    { id: "ionian", name: "Ionian", formula: "1 2 3 4 5 6 7", intervals: [0, 2, 4, 5, 7, 9, 11], degrees: [0, 1, 2, 3, 4, 5, 6] },
    { id: "dorian", name: "Dorian", formula: "1 2 b3 4 5 6 b7", intervals: [0, 2, 3, 5, 7, 9, 10], degrees: [0, 1, 2, 3, 4, 5, 6] },
    { id: "phrygian", name: "Phrygian", formula: "1 b2 b3 4 5 b6 b7", intervals: [0, 1, 3, 5, 7, 8, 10], degrees: [0, 1, 2, 3, 4, 5, 6] },
    { id: "lydian", name: "Lydian", formula: "1 2 3 #4 5 6 7", intervals: [0, 2, 4, 6, 7, 9, 11], degrees: [0, 1, 2, 3, 4, 5, 6] },
    { id: "mixolydian", name: "Mixolydian", formula: "1 2 3 4 5 6 b7", intervals: [0, 2, 4, 5, 7, 9, 10], degrees: [0, 1, 2, 3, 4, 5, 6] },
    { id: "aeolian", name: "Aeolian", formula: "1 2 b3 4 5 b6 b7", intervals: [0, 2, 3, 5, 7, 8, 10], degrees: [0, 1, 2, 3, 4, 5, 6] },
    { id: "locrian", name: "Locrian", formula: "1 b2 b3 4 b5 b6 b7", intervals: [0, 1, 3, 5, 6, 8, 10], degrees: [0, 1, 2, 3, 4, 5, 6] }
]

var CHORDS = [
    { id: "major", name: "Major", symbol: "", intervals: [0, 4, 7], degrees: [0, 2, 4], formula: "1 3 5" },
    { id: "minor", name: "Minor", symbol: "m", intervals: [0, 3, 7], degrees: [0, 2, 4], formula: "1 b3 5" },
    { id: "dominant7", name: "Dominant 7", symbol: "7", intervals: [0, 4, 7, 10], degrees: [0, 2, 4, 6], formula: "1 3 5 b7" },
    { id: "major7", name: "Major 7", symbol: "maj7", intervals: [0, 4, 7, 11], degrees: [0, 2, 4, 6], formula: "1 3 5 7" },
    { id: "minor7", name: "Minor 7", symbol: "m7", intervals: [0, 3, 7, 10], degrees: [0, 2, 4, 6], formula: "1 b3 5 b7" },
    { id: "sus2", name: "Sus2", symbol: "sus2", intervals: [0, 2, 7], degrees: [0, 1, 4], formula: "1 2 5" },
    { id: "sus4", name: "Sus4", symbol: "sus4", intervals: [0, 5, 7], degrees: [0, 3, 4], formula: "1 4 5" },
    { id: "diminished", name: "Diminished", symbol: "dim", intervals: [0, 3, 6], degrees: [0, 2, 4], formula: "1 b3 b5" },
    { id: "augmented", name: "Augmented", symbol: "aug", intervals: [0, 4, 8], degrees: [0, 2, 4], formula: "1 3 #5" },
    { id: "add9", name: "Add9", symbol: "add9", intervals: [0, 4, 7, 2], degrees: [0, 2, 4, 1], formula: "1 3 5 9" },
    { id: "power", name: "Power Chord", symbol: "5", intervals: [0, 7], degrees: [0, 4], formula: "1 5" }
]

function finiteNumber(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback
    var number = Number(value)
    return isFinite(number) ? number : fallback
}

function pitchClassIndex(name) {
    if (typeof name === "number") return ((Math.round(name) % 12) + 12) % 12
    var normalized = String(name || "").trim()
    if (normalized.length === 0) return -1
    var letter = normalized[0].toUpperCase()
    var accidental = normalized.slice(1)
    var base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter]
    if (base === undefined) return -1
    for (var i = 0; i < accidental.length; i++) {
        if (accidental[i] === "#") base += 1
        else if (accidental[i] === "b") base -= 1
        else return -1
    }
    return ((base % 12) + 12) % 12
}

function noteName(pitchClass, preferFlats) {
    var index = ((Math.round(pitchClass) % 12) + 12) % 12
    return preferFlats ? FLAT_NAMES[index] : SHARP_NAMES[index]
}

function scaleById(id) {
    for (var i = 0; i < SCALES.length; i++) if (SCALES[i].id === id) return SCALES[i]
    return null
}

function chordById(id) {
    for (var i = 0; i < CHORDS.length; i++) if (CHORDS[i].id === id) return CHORDS[i]
    return null
}

function toneList(rootName, intervals, preferFlats) {
    var root = pitchClassIndex(rootName)
    if (root < 0) return []
    var notes = []
    for (var i = 0; i < intervals.length; i++) {
        var pitchClass = (root + intervals[i]) % 12
        notes.push({
            pitchClass: pitchClass,
            name: noteName(pitchClass, preferFlats),
            interval: INTERVAL_LABELS[intervals[i] % 12],
            semitonesFromRoot: intervals[i]
        })
    }
    return notes
}

var LETTERS = ["C", "D", "E", "F", "G", "A", "B"]
function spelledToneList(rootName, scale, preferFlats) {
    var root = pitchClassIndex(rootName)
    if (root < 0) return []
    var rootLetter = LETTERS.indexOf(String(rootName || "")[0].toUpperCase())
    if (rootLetter < 0 || !scale.degrees) return toneList(rootName, scale.intervals, preferFlats)
    var notes = []
    var formulaLabels = String(scale.formula || "").split(/\s+/)
    for (var i = 0; i < scale.intervals.length; i++) {
        var pitchClass = (root + scale.intervals[i]) % 12
        var letter = LETTERS[(rootLetter + scale.degrees[i]) % 7]
        var natural = pitchClassIndex(letter)
        var delta = ((pitchClass - natural + 18) % 12) - 6
        var accidental = ""
        if (delta === 1) accidental = "#"
        else if (delta === 2) accidental = "##"
        else if (delta === -1) accidental = "b"
        else if (delta === -2) accidental = "bb"
        else if (delta !== 0) return toneList(rootName, scale.intervals, preferFlats)
        notes.push({
            pitchClass: pitchClass,
            name: letter + accidental,
            interval: i === 0 ? "R" : (formulaLabels[i] || INTERVAL_LABELS[scale.intervals[i] % 12]),
            semitonesFromRoot: scale.intervals[i]
        })
    }
    return notes
}

function normalizedSpelling(name) {
    var text = String(name || "").trim()
    return text.length ? text[0].toUpperCase() + text.slice(1) : ""
}

// Builds the notes of a scale in a given key. Returns null for an unknown
// root/scale rather than throwing, so the UI can show "pick a key" instead
// of crashing on an incomplete selection.
function buildScale(rootName, scaleId, preferFlats) {
    var scale = scaleById(scaleId)
    var root = pitchClassIndex(rootName)
    if (!scale || root < 0) return null
    return {
        root: normalizedSpelling(rootName),
        rootPitchClass: root,
        scaleId: scale.id,
        scaleName: scale.name,
        formula: scale.formula,
        notes: spelledToneList(rootName, scale, preferFlats)
    }
}

function buildChord(rootName, chordId, preferFlats) {
    var chord = chordById(chordId)
    var root = pitchClassIndex(rootName)
    if (!chord || root < 0) return null
    var spelledRoot = normalizedSpelling(rootName)
    return {
        root: spelledRoot,
        rootPitchClass: root,
        chordId: chord.id,
        chordName: chord.name,
        symbol: chord.symbol,
        formula: chord.formula,
        name: spelledRoot + chord.symbol,
        notes: spelledToneList(rootName, chord, preferFlats)
    }
}

function pitchClassSet(notes) {
    var set = {}
    for (var i = 0; i < notes.length; i++) set[notes[i].pitchClass] = true
    return set
}
