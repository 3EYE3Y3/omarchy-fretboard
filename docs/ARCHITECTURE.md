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

Device enumeration is a separate one-shot path with two independently enforced
boundaries. `helper/audio_devices.py` directly executes the validated absolute
`/usr/bin/pactl` identity in a new session and a closed environment, incrementally
draining stdout/stderr under 256 KiB/16 KiB ceilings and a five-second deadline.
It terminates the whole process group, kill-escalates after 250 ms, and reaps on any
breach; only complete zero-exit JSON reaches the bounded 64-device parser.
`Service.qml` then incrementally supervises the helper under separate 64 KiB stdout,
8 KiB stderr, and six-second limits before parsing. See root `SECURITY.md` for the
exact environment, field ceilings, failure behavior, and adversarial proof.

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
| `routines` | `[{ id, name, items: [{ id, type, label, durationMinutes, targetBpm, metronome, scaleKey, chordKey, tuningId, visualAid, fretWindow, pattern, notes, status }], createdAt, updatedAt }]` | `type` is one of `js/routines.js`'s `ITEM_TYPES`. `visualAid` separates full pitch-set maps from exact guitar shapes; missing fields on older saved routines remain valid and fall back safely |
| `exercises` | `[{ id, name, type, description, startBpm, targetBpm, scaleId? }]` | User-created only; same shape as a built-in exercise |
| `songs` | `[{ id, title, artist, tuning, key, originalBpm, currentBpm, targetBpm, notes }]` | No lyrics/tab fields by design |
| `sessions` | `[{ startedAt, durationMinutes, routineId?, routineName? }]` | Practice history, one row per completed session/routine run |
| `exerciseProgress` | `{ [exerciseId]: { bestBpm, goalBpm, history: [{ at, bpm, outcome }] } }` | `outcome` is `clean` \| `nearly` \| `needs_work` |

A schema-version bump plus a real `migrateVxToVy` step is reserved for a change that
needs one - e.g. renaming or restructuring an existing field. Adding a new
preference or item field with a sensible default (like `tunerSensitivity`) doesn't:
`sanitizedPreferences`/`createItem` already backfill any key an older file is missing,
so old data keeps loading correctly with no extra step.

## Practice-session presets (v0.3.2 audit)

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
random id, so it can be looked up by name across restarts. A chord shape study is
authored as one item per chord sharing the same tempo/time signature, so selecting
Next reuses the existing routine runner
(`advanceRoutine`) instead of needing a new "sub-step" concept.

Presets are immutable by construction, not by convention: nothing in `Service.qml`
ever writes to `Presets.PRESET_ROUTINES`, only to `routines` (the user array).
"Editing" a preset means `Routines.duplicateRoutine()`-ing it first (`Service.
duplicatePreset`), which clears the `preset` flag, issues a fresh routine id and fresh
item ids, and appends the result to `routines` - the source object is untouched
(verified by a test that diffs the preset's JSON before/after a duplicate call).

## Visual semantics and shared components (v0.3.4)

Pitch-set membership and guitar fingering are different data. `js/visual_shapes.js`
therefore gives every visual claim an explicit mode: `FULL_FRETBOARD_SCALE`,
`POSITION`, `PENTATONIC_BOX`, `THREE_NOTES_PER_STRING`, `TRIAD_SHAPE`, `CHORD_SHAPE`,
`PATTERN`, `FRETBOARD_PATH`, `RHYTHM_GRID` or `PICKING_PATTERN`. Named shapes carry exact low-to-high string-index/fret coordinates and
a required tuning. A full-fretboard scale map is a separate open-to-fret-12 contract:
every pitch-class match is calculated independently on all six strings from the
active tuning. It is never presented as a Box, Position or 3NPS fingering.

Reference selection adds a second dimension without changing membership:
`highlighted` means a valid pitch-set member, while `isEmphasized` means the cell is
part of the verified selected box or triad shape. `PracticeVisual.qml` routes every
built-in item through shared fretboard, chord-diagram and wrapping sequence-grid
components. `preset_browser.js` resolves a sanitized source/category/selection into
dropdown options and exactly one detail object. The fixed-height detail surface owns
vertical scrolling; no simultaneous list is instantiated.

Routine selector preferences store Practice Sessions/My Routines independently,
including the built-in category and the most recent valid ID for each source. Invalid
categories or IDs safely resolve to All/first available without producing an empty
detail pane. The same `PracticeVisual` receives the active item in the running panel,
so starting a routine does not discard its teaching diagram.

`panel/FretboardGrid.qml` renders either the complete pitch-class membership map or
only those exact coordinates. `panel/ChordDiagram.qml` renders an audited shape from
`js/chord_voicings.js`. Preset preview resolves the preset's required tuning without
mutating live state; starting it applies that tuning before rendering. Chord diagrams
are restricted to Standard tuning, while the Reference fretboard continues to show
correct tuning-aware chord membership in all built-in/custom tunings.

`Fretboard.findPositionWindow(...)` remains available only as a compatibility fallback
for unclassified legacy chord material. Plain scale items without visual metadata are
treated as full-scale maps, never as density-derived positions. No audited built-in
uses the helper for a named positional claim. The complete evidence and preset review
matrix are in `docs/MUSIC_CONTENT_AUDIT.md`.

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

## Dynamic/staged practice routines (v0.4)

A practice item can now carry an optional `stages`/`advance` pair
(`js/routines.js`'s `createItem`, `hasStages`, `resolveStageItem`). Each
stage is a partial *patch* of the same fields a static item already has
(`label`, `notes`, `visualAid`, `scaleKey`, `chordKey`, `metronome`,
`targetBpm`, `fretWindow`, `pattern`) - `resolveStageItem(item, stageIndex)`
overlays the active stage's patch onto the base item (shallow-merging
`metronome` so a stage can change just `subdivisionId` while keeping the
base item's `timeSignatureId`/`startBpm`) and returns an ordinary,
non-dynamic item. Every existing consumer of "the active item" - the
fretboard/chord visual, fret window, chord voicings, tone data, label and
notes shown in the UI - reads through `Service.qml`'s `activeItem()`, which
now resolves the current stage transparently. This is the reason no other
render-layer code needed to change: a dynamic routine is invisible to
everything downstream of `activeItem()`.

`js/stage_engine.js` decides *when* the active stage changes, and is
deliberately ignorant of what a stage contains - it only ever sees a stage
count and an `{ mode: "time", everySeconds }` or `{ mode: "bars", everyBars
}` plan, mirroring `js/tempo_trainer.js`'s existing elapsed-seconds/
completed-bars authority so stage progression rides the same real clock
already used for BPM ramps, not a UI animation `Timer`. `Service.qml` owns
the runtime state (`stageStages`, `stageAdvance`, `stageIndex`,
`stageElapsedMs`/`stageResumedAt` for the paused-aware elapsed clock,
`stageBarCount` incremented from the same bar-start audio-beat message that
already drives `tempoTrainerBarCount`) and ticks `evaluateStageProgression()`
every 250ms exactly like `evaluateTempoTrainer()`. Manual Previous/Next
(`nextStage`/`previousStage`/`goToStage`) *rebases* the elapsed-time or
bar-count clock to the target stage's start instead of just overwriting the
index, so automatic progression resumes naturally from the new position on
the next tick rather than snapping back. Pausing the practice timer
(`pausePracticeTimer`/`resumePracticeTimer`) also pauses/resumes stage
progression, so a dynamic routine has exactly one pause control, matching
the existing practice-timer semantics rather than adding a second one.

A dynamic item is still exactly one routine item: `advanceRoutine`'s
existing session bookkeeping is untouched, so a whole dynamic routine still
records as one `sessions` history row, not one per stage. A dynamic item
never also runs `startTempoTrainer` - its own stage progression is the
single authority for any BPM/subdivision change it makes, avoiding two
independent progression clocks fighting over the same metronome state.

This engine is deliberately generic (see `js/stage_engine.js`'s module
comment) so a v0.5 Jam Session can reuse it for chord-change timing: a
12-bar-blues "stage" would just be `{ label: "I7", chordKey: {...},
visualAid: {...} }` advancing every N bars, the same shape a pentatonic-box
or triad-inversion stage already uses today.

## Configurable routine templates (v0.5)

v0.4 shipped one preset per key/box/quality combination (e.g. "Minor
Pentatonic - Box 1"). v0.5 adds a second, parallel kind of built-in content -
a *template* - selected and configured (key/root, position/inversion/string
set, BPM, duration, metronome, dynamic on/off) at the moment the user picks
it, rather than shipping a preset per combination. A configured template
resolves to one ordinary `createItem`-shaped item (optionally with v0.4's
`stages`/`advance` when dynamic is on) and is never persisted itself - the
caller wraps it in a throwaway `Routines.createRoutine(name, [item])` and
runs it through the existing `startRoutineObject`/`activeRoutine` machinery
completely unchanged. Both kinds of content remain selectable side by side
("Practice Sessions" / "My Routines" / "Configurable" in the Routines
source switch) - templates do not replace or remove any existing preset.

`js/presets.js`'s `SCALE_TEMPLATES` + `resolveScaleTemplate` cover scales
(Minor/Major Pentatonic, Blues, Major, Natural Minor, Dorian, Mixolydian):
position choices are limited to `boxAid`'s already-audited, root-
transposable pentatonic-box coordinates - a scale with no verified box shape
(major pentatonic, blues, the diatonic modes) only ever offers "all"
(full-fretboard membership) rather than a fabricated position. The same file
resolves the configurable hybrid-pentatonic template. Triad configuration
(root/quality/inversion/string set) needs `js/visual_shapes.js`'s
`triadShapes()` - unused by any content before v0.5 - which `presets.js`
cannot import (see this file's "small local duplication over cross-file
coupling" note above), so that resolution lives in `Service.qml`
(`resolveTriadTemplateItem`), which already imports both modules for exactly
this reason elsewhere (`activeVisualBoard()`). `presets.js` still owns the
shared, testable descriptor lists (`TRIAD_ROOTS`/`TRIAD_QUALITIES`/
`TRIAD_INVERSION_IDS`/`TRIAD_STRING_SET_IDS` and their label lookups) so the
UI and `Service.qml` agree on valid option ids without duplicating them.

## Jam Sessions (v0.5)

A local, generated backing track: a chord progression (`js/jam_sessions.js`)
drives the *same* `stages`/`advance` engine v0.4 introduced for dynamic
practice routines - one stage per chord, `{ mode: "bars", everyBars: N }`
advance so a chord change always lands on a barline regardless of BPM -
except the sequence *loops* for the session's whole duration instead of
holding at the last chord like a practice routine does. `js/stage_engine.js`
gained `loopedAutoStageIndex`/`loopedStageBarsRemaining`/`completedCycles`
for this (same clock, `%` instead of clamping) rather than a second
sequencing engine. `Service.qml` owns the runtime state and bar counting
from the same bar-start audio-beat message that already feeds v0.4's
`stageBarCount`/`tempoTrainerBarCount`.

Progressions are authored in `js/jam_sessions.js` in Roman-numeral-relative
form (a scale-degree semitone offset from the key, plus a chord quality) so
one definition transposes to any of the 12 keys by arithmetic - no per-key
duplication. 8 styles ship: Major/Minor/Shuffle/Slow Blues (the latter two
reuse the major-blues progression, differing only in tempo/feel) and Major
ii-V-I/Minor ii-V-i/Jazz Blues/Dorian Vamp. Chord qualities are a small
local interval table (major/minor/dominant7/major7/minor7/minor7b5/
diminished7) kept out of `js/theory.js`'s `CHORDS` deliberately: that list
is guitar-voicing-oriented (`tests/canonical_music.test.mjs` requires every
entry to resolve to an audited, playable shape in every root via
`js/chord_voicings.js`), while a Jam chord only ever needs a pitch-class set
for fretboard-tone highlighting, not an exact diagram - see
`docs/MUSIC_CONTENT_AUDIT.md` for progression sourcing.

Backing audio is generated locally, never a sample or a copied recording:
`helper/audio_engine.py` gained a third playback mode, `"jam"`, alongside
the existing `"metronome"`/`"drone"` modes, using the same sample-accurate,
audio-clock-paced chunked-write loop (see "Why a local helper process for
audio" above) rather than a second audio process. Per-tick note/rhythm
decisions (which eighth-note ticks carry the bass note vs. a chord-comp stab
vs. a hi-hat, a simple "boom-chick" bass pattern, and the shuffle/swing
timing offset applied only to off-beat ticks) are pure functions in
`helper/jam_synth.py`, unit tested independently of the process/PCM-mixing
code exactly like `helper/click_schedule.py` already is for the metronome;
`jam_synth.py`'s swing-offset math is entirely separate from
`click_schedule.py`, so ordinary metronome timing is provably unaffected.
Kick/snare/hi-hat are synthesized (a pitch-dropping sine sweep, decaying
white noise) rather than sampled - deliberately simple, lightweight
accompaniment, not DAW-quality drums.

Fretboard guidance highlights the current chord's tones; for Blues styles
(which stay in one key/scale for the whole progression) the tonic blues/
minor-pentatonic scale is also shown as context, reusing `Theory.buildScale`
+ `VisualShapes.highlightContext` exactly as v0.3.4's scale/box context view
already does - no new chord-scale theory claim is made for Jazz styles,
which show chord-tone membership only.

No new network/cloud/privileged dependency was introduced; the audio helper
remains a stdio-only local subprocess.

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
