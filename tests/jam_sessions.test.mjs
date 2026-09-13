import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Jam = loadQmlJs(new URL("../js/jam_sessions.js", import.meta.url))

test("ships exactly the 8 required styles across Blues and Jazz genres", () => {
  const styles = Array.from(Jam.STYLES)
  assert.equal(styles.length, 8)
  const ids = styles.map((s) => s.id)
  assert.deepEqual(new Set(ids).size, 8)
  for (const required of ["major-blues", "minor-blues", "shuffle-blues", "slow-blues",
    "major-ii-v-i", "minor-ii-v-i", "jazz-blues", "dorian-vamp"])
    assert.ok(ids.includes(required), `missing style ${required}`)
  assert.deepEqual(Array.from(Jam.genres()), ["Blues", "Jazz"])
})

test("ships all 12 chromatic keys", () => {
  const keys = Jam.keys()
  assert.equal(keys.length, 12)
  assert.equal(new Set(keys).size, 12)
})

test("major blues in A transposes to the expected I7-IV7-V7 12-bar form", () => {
  const p = Jam.resolveProgression("major-blues", "A")
  assert.equal(p.stages.length, 12)
  assert.equal(p.totalBars, 12)
  assert.deepEqual(Array.from(p.stages, (s) => s.chordSymbol),
    ["A7", "D7", "A7", "A7", "D7", "D7", "A7", "A7", "E7", "D7", "A7", "E7"])
  assert.deepEqual(Array.from(p.stages, (s) => s.quality), Array(12).fill("dominant7"))
})

test("minor blues in E uses minor7 i/iv and a dominant7 turnaround", () => {
  const p = Jam.resolveProgression("minor-blues", "E")
  assert.deepEqual(Array.from(p.stages, (s) => s.chordSymbol),
    ["Em7", "Am7", "Em7", "Em7", "Am7", "Am7", "Em7", "Em7", "B7", "Am7", "Em7", "B7"])
  assert.equal(p.stages[0].quality, "minor7")
  assert.equal(p.stages[8].quality, "dominant7")
})

test("shuffle and slow blues reuse the exact same major-blues progression, differing only in style metadata", () => {
  const base = Jam.resolveProgression("major-blues", "C")
  const shuffle = Jam.resolveProgression("shuffle-blues", "C")
  const slow = Jam.resolveProgression("slow-blues", "C")
  assert.deepEqual(Array.from(shuffle.stages, (s) => s.chordSymbol), Array.from(base.stages, (s) => s.chordSymbol))
  assert.deepEqual(Array.from(slow.stages, (s) => s.chordSymbol), Array.from(base.stages, (s) => s.chordSymbol))
  assert.equal(shuffle.style.feel, "shuffle")
  assert.equal(slow.style.feel, "shuffle")
  assert.equal(base.style.feel, "straight")
  assert.ok(slow.style.defaultTempo < base.style.defaultTempo, "slow blues should default to a slower tempo")
})

test("major ii-V-I in C resolves to Dm7-G7-Cmaj7, 2 bars per chord", () => {
  const p = Jam.resolveProgression("major-ii-v-i", "C")
  assert.deepEqual(Array.from(p.stages, (s) => s.chordSymbol), ["Dm7", "G7", "Cmaj7"])
  assert.deepEqual(Array.from(p.stages, (s) => s.quality), ["minor7", "dominant7", "major7"])
  assert.equal(p.advance.mode, "bars")
  assert.equal(p.advance.everyBars, 2)
  assert.equal(p.totalBars, 6)
})

test("minor ii-V-i in D resolves to Em7b5-A7-Dm7", () => {
  const p = Jam.resolveProgression("minor-ii-v-i", "D")
  assert.deepEqual(Array.from(p.stages, (s) => s.chordSymbol), ["Em7b5", "A7", "Dm7"])
  assert.deepEqual(Array.from(p.stages, (s) => s.quality), ["minor7b5", "dominant7", "minor7"])
})

test("jazz blues in C matches the sourced quick-change + ii-V7 turnaround form", () => {
  const p = Jam.resolveProgression("jazz-blues", "C")
  assert.deepEqual(Array.from(p.stages, (s) => s.chordSymbol),
    ["C7", "F7", "C7", "C7", "F7", "F7", "C7", "C7", "Dm7", "G7", "C7", "G7"])
  assert.equal(p.stages[8].quality, "minor7") // the ii7 insert at bar 9
})

test("Dorian vamp in D matches the sourced Dm7-G7 two-chord vamp, 4 bars per chord", () => {
  const p = Jam.resolveProgression("dorian-vamp", "D")
  assert.deepEqual(Array.from(p.stages, (s) => s.chordSymbol), ["Dm7", "G7"])
  assert.equal(p.advance.everyBars, 4)
  assert.equal(p.parentScaleId, "dorian")
  assert.equal(p.totalBars, 8)
})

test("every progression transposes correctly across all 12 keys without throwing", () => {
  for (const style of Jam.STYLES) for (const key of Jam.keys()) {
    const p = Jam.resolveProgression(style.id, key)
    assert.ok(p, `${style.id} in ${key} failed to resolve`)
    assert.ok(p.stages.length > 0)
    for (const stage of p.stages) {
      assert.ok(stage.rootPitchClass >= 0 && stage.rootPitchClass < 12)
      assert.ok(stage.chordSymbol && stage.chordSymbol.length > 0)
    }
  }
})

test("resolveProgression returns null for an unknown style id", () => {
  assert.equal(Jam.resolveProgression("not-a-style", "A"), null)
})

test("chordPitchClassSet contains exactly the chord's tones and chordSymbol names the root+quality", () => {
  const set = Jam.chordPitchClassSet(0, "dominant7") // C7: C-E-G-Bb
  assert.deepEqual(Object.keys(set).map(Number).sort((a, b) => a - b), [0, 4, 7, 10])
  assert.equal(Jam.chordSymbol(0, "dominant7"), "C7")
  assert.equal(Jam.chordSymbol(9, "minor7b5"), "Am7b5")
})
