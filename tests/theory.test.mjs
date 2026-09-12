import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Theory = loadQmlJs(new URL("../js/theory.js", import.meta.url))

const REQUIRED_SCALES = [
  "major", "natural_minor", "major_pentatonic", "minor_pentatonic", "blues",
  "harmonic_minor", "melodic_minor", "ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"
]

const REQUIRED_CHORDS = [
  "major", "minor", "dominant7", "major7", "minor7", "sus2", "sus4",
  "diminished", "augmented", "add9", "power"
]

test("ships every required scale", () => {
  const ids = Array.from(Theory.SCALES).map((s) => s.id)
  for (const id of REQUIRED_SCALES) assert.ok(ids.includes(id), `missing scale ${id}`)
})

test("ships every required chord family", () => {
  const ids = Array.from(Theory.CHORDS).map((c) => c.id)
  for (const id of REQUIRED_CHORDS) assert.ok(ids.includes(id), `missing chord ${id}`)
})

test("builds a C major scale with the correct notes", () => {
  const scale = Theory.buildScale("C", "major")
  const names = Array.from(scale.notes).map((n) => n.name)
  assert.deepEqual(names, ["C", "D", "E", "F", "G", "A", "B"])
  assert.equal(scale.notes[0].interval, "R")
  assert.equal(scale.notes[4].interval, "5")
})

test("builds an A minor pentatonic scale", () => {
  const scale = Theory.buildScale("A", "minor_pentatonic")
  const names = Array.from(scale.notes).map((n) => n.name)
  assert.deepEqual(names, ["A", "C", "D", "E", "G"])
})

test("transposes scales correctly for a sharp key", () => {
  const scale = Theory.buildScale("F#", "major")
  const names = Array.from(scale.notes).map((n) => n.name)
  assert.deepEqual(names, ["F#", "G#", "A#", "B", "C#", "D#", "E#"])
})

test("builds a G major chord with correct tones and formula", () => {
  const chord = Theory.buildChord("G", "major")
  assert.equal(chord.name, "G")
  assert.equal(chord.formula, "1 3 5")
  const names = Array.from(chord.notes).map((n) => n.name)
  assert.deepEqual(names, ["G", "B", "D"])
})

test("builds a D minor 7 chord", () => {
  const chord = Theory.buildChord("D", "minor7")
  assert.equal(chord.name, "Dm7")
  const names = Array.from(chord.notes).map((n) => n.name)
  assert.deepEqual(names, ["D", "F", "A", "C"])
})

test("builds a power chord with only root and fifth", () => {
  const chord = Theory.buildChord("E", "power")
  const names = Array.from(chord.notes).map((n) => n.name)
  assert.deepEqual(names, ["E", "B"])
})

test("interval labels preserve musical function rather than collapsing enharmonics", () => {
  const lydian = Theory.buildScale("C", "lydian")
  assert.equal(lydian.notes[3].name, "F#")
  assert.equal(lydian.notes[3].interval, "#4")
  assert.equal(Theory.buildChord("C", "augmented").notes[2].interval, "#5")
  assert.equal(Theory.buildChord("C", "add9").notes[3].interval, "9")
})

test("returns null for unknown root or scale/chord id", () => {
  assert.equal(Theory.buildScale("Z", "major"), null)
  assert.equal(Theory.buildScale("C", "not-a-scale"), null)
  assert.equal(Theory.buildChord("C", "not-a-chord"), null)
})

test("pitchClassSet produces a lookup usable for fretboard highlighting", () => {
  const scale = Theory.buildScale("C", "major")
  const set = Theory.pitchClassSet(scale.notes)
  assert.equal(set[0], true) // C
  assert.equal(set[4], true) // E
  assert.equal(set[1], undefined) // C#/Db not in C major
})
