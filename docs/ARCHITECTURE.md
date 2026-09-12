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

Built-in reference data (tunings, scales, chords, the starter exercise library) ships
as code in `js/tunings.js` / `js/theory.js` / `js/exercises.js` and is never written to
disk. Only user-created rows persist, each in its own top-level key so a shipped
default can never collide with something the user made:

| Key | Shape | Notes |
|---|---|---|
| `preferences` | `{ a4, defaultTuningId, metronomeVolume, lastTimeSignatureId, lastSubdivisionId, tunerInputDevice }` | Single object |
| `customTunings` | `[{ id, name, notes: string[], custom: true }]` | `notes` are `"E2"`-style strings, low string first |
| `routines` | `[{ id, name, items: [{ id, type, label, durationMinutes, targetBpm, metronome, scaleKey, notes, status }], createdAt, updatedAt }]` | `type` is one of `js/routines.js`'s `ITEM_TYPES` |
| `exercises` | `[{ id, name, type, description, startBpm, targetBpm, scaleId? }]` | User-created only; same shape as a built-in exercise |
| `songs` | `[{ id, title, artist, tuning, key, originalBpm, currentBpm, targetBpm, notes }]` | No lyrics/tab fields by design |
| `sessions` | `[{ startedAt, durationMinutes, routineId?, routineName? }]` | Practice history, one row per completed session/routine run |
| `exerciseProgress` | `{ [exerciseId]: { bestBpm, goalBpm, history: [{ at, bpm, outcome }] } }` | `outcome` is `clean` \| `nearly` \| `needs_work` |

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
