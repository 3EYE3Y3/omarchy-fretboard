import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Theory = loadQmlJs(new URL("../js/theory.js", import.meta.url))
const Fretboard = loadQmlJs(new URL("../js/fretboard.js", import.meta.url))
const Visual = loadQmlJs(new URL("../js/visual_shapes.js", import.meta.url))
const Voicings = loadQmlJs(new URL("../js/chord_voicings.js", import.meta.url))
const Presets = loadQmlJs(new URL("../js/presets.js", import.meta.url))

const STANDARD = ["E2", "A2", "D3", "G3", "B3", "E4"]
const tuples = (value) => Array.from(value, (p) => Array.from(p))
const fretsWhere = (row, predicate) => Array.from(row).filter(predicate).map((cell) => cell.fret)
const plainWindow = (window) => ({ startFret: window.startFret, endFret: window.endFret })

const A_MINOR_BOXES = {
  1: [[0,5],[0,8],[1,5],[1,7],[2,5],[2,7],[3,5],[3,7],[4,5],[4,8],[5,5],[5,8]],
  2: [[0,8],[0,10],[1,7],[1,10],[2,7],[2,10],[3,7],[3,9],[4,8],[4,10],[5,8],[5,10]],
  3: [[0,10],[0,12],[1,10],[1,12],[2,10],[2,12],[3,9],[3,12],[4,10],[4,13],[5,10],[5,12]],
  4: [[0,12],[0,15],[1,12],[1,15],[2,12],[2,14],[3,12],[3,14],[4,13],[4,15],[5,12],[5,15]],
  5: [[0,3],[0,5],[1,3],[1,5],[2,2],[2,5],[3,2],[3,5],[4,3],[4,5],[5,3],[5,5]]
}

const A_MINOR_BOX_ROOTS = {
  1: [[0,5],[2,7],[5,5]],
  2: [[2,7],[4,10]],
  3: [[1,12],[4,10]],
  4: [[1,12],[3,14]],
  5: [[0,5],[3,2],[5,5]]
}

// Independent open-to-12th-fret fixtures. Rows are ordered low E, A, D, G,
// B, high E and list every fret that belongs to the named scale.
const FULL_SCALE_FIXTURES = [
  {
    label: "A minor pentatonic", root: "A", scaleId: "minor_pentatonic",
    frets: [[0,3,5,8,10,12],[0,3,5,7,10,12],[0,2,5,7,10,12],[0,2,5,7,9,12],[1,3,5,8,10],[0,3,5,8,10,12]],
    roots: [[5],[0,12],[7],[2],[10],[5]], openStrings: [0,1,2,3,5]
  },
  {
    label: "C major", root: "C", scaleId: "major",
    frets: [[0,1,3,5,7,8,10,12],[0,2,3,5,7,8,10,12],[0,2,3,5,7,9,10,12],[0,2,4,5,7,9,10,12],[0,1,3,5,6,8,10,12],[0,1,3,5,7,8,10,12]],
    roots: [[8],[3],[10],[5],[1],[8]], openStrings: [0,1,2,3,4,5]
  },
  {
    label: "G major", root: "G", scaleId: "major",
    frets: [[0,2,3,5,7,8,10,12],[0,2,3,5,7,9,10,12],[0,2,4,5,7,9,10,12],[0,2,4,5,7,9,11,12],[0,1,3,5,7,8,10,12],[0,2,3,5,7,8,10,12]],
    roots: [[3],[10],[5],[0,12],[8],[3]], openStrings: [0,1,2,3,4,5]
  },
  {
    label: "A natural minor", root: "A", scaleId: "natural_minor",
    frets: [[0,1,3,5,7,8,10,12],[0,2,3,5,7,8,10,12],[0,2,3,5,7,9,10,12],[0,2,4,5,7,9,10,12],[0,1,3,5,6,8,10,12],[0,1,3,5,7,8,10,12]],
    roots: [[5],[0,12],[7],[2],[10],[5]], openStrings: [0,1,2,3,4,5]
  },
  {
    label: "D Dorian", root: "D", scaleId: "dorian",
    frets: [[0,1,3,5,7,8,10,12],[0,2,3,5,7,8,10,12],[0,2,3,5,7,9,10,12],[0,2,4,5,7,9,10,12],[0,1,3,5,6,8,10,12],[0,1,3,5,7,8,10,12]],
    roots: [[10],[5],[0,12],[7],[3],[10]], openStrings: [0,1,2,3,4,5]
  }
]

test("canonical A minor pentatonic Boxes 1-5 have exact string/fret coordinates", () => {
  for (let box = 1; box <= 5; box++) {
    const actual = Visual.positionsFor({ mode: Visual.PENTATONIC_BOX, box }, 9)
    assert.deepEqual(tuples(actual), A_MINOR_BOXES[box], `A minor box ${box}`)
  }
})

test("E minor pentatonic Box 1 transposes to open position exactly", () => {
  const expected = [[0,0],[0,3],[1,0],[1,2],[2,0],[2,2],[3,0],[3,2],[4,0],[4,3],[5,0],[5,3]]
  assert.deepEqual(tuples(Visual.positionsFor({ mode: Visual.PENTATONIC_BOX, box: 1 }, 4)), expected)
})

test("every pentatonic-box coordinate is a member and roots are exact", () => {
  const board = Fretboard.buildFretboard(STANDARD, 24)
  const toneSet = Theory.pitchClassSet(Theory.buildScale("A", "minor_pentatonic").notes)
  for (let box = 1; box <= 5; box++) {
    const coords = Visual.positionsFor({ mode: Visual.PENTATONIC_BOX, box }, 9)
    for (const [s, fret] of coords) assert.equal(toneSet[board.strings[s][fret].pitchClass], true, `box ${box} S${6-s}f${fret}`)
    const roots = coords.filter(([s, fret]) => board.strings[s][fret].pitchClass === 9)
    assert.deepEqual(tuples(roots), A_MINOR_BOX_ROOTS[box], `A root coordinates in box ${box}`)
  }
})

test("root highlighting marks only the literal roots within an exact shape", () => {
  const board = Fretboard.buildFretboard(STANDARD, 24)
  const coords = Visual.positionsFor({ mode: Visual.PENTATONIC_BOX, box: 1 }, 9)
  const highlighted = Visual.highlightPositions(board, coords, 9)
  const roots = []
  for (let s = 0; s < highlighted.strings.length; s++)
    for (const cell of highlighted.strings[s]) if (cell.isRoot) roots.push([s, cell.fret])
  assert.deepEqual(roots, A_MINOR_BOX_ROOTS[1])
})

test("general scale references map every matching tone on all six strings from frets 0-12", () => {
  for (const fixture of FULL_SCALE_FIXTURES) {
    const scale = Theory.buildScale(fixture.root, fixture.scaleId)
    const toneSet = Theory.pitchClassSet(scale.notes)
    const board = Fretboard.highlightFretboard(Fretboard.buildFretboard(STANDARD, 12), toneSet, scale.rootPitchClass)
    assert.equal(board.strings.length, 6, `${fixture.label}: six strings`)

    const actualFrets = []
    const actualRoots = []
    const actualOpenStrings = []
    const intervalsByPitch = Object.fromEntries(Array.from(scale.notes, (note) => [note.pitchClass, note.interval]))
    for (let s = 0; s < 6; s++) {
      assert.equal(board.strings[s].length, 13, `${fixture.label}: string ${s} covers 0-12`)
      actualFrets.push(fretsWhere(board.strings[s], (cell) => cell.highlighted))
      actualRoots.push(fretsWhere(board.strings[s], (cell) => cell.isRoot))
      if (board.strings[s][0].highlighted) actualOpenStrings.push(s)
      for (const cell of board.strings[s]) {
        assert.equal(cell.highlighted, !!toneSet[cell.pitchClass], `${fixture.label}: string ${s} fret ${cell.fret}`)
        if (cell.highlighted) assert.ok(intervalsByPitch[cell.pitchClass], `${fixture.label}: interval label at string ${s} fret ${cell.fret}`)
      }
    }
    assert.deepEqual(actualFrets, fixture.frets, `${fixture.label}: complete membership coordinates`)
    assert.deepEqual(actualRoots, fixture.roots, `${fixture.label}: root coordinates`)
    assert.deepEqual(actualOpenStrings, fixture.openStrings, `${fixture.label}: open strings`)
  }
})

test("full-scale and named-position windows remain distinct", () => {
  assert.deepEqual(plainWindow(Visual.fullFretboardWindow()), { startFret: 0, endFret: 12 })
  assert.deepEqual(plainWindow(Visual.fretWindow({ mode: Visual.FULL_FRETBOARD_SCALE }, 9)), { startFret: 0, endFret: 12 })
  assert.deepEqual(plainWindow(Visual.fretWindow({ mode: Visual.PENTATONIC_BOX, box: 1 }, 9)), { startFret: 5, endFret: 8 })
  assert.deepEqual(plainWindow(Visual.fretWindow({ mode: Visual.THREE_NOTES_PER_STRING }, 4)), { startFret: 12, endFret: 17 })
})

test("alternate tunings recalculate a full-scale map from each actual open pitch", () => {
  const dropD = ["D2", "A2", "D3", "G3", "B3", "E4"]
  const scale = Theory.buildScale("A", "minor_pentatonic")
  const board = Fretboard.highlightFretboard(Fretboard.buildFretboard(dropD, 12), Theory.pitchClassSet(scale.notes), scale.rootPitchClass)
  assert.deepEqual(fretsWhere(board.strings[0], (cell) => cell.highlighted), [0,2,5,7,10,12])
  assert.deepEqual(fretsWhere(board.strings[0], (cell) => cell.isRoot), [7])
  assert.equal(board.strings[0][0].name, "D")
  assert.equal(board.strings[0][0].highlighted, true)
  assert.equal(board.strings[5][0].name, "E")
  assert.equal(board.strings[5][0].highlighted, true)
})

test("all exposed scale and mode formulas have canonical semitone content in all 12 roots", () => {
  const canonical = {
    major: ["1 2 3 4 5 6 7", [0,2,4,5,7,9,11]],
    natural_minor: ["1 2 b3 4 5 b6 b7", [0,2,3,5,7,8,10]],
    major_pentatonic: ["1 2 3 5 6", [0,2,4,7,9]],
    minor_pentatonic: ["1 b3 4 5 b7", [0,3,5,7,10]],
    blues: ["1 b3 4 b5 5 b7", [0,3,5,6,7,10]],
    harmonic_minor: ["1 2 b3 4 5 b6 7", [0,2,3,5,7,8,11]],
    melodic_minor: ["1 2 b3 4 5 6 7", [0,2,3,5,7,9,11]],
    ionian: ["1 2 3 4 5 6 7", [0,2,4,5,7,9,11]],
    dorian: ["1 2 b3 4 5 6 b7", [0,2,3,5,7,9,10]],
    phrygian: ["1 b2 b3 4 5 b6 b7", [0,1,3,5,7,8,10]],
    lydian: ["1 2 3 #4 5 6 7", [0,2,4,6,7,9,11]],
    mixolydian: ["1 2 3 4 5 6 b7", [0,2,4,5,7,9,10]],
    aeolian: ["1 2 b3 4 5 b6 b7", [0,2,3,5,7,8,10]],
    locrian: ["1 b2 b3 4 b5 b6 b7", [0,1,3,5,6,8,10]]
  }
  const roots = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"]
  const letters = ["C","D","E","F","G","A","B"]
  for (const [id, [formula, intervals]] of Object.entries(canonical)) {
    const definition = Array.from(Theory.SCALES).find((scale) => scale.id === id)
    assert.equal(definition.formula, formula, `${id} formula`)
    assert.deepEqual(Array.from(definition.intervals), intervals, `${id} intervals`)
    for (const root of roots) {
      const scale = Theory.buildScale(root, id)
      assert.deepEqual(Array.from(scale.notes, (note) => (note.pitchClass - scale.rootPitchClass + 12) % 12), intervals, `${root} ${id}`)
      assert.equal(scale.notes[0].name, root)
      const rootLetter = letters.indexOf(root[0])
      const degreeTokens = formula.split(" ")
      for (let i = 0; i < scale.notes.length; i++) {
        const degree = Number(degreeTokens[i].replace(/[^0-9]/g, ""))
        const expectedLetter = letters[(rootLetter + (degree - 1) % 7) % 7]
        assert.equal(scale.notes[i].name[0], expectedLetter, `${root} ${id} degree ${degree} spelling`)
      }
    }
  }
})

test("all exposed chord formulas have canonical semitone content", () => {
  const canonical = {
    major: ["1 3 5", [0,4,7]], minor: ["1 b3 5", [0,3,7]],
    dominant7: ["1 3 5 b7", [0,4,7,10]], major7: ["1 3 5 7", [0,4,7,11]],
    minor7: ["1 b3 5 b7", [0,3,7,10]], sus2: ["1 2 5", [0,2,7]],
    sus4: ["1 4 5", [0,5,7]], diminished: ["1 b3 b5", [0,3,6]],
    augmented: ["1 3 #5", [0,4,8]], add9: ["1 3 5 9", [0,4,7,2]], power: ["1 5", [0,7]]
  }
  for (const chord of Theory.CHORDS) {
    assert.equal(chord.formula, canonical[chord.id][0], chord.id)
    assert.deepEqual(Array.from(chord.intervals), canonical[chord.id][1], chord.id)
    for (const root of ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"]) {
      const built = Theory.buildChord(root, chord.id)
      assert.equal(built.name, root + chord.symbol, `${root} ${chord.id} name`)
      assert.deepEqual(Array.from(built.notes, (note) => (note.pitchClass - built.rootPitchClass + 12) % 12), canonical[chord.id][1], `${root} ${chord.id}`)
    }
  }
})

test("canonical scale fixtures preserve formulas and practical spellings", () => {
  const cases = [
    ["C", "major", ["C","D","E","F","G","A","B"]],
    ["G", "major", ["G","A","B","C","D","E","F#"]],
    ["A", "natural_minor", ["A","B","C","D","E","F","G"]],
    ["A", "harmonic_minor", ["A","B","C","D","E","F","G#"]],
    ["A", "melodic_minor", ["A","B","C","D","E","F#","G#"]]
  ]
  for (const [root, id, expected] of cases)
    assert.deepEqual(Array.from(Theory.buildScale(root, id).notes, (n) => n.name), expected, `${root} ${id}`)
})

test("all 12 conventional major keys have independently fixed note spellings", () => {
  const expected = {
    C: ["C","D","E","F","G","A","B"], Db: ["Db","Eb","F","Gb","Ab","Bb","C"],
    D: ["D","E","F#","G","A","B","C#"], Eb: ["Eb","F","G","Ab","Bb","C","D"],
    E: ["E","F#","G#","A","B","C#","D#"], F: ["F","G","A","Bb","C","D","E"],
    "F#": ["F#","G#","A#","B","C#","D#","E#"], G: ["G","A","B","C","D","E","F#"],
    Ab: ["Ab","Bb","C","Db","Eb","F","G"], A: ["A","B","C#","D","E","F#","G#"],
    Bb: ["Bb","C","D","Eb","F","G","A"], B: ["B","C#","D#","E","F#","G#","A#"]
  }
  for (const [root, notes] of Object.entries(expected))
    assert.deepEqual(Array.from(Theory.buildScale(root, "major").notes, (n) => n.name), notes, root)
})

test("E major 3NPS fixture has exactly three correct notes per string", () => {
  const expected = [[0,12],[0,14],[0,16],[1,12],[1,14],[1,16],[2,13],[2,14],[2,16],
    [3,13],[3,14],[3,16],[4,14],[4,16],[4,17],[5,14],[5,16],[5,17]]
  const actual = Visual.positionsFor({ mode: Visual.THREE_NOTES_PER_STRING }, 4)
  assert.deepEqual(tuples(actual), expected)
  for (let s = 0; s < 6; s++) assert.equal(actual.filter((p) => p[0] === s).length, 3)
})

test("major and minor triad inversion fixtures contain exact chord tones and bass order", () => {
  const cases = [
    ["G", "major", [[3,12],[4,12],[5,10]], [7,11,2]],
    ["G", "major", [[3,4],[4,3],[5,3]], [11,2,7]],
    ["G", "major", [[3,7],[4,8],[5,7]], [2,7,11]],
    ["G", "minor", [[3,12],[4,11],[5,10]], [7,10,2]],
    ["G", "minor", [[3,3],[4,3],[5,3]], [10,2,7]],
    ["G", "minor", [[3,7],[4,8],[5,6]], [2,7,10]],
    ["C", "diminished", [[3,5],[4,4],[5,2]], [0,3,6]],
    ["C", "augmented", [[3,5],[4,5],[5,4]], [0,4,8]]
  ]
  const board = Fretboard.buildFretboard(STANDARD, 24)
  for (const [root, quality, coords, orderedPcs] of cases) {
    const pcs = coords.map(([s,f]) => board.strings[s][f].pitchClass)
    assert.deepEqual(pcs, orderedPcs, `${root} ${quality}`)
    const set = Theory.pitchClassSet(Theory.buildChord(root, quality).notes)
    for (const pc of pcs) assert.equal(set[pc], true)
  }
})

test("common open, barre, seventh, sus and power chords use exact playable fixtures", () => {
  const exact = [
    ["E","major",[0,2,2,1,0,0]], ["A","major",[-1,0,2,2,2,0]],
    ["C","major",[-1,3,2,0,1,0]], ["E","minor",[0,2,2,0,0,0]],
    ["A","minor",[-1,0,2,2,1,0]], ["F","major",[1,3,3,2,1,1]],
    ["B","minor",[-1,2,4,4,3,2]], ["A","dominant7",[-1,0,2,0,2,0]],
    ["D","sus4",[-1,5,7,7,8,5]], ["E","power",[0,2,2,-1,-1,-1]]
  ]
  for (const [root, id, frets] of exact) {
    const chord = Theory.buildChord(root, id)
    const voicing = Voicings.voicingFromFrets(STANDARD, frets, Theory.pitchClassSet(chord.notes), chord.rootPitchClass, "fixture", "fixture")
    assert.ok(voicing, `${root} ${id}`)
    assert.deepEqual(Array.from(voicing.strings, (s) => s.fret), frets)
  }
})

test("standard-tuning shapes are suppressed in incompatible tunings", () => {
  const chord = Theory.buildChord("E", "major")
  assert.equal(Voicings.findVoicings(["D2","A2","D3","G3","B3","E4"], Theory.pitchClassSet(chord.notes), 4, "major").length, 0)
})

test("every shape/box/position-labelled preset carries explicit positional semantics", () => {
  const positional = /box|position|shape|three notes per string|3nps/i
  for (const preset of Presets.PRESET_ROUTINES) for (const item of preset.items) {
    if (!positional.test(`${preset.name} ${item.label}`)) continue
    assert.ok(item.visualAid, `${preset.id} missing visualAid`)
    assert.notEqual(item.visualAid.mode, Visual.FULL_FRETBOARD_SCALE, `${preset.id} mislabeled generic membership`)
  }
})

test("built-in presets that claim a general scale map use full-fretboard semantics", () => {
  const expected = [
    "G Major Pentatonic — Full Fretboard",
    "D Dorian",
    "D Phrygian",
    "D Lydian",
    "D Mixolydian"
  ]
  const actual = []
  for (const preset of Presets.PRESET_ROUTINES) for (const item of preset.items) {
    if (!item.scaleKey || !item.visualAid || item.visualAid.mode !== Visual.FULL_FRETBOARD_SCALE) continue
    actual.push(item.label)
  }
  assert.deepEqual(actual, expected)
})

test("all explicit preset coordinates belong to their advertised scale or chord", () => {
  const board = Fretboard.buildFretboard(STANDARD, 24)
  for (const preset of Presets.PRESET_ROUTINES) for (const item of preset.items) {
    if (!item.visualAid || !item.visualAid.positions) continue
    if (!item.scaleKey && !item.chordKey) continue // technique paths are coordinate claims, not pitch-set claims
    const tones = item.scaleKey ? Theory.buildScale(item.scaleKey.key, item.scaleKey.scaleId) : Theory.buildChord(item.chordKey.key, item.chordKey.chordId)
    const set = Theory.pitchClassSet(tones.notes)
    for (const [s,f] of item.visualAid.positions)
      assert.equal(set[board.strings[s][f].pitchClass], true, `${preset.id} S${6-s}f${f}`)
  }
})

test("every exact preset chord diagram is complete, tone-correct and playable", () => {
  for (const preset of Presets.PRESET_ROUTINES) for (const item of preset.items) {
    if (!item.chordKey || !item.visualAid || item.visualAid.mode !== Visual.CHORD_SHAPE || !item.visualAid.frets) continue
    const chord = Theory.buildChord(item.chordKey.key, item.chordKey.chordId)
    const voicing = Voicings.voicingFromFrets(STANDARD, item.visualAid.frets, Theory.pitchClassSet(chord.notes), chord.rootPitchClass, item.label, "fixture")
    assert.ok(voicing, `${preset.id}: ${item.label}`)
    assert.ok(voicing.span <= 4, `${preset.id}: hand span ${voicing.span}`)
  }
})

test("all 11 chord families produce audited shapes in every chromatic root", () => {
  for (const chordType of Theory.CHORDS) for (const root of ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]) {
    const chord = Theory.buildChord(root, chordType.id)
    const voicings = Voicings.findVoicings(STANDARD, Theory.pitchClassSet(chord.notes), chord.rootPitchClass, chordType.id)
    assert.ok(voicings.length > 0, `${root} ${chordType.id}`)
    for (const voicing of voicings) assert.ok(voicing.span <= 4, `${root} ${chordType.id} span`)
  }
})
