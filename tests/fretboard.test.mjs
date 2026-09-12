import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Fretboard = loadQmlJs(new URL("../js/fretboard.js", import.meta.url))

const STANDARD = ["E2", "A2", "D3", "G3", "B3", "E4"]

test("computes the note at a given fret from an open string", () => {
  assert.equal(Fretboard.noteAtFret("E2", 0).name, "E")
  assert.equal(Fretboard.noteAtFret("E2", 0).octave, 2)
  const fret5 = Fretboard.noteAtFret("E2", 5)
  assert.equal(fret5.name, "A")
  assert.equal(fret5.octave, 2)
  const fret12 = Fretboard.noteAtFret("E2", 12)
  assert.equal(fret12.name, "E")
  assert.equal(fret12.octave, 3)
})

test("builds a full fretboard with at least 24 frets by default", () => {
  const board = Fretboard.buildFretboard(STANDARD)
  assert.equal(board.fretCount, 24)
  assert.equal(board.strings.length, 6)
  for (const row of board.strings) assert.equal(row.length, 25)
  // Low E string, fret 0 is E2; fret 24 is two octaves up, E4.
  assert.equal(board.strings[0][0].name, "E")
  assert.equal(board.strings[0][0].octave, 2)
  assert.equal(board.strings[0][24].name, "E")
  assert.equal(board.strings[0][24].octave, 4)
  // High E string, fret 0 is E4.
  assert.equal(board.strings[5][0].name, "E")
  assert.equal(board.strings[5][0].octave, 4)
})

test("honors a custom fret count", () => {
  const board = Fretboard.buildFretboard(STANDARD, 12)
  assert.equal(board.fretCount, 12)
  assert.equal(board.strings[0].length, 13)
})

test("finds a compact position window covering scale tones", () => {
  // A minor pentatonic: A(9), C(0), D(2), E(4), G(7).
  const set = { 9: true, 0: true, 2: true, 4: true, 7: true }
  const window = Fretboard.findPositionWindow(STANDARD, set, 24, 5)
  assert.equal(window.endFret - window.startFret, 5)
  assert.ok(window.startFret >= 0)
  assert.ok(window.endFret <= 24)
})

test("position window width is configurable and stays in range", () => {
  const set = { 0: true, 4: true, 7: true } // C major triad tones
  const window = Fretboard.findPositionWindow(STANDARD, set, 12, 4)
  assert.equal(window.endFret - window.startFret, 4)
  assert.ok(window.endFret <= 12)
})

test("highlights scale/chord tone positions and marks the root", () => {
  const board = Fretboard.buildFretboard(STANDARD, 12)
  // A major pentatonic-ish set for this test: pitch classes 9 (A) and 0 (C).
  const set = { 9: true, 0: true }
  const highlighted = Fretboard.highlightFretboard(board, set, 9)
  // Low E string open (E, pc4) should not be highlighted.
  assert.equal(highlighted.strings[0][0].highlighted, false)
  // A string open (A2, pc9) should be highlighted and marked root.
  assert.equal(highlighted.strings[1][0].highlighted, true)
  assert.equal(highlighted.strings[1][0].isRoot, true)
  // Low E string, fret 3 is G, not in the set.
  assert.equal(highlighted.strings[0][3].name, "G")
  assert.equal(highlighted.strings[0][3].highlighted, false)
})
