# Fretboard music-content correctness audit

## v0.5.0 configurable routines and Jam Sessions

Branch `feature/dynamic-practice-v04` (kept; see CHANGELOG for the naming
note), based on the marketplace-reviewed `de62e07` `main`. Adds configurable
routine templates and Jam Sessions on top of the unchanged v0.4 content (57
presets / 90 items) - nothing already audited was modified;
`tests/presets.test.mjs`, `tests/visual_system.test.mjs`,
`tests/dynamic_routines.test.mjs` and `tests/canonical_music.test.mjs` all
still pass unchanged.

**Configurable routine templates** (`js/presets.js`'s `SCALE_TEMPLATES`/
`resolveScaleTemplate`/`resolveHybridPentatonicTemplate`, `Service.qml`'s
`resolveTriadTemplateItem`) introduce no new theory or coordinate data:
scale templates resolve to `VisualShapes.FULL_FRETBOARD_SCALE` (the existing
tuning-aware, key-generic membership contract) or reuse `boxAid`'s already-
audited pentatonic-box coordinates; triad templates call
`VisualShapes.triadShapes()`, itself already covered by
`tests/visual_system.test.mjs`'s "A major and minor triad filters produce
exact closed inversions" and "diminished and augmented triad filters retain
exact quality" tests since v0.4 (that engine simply had no caller until
now). See `tests/routine_templates.test.mjs`.

**Jam Session progressions** (`js/jam_sessions.js`) were independently
verified against reputable guitar/theory sources, accessed 2026-09-13, and
transposition-tested across all 12 keys in `tests/jam_sessions.test.mjs`:

- 12-bar dominant blues (quick-change at bar 2, V7-IV7-I7-V7 turnaround): given directly by this feature's own instructions, and cross-checked as a standard, well-documented blues form against [Guitar-chord.org — Blues progressions](https://www.guitar-chord.org/articles/blues-progressions.html) and [OtoTheory — 12-bar Blues (I7-IV7-V7)](https://www.ototheory.com/progressions/blues-12-bar).
- Minor blues (im7-ivm7 with a dominant V7 turnaround): [JazzGuitar.be forum — Twelve Bar Blues Chord Analysis](https://www.jazzguitar.be/forum/theory/30952-twelve-bar-blues-chord-analysis.html) ("a basic 12-bar blues chord progression [in a minor key]... all three chords are usually minor or minor seventh... im7 takes the place of I7 throughout... V-IV-I-I to close") and [Blitzstar Guitar — 12-Bar Blues II: Chord Substitution and Minor Blues Harmony](https://blitzstarguitar.com/12-bar-blues-chord-substitution/).
- Shuffle/Slow Blues: the same major-blues progression, distinguished only by feel/tempo - a shuffle/swing eighth-note feel and a slower tempo are themselves well documented blues-performance conventions, not separate chord data requiring independent sourcing.
- Major ii-V-I (iim7-V7-Imaj7) and minor ii-V-i (iiø7-V7-im7, the "alt" dominant simplified to a plain dominant7 - a common beginner-level simplification since fully altered-dominant tensions are not representable without extended voicings): standard jazz harmony, cross-checked against [Open Music Theory — Chord Symbols](https://viva.pressbooks.pub/openmusictheory/chapter/chord-symbols/) (already cited below for chord/inversion formulas) and [Learn Jazz Standards — Blues Chord Progressions](https://www.learnjazzstandards.com/blog/learning-jazz/jazz-theory/blues-chord-progressions/).
- Jazz Blues (quick-change IV7 at bar 2, ii7-V7 approach at bars 9-10 instead of plain V7-IV7): [Learn Jazz Standards — 4 Blues Chord Progressions](https://www.learnjazzstandards.com/blog/learning-jazz/jazz-theory/blues-chord-progressions/) ("A simple jazz blues sequence usually changes to chord IV at bar 2... uses a IIm7 V7 at bar 9") and [Taming the Saxophone — 12 Bar Blues Chord Sequence](https://tamingthesaxophone.com/theory/impro/12-bar-blues-chords). Deliberately the simplified educational form, not the denser professional variant with additional half-bar substitutions - documented as a choice in `js/jam_sessions.js`'s own comments.
- Dorian Vamp (im7-IV7, e.g. Dm7-G7 in D Dorian): [Guitar-chord.org — Chords in Dorian mode for guitar](https://www.guitar-chord.org/key-and-chord-chart-dorian.html) ("The most common Dorian vamp is Im to IV major... 'one minor, four seven'... Any Color You Like (Dm G7)") and [Taming the Saxophone — Dorian Mode Jazz & Funk Grooves](https://tamingthesaxophone.com/theory/impro/jazz-dorian).

No backing-track audio is sampled, downloaded or copied from any recording:
`helper/audio_engine.py`'s `"jam"` mode and `helper/jam_synth.py` (see
`docs/ARCHITECTURE.md`) synthesize bass/comping/drums locally from the
resolved chord's pitch classes.

## v0.4.0 dynamic practice and hybrid picking

Branch `feature/dynamic-practice-v04`, based on the marketplace-reviewed
`de62e07` `main`. Adds 17 new built-in presets (9 dynamic/staged routines, 8
hybrid-picking Technique routines) on top of the unchanged 40 v0.3.5 presets,
for 57 presets / 90 items total. No existing preset, formula, coordinate,
voicing, tuning or rhythm data was modified - `tests/presets.test.mjs`,
`tests/visual_system.test.mjs` and `tests/canonical_music.test.mjs` all still
pass unchanged against the original 40/73.

**Dynamic/staged routines** (`js/stage_engine.js`, `js/routines.js`'s
`hasStages`/`resolveStageItem`) carry zero new theory or coordinate data of
their own. Every stage's scale/box/triad content is either the exact literal
coordinate array from an existing audited v0.3.x preset (the G-major triad-
inversion and C-major triad-string-set shapes reused by the Triad Inversion
Ladder and Triad String-Set Ladder), or computed live from this file's own
already-tested `js/visual_shapes.js` functions (`positionsFor` for every
pentatonic box, `triadShapes` for the one previously-unauthored string set,
C major root position on strings 6-5-4). The one new coordinate set (triad
string set "456") was generated with `Visual.triadShapes(...)` itself and
cross-checked against the three already-audited string sets it reproduces
exactly (see `tests/dynamic_routines.test.mjs`), rather than hand-derived.

**Hybrid picking** (`PICKING_PATTERN` visual mode, already shipped in
v0.3.x for plain alternate-picking direction arrows; P/M/R is a new label
vocabulary on the same mode, scoped and tested separately from the existing
arrow-label content). Content sources, accessed 2026-09-13:

- [Guitar World — Hybrid picking on guitar: an in-depth lesson](https://www.guitarworld.com/magazine/depth-guide-hybrid-picking-will-have-you-playing-pro-no-time-all): pick-between-thumb-and-index hand position, per-finger string assignment, and the pick-downstroke/finger-upstroke fundamental pattern used by "Pick + Middle Alternation" and "Pick + Middle + Ring".
- [Premier Guitar — 5 Steps to Better Hybrid Picking](https://www.premierguitar.com/lessons/country/hybrid-picking-guitar-lesson): progressive pick/middle/ring coordination drills, the model for the alternation and string-skipping routines.
- [HubGuitar — Hybrid Picking Overview](https://hubguitar.com/technique/hybrid-picking-overview) and [Hub Guitar — Guitar Triads Chart](https://hubguitar.com/fretboard/guitar-triads-chart) (already cited below for triads): pick-plus-fingers triad grips, used for "Major/Minor Triad Hybrid Picking" and the dynamic "Hybrid Picking — Triad Cycle"/"String Sets" routines.
- [Guitar World — Hybrid picking exercises to improve your guitar technique](https://www.guitarworld.com/lessons/five-ways-to-improve-hybrid-picking): pick-handles-the-pedal/fingers-handle-the-melody pattern, confirming "Pedal-Tone Hybrid Picking"; double-stops-over-a-pedal-note and banjo-roll framing.
- [GuitarPlayer — Country-shred licks with double-stops](https://www.guitarplayer.com/lessons/learn-18-country-shred-licks-with-double-stops-pedal-steel-bends-and-other-tricks-of-the-trade): sliding-6ths double-stops played pick+fingers, the basis for "Double Stops in Sixths" - implemented without pedal-steel bends (not representable as fret/string coordinates), matching the source's own distinction between plain double-stops and bent ones.

No tab or diagram was copied from any source. Every coordinate in every
hybrid routine is an original array in `js/presets.js`, either reused
verbatim from an audited v0.3.x shape or located independently by walking
`js/theory.js`'s own scale pitch-class set across two adjacent strings in
code (the diatonic-3rds and diatonic-6ths double-stop routines) - see this
file's "Hybrid Picking" preset block. `tests/dynamic_routines.test.mjs`
checks every hybrid visual uses only the documented P (pick) / M (middle) /
R (ring) labels, that every coordinate is in-bounds, and that every
thirds/sixths dyad pairs P with the lower-pitched string of the pair.

A v0.5 Jam Session/backing-track architecture note (not yet implemented) is
in `docs/ARCHITECTURE.md`.

## v0.3.5 routine-selector follow-up

The Practice UI now resolves category and routine dropdowns to one bounded detail
view. No preset definitions, theory formulas, shape coordinates, voicings, tunings or
rhythm data changed. All 40 presets and 73 items retain the v0.3.4 visual contract and
the v0.3.3 full-fretboard correctness fixtures.

## v0.3.4 position/highlight and practice-visual follow-up

Reference now retains complete scale/chord-tone context while independently
emphasizing verified pentatonic boxes or triad inversions/string sets. Every one of
the 40 built-in sessions has a supported data-driven teaching visual, and the preset
browser uses stable compact rows plus a separate bounded detail pane. The new source
notes, 40-row visual/layout matrix and regression evidence are in
[PRACTICE_VISUAL_AUDIT.md](PRACTICE_VISUAL_AUDIT.md).

## v0.3.3 scale-visualization follow-up

General scale/mode references now have an explicit six-string, frets 0–12 visual
contract. Every matching tone is calculated from each active tuning string; open
strings and roots are included where applicable. Literal fixtures cover A minor
pentatonic, C major, G major, A natural minor and D Dorian, plus alternate-tuning
recalculation. Named boxes, positions, 3NPS forms, triads, chord shapes and patterns
remain coordinate-only and were regression-checked unchanged. See `TESTING.md` for
the follow-up live-review record.

## v0.3.2 comprehensive audit

Audit date: 2026-09-12. Scope: the v0.3.1 theory model, fretboard/reference views,
all named guitar shapes, chord voicings, tunings, circle of fifths, metronome model,
and every built-in practice preset. Marketplace work was explicitly out of scope and
remains stopped.

## Root cause and audit method

v0.3.1 represented a scale as pitch-class membership only, then selected the densest
five-fret window with `Fretboard.findPositionWindow`. The window could contain only
valid scale tones while still being the wrong conventional fingering. Calling that
result “Box 1,” “One Position,” or “3NPS” confused two distinct claims:

1. **Scale membership** — for example, A minor pentatonic contains A, C, D, E and G.
2. **Guitar position/shape** — a tuning-dependent set of exact string/fret
   coordinates, including specific root locations.

The same weak assumption affected the chord path: v0.3.1 greedily selected nearby
chord tones. Tone membership alone did not establish a conventional, complete or
physically sensible guitar voicing. Finally, compound meter was modeled as numerator
counts that were subdivided again, so the 6/8 exercise did not match its two-beat
description.

The audit compared formulas and note spellings independently of the implementation,
then compared guitar-specific claims against coordinate-bearing fretboard/tab sources.
For high-risk positional material, at least two independent sources were used where
practical. Source diagrams were not copied; the corrected representations are original
data arrays rendered by Fretboard.

## Independent online references

All sources were accessed on 2026-09-12.

### Scales, modes and spelling

- [Open Music Theory — Scales and scale degrees](https://viva.pressbooks.pub/openmusictheory/chapter/scales-and-scale-degrees/): diatonic scale construction and degree terminology.
- [Open Music Theory — Other heptatonic scales](https://viva.pressbooks.pub/openmusictheory/chapter/other-heptatonic-scales/): harmonic and melodic minor forms.
- [Berklee Online — A Guide to Musical Modes](https://online.berklee.edu/takenote/music-modes-major-and-minor/): modal relationships and characteristic altered degrees.
- [Fender — A Minor Pentatonic Scale](https://www.fender.com/articles/scales/a-minor-pentatonic-guitar-scale): A-C-D-E-G membership and the conventional fifth-fret/Box-1 fingering.
- [Fender — E Major Scale](https://www.fender.com/articles/scales/e-major-guitar-scale): E-F#-G#-A-B-C#-D# membership and guitar locations used to cross-check the 3NPS coordinates.
- [Fender — A Minor Scale](https://www.fender.com/articles/scales/a-minor-guitar-scale): A natural-minor note content and playable fretboard locations.

### Guitar positions, triads and chords

- [Sweetwater — 5 Positions of the Minor Pentatonic](https://www.sweetwater.com/insync/5-positions-of-the-minor-pentatonic-guitar-lesson/): all five connected minor-pentatonic positions and roots.
- [Gibson App — A Minor Pentatonic](https://www.gibson.app/learn/scales/a-minor-pentatonic): independent all-five-shape diagrams, used for an exact coordinate-by-coordinate comparison.
- [GuitarScale.org — Major scales, 3 notes per string (PDF)](https://www.guitarscale.org/pdf/Major_scales_3_notes_per_string.pdf): exact six-string major-scale 3NPS fret patterns; the E pattern was also note-checked against Fender's E-major fretboard.
- [Godfrey Guitar Lessons — Major, Minor and Diminished Triads (PDF)](https://www.godfreyguitarlessons.com/_files/ugd/f64270_4913e598b2dc4845a2b5247b0e99d08b.pdf): string-set triads and inversions with exact frets.
- [Hub Guitar — Guitar Triads Chart](https://hubguitar.com/fretboard/guitar-triads-chart): independent adjacent-string-set inversion charts.
- [Open Music Theory — Triads](https://viva.pressbooks.pub/openmusictheory/chapter/triads/) and [Chord Symbols](https://viva.pressbooks.pub/openmusictheory/chapter/chord-symbols/): triad/seventh/sus/add formulas and inversion definitions.
- [Fender — Open Position Chords](https://www.fender.com/play/guitar/collections/open-position-chords), [E Major](https://www.fender.com/articles/chords/learn-how-to-play-the-e-major-chord-on-guitar), and [E Minor](https://www.fender.com/articles/chords/learn-how-to-play-e-minor-chord): manual benchmarks for conventional open voicings.
- [Fender — Dominant 7th Chords](https://www.fender.com/articles/chords/how-to-play-dominant-7th-chords): dominant-seventh formula and conventional guitar examples.
- [Fender — Major Guitar Scales/CAGED](https://www.fender.com/articles/scales/major-guitar-scales) and [Sweetwater — CAGED System](https://www.sweetwater.com/insync/caged-system/): independent checks for movable E-root/A-root shape semantics.

### Tuning, circle and rhythm

- [Sweetwater — Standard Tuning](https://www.sweetwater.com/insync/standard-tuning/), [Fender — Drop D](https://www.fender.com/articles/setup/drop-d-tuning-on-guitar), [Fender — Alternate Tunings](https://www.fender.com/articles/setup/tune-like-a-rock-star), and [Guitar.com — Alternate Tunings](https://guitar.com/lessons/introduction-alternate-tunings-drop-d-open-d-major-dadgad/): Standard, Drop D, open tunings and DADGAD.
- [Wikipedia — Drop C tuning](https://en.wikipedia.org/wiki/Drop_C_tuning) and [Guitar World — D Standard](https://www.guitarworld.com/lessons/how-to-play-come-as-you-are-on-guitar): independent explicit low-to-high tuning checks. Eb Standard was verified as Standard lowered by one semitone; Drop C as D Standard with string 6 lowered a whole tone.
- [Berklee Online — Circle of Fifths](https://online.berklee.edu/takenote/circle-of-fifths-the-key-to-unlocking-harmonic-understanding/) and [Open Music Theory — Key Signatures](https://open-musictheory.github.io/docs/fundamentals/key-signatures/): fifth ordering, accidental counts and relative keys.
- [MusicTheory.net — Simple and Compound Meter](https://www.musictheory.net/lessons/15): compound beats and three-way beat division in 6/8, 9/8 and 12/8.
- [Open Music Theory — Tuplets](https://musictheory.pugetsound.edu/mt21c/Tuplets.html) and [Common Rhythmic Notation Errors](https://musictheory.pugetsound.edu/mt21c/CommonRhythmicNotationErrors.html): triplet and subdivision notation.
- [Open Yale Courses — Rhythm: Jazz, Pop and Classical](https://oyc.yale.edu/music/musi-112/lecture-4): meter, accents and syncopation.
- [Fender — Rhythm Without Practice](https://www.fender.com/articles/techniques/killer-rhythm-without-practice), [Alternate Picking](https://www.fender.com/articles/techniques/how-to-guitar-solo), [Hammer-ons/Pull-offs](https://www.fender.com/articles/techniques/master-hammer-ons-and-pull-offs), and [Palm Muting](https://www.fender.com/articles/techniques/3-keys-to-ace-your-palm-muting): guitar-technique cross-checks.
- [Sweetwater — Finger Independence](https://www.sweetwater.com/insync/technique-finger-independence/) and [Warming Up](https://www.sweetwater.com/insync/technique-warming-up/): physical-sense and safe-practice review.

## Canonical findings

- All 14 exposed scale/mode entries now carry explicit canonical formulas and are
  tested in all 12 pitch-class roots. Major-key fixtures lock conventional spellings,
  including F# major's E#. Melodic minor is labelled **ascending** because the common
  classical descending form is natural minor.
- A minor pentatonic Boxes 1–5 match the Sweetwater and Gibson diagrams exactly.
  Box 1 is `S6 5-8 | S5 5-7 | S4 5-7 | S3 5-7 | S2 5-8 | S1 5-8`; its A roots are
  S6f5, S4f7 and S1f5. All boxes have literal coordinate and root fixtures, and E-minor
  Box 1 verifies transposition.
- The E-major 3NPS fixture is `12-14-16 | 12-14-16 | 13-14-16 | 13-14-16 |
  14-16-17 | 14-16-17`, low string to high. Every coordinate resolves to an E-major
  note and every string contains exactly three notes.
- Major/minor/diminished/augmented formulas are respectively 1-3-5, 1-b3-5,
  1-b3-b5 and 1-3-#5. Root, first and second inversions are determined by actual bass
  order, not a label. Exact coordinate fixtures cover major and minor string-set
  shapes and all three major inversions.
- All 11 chord families have canonical formula fixtures. Standard-tuning reference
  voicings use audited open shapes where supplied and validated movable E-root/A-root
  templates elsewhere. Every result must contain every required tone, contain no
  other tone, include the root, and stay within a four-fret hand span. Standard-only
  shapes are suppressed for all alternate/custom tunings.
- All eight tunings match their low-to-high published pitch sequences. Full-fretboard
  scale/chord membership remains tuning-aware; every exact built-in shape declares and
  activates Standard tuning.
- The circle is C-G-D-A-E-B-F#/Gb-Db/C#-Ab-Eb-Bb-F, with the correct relative minors
  and accidental counts. Both spellings are visible at the enharmonic seam.
- BPM is a quarter-note beat in simple `/4` meters and a dotted-quarter beat in
  compound 6/8, 9/8 and 12/8. Thus 6/8 produces two beats and six eighth-note ticks
  per bar when the legacy `triplet` subdivision ID (displayed as **3 / beat**) is
  selected. The global labels are meter-neutral because the written value of one
  beat differs between `/4`, odd `/8` and compound `/8`; the 4/4 teaching presets
  name their written quarter/eighth/triplet/sixteenth values explicitly.

## All 40 practice presets

“Result” is the final v0.3.2 result after the stated correction. No preset was
bulk-passed; each row was checked against its actual item data, preview mode,
instructions and click schedule.

| Preset | Theory | Visual | Instructions | Rhythm/Metronome | Result | Fix |
|---|---|---|---|---|---|---|
| 1. Chromatic 1-2-3-4 | Chromatic fingering, not scale degrees | Text coordinates | Exact finger/string traversal and safe fret choice | 60→100, quarter clicks, 1 note/click | **PASS** | Made fret span, direction and finger meaning explicit |
| 2. Spider Exercise | 1-3-2-4 is a finger sequence | Text gives S6/S5 coordinates and propagation | Exact cross-string order | 60→100, 1 note/click | **PASS** | Replaced ambiguous “spider” shorthand with literal sequence |
| 3. Finger Independence | Finger-control drill | Text-only is accurate | Static/moving fingers and pain warning stated | 60→90, 1 note/click | **PASS** | Added concrete motion and physical-safety limit |
| 4. String Crossing Warmup | Nonadjacent-string picking | Exact string sequence in text | Strict alternation and muting stated | 70→110, eighth click, 1 note/click | **PASS** | Added exact strings, pick directions and subdivision agreement |
| 5. C Major — One Octave, 2nd Position | C-D-E-F-G-A-B-C | Exact S5f3 through S3f5 coordinates | Low-to-high and reverse | 70→130, 1 note/click | **PASS** | Replaced generic density window with a literal position |
| 6. A Natural Minor — One Octave, 5th Position | A-B-C-D-E-F-G-A | Exact S6f5 through S4f7 | Fret sequence and reverse stated | 70→130, 1 note/click | **PASS** | Replaced generic density window with a literal position |
| 7. Minor Pentatonic — Box 1 | A-C-D-E-G | Exact conventional A Box 1; roots S6f5/S4f7/S1f5 | All six string pairs stated | 70→130, 1 note/click | **PASS** | Corrected the known wrong Box 1 through the new shape model |
| 8. G Major Pentatonic — Full Fretboard | G-A-B-D-E | Honest membership map | Player chooses route; no position implied | 70→130, 1 note/click | **PASS** | Removed false “position” claim instead of inventing a shape |
| 9. A Blues Scale — Box 1 | A-C-D-Eb-E-G | Exact Box 1 plus b5 at S5f6/S3f8 | b5 treatment, ascent/descent stated | 70→120, 1 note/click | **PASS** | Added exact blue-note coordinates and unambiguous spelling |
| 10. Modes Around One Root | D Dorian/Phrygian/Lydian/Mixolydian notes and alterations checked | Full membership maps, not positions | Exact notes, route choice and tonic return per item | 80 quarter, 1 note/click | **PASS** | Added actionable, mode-specific instructions to all four items |
| 11. Scale in 3rds | C-major pairs 1-3 through 6-8 | Exact one-octave source position | Says numbers are degrees, not frets | 60→110, 1 note/click | **PASS** | Removed degree/fret ambiguity and generic window |
| 12. Scale in 4-Note Sequences | G-major consecutive degree groups | Exact one-octave G source | Sliding start degree stated | 60→110, 1 note/click | **PASS** | Corrected source visual and semantics |
| 13. 1-2-3 / 2-3-4 Pattern | Sequential pentatonic notes, explicitly not diatonic degree labels | Exact A-minor Box 1 | Repetition beyond five notes explained | 60→110 quarter | **PASS** | Clarified what numbers mean and corrected box visual |
| 14. Ascend/Descend Groups of Four | C-major four-note groups through 5-6-7-8 | Exact one-octave source | Every group reverses before shift | 60→110, 1 note/click | **PASS** | Completed the written octave and replaced generic window |
| 15. Three Notes Per String | E Ionian/E major | Exact 18-coordinate 3NPS shape | Every string/fret pair and reverse stated | 60→120, 1 note/click | **PASS** | Replaced a non-3NPS density window with canonical data |
| 16. String-Skipping Scale Pattern | A-minor-pentatonic membership | Exact Box 1 | S6→S4→S2 and S5→S3→S1, muting and ↓↑ | 60→110, 1 note/click | **PASS** | Made strings, frets and picking explicit |
| 17. Major Triads Across String Sets | C-E-G root position on 321/432/543 | Exact three-note coordinates per item | Tone/fret order stated | 60 quarter per timed block | **PASS** | Replaced generic chord diagrams with true string-set triads |
| 18. Minor Triads Across String Sets | A-C-E root position on 321/432/543 | Exact three-note coordinates per item | Tone/fret order stated | 60 quarter per timed block | **PASS** | Replaced generic chord diagrams with true string-set triads |
| 19. Major/Minor Triad Comparison | C-E-G vs C-Eb-G | Exact 5-5-3 vs 5-4-3 | Explains only the third moves | 70 quarter, separate blocks | **PASS** | Renamed “alternation” because runtime advances by item, not bar |
| 20. Triad Inversions | G-B-D, B-D-G, D-G-B | Exact 321 shapes | Bass note and inversion stated | 60 quarter per block | **PASS** | Added literal inversion coordinates and bass validation |
| 21. Diatonic Triads in a Major Key | C Dm Em F G Am Bdim | Exact root-position top-set triads | Roman numeral and manual Next stated | 70, 1 strum/beat | **PASS** | Corrected all seven shapes and runtime wording |
| 22. Open Chord Shape Cycle | G, C, D, Em tones | Exact conventional open shapes | One shape per block; Next explicit | 70, 1 strum/beat | **PASS** | Replaced generated shapes and removed false automatic-cycle implication |
| 23. Major/Minor Barre Shape Cycle | F major E-shape; Bm A-shape | Exact 133211 / x24432 | Pressure release and Next stated | 60, 1 strum/beat | **PASS** | Locked conventional barre forms and accurate runtime behavior |
| 24. I-IV-V Chord Shape Study | G-C-D is I-IV-V in G | Exact open forms | Study blocks and Next stated | 80, 1 strum/beat | **PASS** | Renamed from progression behavior the runtime did not perform |
| 25. ii-V-I Seventh-Chord Shape Study | Dm7-G7-Cmaj7 in C; all tones present | Exact playable fifth/third-position forms | Next between timed blocks | 70, 1 strum/beat | **PASS** | Added exact complete seventh voicings and honest title |
| 26. I-V-vi-IV Chord Shape Study | C-G-Am-F | Exact open/barre forms | Next between timed blocks | 90, 1 strum/beat | **PASS** | Added exact complete forms and honest title |
| 27. Dominant 7 Chord Shape Cycle | A7-D7-E7, 1-3-5-b7 | Exact open forms | Blues function and Next stated | 80, 1 strum/beat | **PASS** | Replaced generated shapes and clarified timed blocks |
| 28. Rhythm Chord Shape Drill | G then D | Exact open forms | Written down/up pattern matches slots | 90, eighth click, one slot/click | **PASS** | Aligned text, visual rhythm and subdivision |
| 29. Alternate Picking | E-minor pentatonic | Exact transposed open Box 1 | Strict ↓↑ across changes | 70→140, eighth click | **PASS** | Removed nonexistent single-note phase and corrected visual |
| 30. Economy Picking on E Major 3NPS | E-major notes | Exact 3NPS | Repeated ↓ ascending / ↑ descending string crossing | 60→110, eighth click | **PASS** | Replaced vague scale drill with a viable economy-picking path |
| 31. Legato Hammer-On/Pull-Off Drill | E-major notes | Exact 3NPS | Pick-hammer-hammer-pull-pull; finger meanings stated | 60→120; whole five-note slur/click after unmetered work | **PASS** | Made rhythmic unit and spacing-dependent fingering explicit |
| 32. String Skipping | Technique-only, no false scale claim | Text sequence S6-S4-S2 and reverse | Alternate directions and muted strings | 60→120, eighth pulse | **PASS** | Added literal route and muting |
| 33. Palm-Muted Eighth Notes | E5 = E-B | Exact 0-2-2-x-x-x | Bridge contact and strokes stated | 80→140, eighth click | **PASS** | Added complete playable shape and click alignment |
| 34. Accent Displacement | Accent location, not pitch theory | Written three accent placements | Four bars each; click accent distinction stated | 70→120, eighth click | **PASS** | Corrected terminology to beat 1 and synchronized pattern text |
| 35. Quarter/Eighth Subdivision Drill | Quarter vs paired eighths | Count grids | One note per emitted click | 90; 4 then 8 ticks/bar | **PASS** | Clarified that the audible subdivision changes |
| 36. Triplets | Three equal notes per quarter beat | `1-trip-let` grid | One note/click | 70→120; 12 ticks/bar | **PASS** | Aligned title, count and actual triplet scheduler |
| 37. Sixteenth Notes | Four equal notes per quarter beat | `1-e-&-a` grid | One note/click | 60→100; 16 ticks/bar | **PASS** | Aligned title, count and actual scheduler |
| 38. Eighth-Note Syncopation | Offbeat accents | Every `&` marked | Soft downbeats, accented offbeats | 70→110; 8 ticks/bar | **PASS** | Made syncopation an actual accent instruction, not just a label |
| 39. Accent Every 2 / 3 / 4 Notes | Cyclic groupings, including 3 across barline | Exact accent grids per item | Accent indices explicit | 100, eighth click | **PASS** | Corrected continuous group-of-3/barline representation |
| 40. 6/8 Groove Drill | Two dotted-quarter beats, each divided in three | Six eighth slots grouped 3+3 | Player accents 1/4; stronger app click only on 1 disclosed | 60→110 dotted-quarter; 6 ticks/bar | **PASS** | Fixed compound-meter engine and reconciled text/pattern/click behavior |

Final count: **40 reviewed, 40 PASS after correction, 0 unresolved FAIL**. Keeping 40
was not a goal of the fixes; no exercise required removal once its model, visual or
wording was made accurate.

## Independent automated fixtures

`tests/canonical_music.test.mjs` does not snapshot old implementation output. Its
literal expected values were authored from the references above. It covers:

- exact string/fret and root coordinates for A minor pentatonic Boxes 1–5;
- exact E minor pentatonic Box 1 and transposition;
- C major, G major, A natural/harmonic/ascending-melodic minor and every exposed
  scale formula in all 12 roots;
- exact E-major 3NPS coordinates and three-notes-per-string counts;
- major and minor root/first/second-inversion coordinates and bass order, plus exact
  diminished and augmented triad shapes;
- E/A/C major, E/A minor, F/Bm barre, dominant-7, sus and power-chord fixtures;
- every chord formula plus all 11 shape families in every root, required tones,
  no extra tones, fret span and alternate-tuning suppression;
- every exact preset coordinate against its advertised scale/chord and every
  positional label against an explicit non-membership visual mode.

## Manual visual review

The enabled development plugin was restarted so QML and `.pragma library` objects
were instantiated from the corrected source rather than retained from v0.3.1 hot
reload state. Sixteen live screenshots were captured and inspected at native display
resolution. Temporary audit-only entries exposed Boxes 2–5 and individual inversion
items through the same production `Service` → `FretboardGrid` path; they and the
temporary Routines-default view were removed immediately afterward.

| Live view | Manual comparison | Result |
|---|---|---|
| A minor pentatonic Boxes 1–5 | All 60 dots, string/fret positions and A-root highlights compared with Sweetwater and Gibson | **PASS** |
| C major one-octave, 2nd position | Eight displayed coordinates and two C roots compared with its stated fingering and fretboard notes | **PASS** |
| E major 3NPS | All 18 dots, three per string, compared with GuitarScale.org and note-checked against Fender | **PASS** |
| G major root/1st/2nd inversion | G-B-D, B-D-G and D-G-B appeared on the exact top-three-string coordinates | **PASS** |
| A minor root-position triad | A-C-E appeared at strings 3-2-1, frets 2-1-0 | **PASS** |
| Common open G chord | `320003`, including open/mute markers and dot rows, compared with the conventional form | **PASS** |
| F E-shape barre and open E5 power chord | `133211` and `022xxx`; corrected non-open fret label read `1fr` | **PASS** |
| C-major thirds pattern | Only its exact eight source-position notes were highlighted; written degree pairs agreed | **PASS** |
| 6/8 Groove Drill | Text showed two dotted-quarter beats, six eighth slots and disclosed accent behavior; no unrelated stale fretboard remained after the visual-leak fix | **PASS** |

No Fretboard-specific QML/runtime error appeared in the fresh-shell log during this
sequence. Captures remained local test artifacts because full-screen images included
the review workstation; no private desktop content is committed to the repository.
