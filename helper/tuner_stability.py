"""Temporal stabilization layer for the tuner's frame-by-frame YIN readings.

pitch_yin.estimate_pitch() answers "what pitch is in this ~85ms window",
completely statelessly - it has no idea what the previous window looked
like. Fed straight to the UI, that makes an ordinary room reactive to every
bit of ambient noise: air conditioning hum, a chair creak, or the room's own
noise floor will flicker a note in and out, and a decaying string's
harmonics can make the reading jump to an unrelated note right as it fades.

NoteStabilizer sits between the two and answers a different question: "what
note, if any, should the user be shown right now, given everything recently
observed." It never touches YIN itself (v0.3.1 kept the same detector on
purpose - the complaint was noise handling, not pitch accuracy):

  - gates each frame on RMS and YIN clarity (both sensitivity-dependent)
    before it is even considered a candidate
  - requires `confirm_frames` consecutive agreeing candidates before
    reporting a *new* note (rejects one-frame spikes/transients outright)
  - once locked onto a note, requires a candidate to disagree by more than
    `hysteresis_cents` *and* itself be confirmed before switching - so a
    decaying string's harmonics drifting a few cents, or briefly favoring an
    overtone, doesn't bounce the display around
  - holds the locked note through up to `hold_frames` failing/quiet frames
    before dropping to "no signal", so a natural decay reads as one steady
    note fading out rather than a flicker of dropouts
  - smooths the reported frequency once locked, so cents display doesn't
    jitter frame to frame while otherwise stable
"""

import math

# Quiet/Normal/Noisy Room only ever change these gates - never microphone
# gain. "Quiet" trusts a softer, lower-confidence signal (best in a silent
# room where that signal is more likely a real, quiet note); "Noisy Room"
# demands a louder, cleaner, longer-confirmed signal before it will lock,
# trading a little latency for resistance to a noisy background.
SENSITIVITY_PRESETS = {
    "quiet": {
        "min_rms": 0.0015,
        "min_clarity": 0.35,
        "yin_threshold": 0.20,
        "confirm_frames": 2,
        "hold_frames": 6,
        "agree_cents": 40,
        "hysteresis_cents": 55,
        "smoothing_alpha": 0.35,
    },
    "normal": {
        "min_rms": 0.003,
        "min_clarity": 0.5,
        "yin_threshold": 0.15,
        "confirm_frames": 3,
        "hold_frames": 5,
        "agree_cents": 35,
        "hysteresis_cents": 60,
        "smoothing_alpha": 0.3,
    },
    "noisy_room": {
        "min_rms": 0.008,
        "min_clarity": 0.65,
        "yin_threshold": 0.10,
        "confirm_frames": 4,
        "hold_frames": 4,
        "agree_cents": 30,
        "hysteresis_cents": 65,
        "smoothing_alpha": 0.25,
    },
}

DEFAULT_SENSITIVITY = "normal"


def params_for(sensitivity):
    return SENSITIVITY_PRESETS.get(sensitivity, SENSITIVITY_PRESETS[DEFAULT_SENSITIVITY])


def yin_threshold_for(sensitivity):
    return params_for(sensitivity)["yin_threshold"]


def _cents(freq_a, freq_b):
    if freq_a <= 0 or freq_b <= 0:
        return 0.0
    return 1200.0 * math.log(freq_a / freq_b, 2)


class NoteStabilizer:
    def __init__(self, sensitivity=DEFAULT_SENSITIVITY):
        self.params = params_for(sensitivity)
        self.locked_freq = None
        self.silence_count = 0
        self.pending_freq = None
        self.pending_count = 0

    def _consider(self, candidate):
        """Feeds one valid candidate into the pending-confirmation buffer.
        Returns the frequency to lock onto once confirm_frames is reached,
        else None."""
        if self.pending_freq is None or abs(_cents(candidate, self.pending_freq)) > self.params["agree_cents"]:
            self.pending_freq = candidate
            self.pending_count = 1
        else:
            self.pending_freq = candidate
            self.pending_count += 1
        if self.pending_count >= self.params["confirm_frames"]:
            confirmed = self.pending_freq
            self.pending_freq = None
            self.pending_count = 0
            return confirmed
        return None

    def process(self, result):
        """`result` is whatever pitch_yin.estimate_pitch() returned for the
        latest frame: None, or (frequency, clarity, rms). Returns the
        stabilized frequency to display, or None for "no signal"."""
        valid = False
        candidate = None
        if result is not None:
            freq, clarity, rms = result
            if rms >= self.params["min_rms"] and clarity >= self.params["min_clarity"]:
                valid = True
                candidate = freq

        if self.locked_freq is None:
            if valid:
                confirmed = self._consider(candidate)
                if confirmed is not None:
                    self.locked_freq = confirmed
                    self.silence_count = 0
            else:
                self.pending_freq = None
                self.pending_count = 0
            return self.locked_freq

        # Locked: hold through brief dropouts/decay, only switch notes once
        # a disagreeing candidate is itself confirmed across several frames.
        if valid:
            diff = _cents(candidate, self.locked_freq)
            if abs(diff) <= self.params["hysteresis_cents"]:
                alpha = self.params["smoothing_alpha"]
                self.locked_freq = self.locked_freq + alpha * (candidate - self.locked_freq)
                self.silence_count = 0
                self.pending_freq = None
                self.pending_count = 0
            else:
                confirmed = self._consider(candidate)
                if confirmed is not None:
                    self.locked_freq = confirmed
                self.silence_count = 0
            return self.locked_freq

        self.silence_count += 1
        if self.silence_count > self.params["hold_frames"]:
            self.locked_freq = None
            self.pending_freq = None
            self.pending_count = 0
            return None
        return self.locked_freq
