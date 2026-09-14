import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Url = loadQmlJs(new URL("../js/url_safety.js", import.meta.url))

test("accepts plain http/https URLs", () => {
  assert.equal(Url.isHttpUrl("https://example.com/lyrics/song"), true)
  assert.equal(Url.isHttpUrl("http://example.com"), true)
  assert.equal(Url.isHttpUrl("HTTPS://Example.COM/Song"), true)
  assert.equal(Url.isHttpUrl("  https://example.com/song  "), true, "surrounding whitespace is trimmed")
})

test("rejects empty, missing, and non-string input", () => {
  assert.equal(Url.isHttpUrl(""), false)
  assert.equal(Url.isHttpUrl("   "), false)
  assert.equal(Url.isHttpUrl(undefined), false)
  assert.equal(Url.isHttpUrl(null), false)
})

test("rejects non-http(s) schemes -- no shell/script/file handoff", () => {
  assert.equal(Url.isHttpUrl("javascript:alert(1)"), false)
  assert.equal(Url.isHttpUrl("file:///etc/passwd"), false)
  assert.equal(Url.isHttpUrl("data:text/html,<script>alert(1)</script>"), false)
  assert.equal(Url.isHttpUrl("ftp://example.com/song.txt"), false)
  assert.equal(Url.isHttpUrl("mailto:me@example.com"), false)
  assert.equal(Url.isHttpUrl("custom-scheme://payload"), false)
})

test("rejects bare text, shell-looking strings, and schemeless hosts", () => {
  assert.equal(Url.isHttpUrl("example.com/lyrics"), false)
  assert.equal(Url.isHttpUrl("rm -rf /"), false)
  assert.equal(Url.isHttpUrl("$(curl evil.com)"), false)
  assert.equal(Url.isHttpUrl("Genius lyrics page"), false)
})

test("rejects embedded whitespace/control characters even with a valid-looking scheme", () => {
  assert.equal(Url.isHttpUrl("https://example.com/a b"), false)
  assert.equal(Url.isHttpUrl("https://example.com\nrm -rf /"), false)
  assert.equal(Url.isHttpUrl("https://example.com/x\ty"), false, "an embedded (non-trimmable) tab must still be rejected")
})

test("rejects a scheme with no host", () => {
  assert.equal(Url.isHttpUrl("https://"), false)
  assert.equal(Url.isHttpUrl("http:///path"), false)
})
