# Changelog

All notable changes to this project are documented in this file.

## [0.3.3] - 2026-09-12

Scale-visualization correctness release. Marketplace preparation remains paused
pending personal review.

### Fixed
- General scale and mode references now render every matching pitch on every string
  from the open strings through fret 12 instead of presenting an initially clipped
  24-fret scroll surface or falling back to a density-selected position window.
- Full-scale practice aids now use the same explicit open-to-octave visual contract.
  Named positions, pentatonic boxes, 3NPS forms, patterns, triads and chords retain
  their exact canonical coordinates and compact coordinate-derived ranges.
- `FretboardGrid` clamps requested ranges to the board before independently slicing
  each string, keeping its fret header and all six rows synchronized.

### Added
- Literal six-string fixtures for A minor pentatonic, C major, G major, A natural
  minor and D Dorian over frets 0–12, covering completeness, roots, open strings,
  interval labels and exclusion of non-scale tones.
- An alternate-tuning fixture proving that full maps recalculate positions from the
  actual open-string pitches.

## [0.3.2] - 2026-09-12

Correctness audit release. Marketplace preparation remains paused pending personal
review.

### Fixed
- Replaced the density-selected fret window mislabeled as Minor Pentatonic Box 1 with
  independently verified exact string/fret data, and added canonical transposable
  fixtures for all five A-minor-pentatonic boxes plus E-minor Box 1.
- Separated pitch-class membership from guitar-shape claims through explicit visual
  modes for full fretboards, positions, pentatonic boxes, 3NPS shapes, triads, chord
  shapes and patterns. Built-in positional labels now render exact coordinates.
- Replaced greedy chord-tone placement with curated, validated Standard-tuning open,
  E-root and A-root shapes. Diagrams require every chord tone, exclude non-chord
  tones, enforce a playable span and are not shown under incompatible tunings.
- Corrected compound-meter modeling: 6/8 now has two dotted-quarter beats with three
  written eighth-note ticks per beat; 9/8 and 12/8 use three and four compound beats.
  Global subdivision labels now state clicks per beat so they remain truthful in
  simple, odd and compound meters.
- Corrected scale/mode formulas and enharmonic spelling, added explicit Ionian and
  Aeolian entries, and exposed formulas in the Reference view.
- Audited and corrected the title, instructions, visual, picking/rhythm data and
  metronome behavior of every one of the 40 built-in practice presets. Progression
  items are now accurately called timed shape studies/cycles.
- Corrected chord-diagram fret labels and made the circle's F#/Gb and Db/C# seam
  explicit.

### Added
- Independent canonical music fixtures and the source-backed audit report at
  `docs/MUSIC_CONTENT_AUDIT.md`, including an explicit PASS/FAIL matrix for all 40
  presets and representative manual visual comparisons.

## [0.3.1] - 2026-09-12

A focused polish/update release driven by user acceptance feedback on v0.3.0. No
unrelated features added.

### Changed
- Practice's sub-tab order is now Metronome, **Routines**, Tempo Trainer, Timer -
  Routines sits second, beside Metronome, instead of last
- The Routines tab is now a two-part experience: a **Practice Sessions** browser
  (built-in presets) and **My Routines** (user-created), with a prominent "Running"
  panel shown above both whenever a routine or preset is active
- Tuner readings are now temporally stabilized (see Added) instead of reporting each
  ~21ms YIN frame directly - noticeably calmer in an ordinary room

### Added
- A curated bank of 40 built-in **practice-session presets** across all 7 requested
  categories (Warmups, Scales, Scale Patterns, Triads, Chords, Technique, Rhythm).
  Presets ship as code (`js/presets.js`), are never written to the user's state file,
  and can be browsed, previewed (description/instructions/visual aid), started
  immediately, or duplicated into My Routines for editing - duplicating never
  mutates the built-in template
- A **visual aid** in the Routines running view and the preset preview: a fretboard
  diagram (fret numbers, string names, highlighted scale/chord tones, root
  distinction, interval-label toggle) auto-windowed to a compact "position" via a new
  generic `Fretboard.findPositionWindow` helper, plus chord diagrams for chord/
  progression items and a textual pattern/sequence list (including picking-direction
  hints) for pattern-style exercises - `panel/FretboardGrid.qml` and
  `panel/ChordDiagram.qml` are now shared components used by both Reference and
  Routines instead of duplicated inline QML
- A Clean/Nearly/Needs Work outcome prompt when finishing a tempo-tracked routine
  item, reusing the existing BPM-suggestion/history model (previously wired for
  standalone exercises only, not routine items)
- Pause/resume, a metronome mute toggle, and +/- BPM adjustment directly in the
  Routines running view, without leaving the routine
- **Tuner sensitivity** setting (Quiet / Normal / Noisy Room, default Normal):
  changes the noise-floor RMS and YIN-confidence gates the tuner requires before
  trusting a reading - never microphone gain. Backed by a new temporal
  `NoteStabilizer` (`helper/tuner_stability.py`) that gates on RMS/clarity,
  requires several consecutive agreeing frames before confirming a new note
  (rejecting single-frame transients outright), applies hysteresis so a decaying
  string's harmonics don't bounce the display between notes, holds the last note
  through brief dropouts/decay instead of flickering to "no signal," and smooths the
  displayed frequency once locked
- `startPreset`/`startRoutine` IPC methods on the bar widget, for starting a specific
  practice session or routine without opening the panel first

### Fixed
- A fretboard-grid rendering bug where the fret-number header row and (in one
  reduced case) the whole grid could collapse to zero height, from `Row` positioners
  not reliably picking up a `Repeater`-driven child count as their implicit size -
  both the header and each string row now size explicitly
- A null-dereference in the Tempo Trainer view that logged a `TypeError` on every
  idle re-render (accessing `tempoTrainerPlan.targetBpm` before checking the plan
  was non-null)

## [0.3.0] - 2026-09-12

### Added (Practice Coach)
- Practice routines built from warmup/scales/chord-change/technique/song/free
  practice/ear-training/custom blocks, with create/edit/duplicate/delete/reorder
- "Start entire routine" integrated practice mode: configures the scale/fretboard,
  metronome or tempo trainer, and timer for the current item automatically, with
  next-item preview and overall progress
- A starter exercise library (chromatic 1-2-3-4, alternate picking, spider exercise,
  major scale, minor pentatonic, chord-change drill, string skipping, rhythm
  subdivision)
- Clean/Nearly/Needs Work outcome recording with a conservative next-BPM suggestion
- Saved song practice entries (title, artist, tuning, key, BPMs, notes)
- Local practice history and a Progress view (today/week minutes, streak, sessions,
  recent sessions, per-exercise BPM improvement)

## [0.2.0] - 2026-09-12

### Added (Guitar Reference)
- Interactive fretboard (24+ frets) with note-name or interval-label display
- 8 built-in tunings (Standard, Drop D, D Standard, Drop C, Eb Standard, Open G,
  Open D, DADGAD) plus a custom-tuning data model
- 12 scales/modes and 11 chord families, with algorithmic (not hand-typed) chord
  voicing generation that works across any tuning
- Circle of fifths, wired into key/scale selection
- Drone/reference tone sharing the tuner's A4 reference pitch

## [0.1.0] - 2026-09-12

### Added (Practice Essentials)
- Metronome: 30-300 BPM, tap tempo, audible click with accent on beat 1, visual beat
  indicator synced to the audio clock, volume control, 8 time signatures, 4
  subdivisions
- Tempo trainer: start/target BPM with increment by elapsed time or bar count
- Practice timer: minute presets plus custom duration, optional metronome linking
- Chromatic tuner: YIN-based pitch detection over PipeWire, note/octave/frequency/
  cents display, adjustable A4 reference, input-device selection
- Atomic, schema-versioned local JSON persistence with malformed-data recovery
- Bar widget (guitar icon, live BPM when running) and popup panel following the
  Omarchy third-party plugin contract
