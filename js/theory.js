.pragma library

var SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
var FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

// Generic interval label per semitone distance from the root. Good enough
// for a practice reference; it does not attempt full enharmonic spelling
// (e.g. a diminished 5th vs. an augmented 4th are both "b5" here).
var INTERVAL_LABELS = ["R", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"]

var SCALES = [
    { id: "major", name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
    { id: "natural_minor", name: "Natural Minor", intervals: [0, 2, 3, 5, 7, 8, 10] },
    { id: "major_pentatonic", name: "Major Pentatonic", intervals: [0, 2, 4, 7, 9] },
    { id: "minor_pentatonic", name: "Minor Pentatonic", intervals: [0, 3, 5, 7, 10] },
    { id: "blues", name: "Blues", intervals: [0, 3, 5, 6, 7, 10] },
    { id: "harmonic_minor", name: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11] },
    { id: "melodic_minor", name: "Melodic Minor", intervals: [0, 2, 3, 5, 7, 9, 11] },
    { id: "dorian", name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
    { id: "phrygian", name: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
    { id: "lydian", name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
    { id: "mixolydian", name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
    { id: "locrian", name: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] }
]

var CHORDS = [
    { id: "major", name: "Major", symbol: "", intervals: [0, 4, 7], formula: "1 3 5" },
    { id: "minor", name: "Minor", symbol: "m", intervals: [0, 3, 7], formula: "1 b3 5" },
    { id: "dominant7", name: "Dominant 7", symbol: "7", intervals: [0, 4, 7, 10], formula: "1 3 5 b7" },
    { id: "major7", name: "Major 7", symbol: "maj7", intervals: [0, 4, 7, 11], formula: "1 3 5 7" },
    { id: "minor7", name: "Minor 7", symbol: "m7", intervals: [0, 3, 7, 10], formula: "1 b3 5 b7" },
    { id: "sus2", name: "Sus2", symbol: "sus2", intervals: [0, 2, 7], formula: "1 2 5" },
    { id: "sus4", name: "Sus4", symbol: "sus4", intervals: [0, 5, 7], formula: "1 4 5" },
    { id: "diminished", name: "Diminished", symbol: "dim", intervals: [0, 3, 6], formula: "1 b3 b5" },
    { id: "augmented", name: "Augmented", symbol: "aug", intervals: [0, 4, 8], formula: "1 3 #5" },
    { id: "add9", name: "Add9", symbol: "add9", intervals: [0, 4, 7, 2], formula: "1 3 5 9" },
    { id: "power", name: "Power Chord", symbol: "5", intervals: [0, 7], formula: "1 5" }
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

// Builds the notes of a scale in a given key. Returns null for an unknown
// root/scale rather than throwing, so the UI can show "pick a key" instead
// of crashing on an incomplete selection.
function buildScale(rootName, scaleId, preferFlats) {
    var scale = scaleById(scaleId)
    var root = pitchClassIndex(rootName)
    if (!scale || root < 0) return null
    return {
        root: noteName(root, preferFlats),
        rootPitchClass: root,
        scaleId: scale.id,
        scaleName: scale.name,
        notes: toneList(rootName, scale.intervals, preferFlats)
    }
}

function buildChord(rootName, chordId, preferFlats) {
    var chord = chordById(chordId)
    var root = pitchClassIndex(rootName)
    if (!chord || root < 0) return null
    return {
        root: noteName(root, preferFlats),
        rootPitchClass: root,
        chordId: chord.id,
        chordName: chord.name,
        symbol: chord.symbol,
        formula: chord.formula,
        name: noteName(root, preferFlats) + chord.symbol,
        notes: toneList(rootName, chord.intervals, preferFlats)
    }
}

function pitchClassSet(notes) {
    var set = {}
    for (var i = 0; i < notes.length; i++) set[notes[i].pitchClass] = true
    return set
}
