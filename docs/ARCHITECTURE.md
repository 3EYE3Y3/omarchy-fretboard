# Architecture

Fretboard follows the same public third-party Omarchy shell plugin contract used by
this author's other plugins (see `omarchy-departures`): a `service` entry point that
owns state and long-running work, a `bar-widget` entry point that renders the compact
bar button and hosts the popup panel, and plain `.pragma library` JS modules for all
testable domain logic. Nothing here reads private manifest fields (e.g.
`manifest.__sourceDir`); plugin-local resources are resolved with `Qt.resolvedUrl`.

Environment inspected before building (2026-09-12): Omarchy `4.0.3-1`, shell plugin
API documented at `/usr/share/omarchy/default/agents/skills/omarchy/plugins.md` plus
the `qs.Ui` / `qs.Commons` component kit at `/usr/share/omarchy/shell/{Ui,Commons}`.
`omarchy plugin validate` mirrors the schema the shell enforces — this repo validates
clean against it. Reference plugins inspected for lifecycle/persistence/panel
patterns: `~/Projects/omarchy-departures` (service + bar-widget + popup panel, atomic
JSON persistence, schema migration) and `~/Projects/omarchy-portal`.

## Why a local helper process for audio

QML/Quickshell has no low-latency audio capture API, and no sample-accurate playback
scheduling API, reachable from a third-party plugin. Two different local helper
processes (spawned via `Quickshell.Io.Process`, stdio-only, no network) handle the two
jobs that must be audio-clock-accurate rather than UI-timer-accurate:

- `helper/audio_engine.py` renders the metronome's PCM click track (or, in drone mode,
  a sustained sine tone at a given frequency) and pipes it to
  `pw-cat --playback`. Pacing comes from the audio sink's own blocking write, not from
  `sleep()`/QML `Timer` — the classic "schedule against the hardware clock" pattern,
  which is immune to UI-thread jitter and desktop load. It reports each rendered beat
  (bar position, accent flag, audio-relative timestamp) back over stdout so the QML
  visual beat indicator flashes in sync with what is actually audible, instead of
  running its own independently-scheduled timer that could drift from the sound.
- `helper/tuner_engine.py` spawns `pw-record --format f32 -a -` (optionally
  `--target <node>` for device selection), buffers a window of samples, and runs YIN
  pitch detection, emitting `{freq, clarity, rms}` JSON lines. Note name / octave /
  cents conversion happens in testable JS (`js/pitch.js`) — the helper only ever
  reports a raw frequency, so the reference-pitch (A4) math has one home and one test
  suite. If NumPy is importable, YIN runs vectorized (FFT-based); otherwise it falls
  back to a smaller-window pure-Python difference function. Either path is exercised
  in `helper/tests/`. No PortAudio/sounddevice binding is required — only the
  PipeWire CLI tools already installed with Omarchy (`pw-record`, `pw-cat`, `pactl`
  for device enumeration), so there is no privileged system package to install.

### Tuner noise tolerance (v0.3.1)

YIN answers "what pitch is in this one ~85ms window" with no memory of the previous
window, which makes a bare reading reactive to every bit of room noise. Rather than
replacing YIN, `helper/tuner_stability.py`'s `NoteStabilizer` sits between it and the
UI and turns a stream of raw per-frame readings into a calmer "what should the user be
shown right now": it gates each frame on RMS and YIN clarity (both sensitivity-
dependent), requires several consecutive *agreeing* candidates before reporting a new
note (a single-frame spike or a short transient click never gets confirmed), applies
hysteresis once locked so a decaying string's harmonics drifting a few cents — or
briefly favoring an overtone — doesn't bounce the display between notes, holds the
locked note through a handful of failing/quiet frames before releasing to "no signal"
(so a natural decay reads as one note fading rather than a flicker), and smooths the
displayed frequency while locked. `tuner_engine.py` feeds every `pitch_yin.estimate_
pitch()` result through one `NoteStabilizer` instance and reports only its output.

The **Quiet / Normal / Noisy Room** sensitivity setting selects one of three parameter
presets (`SENSITIVITY_PRESETS`) for the stabilizer's RMS floor, clarity floor, YIN
threshold, confirm/hold frame counts, and cents tolerances — it never touches
microphone gain. Changing it restarts the tuner helper with a different
`--sensitivity` argument, the same pattern already used for `--target` (device
selection). `helper/tests/test_tuner_stability.py` exercises this against both
synthetic `(frequency, clarity, rms)` frames and full synthetic audio (clean tones,
tone-plus-noise, decaying tones, short transients, silence, low-level broadband
noise) run through the exact hop/window loop `tuner_engine.py` uses.

Both helpers are plain stdio processes: control in via newline-delimited JSON on
stdin, status/results out via newline-delimited JSON on stdout. `Service.qml` owns
their lifecycle (start on demand, stop and wait on panel close / plugin disable /
shell reload) and never leaves an orphaned `pw-record`/`pw-cat` holding the device —
each helper installs a `SIGTERM` handler that terminates its own PipeWire child before
exiting, so `Service.qml` only ever has to terminate the one direct child process it
spawned.

## Persistence

State lives at `$XDG_STATE_HOME/omarchy/fretboard/state.json` (falling back to
`~/.local/state`), written with the same atomic pattern as `omarchy-departures`:
serialize, write to a `mktemp` sibling with `umask 077`, `mv -f` into place. A
`schemaVersion` field gates migration (`js/storage.js`). Invalid JSON or an
unexpected shape never crashes the plugin: `Storage.decode` reports `ok: false`, the
service falls back to safe in-memory defaults for that run, and — matching
`omarchy-departures`'s "keeping it untouched" approach — the unreadable file on disk
is left exactly as it was rather than being overwritten, so nothing is silently lost;
it's only replaced once the user makes a change that triggers a fresh save. Within an
otherwise-valid file, individual malformed rows (a routine missing an `id`, a session
missing `startedAt`, …) are dropped rather than failing the whole load, and missing
top-level keys are backfilled from defaults.

Built-in reference data (tunings, scales, chords, the starter exercise library, and
the 40 practice-session presets) ships as code in `js/tunings.js` / `js/theory.js` /
`js/exercises.js` / `js/presets.js` and is never written to disk. Only user-created
rows persist, each in its own top-level key so a shipped default can never collide
with something the user made:

| Key | Shape | Notes |
|---|---|---|
| `preferences` | `{ a4, defaultTuningId, metronomeVolume, lastTimeSignatureId, lastSubdivisionId, tunerInputDevice, tunerSensitivity }` | Single object. `tunerSensitivity` was added in v0.3.1 as a plain additive default (see below) - no migration needed |
| `customTunings` | `[{ id, name, notes: string[], custom: true }]` | `notes` are `"E2"`-style strings, low string first |
| `routines` | `[{ id, name, items: [{ id, type, label, durationMinutes, targetBpm, metronome, scaleKey, chordKey, fretWindow, pattern, notes, status }], createdAt, updatedAt }]` | `type` is one of `js/routines.js`'s `ITEM_TYPES`. `chordKey`/`fretWindow`/`pattern` added in v0.3.1 so a duplicated preset's chord/pattern data survives the copy |
| `exercises` | `[{ id, name, type, description, startBpm, targetBpm, scaleId? }]` | User-created only; same shape as a built-in exercise |
| `songs` | `[{ id, title, artist, tuning, key, originalBpm, currentBpm, targetBpm, notes }]` | No lyrics/tab fields by design |
| `sessions` | `[{ startedAt, durationMinutes, routineId?, routineName? }]` | Practice history, one row per completed session/routine run |
| `exerciseProgress` | `{ [exerciseId]: { bestBpm, goalBpm, history: [{ at, bpm, outcome }] } }` | `outcome` is `clean` \| `nearly` \| `needs_work` |

A schema-version bump plus a real `migrateVxToVy` step is reserved for a change that
needs one - e.g. renaming or restructuring an existing field. Adding a new
preference or item field with a sensible default (like `tunerSensitivity`) doesn't:
`sanitizedPreferences`/`createItem` already backfill any key an older file is missing,
so old data keeps loading correctly with no extra step.

## Practice-session presets (v0.3.1)

`js/presets.js` authors 40 built-in routines directly in the same shape
`js/routines.js`'s `createItem`/routine objects use, rather than importing
`routines.js` (QML's `import "x.js" as Y` between two `.pragma library` files isn't
something the plain-Node test harness can execute, and this codebase's established
convention is small local duplication over cross-file coupling - see
`pitchClassIndex`/`parseNoteName` repeated across `theory.js`/`fretboard.js`/
`pitch.js`/`chord_voicings.js`). `tests/presets.test.mjs` cross-checks every preset
item's keys against `Routines.createItem({})`'s own keys so the two shapes can't
silently drift apart.

Each preset is a `{ id, name, category, description, items, preset: true }` routine
with a **stable, hand-assigned id** (`preset-*`) instead of `routines.js`'s normal
random id, so it can be looked up by name across restarts. A chord progression (e.g.
"I-IV-V Progression") is authored as one item per chord sharing the same tempo/time
signature, so stepping through it reuses the existing routine runner
(`advanceRoutine`) instead of needing a new "sub-step" concept.

Presets are immutable by construction, not by convention: nothing in `Service.qml`
ever writes to `Presets.PRESET_ROUTINES`, only to `routines` (the user array).
"Editing" a preset means `Routines.duplicateRoutine()`-ing it first (`Service.
duplicatePreset`), which clears the `preset` flag, issues a fresh routine id and fresh
item ids, and appends the result to `routines` - the source object is untouched
(verified by a test that diffs the preset's JSON before/after a duplicate call).

## Shared visual-aid components (v0.3.1)

`panel/FretboardGrid.qml` (fret numbers, string names, highlighted scale/chord tones,
root distinction, interval-label toggle, and an optional `startFret`/`endFret`
display window) and `panel/ChordDiagram.qml` (a compact chord-box diagram for one
`js/chord_voicings.js` voicing) were extracted from `ReferenceSection.qml` into
standalone files specifically so the Routines running view and the preset preview
could reuse them instead of hand-building a second copy per feature - "do not create
bespoke QML for each exercise" extends to the viewer, not just the data. The Routines
running view drives them from the *live* service state (`currentFretboard()`,
`currentToneData()`, `currentChordVoicings()`, `activeItemFretWindow()`) since
`applyRoutineItem` already points those at the running item; the preset *preview* (not
yet started) computes the same data locally and read-only, from the preset's own item
straight through `Theory`/`Fretboard`/`Voicings`, specifically so browsing presets
never mutates the live Reference tab's selection.

`Fretboard.findPositionWindow(tuningNotes, pitchClassSet, fretCount, width)` picks a
generic "one position" box - a fixed-width fret window containing the most scale/chord
tones across every string - so scale-type items get a compact, readable diagram
without any exercise hand-tuning a fret range. It's a density search, not a lookup of
named shapes (a real player's "box 1," "box 2," etc.), so it won't always reproduce a
textbook fingering; preset copy is written to avoid overpromising exact shapes.

## UI

Panel content is built from the shared `qs.Ui` kit (`Panel`, `KeyboardPanel`,
`ButtonGroup`, `Dropdown`, `NumberField`, `PanelSlider`, `Toggle`, `Button`) and
`qs.Commons` (`Style`, `Color`) tokens exactly like first-party panels, so theming
(dark/light/theme palettes, corner rounding, spacing scale) comes for free instead of
being reimplemented. Keyboard use relies on Qt Quick's own Tab-focus-chain traversal
across every `activeFocusOnTab` control (`ButtonGroup`, `Dropdown`, `Toggle`, text
fields, `NumberField`'s spin box) plus `focusable: true` on the panel's action buttons,
rather than `qs.Ui`'s `PanelKeyCatcher` cursor model: that component always marks Tab
as accepted for a panel-owned cursor/`hasCursor` highlight scheme, and reimplementing
that scheme across four fairly dense section views was judged not worth it for this
build. `ButtonGroup`'s own Left/Right/h/l + Enter/Space handling still works once Tab
reaches it, and Escape closes the panel from a plain `Keys.onEscapePressed`.

## A hot-reload gotcha worth knowing

Saving a file under `~/.config/omarchy/plugins/<id>/` live-reloads that plugin's QML
(`Local plugin changed, reloading: <id>` in `quickshell log`), but this preserves the
*already-instantiated* object graph's current property values - it does not
re-initialize them from the source's declared defaults. Concretely: if `Panel.section`
is currently `"reference"` (the user navigated there) and a plugin edit changes the
declared default from `property string section: "practice"` to something else, the
live object keeps showing `"reference"` until it is torn down and recreated. Only a
full `omarchy plugin disable`+`enable` cycle - or `omarchy restart shell` - actually
discards the old instance. This tripped up manual verification of a default-value
change during v0.3.1 (see `TESTING.md`) enough to be worth writing down: when a
behavior change isn't showing up after a save, restart the shell before assuming the
code is wrong.
