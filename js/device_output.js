.pragma library

var MAX_OUTPUT_BYTES = 64 * 1024
var MAX_STDERR_BYTES = 8 * 1024
var MAX_DEVICES = 64
var MAX_DEVICE_NAME_BYTES = 256
var MAX_DEVICE_DESCRIPTION_BYTES = 512

function utf8ByteLength(value) {
    var text = String(value)
    var bytes = 0
    for (var i = 0; i < text.length; i++) {
        var code = text.charCodeAt(i)
        if (code < 0x80) bytes += 1
        else if (code < 0x800) bytes += 2
        else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length
                 && text.charCodeAt(i + 1) >= 0xDC00 && text.charCodeAt(i + 1) <= 0xDFFF) {
            bytes += 4
            i += 1
        } else bytes += 3
    }
    return bytes
}

function parsePayload(text) {
    if (utf8ByteLength(text) > MAX_OUTPUT_BYTES)
        return { ok: false, error: "output_limit", devices: [] }

    var parsed
    try { parsed = JSON.parse(text) }
    catch (error) { return { ok: false, error: "malformed", devices: [] } }
    if (!Array.isArray(parsed) || parsed.length > MAX_DEVICES)
        return { ok: false, error: "invalid_devices", devices: [] }

    var devices = []
    for (var i = 0; i < parsed.length; i++) {
        var device = parsed[i]
        if (!device || typeof device !== "object" || Array.isArray(device)
            || typeof device.id !== "string" || !device.id
            || typeof device.label !== "string" || !device.label
            || utf8ByteLength(device.id) > MAX_DEVICE_NAME_BYTES
            || utf8ByteLength(device.label) > MAX_DEVICE_DESCRIPTION_BYTES)
            return { ok: false, error: "invalid_device", devices: [] }
        devices.push({ id: device.id, label: device.label })
    }
    return { ok: true, error: "", devices: devices }
}
