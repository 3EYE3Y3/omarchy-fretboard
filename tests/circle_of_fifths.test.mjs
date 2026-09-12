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

test("all circle entries have canonical ordering, relatives and accidentals", () => {
  const expected = [
    ["C","Am",0,0], ["G","Em",1,0], ["D","Bm",2,0], ["A","F#m",3,0],
    ["E","C#m",4,0], ["B","G#m",5,0], ["F#","D#m",6,0], ["Db","Bbm",0,5],
    ["Ab","Fm",0,4], ["Eb","Cm",0,3], ["Bb","Gm",0,2], ["F","Dm",0,1]
  ]
  assert.deepEqual(Array.from(Circle.KEYS, (key) => [key.major,key.minor,key.sharps,key.flats]), expected)
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

test("records the enharmonic seam without hiding either spelling", () => {
  assert.equal(Circle.KEYS[6].major, "F#")
  assert.equal(Circle.KEYS[6].enharmonicMajor, "Gb")
  assert.equal(Circle.KEYS[7].major, "Db")
  assert.equal(Circle.KEYS[7].enharmonicMajor, "C#")
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
