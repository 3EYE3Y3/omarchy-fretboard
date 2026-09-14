.pragma library

// Builds a lyrics *search* URL from a Song's stored Title/Artist -- never a
// lyrics URL itself. Fretboard does not fetch, scrape, or call any lyrics
// API: the generated URL is only ever handed to Qt.openUrlExternally so the
// user's own system browser runs a normal web search and the user picks
// whichever legitimate source they trust. Title/Artist are used exactly as
// the user stored them (only leading/trailing whitespace is trimmed) --
// never inferred, normalized, autocompleted, substituted, corrected, or
// guessed.

// encodeURIComponent leaves !'()* unescaped (a long-standing JS quirk from
// RFC2396 "mark" characters); RFC3986 treats them as reserved. Escaping them
// too keeps the query byte-exact and avoids any ambiguity in how a browser
// or search engine parses e.g. a literal apostrophe in an artist name.
function strictEncodeURIComponent(value) {
    return encodeURIComponent(value).replace(/[!'()*]/g, function (c) {
        return "%" + c.charCodeAt(0).toString(16).toUpperCase()
    })
}

// True whenever Search Lyrics should be enabled: a non-empty (after
// trimming) Title. Artist is optional.
function canSearchLyrics(title) {
    return String(title || "").trim() !== ""
}

// Returns the exact search query text (unencoded), or null if there is no
// Title to search for. Exposed separately from the URL builder so tests and
// callers can assert on the human-readable query independent of encoding.
function lyricsSearchQuery(title, artist) {
    var t = String(title || "").trim()
    if (t === "") return null
    var a = String(artist || "").trim()
    return a !== "" ? ('"' + a + '" "' + t + '" lyrics') : ('"' + t + '" lyrics')
}

// Returns a complete https search URL for the given Title/Artist, or null
// when there is no Title. Always reflects exactly the two values passed in
// -- callers must read the currently selected Song's current field values
// at click time rather than caching a query from an earlier selection.
function buildLyricsSearchUrl(title, artist) {
    var query = lyricsSearchQuery(title, artist)
    if (query === null) return null
    return "https://duckduckgo.com/?q=" + strictEncodeURIComponent(query)
}
