.pragma library

// A deliberately small starter library, not a database - each entry is
// just enough to seed a routine block or run standalone. Architecture
// (routines/exerciseProgress keyed by id) allows more to be added later
// without a shape change.
var BUILTIN_EXERCISES = [
    {
        id: "builtin-chromatic-1234", name: "Chromatic 1-2-3-4", type: "technique",
        description: "One finger per fret, ascending and descending, on each string.",
        startBpm: 60, targetBpm: 100
    },
    {
        id: "builtin-alternate-picking", name: "Alternate Picking", type: "technique",
        description: "Strict down-up picking on a single note, then a scale, focusing on evenness.",
        startBpm: 70, targetBpm: 140
    },
    {
        id: "builtin-spider", name: "Spider Exercise", type: "technique",
        description: "1-3-2-4 finger pattern walked up each string pair, both directions.",
        startBpm: 60, targetBpm: 110
    },
    {
        id: "builtin-major-scale", name: "Major Scale", type: "scales",
        description: "One octave major scale in position, ascending and descending.",
        scaleId: "major", startBpm: 70, targetBpm: 130
    },
    {
        id: "builtin-minor-pentatonic", name: "Minor Pentatonic", type: "scales",
        description: "Minor pentatonic box shape, ascending and descending, then improvise over it.",
        scaleId: "minor_pentatonic", startBpm: 70, targetBpm: 130
    },
    {
        id: "builtin-chord-change-drill", name: "Chord-Change Drill", type: "chord_changes",
        description: "Metronome-timed switching between two chords, one change per bar.",
        startBpm: 50, targetBpm: 90
    },
    {
        id: "builtin-string-skipping", name: "String Skipping", type: "technique",
        description: "Picking pattern that skips a string each time, aiming for clean muting.",
        startBpm: 60, targetBpm: 120
    },
    {
        id: "builtin-rhythm-subdivision", name: "Rhythm Subdivision", type: "ear_training",
        description: "Strum quarter, then eighth, then triplet, then sixteenth subdivisions to a click.",
        startBpm: 70, targetBpm: 110
    }
]

function builtinExerciseById(id) {
    for (var i = 0; i < BUILTIN_EXERCISES.length; i++)
        if (BUILTIN_EXERCISES[i].id === id) return BUILTIN_EXERCISES[i]
    return null
}
