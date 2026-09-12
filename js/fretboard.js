.pragma library

var SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
var FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
var DEFAULT_FRET_COUNT = 24

function pitchClassIndex(name) {
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

// Uses the same octave convention as MIDI note numbers (octave -1 starts at
// 0), matching js/pitch.js's noteToFrequency/frequencyToNote so a fret
// position and a tuner reading agree on what octave a note is in.
function absoluteSemitone(openNote) {
    var parsed = parseNoteName(openNote)
    if (!parsed) return null
    return (parsed.octave + 1) * 12 + parsed.pitchClass
}

function noteAtFret(openNote, fret, preferFlats) {
    var base = absoluteSemitone(openNote)
    if (base === null) return null
    var absolute = base + fret
    var pitchClass = ((absolute % 12) + 12) % 12
    var octave = Math.floor(absolute / 12) - 1
    return { pitchClass: pitchClass, octave: octave, name: noteName(pitchClass, preferFlats), fret: fret }
}

// Builds the full fretboard grid for a tuning: one row per string (index 0
// is the lowest/thickest string, matching the tuning's note order), each
// row holding `fretCount + 1` cells (fret 0 is the open string).
function buildFretboard(tuningNotes, fretCount, preferFlats) {
    var frets = Math.max(1, Math.round(fretCount || DEFAULT_FRET_COUNT))
    var strings = []
    for (var s = 0; s < (tuningNotes || []).length; s++) {
        var row = []
        for (var f = 0; f <= frets; f++) {
            row.push(noteAtFret(tuningNotes[s], f, preferFlats))
        }
        strings.push(row)
    }
    return { fretCount: frets, strings: strings }
}

// Annotates a fretboard's cells in place-safe fashion (returns a new
// structure) with whether each cell belongs to the given pitch-class set
// and whether it is the root.
function highlightFretboard(fretboard, pitchClassSet, rootPitchClass) {
    var strings = []
    for (var s = 0; s < fretboard.strings.length; s++) {
        var row = []
        for (var f = 0; f < fretboard.strings[s].length; f++) {
            var cell = fretboard.strings[s][f]
            var inSet = !!(cell && pitchClassSet && pitchClassSet[cell.pitchClass])
            row.push({
                pitchClass: cell.pitchClass,
                octave: cell.octave,
                name: cell.name,
                fret: cell.fret,
                highlighted: inSet,
                isRoot: inSet && rootPitchClass !== undefined && rootPitchClass !== null && cell.pitchClass === rootPitchClass
            })
        }
        strings.push(row)
    }
    return { fretCount: fretboard.fretCount, strings: strings }
}
