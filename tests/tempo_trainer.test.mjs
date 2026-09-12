import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Trainer = loadQmlJs(new URL("../js/tempo_trainer.js", import.meta.url))

const plan = { startBpm: 80, targetBpm: 120, incrementBpm: 5, incrementMode: "time", intervalSeconds: 120 }

test("holds the start BPM until the first interval elapses", () => {
  assert.equal(Trainer.bpmAtElapsedSeconds(plan, 0), 80)
  assert.equal(Trainer.bpmAtElapsedSeconds(plan, 119), 80)
})

test("steps up by the increment every interval", () => {
  assert.equal(Trainer.bpmAtElapsedSeconds(plan, 120), 85)
  assert.equal(Trainer.bpmAtElapsedSeconds(plan, 239), 85)
  assert.equal(Trainer.bpmAtElapsedSeconds(plan, 240), 90)
})

test("stops climbing once it reaches the target BPM", () => {
  assert.equal(Trainer.bpmAtElapsedSeconds(plan, 960), 120)
  assert.equal(Trainer.bpmAtElapsedSeconds(plan, 999999), 120)
  assert.equal(Trainer.isComplete(plan, 120), true)
  assert.equal(Trainer.isComplete(plan, 119), false)
})

test("supports descending plans", () => {
  const down = { startBpm: 120, targetBpm: 80, incrementBpm: 10, incrementMode: "time", intervalSeconds: 60 }
  assert.equal(Trainer.bpmAtElapsedSeconds(down, 0), 120)
  assert.equal(Trainer.bpmAtElapsedSeconds(down, 60), 110)
  assert.equal(Trainer.bpmAtElapsedSeconds(down, 600), 80)
  assert.equal(Trainer.isComplete(down, 80), true)
})

test("supports incrementing by elapsed bar count instead of time", () => {
  const barPlan = { startBpm: 100, targetBpm: 110, incrementBpm: 2, incrementMode: "bars", intervalBars: 4 }
  assert.equal(Trainer.bpmAtCompletedBars(barPlan, 0), 100)
  assert.equal(Trainer.bpmAtCompletedBars(barPlan, 3), 100)
  assert.equal(Trainer.bpmAtCompletedBars(barPlan, 4), 102)
  assert.equal(Trainer.bpmAtCompletedBars(barPlan, 8), 104)
  assert.equal(Trainer.bpmAtCompletedBars(barPlan, 999), 110)
})

test("computes total steps and total duration for a plan", () => {
  assert.equal(Trainer.totalSteps(plan), 8)
  assert.equal(Trainer.totalDurationSeconds(plan), 960)
})

test("clamps BPM inputs into the supported instrument range", () => {
  const wild = { startBpm: 5, targetBpm: 900, incrementBpm: 5, incrementMode: "time", intervalSeconds: 60 }
  assert.equal(Trainer.bpmAtElapsedSeconds(wild, 0), 30)
  assert.equal(Trainer.bpmAtElapsedSeconds(wild, 999999), 300)
})
