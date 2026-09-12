# Changelog

All notable changes to this project are documented in this file.

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
