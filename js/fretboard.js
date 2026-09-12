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

// Finds a compact, contiguous fret window (default 5 frets wide) that
// contains as many of the given pitch-class set's notes as possible across
// every string - i.e. a generic "one position" box for any scale, in any
// tuning, without hand-tuning a fret range per exercise. Ties favor the
// lowest (most beginner-friendly) fret.
function findPositionWindow(tuningNotes, pitchClassSet, fretCount, width) {
    var frets = Math.max(1, Math.round(fretCount || DEFAULT_FRET_COUNT))
    var span = Math.max(1, Math.round(width || 5))
    var board = buildFretboard(tuningNotes, frets)
    var bestStart = 0
    var bestCount = -1
    for (var start = 0; start + span <= frets; start++) {
        var count = 0
        for (var s = 0; s < board.strings.length; s++) {
            for (var f = start; f <= start + span; f++) {
                var cell = board.strings[s][f]
                if (cell && pitchClassSet && pitchClassSet[cell.pitchClass]) count++
            }
        }
        if (count > bestCount) {
            bestCount = count
            bestStart = start
        }
    }
    return { startFret: bestStart, endFret: bestStart + span }
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
