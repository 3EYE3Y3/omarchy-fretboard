import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Theory = loadQmlJs(new URL("../js/theory.js", import.meta.url))
const Fretboard = loadQmlJs(new URL("../js/fretboard.js", import.meta.url))
const Visual = loadQmlJs(new URL("../js/visual_shapes.js", import.meta.url))
const Presets = loadQmlJs(new URL("../js/presets.js", import.meta.url))
const Browser = loadQmlJs(new URL("../js/preset_browser.js", import.meta.url))
const STANDARD = ["E2", "A2", "D3", "G3", "B3", "E4"]
const tuples = (value) => Array.from(value, (p) => Array.from(p))

test("fixed 0-12 reference highlights all five verified A-minor boxes without hiding scale context", () => {
  const scale = Theory.buildScale("A", "minor_pentatonic")
  const set = Theory.pitchClassSet(scale.notes)
  const base = Fretboard.buildFretboard(STANDARD, 24)
  const expectedRoots = [[0,5],[1,0],[1,12],[2,7],[3,2],[4,10],[5,5]]
  for (let box = 1; box <= 5; box++) {
    const positions = Visual.positionsInRange({ mode: Visual.PENTATONIC_BOX, box }, 9, 0, 12)
    assert.equal(positions.length, 12, `box ${box} coordinate count`)
    assert.ok(positions.every(([s,f]) => s >= 0 && s < 6 && f >= 0 && f <= 12), `box ${box} in range`)
    const board = Visual.highlightContext(base, set, 9, positions, [])
    const emphasized = []
    const roots = []
    for (let s = 0; s < 6; s++) for (let f = 0; f <= 12; f++) {
      const cell = board.strings[s][f]
      assert.equal(cell.highlighted, !!set[cell.pitchClass], `box ${box} context S${6-s}f${f}`)
      if (cell.isEmphasized) emphasized.push([s,f])
      if (cell.isRoot) roots.push([s,f])
    }
    assert.deepEqual(tuples(emphasized), tuples(positions).sort((a,b) => a[0]-b[0] || a[1]-b[1]))
    assert.deepEqual(roots, expectedRoots)
  }
})

test("octave-equivalent Box 3 and Box 4 coordinates remain exact inside 0-12", () => {
  assert.deepEqual(tuples(Visual.positionsInRange({ mode: Visual.PENTATONIC_BOX, box: 3 }, 9, 0, 12)),
    [[0,10],[0,12],[1,10],[1,12],[2,10],[2,12],[3,9],[3,12],[4,10],[4,1],[5,10],[5,12]])
  assert.deepEqual(tuples(Visual.positionsInRange({ mode: Visual.PENTATONIC_BOX, box: 4 }, 9, 0, 12)),
    [[0,0],[0,3],[1,0],[1,3],[2,0],[2,2],[3,0],[3,2],[4,1],[4,3],[5,0],[5,3]])
})

test("A major and minor triad filters produce exact closed inversions on each requested string set", () => {
  const exactTop = {
    major: { root: [[3,2],[4,2],[5,0]], first: [[3,6],[4,5],[5,5]], second: [[3,9],[4,10],[5,9]] },
    minor: { root: [[3,2],[4,1],[5,0]], first: [[3,5],[4,5],[5,5]], second: [[3,9],[4,10],[5,8]] }
  }
  const board = Fretboard.buildFretboard(STANDARD, 12)
  for (const quality of ["major", "minor"]) for (const inversion of ["root", "first", "second"]) {
    const shapes = Visual.triadShapes(9, quality, inversion, "123", 0, 12)
    assert.equal(shapes.length, 1)
    assert.equal(shapes[0].inversion, inversion)
    assert.equal(shapes[0].stringSet, "123")
    assert.deepEqual(tuples(shapes[0].positions), exactTop[quality][inversion])
    const set = Theory.pitchClassSet(Theory.buildChord("A", quality).notes)
    for (const [s,f] of shapes[0].positions) assert.equal(set[board.strings[s][f].pitchClass], true)
  }
  for (const setId of ["123","234","345","456"])
    assert.ok(Visual.triadShapes(9, "major", "all", setId, 0, 12).length >= 2, setId)
})

test("diminished and augmented triad filters retain exact quality and inversion metadata", () => {
  for (const quality of ["diminished", "augmented"]) {
    const shapes = Visual.triadShapes(0, quality, "all", "all", 0, 12)
    assert.ok(shapes.length > 0)
    assert.ok(shapes.every((shape) => shape.quality === quality && ["root","first","second"].includes(shape.inversion)))
  }
})

test("all 57 built-in presets and every constituent item have a supported data-driven visual", () => {
  assert.equal(Presets.PRESET_ROUTINES.length, 57)
  assert.equal(Presets.PRESET_ROUTINES.flatMap((preset) => Array.from(preset.items)).length, 90)
  const supported = new Set(Array.from(Visual.MODES))
  for (const preset of Presets.PRESET_ROUTINES) for (const item of preset.items) {
    assert.ok(item.visualAid, `${preset.name}: ${item.label}`)
    assert.ok(supported.has(item.visualAid.mode), `${preset.name}: unsupported ${item.visualAid.mode}`)
    if ([Visual.POSITION, Visual.PATTERN, Visual.TRIAD_SHAPE, Visual.FRETBOARD_PATH, Visual.PICKING_PATTERN].includes(item.visualAid.mode)) {
      assert.ok(item.visualAid.positions && item.visualAid.positions.length, `${preset.name}: missing coordinates`)
      assert.ok(item.visualAid.positions.every(([s,f]) => Number.isInteger(s) && s >= 0 && s < 6 && Number.isInteger(f) && f >= 0 && f <= 24))
    }
    if (item.visualAid.mode === Visual.RHYTHM_GRID) assert.ok(item.visualAid.steps.length >= 4)
  }
})

test("rhythm visual density agrees with each metronome subdivision and compound meter grouping", () => {
  const ticks = { quarter: 1, eighth: 2, triplet: 3, sixteenth: 4 }
  for (const preset of Presets.PRESET_ROUTINES) for (const item of preset.items) {
    if (item.visualAid.mode !== Visual.RHYTHM_GRID) continue
    const beats = item.metronome.timeSignatureId === "6-8" ? 2 : 4
    assert.ok(item.visualAid.steps.length >= beats * ticks[item.metronome.subdivisionId], `${preset.name}`)
  }
  const sixEight = Presets.presetById("preset-rhythm-6-8-groove").items[0].visualAid
  assert.deepEqual(Array.from(sixEight.steps, (s) => s.label), ["1","la","li","2","la","li"])
  assert.deepEqual(Array.from(sixEight.steps, (s, i) => s.accent ? i : -1).filter((i) => i >= 0), [0,3])
})

test("category filtering and dropdown selection always resolve one valid preset detail", () => {
  const all = Presets.PRESET_ROUTINES
  for (const category of Presets.PRESET_CATEGORIES) {
    const filtered = Browser.filteredPresets(all, category)
    const options = Browser.routineOptions(filtered)
    assert.ok(filtered.length > 0)
    assert.ok(filtered.every((p) => p.category === category))
    assert.deepEqual(Array.from(options, (o) => o.value), Array.from(filtered, (p) => p.id))
    for (const option of options)
      assert.equal(Browser.selectedPreset(all, category, option.value).id, option.value)
  }
})

test("selector source switching, invalid IDs, deletion and persisted selection fall back safely", () => {
  const presets = Presets.PRESET_ROUTINES
  const categories = Presets.PRESET_CATEGORIES
  const mine = [{ id: "mine-a", name: "A", items: [] }, { id: "mine-b", name: "B", items: [] }]
  const presetState = Browser.selectorState("presets", presets, categories, mine,
    { routineCategory: "Scales", routinePresetId: "missing" })
  assert.equal(presetState.source, "presets")
  assert.equal(presetState.category, "Scales")
  assert.equal(presetState.selected.id, presetState.routines[0].id)
  const persisted = Browser.selectorState("presets", presets, categories, mine,
    { routineCategory: "Rhythm", routinePresetId: "preset-rhythm-6-8-groove" })
  assert.equal(persisted.selected.id, "preset-rhythm-6-8-groove")
  const userState = Browser.selectorState("mine", presets, categories, mine,
    { routineUserId: "mine-b" })
  assert.equal(userState.selected.id, "mine-b")
  const afterDelete = Browser.selectorState("mine", presets, categories, mine.slice(0, 1),
    { routineUserId: "mine-b" })
  assert.equal(afterDelete.selected.id, "mine-a")
  assert.equal(Browser.selectorState("mine", presets, categories, [], {}).selected, null)
  assert.equal(Browser.normalizeCategory(categories, "removed"), "All")
  assert.equal(Browser.normalizeSource("removed"), "presets")
})

test("every built-in preset is selectable once and its selected detail retains valid visual data", () => {
  const options = Browser.routineOptions(Presets.PRESET_ROUTINES)
  assert.equal(options.length, 57)
  assert.equal(new Set(Array.from(options, (o) => o.value)).size, 57)
  for (const option of options) {
    const chosen = Browser.selectedPreset(Presets.PRESET_ROUTINES, "All", option.value)
    assert.equal(chosen.id, option.value)
    assert.ok(chosen.items.length > 0)
    assert.ok(chosen.items[0].visualAid)
    assert.ok(Visual.MODES.includes(chosen.items[0].visualAid.mode))
  }
})
