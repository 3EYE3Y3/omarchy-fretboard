import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import { fileURLToPath } from "node:url"

const manifestPath = fileURLToPath(new URL("../manifest.json", import.meta.url))
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))

test("manifest declares schema version 1", () => {
  assert.equal(manifest.schemaVersion, 1)
})

test("manifest id avoids the reserved omarchy.* namespace", () => {
  assert.ok(!manifest.id.startsWith("omarchy."))
  assert.match(manifest.id, /^[A-Za-z0-9][A-Za-z0-9._-]*$/)
})

test("every declared kind has a matching entry point that exists on disk", () => {
  const kindToEntry = { service: "service", "bar-widget": "barWidget", menu: "menu", overlay: "overlay", panel: "panel", bar: "bar" }
  for (const kind of manifest.kinds) {
    const key = kindToEntry[kind]
    if (!key) continue
    assert.ok(manifest.entryPoints[key], `missing entryPoints.${key} for kind ${kind}`)
    const filePath = fileURLToPath(new URL("../" + manifest.entryPoints[key], import.meta.url))
    assert.ok(fs.existsSync(filePath), `entry point file missing: ${manifest.entryPoints[key]}`)
  }
})

test("barWidget.defaultSection is one of left/center/right", () => {
  assert.ok(["left", "center", "right"].includes(manifest.barWidget.defaultSection))
})

test("no entry point path escapes the plugin folder", () => {
  for (const value of Object.values(manifest.entryPoints)) {
    assert.ok(!value.startsWith("/"))
    assert.ok(!value.includes(".."))
  }
})
