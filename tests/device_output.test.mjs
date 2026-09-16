import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import { fileURLToPath } from "node:url"
import { loadQmlJs } from "./load-qml-js.mjs"

const output = loadQmlJs(new URL("../js/device_output.js", import.meta.url))
const service = fs.readFileSync(fileURLToPath(new URL("../Service.qml", import.meta.url)), "utf8")

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

test("normal and zero-device helper payloads are accepted", () => {
  assert.deepEqual(plain(output.parsePayload("[]\n")), { ok: true, error: "", devices: [] })
  assert.deepEqual(plain(output.parsePayload('[{"id":"mic.usb","label":"USB Microphone"}]\n')), {
    ok: true,
    error: "",
    devices: [{ id: "mic.usb", label: "USB Microphone" }],
  })
})

test("malformed helper payloads fail closed", () => {
  for (const payload of ["not-json", "{}", "[null]", '[{"id":"mic"}]']) {
    assert.equal(output.parsePayload(payload).ok, false)
  }
})

test("QML-side parser independently rejects output above its byte ceiling", () => {
  const oversized = "x".repeat(output.MAX_OUTPUT_BYTES + 1)
  assert.deepEqual(plain(output.parsePayload(oversized)), { ok: false, error: "output_limit", devices: [] })
})

test("QML-side parser enforces device and field limits", () => {
  const tooMany = Array.from({ length: output.MAX_DEVICES + 1 }, (_, index) => ({ id: `mic.${index}`, label: "Mic" }))
  assert.equal(output.parsePayload(JSON.stringify(tooMany)).ok, false)
  assert.equal(output.parsePayload(JSON.stringify([{ id: "x".repeat(output.MAX_DEVICE_NAME_BYTES + 1), label: "Mic" }])).ok, false)
  assert.equal(output.parsePayload(JSON.stringify([{ id: "mic", label: "x".repeat(output.MAX_DEVICE_DESCRIPTION_BYTES + 1) }])).ok, false)
})

test("Service streams chunks and checks the cap before retaining them", () => {
  assert.match(service, /stdout:\s*SplitParser\s*{\s*splitMarker:\s*""/s)
  assert.match(service, /stderr:\s*SplitParser\s*{\s*splitMarker:\s*""/s)
  const handler = service.match(/function consumeDeviceListStdout\(chunk\)\s*{([\s\S]*?)\n    }/)[1]
  assert.ok(handler.indexOf("deviceListStdoutBytes + bytes > DeviceOutput.MAX_OUTPUT_BYTES") < handler.indexOf("deviceListOutput += chunk"))
  assert.match(service, /deviceListProcess\.running = false/)
  assert.match(service, /deviceListProcess\.signal\(9\)/)
  assert.match(service, /id:\s*deviceListTimeoutTimer[\s\S]*?interval:\s*6000/)
})
