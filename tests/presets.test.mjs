import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Presets = loadQmlJs(new URL("../js/presets.js", import.meta.url))
const Theory = loadQmlJs(new URL("../js/theory.js", import.meta.url))
const Routines = loadQmlJs(new URL("../js/routines.js", import.meta.url))
const Tunings = loadQmlJs(new URL("../js/tunings.js", import.meta.url))

const ALL = Array.from(Presets.PRESET_ROUTINES)
const SCALE_IDS = Array.from(Theory.SCALES).map((s) => s.id)
const CHORD_IDS = Array.from(Theory.CHORDS).map((c) => c.id)
const VALID_NOTE = /^[A-G](#|b)?$/

test("ships a curated bank across all seven required categories", () => {
  const categories = Array.from(Presets.PRESET_CATEGORIES)
  assert.deepEqual(categories, ["Warmups", "Scales", "Scale Patterns", "Triads", "Chords", "Technique", "Rhythm"])
  const present = new Set(ALL.map((p) => p.category))
  for (const category of categories) assert.ok(present.has(category), `no presets in category ${category}`)
})

test("is a sensible curated size, not empty and not hundreds", () => {
  // 40 v0.3.5 presets + 17 v0.4 additions (9 dynamic/staged routines, 8
  // hybrid-picking technique routines) - every audited preset must stay
  // represented.
  assert.equal(ALL.length, 57, "every audited built-in preset must stay represented")
  assert.ok(ALL.length >= 20, `expected a real curated bank, got ${ALL.length}`)
  assert.ok(ALL.length <= 70, `expected a curated bank, not hundreds, got ${ALL.length}`)
})

test("every audited preset item has actionable timing and instruction content", () => {
  const meters = new Set(["2-4","3-4","4-4","5-4","6-8","7-8","9-8","12-8"])
  const subdivisions = new Set(["quarter","eighth","triplet","sixteenth"])
  for (const preset of ALL) for (const item of preset.items) {
    assert.ok(item.notes.trim().length > 0, `${preset.id}: missing instructions`)
    assert.ok(item.durationMinutes > 0, `${preset.id}: invalid duration`)
    assert.ok(item.targetBpm >= 30 && item.targetBpm <= 300, `${preset.id}: invalid BPM`)
    assert.ok(item.metronome, `${preset.id}: missing metronome configuration`)
    assert.ok(meters.has(item.metronome.timeSignatureId), `${preset.id}: invalid meter`)
    assert.ok(subdivisions.has(item.metronome.subdivisionId), `${preset.id}: invalid subdivision`)
  }
})

test("every preset has a unique, stable id and is flagged as a preset", () => {
  const ids = ALL.map((p) => p.id)
  assert.equal(new Set(ids).size, ids.length, "duplicate preset ids")
  for (const p of ALL) {
    assert.ok(p.id.startsWith("preset-"), `preset id should be namespaced: ${p.id}`)
    assert.equal(p.preset, true)
    assert.ok(p.items.length > 0, `${p.id} has no items`)
  }
})

test("presetById and presetsByCategory resolve correctly", () => {
  const first = ALL[0]
  assert.equal(Presets.presetById(first.id).name, first.name)
  assert.equal(Presets.presetById("does-not-exist"), null)
  for (const category of Presets.PRESET_CATEGORIES) {
    const inCategory = Presets.presetsByCategory(category)
    assert.ok(Array.from(inCategory).every((p) => p.category === category))
  }
})

test("every scaleKey/chordKey references a real scale/chord id and a valid note name", () => {
  for (const p of ALL) {
    for (const item of p.items) {
      if (item.scaleKey) {
        assert.ok(SCALE_IDS.includes(item.scaleKey.scaleId), `${p.id}: unknown scaleId ${item.scaleKey.scaleId}`)
        assert.match(item.scaleKey.key, VALID_NOTE, `${p.id}: invalid key ${item.scaleKey.key}`)
      }
      if (item.chordKey) {
        assert.ok(CHORD_IDS.includes(item.chordKey.chordId), `${p.id}: unknown chordId ${item.chordKey.chordId}`)
        assert.match(item.chordKey.key, VALID_NOTE, `${p.id}: invalid key ${item.chordKey.key}`)
      }
    }
  }
})

test("every item shape matches what js/routines.js's createItem produces (no drift)", () => {
  const expectedKeys = Object.keys(Routines.createItem({})).sort()
  for (const p of ALL) {
    for (const item of p.items) {
      assert.deepEqual(Object.keys(item).sort(), expectedKeys, `${p.id} item shape drifted from routines.js`)
    }
  }
})

test("a diatonic-triads-style progression produces one item per chord in order", () => {
  const diatonic = Presets.presetById("preset-triad-diatonic-major-key")
  assert.equal(diatonic.items.length, 7)
  assert.equal(diatonic.items[0].label.indexOf("I -"), 0)
})

test("duplicating a preset into a user routine clears the preset flag and never mutates the source", () => {
  const source = Presets.presetById("preset-warmup-chromatic")
  const before = JSON.stringify(source)
  const copy = Routines.duplicateRoutine(source)

  assert.notEqual(copy.id, source.id)
  assert.equal(copy.preset, false)
  assert.equal(copy.name, source.name + " Copy")
  assert.equal(copy.items.length, source.items.length)
  assert.notEqual(copy.items[0].id, source.items[0].id)
  assert.equal(copy.items[0].label, source.items[0].label)

  // The built-in template itself must be untouched by the copy.
  assert.equal(JSON.stringify(source), before)
  assert.equal(source.preset, true)
})

test("duplicating a multi-item chord-progression preset preserves every chord", () => {
  const source = Presets.presetById("preset-chord-i-v-vi-iv")
  const copy = Routines.duplicateRoutine(source)
  assert.equal(copy.items.length, 4)
  for (let i = 0; i < copy.items.length; i++) {
    assert.equal(copy.items[i].chordKey.key, source.items[i].chordKey.key)
    assert.equal(copy.items[i].chordKey.chordId, source.items[i].chordKey.chordId)
  }
})

test("presets that name a tuning-independent key stick to standard 12-tone note names", () => {
  // Sanity check that degreeRoot()-derived keys used in progressions are
  // real notes findable in a real tuning (regression guard for the roman
  // numeral -> root-note math).
  const standard = Tunings.builtinTuningById("standard")
  assert.ok(standard.notes.length === 6)
  const progression = Presets.presetById("preset-chord-i-iv-v")
  for (const item of progression.items) assert.match(item.chordKey.key, VALID_NOTE)
})
