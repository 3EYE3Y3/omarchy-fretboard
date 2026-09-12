import math
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pitch_yin  # noqa: E402
import tuner_stability  # noqa: E402

SAMPLE_RATE = 48000
WINDOW_SAMPLES = 4096
HOP_SAMPLES = 1024


def sine_samples(freq, sample_rate, seconds, amplitude=0.3, phase0=0.0):
    n = int(sample_rate * seconds)
    return [amplitude * math.sin(phase0 + 2 * math.pi * freq * i / sample_rate) for i in range(n)]


def silence_samples(sample_rate, seconds):
    return [0.0] * int(sample_rate * seconds)


def noise_samples(sample_rate, seconds, amplitude, seed=1):
    rng = random.Random(seed)
    n = int(sample_rate * seconds)
    return [rng.uniform(-amplitude, amplitude) for _ in range(n)]


def decaying_sine_samples(freq, sample_rate, seconds, start_amplitude, half_life_seconds):
    n = int(sample_rate * seconds)
    decay = math.log(2) / (half_life_seconds * sample_rate)
    return [start_amplitude * math.exp(-decay * i) * math.sin(2 * math.pi * freq * i / sample_rate) for i in range(n)]


def stream_through(samples, sensitivity="normal", sample_rate=SAMPLE_RATE, fmin=27.0, fmax=1400.0):
    """Mirrors tuner_engine.py's real hop/window loop: extend a rolling
    window by HOP_SAMPLES at a time, run YIN once full, then feed the
    result through a fresh NoteStabilizer. Returns the list of stabilized
    outputs (float or None), one per hop once the window first fills."""
    stabilizer = tuner_stability.NoteStabilizer(sensitivity)
    threshold = tuner_stability.yin_threshold_for(sensitivity)
    outputs = []
    window = []
    for start in range(0, len(samples) - HOP_SAMPLES + 1, HOP_SAMPLES):
        window.extend(samples[start:start + HOP_SAMPLES])
        if len(window) > WINDOW_SAMPLES:
            window = window[-WINDOW_SAMPLES:]
        if len(window) < WINDOW_SAMPLES:
            continue
        result = pitch_yin.estimate_pitch(window, sample_rate, fmin=fmin, fmax=fmax, threshold=threshold)
        outputs.append(stabilizer.process(result))
    return outputs


def locked_values(outputs):
    return [v for v in outputs if v is not None]


class SilenceAndNoiseTests(unittest.TestCase):
    def test_silence_never_locks(self):
        outputs = stream_through(silence_samples(SAMPLE_RATE, 1.0))
        self.assertEqual(locked_values(outputs), [])

    def test_low_level_broadband_noise_does_not_falsely_lock(self):
        # A realistic ambient room noise floor, not a played note.
        outputs = stream_through(noise_samples(SAMPLE_RATE, 1.5, amplitude=0.004))
        self.assertLessEqual(len(locked_values(outputs)), 1, "broadband noise should not confirm a stable lock")

    def test_short_transient_click_is_rejected(self):
        samples = (
            silence_samples(SAMPLE_RATE, 0.3)
            + noise_samples(SAMPLE_RATE, HOP_SAMPLES / SAMPLE_RATE, amplitude=0.4, seed=7)
            + silence_samples(SAMPLE_RATE, 0.3)
        )
        outputs = stream_through(samples)
        self.assertEqual(locked_values(outputs), [], "a single-hop transient must never be confirmed as a note")


class CleanSignalTests(unittest.TestCase):
    def test_locks_onto_a_clean_plucked_note_quickly_and_accurately(self):
        outputs = stream_through(sine_samples(110.0, SAMPLE_RATE, 1.0))  # A2
        values = locked_values(outputs)
        self.assertGreater(len(values), len(outputs) // 2, "should be locked for most of a clean steady tone")
        for value in values:
            self.assertAlmostEqual(value, 110.0, delta=110.0 * 0.02)

        # Locks within a reasonable amount of time, not sluggishly.
        first_lock_index = next(i for i, v in enumerate(outputs) if v is not None)
        self.assertLess(first_lock_index * (HOP_SAMPLES / SAMPLE_RATE), 0.3)

    def test_tolerates_a_clean_note_over_quiet_background_noise(self):
        tone = sine_samples(220.0, SAMPLE_RATE, 1.2, amplitude=0.3)
        noise = noise_samples(SAMPLE_RATE, 1.2, amplitude=0.015, seed=3)
        mixed = [t + n for t, n in zip(tone, noise)]
        outputs = stream_through(mixed)
        values = locked_values(outputs)
        self.assertGreater(len(values), len(outputs) // 2)
        for value in values:
            self.assertAlmostEqual(value, 220.0, delta=220.0 * 0.03)


class DecayAndStabilityTests(unittest.TestCase):
    def test_holds_the_note_through_natural_decay_then_releases_cleanly(self):
        # A plucked D3 that decays away over ~1.5s, then true silence.
        decaying = decaying_sine_samples(146.83, SAMPLE_RATE, 1.5, start_amplitude=0.35, half_life_seconds=0.35)
        samples = decaying + silence_samples(SAMPLE_RATE, 0.5)
        outputs = stream_through(samples)

        values = locked_values(outputs)
        self.assertGreater(len(values), 5, "should hold a lock through at least some of the decay")

        # Never jumps to an unrelated note while decaying or holding.
        for value in values:
            cents = 1200 * math.log2(value / 146.83)
            self.assertLess(abs(cents), 80, f"drifted to an unrelated pitch: {value}Hz vs 146.83Hz")

        # Exactly one lock -> silence transition: it never flickers back
        # on after it has genuinely released.
        transitions_to_none = 0
        for i in range(1, len(outputs)):
            if outputs[i - 1] is not None and outputs[i] is None:
                transitions_to_none += 1
        self.assertLessEqual(transitions_to_none, 1)
        self.assertIsNone(outputs[-1], "should have returned to no-signal by the end of trailing silence")

    def test_does_not_flicker_on_a_perfectly_steady_tone(self):
        outputs = stream_through(sine_samples(196.0, SAMPLE_RATE, 1.0))  # G3
        # Once locked, a steady tone should stay locked - no dropouts.
        first_lock = next(i for i, v in enumerate(outputs) if v is not None)
        tail = outputs[first_lock:]
        self.assertTrue(all(v is not None for v in tail), "a steady clean tone should not drop out once locked")


class SensitivityPresetTests(unittest.TestCase):
    def test_noisy_room_requires_a_louder_signal_than_normal(self):
        # RMS ~0.005: at/above "normal"'s floor (0.003), below "noisy_room"'s (0.008).
        quiet_tone = sine_samples(196.0, SAMPLE_RATE, 1.0, amplitude=0.005 * math.sqrt(2))

        normal_outputs = stream_through(quiet_tone, sensitivity="normal")
        noisy_outputs = stream_through(quiet_tone, sensitivity="noisy_room")

        self.assertGreater(len(locked_values(normal_outputs)), 0, "normal sensitivity should catch this signal")
        self.assertEqual(locked_values(noisy_outputs), [], "noisy_room should reject a signal this quiet")

    def test_quiet_sensitivity_confirms_faster_than_noisy_room(self):
        tone = sine_samples(146.83, SAMPLE_RATE, 1.0, amplitude=0.3)
        quiet_outputs = stream_through(tone, sensitivity="quiet")
        noisy_outputs = stream_through(tone, sensitivity="noisy_room")

        quiet_first = next(i for i, v in enumerate(quiet_outputs) if v is not None)
        noisy_first = next(i for i, v in enumerate(noisy_outputs) if v is not None)
        self.assertLessEqual(quiet_first, noisy_first)

    def test_all_sensitivity_presets_are_internally_consistent(self):
        for name, params in tuner_stability.SENSITIVITY_PRESETS.items():
            self.assertGreater(params["min_rms"], 0)
            self.assertTrue(0 < params["min_clarity"] < 1)
            self.assertGreaterEqual(params["confirm_frames"], 1)
            self.assertGreaterEqual(params["hold_frames"], 1)
            self.assertGreater(params["agree_cents"], 0)
            self.assertGreater(params["hysteresis_cents"], params["agree_cents"] - 1)


class NoteStabilizerUnitTests(unittest.TestCase):
    """Pure-logic tests against synthetic (frequency, clarity, rms) frames,
    independent of YIN, for fast and exact control over edge cases."""

    def test_rejects_a_single_frame_spike_before_locking(self):
        stabilizer = tuner_stability.NoteStabilizer("normal")
        self.assertIsNone(stabilizer.process((440.0, 0.9, 0.1)))
        self.assertIsNone(stabilizer.process(None))
        self.assertIsNone(stabilizer.process(None))

    def test_locks_after_confirm_frames_of_agreement(self):
        stabilizer = tuner_stability.NoteStabilizer("normal")
        confirm_frames = tuner_stability.SENSITIVITY_PRESETS["normal"]["confirm_frames"]
        result = None
        for _ in range(confirm_frames):
            result = stabilizer.process((440.0, 0.9, 0.1))
        self.assertIsNotNone(result)
        self.assertAlmostEqual(result, 440.0, delta=1)

    def test_holds_through_a_gap_then_releases_after_hold_frames(self):
        stabilizer = tuner_stability.NoteStabilizer("normal")
        for _ in range(tuner_stability.SENSITIVITY_PRESETS["normal"]["confirm_frames"]):
            stabilizer.process((440.0, 0.9, 0.1))
        hold_frames = tuner_stability.SENSITIVITY_PRESETS["normal"]["hold_frames"]
        for _ in range(hold_frames):
            self.assertIsNotNone(stabilizer.process(None), "should hold through the gap")
        self.assertIsNone(stabilizer.process(None), "should release once past hold_frames")

    def test_small_drift_is_absorbed_by_hysteresis(self):
        stabilizer = tuner_stability.NoteStabilizer("normal")
        for _ in range(tuner_stability.SENSITIVITY_PRESETS["normal"]["confirm_frames"]):
            stabilizer.process((440.0, 0.9, 0.1))
        # A few cents of drift (well under hysteresis_cents) should not
        # reset the lock or require re-confirmation.
        drifted = 440.0 * (2 ** (10 / 1200.0))  # +10 cents
        result = stabilizer.process((drifted, 0.9, 0.1))
        self.assertIsNotNone(result)
        self.assertAlmostEqual(result, 440.0, delta=2)

    def test_switches_note_only_after_the_new_one_is_confirmed(self):
        stabilizer = tuner_stability.NoteStabilizer("normal")
        confirm_frames = tuner_stability.SENSITIVITY_PRESETS["normal"]["confirm_frames"]
        for _ in range(confirm_frames):
            stabilizer.process((440.0, 0.9, 0.1))
        # A completely different note (A4 -> D5, ~700 cents away) appears
        # for one frame - must not switch immediately.
        first = stabilizer.process((587.33, 0.9, 0.1))
        self.assertAlmostEqual(first, 440.0, delta=1, msg="must not switch on the first disagreeing frame")
        # Confirm it across enough frames and it should switch.
        result = first
        for _ in range(confirm_frames):
            result = stabilizer.process((587.33, 0.9, 0.1))
        self.assertAlmostEqual(result, 587.33, delta=1)


if __name__ == "__main__":
    unittest.main()
