import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Presets = loadQmlJs(new URL("../js/presets.js", import.meta.url))
const Routines = loadQmlJs(new URL("../js/routines.js", import.meta.url))
const Stage = loadQmlJs(new URL("../js/stage_engine.js", import.meta.url))
const Visual = loadQmlJs(new URL("../js/visual_shapes.js", import.meta.url))

const ALL = Array.from(Presets.PRESET_ROUTINES)
const DYNAMIC = ALL.filter((p) => Routines.hasStages(p.items[0]))
const HYBRID = ALL.filter((p) => p.id.startsWith("preset-hybrid-"))

test("exactly the 9 v0.4 dynamic/staged routines are present, one item each", () => {
  assert.equal(DYNAMIC.length, 9)
  for (const p of DYNAMIC) assert.equal(p.items.length, 1, `${p.id} should stay a single stageable item`)
})

test("every dynamic preset's base item has a full static-item shape (label/notes/targetBpm/metronome)", () => {
  // A dynamic item must remain independently previewable/completable exactly
  // like a static item - resolveStageItem only overlays stage 0+ on request.
  for (const p of DYNAMIC) {
    const item = p.items[0]
    assert.ok(item.notes.trim().length > 0, `${p.id}: missing base instructions`)
    assert.ok(item.targetBpm >= 30 && item.targetBpm <= 300, `${p.id}: invalid base BPM`)
    assert.ok(item.metronome, `${p.id}: missing base metronome configuration`)
    assert.ok(item.visualAid, `${p.id}: missing base visual (used for the unstarted preview)`)
  }
})

test("every dynamic preset's durationMinutes exactly covers its stage sequence", () => {
  for (const p of DYNAMIC) {
    const item = p.items[0]
    const totalSeconds = Stage.totalDurationSeconds(item.stages, item.advance)
    if (totalSeconds === null) continue // bar-based plans have no fixed duration
    assert.equal(item.durationMinutes * 60, totalSeconds,
      `${p.id}: durationMinutes must exactly cover ${item.stages.length} stages at ${item.advance.everySeconds}s each`)
  }
})

test("every stage of every dynamic preset resolves to a valid, in-range visual", () => {
  const supported = new Set(Array.from(Visual.MODES))
  for (const p of DYNAMIC) {
    const item = p.items[0]
    for (let i = 0; i < item.stages.length; i++) {
      const resolved = Routines.resolveStageItem(item, i)
      assert.ok(resolved.label, `${p.id} stage ${i}: missing label`)
      assert.ok(resolved.visualAid, `${p.id} stage ${i}: missing visual`)
      assert.ok(supported.has(resolved.visualAid.mode), `${p.id} stage ${i}: unsupported visual mode`)
      if (resolved.visualAid.positions) {
        for (const [s, f] of resolved.visualAid.positions)
          assert.ok(Number.isInteger(s) && s >= 0 && s < 6 && Number.isInteger(f) && f >= 0 && f <= 24,
            `${p.id} stage ${i}: out-of-range coordinate`)
      }
      // Every stage must itself round-trip back to a non-dynamic resolved item.
      assert.equal(resolved.stages, null)
      assert.equal(resolved.advance, null)
    }
  }
})

test("Minor Pentatonic — All 5 Boxes steps through verified Box 1-5 in order, same key throughout", () => {
  const item = Presets.presetById("preset-dynamic-pentatonic-all-boxes").items[0]
  assert.equal(item.stages.length, 5)
  for (let i = 0; i < 5; i++) {
    const resolved = Routines.resolveStageItem(item, i)
    assert.equal(resolved.visualAid.mode, "PENTATONIC_BOX")
    assert.equal(resolved.visualAid.box, i + 1)
    assert.equal(resolved.scaleKey.key, "A")
    assert.equal(resolved.scaleKey.scaleId, "minor_pentatonic")
  }
})

test("Pentatonic Boxes — Ascending/Descending walks 1-2-3-4-5-4-3-2-1", () => {
  const item = Presets.presetById("preset-dynamic-pentatonic-updown").items[0]
  const boxes = Array.from(item.stages, (_, i) => Routines.resolveStageItem(item, i).visualAid.box)
  assert.deepEqual(boxes, [1, 2, 3, 4, 5, 4, 3, 2, 1])
})

test("Triad Inversion Ladder covers root/1st/2nd inversion with verified G major coordinates", () => {
  const item = Presets.presetById("preset-dynamic-triad-inversions").items[0]
  assert.equal(item.stages.length, 3)
  const positions = Array.from(item.stages, (_, i) => Array.from(Routines.resolveStageItem(item, i).visualAid.positions, (p) => Array.from(p)))
  assert.deepEqual(positions, [
    [[3, 12], [4, 12], [5, 10]],
    [[3, 4], [4, 3], [5, 3]],
    [[3, 7], [4, 8], [5, 7]]
  ])
})

test("Triad String-Set Ladder covers all four standard-tuning string sets with one fixed C major triad", () => {
  const item = Presets.presetById("preset-dynamic-triad-string-sets").items[0]
  assert.equal(item.stages.length, 4)
  const positions = Array.from(item.stages, (_, i) => Array.from(Routines.resolveStageItem(item, i).visualAid.positions, (p) => Array.from(p)))
  assert.deepEqual(positions, [
    [[3, 5], [4, 5], [5, 3]],
    [[2, 10], [3, 9], [4, 8]],
    [[1, 3], [2, 2], [3, 0]],
    [[0, 8], [1, 7], [2, 5]]
  ])
})

test("Picking Subdivision Ladder changes only subdivisionId per stage, BPM held constant", () => {
  const item = Presets.presetById("preset-dynamic-subdivision-ladder").items[0]
  const subdivisions = Array.from(item.stages, (_, i) => Routines.resolveStageItem(item, i).metronome.subdivisionId)
  assert.deepEqual(subdivisions, ["eighth", "triplet", "sixteenth"])
  for (let i = 0; i < item.stages.length; i++) {
    const resolved = Routines.resolveStageItem(item, i)
    assert.equal(resolved.metronome.timeSignatureId, "4-4") // inherited, unchanged
    assert.equal(resolved.targetBpm, item.targetBpm) // no stage overrides BPM here
  }
})

test("Tempo Ladder steps 80 to 100 BPM in five clean 5 BPM increments", () => {
  const item = Presets.presetById("preset-dynamic-tempo-ladder").items[0]
  const bpms = Array.from(item.stages, (_, i) => Routines.resolveStageItem(item, i).targetBpm)
  assert.deepEqual(bpms, [80, 85, 90, 95, 100])
})

test("dynamic hybrid-picking routines demonstrate the same generic engine, not pentatonic-specific logic", () => {
  const triadCycle = Presets.presetById("preset-hybrid-dynamic-triad-cycle").items[0]
  assert.equal(triadCycle.stages.length, 3)
  const pentatonic = Presets.presetById("preset-hybrid-dynamic-pentatonic").items[0]
  assert.equal(pentatonic.stages.length, 5)
  const stringSets = Presets.presetById("preset-hybrid-dynamic-string-sets").items[0]
  assert.equal(stringSets.stages.length, 4)
  for (const item of [triadCycle, pentatonic, stringSets]) {
    for (let i = 0; i < item.stages.length; i++) {
      const resolved = Routines.resolveStageItem(item, i)
      assert.equal(resolved.visualAid.mode, "PICKING_PATTERN")
    }
  }
})

test("every hybrid-picking routine (static and dynamic) uses only documented P/M/R right-hand labels", () => {
  // Scoped to preset-hybrid-* only: PICKING_PATTERN is also used elsewhere
  // (e.g. plain alternate-picking direction arrows) for non-hybrid technique
  // content, which intentionally uses a different label vocabulary.
  const validRoles = new Set(["P", "M", "R"])
  for (const p of HYBRID) {
    for (const item of p.items) {
      const aids = Routines.hasStages(item)
        ? Array.from(item.stages, (_, i) => Routines.resolveStageItem(item, i).visualAid)
        : [item.visualAid]
      for (const aid of aids) {
        assert.equal(aid.mode, "PICKING_PATTERN", `${p.id}: expected a hybrid-picking visual`)
        for (const role of new Set(Array.from(aid.steps, (s) => s.label)))
          assert.ok(validRoles.has(role), `${p.id}: unexpected hand-role label "${role}"`)
      }
    }
  }
})

test("8 static hybrid-picking Technique routines are present, each with a meaningful positional visual", () => {
  const staticHybrid = HYBRID.filter((p) => !Routines.hasStages(p.items[0]))
  assert.equal(staticHybrid.length, 8)
  for (const p of staticHybrid) {
    assert.equal(p.category, "Technique")
    const aid = p.items[0].visualAid
    assert.equal(aid.mode, "PICKING_PATTERN")
    assert.ok(aid.positions.length >= 3, `${p.id}: too few positions for a meaningful visual`)
    assert.equal(aid.positions.length, aid.steps.length, `${p.id}: positions/steps length mismatch`)
  }
})

test("hybrid-picking double-stop dyads (thirds, sixths) pair P with the lower string and M with the upper string", () => {
  for (const id of ["preset-hybrid-thirds", "preset-hybrid-sixths"]) {
    const aid = Presets.presetById(id).items[0].visualAid
    for (let i = 0; i + 1 < aid.positions.length; i += 2) {
      const [lowerString] = aid.positions[i]
      const [upperString] = aid.positions[i + 1]
      assert.ok(lowerString < upperString, `${id} dyad ${i / 2}: expected a lower-numbered (bass) string first`)
      assert.equal(aid.steps[i].label, "P")
      assert.equal(aid.steps[i + 1].label, "M")
    }
  }
})
