import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import click_schedule as cs  # noqa: E402


class ClampBpmTests(unittest.TestCase):
    def test_clamps_into_range(self):
        self.assertEqual(cs.clamp_bpm(10), 30)
        self.assertEqual(cs.clamp_bpm(500), 300)
        self.assertEqual(cs.clamp_bpm(120.6), 121)

    def test_handles_garbage_input(self):
        self.assertEqual(cs.clamp_bpm("nope"), 30)
        self.assertEqual(cs.clamp_bpm(None), 30)


class SamplesPerTickTests(unittest.TestCase):
    def test_matches_expected_duration_at_120bpm_quarter(self):
        # 120 BPM -> 0.5s per beat -> 24000 samples at 48kHz.
        self.assertEqual(cs.samples_per_tick(120, "quarter", 48000), 24000)

    def test_eighth_subdivision_halves_tick_duration(self):
        self.assertEqual(cs.samples_per_tick(120, "eighth", 48000), 12000)

    def test_triplet_divides_into_thirds(self):
        value = cs.samples_per_tick(120, "triplet", 48000)
        self.assertAlmostEqual(value, 8000, delta=1)

    def test_never_returns_zero_or_negative(self):
        self.assertGreaterEqual(cs.samples_per_tick(300, "sixteenth", 8000), 1)


class TickInfoTests(unittest.TestCase):
    def test_four_four_quarter_accents_every_fourth_tick(self):
        results = [cs.tick_info(i, "4-4", "quarter") for i in range(8)]
        accents = [r[2] for r in results]
        self.assertEqual(accents, [True, False, False, False, True, False, False, False])

    def test_three_four_eighth_subdivision(self):
        results = [cs.tick_info(i, "3-4", "eighth") for i in range(6)]
        beat_indexes = [r[0] for r in results]
        sub_indexes = [r[1] for r in results]
        self.assertEqual(beat_indexes, [0, 0, 1, 1, 2, 2])
        self.assertEqual(sub_indexes, [0, 1, 0, 1, 0, 1])

    def test_resumes_mid_bar_from_an_arbitrary_start_tick(self):
        beat_index, sub_index, accent = cs.tick_info(4, "4-4", "quarter")
        self.assertEqual((beat_index, sub_index, accent), (0, 0, True))

    def test_six_eight_has_two_compound_beats_of_three_eighths(self):
        results = [cs.tick_info(i, "6-8", "triplet") for i in range(12)]
        self.assertEqual([r[0] for r in results], [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1])
        self.assertEqual([r[2] for r in results], [True, False, False, False, False, False, True, False, False, False, False, False])


if __name__ == "__main__":
    unittest.main()
