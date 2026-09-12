.pragma library

// Built-in practice-session bank. Ships as code (like js/tunings.js,
// js/theory.js, js/exercises.js) and is never persisted or mutated -
// "customizing" a preset means duplicating it into the user's own routines
// first (see Service.duplicatePreset / js/routines.js's duplicateRoutine,
// which clears the `preset` flag and issues fresh ids).
//
// Each preset is authored directly in the same shape js/routines.js's
// createPresetRoutine/createItem produce, rather than importing routines.js
// (QML JS "import "x.js" as Y" between two .pragma library files isn't
// something the plain-Node test harness can parse, and this codebase's
// convention is small local duplication over cross-file coupling - see
// pitchClassIndex/parseNoteName repeated across theory.js/fretboard.js/
// pitch.js/chord_voicings.js). tests/presets.test.mjs cross-checks the
// shape against js/routines.js directly so the two can't silently drift.

var PRESET_CATEGORIES = ["Warmups", "Scales", "Scale Patterns", "Triads", "Chords", "Technique", "Rhythm"]

var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
var MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]

function pitchClassOf(name) {
    var normalized = String(name || "").trim()
    var letter = normalized[0].toUpperCase()
    var base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter]
    if (base === undefined) return 0
    for (var i = 1; i < normalized.length; i++) {
        if (normalized[i] === "#") base += 1
        else if (normalized[i] === "b") base -= 1
    }
    return ((base % 12) + 12) % 12
}

// The root note of the `degreeIndex`-th (0-based) triad in a major key,
// e.g. degreeRoot("C", 3) -> "F" (the IV chord's root).
function degreeRoot(keyName, degreeIndex) {
    var root = pitchClassOf(keyName)
    var pc = (root + MAJOR_SCALE_SEMITONES[degreeIndex % 7]) % 12
    return NOTE_NAMES[pc]
}

var DEGREE_QUALITY = ["major", "minor", "minor", "major", "major", "minor", "diminished"]

var idCounter = 0
function makeItemId(slug) {
    idCounter += 1
    return "preset-item-" + slug + "-" + idCounter
}

function makeItem(slug, fields) {
    var f = fields || {}
    return {
        id: makeItemId(slug),
        type: f.type || "custom",
        label: f.label || "",
        durationMinutes: f.durationMinutes !== undefined ? f.durationMinutes : null,
        targetBpm: f.targetBpm !== undefined ? f.targetBpm : null,
        metronome: f.metronome || null,
        notes: f.notes || "",
        scaleKey: f.scaleKey || null,
        chordKey: f.chordKey || null,
        fretWindow: f.fretWindow || null,
        pattern: f.pattern || null,
        status: "pending"
    }
}

// A single-focus preset: one item, optionally trainer-progressed.
function single(slug, type, fields) {
    var metronome = fields.metronomeEnabled === false ? null : {
        timeSignatureId: fields.timeSignatureId || "4-4",
        subdivisionId: fields.subdivisionId || "quarter",
        startBpm: fields.startBpm,
        incrementBpm: fields.incrementBpm,
        incrementMode: fields.incrementMode,
        intervalSeconds: fields.intervalSeconds,
        intervalBars: fields.intervalBars
    }
    return [makeItem(slug, {
        type: type,
        label: fields.label,
        durationMinutes: fields.durationMinutes || 5,
        targetBpm: fields.metronomeEnabled === false ? null : (fields.targetBpm || fields.startBpm || null),
        metronome: metronome,
        notes: fields.instructions || "",
        scaleKey: fields.key && fields.scaleId ? { key: fields.key, scaleId: fields.scaleId } : null,
        chordKey: fields.key && fields.chordId ? { key: fields.key, chordId: fields.chordId } : null,
        fretWindow: fields.fretWindow || null,
        pattern: fields.pattern || null
    })]
}

function preset(id, title, category, description, items) {
    return { id: id, name: title, category: category, description: description, items: items, preset: true, createdAt: 0, updatedAt: 0 }
}

// A short chord-progression preset: one item per chord, sharing tempo/time
// signature, so it walks through Service's existing routine runner
// (advanceRoutine) one chord at a time instead of needing new state.
function progression(slug, type, chords, shared) {
    return chords.map(function (chord, index) {
        return makeItem(slug + "-" + index, {
            type: type,
            label: chord.label,
            durationMinutes: shared.durationMinutes || 1,
            targetBpm: shared.targetBpm,
            metronome: { timeSignatureId: shared.timeSignatureId || "4-4", subdivisionId: shared.subdivisionId || "quarter" },
            notes: chord.notes || shared.instructions || "",
            chordKey: { key: chord.key, chordId: chord.chordId },
            pattern: shared.pattern || null
        })
    })
}

var PRESET_ROUTINES = [
    // ---------------------------------------------------------- Warmups
    preset("preset-warmup-chromatic", "Chromatic 1-2-3-4", "Warmups",
        "One finger per fret, ascending and descending on each string.",
        single("chromatic", "warmup", {
            label: "Chromatic 1-2-3-4", durationMinutes: 5,
            startBpm: 60, targetBpm: 100, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "One finger per fret (1-2-3-4), low E to high E, then back down. Keep unused fingers close to the strings.",
            pattern: ["1-2-3-4 ascending on each string", "4-3-2-1 descending back down"]
        })),
    preset("preset-warmup-spider", "Spider Exercise", "Warmups",
        "1-3-2-4 finger pattern walked up each pair of strings.",
        single("spider", "warmup", {
            label: "Spider Exercise", durationMinutes: 5,
            startBpm: 60, targetBpm: 100, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Play 1-3-2-4 across two adjacent strings, then shift the whole shape up one fret and repeat.",
            pattern: ["1-3-2-4", "shift up one fret, repeat"]
        })),
    preset("preset-warmup-finger-independence", "Finger Independence", "Warmups",
        "Hold fingers down while the others move, to break unwanted finger lift.",
        single("finger-independence", "warmup", {
            label: "Finger Independence", durationMinutes: 5,
            startBpm: 60, targetBpm: 90, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Plant finger 1 on a fret and leave it down while fingers 2, 3, and 4 fret notes above it. Repeat holding two fingers, then three.",
            pattern: ["1 planted, 2-3-4 move", "1-2 planted, 3-4 move"]
        })),
    preset("preset-warmup-string-crossing", "String Crossing Warmup", "Warmups",
        "Alternate-picked string skips to warm up picking-hand accuracy.",
        single("string-crossing", "warmup", {
            label: "String Crossing Warmup", durationMinutes: 5,
            startBpm: 70, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "Alternate pick between two non-adjacent strings, muting the string in between with your fretting hand.",
            pattern: ["low E - D - low E - D", "A - G - A - G"]
        })),

    // ---------------------------------------------------------- Scales
    preset("preset-scale-major-position", "Major Scale — One Position", "Scales",
        "One-octave major scale in a single fretboard position.",
        single("major-scale", "scales", {
            label: "Major Scale — One Position", key: "C", scaleId: "major", durationMinutes: 6,
            startBpm: 70, targetBpm: 130, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Play the scale ascending then descending, one note per click, without shifting position."
        })),
    preset("preset-scale-natural-minor-position", "Natural Minor Scale — One Position", "Scales",
        "One-octave natural minor scale in a single fretboard position.",
        single("natural-minor-scale", "scales", {
            label: "Natural Minor Scale — One Position", key: "A", scaleId: "natural_minor", durationMinutes: 6,
            startBpm: 70, targetBpm: 130, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Play the scale ascending then descending, one note per click, without shifting position."
        })),
    preset("preset-scale-minor-pentatonic-box1", "Minor Pentatonic — Box 1", "Scales",
        "The five-note minor pentatonic shape guitarists reach for first.",
        single("minor-pentatonic-box1", "scales", {
            label: "Minor Pentatonic — Box 1", key: "A", scaleId: "minor_pentatonic", durationMinutes: 6,
            startBpm: 70, targetBpm: 130, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Play the shape ascending and descending, then try improvising loosely over the click."
        })),
    preset("preset-scale-major-pentatonic-position", "Major Pentatonic — One Position", "Scales",
        "The bright, five-note major pentatonic shape in one position.",
        single("major-pentatonic-position", "scales", {
            label: "Major Pentatonic — One Position", key: "G", scaleId: "major_pentatonic", durationMinutes: 6,
            startBpm: 70, targetBpm: 130, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Play the shape ascending and descending, then try improvising loosely over the click."
        })),
    preset("preset-scale-blues", "Blues Scale", "Scales",
        "Minor pentatonic plus the blue note (b5).",
        single("blues-scale", "scales", {
            label: "Blues Scale", key: "A", scaleId: "blues", durationMinutes: 6,
            startBpm: 70, targetBpm: 120, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Play the scale ascending and descending, giving the blue note (b5) some extra weight/bend."
        })),
    preset("preset-scale-modes-one-root", "Modes Around One Root", "Scales",
        "The same root note, four different modes - hear how each one changes the color.",
        [
            makeItem("modes-dorian", { type: "scales", label: "D Dorian", durationMinutes: 2, targetBpm: 80, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, scaleKey: { key: "D", scaleId: "dorian" }, notes: "Minor with a raised 6th - a jazzy, open minor sound." }),
            makeItem("modes-phrygian", { type: "scales", label: "D Phrygian", durationMinutes: 2, targetBpm: 80, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, scaleKey: { key: "D", scaleId: "phrygian" }, notes: "Minor with a flat 2nd - a dark, Spanish-tinged sound." }),
            makeItem("modes-lydian", { type: "scales", label: "D Lydian", durationMinutes: 2, targetBpm: 80, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, scaleKey: { key: "D", scaleId: "lydian" }, notes: "Major with a raised 4th - a bright, floating sound." }),
            makeItem("modes-mixolydian", { type: "scales", label: "D Mixolydian", durationMinutes: 2, targetBpm: 80, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, scaleKey: { key: "D", scaleId: "mixolydian" }, notes: "Major with a flat 7th - a bluesy, dominant sound." })
        ]),

    // ---------------------------------------------------------- Scale Patterns
    preset("preset-pattern-thirds", "Scale in 3rds", "Scale Patterns",
        "Skip every other scale degree for a leaping, melodic line.",
        single("scale-thirds", "scales", {
            label: "Scale in 3rds", key: "C", scaleId: "major", durationMinutes: 6,
            startBpm: 60, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Play each scale degree paired with the one two steps above it, moving up the scale one degree at a time.",
            pattern: ["1-3", "2-4", "3-5", "4-6", "5-7", "6-8"]
        })),
    preset("preset-pattern-four-note", "Scale in 4-Note Sequences", "Scale Patterns",
        "Groups of four scale degrees, shifted up one degree at a time.",
        single("scale-four-note", "scales", {
            label: "Scale in 4-Note Sequences", key: "G", scaleId: "major", durationMinutes: 6,
            startBpm: 60, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Play four consecutive scale degrees, then start the next group of four one degree higher.",
            pattern: ["1-2-3-4", "2-3-4-5", "3-4-5-6", "4-5-6-7"]
        })),
    preset("preset-pattern-123-234", "1-2-3 / 2-3-4 Pattern", "Scale Patterns",
        "Three-note groups walked up the minor pentatonic shape.",
        single("scale-123-234", "scales", {
            label: "1-2-3 / 2-3-4 Pattern", key: "A", scaleId: "minor_pentatonic", durationMinutes: 6,
            startBpm: 60, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Play three consecutive scale degrees, then start the next group of three one degree higher.",
            pattern: ["1-2-3", "2-3-4", "3-4-5", "4-5-6", "5-6-7"]
        })),
    preset("preset-pattern-groups-of-four", "Ascend/Descend Groups of Four", "Scale Patterns",
        "Four-note groups that reverse direction before moving on.",
        single("groups-of-four", "scales", {
            label: "Ascend/Descend Groups of Four", key: "C", scaleId: "major", durationMinutes: 6,
            startBpm: 60, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Play a group of four ascending, then the same four descending, before moving the group up one degree.",
            pattern: ["1-2-3-4, 4-3-2-1", "2-3-4-5, 5-4-3-2", "3-4-5-6, 6-5-4-3"]
        })),
    preset("preset-pattern-three-per-string", "Three Notes Per String", "Scale Patterns",
        "A shifting, legato-friendly fingering with three notes on every string.",
        single("three-per-string", "scales", {
            label: "Three Notes Per String", key: "E", scaleId: "major", durationMinutes: 6,
            startBpm: 60, targetBpm: 120, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Play exactly three notes per string, shifting position as needed, without repeating a note on the same string.",
            pattern: ["3 notes per string, ascending", "3 notes per string, descending"]
        })),
    preset("preset-pattern-string-skipping-scale", "String-Skipping Scale Pattern", "Scale Patterns",
        "Scale tones played out of order by skipping a string each time.",
        single("string-skipping-scale", "scales", {
            label: "String-Skipping Scale Pattern", key: "A", scaleId: "minor_pentatonic", durationMinutes: 6,
            startBpm: 60, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Play scale tones while skipping one string each time you cross to a new one, widening the interval leaps.",
            pattern: ["string 6 -> string 4 -> string 2", "string 5 -> string 3 -> string 1"]
        })),

    // ---------------------------------------------------------- Triads
    preset("preset-triad-major-string-sets", "Major Triads Across String Sets", "Triads",
        "The same major triad shape moved across neighboring string sets.",
        single("major-triads", "chord_changes", {
            label: "Major Triads Across String Sets", key: "C", chordId: "major", durationMinutes: 5,
            startBpm: 60, targetBpm: 100, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Play the triad on strings 1-2-3, then find the same three notes on strings 2-3-4, then 3-4-5.",
            pattern: ["strings 1-2-3", "strings 2-3-4", "strings 3-4-5"]
        })),
    preset("preset-triad-minor-string-sets", "Minor Triads Across String Sets", "Triads",
        "The same minor triad shape moved across neighboring string sets.",
        single("minor-triads", "chord_changes", {
            label: "Minor Triads Across String Sets", key: "A", chordId: "minor", durationMinutes: 5,
            startBpm: 60, targetBpm: 100, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Play the triad on strings 1-2-3, then find the same three notes on strings 2-3-4, then 3-4-5.",
            pattern: ["strings 1-2-3", "strings 2-3-4", "strings 3-4-5"]
        })),
    preset("preset-triad-major-minor-alternation", "Major/Minor Triad Alternation", "Triads",
        "Switch a triad between major and minor to hear the third move.",
        [
            makeItem("triad-alt-major", { type: "chord_changes", label: "C Major Triad", durationMinutes: 2, targetBpm: 70, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, chordKey: { key: "C", chordId: "major" }, notes: "Root, major 3rd, 5th." }),
            makeItem("triad-alt-minor", { type: "chord_changes", label: "C Minor Triad", durationMinutes: 2, targetBpm: 70, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, chordKey: { key: "C", chordId: "minor" }, notes: "Same shape, minor 3rd instead - only one note moves." })
        ]),
    preset("preset-triad-inversions", "Triad Inversions", "Triads",
        "The same three notes, reordered - root position, 1st, and 2nd inversion.",
        single("triad-inversions", "chord_changes", {
            label: "Triad Inversions", key: "G", chordId: "major", durationMinutes: 5,
            startBpm: 60, targetBpm: 90, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Using the highlighted chord tones as a reference, find root position, then 1st inversion (3rd in the bass), then 2nd inversion (5th in the bass).",
            pattern: ["Root position", "1st inversion", "2nd inversion"]
        })),
    preset("preset-triad-diatonic-major-key", "Diatonic Triads in a Major Key", "Triads",
        "Every triad that occurs naturally in one major key, in order.",
        progression("diatonic-triads", "chord_changes", [
            { key: degreeRoot("C", 0), chordId: DEGREE_QUALITY[0], label: "I - " + degreeRoot("C", 0) },
            { key: degreeRoot("C", 1), chordId: DEGREE_QUALITY[1], label: "ii - " + degreeRoot("C", 1) + "m" },
            { key: degreeRoot("C", 2), chordId: DEGREE_QUALITY[2], label: "iii - " + degreeRoot("C", 2) + "m" },
            { key: degreeRoot("C", 3), chordId: DEGREE_QUALITY[3], label: "IV - " + degreeRoot("C", 3) },
            { key: degreeRoot("C", 4), chordId: DEGREE_QUALITY[4], label: "V - " + degreeRoot("C", 4) },
            { key: degreeRoot("C", 5), chordId: DEGREE_QUALITY[5], label: "vi - " + degreeRoot("C", 5) + "m" },
            { key: degreeRoot("C", 6), chordId: DEGREE_QUALITY[6], label: "vii° - " + degreeRoot("C", 6) + "dim" }
        ], { durationMinutes: 1, targetBpm: 70, instructions: "Play each triad in turn, in the key of C major." })),

    // ---------------------------------------------------------- Chords
    preset("preset-chord-open-changes", "Open Chord Changes", "Chords",
        "The four most common open chords, changed on the click.",
        progression("open-changes", "chord_changes", [
            { key: "G", chordId: "major", label: "G" },
            { key: "C", chordId: "major", label: "C" },
            { key: "D", chordId: "major", label: "D" },
            { key: "E", chordId: "minor", label: "Em" }
        ], { durationMinutes: 1, targetBpm: 70, instructions: "Change chord on the downbeat of every bar. Keep strumming through the change." })),
    preset("preset-chord-barre-changes", "Major/Minor Barre Chord Changes", "Chords",
        "Movable barre shapes, major to minor, up the neck.",
        progression("barre-changes", "chord_changes", [
            { key: "F", chordId: "major", label: "F (E-shape barre)" },
            { key: "B", chordId: "minor", label: "Bm (A-shape barre)" }
        ], { durationMinutes: 2, targetBpm: 60, instructions: "Keep the barre finger flat and firm through the change; let go of everything else between chords." })),
    preset("preset-chord-i-iv-v", "I-IV-V Progression", "Chords",
        "The three-chord backbone of countless songs.",
        progression("i-iv-v", "chord_changes", [
            { key: degreeRoot("G", 0), chordId: "major", label: "I - " + degreeRoot("G", 0) },
            { key: degreeRoot("G", 3), chordId: "major", label: "IV - " + degreeRoot("G", 3) },
            { key: degreeRoot("G", 4), chordId: "major", label: "V - " + degreeRoot("G", 4) }
        ], { durationMinutes: 1, targetBpm: 80, instructions: "Play each chord for one bar, in the key of G major." })),
    preset("preset-chord-ii-v-i", "ii-V-I Progression", "Chords",
        "The jazz turnaround - a minor ii, a dominant V, and home on I.",
        progression("ii-v-i", "chord_changes", [
            { key: degreeRoot("C", 1), chordId: "minor7", label: "ii - " + degreeRoot("C", 1) + "m7" },
            { key: degreeRoot("C", 4), chordId: "dominant7", label: "V7 - " + degreeRoot("C", 4) + "7" },
            { key: degreeRoot("C", 0), chordId: "major7", label: "I - " + degreeRoot("C", 0) + "maj7" }
        ], { durationMinutes: 1, targetBpm: 70, instructions: "Play each chord for one bar, in the key of C major." })),
    preset("preset-chord-i-v-vi-iv", "I-V-vi-IV Progression", "Chords",
        "The \"four chord song\" progression behind a huge number of pop songs.",
        progression("i-v-vi-iv", "chord_changes", [
            { key: degreeRoot("C", 0), chordId: "major", label: "I - " + degreeRoot("C", 0) },
            { key: degreeRoot("C", 4), chordId: "major", label: "V - " + degreeRoot("C", 4) },
            { key: degreeRoot("C", 5), chordId: "minor", label: "vi - " + degreeRoot("C", 5) + "m" },
            { key: degreeRoot("C", 3), chordId: "major", label: "IV - " + degreeRoot("C", 3) }
        ], { durationMinutes: 1, targetBpm: 90, instructions: "Play each chord for one bar, in the key of C major." })),
    preset("preset-chord-dominant7-changes", "Dominant 7 Chord Changes", "Chords",
        "Three dominant 7th chords, changed on the click.",
        progression("dominant7-changes", "chord_changes", [
            { key: "A", chordId: "dominant7", label: "A7" },
            { key: "D", chordId: "dominant7", label: "D7" },
            { key: "E", chordId: "dominant7", label: "E7" }
        ], { durationMinutes: 1, targetBpm: 80, instructions: "A classic 12-bar-blues chord set - change on the downbeat of every bar." })),
    preset("preset-chord-rhythm-drill", "Rhythm Chord-Change Drill", "Chords",
        "Two chords, changed on the click, with a strumming pattern to lock in.",
        progression("rhythm-drill", "chord_changes", [
            { key: "G", chordId: "major", label: "G" },
            { key: "D", chordId: "major", label: "D" }
        ], {
            durationMinutes: 2, targetBpm: 90, subdivisionId: "eighth",
            instructions: "Strum down-down-up-up-down-up each bar, changing chord on beat 1.",
            pattern: ["↓ ↓ ↑ ↑ ↓ ↑"]
        })),

    // ---------------------------------------------------------- Technique
    preset("preset-technique-alternate-picking", "Alternate Picking", "Technique",
        "Strict down-up picking on a single note, then a scale.",
        single("alternate-picking", "technique", {
            label: "Alternate Picking", key: "E", scaleId: "minor_pentatonic", durationMinutes: 6,
            startBpm: 70, targetBpm: 140, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "Pick strictly down-up-down-up, never two down-strokes in a row, even across string changes.",
            pattern: ["↓ ↑ ↓ ↑ ↓ ↑ ↓ ↑"]
        })),
    preset("preset-technique-economy-picking", "Economy-Picking Introduction", "Technique",
        "Picking direction follows the string change instead of alternating.",
        single("economy-picking", "technique", {
            label: "Economy-Picking Introduction", key: "A", scaleId: "minor_pentatonic", durationMinutes: 6,
            startBpm: 60, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "When moving to an adjacent higher string, pick down again instead of alternating; moving to a lower string, pick up again.",
            pattern: ["↓ ↓ (string change up)", "↑ ↑ (string change down)"]
        })),
    preset("preset-technique-legato", "Legato Hammer-On/Pull-Off Drill", "Technique",
        "Pick once, then hammer-on and pull-off for the rest of the phrase.",
        single("legato", "technique", {
            label: "Legato Hammer-On/Pull-Off Drill", key: "A", scaleId: "minor_pentatonic", durationMinutes: 6,
            startBpm: 60, targetBpm: 120, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Pick the first note only; hammer on to the next, then pull off back to it, keeping volume even without the pick.",
            pattern: ["1 h2 p1", "1 h2 h3 p2 p1"]
        })),
    preset("preset-technique-string-skipping", "String Skipping", "Technique",
        "Picking accuracy across non-adjacent strings.",
        single("string-skipping-technique", "technique", {
            label: "String Skipping", key: null, durationMinutes: 5,
            startBpm: 60, targetBpm: 120, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "Pick string 6, skip to string 4, skip to string 2, muting the strings in between with your fretting hand.",
            pattern: ["string 6 -> string 4 -> string 2"]
        })),
    preset("preset-technique-palm-mute", "Palm-Muted Eighth Notes", "Technique",
        "Steady, even palm-muted eighths - a rock/metal rhythm staple.",
        single("palm-mute", "technique", {
            label: "Palm-Muted Eighth Notes", key: "E", chordId: "power", durationMinutes: 5,
            startBpm: 80, targetBpm: 140, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "Rest the picking-hand palm lightly on the strings near the bridge. Keep every eighth note the same volume and length.",
            pattern: ["↓ ↑ ↓ ↑ ↓ ↑ ↓ ↑ (all muted)"]
        })),
    preset("preset-technique-accent-displacement", "Accent Displacement", "Technique",
        "Move a single accent through a steady eighth-note stream.",
        single("accent-displacement", "technique", {
            label: "Accent Displacement", key: null, durationMinutes: 5,
            startBpm: 70, targetBpm: 120, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "Play steady eighth notes on one note or chord. Accent only beat 1 for four bars, then only the \"&\" of beat 2, then only beat 3.",
            pattern: ["accent beat 1", "accent the & of beat 2", "accent beat 3"]
        })),

    // ---------------------------------------------------------- Rhythm
    preset("preset-rhythm-subdivision-drill", "Quarter/Eighth Subdivision Drill", "Rhythm",
        "Feel the difference between quarter- and eighth-note subdivisions.",
        [
            makeItem("subdiv-quarter", { type: "technique", label: "Quarter Notes", durationMinutes: 2, targetBpm: 90, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, notes: "Strum or pick one note per click." }),
            makeItem("subdiv-eighth", { type: "technique", label: "Eighth Notes", durationMinutes: 2, targetBpm: 90, metronome: { timeSignatureId: "4-4", subdivisionId: "eighth" }, notes: "Strum or pick two evenly-spaced notes per click." })
        ]),
    preset("preset-rhythm-triplets", "Triplets", "Rhythm",
        "Three evenly-spaced notes per click instead of two or four.",
        single("triplets", "technique", {
            label: "Triplets", key: null, durationMinutes: 5,
            startBpm: 70, targetBpm: 120, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "triplet",
            instructions: "Play three evenly-spaced notes per click. Count \"1-trip-let, 2-trip-let\" out loud if it helps."
        })),
    preset("preset-rhythm-sixteenth", "Sixteenth Notes", "Rhythm",
        "Four evenly-spaced notes per click - a fast, dense subdivision.",
        single("sixteenth", "technique", {
            label: "Sixteenth Notes", key: null, durationMinutes: 5,
            startBpm: 60, targetBpm: 100, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "sixteenth",
            instructions: "Play four evenly-spaced notes per click. Start slow - sixteenths fall apart quickly if rushed."
        })),
    preset("preset-rhythm-syncopation", "Eighth-Note Syncopation", "Rhythm",
        "Accent the off-beats to feel syncopation instead of a straight pulse.",
        single("syncopation", "technique", {
            label: "Eighth-Note Syncopation", key: null, durationMinutes: 5,
            startBpm: 70, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "Play steady eighths but accent only the off-beats (the \"&\"s), leaving the downbeats quiet.",
            pattern: ["quiet - ACCENT - quiet - ACCENT"]
        })),
    preset("preset-rhythm-accent-groups", "Accent Every 2 / 3 / 4 Notes", "Rhythm",
        "The same steady stream of notes, grouped by ear into 2s, then 3s, then 4s.",
        [
            makeItem("accent-2", { type: "technique", label: "Accent Every 2nd Note", durationMinutes: 2, targetBpm: 100, metronome: { timeSignatureId: "4-4", subdivisionId: "eighth" }, notes: "Steady eighths, accent every 2nd note." }),
            makeItem("accent-3", { type: "technique", label: "Accent Every 3rd Note", durationMinutes: 2, targetBpm: 100, metronome: { timeSignatureId: "4-4", subdivisionId: "eighth" }, notes: "Steady eighths, accent every 3rd note - the accent will drift across the beat." }),
            makeItem("accent-4", { type: "technique", label: "Accent Every 4th Note", durationMinutes: 2, targetBpm: 100, metronome: { timeSignatureId: "4-4", subdivisionId: "eighth" }, notes: "Steady eighths, accent every 4th note." })
        ]),
    preset("preset-rhythm-6-8-groove", "6/8 Groove Drill", "Rhythm",
        "A rolling compound-time feel: two big beats, each split into three.",
        single("6-8-groove", "technique", {
            label: "6/8 Groove Drill", key: null, durationMinutes: 6,
            startBpm: 60, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            timeSignatureId: "6-8", subdivisionId: "eighth",
            instructions: "Feel two big beats per bar, each one splitting into three - \"ONE-two-three-TWO-two-three\"."
        }))
]

function presetById(id) {
    for (var i = 0; i < PRESET_ROUTINES.length; i++) if (PRESET_ROUTINES[i].id === id) return PRESET_ROUTINES[i]
    return null
}

function presetsByCategory(category) {
    return PRESET_ROUTINES.filter(function (p) { return p.category === category })
}
