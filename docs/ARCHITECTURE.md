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

- `helper/metronome_engine.py` renders the metronome's PCM click track and pipes it to
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
`schemaVersion` field gates migration; unreadable/corrupt state is quarantined
(renamed aside) rather than crashing the plugin, and the service starts from safe
in-memory defaults. Built-in reference data (tunings, scales, chords, starter
exercises) ships as code, not as persisted rows — user-created rows (custom tunings,
routines, exercises, songs, sessions, exercise progress, preferences) are the only
things written to disk, kept in separate top-level keys from anything seeded.

## UI

Panel content is built from the shared `qs.Ui` kit (`Panel`, `KeyboardPanel`,
`PanelKeyCatcher`, `ButtonGroup`, `Dropdown`, `NumberField`, `PanelSlider`, `Toggle`,
`Button`) and `qs.Commons` (`Style`, `Color`) tokens exactly like first-party panels,
so theming (dark/light/theme palettes, corner rounding, spacing scale) and keyboard
navigation (Tab/h/j/k/l, Escape) come for free instead of being reimplemented.
