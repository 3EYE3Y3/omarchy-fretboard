.pragma library

// A visual aid is a claim about exact guitar coordinates, not merely a set of
// pitch classes. String indexes are low-to-high (0 = string 6, 5 = string 1),
// matching js/tunings.js and js/fretboard.js.
var FULL_FRETBOARD_SCALE = "FULL_FRETBOARD_SCALE"
var POSITION = "POSITION"
var PENTATONIC_BOX = "PENTATONIC_BOX"
var THREE_NOTES_PER_STRING = "THREE_NOTES_PER_STRING"
var TRIAD_SHAPE = "TRIAD_SHAPE"
var CHORD_SHAPE = "CHORD_SHAPE"
var PATTERN = "PATTERN"

var MODES = [FULL_FRETBOARD_SCALE, POSITION, PENTATONIC_BOX,
             THREE_NOTES_PER_STRING, TRIAD_SHAPE, CHORD_SHAPE, PATTERN]

// Conventional minor-pentatonic boxes relative to the root on string 6.
// Box 5 is kept just below Box 1, so A minor appears at frets 2-5.
var MINOR_PENTATONIC_BOXES = {
    1: [[0, 0], [0, 3], [1, 0], [1, 2], [2, 0], [2, 2], [3, 0], [3, 2], [4, 0], [4, 3], [5, 0], [5, 3]],
    2: [[0, 3], [0, 5], [1, 2], [1, 5], [2, 2], [2, 5], [3, 2], [3, 4], [4, 3], [4, 5], [5, 3], [5, 5]],
    3: [[0, 5], [0, 7], [1, 5], [1, 7], [2, 5], [2, 7], [3, 4], [3, 7], [4, 5], [4, 8], [5, 5], [5, 7]],
    4: [[0, 7], [0, 10], [1, 7], [1, 10], [2, 7], [2, 9], [3, 7], [3, 9], [4, 8], [4, 10], [5, 7], [5, 10]],
    5: [[0, -2], [0, 0], [1, -2], [1, 0], [2, -3], [2, 0], [3, -3], [3, 0], [4, -2], [4, 0], [5, -2], [5, 0]]
}

// E Ionian, root on string 6 fret 12: three scale notes on every string.
var E_MAJOR_3NPS = [[0, 12], [0, 14], [0, 16], [1, 12], [1, 14], [1, 16],
    [2, 13], [2, 14], [2, 16], [3, 13], [3, 14], [3, 16],
    [4, 14], [4, 16], [4, 17], [5, 14], [5, 16], [5, 17]]

function normalizePitchClass(value) { return ((Math.round(value) % 12) + 12) % 12 }

function shiftedPositions(source, shift) {
    var positions = []
    for (var i = 0; i < source.length; i++) positions.push([source[i][0], source[i][1] + shift])
    var minFret = 99
    var maxFret = -99
    for (var j = 0; j < positions.length; j++) {
        minFret = Math.min(minFret, positions[j][1])
        maxFret = Math.max(maxFret, positions[j][1])
    }
    while (minFret < 0) { minFret += 12; maxFret += 12; for (var k = 0; k < positions.length; k++) positions[k][1] += 12 }
    while (maxFret > 24 && minFret >= 12) { minFret -= 12; maxFret -= 12; for (var n = 0; n < positions.length; n++) positions[n][1] -= 12 }
    return positions
}

function positionsFor(aid, rootPitchClass) {
    if (!aid) return []
    if (aid.positions) return aid.positions.slice()
    if (aid.mode === PENTATONIC_BOX) {
        var box = MINOR_PENTATONIC_BOXES[aid.box]
        if (!box) return []
        var rootFret = normalizePitchClass(rootPitchClass - 4) // low E pitch class = 4
        return shiftedPositions(box, rootFret)
    }
    if (aid.mode === THREE_NOTES_PER_STRING) {
        return shiftedPositions(E_MAJOR_3NPS, normalizePitchClass(rootPitchClass - 4))
    }
    return []
}

function fretWindow(aid, rootPitchClass) {
    if (!aid || aid.mode === FULL_FRETBOARD_SCALE || aid.mode === CHORD_SHAPE) return null
    var positions = positionsFor(aid, rootPitchClass)
    if (!positions.length) return null
    var start = positions[0][1]
    var end = start
    for (var i = 1; i < positions.length; i++) {
        start = Math.min(start, positions[i][1])
        end = Math.max(end, positions[i][1])
    }
    return { startFret: start, endFret: end }
}

function supportsTuning(aid, tuningId) {
    return !aid || !aid.tuningId || aid.tuningId === tuningId
}

function highlightPositions(fretboard, positions, rootPitchClass) {
    var selected = {}
    for (var i = 0; i < positions.length; i++) selected[positions[i][0] + ":" + positions[i][1]] = true
    var strings = []
    for (var s = 0; s < fretboard.strings.length; s++) {
        var row = []
        for (var f = 0; f < fretboard.strings[s].length; f++) {
            var cell = fretboard.strings[s][f]
            var highlighted = !!selected[s + ":" + cell.fret]
            row.push({ pitchClass: cell.pitchClass, octave: cell.octave, name: cell.name, fret: cell.fret,
                highlighted: highlighted, isRoot: highlighted && cell.pitchClass === rootPitchClass })
        }
        strings.push(row)
    }
    return { fretCount: fretboard.fretCount, strings: strings }
}
