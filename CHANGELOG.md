# Changelog

All notable changes to this project are documented in this file.

## [0.5.1] - 2026-09-14

CAGED Chord Reference and Songs-practice release, merged to `main` from
`feature/caged-reference-v051`.

### Added
- Chord Reference redesigned around Root + Chord Quality: a chord name/
  notes/formula header, the existing full fretboard chord-tone map
  (relabeled "Chord Tones" so it reads as a note map, not a claimed
  voicing), and a "CAGED Shapes" picker (C/A/G/E/D) driving one large,
  readable diagram (nut, fret numbers, open/muted strings, root
  distinction, barre indication, starting fret, note-name/interval
  toggle). CAGED shapes (`js/caged_shapes.js`) are explicit named
  open-chord forms transposed by `(targetRoot - refRoot) mod 12`, never
  derived from chord pitch classes. Full verified C/A/G/E/D coverage for
  Major; verified partial coverage (2-4 shapes) for Minor, 7, Maj7, m7,
  dim, aug, sus2, sus4 and Power - never padded to 5 shapes for
  symmetry. Sources in `docs/MUSIC_CONTENT_AUDIT.md`. CAGED is
  Standard-tuning only (an explanatory message replaces it under any
  other tuning) while the Chord Tones map keeps recalculating correctly
  everywhere.
- Reference's variable-height content (the fretboard map, and in Chord
  mode the CAGED diagram) now scrolls in a bounded, clipped box instead
  of painting outside the plugin panel; Tuning/Root, Show Intervals, and
  each mode's primary selector stay fixed and usable while scrolling.
  The Tuning/Root/Show-intervals row is responsive down to 600px width
  without ever growing past its normal size at wide panels.
- Songs moved from Progress into Practice (Metronome, Routines, Songs,
  Jam, Tempo Trainer, Timer) - it's active practice content, not
  history. Progress keeps only minutes/streak/sessions/exercise
  progress. Existing saved songs needed no migration.
- Each Song gained Lyrics (multiline, user-typed/pasted, stored locally,
  wrapped and bounded-scrollable both while editing and practicing), an
  optional Lyrics URL with an **Open Lyrics** action, and **Search
  Lyrics** - a query built only from that song's own stored Title/Artist
  (quoted exact-match, Title-only when Artist is empty), opened as an
  https web search in the system browser. Both actions read the
  currently selected song fresh at click time. Fretboard does not fetch,
  scrape, call a lyrics API, or guess a lyrics URL anywhere; lyrics and
  the lyrics link are entirely user-supplied and stay local
  (`js/url_safety.js`, `js/lyrics_search.js`). **Start Practice** reuses
  the existing routine runner (a throwaway single-item routine through
  the same path `startConfiguredRoutine` already used) rather than a
  second timer/history/metronome engine, landing on the normal Routines
  running view and recording a normal history session on completion.
- 56 new JS tests (`tests/caged_shapes.test.mjs`,
  `tests/reference_layout.test.mjs`, `tests/url_safety.test.mjs`,
  `tests/practice_songs_layout.test.mjs`, `tests/lyrics_search.test.mjs`,
  plus additions to `tests/storage.test.mjs`) covering CAGED shape
  correctness/coverage/tuning-safety, the bounded-scroll structural
  guards, URL-safety rejection of unsafe schemes, and lyrics-search
  query construction/encoding (spaces, apostrophes, punctuation,
  ampersands, Unicode). 252 total JS tests (was 196). 47 total Python
  tests, unchanged.

### Fixed
- A `ColumnLayout` quirk where one row's non-shrinkable width (or, for
  Songs, an editor box height cap that was slightly too small) silently
  forced sibling content to the wrong size at narrow widths or clipped
  the last row of a taller panel - found and fixed during this release's
  own manual acceptance passes.

### Unchanged
- Everything from v0.5.0 (configurable routine templates, Jam Sessions,
  hybrid picking, dynamic stage engine, tuner, metronome, tempo trainer,
  practice timer, local/offline architecture) and the Scale/Triad
  Reference content from earlier releases.

## [0.5.0] - 2026-09-13

Configurable routines and Jam Sessions release, merged to `main` from
`feature/dynamic-practice-v04`.

### Added
- Configurable routine templates: instead of one preset per key/box/quality
  combination, a template (Minor/Major Pentatonic, Blues, Major, Natural
  Minor, Dorian, Mixolydian, a configurable Triad, and configurable hybrid-
  picking pentatonic/triad routines) is picked from a third "Configurable"
  Routines source and configured at selection time - key/root, position
  (All, or Box 1-5 where verified coordinate data exists), quality,
  inversion, string set, BPM, duration, metronome and dynamic cycling (reusing
  the v0.4 stage engine). A configured routine is never persisted; it runs
  through the existing routine player unchanged. All 57 v0.4 presets remain
  available unchanged alongside templates.
- Jam Sessions: a new "Jam" tab with a local, generated backing track (bass,
  chord comping, drums - no samples, no downloads, no network). 8 styles:
  Major/Minor/Shuffle/Slow Blues and Major ii-V-I/Minor ii-V-i/Jazz
  Blues/Dorian Vamp, each selectable in any of the 12 keys with configurable
  tempo and duration (5/10/15/20 min or custom). Chord changes drive the
  same v0.4 stage/bar engine (extended with a looping variant so the
  progression repeats for the session instead of holding at the last
  chord), sharing its pause/resume semantics. The running view shows the
  current/next chord, bar number, remaining time and chord-tone fretboard
  guidance (plus the tonic blues/pentatonic scale as context for Blues
  styles).
- `helper/audio_engine.py` gained a `"jam"` playback mode generating a
  simple bass/chord-comp/drum backing from the active chord and a
  straight/shuffle/swing feel, using the same sample-accurate chunked-write
  architecture as the existing metronome/drone modes. Rhythm/note decisions
  are pure functions in the new `helper/jam_synth.py`, unit tested
  independently (17 new Python tests).
- `js/jam_sessions.js` (progression library, independently sourced - see
  `docs/MUSIC_CONTENT_AUDIT.md`), and looping additions to
  `js/stage_engine.js` (`loopedAutoStageIndex` and friends) so Jam Sessions
  reuse the exact same generic engine v0.4 introduced rather than a second
  sequencing engine.
- 51 new JS tests (`tests/jam_sessions.test.mjs`, `tests/
  routine_templates.test.mjs`, plus additions to `tests/stage_engine.test.
  mjs`) covering every progression's transposition across all 12 keys, bar
  timing, every configurable template, and the shared triad descriptor
  lists. 196 total JS tests (was 166), all previously-passing tests
  unchanged. 47 total Python tests (was 30).
- A fixed pre-existing null-safety gap in `panel/PracticeSection.qml`'s
  `previewShowsChordDiagram` (every sibling `preview*` helper already
  guarded against a null item; this one didn't) - found by the new
  Configurable routines preview, which can legitimately have no template
  selected yet.
- A completed Jam Session now records one practice-history entry (start
  time, duration, "Jam: <style> in <key>"), matching how a practice routine
  already records on completion - found and fixed during final acceptance
  testing.
- Final acceptance pass (offscreen Quickshell, real audio pipeline, no
  live-desktop interaction): Minor Pentatonic Boxes 1-5 in a second
  transposed key, dynamic box cycling, configurable/hybrid triads, Shuffle
  Blues, Minor Blues, C Major ii-V-I, D Minor ii-V-i, D Dorian Vamp,
  pause/resume, live chord/bar advancement against real audio-clock-paced
  bars, and the 600px narrow layout. No orphaned helper or `pw-cat`
  processes after repeated start/stop cycles.

### Unchanged
- Everything from v0.3.5 and v0.4 (all 57 presets/90 items, the dynamic
  stage engine, hybrid picking, tuner, metronome, tempo trainer, practice
  timer, progress/history, local/offline architecture).

## [0.4.0-dev] - in development on `feature/dynamic-practice-v04`

Dynamic Practice development release. Built on branch `feature/dynamic-
practice-v04`, based on marketplace-reviewed `main` at `de62e07`. Not
tagged, merged or released; `main` and the marketplace submission are
untouched.

### Added
- A generic, data-driven dynamic/staged routine engine (`js/stage_engine.js`,
  `js/routines.js`'s `hasStages`/`resolveStageItem`). A practice item can
  optionally define `stages` (partial per-stage field overrides) and an
  `advance` plan (`{ mode: "time", everySeconds }` or `{ mode: "bars",
  everyBars }`); the engine reuses the same elapsed-time/completed-bars
  authority as the existing tempo trainer rather than a UI timer. Manual
  Previous/Next rebases the clock so automatic progression resumes naturally.
  Pausing the practice timer pauses stage progression too. A whole dynamic
  routine still records as one practice-history session.
- 9 built-in dynamic/staged routines: Minor Pentatonic - All 5 Boxes,
  Pentatonic Boxes - Ascending/Descending, Triad Inversion Ladder, Triad
  String-Set Ladder, Picking Subdivision Ladder, Tempo Ladder (80→100 BPM),
  and three dynamic hybrid-picking routines (Triad Cycle, Pentatonic
  Positions, String Sets) demonstrating the same engine driving technique
  content, not just scales.
- Hybrid Picking as a Technique routine family, using the existing
  `PICKING_PATTERN` visual mode with a new P (pick) / M (middle) / R (ring)
  right-hand label vocabulary. 8 static routines: Pick + Middle Alternation,
  Pick + Middle + Ring, Pedal-Tone, String-Skipping, Major Triad, Minor
  Triad, Hybrid Picking in Thirds, and Double Stops in Sixths. See
  `docs/MUSIC_CONTENT_AUDIT.md` for independent sourcing; every coordinate is
  reused from an already-audited shape or located independently in code from
  `js/theory.js`'s own pitch-class data, never copied from a tab or diagram.
- Routine selector and running-practice UI support for dynamic routines:
  the preview detail shows the stage sequence and advance interval; the
  running view shows "Stage X of Y", the current stage's name/instructions/
  visual, a remaining-time readout for time-based routines, and manual
  Previous/Next controls - all within the existing dropdown-based Routines
  UX, no new navigation model.
- `tests/stage_engine.test.mjs` and `tests/dynamic_routines.test.mjs`, plus
  new coverage in `tests/routines.test.mjs`, for the engine, every dynamic
  routine's exact stage content, and every hybrid routine's coordinates and
  right-hand labels. 166 total JS tests (was 136), all previously-passing
  v0.3.5 tests unchanged.
- An architecture note in `docs/ARCHITECTURE.md` for the planned v0.5 Jam
  Session/backing-track feature (not implemented in v0.4), describing how it
  will reuse this same stage/advance engine for chord-change timing.

### Unchanged
- All 40 v0.3.5 presets, 73 items, six-string 0-12 scale mapping, pentatonic
  Boxes 1-5, position highlighting, 3NPS, triad shapes/inversions/string
  sets, curated chord voicings, rhythm-grid/6-8 correctness, alternate-tuning
  behavior, tuner, metronome, tempo trainer, practice timer, progress/
  history and local/offline architecture. Backing tracks/Jam Sessions remain
  unimplemented, planned for v0.5.

## [0.3.5] - 2026-09-13

Routine-selector layout release. Marketplace preparation remains paused pending
personal review.

### Changed
- Replaced the simultaneous routine-list/detail browser with two compact dropdowns:
  Category and Routine. Only the selected routine's detail and teaching visual are
  instantiated below them.
- Practice Sessions and My Routines share the same selector/detail interaction.
  Built-in category filters, user-routine editing/deletion, duplication and starting
  remain available without adding a second navigation layout.
- Routine detail is vertically scrollable inside a fixed-height surface while the
  selectors and action bar remain reachable at 800×660 and 600×660.
- Persisted source, category, built-in selection and user-routine selection are
  sanitized independently, with safe first-item fallback after filtering or deletion.

### Added
- Selector regression coverage for all categories, every built-in preset, source
  switching, persisted IDs, invalid/deleted fallback and selected visual resolution.
- A privacy-safe marketplace preview and compact README gallery captured from the
  real v0.3.5 UI with isolated synthetic state.

### Documentation
- Reworked the README around the complete guitar-practice experience, with product-
  first guidance, clearer local/offline audio and privacy disclosures, and current
  installation/removal instructions. No runtime or verified music content changed.

## [0.3.4] - 2026-09-13

Position-highlight and practice-visual release. Marketplace preparation remains
paused pending personal review.

### Changed
- Minor-pentatonic Box 1–5 selection now keeps the complete six-string 0–12 scale
  map visible, strongly emphasizes verified box coordinates, dims other valid tones
  and keeps all roots identifiable. Octave-equivalent forms are mapped into the
  fixed reference range without inventing new positions.
- Added exact major/minor/diminished/augmented triad Reference filters for root,
  first and second inversion across four adjacent string sets. Alternate tunings
  retain recalculated chord-tone context and suppress Standard-only shape claims.
- Rebuilt Practice Sessions as a bounded master/detail browser: compact list rows
  never expand on selection, only the list scrolls, and detail/visual/actions live in
  a separate pane. The running view retains the same visual while controls remain
  reachable.
- All 40 built-in sessions (73 constituent items) now resolve to shared data-driven
  visuals. Added path, picking-pattern and rhythm-grid semantics for the previously
  text-only warmup, technique and rhythm items.

### Added
- Shared `PracticeVisual` and wrapping `SequenceGrid` renderers, plus a pure browser
  projection model that regression-tests stable row/list state across selection.
- Canonical tests for contextual Box 1–5 emphasis, roots, octave handling, triad
  quality/inversion/string-set filters, visual-contract coverage, coordinate bounds,
  rhythm/metronome agreement and 6/8 grouping.
- A complete source-backed 40-preset visual/layout matrix in
  `docs/PRACTICE_VISUAL_AUDIT.md`.

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
