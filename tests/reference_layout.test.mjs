import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import { fileURLToPath } from "node:url"

// panel/ReferenceSection.qml renders inside a fixed-height popup
// (Panel.qml's KeyboardPanel caps at Style.space(660)) with no outer
// scrolling of its own. There is no QML rendering harness in this Node
// test suite, so these are static structural guards -- confirmed against
// real rendered output via an offscreen Quickshell instance during
// development -- that catch someone removing the bounded-scroll wrapper,
// its safety properties, or the fixed-controls/scrollable-body split.
const qmlPath = fileURLToPath(new URL("../panel/ReferenceSection.qml", import.meta.url))
const qml = fs.readFileSync(qmlPath, "utf8")

// Extracts the full brace-balanced block starting at the first match of
// `needle` (which must be immediately followed by the block's opening
// "{"). Lets us assert containment/ordering without a real QML parser.
function extractBlock(source, needle) {
  const start = source.indexOf(needle)
  assert.ok(start >= 0, `expected to find "${needle}"`)
  const braceStart = source.indexOf("{", start)
  assert.ok(braceStart >= 0, `expected "{" after "${needle}"`)
  let depth = 0
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") depth++
    else if (source[i] === "}") {
      depth--
      if (depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) }
    }
  }
  throw new Error(`unbalanced braces reading block "${needle}"`)
}

test("fretboardView wraps its variable-height body in a bounded, clipped Flickable", () => {
  const scroll = extractBlock(qml, 'objectName: "referenceScroll"')
  // Walk outward to the enclosing Flickable { ... } that declares this id.
  const flickableStart = qml.lastIndexOf("Flickable {", scroll.start)
  assert.ok(flickableStart >= 0, "referenceScroll should be declared on a Flickable")
  const flickable = extractBlock(qml, "Flickable {")
  assert.ok(flickable.text.includes("referenceScroll"))
  assert.match(flickable.text, /boundsBehavior:\s*Flickable\.StopAtBounds/, "must not rubber-band past real content")
  assert.match(flickable.text, /interactive:\s*.*contentHeight\s*>\s*.*height/, "should only be interactive when content overflows the box")
})

test("the Flickable's containing box clips and caps height without a fixed oversized minimum", () => {
  const flickableIdx = qml.indexOf("Flickable {")
  const boxStart = qml.lastIndexOf("Rectangle {", flickableIdx)
  assert.ok(boxStart >= 0)
  const box = extractBlock(qml.slice(boxStart), "Rectangle {")
  assert.match(box.text, /clip:\s*true/, "must clip so scrolled-past content cannot paint outside the panel")
  assert.match(box.text, /Layout\.preferredHeight:\s*Math\.min\(/, "height should track content up to a cap, not force a fixed size")
  assert.match(box.text, /Style\.space\(330\)/, "cap should be a real bound, not unbounded/huge")
})

test("Chord Tones and CAGED Shapes render inside the scrollable body, not the fixed header", () => {
  const flickable = extractBlock(qml, "Flickable {")
  assert.ok(flickable.text.includes('text: "Chord Tones"'), "Chord Tones header should scroll with the body")
  assert.ok(flickable.text.includes('text: "CAGED Shapes"'), "CAGED Shapes header should scroll with the body")
  assert.ok(flickable.text.includes("CagedDiagram {"), "the large CAGED diagram should live inside the scroll area")
  assert.ok(flickable.text.includes("FretboardGrid {"), "the chord-tone/scale/triad fretboard map should live inside the scroll area")
})

test("CagedDiagram is not shrunk by a hardcoded tiny size inside the scroll body", () => {
  const diagramStart = qml.indexOf("CagedDiagram {")
  assert.ok(diagramStart >= 0)
  const diagram = extractBlock(qml, "CagedDiagram {")
  assert.ok(!/\bwidth:\s*\d/.test(diagram.text), "diagram should size itself, not be pinned to a small literal width")
  assert.ok(!/\bheight:\s*\d/.test(diagram.text), "diagram should size itself, not be pinned to a small literal height")
})

test("Tuning/Root and mode controls stay outside the scrollable body (usable while scrolled)", () => {
  const flickableIdx = qml.indexOf("Flickable {")
  const tuningIdx = qml.indexOf('label: "Tuning"')
  const modeButtonGroupIdx = qml.indexOf('{ value: "scale", label: "Scale" }')
  const chordQualityIdx = qml.indexOf("options: root.chordQualityOptions()")
  assert.ok(tuningIdx >= 0 && tuningIdx < flickableIdx, "Tuning dropdown must precede (be outside) the scroll area")
  assert.ok(modeButtonGroupIdx >= 0 && modeButtonGroupIdx < flickableIdx, "Scale/Triad/Chord switch must precede (be outside) the scroll area")
  assert.ok(chordQualityIdx >= 0 && chordQualityIdx < flickableIdx, "Chord quality selector must precede (be outside) the scroll area")
})

test("the Tuning/Root row keeps its responsive-width safety net (no reintroduced fixed overflow)", () => {
  const row = extractBlock(qml, 'label: "Tuning"')
  // label: "Tuning" is inside the Dropdown; walk out to the RowLayout.
  const rowLayoutStart = qml.lastIndexOf("RowLayout {", row.start)
  const rowLayout = extractBlock(qml.slice(rowLayoutStart), "RowLayout {")
  assert.match(rowLayout.text, /Layout\.minimumWidth:\s*0/, "row must be allowed to overflow independently, not poison sibling widths")
  const dropdownMatches = rowLayout.text.match(/Layout\.fillWidth:\s*true/g) || []
  assert.ok(dropdownMatches.length >= 3, "Tuning, Root/Key and Show-intervals should all be allowed to shrink/grow")
  assert.match(rowLayout.text, /Layout\.maximumWidth:\s*implicitWidth/, "controls should not grow past their normal size at wide widths")
})

test("Scale and Triad primary selectors remain in the fixed header alongside Chord's", () => {
  const flickableIdx = qml.indexOf("Flickable {")
  const scaleDropdownIdx = qml.indexOf('label: "Scale"')
  const triadDropdownIdx = qml.indexOf('label: "Triad quality"')
  assert.ok(scaleDropdownIdx >= 0 && scaleDropdownIdx < flickableIdx)
  assert.ok(triadDropdownIdx >= 0 && triadDropdownIdx < flickableIdx)
})
