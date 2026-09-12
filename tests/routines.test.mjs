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
