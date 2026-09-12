# Fretboard

> A guitar practice companion for the Omarchy bar.

Fretboard combines the tools a guitarist actually reaches for in a practice session —
metronome, tempo trainer, practice timer, chromatic tuner, fretboard/scale/chord
reference, and practice routines with history — into one native Omarchy bar widget and
panel, instead of a pile of separate mini-apps.

## Features

**Practice essentials**
- Metronome: 30–300 BPM, tap tempo, audible click with accent on beat 1, visual beat
  indicator, volume control, 2/4 · 3/4 · 4/4 · 5/4 · 6/8 · 7/8 · 9/8 · 12/8 time
  signatures, quarter/eighth/triplet/sixteenth subdivisions
- Tempo trainer: start/target BPM, configurable increment by elapsed time or bar count
- Practice timer: 5/10/15/20/30/45/60-minute presets or a custom duration, with optional
  metronome linking
- Chromatic tuner: note, octave, frequency, cents off, adjustable A4 reference,
  input-device selection, and a Quiet/Normal/Noisy Room sensitivity setting —
  chromatic detection works for any instrument, not just guitar

**Guitar reference**
- Interactive fretboard, 24+ frets, 8 built-in tunings (Standard, Drop D, D Standard,
  Drop C, Eb Standard, Open G, Open D, DADGAD) plus custom tunings
- 12 scales/modes (major, natural minor, major/minor pentatonic, blues, harmonic minor,
  melodic minor, and the modes) with note names or interval labels on the fretboard
- 11 chord families with algorithmically found, playable voicings (not a hand-typed
  diagram database, so it works for any tuning)
- Circle of fifths with relative major/minor and sharps/flats, wired into the reference
  view
- Drone/reference tone sharing the tuner's A4 setting

**Practice coach**
- Routines is a first-class Practice tab (second, right beside Metronome) with two
  parts: **Practice Sessions**, a curated bank of 40 built-in presets across 7
  categories (Warmups, Scales, Scale Patterns, Triads, Chords, Technique, Rhythm) that
  you can browse, preview, start immediately, or duplicate into an editable routine
  without ever touching the built-in template; and **My Routines**, your own saved
  routines built from warmup/scales/chord-change/technique/song/free practice/
  ear-training/custom blocks, with reorder, duplicate, and "start entire routine"
- Starting a routine or preset configures the scale/chord and fretboard, the
  metronome or tempo trainer, and the timer for you, and shows a visual aid alongside
  it — a fretboard diagram (root distinct from other tones, interval-label toggle,
  fret numbers, string names, auto-picked "one position" window) or chord diagram for
  scale/chord-based items, a plain-text pattern/sequence for pattern and technique
  drills — plus pause/resume, a metronome mute toggle, and BPM adjustment, all without
  leaving the routine
- A small starter exercise library for the standalone-exercise flow (chromatic 1-2-3-4,
  alternate picking, spider exercise, major scale, minor pentatonic, chord-change
  drill, string skipping, rhythm subdivision) — architecture supports adding more
  without a schema change
- Clean/Nearly/Needs Work outcome tracking with a conservative next-BPM suggestion
  (user-recorded progress, not objective performance analysis)
- Song practice entries (title, artist, tuning, key, BPMs, notes — no lyrics/tabs)
- Local practice history and a Progress view (today/this-week minutes, streak, sessions,
  recent routines, BPM improvement)

No account, no cloud sync, no telemetry, no external API for any core feature.

Requires Omarchy 4.0.3 or later (schema version 1 plugin manifest).

## Install

```bash
git clone https://github.com/3EYE3Y3/omarchy-fretboard.git ~/.config/omarchy/plugins/io.github.3eye3y3.fretboard
omarchy plugin enable io.github.3eye3y3.fretboard right
```

(`omarchy plugin add <git-url> --enable` works the same way once the repository is
public.) Click the guitar icon in the bar to open the panel, or:

```bash
omarchy-shell io.github.3eye3y3.fretboard open
```

## Uninstall

```bash
omarchy plugin disable io.github.3eye3y3.fretboard
omarchy plugin remove io.github.3eye3y3.fretboard --yes
```

This removes the plugin's code. Your practice data at
`$XDG_STATE_HOME/omarchy/fretboard/state.json` (typically
`~/.local/state/omarchy/fretboard/state.json`) is left in place; delete it yourself if
you want a clean slate.

## Audio dependencies

Fretboard uses PipeWire's own CLI tools — already installed with Omarchy — for audio,
so there is nothing extra to install for the metronome, drone, or tuner to work:

- `pw-cat` renders the metronome click and drone tone.
- `pw-record` captures microphone input for the tuner.
- `pactl` (from `pipewire-pulse`) lists input devices for the tuner's device picker.

Pitch detection (`helper/pitch_yin.py`) uses [NumPy](https://numpy.org/) for a fast,
FFT-based YIN implementation when it's importable, and falls back to a smaller-window
pure-Python implementation otherwise — there is no hard dependency on NumPy, and no
step you need to take either way.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for why audio work happens in a small
local helper process rather than in QML directly.

## Tuner limitations

- Detects one fundamental pitch at a time — strumming a full chord will not give a
  useful reading. Play one note (or a natural harmonic) at a time.
- Standard guitar range (E2–E4) is where it's tuned to perform best; very low bass notes
  take a slightly longer analysis window and a moment longer to settle.
- A noisy room or a very quiet pickup/mic level will show "no signal" rather than a
  guess — the tuner never reports a note it isn't reasonably confident about. If your
  room has persistent background noise, try the **Noisy Room** sensitivity setting
  (Tuner tab); if you play quietly, try **Quiet**. Sensitivity only changes the
  noise-floor/confidence thresholds the tuner gates on, never microphone gain — turn
  your input level up in the OS if readings are inconsistent even in a quiet room.
- The tuner holds the last confirmed note for a short window through natural decay or
  a brief dropout rather than flickering to "no signal" and back — by design, so
  expect roughly a quarter- to half-second lag before it reports silence after you
  mute a string.
- It is chromatic, not guitar-specific, so it works for bass, ukulele, violin, or voice
  too; there's just no per-instrument preset beyond the adjustable A4 reference.

## Data

All local state lives in one JSON file (schema-versioned, with migrations and
malformed-data recovery from the start — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):
preferences, custom tunings, routines, custom exercises, songs, practice sessions, and
per-exercise BPM progress. Built-in tunings, scales, chords, the starter exercise
library, and the 40 practice-session presets all ship as code and are never written to
your data file, so a factory reset never touches anything you created — and duplicating
a preset into My Routines never edits the built-in template it came from.

## IPC

Beyond the standard `open`/`close`/`show`/`hide`/`toggle`, the bar widget also exposes:

```bash
omarchy-shell io.github.3eye3y3.fretboard startMetronome
omarchy-shell io.github.3eye3y3.fretboard stopMetronome
omarchy-shell io.github.3eye3y3.fretboard startPreset <preset-id>   # e.g. preset-warmup-chromatic
omarchy-shell io.github.3eye3y3.fretboard startRoutine <routine-id>
```

useful for binding a hotkey to jump straight into a specific warmup or routine.

## Keyboard use

Panel content uses Qt Quick's built-in Tab-focus-chain traversal rather than a
hand-rolled cursor: Tab/Shift+Tab moves between dropdowns, number fields, toggles,
text fields, and button groups (arrow keys/h,l then move within a focused button
group, Enter/Space activates), and every action button is reachable via Tab too.
Escape closes the panel.

## Development

```bash
npm test                    # domain-logic unit tests (node's built-in test runner)
python3 -m unittest discover -s helper/tests   # audio-helper unit tests
./scripts/quality            # full gate: tests + omarchy plugin validate + qmllint + git diff --check
```

See [TESTING.md](TESTING.md) for the full test/coverage rundown and manual smoke-test
checklist, and [CHANGELOG.md](CHANGELOG.md) for release history.
