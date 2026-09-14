import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Storage = loadQmlJs(new URL("../js/storage.js", import.meta.url))

test("decodes an empty/missing payload into safe defaults", () => {
  const result = Storage.decode("")
  assert.equal(result.ok, true)
  assert.equal(result.value.schemaVersion, 1)
  assert.equal(result.value.preferences.a4, 440)
  assert.equal(result.value.preferences.routineSource, "presets")
  assert.equal(result.value.preferences.routineCategory, "All")
  assert.equal(result.value.routines.length, 0)
})

test("round-trips a well-formed state object", () => {
  const state = {
    schemaVersion: 1,
    preferences: { a4: 442, defaultTuningId: "drop_d", metronomeVolume: 0.5, lastTimeSignatureId: "3-4", lastSubdivisionId: "eighth", tunerInputDevice: "mic-1", tunerSensitivity: "noisy_room" },
    customTunings: [{ id: "custom-1", name: "Weird", notes: ["E2", "A2", "D3", "G3", "B3", "E4"] }],
    routines: [{ id: "r1", name: "Warmup", items: [] }],
    exercises: [{ id: "e1", name: "Chromatic" }],
    songs: [{ id: "s1", title: "Song", artist: "Band" }],
    sessions: [{ startedAt: 1000, durationMinutes: 10 }],
    exerciseProgress: { e1: { bestBpm: 100, goalBpm: 120, history: [{ at: 1, bpm: 90, outcome: "clean" }] } }
  }
  const encoded = Storage.encode(state)
  const result = Storage.decode(encoded)
  assert.equal(result.ok, true)
  assert.equal(result.migrated, false)
  assert.equal(result.value.preferences.a4, 442)
  assert.equal(result.value.preferences.tunerSensitivity, "noisy_room")
  assert.equal(result.value.customTunings.length, 1)
  assert.equal(result.value.routines[0].name, "Warmup")
  assert.equal(result.value.sessions[0].durationMinutes, 10)
  assert.equal(result.value.exerciseProgress.e1.bestBpm, 100)
})

test("treats invalid JSON as a decode failure without throwing", () => {
  const result = Storage.decode("{not valid json")
  assert.equal(result.ok, false)
  assert.ok(result.error)
  // Caller still gets a usable default value to fall back to.
  assert.equal(result.value.schemaVersion, 1)
})

test("drops malformed entries instead of failing the whole file", () => {
  const raw = JSON.stringify({
    schemaVersion: 1,
    routines: [{ id: "ok", name: "Good", items: [] }, { name: "missing id" }, "not an object"],
    sessions: [{ startedAt: 5, durationMinutes: 1 }, { durationMinutes: 1 }, null],
    customTunings: [{ id: "t1", notes: ["E2"] }, { id: "t2", notes: [] }]
  })
  const result = Storage.decode(raw)
  assert.equal(result.ok, true)
  assert.equal(result.value.routines.length, 1)
  assert.equal(result.value.sessions.length, 1)
  assert.equal(result.value.customTunings.length, 1)
})

test("fills in missing top-level keys from an older/partial payload", () => {
  const raw = JSON.stringify({ schemaVersion: 1, preferences: { a4: 432 } })
  const result = Storage.decode(raw)
  assert.equal(result.value.preferences.a4, 432)
  assert.equal(result.value.preferences.defaultTuningId, "standard") // filled from defaults
  assert.ok(Array.isArray(result.value.routines))
  assert.ok(Array.isArray(result.value.sessions))
})

test("defaults tuner sensitivity to normal for a v0.3.0 file that predates the setting", () => {
  const raw = JSON.stringify({ schemaVersion: 1, preferences: { a4: 440, defaultTuningId: "standard" } })
  const result = Storage.decode(raw)
  assert.equal(result.value.preferences.tunerSensitivity, "normal")
})

test("rejects an unrecognized tuner sensitivity value", () => {
  const raw = JSON.stringify({ schemaVersion: 1, preferences: { tunerSensitivity: "extremely_loud" } })
  const result = Storage.decode(raw)
  assert.equal(result.value.preferences.tunerSensitivity, "normal")
})

test("sanitizes and preserves routine selector preferences", () => {
  const valid = Storage.decode(JSON.stringify({ schemaVersion: 1, preferences: {
    routineSource: "mine", routineCategory: "Scales", routinePresetId: "preset-1", routineUserId: "routine-1"
  }})).value.preferences
  assert.deepEqual({ source: valid.routineSource, category: valid.routineCategory,
    preset: valid.routinePresetId, user: valid.routineUserId },
  { source: "mine", category: "Scales", preset: "preset-1", user: "routine-1" })
  const invalid = Storage.decode(JSON.stringify({ schemaVersion: 1, preferences: {
    routineSource: "unknown", routineCategory: 42, routinePresetId: null, routineUserId: false
  }})).value.preferences
  assert.deepEqual({ source: invalid.routineSource, category: invalid.routineCategory,
    preset: invalid.routinePresetId, user: invalid.routineUserId },
  { source: "presets", category: "All", preset: "", user: "" })
})

test("marks a schemaVersion-less payload as migrated", () => {
  const raw = JSON.stringify({ routines: [] })
  const result = Storage.decode(raw)
  assert.equal(result.ok, true)
  assert.equal(result.migrated, true)
  assert.equal(result.value.schemaVersion, 1)
})

test("round-trips a song's lyrics and lyrics URL unchanged (schema-free, additive fields)", () => {
  // Title/artist/lyrics are a fully synthetic example (no real song is
  // named or quoted anywhere in this repository) - see docs/MUSIC_CONTENT_AUDIT.md.
  const state = {
    schemaVersion: 1,
    songs: [{
      id: "s1", title: "Midnight Harbour", artist: "Northbound Signal", tuning: "standard", key: "F# minor",
      originalBpm: 87, currentBpm: 87, targetBpm: 87,
      notes: "Capo 2nd fret",
      lyrics: "(placeholder verse one)\n(placeholder verse two)",
      lyricsUrl: "https://example.com/lyrics/midnight-harbour"
    }]
  }
  const result = Storage.decode(Storage.encode(state))
  assert.equal(result.ok, true)
  assert.equal(result.value.songs.length, 1)
  assert.equal(result.value.songs[0].lyrics, state.songs[0].lyrics)
  assert.equal(result.value.songs[0].lyricsUrl, state.songs[0].lyricsUrl)
  assert.equal(result.value.songs[0].notes, "Capo 2nd fret")
})

test("loads a pre-lyrics song file with no migration needed (additive fields simply absent)", () => {
  const raw = JSON.stringify({
    schemaVersion: 1,
    songs: [{ id: "old-song", title: "Legacy Song", artist: "Someone", originalBpm: 100, currentBpm: 100 }]
  })
  const result = Storage.decode(raw)
  assert.equal(result.ok, true)
  assert.equal(result.migrated, false)
  assert.equal(result.value.songs.length, 1)
  assert.equal(result.value.songs[0].title, "Legacy Song")
  assert.equal(result.value.songs[0].lyrics, undefined)
  assert.equal(result.value.songs[0].lyricsUrl, undefined)
})

test("clamps out-of-range preference values", () => {
  const raw = JSON.stringify({ schemaVersion: 1, preferences: { a4: -10, metronomeVolume: 5 } })
  const result = Storage.decode(raw)
  assert.equal(result.value.preferences.a4, 440) // invalid, falls back to default
  assert.equal(result.value.preferences.metronomeVolume, 1) // clamped
})
