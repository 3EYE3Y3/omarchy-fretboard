"""Pure synthesis/rhythm math for Jam Session backing tracks.

Mirrors click_schedule.py's role for the metronome: dependency-free, no
process/threading concerns, so the note and rhythm-role logic is unit
testable without spawning pw-cat. audio_engine.py's Engine owns the actual
sample-accurate mixing loop and imports this module for "what note/sound
happens on this tick" decisions.

Chord qualities here are local to Jam Sessions (see js/jam_sessions.js's own
header comment for why they are not js/theory.js's CHORDS): a backing track
only needs a pitch-class interval set to pick bass/comp tones, not an
audited guitar-voicing shape.
"""

CHORD_QUALITY_INTERVALS = {
    "major": (0, 4, 7),
    "minor": (0, 3, 7),
    "dominant7": (0, 4, 7, 10),
    "major7": (0, 4, 7, 11),
    "minor7": (0, 3, 7, 10),
    "minor7b5": (0, 3, 6, 10),
    "diminished7": (0, 3, 6, 9),
}


def chord_tone_pitch_classes(root_pitch_class, quality):
    intervals = CHORD_QUALITY_INTERVALS.get(quality, CHORD_QUALITY_INTERVALS["major"])
    return [(int(root_pitch_class) + i) % 12 for i in intervals]


def note_frequency(pitch_class, octave):
    """A4 = 440Hz, MIDI convention (C4 = octave 4, pitch class 0)."""
    midi = 12 * (octave + 1) + pitch_class
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def bass_pitch_class_for_beat(root_pitch_class, quality, beat_index):
    """A simple "boom-chick" bass line: beats 1 and 3 (index 0, 2) play the
    root; beats 2 and 4 (index 1, 3) play the chord's fifth where the
    quality has one, else repeat the root. `quality`'s interval list always
    orders root-3rd-5th[-7th], so index 2 is the fifth whenever present."""
    tones = chord_tone_pitch_classes(root_pitch_class, quality)
    if beat_index % 2 == 0:
        return root_pitch_class
    return tones[2] if len(tones) > 2 else root_pitch_class


def beat_role(beat_index, sub_index):
    """What an eighth-note tick in a 4/4 bar (2 ticks/beat: sub_index 0 = on
    the beat, 1 = the "and") should trigger. Beats 1/3 carry the bass note
    plus a kick; beats 2/4 carry a snare plus a soft chord-comp stab; every
    "and" carries a quiet hi-hat, giving simple but musically legible
    accompaniment without claiming full drum-kit realism."""
    if sub_index == 1:
        return "hihat"
    return "kick_bass" if beat_index % 2 == 0 else "snare_comp"


def swing_offset_samples(sample_rate, bpm, feel):
    """Extra delay applied only to "and" (sub_index 1) ticks under a
    shuffle/swing feel, moving a straight eighth (halfway through the beat)
    to a swung eighth (two-thirds through, the long-short triplet feel).
    Independent of click_schedule.py's plain-metronome math, so ordinary
    metronome playback is never affected by this. Returns 0 for "straight"."""
    if feel not in ("shuffle", "swing"):
        return 0
    bpm = max(1, bpm)
    beat_samples = 2 * round(60.0 / bpm * sample_rate / 2)
    return round(beat_samples * (2.0 / 3.0 - 0.5))
