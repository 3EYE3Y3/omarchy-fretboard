import math
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pitch_yin  # noqa: E402


def sine_wave(freq, sample_rate, seconds, amplitude=0.5):
    n = int(sample_rate * seconds)
    return [amplitude * math.sin(2 * math.pi * freq * i / sample_rate) for i in range(n)]


class EstimatePitchNumpyPathTests(unittest.TestCase):
    def setUp(self):
        if pitch_yin._np is None:
            self.skipTest("NumPy not installed in this environment")

    def test_recovers_guitar_open_string_frequencies(self):
        sample_rate = 48000
        for freq in (82.41, 110.0, 146.83, 196.0, 246.94, 329.63):
            samples = sine_wave(freq, sample_rate, 0.1)
            result = pitch_yin.estimate_pitch(samples, sample_rate)
            self.assertIsNotNone(result, f"no pitch detected for {freq}Hz")
            detected, clarity, rms = result
            self.assertAlmostEqual(detected, freq, delta=freq * 0.01)
            self.assertGreater(clarity, 0.5)
            self.assertGreater(rms, 0)

    def test_returns_none_for_silence(self):
        sample_rate = 48000
        samples = [0.0] * int(sample_rate * 0.1)
        self.assertIsNone(pitch_yin.estimate_pitch(samples, sample_rate))

    def test_returns_none_for_white_noise(self):
        import random
        random.seed(42)
        sample_rate = 48000
        samples = [random.uniform(-0.5, 0.5) for _ in range(int(sample_rate * 0.1))]
        result = pitch_yin.estimate_pitch(samples, sample_rate)
        # White noise has no stable periodicity - either no detection, or
        # if one slips through it must carry very low confidence.
        if result is not None:
            self.assertLess(result[1], 0.5)


class EstimatePitchPureFallbackTests(unittest.TestCase):
    def setUp(self):
        self._original_np = pitch_yin._np
        pitch_yin._np = None  # force the pure-Python path for this test class

    def tearDown(self):
        pitch_yin._np = self._original_np

    def test_recovers_a_mid_range_guitar_frequency(self):
        sample_rate = 22050
        freq = 220.0
        samples = sine_wave(freq, sample_rate, 0.08)
        result = pitch_yin.estimate_pitch(samples, sample_rate, fmin=60, fmax=1000)
        self.assertIsNotNone(result)
        detected, clarity, _rms = result
        self.assertAlmostEqual(detected, freq, delta=freq * 0.02)

    def test_returns_none_for_silence(self):
        sample_rate = 22050
        samples = [0.0] * int(sample_rate * 0.08)
        self.assertIsNone(pitch_yin.estimate_pitch(samples, sample_rate))


if __name__ == "__main__":
    unittest.main()
