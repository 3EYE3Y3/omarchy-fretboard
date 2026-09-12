import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Tunings = loadQmlJs(new URL("../js/tunings.js", import.meta.url))

const REQUIRED = ["standard", "drop_d", "d_standard", "drop_c", "eb_standard", "open_g", "open_d", "dadgad"]

test("ships every required built-in tuning with six strings", () => {
  const ids = Array.from(Tunings.BUILTIN_TUNINGS).map((t) => t.id)
  for (const id of REQUIRED) assert.ok(ids.includes(id), `missing tuning ${id}`)
  for (const tuning of Tunings.BUILTIN_TUNINGS) {
    assert.equal(tuning.notes.length, 6, `${tuning.id} should have 6 strings`)
  }
})

test("standard tuning is EADGBE low to high", () => {
  const standard = Tunings.builtinTuningById("standard")
  assert.deepEqual(Array.from(standard.notes), ["E2", "A2", "D3", "G3", "B3", "E4"])
})

test("drop D only lowers the sixth string", () => {
  const standard = Tunings.builtinTuningById("standard")
  const dropD = Tunings.builtinTuningById("drop_d")
  assert.equal(dropD.notes[0], "D2")
  for (let i = 1; i < 6; i++) assert.equal(dropD.notes[i], standard.notes[i])
})

test("validates note-name arrays", () => {
  assert.equal(Tunings.isValidTuning(["E2", "A2", "D3", "G3", "B3", "E4"]), true)
  assert.equal(Tunings.isValidTuning(["E2", "not-a-note"]), false)
  assert.equal(Tunings.isValidTuning([]), false)
  assert.equal(Tunings.isValidTuning(null), false)
})

test("resolves a custom tuning by id, falling back to standard", () => {
  const customs = [{ id: "custom-1", name: "My Tuning", notes: ["C2", "G2", "C3", "F3", "A3", "D4"] }]
  const resolved = Tunings.resolveTuning("custom-1", customs)
  assert.equal(resolved.name, "My Tuning")
  const fallback = Tunings.resolveTuning("does-not-exist", customs)
  assert.equal(fallback.id, "standard")
})

test("creates a custom tuning with a stable generated id", () => {
  const created = Tunings.createCustomTuning("My Weird Tuning!", ["E2", "A2", "D3", "G3", "B3", "E4"])
  assert.ok(created.id.startsWith("custom-my-weird-tuning-"))
  assert.equal(created.custom, true)
  assert.equal(Tunings.createCustomTuning("Bad", ["nope"]), null)
})
