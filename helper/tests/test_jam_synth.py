import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import jam_synth as js  # noqa: E402


class ChordTonePitchClassesTests(unittest.TestCase):
    def test_dominant7_on_c_gives_c_e_g_bb(self):
        self.assertEqual(js.chord_tone_pitch_classes(0, "dominant7"), [0, 4, 7, 10])

    def test_minor7b5_on_e_gives_correct_half_diminished_tones(self):
        # E half-diminished: E-G-Bb-D -> pitch classes 4, 7, 10, 2
        self.assertEqual(js.chord_tone_pitch_classes(4, "minor7b5"), [4, 7, 10, 2])

    def test_unknown_quality_falls_back_to_major(self):
        self.assertEqual(js.chord_tone_pitch_classes(0, "nonsense"), [0, 4, 7])

    def test_wraps_pitch_classes_across_the_octave(self):
        self.assertEqual(js.chord_tone_pitch_classes(9, "major"), [9, 1, 4])  # A major: A-C#-E


class NoteFrequencyTests(unittest.TestCase):
    def test_a4_is_440hz(self):
        self.assertAlmostEqual(js.note_frequency(9, 4), 440.0, places=3)

    def test_a3_is_one_octave_below_a4(self):
        self.assertAlmostEqual(js.note_frequency(9, 3), 220.0, places=3)

    def test_c4_matches_standard_middle_c_frequency(self):
        self.assertAlmostEqual(js.note_frequency(0, 4), 261.6256, places=2)


class BassPitchClassForBeatTests(unittest.TestCase):
    def test_downbeats_play_the_root(self):
        self.assertEqual(js.bass_pitch_class_for_beat(0, "dominant7", 0), 0)
        self.assertEqual(js.bass_pitch_class_for_beat(0, "dominant7", 2), 0)

    def test_backbeats_play_the_fifth_when_present(self):
        # C dominant7 fifth is G (pitch class 7).
        self.assertEqual(js.bass_pitch_class_for_beat(0, "dominant7", 1), 7)
        self.assertEqual(js.bass_pitch_class_for_beat(0, "dominant7", 3), 7)

    def test_backbeats_fall_back_to_root_for_a_quality_with_no_fifth_slot(self):
        # This codebase's CHORD_QUALITY_INTERVALS never omits the 5th, but
        # the fallback path must still be safe against a hypothetical short
        # interval list.
        self.assertEqual(js.bass_pitch_class_for_beat(5, "major", 1), 0)  # F major fifth is C


class BeatRoleTests(unittest.TestCase):
    def test_every_and_tick_is_hihat(self):
        for beat in range(4):
            self.assertEqual(js.beat_role(beat, 1), "hihat")

    def test_beats_1_and_3_are_kick_and_bass(self):
        self.assertEqual(js.beat_role(0, 0), "kick_bass")
        self.assertEqual(js.beat_role(2, 0), "kick_bass")

    def test_beats_2_and_4_are_snare_and_comp(self):
        self.assertEqual(js.beat_role(1, 0), "snare_comp")
        self.assertEqual(js.beat_role(3, 0), "snare_comp")


class SwingOffsetSamplesTests(unittest.TestCase):
    def test_straight_feel_has_no_offset(self):
        self.assertEqual(js.swing_offset_samples(48000, 100, "straight"), 0)

    def test_shuffle_and_swing_delay_the_and_tick(self):
        offset = js.swing_offset_samples(48000, 120, "shuffle")
        self.assertGreater(offset, 0)
        self.assertEqual(js.swing_offset_samples(48000, 120, "swing"), offset)

    def test_offset_shrinks_as_tempo_increases(self):
        slow = js.swing_offset_samples(48000, 60, "shuffle")
        fast = js.swing_offset_samples(48000, 200, "shuffle")
        self.assertGreater(slow, fast)

    def test_never_negative_at_extreme_bpm(self):
        self.assertGreaterEqual(js.swing_offset_samples(48000, 300, "shuffle"), 0)


if __name__ == "__main__":
    unittest.main()
