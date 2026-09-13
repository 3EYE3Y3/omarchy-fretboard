.pragma library

// v0.5 Jam Sessions: local, generated backing-track progressions.
//
// A progression is authored in Roman-numeral-relative form (a scale-degree
// semitone offset from the session's key, plus a chord quality) so the same
// data transposes to any of the 12 keys by simple arithmetic - no per-key
// duplication. `barsPerChord` is uniform within one progression, matching
// js/stage_engine.js's existing `{ mode: "bars", everyBars }` advance plan
// exactly (see resolveProgression): Jam Sessions reuse the same generic
// stage engine v0.4's dynamic practice routines use, not a second
// sequencing engine.
//
// Chord qualities are intervals only (major/minor/dominant7/major7/minor7/
// minor7b5/diminished7), kept local to this file rather than added to
// js/theory.js's CHORDS - that list is guitar-voicing-oriented (every entry
// must resolve to an audited, playable guitar shape in every root, see
// tests/canonical_music.test.mjs), while a Jam chord only needs a pitch-
// class set for fretboard-tone highlighting, not an exact diagram. See
// docs/MUSIC_CONTENT_AUDIT.md for progression sourcing.

var CHORD_QUALITY_INTERVALS = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    dominant7: [0, 4, 7, 10],
    major7: [0, 4, 7, 11],
    minor7: [0, 3, 7, 10],
    minor7b5: [0, 3, 6, 10],
    diminished7: [0, 3, 6, 9]
}

var CHORD_QUALITY_SYMBOL = {
    major: "", minor: "m", dominant7: "7", major7: "maj7", minor7: "m7", minor7b5: "m7b5", diminished7: "dim7"
}

var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
var TWELVE_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

function pitchClassOf(name) {
    var normalized = String(name || "").trim()
    if (!normalized) return 0
    var letter = normalized[0].toUpperCase()
    var base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter]
    if (base === undefined) return 0
    for (var i = 1; i < normalized.length; i++) {
        if (normalized[i] === "#") base += 1
        else if (normalized[i] === "b") base -= 1
    }
    return ((base % 12) + 12) % 12
}

function chordPitchClassSet(rootPitchClass, quality) {
    var intervals = CHORD_QUALITY_INTERVALS[quality] || CHORD_QUALITY_INTERVALS.major
    var set = {}
    for (var i = 0; i < intervals.length; i++) set[(rootPitchClass + intervals[i]) % 12] = true
    return set
}

function chordSymbol(rootPitchClass, quality) {
    return NOTE_NAMES[((Math.round(rootPitchClass) % 12) + 12) % 12] + (CHORD_QUALITY_SYMBOL[quality] || "")
}

function degreeChord(degree, semitones, quality) { return { degree: degree, semitones: semitones, quality: quality } }

// ---- verified progressions (see docs/MUSIC_CONTENT_AUDIT.md for sources) ----

// 12-bar dominant blues, quick-change at bar 2, V7-IV7-I7-V7 turnaround.
var MAJOR_BLUES_CHORDS = [
    degreeChord("I7", 0, "dominant7"), degreeChord("IV7", 5, "dominant7"), degreeChord("I7", 0, "dominant7"), degreeChord("I7", 0, "dominant7"),
    degreeChord("IV7", 5, "dominant7"), degreeChord("IV7", 5, "dominant7"), degreeChord("I7", 0, "dominant7"), degreeChord("I7", 0, "dominant7"),
    degreeChord("V7", 7, "dominant7"), degreeChord("IV7", 5, "dominant7"), degreeChord("I7", 0, "dominant7"), degreeChord("V7", 7, "dominant7")
]

// Same 12-bar shape with i/iv as minor7 and a dominant V7 turnaround for a
// stronger pull back to the tonic - the standard minor-blues form.
var MINOR_BLUES_CHORDS = [
    degreeChord("i7", 0, "minor7"), degreeChord("iv7", 5, "minor7"), degreeChord("i7", 0, "minor7"), degreeChord("i7", 0, "minor7"),
    degreeChord("iv7", 5, "minor7"), degreeChord("iv7", 5, "minor7"), degreeChord("i7", 0, "minor7"), degreeChord("i7", 0, "minor7"),
    degreeChord("V7", 7, "dominant7"), degreeChord("iv7", 5, "minor7"), degreeChord("i7", 0, "minor7"), degreeChord("V7", 7, "dominant7")
]

// Major ii-V-I turnaround.
var MAJOR_II_V_I_CHORDS = [
    degreeChord("iim7", 2, "minor7"), degreeChord("V7", 7, "dominant7"), degreeChord("Imaj7", 0, "major7")
]

// Minor ii-V-i: half-diminished ii, dominant V (the "alt" tensions a fully
// altered dominant adds are not representable without extended voicings, so
// a plain dominant7 stands in - a very common simplification in beginner
// material), minor7 tonic.
var MINOR_II_V_I_CHORDS = [
    degreeChord("iiø7", 2, "minor7b5"), degreeChord("V7", 7, "dominant7"), degreeChord("im7", 0, "minor7")
]

// Simplified educational 12-bar jazz blues: quick-change at bar 2, ii-V7
// approach to the I at bars 9-10 instead of plain V7-IV7.
var JAZZ_BLUES_CHORDS = [
    degreeChord("I7", 0, "dominant7"), degreeChord("IV7", 5, "dominant7"), degreeChord("I7", 0, "dominant7"), degreeChord("I7", 0, "dominant7"),
    degreeChord("IV7", 5, "dominant7"), degreeChord("IV7", 5, "dominant7"), degreeChord("I7", 0, "dominant7"), degreeChord("I7", 0, "dominant7"),
    degreeChord("iim7", 2, "minor7"), degreeChord("V7", 7, "dominant7"), degreeChord("I7", 0, "dominant7"), degreeChord("V7", 7, "dominant7")
]

// The classic two-chord Dorian vamp ("one minor, four seven"), e.g. Dm7-G7
// in D Dorian.
var DORIAN_VAMP_CHORDS = [
    degreeChord("im7", 0, "minor7"), degreeChord("IV7", 5, "dominant7")
]

var PROGRESSIONS = {
    "major-blues": { chords: MAJOR_BLUES_CHORDS, barsPerChord: 1, parentScaleId: "blues" },
    "minor-blues": { chords: MINOR_BLUES_CHORDS, barsPerChord: 1, parentScaleId: "minor_pentatonic" },
    "major-ii-v-i": { chords: MAJOR_II_V_I_CHORDS, barsPerChord: 2, parentScaleId: null },
    "minor-ii-v-i": { chords: MINOR_II_V_I_CHORDS, barsPerChord: 2, parentScaleId: null },
    "jazz-blues": { chords: JAZZ_BLUES_CHORDS, barsPerChord: 1, parentScaleId: null },
    "dorian-vamp": { chords: DORIAN_VAMP_CHORDS, barsPerChord: 4, parentScaleId: "dorian" }
}

var STYLES = [
    { id: "major-blues", label: "Major Blues", genre: "Blues", progressionId: "major-blues", defaultTempo: 100, defaultTimeSignatureId: "4-4", feel: "straight",
        description: "12-bar dominant blues with a quick change to IV7 in bar 2." },
    { id: "shuffle-blues", label: "Shuffle Blues", genre: "Blues", progressionId: "major-blues", defaultTempo: 100, defaultTimeSignatureId: "4-4", feel: "shuffle",
        description: "The same 12-bar blues, played with a swung shuffle eighth-note feel." },
    { id: "slow-blues", label: "Slow Blues", genre: "Blues", progressionId: "major-blues", defaultTempo: 60, defaultTimeSignatureId: "4-4", feel: "shuffle",
        description: "The same 12-bar blues at a slow, shuffled tempo." },
    { id: "minor-blues", label: "Minor Blues", genre: "Blues", progressionId: "minor-blues", defaultTempo: 90, defaultTimeSignatureId: "4-4", feel: "straight",
        description: "12-bar minor blues: im7-ivm7 with a dominant V7 turnaround." },
    { id: "major-ii-v-i", label: "Major ii-V-I", genre: "Jazz", progressionId: "major-ii-v-i", defaultTempo: 120, defaultTimeSignatureId: "4-4", feel: "swing",
        description: "The major-key ii7-V7-Imaj7 turnaround, 2 bars per chord." },
    { id: "minor-ii-v-i", label: "Minor ii-V-i", genre: "Jazz", progressionId: "minor-ii-v-i", defaultTempo: 110, defaultTimeSignatureId: "4-4", feel: "swing",
        description: "The minor-key iiø7-V7-im7 turnaround, 2 bars per chord." },
    { id: "jazz-blues", label: "Jazz Blues", genre: "Jazz", progressionId: "jazz-blues", defaultTempo: 130, defaultTimeSignatureId: "4-4", feel: "swing",
        description: "12-bar jazz blues: quick-change IV7 and a ii-V7 approach in bars 9-10." },
    { id: "dorian-vamp", label: "Dorian Vamp", genre: "Jazz", progressionId: "dorian-vamp", defaultTempo: 100, defaultTimeSignatureId: "4-4", feel: "straight",
        description: "The classic im7-IV7 Dorian modal vamp, 4 bars per chord." }
]

function styleById(id) {
    for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === id) return STYLES[i]
    return null
}

function stylesByGenre(genre) { return STYLES.filter(function (s) { return s.genre === genre }) }
function genres() {
    var seen = {}
    var list = []
    for (var i = 0; i < STYLES.length; i++) if (!seen[STYLES[i].genre]) { seen[STYLES[i].genre] = true; list.push(STYLES[i].genre) }
    return list
}

// Resolves a style + key into { stages, advance, style, parentScaleKey }.
// `stages` is directly consumable by js/stage_engine.js and by
// js/routines.js's resolveStageItem-style per-stage patches: each stage
// carries `label`, `rootPitchClass`, `rootName`, `quality` and `chordSymbol`
// so Service.qml can drive both the fretboard highlight and the audio
// engine's chord parameter without recomputing anything.
function resolveProgression(styleId, keyName) {
    var style = styleById(styleId)
    if (!style) return null
    var progression = PROGRESSIONS[style.progressionId]
    var keyPitchClass = pitchClassOf(keyName)
    var stages = progression.chords.map(function (c) {
        var rootPitchClass = (keyPitchClass + c.semitones) % 12
        var rootName = NOTE_NAMES[rootPitchClass]
        var symbol = chordSymbol(rootPitchClass, c.quality)
        return {
            label: c.degree + "  " + symbol,
            degree: c.degree,
            rootPitchClass: rootPitchClass,
            rootName: rootName,
            quality: c.quality,
            chordSymbol: symbol
        }
    })
    return {
        style: style,
        keyPitchClass: keyPitchClass,
        keyName: NOTE_NAMES[keyPitchClass],
        stages: stages,
        advance: { mode: "bars", everyBars: progression.barsPerChord },
        parentScaleId: progression.parentScaleId,
        totalBars: stages.length * progression.barsPerChord
    }
}

function keys() { return TWELVE_KEYS.slice() }
