import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Pitch = loadQmlJs(new URL("../js/pitch.js", import.meta.url))

test("identifies A4 exactly at the default reference pitch", () => {
  const result = Pitch.frequencyToNote(440, 440)
  assert.equal(result.note, "A")
  assert.equal(result.octave, 4)
  assert.ok(Math.abs(result.cents) < 0.001)
  assert.equal(result.inTune, true)
})

test("identifies standard guitar open strings", () => {
  const cases = [
    [82.41, "E", 2],
    [110.0, "A", 2],
    [146.83, "D", 3],
    [196.0, "G", 3],
    [246.94, "B", 3],
    [329.63, "E", 4]
  ]
  for (const [freq, note, octave] of cases) {
    const result = Pitch.frequencyToNote(freq, 440)
    assert.equal(result.note, note, `${freq}Hz should be ${note}${octave}, got ${result.note}${result.octave}`)
    assert.equal(result.octave, octave)
    assert.ok(Math.abs(result.cents) < 2, `expected near-zero cents for ${freq}Hz, got ${result.cents}`)
  }
})

test("reports sharp/flat cents deviation in the correct direction", () => {
  const sharp = Pitch.frequencyToNote(446, 440) // slightly above A4
  assert.equal(sharp.note, "A")
  assert.ok(sharp.cents > 0)

  const flat = Pitch.frequencyToNote(434, 440) // slightly below A4
  assert.equal(flat.note, "A")
  assert.ok(flat.cents < 0)
})

test("honors an adjusted A4 reference pitch", () => {
  // At A4=442, 442Hz reads as a perfectly in-tune A4.
  const result = Pitch.frequencyToNote(442, 442)
  assert.equal(result.note, "A")
  assert.equal(result.octave, 4)
  assert.ok(Math.abs(result.cents) < 0.001)
})

test("flags out-of-tune notes beyond the tolerance", () => {
  // 445Hz is about +20 cents from A4=440 - clearly out of tune.
  const result = Pitch.frequencyToNote(445, 440)
  assert.equal(result.inTune, false)
})

test("round-trips note name/octave to frequency and back", () => {
  const freq = Pitch.noteToFrequency("E", 2, 440)
  assert.ok(Math.abs(freq - 82.41) < 0.05)
  const back = Pitch.frequencyToNote(freq, 440)
  assert.equal(back.note, "E")
  assert.equal(back.octave, 2)
})

test("parses note name strings including sharps and flats", () => {
  const e2 = Pitch.parseNoteName("E2")
  assert.equal(e2.pitchClass, 4)
  assert.equal(e2.octave, 2)
  const fSharp3 = Pitch.parseNoteName("F#3")
  assert.equal(fSharp3.pitchClass, 6)
  assert.equal(fSharp3.octave, 3)
  const bFlat4 = Pitch.parseNoteName("Bb4")
  assert.equal(bFlat4.pitchClass, 10)
  assert.equal(bFlat4.octave, 4)
  assert.equal(Pitch.parseNoteName("not-a-note"), null)
})

test("rejects non-positive or missing frequencies", () => {
  assert.equal(Pitch.frequencyToNote(0, 440), null)
  assert.equal(Pitch.frequencyToNote(-5, 440), null)
  assert.equal(Pitch.frequencyToNote(undefined, 440), null)
})
