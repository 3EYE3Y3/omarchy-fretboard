import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Progress = loadQmlJs(new URL("../js/progress.js", import.meta.url))

test("matches the spec's worked example for a clean outcome", () => {
  const result = Progress.suggestNextBpm(100, "Clean")
  assert.equal(result.min, 102)
  assert.equal(result.max, 105)
  assert.equal(result.recommended, 102)
})

test("keeps roughly the same tempo for a nearly outcome", () => {
  const result = Progress.suggestNextBpm(100, "Nearly")
  assert.equal(result.recommended, 100)
  assert.equal(result.min, 98)
  assert.equal(result.max, 102)
})

test("reduces tempo for a needs-work outcome", () => {
  const result = Progress.suggestNextBpm(100, "Needs Work")
  assert.ok(result.recommended < 100)
  assert.ok(result.max <= 100)
})

test("normalizes outcome casing/spacing and clamps to the BPM range", () => {
  const a = Progress.suggestNextBpm(298, "clean")
  assert.equal(a.max, 300)
  const b = Progress.suggestNextBpm(31, "needs_work")
  assert.ok(b.recommended >= 30)
})

test("computes practice minutes today and this week", () => {
  const now = new Date(2026, 8, 12, 18, 0, 0).getTime() // Saturday
  const sessions = [
    { startedAt: new Date(2026, 8, 12, 8, 0, 0).getTime(), durationMinutes: 20 },
    { startedAt: new Date(2026, 8, 11, 8, 0, 0).getTime(), durationMinutes: 15 },
    { startedAt: new Date(2026, 8, 1, 8, 0, 0).getTime(), durationMinutes: 60 } // outside this week
  ]
  assert.equal(Progress.minutesToday(sessions, now), 20)
  assert.equal(Progress.minutesThisWeek(sessions, now), 35)
  assert.equal(Progress.sessionsThisWeek(sessions, now), 2)
  assert.equal(Progress.totalPracticeMinutes(sessions), 95)
})

test("computes a current streak across consecutive practice days", () => {
  const day = 86400000
  const now = Date.UTC(2026, 8, 12, 12, 0, 0)
  const sessions = [
    { startedAt: now, durationMinutes: 10 },
    { startedAt: now - day, durationMinutes: 10 },
    { startedAt: now - 2 * day, durationMinutes: 10 },
    { startedAt: now - 4 * day, durationMinutes: 10 } // gap breaks the streak
  ]
  assert.equal(Progress.currentStreak(sessions, now), 3)
})

test("streak counts from yesterday when today has no session yet", () => {
  const day = 86400000
  const now = Date.UTC(2026, 8, 12, 8, 0, 0)
  const sessions = [{ startedAt: now - day, durationMinutes: 10 }]
  assert.equal(Progress.currentStreak(sessions, now), 1)
})

test("streak is zero with no recent sessions", () => {
  assert.equal(Progress.currentStreak([], Date.now()), 0)
})

test("computes BPM improvement from progress snapshots", () => {
  const entries = [
    { at: 3, bestBpm: 110 },
    { at: 1, bestBpm: 90 },
    { at: 2, bestBpm: 100 }
  ]
  assert.equal(Progress.bpmImprovement(entries), 20)
  assert.equal(Progress.bpmImprovement([]), 0)
})
