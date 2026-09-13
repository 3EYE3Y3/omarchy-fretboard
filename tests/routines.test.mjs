import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Routines = loadQmlJs(new URL("../js/routines.js", import.meta.url))

test("creates a routine with normalized items", () => {
  const routine = Routines.createRoutine("Morning Practice", [{ type: "warmup", label: "Chromatic warmup" }])
  assert.equal(routine.name, "Morning Practice")
  assert.equal(routine.items.length, 1)
  assert.equal(routine.items[0].type, "warmup")
  assert.equal(routine.items[0].status, "pending")
  assert.ok(routine.id)
})

test("falls back to custom for an unknown item type", () => {
  const routine = Routines.createRoutine("R", [{ type: "not-a-type", label: "x" }])
  assert.equal(routine.items[0].type, "custom")
})

test("adds, updates, and removes items", () => {
  let routine = Routines.createRoutine("R", [])
  routine = Routines.addItem(routine, { type: "scales", label: "A minor pentatonic", targetBpm: 80 })
  assert.equal(routine.items.length, 1)
  const id = routine.items[0].id

  routine = Routines.updateItem(routine, id, { targetBpm: 90, notes: "focus on shifts" })
  assert.equal(routine.items[0].targetBpm, 90)
  assert.equal(routine.items[0].notes, "focus on shifts")
  assert.equal(routine.items[0].type, "scales") // unrelated fields survive a partial patch

  routine = Routines.removeItem(routine, id)
  assert.equal(routine.items.length, 0)
})

test("reorders items", () => {
  let routine = Routines.createRoutine("R", [{ label: "a" }, { label: "b" }, { label: "c" }])
  routine = Routines.reorderItem(routine, 0, 2)
  assert.deepEqual(Array.from(routine.items).map((i) => i.label), ["b", "c", "a"])
})

test("reorder is a no-op for an out-of-range source index", () => {
  let routine = Routines.createRoutine("R", [{ label: "a" }, { label: "b" }])
  const before = Array.from(routine.items).map((i) => i.label)
  routine = Routines.reorderItem(routine, 5, 0)
  assert.deepEqual(Array.from(routine.items).map((i) => i.label), before)
})

test("duplicates a routine with a new id and reset item status", () => {
  let routine = Routines.createRoutine("Warmups", [{ label: "a", status: "done" }])
  const copy = Routines.duplicateRoutine(routine)
  assert.equal(copy.name, "Warmups Copy")
  assert.notEqual(copy.id, routine.id)
  assert.notEqual(copy.items[0].id, routine.items[0].id)
  assert.equal(copy.items[0].status, "pending")
  assert.equal(routine.items[0].status, "done") // original untouched
})

test("runs a routine end to end through the state machine", () => {
  const routine = Routines.createRoutine("R", [{ label: "a" }, { label: "b" }, { label: "c" }])
  let run = Routines.startRun(routine)
  assert.equal(Routines.currentItem(routine, run).label, "a")
  assert.equal(Routines.nextItem(routine, run).label, "b")
  assert.equal(Routines.progressFraction(routine, run), 0)

  run = Routines.advance(routine, run)
  assert.equal(Routines.currentItem(routine, run).label, "b")
  assert.ok(Math.abs(Routines.progressFraction(routine, run) - 1 / 3) < 1e-9)

  run = Routines.advance(routine, run)
  assert.equal(Routines.currentItem(routine, run).label, "c")
  assert.equal(Routines.nextItem(routine, run), null)

  run = Routines.advance(routine, run)
  assert.equal(run.completed, true)
  assert.equal(Routines.currentItem(routine, run), null)
  assert.equal(Routines.progressFraction(routine, run), 1)
})

test("progress fraction is complete for an empty routine", () => {
  const routine = Routines.createRoutine("Empty", [])
  const run = Routines.startRun(routine)
  assert.equal(Routines.progressFraction(routine, run), 1)
})

// ------------------------------------------------------------ dynamic stages (v0.4)

test("createItem stores a normalized stages/advance pair, or null for a plain item", () => {
  const plain = Routines.createItem({ label: "Static" })
  assert.equal(plain.stages, null)
  assert.equal(plain.advance, null)

  const dynamic = Routines.createItem({
    label: "Dynamic", stages: [{ label: "Box 1" }, { label: "Box 2" }],
    advance: { mode: "bars", everyBars: 4 }
  })
  assert.equal(dynamic.stages.length, 2)
  assert.equal(dynamic.advance.mode, "bars")
  assert.equal(dynamic.advance.everyBars, 4)

  // An advance with no stages array never counts as dynamic.
  const noStages = Routines.createItem({ label: "x", advance: { mode: "time", everySeconds: 30 } })
  assert.equal(noStages.stages, null)
})

test("hasStages is true only for a well-formed stages+advance pair", () => {
  assert.equal(Routines.hasStages(Routines.createItem({ label: "static" })), false)
  assert.equal(Routines.hasStages(Routines.createItem({
    label: "dyn", stages: [{ label: "a" }], advance: { mode: "time", everySeconds: 60 }
  })), true)
  assert.equal(Routines.hasStages(null), false)
})

test("resolveStageItem merges a stage patch onto its base item and clears stages/advance", () => {
  const item = Routines.createItem({
    label: "Base", notes: "base notes", targetBpm: 90,
    metronome: { timeSignatureId: "4-4", subdivisionId: "eighth" },
    scaleKey: { key: "A", scaleId: "minor_pentatonic" },
    stages: [
      { label: "Box 1", notes: "box 1 notes" },
      { label: "Box 2", notes: "box 2 notes", metronome: { subdivisionId: "triplet" } }
    ],
    advance: { mode: "time", everySeconds: 60 }
  })

  const stage0 = Routines.resolveStageItem(item, 0)
  assert.equal(stage0.label, "Box 1")
  assert.equal(stage0.notes, "box 1 notes")
  assert.equal(stage0.targetBpm, 90) // inherited, not overridden by the stage
  assert.equal(stage0.scaleKey.key, "A") // inherited nested field survives
  assert.equal(stage0.stages, null)
  assert.equal(stage0.advance, null)

  const stage1 = Routines.resolveStageItem(item, 1)
  assert.equal(stage1.label, "Box 2")
  // Metronome merges shallowly: subdivisionId overridden, timeSignatureId kept.
  assert.equal(stage1.metronome.subdivisionId, "triplet")
  assert.equal(stage1.metronome.timeSignatureId, "4-4")

  // Base item itself is never mutated by resolving a stage.
  assert.equal(item.notes, "base notes")
  assert.equal(item.metronome.subdivisionId, "eighth")
})

test("resolveStageItem clamps an out-of-range index instead of throwing", () => {
  const item = Routines.createItem({
    label: "Base", stages: [{ label: "a" }, { label: "b" }], advance: { mode: "time", everySeconds: 60 }
  })
  assert.equal(Routines.resolveStageItem(item, -5).label, "a")
  assert.equal(Routines.resolveStageItem(item, 99).label, "b")
})

test("resolveStageItem is a no-op passthrough for a non-dynamic item", () => {
  const item = Routines.createItem({ label: "Static" })
  assert.equal(Routines.resolveStageItem(item, 3), item)
})
