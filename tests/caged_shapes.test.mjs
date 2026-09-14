import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Caged = loadQmlJs(new URL("../js/caged_shapes.js", import.meta.url))
const Theory = loadQmlJs(new URL("../js/theory.js", import.meta.url))

const STANDARD = ["E2", "A2", "D3", "G3", "B3", "E4"]
const DROP_D = ["D2", "A2", "D3", "G3", "B3", "E4"]
const ALL_ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

// Values crossing the vm sandbox boundary (see load-qml-js.mjs) are arrays
// from a different realm; Array.from() re-materializes them so
// assert.deepEqual can compare structure instead of tripping over realm
// identity, matching the convention already used in canonical_music.test.mjs.
function fretsOf(shape) {
  return Array.from(shape.strings, (s) => s.fret)
}

test("every canonical shape definition passes structural validation", () => {
  assert.deepEqual(Array.from(Caged.validateAllShapes()), [])
})

test("validateShapeDefinition rejects malformed/impossible shapes", () => {
  assert.equal(Caged.validateShapeDefinition([0, 0, 0, 0, 0]), false, "wrong string count")
  assert.equal(Caged.validateShapeDefinition([1, 1, 1, 1, 1, 1]), false, "no open reference string")
  assert.equal(Caged.validateShapeDefinition([-1, -1, -1, -1, 0, 2]), false, "fewer than 3 sounding strings")
  assert.equal(Caged.validateShapeDefinition([0, 1.5, 2, 0, 0, 0]), false, "non-integer fret")
  assert.equal(Caged.validateShapeDefinition([0, 25, 2, 0, 0, 0]), false, "fret out of range")
  assert.equal(Caged.validateShapeDefinition([0, 2, 2, 1, 0, 0]), true, "valid open E shape")
})

// Fret strings independently published by fachords.com's CAGED lesson and
// (E, A) by JustinGuitar's CAGED module; see docs/MUSIC_CONTENT_AUDIT.md.
const PUBLISHED_MAJOR_OPEN_SHAPES = {
  C: { root: "C", frets: [-1, 3, 2, 0, 1, 0] },
  A: { root: "A", frets: [-1, 0, 2, 2, 2, 0] },
  G: { root: "G", frets: [3, 2, 0, 0, 0, 3] },
  E: { root: "E", frets: [0, 2, 2, 1, 0, 0] },
  D: { root: "D", frets: [-1, -1, 0, 2, 3, 2] }
}

test("major CAGED shapes reproduce their own published open-position fingering", () => {
  for (const letter of Object.keys(PUBLISHED_MAJOR_OPEN_SHAPES)) {
    const fixture = PUBLISHED_MAJOR_OPEN_SHAPES[letter]
    const chord = Theory.buildChord(fixture.root, "major")
    const shape = Caged.transposeCagedShape("major", letter, chord.rootPitchClass, STANDARD)
    assert.deepEqual(fretsOf(shape), fixture.frets, `${letter} shape at its native root`)
    assert.equal(shape.anchorFret, 0, `${letter} shape open position has no barre`)
    assert.equal(shape.barre, false)
  }
})

// Cross-checked movable barre positions for well-known major voicings.
const MAJOR_TRANSPOSITIONS = [
  { root: "D", shape: "C", frets: [-1, 5, 4, 2, 3, 2] },
  { root: "D", shape: "A", frets: [-1, 5, 7, 7, 7, 5] },
  { root: "D", shape: "G", frets: [10, 9, 7, 7, 7, 10] },
  { root: "D", shape: "E", frets: [10, 12, 12, 11, 10, 10] },
  { root: "D", shape: "D", frets: [-1, -1, 0, 2, 3, 2] },
  { root: "A", shape: "E", frets: [5, 7, 7, 6, 5, 5] },
  { root: "A", shape: "D", frets: [-1, -1, 7, 9, 10, 9] },
  { root: "C", shape: "A", frets: [-1, 3, 5, 5, 5, 3] },
  { root: "C", shape: "E", frets: [8, 10, 10, 9, 8, 8] },
  { root: "G", shape: "E", frets: [3, 5, 5, 4, 3, 3] },
  { root: "G", shape: "D", frets: [-1, -1, 5, 7, 8, 7] },
  { root: "E", shape: "A", frets: [-1, 7, 9, 9, 9, 7] }
]

test("major CAGED shapes transpose to the correct movable barre position", () => {
  for (const fixture of MAJOR_TRANSPOSITIONS) {
    const chord = Theory.buildChord(fixture.root, "major")
    const shape = Caged.transposeCagedShape("major", fixture.shape, chord.rootPitchClass, STANDARD)
    assert.deepEqual(fretsOf(shape), fixture.frets, `${fixture.root} major, ${fixture.shape} shape`)
  }
})

test("D major E-shape sits at the 10th fret, matching the documented example", () => {
  const chord = Theory.buildChord("D", "major")
  const shape = Caged.transposeCagedShape("major", "E", chord.rootPitchClass, STANDARD)
  assert.equal(shape.startFret, 10)
  assert.equal(shape.anchorFret, 10)
  assert.equal(shape.barre, true)
})

// Published open forms for the non-major shapes added beyond the two
// already-audited E/A fingerings (see docs/MUSIC_CONTENT_AUDIT.md).
const PUBLISHED_D_SHAPE_OPEN_FORMS = {
  minor: [-1, -1, 0, 2, 3, 1],
  dominant7: [-1, -1, 0, 2, 1, 2],
  major7: [-1, -1, 0, 2, 2, 2],
  minor7: [-1, -1, 0, 2, 1, 1]
}

test("D-shape forms reproduce their published open Dx chord at native root D", () => {
  for (const chordId of Object.keys(PUBLISHED_D_SHAPE_OPEN_FORMS)) {
    const chord = Theory.buildChord("D", chordId)
    const shape = Caged.transposeCagedShape(chordId, "D", chord.rootPitchClass, STANDARD)
    assert.deepEqual(fretsOf(shape), PUBLISHED_D_SHAPE_OPEN_FORMS[chordId], chordId)
  }
})

test("published G7/D7 open forms extend the dominant7 shape set", () => {
  const g7 = Theory.buildChord("G", "dominant7")
  assert.deepEqual(fretsOf(Caged.transposeCagedShape("dominant7", "G", g7.rootPitchClass, STANDARD)), [3, 2, 0, 0, 0, 1])
  const d7 = Theory.buildChord("D", "dominant7")
  assert.deepEqual(fretsOf(Caged.transposeCagedShape("dominant7", "D", d7.rootPitchClass, STANDARD)), [-1, -1, 0, 2, 1, 2])
})

test("E/A shapes for non-major qualities match the already-audited chord_voicings.js fingerings", () => {
  const Voicings = loadQmlJs(new URL("../js/chord_voicings.js", import.meta.url))
  const qualities = ["minor", "dominant7", "major7", "minor7", "diminished", "augmented", "sus2", "sus4", "power"]
  for (const chordId of qualities) {
    assert.ok(Voicings.E_ROOT_SHAPES[chordId], `chord_voicings.js should have an audited E shape for ${chordId}`)
    assert.ok(Voicings.A_ROOT_SHAPES[chordId], `chord_voicings.js should have an audited A shape for ${chordId}`)
    const eOpen = Theory.buildChord("E", chordId)
    const eShape = Caged.transposeCagedShape(chordId, "E", eOpen.rootPitchClass, STANDARD)
    assert.deepEqual(fretsOf(eShape), Array.from(Voicings.E_ROOT_SHAPES[chordId]), `E shape mismatch for ${chordId}`)
    const aOpen = Theory.buildChord("A", chordId)
    const aShape = Caged.transposeCagedShape(chordId, "A", aOpen.rootPitchClass, STANDARD)
    assert.deepEqual(fretsOf(aShape), Array.from(Voicings.A_ROOT_SHAPES[chordId]), `A shape mismatch for ${chordId}`)
  }
})

test("available shapes reflect audited coverage decisions, not fabricated completeness", () => {
  const shapes = (chordId) => Array.from(Caged.availableShapes(chordId))
  assert.deepEqual(shapes("major"), ["C", "A", "G", "E", "D"])
  assert.deepEqual(shapes("minor"), ["A", "E", "D"])
  assert.deepEqual(shapes("dominant7"), ["A", "G", "E", "D"])
  assert.deepEqual(shapes("major7"), ["A", "E", "D"])
  assert.deepEqual(shapes("minor7"), ["A", "E", "D"])
  assert.deepEqual(shapes("diminished"), ["A", "E"])
  assert.deepEqual(shapes("augmented"), ["A", "E"])
  assert.deepEqual(shapes("sus2"), ["A", "E"])
  assert.deepEqual(shapes("sus4"), ["A", "E"])
  assert.deepEqual(shapes("power"), ["A", "E"])
  assert.deepEqual(shapes("nonexistent-quality"), [])
})

test("every shape, every root: only chord tones sound and the root is present", () => {
  for (const chordId of Object.keys({
    major: 1, minor: 1, dominant7: 1, major7: 1, minor7: 1,
    diminished: 1, augmented: 1, sus2: 1, sus4: 1, power: 1
  })) {
    for (const root of ALL_ROOTS) {
      const chord = Theory.buildChord(root, chordId)
      const toneSet = Theory.pitchClassSet(chord.notes)
      for (const letter of Caged.availableShapes(chordId)) {
        const shape = Caged.transposeCagedShape(chordId, letter, chord.rootPitchClass, STANDARD)
        assert.ok(shape, `${root}${chordId} ${letter} shape should exist`)
        const sounding = shape.strings.filter((s) => !s.muted)
        assert.ok(sounding.length >= 3, `${root}${chordId} ${letter}: too few sounding strings`)
        for (const s of sounding) assert.ok(toneSet[s.pitchClass], `${root}${chordId} ${letter}: non-chord-tone on string ${s.stringIndex}`)
        assert.ok(sounding.some((s) => s.pitchClass === chord.rootPitchClass), `${root}${chordId} ${letter}: root missing`)
        assert.ok(sounding.some((s) => s.isRoot), `${root}${chordId} ${letter}: no string flagged isRoot`)
      }
    }
  }
})

test("barre is only reported when the shape isn't in its native open position", () => {
  const dMajorOpen = Theory.buildChord("D", "major")
  const dShape = Caged.transposeCagedShape("major", "D", dMajorOpen.rootPitchClass, STANDARD)
  assert.equal(dShape.barre, false)
  const eShapeForD = Caged.transposeCagedShape("major", "E", dMajorOpen.rootPitchClass, STANDARD)
  assert.equal(eShapeForD.barre, true)
})

test("CAGED shapes are Standard-tuning only: alternate tunings return null/empty", () => {
  const chord = Theory.buildChord("D", "major")
  assert.equal(Caged.transposeCagedShape("major", "E", chord.rootPitchClass, DROP_D), null)
  assert.equal(Caged.transposeCagedShape("major", "E", chord.rootPitchClass, []), null)
})

test("unsupported quality/shape combinations return null instead of a fabricated shape", () => {
  const chord = Theory.buildChord("D", "diminished")
  assert.equal(Caged.transposeCagedShape("diminished", "C", chord.rootPitchClass, STANDARD), null, "no C-shape diminished")
  assert.equal(Caged.transposeCagedShape("not-a-quality", "E", chord.rootPitchClass, STANDARD), null)
})

test("shapePositions flattens sounding strings only, for chord-tone-map emphasis", () => {
  const chord = Theory.buildChord("D", "major")
  const shape = Caged.transposeCagedShape("major", "E", chord.rootPitchClass, STANDARD)
  const positions = Caged.shapePositions(shape)
  assert.equal(positions.length, 6, "the E shape has no muted strings")
  for (const [stringIndex, fret] of positions) {
    assert.ok(stringIndex >= 0 && stringIndex <= 5)
    assert.equal(fret, shape.strings[stringIndex].fret)
  }
})
