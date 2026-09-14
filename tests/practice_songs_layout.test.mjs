import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import { fileURLToPath } from "node:url"

// Songs moved from Progress into Practice (active practice content, not
// history/statistics). No QML rendering harness exists in this Node suite
// (confirmed against real rendered output via an offscreen Quickshell
// instance during development), so these are static structural guards
// against the move, the bounded-scroll safety net, the URL-safety gate,
// and the reused practice/session architecture being weakened later.
const practicePath = fileURLToPath(new URL("../panel/PracticeSection.qml", import.meta.url))
const progressPath = fileURLToPath(new URL("../panel/ProgressSection.qml", import.meta.url))
const servicePath = fileURLToPath(new URL("../Service.qml", import.meta.url))
const practice = fs.readFileSync(practicePath, "utf8")
const progress = fs.readFileSync(progressPath, "utf8")
const service = fs.readFileSync(servicePath, "utf8")

function extractBlock(source, needle, open, close) {
  const openChar = open || "{"
  const closeChar = close || "}"
  const start = source.indexOf(needle)
  assert.ok(start >= 0, `expected to find "${needle}"`)
  const braceStart = source.indexOf(openChar, start)
  let depth = 0
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === openChar) depth++
    else if (source[i] === closeChar) {
      depth--
      if (depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) }
    }
  }
  throw new Error(`unbalanced ${openChar}${closeChar} reading block "${needle}"`)
}

test("Songs is a Practice mode, ordered with Routines/Jam as required", () => {
  const optionsBlock = extractBlock(practice, "readonly property var modeOptions", "[", "]")
  const order = Array.from(optionsBlock.text.matchAll(/value:\s*"(\w+)"/g)).map((m) => m[1])
  assert.deepEqual(order, ["metronome", "routines", "songs", "jam", "trainer", "timer"])
})

test("PracticeSection loads a songsView Component for mode \"songs\"", () => {
  assert.match(practice, /root\.mode === "songs" \? songsView/)
  assert.ok(practice.includes("id: songsView"))
})

test("Songs no longer exists in ProgressSection (moved, not duplicated)", () => {
  assert.ok(!progress.includes("id: songsView"), "ProgressSection should not define a songsView Component")
  assert.ok(!/value:\s*"songs"/.test(progress), "ProgressSection should not offer a songs view option")
  assert.ok(!progress.includes("service.songs"), "ProgressSection should not read service.songs directly")
})

test("Progress keeps only history/statistics: minutes, streak, sessions, exercise progress", () => {
  assert.ok(progress.includes("minutesToday"))
  assert.ok(progress.includes("currentStreak"))
  assert.ok(progress.includes("recentSessions"))
  assert.ok(progress.includes("progressRows"))
})

test("the Songs detail/editor body is a bounded, clipped Flickable (no panel overflow)", () => {
  const songsComponent = extractBlock(practice, "id: songsView")
  assert.ok(songsComponent.text.includes('objectName: "songDetailScroll"'))
  const flickable = extractBlock(songsComponent.text, "Flickable {")
  assert.match(flickable.text, /boundsBehavior:\s*Flickable\.StopAtBounds/)
  assert.match(flickable.text, /interactive:\s*.*contentHeight\s*>\s*.*height/)
  const box = extractBlock(songsComponent.text, "Rectangle {")
  assert.match(box.text, /clip:\s*true/)
  assert.match(box.text, /Layout\.preferredHeight:\s*Math\.min\(/)
})

test("the lyrics editor is a bounded TextArea, not an unbounded growing box", () => {
  const songsComponent = extractBlock(practice, "id: songsView")
  assert.ok(songsComponent.text.includes("TextArea {"))
  assert.ok(songsComponent.text.includes("id: lyricsInput"))
  assert.ok(songsComponent.text.includes("Layout.preferredHeight: Style.space(140)"), "lyrics editor box should have a fixed, bounded height")
})

test("Open Lyrics is gated by the URL-safety helper, not a bare non-empty check", () => {
  const songsComponent = extractBlock(practice, "id: songsView")
  assert.ok(songsComponent.text.includes("UrlSafety.isHttpUrl"))
  const buttonBlock = (() => {
    const idx = songsComponent.text.indexOf('text: "Open Lyrics"')
    const btnStart = songsComponent.text.lastIndexOf("Button {", idx)
    return extractBlock(songsComponent.text.slice(btnStart), "Button {")
  })()
  assert.match(buttonBlock.text, /enabled:.*UrlSafety\.isHttpUrl/)
  assert.match(buttonBlock.text, /onClicked:\s*Qt\.openUrlExternally/)
})

test("Start Practice reuses the existing routine runner, not a second engine", () => {
  const songsComponent = extractBlock(practice, "id: songsView")
  assert.ok(songsComponent.text.includes("root.service.startSongPractice"))
  assert.ok(!/new (Timer|Metronome)\(/.test(songsComponent.text))
})

test("Service.startSongPractice reuses startRoutineObject/Routines.createItem and does not set targetBpm on the item", () => {
  const fn = extractBlock(service, "function startSongPractice")
  assert.ok(fn.text.includes("Routines.createItem"))
  assert.ok(fn.text.includes("startRoutineObject"))
  assert.ok(fn.text.includes("Routines.createRoutine"))
  assert.ok(!/targetBpm:/.test(fn.text), "must not set targetBpm on the ad-hoc item (would misroute into the exercise-outcome/BPM-ladder flow)")
  assert.ok(fn.text.includes("setMetronomeBpm"))
})

test("createSong/updateSong/deleteSong are unchanged generic CRUD (new fields need no service changes)", () => {
  const create = extractBlock(service, "function createSong")
  const update = extractBlock(service, "function updateSong")
  assert.ok(create.text.includes("Object.assign"))
  assert.ok(update.text.includes("songs.map"))
})

test("Search Lyrics is gated by LyricsSearch.canSearchLyrics and reads the chosen song fresh", () => {
  const songsComponent = extractBlock(practice, "id: songsView")
  assert.ok(songsComponent.text.includes("LyricsSearch.canSearchLyrics"))
  const buttonBlock = (() => {
    const idx = songsComponent.text.indexOf('text: "Search Lyrics"')
    const btnStart = songsComponent.text.lastIndexOf("Button {", idx)
    return extractBlock(songsComponent.text.slice(btnStart), "Button {")
  })()
  assert.match(buttonBlock.text, /enabled:.*LyricsSearch\.canSearchLyrics\(songsRoot\.chosen\.title\)/)
  assert.match(buttonBlock.text, /LyricsSearch\.buildLyricsSearchUrl\(songsRoot\.chosen\.title,\s*songsRoot\.chosen\.artist\)/,
    "must build the URL from songsRoot.chosen at click time, never a cached/stored query")
  assert.match(buttonBlock.text, /onClicked:[\s\S]*Qt\.openUrlExternally/)
})

test("Search Lyrics and Open Lyrics are distinct actions using distinct data sources", () => {
  const songsComponent = extractBlock(practice, "id: songsView")
  assert.ok(songsComponent.text.includes("LyricsSearch.buildLyricsSearchUrl(songsRoot.chosen.title, songsRoot.chosen.artist)"),
    "Search Lyrics must be built from title+artist")
  assert.ok(songsComponent.text.includes("Qt.openUrlExternally(songsRoot.chosen.lyricsUrl)"),
    "Open Lyrics must open the saved lyricsUrl verbatim, not a search")
})

test("no lyrics search performs a fetch, scrape, or API call - only URL construction and a browser handoff", () => {
  const searchJs = fs.readFileSync(fileURLToPath(new URL("../js/lyrics_search.js", import.meta.url)), "utf8")
  assert.ok(!/XMLHttpRequest|fetch\(|WebSocket|Process|Quickshell\.execDetached/.test(searchJs))
  assert.ok(!/api[_-]?key/i.test(searchJs))
})
