.pragma library

// Gate for the Songs "Open Lyrics" action. Fretboard never fetches, scrapes
// or guesses a lyrics URL -- this only decides whether a URL the USER typed
// is safe to hand to the platform's normal external-URL opener
// (Qt.openUrlExternally, never a shell). Only plain http/https is accepted;
// javascript:, file:, data:, custom schemes and anything containing
// whitespace/control characters are rejected so a pasted script or command
// can never reach the opener as if it were a link.
function isHttpUrl(text) {
    var value = String(text || "").trim()
    if (value === "") return false
    if (/[\s\x00-\x1f\x7f]/.test(value)) return false
    var match = /^(https?):\/\/(.+)$/i.exec(value)
    if (!match) return false
    var host = match[2].split(/[/?#]/)[0]
    return host.length > 0
}
