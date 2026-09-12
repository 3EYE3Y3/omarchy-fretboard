import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Voicings = loadQmlJs(new URL("../js/chord_voicings.js", import.meta.url))
const Theory = loadQmlJs(new URL("../js/theory.js", import.meta.url))

const STANDARD = ["E2", "A2", "D3", "G3", "B3", "E4"]

function toneSetFor(root, chordId) {
  const chord = Theory.buildChord(root, chordId)
  return Theory.pitchClassSet(chord.notes)
}

test("reproduces the textbook open E major chord shape", () => {
  const toneSet = toneSetFor("E", "major")
  const voicings = Voicings.findVoicings(STANDARD, toneSet, 4)
  assert.ok(voicings.length > 0)
  const open = voicings[0]
  assert.equal(open.anchorFret, 0)
  assert.deepEqual(Array.from(open.strings).map((s) => s.fret), [0, 2, 2, 1, 0, 0])
})

test("every returned voicing sounds the chord root and only chord tones", () => {
  const cases = [
    ["A", "minor"], ["C", "major"], ["G", "dominant7"], ["F", "major7"],
    ["D", "minor7"], ["A", "sus2"], ["D", "sus4"], ["B", "diminished"],
    ["C", "augmented"], ["E", "add9"], ["E", "power"]
  ]
  for (const [root, chordId] of cases) {
    const chord = Theory.buildChord(root, chordId)
    const toneSet = Theory.pitchClassSet(chord.notes)
    const voicings = Voicings.findVoicings(STANDARD, toneSet, chord.rootPitchClass)
    assert.ok(voicings.length > 0, `no voicing found for ${root}${chordId}`)
    for (const voicing of voicings) {
      assert.ok(voicing.span <= 4, `voicing span too wide for ${root}${chordId}`)
      const sounding = Array.from(voicing.strings).filter((s) => !s.muted)
      assert.ok(sounding.length >= 3, `too few sounding strings for ${root}${chordId}`)
      assert.ok(sounding.some((s) => s.pitchClass === chord.rootPitchClass), `root missing for ${root}${chordId}`)
      for (const s of sounding) assert.ok(toneSet[s.pitchClass], `non-chord-tone in voicing for ${root}${chordId}`)
    }
  }
})

test("provides multiple distinct voicings up the neck where available", () => {
  const toneSet = toneSetFor("C", "major")
  const voicings = Voicings.findVoicings(STANDARD, toneSet, 0)
  assert.ok(voicings.length >= 2, "expected at least an open and a barre-position voicing for C major")
  const keys = voicings.map((v) => v.strings.map((s) => s.fret).join(","))
  assert.equal(new Set(keys).size, keys.length, "voicings should be distinct")
})

test("returns an empty list for a tuning with no strings", () => {
  assert.equal(Voicings.findVoicings([], {}, 0).length, 0)
})
