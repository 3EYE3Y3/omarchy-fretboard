import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Stage = loadQmlJs(new URL("../js/stage_engine.js", import.meta.url))

const stages = ["Box 1", "Box 2", "Box 3", "Box 4", "Box 5"]
const timePlan = { mode: "time", everySeconds: 120 }
const barPlan = { mode: "bars", everyBars: 8 }

test("time-based advance holds each stage for exactly everySeconds", () => {
  assert.equal(Stage.stageIndexAtElapsedSeconds(stages, timePlan, 0), 0)
  assert.equal(Stage.stageIndexAtElapsedSeconds(stages, timePlan, 119), 0)
  assert.equal(Stage.stageIndexAtElapsedSeconds(stages, timePlan, 120), 1)
  assert.equal(Stage.stageIndexAtElapsedSeconds(stages, timePlan, 239), 1)
  assert.equal(Stage.stageIndexAtElapsedSeconds(stages, timePlan, 240), 2)
})

test("time-based advance holds at the last stage once the sequence is exhausted", () => {
  assert.equal(Stage.stageIndexAtElapsedSeconds(stages, timePlan, 480), 4)
  assert.equal(Stage.stageIndexAtElapsedSeconds(stages, timePlan, 999999), 4)
})

test("bar-based advance steps once every everyBars completed bars", () => {
  assert.equal(Stage.stageIndexAtCompletedBars(stages, barPlan, 0), 0)
  assert.equal(Stage.stageIndexAtCompletedBars(stages, barPlan, 7), 0)
  assert.equal(Stage.stageIndexAtCompletedBars(stages, barPlan, 8), 1)
  assert.equal(Stage.stageIndexAtCompletedBars(stages, barPlan, 32), 4)
  assert.equal(Stage.stageIndexAtCompletedBars(stages, barPlan, 9999), 4)
})

test("autoStageIndex dispatches on the plan's mode", () => {
  assert.equal(Stage.autoStageIndex(stages, timePlan, 240, 999), 2)
  assert.equal(Stage.autoStageIndex(stages, barPlan, 999999, 16), 2)
})

test("normalizedAdvance defaults an unspecified plan to time mode with sane defaults", () => {
  const normalized = Stage.normalizedAdvance(null)
  assert.equal(normalized.mode, "time")
  assert.equal(normalized.everySeconds, 120)
  assert.equal(normalized.everyBars, 8)
})

test("stageStartElapsedSeconds/stageStartBars rebase a manual jump so auto progression resumes naturally", () => {
  assert.equal(Stage.stageStartElapsedSeconds(timePlan, 2), 240)
  assert.equal(Stage.stageIndexAtElapsedSeconds(stages, timePlan, Stage.stageStartElapsedSeconds(timePlan, 3)), 3)
  assert.equal(Stage.stageStartBars(barPlan, 2), 16)
  assert.equal(Stage.stageIndexAtCompletedBars(stages, barPlan, Stage.stageStartBars(barPlan, 3)), 3)
})

test("stageSecondsRemaining counts down within the current stage and is null for bar-mode plans", () => {
  assert.equal(Stage.stageSecondsRemaining(stages, timePlan, 0), 120)
  assert.equal(Stage.stageSecondsRemaining(stages, timePlan, 90), 30)
  assert.equal(Stage.stageSecondsRemaining(stages, timePlan, 120), 120)
  assert.equal(Stage.stageSecondsRemaining(stages, barPlan, 90), null)
})

test("stageBarsRemaining counts down within the current stage and is null for time-mode plans", () => {
  assert.equal(Stage.stageBarsRemaining(stages, barPlan, 0), 8)
  assert.equal(Stage.stageBarsRemaining(stages, barPlan, 5), 3)
  assert.equal(Stage.stageBarsRemaining(stages, timePlan, 5), null)
})

test("totalDurationSeconds/totalBars reflect the plan's own mode only", () => {
  assert.equal(Stage.totalDurationSeconds(stages, timePlan), 600)
  assert.equal(Stage.totalDurationSeconds(stages, barPlan), null)
  assert.equal(Stage.totalBars(stages, barPlan), 40)
  assert.equal(Stage.totalBars(stages, timePlan), null)
})

test("clampIndex and isLastStage handle out-of-range and empty inputs safely", () => {
  assert.equal(Stage.clampIndex(stages, -3), 0)
  assert.equal(Stage.clampIndex(stages, 99), 4)
  assert.equal(Stage.clampIndex([], 2), 0)
  assert.equal(Stage.isLastStage(stages, 4), true)
  assert.equal(Stage.isLastStage(stages, 0), false)
  assert.equal(Stage.isLastStage([], 0), true)
})

test("stageAt returns the clamped stage object or null for an empty list", () => {
  assert.equal(Stage.stageAt(stages, 1), "Box 2")
  assert.equal(Stage.stageAt(stages, 999), "Box 5")
  assert.equal(Stage.stageAt([], 0), null)
})

// ------------------------------------------------------------ looping variants (v0.5, Jam Sessions)

test("loopedStageIndexAtCompletedBars wraps back to 0 instead of holding at the last stage", () => {
  const barPlan3 = { mode: "bars", everyBars: 4 }
  const three = ["I", "IV", "V"]
  assert.equal(Stage.loopedStageIndexAtCompletedBars(three, barPlan3, 0), 0)
  assert.equal(Stage.loopedStageIndexAtCompletedBars(three, barPlan3, 3), 0)
  assert.equal(Stage.loopedStageIndexAtCompletedBars(three, barPlan3, 8), 2)
  assert.equal(Stage.loopedStageIndexAtCompletedBars(three, barPlan3, 12), 0) // one full cycle, wraps
  assert.equal(Stage.loopedStageIndexAtCompletedBars(three, barPlan3, 20), 2) // into the second cycle
})

test("loopedStageIndexAtElapsedSeconds wraps the same way in time mode", () => {
  const timePlan2 = { mode: "time", everySeconds: 60 }
  const two = ["A", "B"]
  assert.equal(Stage.loopedStageIndexAtElapsedSeconds(two, timePlan2, 0), 0)
  assert.equal(Stage.loopedStageIndexAtElapsedSeconds(two, timePlan2, 65), 1)
  assert.equal(Stage.loopedStageIndexAtElapsedSeconds(two, timePlan2, 125), 0) // wraps after 2 stages
})

test("loopedAutoStageIndex dispatches on mode exactly like autoStageIndex", () => {
  const barPlan3 = { mode: "bars", everyBars: 4 }
  const three = ["I", "IV", "V"]
  assert.equal(Stage.loopedAutoStageIndex(three, barPlan3, 999999, 20), 2)
})

test("completedCycles counts full passes through the sequence", () => {
  const barPlan3 = { mode: "bars", everyBars: 4 }
  const three = ["I", "IV", "V"]
  assert.equal(Stage.completedCycles(three, barPlan3, 0, 0), 0)
  assert.equal(Stage.completedCycles(three, barPlan3, 0, 11), 0)
  assert.equal(Stage.completedCycles(three, barPlan3, 0, 12), 1)
  assert.equal(Stage.completedCycles(three, barPlan3, 0, 25), 2)
  assert.equal(Stage.completedCycles([], barPlan3, 0, 100), 0)
})

test("loopedStageBarsRemaining counts down within the current stage across cycle boundaries", () => {
  const barPlan3 = { mode: "bars", everyBars: 4 }
  const three = ["I", "IV", "V"]
  assert.equal(Stage.loopedStageBarsRemaining(three, barPlan3, 0), 4)
  assert.equal(Stage.loopedStageBarsRemaining(three, barPlan3, 11), 1)
  assert.equal(Stage.loopedStageBarsRemaining(three, barPlan3, 12), 4) // freshly wrapped to stage 0
  assert.equal(Stage.loopedStageBarsRemaining(three, barPlan3, 23), 1)
})

test("loopedStageSecondsRemaining counts down within the current stage across cycle boundaries", () => {
  const timePlan2 = { mode: "time", everySeconds: 60 }
  const two = ["A", "B"]
  assert.equal(Stage.loopedStageSecondsRemaining(two, timePlan2, 0), 60)
  assert.equal(Stage.loopedStageSecondsRemaining(two, timePlan2, 90), 30)
  assert.equal(Stage.loopedStageSecondsRemaining(two, timePlan2, 120), 60) // wrapped to stage 0 of cycle 2
})
