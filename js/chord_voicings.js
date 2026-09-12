.pragma library

// Generic movable-shape voicing finder. Rather than a hand-built database of
// diagrams per chord quality (which would either be huge or incomplete),
// this searches the fretboard directly: given a tuning and a chord's tone
// set, it looks for a playable combination of frets near an anchor position.
// This scales to any of the 11 chord qualities, any of the 8 tunings, and
// any future custom tuning for free.

var MAX_SPAN = 4 // widest fret stretch across the hand for one voicing
var SEARCH_FRETS = 15 // how far up the neck to look for an anchor position

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

function openStringPitchClass(openNote) {
    var parsed = parseNoteName(openNote)
    return parsed ? parsed.pitchClass : -1
}

function fretPitchClass(openNote, fret) {
    var open = openStringPitchClass(openNote)
    if (open < 0) return -1
    return (open + fret) % 12
}

function firstFretForPitchClass(openNote, pitchClass, maxFret) {
    for (var f = 0; f <= maxFret; f++) if (fretPitchClass(openNote, f) === pitchClass) return f
    return -1
}

// Finds one voicing anchored so its lowest fret is >= anchorFret, searching
// a MAX_SPAN-fret-wide window. Returns null if fewer than 3 strings can
// sound a chord tone, or if the root is missing entirely.
function voicingNear(tuningNotes, toneSet, rootPitchClass, anchorFret) {
    var lowFret = Math.max(0, Math.round(anchorFret || 0))
    var highFret = lowFret + MAX_SPAN
    var strings = []
    var soundingCount = 0
    var hasRoot = false

    for (var s = 0; s < tuningNotes.length; s++) {
        var chosen = -1
        var searchFrom = lowFret === 0 ? 0 : lowFret
        for (var f = searchFrom; f <= highFret; f++) {
            var pc = fretPitchClass(tuningNotes[s], f)
            if (toneSet[pc]) { chosen = f; break }
        }
        var pitchClass = chosen >= 0 ? fretPitchClass(tuningNotes[s], chosen) : -1
        if (chosen >= 0) {
            soundingCount++
            if (pitchClass === rootPitchClass) hasRoot = true
        }
        strings.push({ stringIndex: s, fret: chosen, muted: chosen < 0, pitchClass: pitchClass })
    }

    if (soundingCount < 3 || !hasRoot) return null
    return { anchorFret: lowFret, span: highFret - lowFret, soundingCount: soundingCount, strings: strings }
}

function voicingKey(voicing) {
    return voicing.strings.map(function (s) { return s.fret }).join(",")
}

// Returns up to 3 distinct, playable voicings for a chord's pitch-class set
// in the given tuning: an open/low-position one, and one anchored at the
// root's position on each of the two lowest strings (classic E-shape /
// A-shape movable barre logic, without hard-coding shape tables).
function findVoicings(tuningNotes, toneSet, rootPitchClass) {
    if (!tuningNotes || tuningNotes.length === 0) return []
    var hints = [0]
    if (tuningNotes.length > 0) {
        var rootOnLowest = firstFretForPitchClass(tuningNotes[0], rootPitchClass, SEARCH_FRETS)
        if (rootOnLowest >= 0) hints.push(rootOnLowest)
    }
    if (tuningNotes.length > 1) {
        var rootOnSecond = firstFretForPitchClass(tuningNotes[1], rootPitchClass, SEARCH_FRETS)
        if (rootOnSecond >= 0) hints.push(rootOnSecond)
    }

    var seen = {}
    var voicings = []
    for (var i = 0; i < hints.length; i++) {
        var voicing = voicingNear(tuningNotes, toneSet, rootPitchClass, hints[i])
        if (!voicing) continue
        var key = voicingKey(voicing)
        if (seen[key]) continue
        seen[key] = true
        voicings.push(voicing)
    }
    return voicings
}
