import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Circle = loadQmlJs(new URL("../js/circle_of_fifths.js", import.meta.url))

test("has 12 keys in fifths order starting at C", () => {
  assert.equal(Circle.KEYS.length, 12)
  assert.equal(Circle.KEYS[0].major, "C")
  assert.equal(Circle.KEYS[1].major, "G")
  assert.equal(Circle.KEYS[2].major, "D")
})

test("pairs each major key with the correct relative minor", () => {
  assert.equal(Circle.relativeMinorOf("C"), "Am")
  assert.equal(Circle.relativeMinorOf("G"), "Em")
  assert.equal(Circle.relativeMajorOf("Am"), "C")
})

test("tracks sharps and flats correctly", () => {
  assert.equal(Circle.keyByMajorName("G").sharps, 1)
  assert.equal(Circle.keyByMajorName("F").flats, 1)
  assert.equal(Circle.keyByMajorName("C").sharps, 0)
  assert.equal(Circle.keyByMajorName("C").flats, 0)
})

test("wraps around the circle for neighbors", () => {
  const n = Circle.neighbors(0) // C
  assert.equal(n.fifthUp.major, "G")
  assert.equal(n.fifthDown.major, "F")

  const wrapped = Circle.neighbors(11) // F
  assert.equal(wrapped.fifthUp.major, "C")
})

test("keyAt normalizes out-of-range indexes", () => {
  assert.equal(Circle.keyAt(12).major, "C")
  assert.equal(Circle.keyAt(-1).major, "F")
})
