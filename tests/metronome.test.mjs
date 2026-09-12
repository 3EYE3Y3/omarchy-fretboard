import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Metronome = loadQmlJs(new URL("../js/metronome.js", import.meta.url))

test("clamps BPM into the supported range", () => {
  assert.equal(Metronome.clampBpm(10), 30)
  assert.equal(Metronome.clampBpm(500), 300)
  assert.equal(Metronome.clampBpm(120.4), 120)
  assert.equal(Metronome.clampBpm(120.6), 121)
  assert.equal(Metronome.clampBpm(""), 30)
  assert.equal(Metronome.clampBpm(NaN), 30)
})

test("adjusts BPM by a delta and re-clamps", () => {
  assert.equal(Metronome.adjustBpm(120, 5), 125)
  assert.equal(Metronome.adjustBpm(298, 5), 300)
  assert.equal(Metronome.adjustBpm(32, -5), 30)
})

test("exposes the required time signatures", () => {
  const ids = Array.from(Metronome.TIME_SIGNATURES).map((t) => t.label)
  assert.deepEqual(ids, ["2/4", "3/4", "4/4", "5/4", "6/8", "7/8", "9/8", "12/8"])
})

test("exposes the required subdivisions", () => {
  const ids = Array.from(Metronome.SUBDIVISIONS).map((s) => s.id)
  assert.deepEqual(ids, ["quarter", "eighth", "triplet", "sixteenth"])
})

test("subdivision labels state meter-neutral click multipliers", () => {
  assert.deepEqual(Array.from(Metronome.SUBDIVISIONS, (s) => s.label), ["Beat", "2 / beat", "3 / beat", "4 / beat"])
})

test("builds an accurate click schedule for 4/4 quarter notes", () => {
  const ticks = Array.from(Metronome.buildClickSchedule({ bpm: 120, timeSignatureId: "4-4", subdivisionId: "quarter", count: 8 }))
  assert.equal(ticks.length, 8)
  assert.deepEqual(ticks.map((t) => t.accent), [true, false, false, false, true, false, false, false])
  assert.deepEqual(ticks.map((t) => t.beatIndex), [0, 1, 2, 3, 0, 1, 2, 3])
  // 120 BPM -> 0.5s per beat.
  assert.equal(ticks[1].offsetSeconds, 0.5)
  assert.equal(ticks[4].offsetSeconds, 2)
})

test("subdivides each beat into equal ticks and only accents the downbeat", () => {
  const ticks = Array.from(Metronome.buildClickSchedule({ bpm: 60, timeSignatureId: "3-4", subdivisionId: "eighth", count: 6 }))
  assert.equal(ticks.length, 6)
  assert.deepEqual(ticks.map((t) => t.subIndex), [0, 1, 0, 1, 0, 1])
  assert.deepEqual(ticks.map((t) => t.accent), [true, false, false, false, false, false])
  // 60 BPM -> 1s per beat, eighth subdivision -> 0.5s per tick.
  assert.equal(ticks[1].offsetSeconds, 0.5)
  assert.equal(ticks[2].offsetSeconds, 1)
})

test("handles triplet subdivision counts", () => {
  const ticks = Array.from(Metronome.buildClickSchedule({ bpm: 90, timeSignatureId: "4-4", subdivisionId: "triplet", count: 12 }))
  assert.equal(ticks.filter((t) => t.beatIndex === 0).length, 3)
  assert.equal(ticks.filter((t) => t.accent).length, 1)
})

test("models 6/8 as two dotted-quarter beats split into three eighths", () => {
  const signature = Metronome.timeSignatureById("6-8")
  assert.equal(signature.beatsPerBar, 2)
  const ticks = Array.from(Metronome.buildClickSchedule({ bpm: 60, timeSignatureId: "6-8", subdivisionId: "triplet", count: 12 }))
  assert.deepEqual(ticks.map((t) => t.beatIndex), [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1])
  assert.deepEqual(ticks.map((t) => t.accent), [true, false, false, false, false, false, true, false, false, false, false, false])
})

test("resumes a schedule mid-bar from an arbitrary start tick", () => {
  const ticks = Array.from(Metronome.buildClickSchedule({ bpm: 100, timeSignatureId: "4-4", subdivisionId: "quarter", startTick: 4, count: 4 }))
  assert.deepEqual(ticks.map((t) => t.beatIndex), [0, 1, 2, 3])
  assert.equal(ticks[0].accent, true)
})

test("computes tap tempo from evenly spaced taps", () => {
  let state = { taps: [], bpm: null }
  state = Metronome.recordTap(state.taps, 0)
  assert.equal(state.bpm, null)
  state = Metronome.recordTap(state.taps, 500)
  assert.equal(state.bpm, 120)
  state = Metronome.recordTap(state.taps, 1000)
  assert.equal(state.bpm, 120)
})

test("tap tempo resets after a long pause", () => {
  let state = Metronome.recordTap([], 0)
  state = Metronome.recordTap(state.taps, 500)
  assert.equal(state.bpm, 120)
  // A gap far beyond the reset window restarts tapping.
  state = Metronome.recordTap(state.taps, 10000)
  assert.equal(state.taps.length, 1)
  assert.equal(state.bpm, null)
})

test("tap tempo clamps to the supported BPM range", () => {
  let state = Metronome.recordTap([], 0)
  state = Metronome.recordTap(state.taps, 50) // 1200 BPM raw
  assert.equal(state.bpm, 300)
})
