# Testing

## Automated

```bash
npm test                                        # 84 tests, node:test + node:assert/strict
python3 -m unittest discover -s helper/tests    # 14 tests, stdlib unittest
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
| Scales & chords | `js/theory.js` / `tests/theory.test.mjs` | All 12 scales and 11 chord families construct the correct notes/formula in multiple keys |
| Fretboard | `js/fretboard.js` / `tests/fretboard.test.mjs` | Note-at-fret math, 24+ fret board construction, scale/chord highlighting and root marking |
| Chord voicings | `js/chord_voicings.js` / `tests/chord_voicings.test.mjs` | Reproduces the textbook open-E-major shape exactly; invariant checks (root present, only chord tones, playable span) across 7 chords/tunings |
| Circle of fifths | `js/circle_of_fifths.js` / `tests/circle_of_fifths.test.mjs` | Key order, relative major/minor pairing, sharps/flats, wraparound neighbors |
| Routines | `js/routines.js` / `tests/routines.test.mjs` | Create/add/update/remove/reorder/duplicate, and the full start→advance→complete run state machine |
| Progression suggestions | `js/progress.js` / `tests/progress.test.mjs` | Clean/Nearly/Needs Work → next-BPM suggestion (matches the spec's 100→102-105 example), practice-minute/streak/session stats |
| Persistence & migration | `js/storage.js` / `tests/storage.test.mjs` | Empty/missing file, well-formed round-trip, invalid JSON, malformed-entry recovery, missing-key backfill, schema-version migration flag, preference clamping |
| Manifest | `manifest.json` / `tests/manifest.test.mjs` | Schema version, non-reserved id, every kind has a matching, existing entry point |
| Click-schedule math (Python) | `helper/click_schedule.py` / `helper/tests/test_click_schedule.py` | Same tick/beat/accent math as `js/metronome.js`, verified independently on the audio engine's own side |
| YIN pitch detection | `helper/pitch_yin.py` / `helper/tests/test_pitch_yin.py` | Recovers known frequencies from synthetic sine waves (both the NumPy and pure-Python code paths), returns nothing for silence/white noise |

`scripts/quality` also runs `omarchy plugin validate .`, `qmllint` over every `.qml`
file (informational — the shared `qs.Ui`/`qs.Commons` singletons trip a handful of
known `Member ... not found on type "QObject"` false positives that also show up
linting first-party Omarchy panels; anything else is treated as real), and
`git diff --check` for whitespace hygiene.

## Manual smoke test

Performed against a live Omarchy 4.0.3 session (see the final report for the exact
commands/observations from this build):

- [x] Bar shows the guitar icon; clicking it opens the panel
- [x] Panel loads with Practice/Tuner/Reference/Progress navigation
- [x] Metronome start/stop via IPC (`omarchy-shell <id> startMetronome`/`stopMetronome`)
      spawns/stops `pw-cat` correctly, bar icon reflects running state + live BPM, beat
      indicator advances in sync with audio
- [x] Plugin discovered and reloaded live after edits (`Local plugin changed, reloading`
      in `quickshell log`) with no QML load errors
- [x] `omarchy plugin validate .` passes
- [x] Stopping the metronome terminates `pw-cat`; no orphaned audio process left running
      (confirmed via `ps aux`)
- [ ] Full mouse-driven click-through of every Tuner/Reference/Progress control —
      not recorded with screenshots in this environment (no `ydotool`/mouse-automation
      tool available without a system package install); covered instead by clean
      `qmllint`, `omarchy plugin validate`, and the fact that these views are built from
      the exact same `qs.Ui` components (`Dropdown`, `NumberField`, `ButtonGroup`,
      `PanelSlider`, `Button`) proven live in the Practice/Metronome view above. Re-run
      this by hand before publishing a release build on a desktop with mouse access.
- [ ] Tuner against a real guitar (only tested against a live microphone picking up
      ambient room noise and correctly returning "no signal" below the confidence
      threshold, and separately against synthetic sine waves at exact guitar-string
      frequencies in the automated tests)
- [ ] Full "start entire routine" walkthrough end to end with a real routine on-screen
- [ ] Reboot/reload persistence (state file survives an `omarchy restart shell`)

Suggested manual checklist for whoever picks this up next, in one session:

1. `omarchy plugin enable io.github.3eye3y3.fretboard right`
2. Click the bar icon → panel opens; Tab through controls to confirm keyboard
   navigation (ButtonGroups/Dropdowns/NumberFields/Toggles/text fields are
   `activeFocusOnTab`; plain action buttons are `focusable: true` so Tab reaches Start/
   Stop, Tap Tempo, Add Item, etc. too)
2. Practice → Metronome: change BPM by typing, +/-, and tap tempo; change time
   signature/subdivision while running; confirm the click is audible and on time
3. Practice → Tempo Trainer: run the spec's 80→120 @ +5 every 2 minutes example
4. Practice → Timer: start a short preset, let it complete, confirm the "session
   complete" state and optional metronome linking
5. Practice → Routines: build a routine with 2-3 items, start it, advance through it,
   confirm history is recorded in Progress → Overview
6. Tuner: pick an input device, tune a real string, confirm note/cents/in-tune state
7. Reference: switch tuning, pick a key + scale, then a chord; confirm fretboard
   highlighting and chord voicings update; try the circle of fifths and the drone
8. `omarchy restart shell`, reopen the panel, confirm BPM/tuning/routines/history
   persisted
9. Disable the plugin (`omarchy plugin disable ...`) while the metronome/tuner are
   running; confirm no `pw-cat`/`pw-record`/`audio_engine.py`/`tuner_engine.py`
   process is left behind (`pgrep -af "pw-cat|pw-record|audio_engine|tuner_engine"`)
