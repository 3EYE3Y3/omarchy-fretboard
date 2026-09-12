.pragma library

// Ordered clockwise from C, each a perfect fifth above the last. `sharps`/
// `flats` counts follow standard key-signature convention (never both > 0
// for the same key).
var KEYS = [
    { index: 0, major: "C", minor: "Am", sharps: 0, flats: 0 },
    { index: 1, major: "G", minor: "Em", sharps: 1, flats: 0 },
    { index: 2, major: "D", minor: "Bm", sharps: 2, flats: 0 },
    { index: 3, major: "A", minor: "F#m", sharps: 3, flats: 0 },
    { index: 4, major: "E", minor: "C#m", sharps: 4, flats: 0 },
    { index: 5, major: "B", minor: "G#m", sharps: 5, flats: 0 },
    { index: 6, major: "F#", minor: "D#m", enharmonicMajor: "Gb", enharmonicMinor: "Ebm", sharps: 6, flats: 0, enharmonicFlats: 6 },
    { index: 7, major: "Db", minor: "Bbm", enharmonicMajor: "C#", enharmonicMinor: "A#m", sharps: 0, flats: 5, enharmonicSharps: 7 },
    { index: 8, major: "Ab", minor: "Fm", sharps: 0, flats: 4 },
    { index: 9, major: "Eb", minor: "Cm", sharps: 0, flats: 3 },
    { index: 10, major: "Bb", minor: "Gm", sharps: 0, flats: 2 },
    { index: 11, major: "F", minor: "Dm", sharps: 0, flats: 1 }
]

function keyAt(index) {
    var normalized = ((Math.round(index) % 12) + 12) % 12
    return KEYS[normalized]
}

function keyByMajorName(name) {
    for (var i = 0; i < KEYS.length; i++) if (KEYS[i].major === name) return KEYS[i]
    return null
}

function keyByMinorName(name) {
    for (var i = 0; i < KEYS.length; i++) if (KEYS[i].minor === name) return KEYS[i]
    return null
}

// The two adjacent keys on the circle (a fifth up and a fifth down),
// useful for "related keys" navigation from a selected key.
function neighbors(index) {
    return { fifthUp: keyAt(index + 1), fifthDown: keyAt(index - 1) }
}

function relativeMinorOf(majorName) {
    var key = keyByMajorName(majorName)
    return key ? key.minor : null
}

function relativeMajorOf(minorName) {
    var key = keyByMinorName(minorName)
    return key ? key.major : null
}
