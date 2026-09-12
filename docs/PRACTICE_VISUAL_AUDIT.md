# Practice visual and routine-selector audit

## v0.3.5 selector/layout follow-up

The v0.3.4 list/master-detail browser has been replaced by Category and Routine
dropdowns followed by exactly one selected detail. The detail content scrolls within
a fixed 330px surface; its action bar does not scroll. Practice Sessions and My
Routines preserve separate selected IDs, while the built-in category is also
persisted. Invalid categories, stale IDs and deleted user routines fall back safely.

Offscreen production-QML acceptance at 800×660 and 600×660 exercised all seven
categories, first/middle/last rapid selection, Practice Sessions/My Routines switching,
the bounded dropdown popup and the Running view. The Practice section remained 454px
tall with no binding loop, reference, assignment, clipping or horizontal-overflow
errors. No music or preset data changed: the 40-row v0.3.4 matrix below remains valid.

## v0.3.4 visual/position audit

Audit date: 2026-09-13. Marketplace preparation remained paused. This review
preserved the v0.3.3 scale, spelling, tuning, chord, meter and canonical-coordinate
fixtures and reviewed every built-in session separately.

## Independent references

- [Gibson App — A Minor Pentatonic, all five shapes](https://www.gibson.app/learn/scales/a-minor-pentatonic): independent all-neck/shape distinction, Box 1 at frets 5–8, Boxes 2–5, movable transposition, and octave-equivalent Shape 5 at frets 2–5 or 14–17.
- [Sweetwater — Five Positions of the Minor Pentatonic](https://www.sweetwater.com/insync/5-positions-of-the-minor-pentatonic-guitar-lesson/): independent coordinate-bearing tabs/diagrams and root-position descriptions for all five A-minor positions.
- [Godfrey Guitar Lessons — Major, Minor and Diminished Triads (PDF)](https://www.godfreyguitarlessons.com/_files/ugd/f64270_4913e598b2dc4845a2b5247b0e99d08b.pdf) and [Hub Guitar — Guitar Triads Chart](https://hubguitar.com/fretboard/guitar-triads-chart): adjacent-string-set triad shapes and inversion ordering.
- [Open Music Theory — Triads](https://viva.pressbooks.pub/openmusictheory/chapter/triads/): root/third/fifth quality and inversion definitions.
- Scale, chord, tuning, rhythm and technique sources remain those recorded in the
  comprehensive [music-content audit](MUSIC_CONTENT_AUDIT.md); their canonical data
  was regression-tested rather than rewritten in this release.

No source diagrams were copied. Fretboard renders its own coordinate and sequence
data.

## Model and UI findings

`highlighted` continues to mean “is a valid member of the selected scale/chord.” The
new independent `isEmphasized` flag means “belongs to the verified selected teaching
shape.” A Box selection therefore cannot erase valid scale tones or masquerade as the
whole scale. Roots remain root-colored in both the emphasized shape and dim context.

Minor-pentatonic Boxes 1–5 are the only named scale positions exposed in Reference.
All use their canonical Standard-tuning coordinates. The fixed 0–12 map uses an
octave-equivalent occurrence where a conventional form is above fret 12. Box 4 moves
uniformly to frets 0–3; Box 3 necessarily wraps its one B-string fret-13 C to the
equivalent fret 1 while its fret-9–12 notes remain visible. No arbitrary major-scale
or modal “positions” were added.

Triad filters enumerate closed root/first/second-inversion voices from exact interval
order and Standard-tuning absolute string pitches on string sets 1-2-3, 2-3-4, 3-4-5
and 4-5-6. This is voice-order matching, not pitch-density selection. In alternate
tunings the accurate chord-tone map remains visible and the UI explicitly suppresses
the Standard-only named-shape emphasis.

Practice Sessions now uses Category and Routine dropdowns followed by one fixed-height
detail. Only detail content scrolls; selectors and actions remain fixed. Starting a
routine replaces the selector/detail view with a bounded running view that retains
the same visual contract.

## Forty-preset validation matrix

“Theory source” names the independently audited source family used in v0.3.2 and
rechecked here. “Layout correct” includes selector filtering, bounded single-detail
rendering and reuse of the same visual in the running view.

| Preset | Visual Type | Theory Source | Visual Correct | Layout Correct | PASS/FAIL |
|---|---|---|---|---|---|
| 1. Chromatic 1-2-3-4 | FRETBOARD_PATH | Sweetwater technique/safety | Exact 24-note 5–8 path with finger order | PASS | **PASS** |
| 2. Spider Exercise | FRETBOARD_PATH | Sweetwater technique/safety | Exact S6/S5 1-3-2-4 seed and propagation text | PASS | **PASS** |
| 3. Finger Independence | FRETBOARD_PATH | Sweetwater technique/safety | Four-fret planted/moving-finger seed | PASS | **PASS** |
| 4. String Crossing Warmup | PICKING_PATTERN | Fender alternate-picking guidance | Exact S6/S4 then S5/S3 path with arrows | PASS | **PASS** |
| 5. C Major — One Octave, 2nd Position | POSITION | Open Music Theory + audited guitar coordinates | Full C-major context, exact position emphasized | PASS | **PASS** |
| 6. A Natural Minor — One Octave, 5th Position | POSITION | Fender A minor + audited coordinates | Full A-minor context, exact position emphasized | PASS | **PASS** |
| 7. Minor Pentatonic — Box 1 | PENTATONIC_BOX | Gibson + Sweetwater | Full A-minor-pentatonic context, canonical Box 1 emphasized | PASS | **PASS** |
| 8. G Major Pentatonic — Full Fretboard | FULL_FRETBOARD_SCALE | Open Music Theory | All matching tones, all six strings, frets 0–12 | PASS | **PASS** |
| 9. A Blues Scale — Box 1 | POSITION | Fender pentatonic + blues formula audit | Full scale context, exact Box 1 including b5 emphasized | PASS | **PASS** |
| 10. Modes Around One Root | FULL_FRETBOARD_SCALE | Berklee modes + Open Music Theory | Four complete D-mode maps | PASS | **PASS** |
| 11. Scale in 3rds | PATTERN | Open Music Theory scale degrees | Exact source position plus ordered degree strip | PASS | **PASS** |
| 12. Scale in 4-Note Sequences | PATTERN | Open Music Theory scale degrees | Exact source position plus ordered groups | PASS | **PASS** |
| 13. 1-2-3 / 2-3-4 Pattern | PENTATONIC_BOX | Gibson + Sweetwater | Canonical Box 1 plus sequential-note strip | PASS | **PASS** |
| 14. Ascend/Descend Groups of Four | PATTERN | Open Music Theory scale degrees | Exact source position plus reversible groups | PASS | **PASS** |
| 15. Three Notes Per String | THREE_NOTES_PER_STRING | GuitarScale.org + Fender E major | Exact 18-coordinate E-major 3NPS and route | PASS | **PASS** |
| 16. String-Skipping Scale Pattern | PENTATONIC_BOX | Gibson + Fender technique | Canonical box plus explicit skipped-string/pick sequence | PASS | **PASS** |
| 17. Major Triads Across String Sets | TRIAD_SHAPE | Godfrey + Hub Guitar | Exact C-major root-position shapes per item | PASS | **PASS** |
| 18. Minor Triads Across String Sets | TRIAD_SHAPE | Godfrey + Hub Guitar | Exact A-minor root-position shapes per item | PASS | **PASS** |
| 19. Major/Minor Triad Comparison | TRIAD_SHAPE | Open Music Theory + Godfrey | Exact third movement with intervals | PASS | **PASS** |
| 20. Triad Inversions | TRIAD_SHAPE | Godfrey + Hub Guitar | Exact root/first/second shapes and bass order | PASS | **PASS** |
| 21. Diatonic Triads in a Major Key | TRIAD_SHAPE | Open Music Theory + Godfrey | Seven exact C-major-key triads | PASS | **PASS** |
| 22. Open Chord Shape Cycle | CHORD_SHAPE | Fender open chords | Exact G/C/D/Em diagrams and order | PASS | **PASS** |
| 23. Major/Minor Barre Shape Cycle | CHORD_SHAPE | Fender/Sweetwater CAGED | Exact F/Bm barre diagrams | PASS | **PASS** |
| 24. I-IV-V Chord Shape Study | CHORD_SHAPE | Open Music Theory + Fender | Exact G/C/D shapes and progression order | PASS | **PASS** |
| 25. ii-V-I Seventh-Chord Shape Study | CHORD_SHAPE | Open Music Theory chord symbols | Exact complete Dm7/G7/Cmaj7 shapes | PASS | **PASS** |
| 26. I-V-vi-IV Chord Shape Study | CHORD_SHAPE | Open Music Theory + Fender | Exact C/G/Am/F shapes | PASS | **PASS** |
| 27. Dominant 7 Chord Shape Cycle | CHORD_SHAPE | Fender dominant sevenths | Exact A7/D7/E7 shapes | PASS | **PASS** |
| 28. Rhythm Chord Shape Drill | CHORD_SHAPE + sequence | Fender rhythm/chords | G/D diagrams plus eight-slot strum order | PASS | **PASS** |
| 29. Alternate Picking | PENTATONIC_BOX + sequence | Gibson + Fender picking | Exact E-minor Box 1 plus down/up strip | PASS | **PASS** |
| 30. Economy Picking on E Major 3NPS | THREE_NOTES_PER_STRING + sequence | GuitarScale.org + Fender | Exact 3NPS plus sweep-direction grouping | PASS | **PASS** |
| 31. Legato Hammer-On/Pull-Off Drill | THREE_NOTES_PER_STRING + sequence | Fender legato | Exact 3NPS plus h/p movement strip | PASS | **PASS** |
| 32. String Skipping | PICKING_PATTERN | Fender alternate picking | Numbered S6/S4/S2 coordinate path and arrows | PASS | **PASS** |
| 33. Palm-Muted Eighth Notes | CHORD_SHAPE + sequence | Fender palm muting | Exact open E5 plus eight strokes | PASS | **PASS** |
| 34. Accent Displacement | RHYTHM_GRID | Yale rhythm + MusicTheory.net | Eight-slot grid with movable accent model | PASS | **PASS** |
| 35. Quarter/Eighth Subdivision Drill | RHYTHM_GRID | MusicTheory.net meter | Four- then eight-slot grids match click config | PASS | **PASS** |
| 36. Triplets | RHYTHM_GRID | Open Music Theory tuplets | Twelve slots grouped three per quarter beat | PASS | **PASS** |
| 37. Sixteenth Notes | RHYTHM_GRID | Open Music Theory rhythm | Sixteen slots grouped four per beat | PASS | **PASS** |
| 38. Eighth-Note Syncopation | RHYTHM_GRID | Yale rhythm | Every offbeat visibly accented | PASS | **PASS** |
| 39. Accent Every 2 / 3 / 4 Notes | RHYTHM_GRID | Yale rhythm | Exact cycles including 3 across barline | PASS | **PASS** |
| 40. 6/8 Groove Drill | RHYTHM_GRID | MusicTheory.net compound meter | Six written eighths, grouped 3+3, accents on 1/4 | PASS | **PASS** |

Final count: **40 presets, 73 items, 40 PASS, 0 FAIL**. No preset was renamed or
removed in v0.3.4. Fifteen previously text-only constituent items received explicit
path, picking or rhythm-grid data; existing verified music data was preserved.

## Automated evidence

`tests/visual_system.test.mjs` independently asserts full scale context plus exact
emphasis for all five A-minor boxes, root persistence, octave-equivalent 0–12 shape
handling, A-major/A-minor root/first/second triads, all four string-set filters,
diminished/augmented coverage, every item’s supported visual type and coordinate
bounds, rhythm-grid/metronome agreement, compound 6/8 grouping, selector filtering,
source switching and safe invalid/deleted selection fallback.

## Manual UI acceptance

The production `Service` and panel components were instantiated through Quickshell's
Qt offscreen backend at 800×660. This avoided disturbing the locked workstation while
still exercising real QML bindings, layouts and renderers (not a reimplemented mock).
Final captures logged no QML reference/type/assignment errors.

- All seven category filters were rendered and opened. One session from each category
  was selected: Spider, Minor Pentatonic Box 1, E-major 3NPS, Triad Inversions,
  ii–V–I, String Skipping and 6/8.
- Additional captures checked C-major position, scale in thirds, alternate picking,
  all A-minor-pentatonic Boxes 1–5, and A-major root/first/second inversion on strings
  1-2-3. Note/string/fret positions matched the fixtures and context stayed visible.
- A scripted rapid sequence selected first, middle and last-bank sessions in one live
  component instance. The compact row projection/list contents did not change and the
  detail pane updated without reflow or horizontal overflow.
- At 800×660 the list, preview and Start/Duplicate actions remained inside the frame.
  At 600×660 the category controls changed to a dropdown, the list/detail stacked,
  only the bounded list scrolled, the visual scaled, and both actions remained visible.
- The running Alternate Picking capture retained the complete 0–12 scale map, exact
  Box 1 emphasis, directions, title, BPM/timer/metronome controls and completion
  actions without returning to the browser.
