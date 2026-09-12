.pragma library

// Audited standard-tuning chord shapes. The former greedy search selected the
// first chord tone on every string; those results were pitch-set-valid but
// could be physically implausible and did not justify labels such as E-shape.
var STANDARD_TUNING = ["E2", "A2", "D3", "G3", "B3", "E4"]
var MAX_FRET = 15

var E_ROOT_SHAPES = {
    major: [0, 2, 2, 1, 0, 0], minor: [0, 2, 2, 0, 0, 0],
    dominant7: [0, 2, 0, 1, 0, 0], major7: [0, 2, 1, 1, 0, 0],
    minor7: [0, 2, 0, 0, 0, 0], sus2: [0, 2, 4, 4, 0, 0],
    sus4: [0, 2, 2, 2, 0, 0], diminished: [0, 1, 2, 0, -1, -1],
    augmented: [0, 3, 2, 1, 1, 0], add9: [0, 2, 2, 1, 0, 2],
    power: [0, 2, 2, -1, -1, -1]
}

var A_ROOT_SHAPES = {
    major: [-1, 0, 2, 2, 2, 0], minor: [-1, 0, 2, 2, 1, 0],
    dominant7: [-1, 0, 2, 0, 2, 0], major7: [-1, 0, 2, 1, 2, 0],
    minor7: [-1, 0, 2, 0, 1, 0], sus2: [-1, 0, 2, 2, 0, 0],
    sus4: [-1, 0, 2, 2, 3, 0], diminished: [-1, 0, 1, 2, 1, -1],
    augmented: [-1, 0, 3, 2, 2, 1], add9: [-1, 0, 2, 4, 2, 0],
    power: [-1, 0, 2, 2, -1, -1]
}

// Common conventional voicings, low string to high string.
var OPEN_VOICINGS = {
    "4:major": [0, 2, 2, 1, 0, 0], "9:major": [-1, 0, 2, 2, 2, 0],
    "0:major": [-1, 3, 2, 0, 1, 0], "7:major": [3, 2, 0, 0, 0, 3],
    "2:major": [-1, -1, 0, 2, 3, 2], "4:minor": [0, 2, 2, 0, 0, 0],
    "9:minor": [-1, 0, 2, 2, 1, 0], "2:minor": [-1, -1, 0, 2, 3, 1],
    "9:dominant7": [-1, 0, 2, 0, 2, 0], "2:dominant7": [-1, -1, 0, 2, 1, 2],
    "4:dominant7": [0, 2, 0, 1, 0, 0], "0:major7": [-1, 3, 2, 0, 0, 0],
    "4:power": [0, 2, 2, -1, -1, -1]
}

function pitchClassIndex(name) {
    var match = /^([A-Ga-g])(#|b)?/.exec(String(name || ""))
    if (!match) return -1
    var base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1].toUpperCase()]
    if (match[2] === "#") base++
    else if (match[2] === "b") base--
    return ((base % 12) + 12) % 12
}

function fretPitchClass(openNote, fret) {
    var open = pitchClassIndex(openNote)
    return open < 0 || fret < 0 ? -1 : (open + fret) % 12
}

function isStandardTuning(tuningNotes) {
    if (!tuningNotes || tuningNotes.length !== STANDARD_TUNING.length) return false
    for (var i = 0; i < tuningNotes.length; i++) if (String(tuningNotes[i]) !== STANDARD_TUNING[i]) return false
    return true
}

function inferChordId(toneSet, rootPitchClass) {
    var signatures = {
        "0,4,7": "major", "0,3,7": "minor", "0,4,7,10": "dominant7",
        "0,4,7,11": "major7", "0,3,7,10": "minor7", "0,2,7": "sus2",
        "0,5,7": "sus4", "0,3,6": "diminished", "0,4,8": "augmented",
        "0,2,4,7": "add9", "0,7": "power"
    }
    var intervals = []
    for (var i = 0; i < 12; i++) if (toneSet[(rootPitchClass + i) % 12]) intervals.push(i)
    return signatures[intervals.join(",")] || null
}

function transposeShape(shape, rootFret) {
    var frets = []
    for (var i = 0; i < shape.length; i++) frets.push(shape[i] < 0 ? -1 : shape[i] + rootFret)
    return frets
}

function makeVoicing(tuningNotes, frets, toneSet, rootPitchClass, label, bassAssumption) {
    var strings = []
    var present = {}
    var minFret = 99
    var maxFret = 0
    var soundingCount = 0
    var hasOpen = false
    for (var s = 0; s < frets.length; s++) {
        var fret = frets[s]
        var pc = fretPitchClass(tuningNotes[s], fret)
        if (fret >= 0) {
            if (!toneSet[pc] || fret > MAX_FRET) return null
            present[pc] = true
            soundingCount++
            if (fret === 0) hasOpen = true
            if (fret > 0) { minFret = Math.min(minFret, fret); maxFret = Math.max(maxFret, fret) }
        }
        strings.push({ stringIndex: s, fret: fret, muted: fret < 0, pitchClass: pc })
    }
    for (var pcKey in toneSet) if (toneSet[pcKey] && !present[pcKey]) return null
    if (soundingCount < (Object.keys(toneSet).length === 2 ? 2 : 3) || !present[rootPitchClass]) return null
    var anchor = hasOpen || minFret === 99 ? 0 : minFret
    return { anchorFret: anchor, span: Math.max(1, maxFret - anchor), soundingCount: soundingCount,
        strings: strings, label: label || "", bassAssumption: bassAssumption || "root or chord tone" }
}

function voicingKey(voicing) { return voicing.strings.map(function (s) { return s.fret }).join(",") }

function findVoicings(tuningNotes, toneSet, rootPitchClass, requestedChordId) {
    if (!isStandardTuning(tuningNotes)) return []
    var chordId = requestedChordId || inferChordId(toneSet, rootPitchClass)
    if (!chordId || !E_ROOT_SHAPES[chordId] || !A_ROOT_SHAPES[chordId]) return []
    var candidates = []
    var open = OPEN_VOICINGS[rootPitchClass + ":" + chordId]
    if (open) candidates.push({ frets: open, label: "Open", bass: "lowest sounded chord tone" })
    var eRootFret = ((rootPitchClass - 4) % 12 + 12) % 12
    var aRootFret = ((rootPitchClass - 9) % 12 + 12) % 12
    candidates.push({ frets: transposeShape(E_ROOT_SHAPES[chordId], eRootFret), label: "E-root shape", bass: "root on string 6" })
    candidates.push({ frets: transposeShape(A_ROOT_SHAPES[chordId], aRootFret), label: "A-root shape", bass: "root on string 5" })

    var seen = {}
    var voicings = []
    for (var i = 0; i < candidates.length; i++) {
        var voicing = makeVoicing(tuningNotes, candidates[i].frets, toneSet, rootPitchClass, candidates[i].label, candidates[i].bass)
        if (!voicing || seen[voicingKey(voicing)]) continue
        seen[voicingKey(voicing)] = true
        voicings.push(voicing)
    }
    return voicings
}

function voicingFromFrets(tuningNotes, frets, toneSet, rootPitchClass, label, bassAssumption) {
    if (!isStandardTuning(tuningNotes)) return null
    return makeVoicing(tuningNotes, frets, toneSet, rootPitchClass, label, bassAssumption)
}
