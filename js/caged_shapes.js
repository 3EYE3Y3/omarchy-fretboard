.pragma library

// Canonical CAGED chord-shape data: explicit, named, playable open-chord
// forms -- NOT derived by searching for chord pitch classes on the neck.
// Each entry stores the *reference open chord* the shape is named after
// (absolute frets, low string to high string, -1 = muted) and the pitch
// class of that reference chord's root. A shape for any other root is
// produced by shifting every fretted string by
// (targetRoot - refRoot) mod 12, exactly reproducing the standard
// "move the open shape up with a barre" technique the CAGED system teaches.
//
// Coverage is intentionally uneven across qualities: only shapes that are
// genuinely conventional, playable, and independently verifiable are
// included. Full verification methodology and sources are recorded in
// docs/MUSIC_CONTENT_AUDIT.md. Where a quality's E-root/A-root shape was
// already audited in js/chord_voicings.js, that same fingering is reused
// here rather than re-derived, so the two files never disagree about what
// an "E shape" or "A shape" sounds like.
var STANDARD_TUNING = ["E2", "A2", "D3", "G3", "B3", "E4"]
var MAX_FRET = 15

// Canonical shape order for CAGED navigation/display purposes.
var SHAPE_ORDER = ["C", "A", "G", "E", "D"]

var SHAPES = {
    major: {
        C: { frets: [-1, 3, 2, 0, 1, 0], refRoot: 0 },
        A: { frets: [-1, 0, 2, 2, 2, 0], refRoot: 9 },
        G: { frets: [3, 2, 0, 0, 0, 3], refRoot: 7 },
        E: { frets: [0, 2, 2, 1, 0, 0], refRoot: 4 },
        D: { frets: [-1, -1, 0, 2, 3, 2], refRoot: 2 }
    },
    // Only A/E/D are conventionally taught: a C-shape or G-shape minor would
    // require flatting a string that is open in the major reference chord,
    // which cannot be done without a fretted note -- so no genuine
    // open-derived C/G minor shape exists.
    minor: {
        A: { frets: [-1, 0, 2, 2, 1, 0], refRoot: 9 },
        E: { frets: [0, 2, 2, 0, 0, 0], refRoot: 4 },
        D: { frets: [-1, -1, 0, 2, 3, 1], refRoot: 2 }
    },
    dominant7: {
        A: { frets: [-1, 0, 2, 0, 2, 0], refRoot: 9 },
        G: { frets: [3, 2, 0, 0, 0, 1], refRoot: 7 },
        E: { frets: [0, 2, 0, 1, 0, 0], refRoot: 4 },
        D: { frets: [-1, -1, 0, 2, 1, 2], refRoot: 2 }
    },
    major7: {
        A: { frets: [-1, 0, 2, 1, 2, 0], refRoot: 9 },
        E: { frets: [0, 2, 1, 1, 0, 0], refRoot: 4 },
        D: { frets: [-1, -1, 0, 2, 2, 2], refRoot: 2 }
    },
    minor7: {
        A: { frets: [-1, 0, 2, 0, 1, 0], refRoot: 9 },
        E: { frets: [0, 2, 0, 0, 0, 0], refRoot: 4 },
        D: { frets: [-1, -1, 0, 2, 1, 1], refRoot: 2 }
    },
    // Diminished/augmented are symmetric chords with no standard
    // open-position C/G/D form; guitar pedagogy teaches them only as
    // movable E-root/A-root shapes, so that is all that is offered here.
    diminished: {
        A: { frets: [-1, 0, 1, 2, 1, -1], refRoot: 9 },
        E: { frets: [0, 1, 2, 0, -1, -1], refRoot: 4 }
    },
    augmented: {
        A: { frets: [-1, 0, 3, 2, 2, 1], refRoot: 9 },
        E: { frets: [0, 3, 2, 1, 1, 0], refRoot: 4 }
    },
    sus2: {
        A: { frets: [-1, 0, 2, 2, 0, 0], refRoot: 9 },
        E: { frets: [0, 2, 4, 4, 0, 0], refRoot: 4 }
    },
    sus4: {
        A: { frets: [-1, 0, 2, 2, 3, 0], refRoot: 9 },
        E: { frets: [0, 2, 2, 2, 0, 0], refRoot: 4 }
    },
    // Power chords are conventionally taught with exactly these two movable
    // shapes (root on string 6, root on string 5) -- never a full CAGED set.
    power: {
        A: { frets: [-1, 0, 2, 2, -1, -1], refRoot: 9 },
        E: { frets: [0, 2, 2, -1, -1, -1], refRoot: 4 }
    }
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

// Shape letters available for a chord quality, in canonical CAGED order.
// Returns [] for an unsupported/unknown quality rather than fabricating one.
function availableShapes(chordId) {
    var forms = SHAPES[chordId]
    if (!forms) return []
    var result = []
    for (var i = 0; i < SHAPE_ORDER.length; i++) if (forms[SHAPE_ORDER[i]]) result.push(SHAPE_ORDER[i])
    return result
}

// Produces the playable, transposed shape for one root/quality/shape-letter
// combination. Returns null when the shape doesn't exist, the tuning isn't
// Standard (CAGED is a Standard-tuning system), or the transposed shape
// would fall outside a clearly representable fret range.
function transposeCagedShape(chordId, shapeLetter, targetRootPitchClass, tuningNotes) {
    if (!isStandardTuning(tuningNotes)) return null
    var forms = SHAPES[chordId]
    var shape = forms && forms[shapeLetter]
    if (!shape) return null
    var root = ((Math.round(targetRootPitchClass) % 12) + 12) % 12
    var offset = ((root - shape.refRoot) % 12 + 12) % 12
    var strings = []
    var maxFret = 0
    var soundingCount = 0
    for (var s = 0; s < shape.frets.length; s++) {
        var relFret = shape.frets[s]
        var fret = relFret < 0 ? -1 : relFret + offset
        if (fret > MAX_FRET) return null
        var pc = fretPitchClass(tuningNotes[s], fret)
        strings.push({ stringIndex: s, fret: fret, muted: fret < 0, pitchClass: pc, isRoot: fret >= 0 && pc === root })
        if (fret >= 0) { maxFret = Math.max(maxFret, fret); soundingCount++ }
    }
    return {
        chordId: chordId,
        shape: shapeLetter,
        rootPitchClass: root,
        anchorFret: offset,
        startFret: offset,
        span: Math.max(1, maxFret - offset),
        barre: offset > 0,
        soundingCount: soundingCount,
        strings: strings
    }
}

// Flattened [string, fret] pairs for sounding (non-muted) strings, suitable
// for js/visual_shapes.js's highlightContext() so the same shape can be
// emphasized on the full chord-tone fretboard without re-deriving theory.
function shapePositions(transposedShape) {
    if (!transposedShape) return []
    var positions = []
    for (var i = 0; i < transposedShape.strings.length; i++) {
        var s = transposedShape.strings[i]
        if (!s.muted) positions.push([s.stringIndex, s.fret])
    }
    return positions
}

// Validates that every canonical definition is well-formed: six strings,
// integer frets in a sane range, at least one string open in the reference
// form (transposition assumes this to compute anchorFret), and at least
// three sounding strings. Used by tests so a malformed/impossible shape
// definition fails loudly instead of silently producing a bad diagram.
function validateShapeDefinition(frets) {
    if (!Array.isArray(frets) || frets.length !== 6) return false
    var hasOpenReference = false
    var sounding = 0
    for (var i = 0; i < frets.length; i++) {
        var f = frets[i]
        if (!isFinite(f) || Math.round(f) !== f || f < -1 || f > 12) return false
        if (f === 0) hasOpenReference = true
        if (f >= 0) sounding++
    }
    return hasOpenReference && sounding >= 3
}

function validateAllShapes() {
    var problems = []
    for (var chordId in SHAPES) {
        for (var letter in SHAPES[chordId]) {
            if (!validateShapeDefinition(SHAPES[chordId][letter].frets)) problems.push(chordId + ":" + letter)
        }
    }
    return problems
}
