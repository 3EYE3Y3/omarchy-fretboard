# Testing

## Automated

```bash
npm test                                        # 133 tests, node:test + node:assert/strict
python3 -m unittest discover -s helper/tests    # 30 tests, stdlib unittest
./scripts/quality                                # everything below, plus lint/validate
```

`tests/load-qml-js.mjs` loads each `.pragma library` QML JS module into a Node `vm`
context so the same source Service.qml imports is what gets unit tested — no
reimplementation drift between "the logic" and "the tested logic."

| Module | File | Covers |
|---|---|---|
| Metronome math | `js/metronome.js` / `tests/metronome.test.mjs` | BPM clamping, click-schedule generation per time signature/subdivision, accent placement, tap-tempo averaging and reset-on-pause |
| Tempo trainer | `js/tempo_trainer.js` / `tests/tempo_trainer.test.mjs` | BPM at elapsed time/bars, ascending and descending plans, completion, the spec's 80→120 @ +5/2min example |
| Pitch/note math | `js/pitch.js` / `tests/pitch.test.mjs` | Frequency→note/octave/cents, adjustable A4, in-tune tolerance, round-trip note→frequency |
| Tunings | `js/tunings.js` / `tests/tunings.test.mjs` | All 8 built-in tunings, validation, custom-tuning creation/resolution |
| Scales & chords | `js/theory.js` / `tests/theory.test.mjs` | All 14 scale/mode entries and 11 chord families; canonical formulas, intervals, representative spellings and all-root transposition |
| Fretboard | `js/fretboard.js` / `tests/fretboard.test.mjs` | Note-at-fret math, 24+ fret board construction, scale/chord highlighting and root marking, generic "one position" fret-window search |
| Chord voicings | `js/chord_voicings.js` / `tests/chord_voicings.test.mjs` | Exact common open/barre/7/sus/power fixtures; required-tone, no-extra-tone and span checks for all 11 families in all 12 roots; deliberate suppression in non-Standard tunings |
| Circle of fifths | `js/circle_of_fifths.js` / `tests/circle_of_fifths.test.mjs` | Key order, relative major/minor pairing, sharps/flats, wraparound neighbors |
| Routines | `js/routines.js` / `tests/routines.test.mjs` | Create/add/update/remove/reorder/duplicate, and the full start→advance→complete run state machine |
| Progression suggestions | `js/progress.js` / `tests/progress.test.mjs` | Clean/Nearly/Needs Work → next-BPM suggestion (matches the spec's 100→102-105 example), practice-minute/streak/session stats |
| Persistence & migration | `js/storage.js` / `tests/storage.test.mjs` | Empty/missing file, well-formed round-trip, invalid JSON, malformed-entry recovery, missing-key backfill, schema-version migration flag, preference clamping, tuner-sensitivity default-fill/rejection |
| Practice-session presets | `js/presets.js` / `tests/presets.test.mjs` | All 7 categories present, curated size (not empty, not hundreds), unique/stable/namespaced ids, every scale/chord reference is a real id + valid note name, item shape matches `routines.js`'s `createItem` exactly (drift guard), a diatonic-triad-style progression produces one item per chord in order, duplicating a preset clears the `preset` flag and never mutates the source (JSON diff before/after), duplicating a multi-item chord progression preserves every chord |
| Independent canonical music fixtures | `tests/canonical_music.test.mjs` | Exact A-minor-pentatonic Boxes 1–5 and root coordinates, E-minor Box 1/transposition, literal six-string 0–12 maps for A minor pentatonic/C major/G major/A natural minor/D Dorian, open strings, roots, interval coverage, alternate-tuning recalculation, all formulas in all roots, E-major 3NPS, triad inversions, exact conventional chord shapes, tuning restrictions, and every positional preset coordinate |
| Position/practice visual contract | `tests/visual_system.test.mjs` | Full context plus exact Box 1–5 emphasis, octave-equivalent 0–12 shapes, roots, A major/minor inversion and four-string-set filters, diminished/augmented triads, all 73 items having a supported/valid visual, rhythm/metronome agreement, correct 6/8 grouping, and stable compact browser rows/list membership across selection |
| Manifest | `manifest.json` / `tests/manifest.test.mjs` | Schema version, non-reserved id, every kind has a matching, existing entry point |
| Click-schedule math (Python) | `helper/click_schedule.py` / `helper/tests/test_click_schedule.py` | Same tick/beat/accent math as `js/metronome.js`, verified independently on the audio engine's own side |
| YIN pitch detection | `helper/pitch_yin.py` / `helper/tests/test_pitch_yin.py` | Recovers known frequencies from synthetic sine waves (both the NumPy and pure-Python code paths), returns nothing for silence/white noise |
| Tuner noise-tolerance stabilizer | `helper/tuner_stability.py` / `helper/tests/test_tuner_stability.py` | Silence, low-level broadband noise, and a short single-hop transient never confirm a lock; a clean tone (alone, and under quiet background noise) locks quickly and accurately; a decaying tone is held through most of the decay without drifting to an unrelated pitch and releases exactly once; a steady tone never flickers once locked; Noisy Room requires a louder signal than Normal and Quiet confirms no slower than Noisy Room; every sensitivity preset's parameters are internally consistent; plus fast pure-logic unit tests of the stabilizer's confirm/hold/hysteresis/switch behavior against synthetic frames |

`scripts/quality` also runs `omarchy plugin validate .`, `qmllint` over every `.qml`
file (informational — the shared `qs.Ui`/`qs.Commons` singletons trip a handful of
known `Member ... not found on type "QObject"` false positives that also show up
linting first-party Omarchy panels; anything else is treated as real), and
`git diff --check` for whitespace hygiene.

## Manual position/practice review (v0.3.4)

Real production QML components were rendered through Quickshell's Qt offscreen
backend at both 800×660 and 600×660. Captures covered A-minor-pentatonic Boxes 1–5,
A-major root/first/second-inversion filters, every practice category, the requested
Box 1/major-scale/3NPS/thirds/triad/ii–V–I/picking/spider/string-skip/6–8 cases, a
rapid first/middle/last selection sequence, and the running Alternate Picking view.
The final run had no QML reference/type/assignment errors. The complete results are
recorded in [docs/PRACTICE_VISUAL_AUDIT.md](docs/PRACTICE_VISUAL_AUDIT.md).

## Manual scale-map review (v0.3.3)

The production `Service` → `FretboardGrid` path was rendered live at native display
resolution for A minor pentatonic, C major and G major. D Dorian was rendered through
the same production `FretboardGrid` in Qt's offscreen backend after the workstation
locked. All four showed six independent strings, frets 0–12, qualifying open strings,
octave repeats and distinct roots agreeing with the literal fixtures. Audit-only
window/default/harness changes were removed before the release diff.

## Manual visual/content audit (v0.3.2)

See `docs/MUSIC_CONTENT_AUDIT.md` for the independent source list, all-40-preset
review matrix and representative live-render checklist/results.

## Earlier manual smoke test (v0.3.1)

Performed against a live Omarchy 4.0.3 session with real audio hardware; see the
final report for exact commands. All of the following were directly observed via
`quickshell log`, `ps`/`pgrep`, and screenshots of the live panel (temporarily
defaulting a `section`/`mode`/`selectedPresetId` property to reach a view with no
mouse available in this environment, then reverting it before commit — see
"A hot-reload gotcha worth knowing" in `docs/ARCHITECTURE.md` for why that needed a
full `omarchy restart shell` rather than just a file save):

- [x] Practice opens on Metronome by default; **Routines is the second tab**, beside
      Metronome, ahead of Tempo Trainer and Timer
- [x] The preset library (Practice Sessions) is immediately visible under Routines,
      with category chips (All, Warmups, Scales, Scale Patterns, Triads, Chords,
      Technique, Rhythm) and a Start/Duplicate button per preset
- [x] Selecting a preset expands an inline preview: description, instructions,
      sequence (for multi-item progressions), pattern text, and a live fretboard
      diagram with fret numbers, string names, and root/scale-tone highlighting —
      verified against "Minor Pentatonic — Box 1"
- [x] `startPreset` (via the new IPC method) on "Alternate Picking" correctly
      configured the metronome (70 BPM, eighth-note subdivision), started the click
      audibly, and the bar icon/panel header both reflected the running BPM live
- [x] The Routines running view shows the same visual aid (fretboard + pattern text
      "↓ ↑ ↓ ↑ ↓ ↑ ↓ ↑"), current BPM with +/-/mute controls, a live countdown timer,
      and Finish/Stop Routine — all while the Practice Sessions browser remains
      visible below it
- [x] Tuner tab shows the new Tuner Sensitivity dropdown (Quiet/Normal/Noisy Room,
      default Normal) with an explanatory hint, alongside the existing device picker
      and A4 field
- [x] Live comparison against real ambient electrical hum in the room: **Normal**
      sensitivity locked onto the hum almost continuously; **Noisy Room** sensitivity
      reported "no signal" for ~97% of readings (210/217) against the identical input
      — a clear, measured improvement, not just a theoretical one
- [x] `omarchy plugin validate .` and `qmllint` pass with no new warnings beyond the
      pre-existing, known false-positive class
- [x] Stopping the metronome/preset run terminates `pw-cat`/`pw-record`; only the
      idle Python helper process remains (by design — see Architecture), confirmed
      via `ps aux` after each test
- [x] State persists correctly across a full `omarchy restart shell`, including the
      new `tunerSensitivity` preference (confirmed by reading `state.json` directly)
- [x] Fixed in this pass: a fretboard-grid header/row sizing bug (`Row` positioners
      not reliably picking up implicit height from a `Repeater`-driven child count —
      fixed with explicit row heights) and a `tempoTrainerPlan` null-dereference
      logged on every idle Tempo Trainer re-render

Known gaps (unchanged from v0.3.0, same root cause):

- [ ] Full mouse-driven click-through of every remaining control — this environment
      has no `ydotool`/mouse-automation tool without a system package install;
      keyboard-based navigation (`wtype`) was attempted but the popup surface does not
      reliably receive synthetic key events, so verification instead used the
      temporary-default technique above plus `qmllint`/`omarchy plugin validate` and
      shared-component reuse (the same `FretboardGrid`/`ChordDiagram`/`qs.Ui` controls
      proven live elsewhere). Re-run a full click-through by hand on a desktop with
      mouse access before publishing further.
- [ ] Tuner sensitivity against a real, deliberately noisy room with an actual guitar
      (validated against real ambient electrical hum plus extensive synthetic-audio
      automated tests, not yet against a real guitar note in a loud room)

Suggested manual checklist for whoever picks this up next, in one session:

1. `omarchy plugin enable io.github.3eye3y3.fretboard right`
2. Click the bar icon → panel opens on Practice → Metronome; confirm Routines is the
   second tab. Tab through controls to confirm keyboard navigation.
3. Routines → Practice Sessions: browse categories, preview a preset from each
   category, start one, duplicate one into My Routines, confirm the duplicate is
   editable and the original preset is unchanged
4. Start a routine/preset with a tempo-tracked item; let it finish or click
   Next/Finish; confirm the Clean/Nearly/Needs Work prompt appears and recording an
   outcome updates Progress → Overview's exercise progress
5. Tempo Trainer: run the spec's 80→120 @ +5 every 2 minutes example
6. Timer: start a short preset, let it complete, confirm the "session complete" state
7. Tuner: try all three sensitivity settings against real background noise and a real
   guitar string; confirm Noisy Room ignores more ambient sound than Normal, and that
   a clean plucked note still locks promptly under Normal
8. Reference: switch tuning, pick a key + scale, then a chord; confirm fretboard
   highlighting, fret numbers/string names, and chord voicings update; try the circle
   of fifths and the drone
9. `omarchy restart shell`, reopen the panel, confirm BPM/tuning/routines/history/
   tuner sensitivity persisted
10. Disable the plugin while the metronome/tuner are running; confirm no
    `pw-cat`/`pw-record`/`audio_engine.py`/`tuner_engine.py` process is left behind
    (`pgrep -af "pw-cat|pw-record|audio_engine|tuner_engine"`)
