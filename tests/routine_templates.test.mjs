import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Presets = loadQmlJs(new URL("../js/presets.js", import.meta.url))
const Visual = loadQmlJs(new URL("../js/visual_shapes.js", import.meta.url))

// ------------------------------------------------------------ configurable scale templates (v0.5)

test("ships 7 configurable scale templates, boxed positions limited to audited pentatonic shapes", () => {
  const templates = Array.from(Presets.SCALE_TEMPLATES)
  assert.equal(templates.length, 7)
  const boxed = templates.filter((t) => t.positions.includes("box1"))
  assert.deepEqual(boxed.map((t) => t.id), ["template-minor-pentatonic"])
  for (const t of templates) assert.ok(t.positions.includes("all"), `${t.id} must always offer "all"`)
})

test("resolveScaleTemplate transposes key correctly and defaults to full-fretboard", () => {
  const item = Presets.resolveScaleTemplate("template-minor-pentatonic", { key: "E" })
  assert.equal(item.scaleKey.key, "E")
  assert.equal(item.scaleKey.scaleId, "minor_pentatonic")
  assert.equal(item.visualAid.mode, "FULL_FRETBOARD_SCALE")
})

test("resolveScaleTemplate selects an exact verified box by position id", () => {
  const item = Presets.resolveScaleTemplate("template-minor-pentatonic", { key: "D", position: "box4" })
  assert.equal(item.visualAid.mode, "PENTATONIC_BOX")
  assert.equal(item.visualAid.box, 4)
  assert.ok(item.label.includes("Box 4"))
})

test("resolveScaleTemplate with dynamic:true builds a 5-stage Box 1-5 sequence and matching duration", () => {
  const item = Presets.resolveScaleTemplate("template-minor-pentatonic", { key: "G", dynamic: true, dynamicEverySeconds: 30 })
  assert.equal(item.stages.length, 5)
  assert.deepEqual(Array.from(item.stages, (s) => s.visualAid.box), [1, 2, 3, 4, 5])
  assert.equal(item.advance.everySeconds, 30)
  assert.equal(item.durationMinutes, 5 * 30 / 60)
})

test("resolveScaleTemplate ignores dynamic for a template with no boxed positions", () => {
  const item = Presets.resolveScaleTemplate("template-blues-scale", { key: "A", dynamic: true })
  assert.equal(item.stages, null)
  assert.equal(item.visualAid.mode, "FULL_FRETBOARD_SCALE")
})

test("resolveScaleTemplate returns null for an unknown template id", () => {
  assert.equal(Presets.resolveScaleTemplate("does-not-exist", {}), null)
})

test("every scale-template item shape matches js/routines.js's createItem (no drift)", () => {
  const Routines = loadQmlJs(new URL("../js/routines.js", import.meta.url))
  const expectedKeys = Object.keys(Routines.createItem({})).sort()
  for (const t of Presets.SCALE_TEMPLATES) {
    const item = Presets.resolveScaleTemplate(t.id, { key: t.defaultKey })
    assert.deepEqual(Object.keys(item).sort(), expectedKeys, `${t.id} item shape drifted`)
  }
})

// ------------------------------------------------------------ configurable hybrid-pentatonic template

test("resolveHybridPentatonicTemplate produces a PICKING_PATTERN with only P/M roles", () => {
  const item = Presets.resolveHybridPentatonicTemplate({ key: "B", position: "box2" })
  assert.equal(item.visualAid.mode, "PICKING_PATTERN")
  const roles = new Set(Array.from(item.visualAid.steps, (s) => s.label))
  assert.deepEqual(Array.from(roles).sort(), ["M", "P"])
  assert.equal(item.visualAid.positions.length, 12)
})

test("resolveHybridPentatonicTemplate dynamic mode builds 5 stages, one per box", () => {
  const item = Presets.resolveHybridPentatonicTemplate({ key: "C", dynamic: true, dynamicEverySeconds: 45 })
  assert.equal(item.stages.length, 5)
  assert.equal(item.advance.everySeconds, 45)
})

// ------------------------------------------------------------ triad configuration descriptors (v0.5)
// Full resolution (needs VisualShapes.triadShapes) lives in Service.qml; these
// check the shared descriptor lists Service.qml and the UI both rely on.

test("triad descriptor lists match VisualShapes' own supported qualities/string sets", () => {
  assert.deepEqual(Array.from(Presets.TRIAD_QUALITIES), ["major", "minor", "diminished", "augmented"])
  for (const quality of Presets.TRIAD_QUALITIES) assert.ok(Visual.TRIAD_INTERVALS[quality], `unknown quality ${quality}`)
  assert.deepEqual(Array.from(Presets.TRIAD_STRING_SET_IDS), ["all", "123", "234", "345", "456"])
  for (const id of Presets.TRIAD_STRING_SET_IDS) if (id !== "all") assert.ok(Visual.TRIAD_STRING_SETS[id], `unknown string set ${id}`)
})

test("ships all 12 chromatic triad roots", () => {
  assert.equal(Presets.TRIAD_ROOTS.length, 12)
  assert.equal(new Set(Array.from(Presets.TRIAD_ROOTS)).size, 12)
})

test("triadInversionLabel/triadStringSetLabel produce a human label for every valid id", () => {
  for (const id of Presets.TRIAD_INVERSION_IDS) assert.ok(Presets.triadInversionLabel(id).length > 0)
  for (const id of Presets.TRIAD_STRING_SET_IDS) assert.ok(Presets.triadStringSetLabel(id).length > 0)
})
