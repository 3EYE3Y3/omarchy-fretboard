.pragma library

var DEFAULT_A4 = 440
var SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
var FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
var IN_TUNE_CENTS = 5

function finiteNumber(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback
    var number = Number(value)
    return isFinite(number) ? number : fallback
}

function normalizedA4(a4) {
    var value = finiteNumber(a4, DEFAULT_A4)
    return value > 0 ? value : DEFAULT_A4
}

function pitchClassIndex(name) {
    var normalized = String(name || "").trim()
    if (normalized.length === 0) return -1
    var letter = normalized[0].toUpperCase()
    var accidental = normalized.slice(1)
    var base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter]
    if (base === undefined) return -1
    for (var i = 0; i < accidental.length; i++) {
        var ch = accidental[i]
        if (ch === "#") base += 1
        else if (ch === "b") base -= 1
        else return -1
    }
    return ((base % 12) + 12) % 12
}

// Parses "E2", "F#3", "Bb4", etc into { pitchClass, octave }.
function parseNoteName(text) {
    var match = /^([A-Ga-g](?:#|b)?)(-?\d+)$/.exec(String(text || "").trim())
    if (!match) return null
    var pitchClass = pitchClassIndex(match[1])
    if (pitchClass < 0) return null
    return { pitchClass: pitchClass, octave: parseInt(match[2], 10) }
}

function noteName(pitchClass, preferFlats) {
    var index = ((Math.round(pitchClass) % 12) + 12) % 12
    return preferFlats ? FLAT_NAMES[index] : SHARP_NAMES[index]
}

// Converts a note name/octave to its frequency at the given A4 reference.
function noteToFrequency(name, octave, a4) {
    var pitchClass = typeof name === "number" ? name : pitchClassIndex(name)
    if (pitchClass < 0 || pitchClass === undefined) return null
    var midi = (octave + 1) * 12 + pitchClass
    return normalizedA4(a4) * Math.pow(2, (midi - 69) / 12)
}

// Converts a detected frequency into the nearest note name/octave plus how
// many cents sharp (positive) or flat (negative) it is from that note.
function frequencyToNote(freq, a4, preferFlats) {
    var frequency = finiteNumber(freq, 0)
    if (frequency <= 0) return null
    var reference = normalizedA4(a4)
    var exactMidi = 69 + 12 * (Math.log(frequency / reference) / Math.LN2)
    var midi = Math.round(exactMidi)
    var cents = (exactMidi - midi) * 100
    var pitchClass = ((midi % 12) + 12) % 12
    var octave = Math.floor(midi / 12) - 1
    var nearestFrequency = reference * Math.pow(2, (midi - 69) / 12)
    return {
        note: noteName(pitchClass, !!preferFlats),
        pitchClass: pitchClass,
        octave: octave,
        midi: midi,
        cents: cents,
        frequency: frequency,
        nearestFrequency: nearestFrequency,
        inTune: Math.abs(cents) <= IN_TUNE_CENTS
    }
}
