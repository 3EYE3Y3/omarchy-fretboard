import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const LyricsSearch = loadQmlJs(new URL("../js/lyrics_search.js", import.meta.url))

test("builds an exact quoted Artist + Title query", () => {
  const query = LyricsSearch.lyricsSearchQuery("Wish You Were Here", "Pink Floyd")
  assert.equal(query, '"Pink Floyd" "Wish You Were Here" lyrics')
})

test("falls back to Title-only query when Artist is empty", () => {
  assert.equal(LyricsSearch.lyricsSearchQuery("Wish You Were Here", ""), '"Wish You Were Here" lyrics')
  assert.equal(LyricsSearch.lyricsSearchQuery("Wish You Were Here", undefined), '"Wish You Were Here" lyrics')
  assert.equal(LyricsSearch.lyricsSearchQuery("Wish You Were Here", "   "), '"Wish You Were Here" lyrics')
})

test("returns null (and disables Search Lyrics) when Title is empty", () => {
  assert.equal(LyricsSearch.lyricsSearchQuery("", "Pink Floyd"), null)
  assert.equal(LyricsSearch.lyricsSearchQuery("   ", "Pink Floyd"), null)
  assert.equal(LyricsSearch.canSearchLyrics(""), false)
  assert.equal(LyricsSearch.canSearchLyrics("   "), false)
  assert.equal(LyricsSearch.canSearchLyrics(undefined), false)
  assert.equal(LyricsSearch.buildLyricsSearchUrl("", "Pink Floyd"), null)
})

test("canSearchLyrics is true whenever a non-empty Title exists, regardless of Artist", () => {
  assert.equal(LyricsSearch.canSearchLyrics("Wish You Were Here"), true)
})

test("trims only leading/trailing whitespace, never touches internal text", () => {
  const query = LyricsSearch.lyricsSearchQuery("  Wish You Were Here  ", "  Pink Floyd  ")
  assert.equal(query, '"Pink Floyd" "Wish You Were Here" lyrics')
  // Internal spacing/casing is authoritative user data - never altered.
  const weird = LyricsSearch.lyricsSearchQuery("wish   YOU were here", "pink  FLOYD")
  assert.equal(weird, '"pink  FLOYD" "wish   YOU were here" lyrics')
})

test("does not infer, autocomplete, substitute, or correct the user's text", () => {
  // A misspelled/unusual title must be searched verbatim, not "fixed".
  const query = LyricsSearch.lyricsSearchQuery("Wish You Wer Hear", "Pnk Floyd")
  assert.equal(query, '"Pnk Floyd" "Wish You Wer Hear" lyrics')
})

test("generated URL is https and uses the query as its q parameter", () => {
  const url = LyricsSearch.buildLyricsSearchUrl("Wish You Were Here", "Pink Floyd")
  assert.match(url, /^https:\/\//)
  const parsed = new URL(url)
  assert.equal(parsed.protocol, "https:")
  assert.equal(parsed.searchParams.get("q"), '"Pink Floyd" "Wish You Were Here" lyrics')
})

test("encodes spaces", () => {
  const url = LyricsSearch.buildLyricsSearchUrl("Wish You Were Here", "Pink Floyd")
  assert.ok(url.includes("%20"), "spaces must be percent-encoded, not left literal or turned into +")
  assert.ok(!url.includes(" "), "no literal space should reach the URL")
})

test("encodes apostrophes", () => {
  const url = LyricsSearch.buildLyricsSearchUrl("Don't Look Back in Anger", "Oasis")
  assert.ok(url.includes("%27"), "apostrophe should be percent-encoded (encodeURIComponent alone leaves ' unescaped)")
  assert.ok(!url.includes("'"), "no literal apostrophe should reach the URL")
})

test("encodes punctuation (commas, question marks, colons, slashes)", () => {
  const url = LyricsSearch.buildLyricsSearchUrl("Where Is My Mind?", "Pixies, The")
  const parsed = new URL(url)
  assert.equal(parsed.searchParams.get("q"), '"Pixies, The" "Where Is My Mind?" lyrics')
  assert.ok(!url.includes("?", url.indexOf("?") + 1) || url.indexOf("?") === url.lastIndexOf("?"), "sanity: only the URL's own ? separator is a literal ?")
  assert.ok(url.includes("%3F"), "the song title's own ? must be encoded, not treated as a URL delimiter")
})

test("encodes ampersands", () => {
  const url = LyricsSearch.buildLyricsSearchUrl("Me & My Guitar", "Rock & Roll Band")
  assert.ok(url.includes("%26"), "ampersand must be percent-encoded, not parsed as another query parameter")
  const parsed = new URL(url)
  // Confirms the whole string round-trips as ONE q value, not split params.
  assert.equal(parsed.searchParams.get("q"), '"Rock & Roll Band" "Me & My Guitar" lyrics')
  assert.equal(Array.from(parsed.searchParams.keys()).length, 1)
})

test("encodes accented characters and other Unicode correctly", () => {
  const url = LyricsSearch.buildLyricsSearchUrl("Aline", "Christophe Maé")
  const parsed = new URL(url)
  assert.equal(parsed.searchParams.get("q"), '"Christophe Maé" "Aline" lyrics')
  assert.ok(!/[^\x00-\x7f]/.test(url), "the raw URL string itself should be pure ASCII (UTF-8 percent-encoded)")
})

test("round-trips a fully synthetic non-English/CJK example", () => {
  const url = LyricsSearch.buildLyricsSearchUrl("真夜中のシグナル", "北行きの合図")
  const parsed = new URL(url)
  assert.equal(parsed.searchParams.get("q"), '"北行きの合図" "真夜中のシグナル" lyrics')
})

test("the synthetic acceptance song from manual testing", () => {
  const url = LyricsSearch.buildLyricsSearchUrl("Midnight Harbour", "Northbound Signal")
  const parsed = new URL(url)
  assert.equal(parsed.searchParams.get("q"), '"Northbound Signal" "Midnight Harbour" lyrics')
})
