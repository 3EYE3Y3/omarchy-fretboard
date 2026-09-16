# Fretboard

**Your guitar practice room, built into the Omarchy bar.**

![Fretboard running a Shuffle Blues Jam Session in A, current chord and fretboard guidance visible](preview.png)

Fretboard brings the tools you actually use while practising guitar into one focused
Omarchy panel: configurable guided practice, dynamic routines that advance
themselves, hybrid-picking drills, local Blues/Jazz Jam Sessions, a Scale/Triad/Chord
reference with a full CAGED system, Songs practice with your own lyrics, and the
metronome and tuner you'd expect - all local, all offline.

**No account. No cloud. No telemetry. Just pick up your guitar and practise.**

Requires Omarchy 4.0.3 or later.

## Guided practice

57 built-in practice sessions across Warmups, Scales, Scale Patterns, Triads,
Chords, Technique, and Rhythm, plus **configurable routine templates**: pick Minor
Pentatonic, another scale, or a triad shape, then choose the key/root, position or
inversion, tempo, duration, and whether it should progress automatically. Start it
and the visual, timer and metronome stay on screen while you play.

- **Dynamic routines** advance scale positions, triad inversions/string sets,
  picking subdivisions, or tempo automatically on a timer or bar count - the
  session never restarts between stages
- **Hybrid picking**: 8 dedicated routines plus configurable pentatonic and triad
  variants, using clear pick (P) / middle (M) / ring (R) right-hand notation
- Full six-string scale maps and verified pentatonic positions (Boxes 1-5, any key)
- Configurable triad shapes (root, quality, inversion, string set) with interval
  labels
- Numbered paths for scale sequences, spider drills, and string skipping
- Beat grids for subdivisions, accents, syncopation, and compound 6/8
- Editable personal routines created from the verified built-ins

## Jam Sessions

Practice over a local, generated backing track - bass, chord comping, and drums,
synthesized on your machine, never downloaded or sampled from a recording.

Pick a style (Major/Minor/Shuffle/Slow Blues, Major ii-V-I, Minor ii-V-i, Jazz
Blues, or a Dorian vamp), any of the 12 keys, a tempo, and a duration, then start
playing. The running view tracks the current and next chord, bar number, and time
remaining; the fretboard highlights the active chord's tones, plus the tonic
blues/pentatonic scale as context for Blues styles.

## Songs

Keep the songs you're learning next to Routines and Jam: title, artist, key,
tuning, BPM, notes, and your own lyrics. **Start Practice** hands the song straight
to the same routine runner as everything else, so the metronome, timer, and
practice history work exactly as they do for a routine.

Lyrics are typed or pasted by you and stored only on this device - Fretboard never
fetches, scrapes, or downloads lyrics, and never bundles any. **Search Lyrics** opens
a normal web search built only from that song's own Title/Artist in your system
browser, so you can find and read lyrics on a source you trust; **Open Lyrics**
opens an optional link you save yourself, once it's a valid `http`/`https` URL.
Neither ever reaches Fretboard itself - both are a one-way hand-off to your browser.

## Practice tools

- **Metronome:** 30–300 BPM, tap tempo, beat-one accents, visual beat indicator,
  volume, eight time signatures, and four click divisions
- **Tempo trainer:** move from a start tempo to a target by elapsed time or bars
- **Practice timer:** common presets or a custom duration, optionally linked to the
  metronome
- **Progress:** local session history, practice minutes, streaks, and user-recorded
  Clean/Nearly/Needs Work outcomes with conservative next-tempo suggestions

## Tuner

The chromatic tuner shows note, octave, frequency, and cents offset. It supports an
adjustable A4 reference, input-device selection, and Quiet/Normal/Noisy Room
sensitivity modes. Pitch detection is chromatic, so it can also listen to other
single-note instruments.

![Fretboard's chromatic tuner holding a synthetic in-tune E2](docs/screenshots/tuner.png)

## Reference

Explore 14 scales and modes as complete open-string-to-fret-12 maps. Every matching
tone is calculated independently across all six strings from the active tuning;
roots stay distinct, and labels switch between note names and intervals.

Verified A minor pentatonic Boxes 1–5 highlight their exact coordinates without
hiding the rest of the scale. The same reference includes verified
major/minor/diminished/augmented triad inversions and string sets, 11 chord families,
eight built-in tunings, custom tunings, a circle of fifths, and a reference drone.

![A minor pentatonic across all six strings with verified Box 1 highlighted](docs/screenshots/reference.png)

The bundled tunings are Standard, Drop D, D Standard, Drop C, Eb Standard, Open G,
Open D, and DADGAD. Standard-tuning chord and named-position diagrams are never
presented as valid shapes under an incompatible tuning; pitch membership still
recalculates correctly.

### CAGED chord reference

Pick a root and a chord quality (Major, Minor, 5, 7, Maj7, m7, dim, aug, sus2, sus4)
to see its name, notes, and interval formula, the complete chord-tone map across the
whole neck, and a large, readable **CAGED Shapes** diagram (C/A/G/E/D) with fret
numbers, open/muted strings, root distinction, barre indication, and a starting
fret. Major has the full five-shape CAGED set; other qualities expose only the
shapes that are genuinely conventional and independently verified (see
[music-content audit](docs/MUSIC_CONTENT_AUDIT.md)) rather than a fabricated five
for every chord. CAGED shapes are a Standard-tuning system, shown only there; the
chord-tone map keeps recalculating correctly under any tuning.

## Routines and progress

Practice Sessions are immutable templates. Duplicate one into **My Routines** to
rename, reorder, remove, or combine its items without changing the original. The
running view keeps the exercise visual, BPM, timer, metronome state, concise prompt,
and next/finish controls together while your hands are on the guitar.

Practice history and progress live only on this machine. Fretboard does not analyze
performance or claim to replace a teacher: outcomes and tempo changes are recorded
from your input. A completed Jam Session records to the same history as a routine.

## Installation

Add and enable the repository directly:

```bash
omarchy plugin add https://github.com/3EYE3Y3/omarchy-fretboard.git --enable
```

Once listed in the official marketplace, Fretboard can also be installed by its
permanent plugin ID: `io.github.3eye3y3.fretboard`.

### Removal

```bash
omarchy plugin disable io.github.3eye3y3.fretboard
omarchy plugin remove io.github.3eye3y3.fretboard --yes
```

Removal deletes the plugin code. Practice data is deliberately left at
`$XDG_STATE_HOME/omarchy/fretboard/state.json` (normally
`~/.local/state/omarchy/fretboard/state.json`) so an uninstall cannot silently erase
your history. Delete that file yourself for a complete reset.

## Usage

Click the guitar icon in the bar to open Fretboard, or run:

```bash
omarchy-shell io.github.3eye3y3.fretboard open
```

The panel starts in **Practice**, whose own sub-tabs are **Metronome**,
**Routines**, **Songs**, **Jam**, **Tempo Trainer**, and **Timer**. The panel's other
main tabs are **Tuner**, **Reference**, and **Progress**. All interactive controls
participate in the normal Qt keyboard focus chain; Escape closes the panel.

Optional IPC actions are available for shortcuts:

```bash
omarchy-shell io.github.3eye3y3.fretboard startMetronome
omarchy-shell io.github.3eye3y3.fretboard stopMetronome
omarchy-shell io.github.3eye3y3.fretboard startPreset preset-warmup-chromatic
omarchy-shell io.github.3eye3y3.fretboard startRoutine <routine-id>
```

## Audio dependencies

Fretboard uses the PipeWire command-line tools already present in Omarchy:

- `pw-cat` plays the metronome, drone, and generated Jam Session backing track
  (bass, chord comping, drums - synthesized locally, never a downloaded or sampled
  recording).
- `pw-record` captures microphone samples for the tuner.
- `/usr/bin/pactl` lists available tuner input devices through the bounded,
  closed-environment helper documented in [SECURITY.md](SECURITY.md).

`Service.qml` launches only the bundled local Python helpers, which communicate over
stdio and in turn launch those local PipeWire tools. They run without privileges,
make no network requests, and terminate their PipeWire children on shutdown.

Pitch detection uses the bundled YIN implementation. NumPy is used for its faster
FFT path when available, with a tested pure-Python fallback when it is not. No Python
package installation is required. The complete design and lifecycle are documented
in [Architecture](docs/ARCHITECTURE.md).

## Privacy and data

Fretboard has no account, cloud service, analytics, advertising, or telemetry, and
makes no background network requests. Microphone audio is processed locally in
memory for pitch detection and is not recorded to disk or transmitted.

Fretboard does not fetch or scrape lyrics. Users may explicitly open a lyrics web
search or a saved lyrics URL in their system browser. Any lyrics stored in Fretboard
are user-provided and remain local. Search Lyrics and Open Lyrics are the only two
places Fretboard ever opens a network location, and both require an explicit click:
Search Lyrics opens a generated `https://duckduckgo.com` search built only from the
selected song's own Title/Artist; Open Lyrics opens the user's own saved link, only
once it validates as a plain `http`/`https` URL. Neither transmits practice history,
routines, or saved lyrics anywhere - both are a one-way hand-off to the system
browser (`Qt.openUrlExternally`), never a shell command.

Preferences, custom tunings, routines, songs (including lyrics and the lyrics URL),
practice sessions, and progress are stored in one owner-only, atomically replaced
JSON file under XDG state storage. Built-in music/reference data remains part of the
plugin code. See [Architecture](docs/ARCHITECTURE.md) for the exact schema.

## Limitations

- The tuner detects one fundamental at a time; play a single note or harmonic, not a
  full chord.
- Guitar range E2–E4 is its primary tuning target. Very low bass notes take a little
  longer to settle.
- Input level still depends on your system microphone settings. Sensitivity changes
  confidence/noise gating, not hardware gain.
- Curated chord diagrams and named pentatonic/triad shapes are verified for Standard
  tuning. Other tunings receive accurate pitch maps without misleading shape names.
- Progress is a practice log based on your own outcome selection, not automatic
  performance grading.
- Jam Session backing tracks are simple, lightweight, locally synthesized
  accompaniment (a bass line, a chord comp, and basic drums) meant to keep time and
  outline the changes, not studio-quality production.
- Only Minor Pentatonic has a verified, transposable Box 1-5 shape today. Other
  configurable scales offer the full-fretboard map in any key.
- Only Major chords have the full five-shape CAGED set. Other qualities expose only
  the shapes that are conventional and independently verified (2-4 shapes); the
  chord-tone map remains complete for every quality.
- Search Lyrics opens a web search, not a lyrics result - Fretboard does not fetch,
  parse, or display any web page content itself.

## Development and testing

```bash
npm test
python3 -m unittest discover -s helper/tests
./scripts/quality
```

The quality gate also runs `omarchy plugin validate .`, `qmllint`, and
`git diff --check`. See [Testing](TESTING.md), the independent
[music-content audit](docs/MUSIC_CONTENT_AUDIT.md), the
[practice-visual audit](docs/PRACTICE_VISUAL_AUDIT.md), and the
[changelog](CHANGELOG.md).

## License

Fretboard is available under the [MIT License](LICENSE).
