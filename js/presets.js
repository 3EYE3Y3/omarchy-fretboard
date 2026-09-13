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

var C_MAJOR_POSITION = [[1, 3], [1, 5], [2, 2], [2, 3], [2, 5], [3, 2], [3, 4], [3, 5]]
var A_NATURAL_MINOR_POSITION = [[0, 5], [0, 7], [0, 8], [1, 5], [1, 7], [1, 8], [2, 5], [2, 7]]
var G_MAJOR_POSITION = [[0, 3], [0, 5], [0, 7], [1, 3], [1, 5], [1, 7], [2, 4], [2, 5]]
var A_BLUES_BOX1 = [[0, 5], [0, 8], [1, 5], [1, 6], [1, 7], [2, 5], [2, 7], [3, 5], [3, 7], [3, 8], [4, 5], [4, 8], [5, 5], [5, 8]]
var E_MAJOR_3NPS_POSITION = [[0,12],[0,14],[0,16],[1,12],[1,14],[1,16],[2,13],[2,14],[2,16],
    [3,13],[3,14],[3,16],[4,14],[4,16],[4,17],[5,14],[5,16],[5,17]]

function visualSteps(labels) { return (labels || []).map(function (label) { return { label: label } }) }

function positionAid(id, positions, mode, labels) {
    var aid = { mode: mode || "POSITION", id: id, tuningId: "standard", positions: positions }
    if (labels) { aid.steps = visualSteps(labels); aid.columns = 8 }
    return aid
}
function boxAid(box, labels) {
    var aid = { mode: "PENTATONIC_BOX", id: "minor-pentatonic-box-" + box, tuningId: "standard", box: box }
    if (labels) { aid.steps = visualSteps(labels); aid.columns = 8 }
    return aid
}
function threeNpsAid(kind) {
    var labels = []
    for (var i = 0; i < E_MAJOR_3NPS_POSITION.length; i++) {
        if (kind === "economy") labels.push(["↓","↑","↓"][i % 3])
        else if (kind === "legato") labels.push(["pick","h","h"][i % 3])
        else labels.push("S" + (6 - E_MAJOR_3NPS_POSITION[i][0]) + "f" + E_MAJOR_3NPS_POSITION[i][1])
    }
    return { mode: "THREE_NOTES_PER_STRING", id: "major-3nps-root-string-6", tuningId: "standard",
        sequence: E_MAJOR_3NPS_POSITION.map(function (p) { return { string: p[0], fret: p[1] } }),
        steps: visualSteps(labels), columns: 9 }
}
function triadAid(id, positions) { return positionAid(id, positions, "TRIAD_SHAPE") }
function chordAid(frets, label, labels) {
    var aid = { mode: "CHORD_SHAPE", id: label || "audited-chord-shape", tuningId: "standard", frets: frets || null }
    if (labels) { aid.steps = visualSteps(labels); aid.columns = 8 }
    return aid
}
function pathAid(id, positions, labels, mode) {
    var sequence = []
    var steps = []
    for (var i = 0; i < positions.length; i++) {
        sequence.push({ string: positions[i][0], fret: positions[i][1],
            label: labels && labels[i] && labels[i].length <= 2 ? labels[i] : String(i + 1) })
        steps.push({ label: labels && labels[i] ? labels[i] : String(i + 1) })
    }
    return { mode: mode || "FRETBOARD_PATH", id: id, tuningId: "standard",
        positions: positions, sequence: sequence, steps: steps, columns: Math.min(8, Math.max(1, steps.length)) }
}
// v0.4 dynamic-routine helpers. A stage is a partial item patch (see
// js/routines.js's resolveStageItem) plus a display `label`; `advance` says
// how the engine steps between stages (js/stage_engine.js). These builders
// keep every built-in dynamic preset's stage list declared as plainly as
// the existing static-preset helpers above.
function stage(label, patch) { return Object.assign({ label: label }, patch || {}) }
function timeAdvance(everySeconds) { return { mode: "time", everySeconds: everySeconds } }
function barAdvance(everyBars) { return { mode: "bars", everyBars: everyBars } }

function rhythmAid(id, labels, accents, columns, groupStarts) {
    var accentSet = {}
    var groupSet = {}
    ;(accents || []).forEach(function (n) { accentSet[n] = true })
    ;(groupStarts || []).forEach(function (n) { groupSet[n] = true })
    return { mode: "RHYTHM_GRID", id: id, columns: columns || labels.length,
        steps: labels.map(function (label, index) { return {
            label: label, accent: !!accentSet[index], groupStart: !!groupSet[index], rest: label === "·"
        } }) }
}

var idCounter = 0
function makeItemId(slug) {
    idCounter += 1
    return "preset-item-" + slug + "-" + idCounter
}

function makeItem(slug, fields) {
    var f = fields || {}
    var visualAid = f.visualAid || (f.scaleKey ? { mode: "FULL_FRETBOARD_SCALE" }
        : (f.chordKey ? chordAid(null, "curated-standard-voicings") : null))
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
        tuningId: f.tuningId || (visualAid && visualAid.tuningId ? visualAid.tuningId : null),
        visualAid: visualAid,
        fretWindow: f.fretWindow || null,
        pattern: f.pattern || null,
        stages: f.stages || null,
        advance: f.advance || null,
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
        tuningId: fields.tuningId || null,
        visualAid: fields.visualAid || null,
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
            tuningId: chord.tuningId || shared.tuningId || "standard",
            visualAid: chord.visualAid || chordAid(chord.frets || null, chord.shapeLabel || chord.label),
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
            instructions: "Choose a comfortable four-fret span (for example frets 5-8). Numbers are fretting fingers: play 1-2-3-4 on each string from 6 to 1, then 4-3-2-1 from string 1 to 6, one note per click.",
            pattern: ["S6→S1: fingers 1-2-3-4", "S1→S6: fingers 4-3-2-1"],
            visualAid: pathAid("chromatic-1234-frets-5-8",
                [[0,5],[0,6],[0,7],[0,8],[1,5],[1,6],[1,7],[1,8],[2,5],[2,6],[2,7],[2,8],[3,5],[3,6],[3,7],[3,8],[4,5],[4,6],[4,7],[4,8],[5,5],[5,6],[5,7],[5,8]],
                ["1","2","3","4","1","2","3","4","1","2","3","4","1","2","3","4","1","2","3","4","1","2","3","4"])
        })),
    preset("preset-warmup-spider", "Spider Exercise", "Warmups",
        "1-3-2-4 finger pattern walked up each pair of strings.",
        single("spider", "warmup", {
            label: "Spider Exercise", durationMinutes: 5,
            startBpm: 60, targetBpm: 100, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "At frets 5-8 play S6f5 (finger 1), S5f7 (3), S6f6 (2), S5f8 (4), one note per click. Repeat on each adjacent string pair; then shift up one fret.",
            pattern: ["S6f5(1) → S5f7(3) → S6f6(2) → S5f8(4)", "repeat on S5/S4 through S2/S1"],
            visualAid: pathAid("spider-13-24-seed", [[0,5],[1,7],[0,6],[1,8]], ["1","3","2","4"])
        })),
    preset("preset-warmup-finger-independence", "Finger Independence", "Warmups",
        "Hold fingers down while the others move, to break unwanted finger lift.",
        single("finger-independence", "warmup", {
            label: "Finger Independence", durationMinutes: 5,
            startBpm: 60, targetBpm: 90, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "On one string across four adjacent frets, keep finger 1 lightly planted while 2-3-4 play one note per click. Then keep 1-2 planted while 3-4 move. Stop if the static hold causes pain.",
            pattern: ["1 planted; 2-3-4 move", "1-2 planted; 3-4 move"],
            visualAid: pathAid("finger-independence-seed", [[0,5],[0,6],[0,7],[0,8]], ["hold 1","2","3","4"])
        })),
    preset("preset-warmup-string-crossing", "String Crossing Warmup", "Warmups",
        "Alternate-picked string skips to warm up picking-hand accuracy.",
        single("string-crossing", "warmup", {
            label: "String Crossing Warmup", durationMinutes: 5,
            startBpm: 70, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "Fret one comfortable note on each named string. Play one note per eighth-note click with strict alternate picking; mute the skipped string.",
            pattern: ["↓ S6 → ↑ S4 → ↓ S6 → ↑ S4", "↓ S5 → ↑ S3 → ↓ S5 → ↑ S3"],
            visualAid: pathAid("string-crossing-seed", [[0,5],[2,5],[0,5],[2,5],[1,5],[3,5],[1,5],[3,5]],
                ["↓ S6","↑ S4","↓ S6","↑ S4","↓ S5","↑ S3","↓ S5","↑ S3"], "PICKING_PATTERN")
        })),

    // ---------------------------------------------------------- Scales
    preset("preset-scale-major-position", "C Major — One Octave, 2nd Position", "Scales",
        "C major from C to C without leaving second position.",
        single("major-scale", "scales", {
            label: "C Major — One Octave, 2nd Position", key: "C", scaleId: "major", durationMinutes: 6,
            startBpm: 70, targetBpm: 130, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Standard tuning. Play strings 5 to 3: 3-5 | 2-3-5 | 2-4-5, then reverse; one note per click.",
            visualAid: positionAid("c-major-one-octave-second-position", C_MAJOR_POSITION)
        })),
    preset("preset-scale-natural-minor-position", "A Natural Minor — One Octave, 5th Position", "Scales",
        "A natural minor from A to A without leaving fifth position.",
        single("natural-minor-scale", "scales", {
            label: "A Natural Minor — One Octave, 5th Position", key: "A", scaleId: "natural_minor", durationMinutes: 6,
            startBpm: 70, targetBpm: 130, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Standard tuning. Play strings 6 to 4: 5-7-8 | 5-7-8 | 5-7, then reverse; one note per click.",
            visualAid: positionAid("a-natural-minor-one-octave-fifth-position", A_NATURAL_MINOR_POSITION)
        })),
    preset("preset-scale-minor-pentatonic-box1", "Minor Pentatonic — Box 1", "Scales",
        "The five-note minor pentatonic shape guitarists reach for first.",
        single("minor-pentatonic-box1", "scales", {
            label: "Minor Pentatonic — Box 1", key: "A", scaleId: "minor_pentatonic", durationMinutes: 6,
            startBpm: 70, targetBpm: 130, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Standard tuning. Play 5-8 on strings 6, 2 and 1; 5-7 on strings 5, 4 and 3. Reverse exactly; one note per click.",
            visualAid: boxAid(1)
        })),
    preset("preset-scale-major-pentatonic-position", "G Major Pentatonic — Full Fretboard", "Scales",
        "Every G major-pentatonic note on the displayed fretboard; this is scale membership, not a named box.",
        single("major-pentatonic-position", "scales", {
            label: "G Major Pentatonic — Full Fretboard", key: "G", scaleId: "major_pentatonic", durationMinutes: 6,
            startBpm: 70, targetBpm: 130, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Use the map to locate G-A-B-D-E across the neck. Choose a comfortable route and play one note per click; no specific position is implied."
        })),
    preset("preset-scale-blues", "A Blues Scale — Box 1", "Scales",
        "A minor-pentatonic Box 1 plus Eb, the b5 blue note.",
        single("blues-scale", "scales", {
            label: "A Blues Scale — Box 1", key: "A", scaleId: "blues", durationMinutes: 6,
            startBpm: 70, targetBpm: 120, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Standard tuning. Ascend and descend the exact highlighted box, one note per click. Treat Eb (b5) as a passing tension; do not bend it to an unspecified pitch.",
            visualAid: positionAid("a-blues-box-1", A_BLUES_BOX1)
        })),
    preset("preset-scale-modes-one-root", "Modes Around One Root", "Scales",
        "The same root note, four different modes - hear how each one changes the color.",
        [
            makeItem("modes-dorian", { type: "scales", label: "D Dorian", durationMinutes: 2, targetBpm: 80, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, scaleKey: { key: "D", scaleId: "dorian" }, notes: "D-E-F-G-A-B-C: minor with a raised 6th. Choose an ascending route on the full map, return to D, and play one note per click." }),
            makeItem("modes-phrygian", { type: "scales", label: "D Phrygian", durationMinutes: 2, targetBpm: 80, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, scaleKey: { key: "D", scaleId: "phrygian" }, notes: "D-Eb-F-G-A-Bb-C: minor with a flat 2nd. Choose an ascending route on the full map, return to D, and play one note per click." }),
            makeItem("modes-lydian", { type: "scales", label: "D Lydian", durationMinutes: 2, targetBpm: 80, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, scaleKey: { key: "D", scaleId: "lydian" }, notes: "D-E-F#-G#-A-B-C#: major with a raised 4th. Choose an ascending route on the full map, return to D, and play one note per click." }),
            makeItem("modes-mixolydian", { type: "scales", label: "D Mixolydian", durationMinutes: 2, targetBpm: 80, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, scaleKey: { key: "D", scaleId: "mixolydian" }, notes: "D-E-F#-G-A-B-C: major with a flat 7th. Choose an ascending route on the full map, return to D, and play one note per click." })
        ]),

    // ---------------------------------------------------------- Scale Patterns
    preset("preset-pattern-thirds", "Scale in 3rds", "Scale Patterns",
        "Skip every other scale degree for a leaping, melodic line.",
        single("scale-thirds", "scales", {
            label: "Scale in 3rds", key: "C", scaleId: "major", durationMinutes: 6,
            startBpm: 60, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Numbers are C-major scale degrees, not frets. In the highlighted octave play C-E, D-F, E-G, F-A, G-B, A-C; one note per click.",
            pattern: ["degrees 1-3, 2-4, 3-5", "degrees 4-6, 5-7, 6-8"],
            visualAid: positionAid("c-major-thirds-source", C_MAJOR_POSITION, "PATTERN",
                ["1","3","2","4","3","5","4","6","5","7","6","8"])
        })),
    preset("preset-pattern-four-note", "Scale in 4-Note Sequences", "Scale Patterns",
        "Groups of four scale degrees, shifted up one degree at a time.",
        single("scale-four-note", "scales", {
            label: "Scale in 4-Note Sequences", key: "G", scaleId: "major", durationMinutes: 6,
            startBpm: 60, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Numbers are G-major scale degrees, not frets. Play four consecutive scale notes per group, advancing the start by one degree; one note per click.",
            pattern: ["degrees 1-2-3-4", "2-3-4-5", "3-4-5-6", "4-5-6-7", "5-6-7-8"],
            visualAid: positionAid("g-major-four-note-source", G_MAJOR_POSITION, "PATTERN",
                ["1","2","3","4","2","3","4","5","3","4","5","6","4","5","6","7","5","6","7","8"])
        })),
    preset("preset-pattern-123-234", "1-2-3 / 2-3-4 Pattern", "Scale Patterns",
        "Three-note groups walked up the minor pentatonic shape.",
        single("scale-123-234", "scales", {
            label: "1-2-3 / 2-3-4 Pattern", key: "A", scaleId: "minor_pentatonic", durationMinutes: 6,
            startBpm: 60, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Numbers mean consecutive notes in the repeating five-note A-minor-pentatonic sequence, not diatonic degrees or frets. Continue through the whole Box 1 fingering.",
            pattern: ["notes 1-2-3, 2-3-4, 3-4-5", "then 4-5-6, 5-6-7 … through the box"],
            visualAid: boxAid(1, ["n1","n2","n3","n2","n3","n4","n3","n4","n5"])
        })),
    preset("preset-pattern-groups-of-four", "Ascend/Descend Groups of Four", "Scale Patterns",
        "Four-note groups that reverse direction before moving on.",
        single("groups-of-four", "scales", {
            label: "Ascend/Descend Groups of Four", key: "C", scaleId: "major", durationMinutes: 6,
            startBpm: 60, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Numbers are C-major scale degrees, not frets. Reverse each four-note group before starting one degree higher; one note per click.",
            pattern: ["degrees 1-2-3-4, 4-3-2-1", "2-3-4-5, 5-4-3-2", "3-4-5-6, 6-5-4-3", "4-5-6-7, 7-6-5-4", "5-6-7-8, 8-7-6-5"],
            visualAid: positionAid("c-major-groups-four-source", C_MAJOR_POSITION, "PATTERN",
                ["1","2","3","4","4","3","2","1","2","3","4","5","5","4","3","2"])
        })),
    preset("preset-pattern-three-per-string", "Three Notes Per String", "Scale Patterns",
        "A shifting, legato-friendly fingering with three notes on every string.",
        single("three-per-string", "scales", {
            label: "Three Notes Per String", key: "E", scaleId: "major", durationMinutes: 6,
            startBpm: 60, targetBpm: 120, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Standard tuning. E Ionian from string 6 upward: 12-14-16 | 12-14-16 | 13-14-16 | 13-14-16 | 14-16-17 | 14-16-17; reverse to descend, one note per click.",
            pattern: ["exactly 3 notes on every string", "root E is string 6, fret 12"],
            visualAid: threeNpsAid("sequence")
        })),
    preset("preset-pattern-string-skipping-scale", "String-Skipping Scale Pattern", "Scale Patterns",
        "Scale tones played out of order by skipping a string each time.",
        single("string-skipping-scale", "scales", {
            label: "String-Skipping Scale Pattern", key: "A", scaleId: "minor_pentatonic", durationMinutes: 6,
            startBpm: 60, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Standard tuning, A-minor-pentatonic Box 1. Strictly alternate-pick both notes on each named string, one note per click, and mute the skipped string.",
            pattern: ["↓↑ S6 5-8 → ↓↑ S4 5-7 → ↓↑ S2 5-8", "↓↑ S5 5-7 → ↓↑ S3 5-7 → ↓↑ S1 5-8"],
            visualAid: boxAid(1, ["↓S6f5","↑S6f8","↓S4f5","↑S4f7","↓S2f5","↑S2f8","↓S5f5","↑S5f7","↓S3f5","↑S3f7","↓S1f5","↑S1f8"])
        })),

    // ---------------------------------------------------------- Triads
    preset("preset-triad-major-string-sets", "Major Triads Across String Sets", "Triads",
        "C major root-position triads; the fingering changes across standard-tuning string sets.",
        [
            makeItem("c-major-321", { type: "chord_changes", label: "C major — strings 3-2-1", durationMinutes: 2, targetBpm: 60, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, chordKey: { key: "C", chordId: "major" }, tuningId: "standard", visualAid: triadAid("c-major-root-321", [[3, 5], [4, 5], [5, 3]]), notes: "Root position C-E-G: string 3 fret 5, string 2 fret 5, string 1 fret 3." }),
            makeItem("c-major-432", { type: "chord_changes", label: "C major — strings 4-3-2", durationMinutes: 2, targetBpm: 60, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, chordKey: { key: "C", chordId: "major" }, tuningId: "standard", visualAid: triadAid("c-major-root-432", [[2, 10], [3, 9], [4, 8]]), notes: "Root position C-E-G: string 4 fret 10, string 3 fret 9, string 2 fret 8." }),
            makeItem("c-major-543", { type: "chord_changes", label: "C major — strings 5-4-3", durationMinutes: 2, targetBpm: 60, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, chordKey: { key: "C", chordId: "major" }, tuningId: "standard", visualAid: triadAid("c-major-root-543", [[1, 3], [2, 2], [3, 0]]), notes: "Root position C-E-G: string 5 fret 3, string 4 fret 2, string 3 open." })
        ]),
    preset("preset-triad-minor-string-sets", "Minor Triads Across String Sets", "Triads",
        "A minor root-position triads; the fingering changes across standard-tuning string sets.",
        [
            makeItem("a-minor-321", { type: "chord_changes", label: "A minor — strings 3-2-1", durationMinutes: 2, targetBpm: 60, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, chordKey: { key: "A", chordId: "minor" }, tuningId: "standard", visualAid: triadAid("a-minor-root-321", [[3, 2], [4, 1], [5, 0]]), notes: "Root position A-C-E: string 3 fret 2, string 2 fret 1, string 1 open." }),
            makeItem("a-minor-432", { type: "chord_changes", label: "A minor — strings 4-3-2", durationMinutes: 2, targetBpm: 60, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, chordKey: { key: "A", chordId: "minor" }, tuningId: "standard", visualAid: triadAid("a-minor-root-432", [[2, 7], [3, 5], [4, 5]]), notes: "Root position A-C-E: string 4 fret 7, string 3 fret 5, string 2 fret 5." }),
            makeItem("a-minor-543", { type: "chord_changes", label: "A minor — strings 5-4-3", durationMinutes: 2, targetBpm: 60, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, chordKey: { key: "A", chordId: "minor" }, tuningId: "standard", visualAid: triadAid("a-minor-root-543", [[1, 12], [2, 10], [3, 9]]), notes: "Root position A-C-E: string 5 fret 12, string 4 fret 10, string 3 fret 9." })
        ]),
    preset("preset-triad-major-minor-alternation", "Major/Minor Triad Comparison", "Triads",
        "Compare C major and C minor in separate timed blocks and hear the third move.",
        [
            makeItem("triad-alt-major", { type: "chord_changes", label: "C Major Triad", durationMinutes: 2, targetBpm: 70, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, chordKey: { key: "C", chordId: "major" }, tuningId: "standard", visualAid: triadAid("c-major-root-321", [[3, 5], [4, 5], [5, 3]]), notes: "Strings 3-2-1: C-E-G at frets 5-5-3 (1-3-5)." }),
            makeItem("triad-alt-minor", { type: "chord_changes", label: "C Minor Triad", durationMinutes: 2, targetBpm: 70, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, chordKey: { key: "C", chordId: "minor" }, tuningId: "standard", visualAid: triadAid("c-minor-root-321", [[3, 5], [4, 4], [5, 3]]), notes: "Strings 3-2-1: C-Eb-G at frets 5-4-3 (1-b3-5); only the third moves." })
        ]),
    preset("preset-triad-inversions", "Triad Inversions", "Triads",
        "The same three notes, reordered - root position, 1st, and 2nd inversion.",
        [
            makeItem("g-triad-root", { type: "chord_changes", label: "G major — root position", durationMinutes: 2, targetBpm: 60, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, chordKey: { key: "G", chordId: "major" }, tuningId: "standard", visualAid: triadAid("g-major-root-321", [[3, 12], [4, 12], [5, 10]]), notes: "Strings 3-2-1: G-B-D (1-3-5), frets 12-12-10." }),
            makeItem("g-triad-first", { type: "chord_changes", label: "G major — 1st inversion", durationMinutes: 2, targetBpm: 60, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, chordKey: { key: "G", chordId: "major" }, tuningId: "standard", visualAid: triadAid("g-major-first-321", [[3, 4], [4, 3], [5, 3]]), notes: "Strings 3-2-1: B-D-G (3-5-1), frets 4-3-3; the third is the bass." }),
            makeItem("g-triad-second", { type: "chord_changes", label: "G major — 2nd inversion", durationMinutes: 2, targetBpm: 60, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, chordKey: { key: "G", chordId: "major" }, tuningId: "standard", visualAid: triadAid("g-major-second-321", [[3, 7], [4, 8], [5, 7]]), notes: "Strings 3-2-1: D-G-B (5-1-3), frets 7-8-7; the fifth is the bass." })
        ]),
    preset("preset-triad-diatonic-major-key", "Diatonic Triads in a Major Key", "Triads",
        "Every triad that occurs naturally in one major key, in order.",
        progression("diatonic-triads", "chord_changes", [
            { key: "C", chordId: "major", label: "I - C", visualAid: triadAid("c-major-root-321", [[3, 5], [4, 5], [5, 3]]) },
            { key: "D", chordId: "minor", label: "ii - Dm", visualAid: triadAid("d-minor-root-321", [[3, 7], [4, 6], [5, 5]]) },
            { key: "E", chordId: "minor", label: "iii - Em", visualAid: triadAid("e-minor-root-321", [[3, 9], [4, 8], [5, 7]]) },
            { key: "F", chordId: "major", label: "IV - F", visualAid: triadAid("f-major-root-321", [[3, 10], [4, 10], [5, 8]]) },
            { key: "G", chordId: "major", label: "V - G", visualAid: triadAid("g-major-root-321", [[3, 12], [4, 12], [5, 10]]) },
            { key: "A", chordId: "minor", label: "vi - Am", visualAid: triadAid("a-minor-root-321-high", [[3, 14], [4, 13], [5, 12]]) },
            { key: "B", chordId: "diminished", label: "vii° - Bdim", visualAid: triadAid("b-dim-root-321", [[3, 4], [4, 3], [5, 1]]) }
        ], { durationMinutes: 1, targetBpm: 70, instructions: "Strum the displayed root-position triad once per beat for this timed block, then select Next to advance through the C-major diatonic sequence." })),

    // ---------------------------------------------------------- Chords
    preset("preset-chord-open-changes", "Open Chord Shape Cycle", "Chords",
        "Four common open shapes in separate timed blocks: G, C, D and Em.",
        progression("open-changes", "chord_changes", [
            { key: "G", chordId: "major", label: "G", frets: [3, 2, 0, 0, 0, 3] },
            { key: "C", chordId: "major", label: "C", frets: [-1, 3, 2, 0, 1, 0] },
            { key: "D", chordId: "major", label: "D", frets: [-1, -1, 0, 2, 3, 2] },
            { key: "E", chordId: "minor", label: "Em", frets: [0, 2, 2, 0, 0, 0] }
        ], { durationMinutes: 1, targetBpm: 70, instructions: "Strum the displayed open chord once per beat for this timed block; select Next to move to the next shape." })),
    preset("preset-chord-barre-changes", "Major/Minor Barre Shape Cycle", "Chords",
        "An F major E-root barre and B minor A-root barre in separate timed blocks.",
        progression("barre-changes", "chord_changes", [
            { key: "F", chordId: "major", label: "F (E-shape barre)", frets: [1, 3, 3, 2, 1, 1] },
            { key: "B", chordId: "minor", label: "Bm (A-shape barre)", frets: [-1, 2, 4, 4, 3, 2] }
        ], { durationMinutes: 2, targetBpm: 60, instructions: "Strum the displayed barre shape once per beat; release pressure between repetitions. Select Next to advance." })),
    preset("preset-chord-i-iv-v", "I-IV-V Chord Shape Study", "Chords",
        "Learn the G-C-D shapes that form I-IV-V in G before looping the progression.",
        progression("i-iv-v", "chord_changes", [
            { key: "G", chordId: "major", label: "I - G", frets: [3, 2, 0, 0, 0, 3] },
            { key: "C", chordId: "major", label: "IV - C", frets: [-1, 3, 2, 0, 1, 0] },
            { key: "D", chordId: "major", label: "V - D", frets: [-1, -1, 0, 2, 3, 2] }
        ], { durationMinutes: 1, targetBpm: 80, instructions: "Strum the displayed chord once per beat for this block; select Next to advance through I-IV-V in G." })),
    preset("preset-chord-ii-v-i", "ii-V-I Seventh-Chord Shape Study", "Chords",
        "Learn Dm7-G7-Cmaj7, the ii-V-I sequence in C, one shape per timed block.",
        progression("ii-v-i", "chord_changes", [
            { key: "D", chordId: "minor7", label: "ii - Dm7", frets: [-1, 5, 7, 5, 6, 5] },
            { key: "G", chordId: "dominant7", label: "V7 - G7", frets: [3, 5, 3, 4, 3, 3] },
            { key: "C", chordId: "major7", label: "I - Cmaj7", frets: [-1, 3, 5, 4, 5, 3] }
        ], { durationMinutes: 1, targetBpm: 70, instructions: "Strum the displayed seventh chord once per beat; select Next to advance through ii-V-I in C." })),
    preset("preset-chord-i-v-vi-iv", "I-V-vi-IV Chord Shape Study", "Chords",
        "Learn the C-G-Am-F shapes for the common I-V-vi-IV sequence.",
        progression("i-v-vi-iv", "chord_changes", [
            { key: "C", chordId: "major", label: "I - C", frets: [-1, 3, 2, 0, 1, 0] },
            { key: "G", chordId: "major", label: "V - G", frets: [3, 2, 0, 0, 0, 3] },
            { key: "A", chordId: "minor", label: "vi - Am", frets: [-1, 0, 2, 2, 1, 0] },
            { key: "F", chordId: "major", label: "IV - F", frets: [1, 3, 3, 2, 1, 1] }
        ], { durationMinutes: 1, targetBpm: 90, instructions: "Strum the displayed chord once per beat for this block; select Next to advance through I-V-vi-IV in C." })),
    preset("preset-chord-dominant7-changes", "Dominant 7 Chord Shape Cycle", "Chords",
        "A7, D7 and E7 open shapes in separate timed blocks.",
        progression("dominant7-changes", "chord_changes", [
            { key: "A", chordId: "dominant7", label: "A7", frets: [-1, 0, 2, 0, 2, 0] },
            { key: "D", chordId: "dominant7", label: "D7", frets: [-1, -1, 0, 2, 1, 2] },
            { key: "E", chordId: "dominant7", label: "E7", frets: [0, 2, 0, 1, 0, 0] }
        ], { durationMinutes: 1, targetBpm: 80, instructions: "Strum the displayed dominant-7 shape once per beat; select Next to advance. These are the I7-IV7-V7 chord types used by an A blues." })),
    preset("preset-chord-rhythm-drill", "Rhythm Chord Shape Drill", "Chords",
        "Apply one precise eighth-note strumming pattern to G, then D, in timed blocks.",
        progression("rhythm-drill", "chord_changes", [
            { key: "G", chordId: "major", label: "G", frets: [3, 2, 0, 0, 0, 3] },
            { key: "D", chordId: "major", label: "D", frets: [-1, -1, 0, 2, 3, 2] }
        ], {
            durationMinutes: 2, targetBpm: 90, subdivisionId: "eighth",
            instructions: "In 4/4, keep the hand moving in eighths: play ↓ on 1, ↓ on 2, ↑ on the & of 2, ↑ on the & of 3, ↓ on 4 and ↑ on the & of 4. Select Next for D.",
            pattern: ["count: 1 & 2 & 3 & 4 &", "play:  ↓ · ↓ ↑ · ↑ ↓ ↑"]
        })),

    // ---------------------------------------------------------- Technique
    preset("preset-technique-alternate-picking", "Alternate Picking", "Technique",
        "Strict down-up picking through E-minor-pentatonic Box 1.",
        single("alternate-picking", "technique", {
            label: "Alternate Picking", key: "E", scaleId: "minor_pentatonic", durationMinutes: 6,
            startBpm: 70, targetBpm: 140, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "Standard tuning, E-minor-pentatonic Box 1. Play one note per eighth-note click, strictly down-up even across string changes.",
            pattern: ["↓ ↑ ↓ ↑ ↓ ↑ ↓ ↑"],
            visualAid: boxAid(1, ["↓","↑","↓","↑","↓","↑","↓","↑"])
        })),
    preset("preset-technique-economy-picking", "Economy Picking on E Major 3NPS", "Technique",
        "Three notes per string make the repeated sweep-direction string change explicit.",
        single("economy-picking", "technique", {
            label: "Economy Picking on E Major 3NPS", key: "E", scaleId: "major", durationMinutes: 6,
            startBpm: 60, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "Standard tuning. Ascending, pick ↓↑↓ then use another ↓ through the adjacent higher string; descending, pick ↑↓↑ then another ↑ through the lower string. One note per click.",
            pattern: ["ascending: ↓ ↑ ↓ | ↓ ↑ ↓", "descending: ↑ ↓ ↑ | ↑ ↓ ↑"],
            visualAid: threeNpsAid("economy")
        })),
    preset("preset-technique-legato", "Legato Hammer-On/Pull-Off Drill", "Technique",
        "Pick once, then hammer-on and pull-off for the rest of the phrase.",
        single("legato", "technique", {
            label: "Legato Hammer-On/Pull-Off Drill", key: "E", scaleId: "major", durationMinutes: 6,
            startBpm: 60, targetBpm: 120, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "On each string of the highlighted E-major 3NPS shape, pick the first note, hammer the next two, then pull off in reverse. Numbers are fingers, not scale degrees. Begin unmetered; when even, place one complete five-note slur on each click.",
            pattern: ["1 h 2 h 4 p 2 p 1", "adjust 1-2-4 to 1-3-4 where the fret spacing requires"],
            visualAid: threeNpsAid("legato")
        })),
    preset("preset-technique-string-skipping", "String Skipping", "Technique",
        "Picking accuracy across non-adjacent strings.",
        single("string-skipping-technique", "technique", {
            label: "String Skipping", key: null, durationMinutes: 5,
            startBpm: 60, targetBpm: 120, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "On one comfortably fretted note, alternate-pick string 6, then 4, then 2; reverse 2-4-6. Mute strings 5, 3 and 1.",
            pattern: ["↓ S6 → ↑ S4 → ↓ S2", "↑ S2 → ↓ S4 → ↑ S6"],
            visualAid: pathAid("string-skipping-6-4-2", [[0,5],[2,5],[4,5]], ["↓ S6","↑ S4","↓ S2"], "PICKING_PATTERN")
        })),
    preset("preset-technique-palm-mute", "Palm-Muted Eighth Notes", "Technique",
        "Steady, even palm-muted eighths - a rock/metal rhythm staple.",
        single("palm-mute", "technique", {
            label: "Palm-Muted Eighth Notes", key: "E", chordId: "power", durationMinutes: 5,
            startBpm: 80, targetBpm: 140, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "Standard tuning, open E5 (strings 6-5-4: 0-2-2). Play one palm-muted stroke per eighth-note click near the bridge.",
            pattern: ["1 & 2 & 3 & 4 &", "↓ ↑ ↓ ↑ ↓ ↑ ↓ ↑ (all muted)"],
            visualAid: chordAid([0, 2, 2, -1, -1, -1], "open-e5", ["↓","↑","↓","↑","↓","↑","↓","↑"])
        })),
    preset("preset-technique-accent-displacement", "Accent Displacement", "Technique",
        "Move a single accent through a steady eighth-note stream.",
        single("accent-displacement", "technique", {
            label: "Accent Displacement", key: null, durationMinutes: 5,
            startBpm: 70, targetBpm: 120, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "Play one note per eighth-note click. For four bars each, accent only beat 1, then only the & of beat 2, then only beat 3; the app click still accents beat 1.",
            pattern: [">1 & 2 & 3 & 4 &", "1 & 2 >& 3 & 4 &", "1 & 2 & >3 & 4 &"],
            visualAid: rhythmAid("accent-displacement",
                ["1","&","2","&","3","&","4","&","1","&","2","&","3","&","4","&","1","&","2","&","3","&","4","&"],
                [0,11,20], 8, [0,8,16])
        })),

    // ---------------------------------------------------------- Rhythm
    preset("preset-rhythm-subdivision-drill", "Quarter/Eighth Subdivision Drill", "Rhythm",
        "Feel the difference between quarter- and eighth-note subdivisions.",
        [
            makeItem("subdiv-quarter", { type: "technique", label: "Quarter Notes", durationMinutes: 2, targetBpm: 90, metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" }, notes: "Play one quarter note per click at 90 BPM.", pattern: ["1   2   3   4"], visualAid: rhythmAid("quarter-notes", ["1","2","3","4"], [0], 4) }),
            makeItem("subdiv-eighth", { type: "technique", label: "Eighth Notes", durationMinutes: 2, targetBpm: 90, metronome: { timeSignatureId: "4-4", subdivisionId: "eighth" }, notes: "The click now sounds twice per beat; play one eighth note per click.", pattern: ["1 & 2 & 3 & 4 &"], visualAid: rhythmAid("eighth-notes", ["1","&","2","&","3","&","4","&"], [0], 8) })
        ]),
    preset("preset-rhythm-triplets", "Triplets", "Rhythm",
        "Three evenly spaced notes within each quarter-note beat.",
        single("triplets", "technique", {
            label: "Triplets", key: null, durationMinutes: 5,
            startBpm: 70, targetBpm: 120, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "triplet",
            instructions: "The click sounds three times per quarter-note beat. Play one note per click and count 1-trip-let, 2-trip-let.",
            pattern: ["1-trip-let 2-trip-let 3-trip-let 4-trip-let"],
            visualAid: rhythmAid("quarter-note-triplets", ["1","trip","let","2","trip","let","3","trip","let","4","trip","let"], [0], 6, [0,3,6,9])
        })),
    preset("preset-rhythm-sixteenth", "Sixteenth Notes", "Rhythm",
        "Four evenly spaced notes within each quarter-note beat.",
        single("sixteenth", "technique", {
            label: "Sixteenth Notes", key: null, durationMinutes: 5,
            startBpm: 60, targetBpm: 100, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "sixteenth",
            instructions: "The click sounds four times per quarter-note beat. Play one note per click; count 1-e-&-a through 4-e-&-a.",
            pattern: ["1 e & a 2 e & a 3 e & a 4 e & a"],
            visualAid: rhythmAid("sixteenth-notes", ["1","e","&","a","2","e","&","a","3","e","&","a","4","e","&","a"], [0], 8, [0,4,8,12])
        })),
    preset("preset-rhythm-syncopation", "Eighth-Note Syncopation", "Rhythm",
        "Accent the off-beats to feel syncopation instead of a straight pulse.",
        single("syncopation", "technique", {
            label: "Eighth-Note Syncopation", key: null, durationMinutes: 5,
            startBpm: 70, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "Play one note per eighth-note click; keep downbeats soft and accent every offbeat (&). The app click still accents beat 1.",
            pattern: ["1 >& 2 >& 3 >& 4 >&"],
            visualAid: rhythmAid("eighth-syncopation", ["1","&","2","&","3","&","4","&"], [1,3,5,7], 8)
        })),
    preset("preset-rhythm-accent-groups", "Accent Every 2 / 3 / 4 Notes", "Rhythm",
        "The same steady stream of notes, grouped by ear into 2s, then 3s, then 4s.",
        [
            makeItem("accent-2", { type: "technique", label: "Accent Every 2nd Note", durationMinutes: 2, targetBpm: 100, metronome: { timeSignatureId: "4-4", subdivisionId: "eighth" }, notes: "One note per click; accent notes 2, 4, 6 and 8.", pattern: ["· > · > · > · >"], visualAid: rhythmAid("accent-every-2", ["1","2","3","4","5","6","7","8"], [1,3,5,7], 8) }),
            makeItem("accent-3", { type: "technique", label: "Accent Every 3rd Note", durationMinutes: 2, targetBpm: 100, metronome: { timeSignatureId: "4-4", subdivisionId: "eighth" }, notes: "One note per click; accent every third note continuously, so accents cross the barline.", pattern: ["· · > · · > · · | > · · > …"], visualAid: rhythmAid("accent-every-3", ["1","2","3","4","5","6","7","8","1","2","3","4"], [2,5,8,11], 8) }),
            makeItem("accent-4", { type: "technique", label: "Accent Every 4th Note", durationMinutes: 2, targetBpm: 100, metronome: { timeSignatureId: "4-4", subdivisionId: "eighth" }, notes: "One note per click; accent notes 4 and 8.", pattern: ["· · · > · · · >"], visualAid: rhythmAid("accent-every-4", ["1","2","3","4","5","6","7","8"], [3,7], 8) })
        ]),
    preset("preset-rhythm-6-8-groove", "6/8 Groove Drill", "Rhythm",
        "A rolling compound-time feel: two big beats, each split into three.",
        single("6-8-groove", "technique", {
            label: "6/8 Groove Drill", key: null, durationMinutes: 6,
            startBpm: 60, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            timeSignatureId: "6-8", subdivisionId: "triplet",
            instructions: "BPM is the dotted-quarter pulse: two beats per bar. The click gives three written eighth notes per beat; play one note per click and accent notes 1 and 4. The app uses its stronger click on bar-start note 1 only.",
            pattern: [">1 2 3  >4 5 6", "ONE-two-three FOUR-five-six"],
            visualAid: rhythmAid("six-eight-two-dotted-quarter-beats", ["1","la","li","2","la","li"], [0,3], 6, [0,3])
        })),

    // ---------------------------------------------------------- Hybrid Picking (v0.4, Technique)
    // Right-hand notation: P = pick, M = middle finger, R = ring finger.
    // Every coordinate below is independently reproducible: pentatonic/triad
    // shapes reuse this file's own verified boxAid/positionAid data or the
    // MIDI-interval math in js/visual_shapes.js's triadShapes(); the two
    // diatonic-interval double-stop routines (thirds, sixths) were located by
    // walking js/theory.js's own scale pitch-class set across two strings, not
    // copied from any tab or lesson source. See docs/MUSIC_CONTENT_AUDIT.md.
    preset("preset-hybrid-pick-middle-alternation", "Hybrid Picking — Pick + Middle Alternation", "Technique",
        "The foundational hybrid-picking coordination drill: pick and middle finger strike in strict alternation.",
        single("hybrid-pick-middle-alternation", "technique", {
            label: "Pick + Middle Alternation", key: null, durationMinutes: 5,
            startBpm: 70, targetBpm: 120, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120, subdivisionId: "eighth",
            instructions: "Hold the pick normally. P = flatpick strikes the open low E (string 6); M = middle finger plucks string 1 fret 5 (A). Keep both hands relaxed; the middle finger plucks up and away from the body, the pick strikes down.",
            pattern: ["P (open S6) → M (S1 f5) → repeat"],
            visualAid: pathAid("hybrid-pick-middle-alternation", [[0,0],[5,5],[0,0],[5,5],[0,0],[5,5],[0,0],[5,5]],
                ["P","M","P","M","P","M","P","M"], "PICKING_PATTERN")
        })),
    preset("preset-hybrid-pick-middle-ring", "Hybrid Picking — Pick + Middle + Ring", "Technique",
        "A three-finger rolling pattern across an open G chord, coordinating pick, middle and ring.",
        single("hybrid-pick-middle-ring", "technique", {
            label: "Pick + Middle + Ring", key: "G", chordId: "major", durationMinutes: 5,
            startBpm: 60, targetBpm: 100, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Open G (3-2-0-0-0-3). P = pick plucks string 6 fret 3 (root); M = middle plucks string 3 open (5th); R = ring plucks string 1 fret 3 (root, octave up). Roll P-M-R repeatedly, letting all three ring together.",
            pattern: ["P (S6 f3) → M (S3 open) → R (S1 f3) → repeat"],
            visualAid: pathAid("hybrid-pick-middle-ring-g", [[0,3],[3,0],[5,3],[0,3],[3,0],[5,3]],
                ["P","M","R","P","M","R"], "PICKING_PATTERN")
        })),
    preset("preset-hybrid-pedal-tone", "Hybrid Picking — Pedal-Tone", "Technique",
        "A fixed pick note repeats under a moving middle-finger melody drawn from the verified A-minor-pentatonic Box 1.",
        single("hybrid-pedal-tone", "technique", {
            label: "Pedal-Tone Hybrid Picking", key: "A", scaleId: "minor_pentatonic", durationMinutes: 5,
            startBpm: 65, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "P = pick repeats open string 5 (A) as a pedal tone under every note. M = middle finger plays the Box-1 notes on strings 2 and 1 in order (B-string frets 5, 8; high-E frets 5, 8), one per pedal.",
            pattern: ["P (open S5) between every M note", "M walks S2 f5 → S2 f8 → S1 f5 → S1 f8"],
            visualAid: pathAid("hybrid-pedal-tone-box1", [[1,0],[4,5],[1,0],[4,8],[1,0],[5,5],[1,0],[5,8]],
                ["P","M","P","M","P","M","P","M"], "PICKING_PATTERN")
        })),
    preset("preset-hybrid-string-skipping", "Hybrid Picking — String Skipping", "Technique",
        "Pick, ring and middle each claim a non-adjacent string so no string is ever crossed by an adjacent stroke.",
        single("hybrid-string-skipping", "technique", {
            label: "String-Skipping Hybrid Picking", key: null, durationMinutes: 5,
            startBpm: 65, targetBpm: 110, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Fret the same comfortable fret (5) on strings 6, 3 and 1. P strikes string 6, R plucks string 3 (skipping 5 and 4), M plucks string 1 (skipping 2). Mute the skipped strings with fretting-hand contact.",
            pattern: ["P (S6) → R (S3, skips S5/S4) → M (S1, skips S2) → repeat"],
            visualAid: pathAid("hybrid-string-skipping", [[0,5],[3,5],[5,5],[0,5],[3,5],[5,5]],
                ["P","R","M","P","R","M"], "PICKING_PATTERN")
        })),
    preset("preset-hybrid-major-triad", "Hybrid Picking — Major Triad", "Technique",
        "Pick, middle and ring grab a low-position C major triad together as a single hybrid-picked chord.",
        single("hybrid-major-triad", "technique", {
            label: "Major Triad Hybrid Picking", key: "C", chordId: "major", durationMinutes: 5,
            startBpm: 60, targetBpm: 100, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Root-position C major on strings 6-5-4 (frets 8-7-5; verified via the app's own triad-shape math). P = pick on string 6 (root C); M = middle on string 5 (E); R = ring on string 4 (G). Pluck all three together, then repeat.",
            pattern: ["P+M+R together (S6 f8, S5 f7, S4 f5) → repeat"],
            visualAid: pathAid("hybrid-major-triad-456", [[0,8],[1,7],[2,5],[0,8],[1,7],[2,5]],
                ["P","M","R","P","M","R"], "PICKING_PATTERN")
        })),
    preset("preset-hybrid-minor-triad", "Hybrid Picking — Minor Triad", "Technique",
        "Pick, middle and ring grab a low-position A minor triad together as a single hybrid-picked chord.",
        single("hybrid-minor-triad", "technique", {
            label: "Minor Triad Hybrid Picking", key: "A", chordId: "minor", durationMinutes: 5,
            startBpm: 60, targetBpm: 100, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "Root-position A minor on strings 6-5-4 (frets 5-3-2; verified via the app's own triad-shape math). P = pick on string 6 (root A); M = middle on string 5 (C); R = ring on string 4 (E). Pluck all three together, then repeat.",
            pattern: ["P+M+R together (S6 f5, S5 f3, S4 f2) → repeat"],
            visualAid: pathAid("hybrid-minor-triad-456", [[0,5],[1,3],[2,2],[0,5],[1,3],[2,2]],
                ["P","M","R","P","M","R"], "PICKING_PATTERN")
        })),
    preset("preset-hybrid-thirds", "Hybrid Picking in Thirds", "Technique",
        "Diatonic 3rd double-stops on strings 3-2, pick taking the lower voice and middle the upper.",
        single("hybrid-thirds", "technique", {
            label: "Hybrid Picking in Thirds", key: "C", scaleId: "major", durationMinutes: 5,
            startBpm: 60, targetBpm: 100, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "C major diatonic 3rds across strings 3 (G) and 2 (B), located by walking the scale's own pitch-class set across both strings. P always takes string 3 (lower voice), M always takes string 2 (upper voice); pluck each dyad together and ascend.",
            pattern: ["P+M together, ascending: (S3f0,S2f0) → (S3f2,S2f1) → (S3f4,S2f3) → (S3f5,S2f5) → (S3f7,S2f6) → (S3f9,S2f8)"],
            visualAid: pathAid("hybrid-thirds-c-major",
                [[3,0],[4,0],[3,2],[4,1],[3,4],[4,3],[3,5],[4,5],[3,7],[4,6],[3,9],[4,8]],
                ["P","M","P","M","P","M","P","M","P","M","P","M"], "PICKING_PATTERN")
        })),
    preset("preset-hybrid-sixths", "Hybrid Picking — Double Stops in Sixths", "Technique",
        "Diatonic 6th double-stops on strings 4-2, the country/Nashville hybrid-picking staple, played without bends.",
        single("hybrid-sixths", "technique", {
            label: "Double Stops in Sixths", key: "G", scaleId: "major", durationMinutes: 5,
            startBpm: 65, targetBpm: 105, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120,
            instructions: "G major diatonic 6ths across strings 4 (D) and 2 (B), located by walking the scale's own pitch-class set across both strings. P always takes string 4 (lower voice), M always takes string 2 (upper voice); pluck each dyad together and ascend.",
            pattern: ["P+M together, ascending: (S4f5,S2f5) → (S4f7,S2f7) → (S4f9,S2f8)"],
            visualAid: pathAid("hybrid-sixths-g-major", [[2,5],[4,5],[2,7],[4,7],[2,9],[4,8]],
                ["P","M","P","M","P","M"], "PICKING_PATTERN")
        })),

    // ---------------------------------------------------------- Dynamic Routines (v0.4)
    // Each is a single item carrying an optional data-driven `stages`/
    // `advance` pair (js/routines.js's resolveStageItem, js/stage_engine.js).
    // Stage payloads reuse this file's own verified coordinates - nothing
    // here re-derives scale, box or triad theory. durationMinutes always
    // equals stages.length * advance interval so the practice timer (which
    // also gates Pause/Resume, see Service.qml) covers the whole sequence.
    preset("preset-dynamic-pentatonic-all-boxes", "Minor Pentatonic — All 5 Boxes", "Scales",
        "Automatically progresses through all five verified A-minor-pentatonic box shapes in the same key, full-fretboard context, active box highlighted.",
        [makeItem("dynamic-pentatonic-all-boxes", {
            type: "scales", label: "Minor Pentatonic — All 5 Boxes", durationMinutes: 10, targetBpm: 90,
            metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" },
            notes: "Standard tuning, A minor pentatonic. The highlighted box advances automatically every 2 minutes; use Previous/Next to move manually. Ascend and descend the active shape only.",
            scaleKey: { key: "A", scaleId: "minor_pentatonic" }, tuningId: "standard",
            visualAid: boxAid(1),
            stages: [
                stage("Box 1", { notes: "Box 1: root on string 6, fret 5.", visualAid: boxAid(1) }),
                stage("Box 2", { notes: "Box 2: shift up; root now on string 5.", visualAid: boxAid(2) }),
                stage("Box 3", { notes: "Box 3: root on strings 4 and 2.", visualAid: boxAid(3) }),
                stage("Box 4", { notes: "Box 4: root on string 3.", visualAid: boxAid(4) }),
                stage("Box 5", { notes: "Box 5: root returns on string 6, one octave up.", visualAid: boxAid(5) })
            ],
            advance: timeAdvance(120)
        })]),
    preset("preset-dynamic-pentatonic-updown", "Pentatonic Boxes — Ascending/Descending", "Scale Patterns",
        "Walks Box 1 up to Box 5 and back down to Box 1, one A-minor-pentatonic box per minute.",
        [makeItem("dynamic-pentatonic-updown", {
            type: "scales", label: "Pentatonic Boxes — Ascending/Descending", durationMinutes: 9, targetBpm: 90,
            metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" },
            notes: "Standard tuning, A minor pentatonic. Box advances every minute: 1→2→3→4→5→4→3→2→1.",
            scaleKey: { key: "A", scaleId: "minor_pentatonic" }, tuningId: "standard",
            visualAid: boxAid(1),
            stages: [1, 2, 3, 4, 5, 4, 3, 2, 1].map(function (box, i) {
                return stage("Box " + box + (i > 4 ? " (descending)" : ""), { visualAid: boxAid(box) })
            }),
            advance: timeAdvance(60)
        })]),
    preset("preset-dynamic-triad-inversions", "Triad Inversion Ladder", "Triads",
        "Automatically steps through G major root position, 1st inversion and 2nd inversion on the same string set.",
        [makeItem("dynamic-triad-inversions", {
            type: "chord_changes", label: "Triad Inversion Ladder", durationMinutes: 4, targetBpm: 70,
            metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" },
            notes: "Standard tuning, G major, strings 3-2-1 throughout. The inversion advances every 80 seconds.",
            chordKey: { key: "G", chordId: "major" }, tuningId: "standard",
            visualAid: triadAid("g-major-root-321", [[3, 12], [4, 12], [5, 10]]),
            stages: [
                stage("Root position", { notes: "G-B-D (1-3-5), strings 3-2-1 frets 12-12-10.", visualAid: triadAid("g-major-root-321", [[3, 12], [4, 12], [5, 10]]) }),
                stage("1st inversion", { notes: "B-D-G (3-5-1), strings 3-2-1 frets 4-3-3; the third is the bass.", visualAid: triadAid("g-major-first-321", [[3, 4], [4, 3], [5, 3]]) }),
                stage("2nd inversion", { notes: "D-G-B (5-1-3), strings 3-2-1 frets 7-8-7; the fifth is the bass.", visualAid: triadAid("g-major-second-321", [[3, 7], [4, 8], [5, 7]]) })
            ],
            advance: timeAdvance(80)
        })]),
    preset("preset-dynamic-triad-string-sets", "Triad String-Set Ladder", "Triads",
        "The same C major root-position triad, automatically relocated across all four standard-tuning string sets.",
        [makeItem("dynamic-triad-string-sets", {
            type: "chord_changes", label: "Triad String-Set Ladder", durationMinutes: 5, targetBpm: 70,
            metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" },
            notes: "Standard tuning, C major root position (C-E-G) throughout. The string set advances every 75 seconds.",
            chordKey: { key: "C", chordId: "major" }, tuningId: "standard",
            visualAid: triadAid("c-major-root-321", [[3, 5], [4, 5], [5, 3]]),
            stages: [
                stage("Strings 3-2-1", { visualAid: triadAid("c-major-root-321", [[3, 5], [4, 5], [5, 3]]) }),
                stage("Strings 4-3-2", { visualAid: triadAid("c-major-root-432", [[2, 10], [3, 9], [4, 8]]) }),
                stage("Strings 5-4-3", { visualAid: triadAid("c-major-root-543", [[1, 3], [2, 2], [3, 0]]) }),
                stage("Strings 6-5-4", { visualAid: triadAid("c-major-root-654", [[0, 8], [1, 7], [2, 5]]) })
            ],
            advance: timeAdvance(75)
        })]),
    preset("preset-dynamic-subdivision-ladder", "Picking Subdivision Ladder", "Technique",
        "The same A-minor-pentatonic Box 1, one metronome subdivision at a time: eighths, triplets, then sixteenths.",
        [makeItem("dynamic-subdivision-ladder", {
            type: "technique", label: "Picking Subdivision Ladder", durationMinutes: 4, targetBpm: 80,
            metronome: { timeSignatureId: "4-4", subdivisionId: "eighth" },
            notes: "Standard tuning, A minor pentatonic Box 1, constant 80 BPM. Subdivision advances every 80 seconds: eighths → triplets → sixteenths.",
            scaleKey: { key: "A", scaleId: "minor_pentatonic" }, tuningId: "standard",
            visualAid: boxAid(1),
            stages: [
                stage("Eighth notes", { notes: "Two picked notes per click.", metronome: { subdivisionId: "eighth" } }),
                stage("Triplets", { notes: "Three picked notes per click.", metronome: { subdivisionId: "triplet" } }),
                stage("Sixteenth notes", { notes: "Four picked notes per click.", metronome: { subdivisionId: "sixteenth" } })
            ],
            advance: timeAdvance(80)
        })]),
    preset("preset-dynamic-tempo-ladder", "Tempo Ladder — 80 to 100 BPM", "Technique",
        "The same warm-up shape, stepping the metronome from 80 to 100 BPM in five 60-second stages.",
        [makeItem("dynamic-tempo-ladder", {
            type: "technique", label: "Tempo Ladder — 80 to 100 BPM", durationMinutes: 5, targetBpm: 80,
            metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" },
            notes: "Standard tuning, A minor pentatonic Box 1. BPM steps up every 60 seconds: 80 → 85 → 90 → 95 → 100.",
            scaleKey: { key: "A", scaleId: "minor_pentatonic" }, tuningId: "standard",
            visualAid: boxAid(1),
            stages: [80, 85, 90, 95, 100].map(function (bpm) { return stage(bpm + " BPM", { targetBpm: bpm }) }),
            advance: timeAdvance(60)
        })]),

    // ------------------------------------------------------ Dynamic Hybrid Picking (v0.4)
    // Demonstrates the same generic stage engine driving hybrid-picking
    // content, not just scales/triads - required groundwork for v0.5 Jam
    // Sessions, which will reuse this exact stage/advance shape for chords.
    preset("preset-hybrid-dynamic-triad-cycle", "Hybrid Picking — Triad Cycle", "Technique",
        "Root, 1st and 2nd inversion of a G major triad, each played as a pick-middle-ring hybrid roll, advancing automatically.",
        [makeItem("hybrid-dynamic-triad-cycle", {
            type: "technique", label: "Hybrid Picking — Triad Cycle", durationMinutes: 4, targetBpm: 70,
            metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" },
            notes: "Standard tuning, G major, strings 3-2-1. P = string 3, M = string 2, R = string 1 throughout; the inversion advances every 80 seconds.",
            chordKey: { key: "G", chordId: "major" }, tuningId: "standard",
            visualAid: pathAid("hybrid-triad-cycle-root", [[3, 12], [4, 12], [5, 10]], ["P", "M", "R"], "PICKING_PATTERN"),
            stages: [
                stage("Root position", { notes: "G-B-D, frets 12-12-10.", visualAid: pathAid("hybrid-triad-cycle-root", [[3, 12], [4, 12], [5, 10]], ["P", "M", "R"], "PICKING_PATTERN") }),
                stage("1st inversion", { notes: "B-D-G, frets 4-3-3.", visualAid: pathAid("hybrid-triad-cycle-first", [[3, 4], [4, 3], [5, 3]], ["P", "M", "R"], "PICKING_PATTERN") }),
                stage("2nd inversion", { notes: "D-G-B, frets 7-8-7.", visualAid: pathAid("hybrid-triad-cycle-second", [[3, 7], [4, 8], [5, 7]], ["P", "M", "R"], "PICKING_PATTERN") })
            ],
            advance: timeAdvance(80)
        })]),
    preset("preset-hybrid-dynamic-pentatonic", "Hybrid Picking — Pentatonic Positions", "Technique",
        "All five A-minor-pentatonic boxes, each hybrid-picked with the pick on strings 6-4 and the middle finger on strings 3-1.",
        [makeItem("hybrid-dynamic-pentatonic", {
            type: "technique", label: "Hybrid Picking — Pentatonic Positions", durationMinutes: 10, targetBpm: 85,
            metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" },
            notes: "Standard tuning, A minor pentatonic. P plays strings 6-5-4, M plays strings 3-2-1, both ascending through the active box. Box advances every 2 minutes.",
            scaleKey: { key: "A", scaleId: "minor_pentatonic" }, tuningId: "standard",
            visualAid: pathAid("hybrid-pentatonic-box1", [[0,5],[0,8],[1,5],[1,7],[2,5],[2,7],[3,5],[3,7],[4,5],[4,8],[5,5],[5,8]],
                ["P","P","P","P","P","P","M","M","M","M","M","M"], "PICKING_PATTERN"),
            stages: [
                stage("Box 1", { visualAid: pathAid("hybrid-pentatonic-box1", [[0,5],[0,8],[1,5],[1,7],[2,5],[2,7],[3,5],[3,7],[4,5],[4,8],[5,5],[5,8]], ["P","P","P","P","P","P","M","M","M","M","M","M"], "PICKING_PATTERN") }),
                stage("Box 2", { visualAid: pathAid("hybrid-pentatonic-box2", [[0,8],[0,10],[1,7],[1,10],[2,7],[2,10],[3,7],[3,9],[4,8],[4,10],[5,8],[5,10]], ["P","P","P","P","P","P","M","M","M","M","M","M"], "PICKING_PATTERN") }),
                stage("Box 3", { visualAid: pathAid("hybrid-pentatonic-box3", [[0,10],[0,12],[1,10],[1,12],[2,10],[2,12],[3,9],[3,12],[4,10],[4,13],[5,10],[5,12]], ["P","P","P","P","P","P","M","M","M","M","M","M"], "PICKING_PATTERN") }),
                stage("Box 4", { visualAid: pathAid("hybrid-pentatonic-box4", [[0,12],[0,15],[1,12],[1,15],[2,12],[2,14],[3,12],[3,14],[4,13],[4,15],[5,12],[5,15]], ["P","P","P","P","P","P","M","M","M","M","M","M"], "PICKING_PATTERN") }),
                stage("Box 5", { visualAid: pathAid("hybrid-pentatonic-box5", [[0,3],[0,5],[1,3],[1,5],[2,2],[2,5],[3,2],[3,5],[4,3],[4,5],[5,3],[5,5]], ["P","P","P","P","P","P","M","M","M","M","M","M"], "PICKING_PATTERN") })
            ],
            advance: timeAdvance(120)
        })]),
    preset("preset-hybrid-dynamic-string-sets", "Hybrid Picking — String Sets", "Technique",
        "A C major triad hybrid-picked (P-M-R) as it automatically moves across all four standard-tuning string sets.",
        [makeItem("hybrid-dynamic-string-sets", {
            type: "technique", label: "Hybrid Picking — String Sets", durationMinutes: 5, targetBpm: 70,
            metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" },
            notes: "Standard tuning, C major root position. P always takes the lowest string of the active set, M the middle, R the highest; the set advances every 75 seconds.",
            chordKey: { key: "C", chordId: "major" }, tuningId: "standard",
            visualAid: pathAid("hybrid-string-set-321", [[3, 5], [4, 5], [5, 3]], ["P", "M", "R"], "PICKING_PATTERN"),
            stages: [
                stage("Strings 3-2-1", { visualAid: pathAid("hybrid-string-set-321", [[3, 5], [4, 5], [5, 3]], ["P", "M", "R"], "PICKING_PATTERN") }),
                stage("Strings 4-3-2", { visualAid: pathAid("hybrid-string-set-432", [[2, 10], [3, 9], [4, 8]], ["P", "M", "R"], "PICKING_PATTERN") }),
                stage("Strings 5-4-3", { visualAid: pathAid("hybrid-string-set-543", [[1, 3], [2, 2], [3, 0]], ["P", "M", "R"], "PICKING_PATTERN") }),
                stage("Strings 6-5-4", { visualAid: pathAid("hybrid-string-set-654", [[0, 8], [1, 7], [2, 5]], ["P", "M", "R"], "PICKING_PATTERN") })
            ],
            advance: timeAdvance(75)
        })])
]

// ============================================================ v0.5 configurable routine templates
//
// A template is a *parameterized* built-in routine: instead of one preset
// per key/box combination (v0.3.x/v0.4's "Minor Pentatonic - Box 1"), the
// user picks key/position/tempo/duration/metronome/dynamic at selection
// time and the template resolves to an ordinary routine item - the exact
// same shape js/routines.js's createItem already produces, so it runs
// through the existing routine player (Service.qml's activeRoutine/
// activeRun/activeItem, including the v0.4 stage engine when dynamic) with
// no changes needed there. Templates never replace or mutate the existing
// PRESET_ROUTINES bank; both remain selectable.
//
// Position choices are limited to shapes this file already has verified,
// root-transposable coordinate data for (boxAid's PENTATONIC_BOX mode).
// Scales without an audited, transposable box shape (major pentatonic,
// blues, the diatonic modes) offer only "all" (full-fretboard membership,
// already tuning/key-generic via VisualShapes.FULL_FRETBOARD_SCALE) rather
// than a fabricated position.

var SCALE_TEMPLATES = [
    { id: "template-minor-pentatonic", name: "Minor Pentatonic", category: "Scales", scaleId: "minor_pentatonic",
        positions: ["all", "box1", "box2", "box3", "box4", "box5"], defaultKey: "A",
        description: "The five-note minor pentatonic in any key, full fretboard or one of five verified boxes." },
    { id: "template-major-pentatonic", name: "Major Pentatonic", category: "Scales", scaleId: "major_pentatonic",
        positions: ["all"], defaultKey: "G",
        description: "The five-note major pentatonic in any key across the full fretboard." },
    { id: "template-blues-scale", name: "Blues Scale", category: "Scales", scaleId: "blues",
        positions: ["all"], defaultKey: "A",
        description: "Minor pentatonic plus the b5 blue note, in any key across the full fretboard." },
    { id: "template-major-scale", name: "Major Scale", category: "Scales", scaleId: "major",
        positions: ["all"], defaultKey: "C",
        description: "The major (Ionian) scale in any key across the full fretboard." },
    { id: "template-natural-minor", name: "Natural Minor", category: "Scales", scaleId: "natural_minor",
        positions: ["all"], defaultKey: "A",
        description: "The natural minor (Aeolian) scale in any key across the full fretboard." },
    { id: "template-dorian", name: "Dorian Mode", category: "Scales", scaleId: "dorian",
        positions: ["all"], defaultKey: "D",
        description: "The Dorian mode (minor with a raised 6th) in any key across the full fretboard." },
    { id: "template-mixolydian", name: "Mixolydian Mode", category: "Scales", scaleId: "mixolydian",
        positions: ["all"], defaultKey: "G",
        description: "The Mixolydian mode (major with a flat 7th) in any key across the full fretboard." }
]

function scaleTemplateById(id) {
    for (var i = 0; i < SCALE_TEMPLATES.length; i++) if (SCALE_TEMPLATES[i].id === id) return SCALE_TEMPLATES[i]
    return null
}

function finiteOr(value, fallback) {
    var n = Number(value)
    return isFinite(n) ? n : fallback
}

// `boxAid`/`positionAid`'s existing helpers already carry the audited
// coordinate data (pentatonic boxes) or the FULL_FRETBOARD_SCALE contract
// (everything else) - a template only ever selects between those, it never
// invents new coordinates.
function scaleTemplateVisualAid(template, position) {
    if (template.positions.indexOf("box1") >= 0 && /^box[1-5]$/.test(position))
        return boxAid(Number(position.slice(3)))
    return { mode: "FULL_FRETBOARD_SCALE" }
}

function scaleTemplateLabel(template, key, position) {
    if (position === "all" || template.positions.indexOf("box1") < 0) return key + " " + template.name
    return key + " " + template.name + " — Box " + position.slice(3)
}

// config: { key, position ("all"|"boxN"), targetBpm, durationMinutes,
// metronomeEnabled, dynamic, dynamicEverySeconds }. Returns a plain
// (possibly dynamic/staged) createItem-shaped item; never persisted itself -
// the caller wraps it in a throwaway single-item routine to run it.
function resolveScaleTemplate(templateId, config) {
    var template = scaleTemplateById(templateId)
    if (!template) return null
    var c = config || {}
    var key = c.key || template.defaultKey
    var position = c.position || "all"
    var targetBpm = finiteOr(c.targetBpm, 90)
    var durationMinutes = finiteOr(c.durationMinutes, 6)
    var metronomeEnabled = c.metronomeEnabled !== false
    var canCycle = template.positions.length > 1
    var dynamic = !!c.dynamic && canCycle
    var everySeconds = Math.max(15, finiteOr(c.dynamicEverySeconds, 90))

    var base = {
        type: "scales",
        label: scaleTemplateLabel(template, key, dynamic ? "all" : position),
        durationMinutes: durationMinutes,
        targetBpm: metronomeEnabled ? targetBpm : null,
        metronome: metronomeEnabled ? { timeSignatureId: "4-4", subdivisionId: "quarter" } : null,
        notes: template.description,
        scaleKey: { key: key, scaleId: template.scaleId },
        tuningId: "standard",
        visualAid: scaleTemplateVisualAid(template, dynamic ? "box1" : position)
    }

    if (dynamic) {
        base.stages = [1, 2, 3, 4, 5].map(function (box) {
            return stage(key + " " + template.name + " — Box " + box, { visualAid: boxAid(box) })
        })
        base.advance = timeAdvance(everySeconds)
        base.durationMinutes = finiteOr(c.durationMinutes, base.stages.length * everySeconds / 60)
    }

    return makeItem("template-" + template.scaleId, base)
}

// ------------------------------------------------------------ configurable hybrid-picking templates
//
// Same principle applied to the v0.4 hybrid-picking pentatonic-position
// content: one configurable template instead of five near-identical boxed
// presets. Triad-based hybrid configuration (root/quality/inversion/string
// set) needs js/visual_shapes.js's triadShapes(), which this file cannot
// import (see the file header) - that resolution lives in Service.qml,
// which already imports both Presets and VisualShapes; TRIAD_QUALITIES/
// TRIAD_STRING_SET_IDS below are shared, testable descriptor lists only.

var HYBRID_PENTATONIC_TEMPLATE = {
    id: "template-hybrid-pentatonic", name: "Hybrid Picking — Pentatonic Position", category: "Technique",
    scaleId: "minor_pentatonic", defaultKey: "A",
    description: "Pick handles strings 6-5-4, middle finger handles strings 3-2-1, ascending through the chosen A-minor-pentatonic-shape box."
}

function resolveHybridPentatonicTemplate(config) {
    var c = config || {}
    var key = c.key || HYBRID_PENTATONIC_TEMPLATE.defaultKey
    var targetBpm = finiteOr(c.targetBpm, 85)
    var durationMinutes = finiteOr(c.durationMinutes, 6)
    var dynamic = !!c.dynamic
    var everySeconds = Math.max(15, finiteOr(c.dynamicEverySeconds, 90))
    var box = /^box[1-5]$/.test(c.position) ? Number(c.position.slice(3)) : 1

    function pmAid(n) {
        var positions = MINOR_PENTATONIC_BOX_POSITIONS_FOR_HYBRID(n)
        return pathAid("hybrid-template-box" + n, positions,
            ["P", "P", "P", "P", "P", "P", "M", "M", "M", "M", "M", "M"], "PICKING_PATTERN")
    }

    var base = {
        type: "technique",
        label: key + " Hybrid Picking — Box " + box,
        durationMinutes: durationMinutes,
        targetBpm: targetBpm,
        metronome: { timeSignatureId: "4-4", subdivisionId: "quarter" },
        notes: HYBRID_PENTATONIC_TEMPLATE.description,
        scaleKey: { key: key, scaleId: "minor_pentatonic" },
        tuningId: "standard",
        visualAid: pmAid(dynamic ? 1 : box)
    }

    if (dynamic) {
        base.stages = [1, 2, 3, 4, 5].map(function (n) {
            return stage(key + " Box " + n, { visualAid: pmAid(n) })
        })
        base.advance = timeAdvance(everySeconds)
        base.durationMinutes = finiteOr(c.durationMinutes, base.stages.length * everySeconds / 60)
    }

    return makeItem("template-hybrid-pentatonic", base)
}

// Root-relative (A) minor-pentatonic-box coordinates, low-to-high string
// order, reused directly from this file's own boxAid-adjacent source data
// rather than re-deriving anything - see js/visual_shapes.js's
// MINOR_PENTATONIC_BOXES, which these match exactly for root A (pitch
// class 9) and were cross-checked against it in tests/dynamic_routines.test.mjs.
var HYBRID_BOX_POSITIONS = {
    1: [[0,5],[0,8],[1,5],[1,7],[2,5],[2,7],[3,5],[3,7],[4,5],[4,8],[5,5],[5,8]],
    2: [[0,8],[0,10],[1,7],[1,10],[2,7],[2,10],[3,7],[3,9],[4,8],[4,10],[5,8],[5,10]],
    3: [[0,10],[0,12],[1,10],[1,12],[2,10],[2,12],[3,9],[3,12],[4,10],[4,13],[5,10],[5,12]],
    4: [[0,12],[0,15],[1,12],[1,15],[2,12],[2,14],[3,12],[3,14],[4,13],[4,15],[5,12],[5,15]],
    5: [[0,3],[0,5],[1,3],[1,5],[2,2],[2,5],[3,2],[3,5],[4,3],[4,5],[5,3],[5,5]]
}
function MINOR_PENTATONIC_BOX_POSITIONS_FOR_HYBRID(box) { return HYBRID_BOX_POSITIONS[box] || HYBRID_BOX_POSITIONS[1] }

// ------------------------------------------------------------ configurable triad templates (descriptors)
//
// Root/quality/inversion/string-set enumeration shared by Service.qml's
// triad-template resolver (needs VisualShapes.triadShapes for coordinates)
// and the hybrid-triad resolver. Kept here as plain, independently testable
// data/label lookups so the UI and Service.qml agree on valid option ids.

var TRIAD_ROOTS = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"]
var TRIAD_QUALITIES = ["major", "minor", "diminished", "augmented"]
var TRIAD_INVERSION_IDS = ["all", "root", "first", "second"]
var TRIAD_STRING_SET_IDS = ["all", "123", "234", "345", "456"]

function triadInversionLabel(id) {
    return { all: "All", root: "Root position", first: "1st inversion", second: "2nd inversion" }[id] || id
}
function triadStringSetLabel(id) {
    return id === "all" ? "All" : "Strings " + id.split("").reverse().join("-")
}

function presetById(id) {
    for (var i = 0; i < PRESET_ROUTINES.length; i++) if (PRESET_ROUTINES[i].id === id) return PRESET_ROUTINES[i]
    return null
}

function presetsByCategory(category) {
    return PRESET_ROUTINES.filter(function (p) { return p.category === category })
}
