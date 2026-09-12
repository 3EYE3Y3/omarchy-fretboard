"""YIN pitch detection (de Cheveigne & Kawahara, 2002).

Reports a raw fundamental frequency only - note name/octave/cents math
lives in js/pitch.js so that conversion has one home and one test suite.
This module never talks to audio hardware; it only ever sees a buffer of
samples, so it is directly unit-testable with synthetic sine waves.

Uses NumPy's FFT for an O(N log N) autocorrelation when NumPy is
importable (accurate down to low bass frequencies with a comfortably large
window). Falls back to a smaller-window, pure-Python direct-sum
implementation otherwise, so the tuner still works - just with a slightly
higher practical low-frequency limit - on a system without NumPy.
"""

import math

try:
    import numpy as _np
except ImportError:  # pragma: no cover - exercised only where NumPy is absent
    _np = None

DEFAULT_THRESHOLD = 0.15
# A cheap early-exit only (skip YIN entirely on true digital silence) - the
# real, sensitivity-dependent noise-floor decision is NoteStabilizer's job
# (helper/tuner_stability.py), not this module's.
MIN_RMS = 0.0006


def _rms(samples):
    if not samples:
        return 0.0
    total = 0.0
    for value in samples:
        total += value * value
    return math.sqrt(total / len(samples))


def _parabolic_interpolate(diff, tau):
    if tau <= 0 or tau >= len(diff) - 1:
        return float(tau)
    x0, x1, x2 = diff[tau - 1], diff[tau], diff[tau + 1]
    denom = (x0 + x2 - 2 * x1)
    if denom == 0:
        return float(tau)
    shift = 0.5 * (x0 - x2) / denom
    return tau + shift


def _yin_numpy(samples, sample_rate, fmin, fmax, threshold):
    x = _np.asarray(samples, dtype=_np.float64)
    n = len(x)
    tau_max = min(n - 1, int(sample_rate / max(1, fmin)))
    tau_min = max(1, int(sample_rate / fmax))
    if tau_max <= tau_min:
        return None

    window = n - tau_max
    if window <= 0:
        return None

    # d(tau) = sum(x[j]^2) + sum(x[j+tau]^2) - 2*autocorr(tau), where
    # autocorr(tau) = sum_{j=0}^{window-1} x[j] * x[j+tau]. Computed as a
    # linear cross-correlation between x[:window] and the full buffer via
    # FFT (zero-padded well past window+n to avoid circular wraparound)
    # instead of an O(window * tau_max) direct sum.
    size = 1
    while size < (window + n):
        size *= 2
    head = x[:window]
    spectrum_full = _np.fft.rfft(x, n=size)
    spectrum_head = _np.fft.rfft(head, n=size)
    autocorr = _np.fft.irfft(spectrum_full * _np.conj(spectrum_head), n=size)[:tau_max + 1]

    energy = _np.cumsum(x * x)
    energy = _np.concatenate(([0.0], energy))
    power_head = energy[window] - energy[0]

    diff = _np.empty(tau_max + 1)
    diff[0] = 0.0
    for tau in range(1, tau_max + 1):
        power_tail = energy[window + tau] - energy[tau]
        diff[tau] = power_head + power_tail - 2 * autocorr[tau]

    cmnd = _np.empty(tau_max + 1)
    cmnd[0] = 1.0
    running_sum = 0.0
    for tau in range(1, tau_max + 1):
        running_sum += diff[tau]
        cmnd[tau] = diff[tau] * tau / running_sum if running_sum > 0 else 1.0

    return _select_tau(cmnd.tolist(), tau_min, tau_max, sample_rate, threshold)


def _yin_pure(samples, sample_rate, fmin, fmax, threshold):
    n = len(samples)
    tau_max = min(n - 1, int(sample_rate / max(1, fmin)))
    tau_min = max(1, int(sample_rate / fmax))
    if tau_max <= tau_min:
        return None
    window = n - tau_max
    if window <= 0:
        return None

    diff = [0.0] * (tau_max + 1)
    for tau in range(1, tau_max + 1):
        total = 0.0
        for j in range(window):
            delta = samples[j] - samples[j + tau]
            total += delta * delta
        diff[tau] = total

    cmnd = [1.0] * (tau_max + 1)
    running_sum = 0.0
    for tau in range(1, tau_max + 1):
        running_sum += diff[tau]
        cmnd[tau] = diff[tau] * tau / running_sum if running_sum > 0 else 1.0

    return _select_tau(cmnd, tau_min, tau_max, sample_rate, threshold)


def _select_tau(cmnd, tau_min, tau_max, sample_rate, threshold):
    chosen = None
    for tau in range(tau_min, tau_max + 1):
        if cmnd[tau] < threshold:
            # Walk to the local minimum, per the original YIN paper.
            while tau + 1 <= tau_max and cmnd[tau + 1] < cmnd[tau]:
                tau += 1
            chosen = tau
            break

    if chosen is None:
        best_tau = min(range(tau_min, tau_max + 1), key=lambda t: cmnd[t])
        if cmnd[best_tau] > 0.6:
            return None  # no convincing periodicity - likely silence/noise
        chosen = best_tau

    refined = _parabolic_interpolate(cmnd, chosen)
    if refined <= 0:
        return None
    frequency = sample_rate / refined
    clarity = max(0.0, min(1.0, 1.0 - cmnd[chosen]))
    return frequency, clarity


def estimate_pitch(samples, sample_rate, fmin=27.0, fmax=1400.0, threshold=DEFAULT_THRESHOLD):
    """Returns (frequency_hz, clarity, rms) or None if no pitch could be
    determined (silence, noise, or a signal without clear periodicity).

    fmin/fmax default to roughly a 5-string bass low B through high guitar
    fret positions; callers tune it tighter for a faster/steadier reading
    when they know the instrument.
    """
    rms = _rms(samples)
    if rms < MIN_RMS:
        return None

    result = _yin_numpy(samples, sample_rate, fmin, fmax, threshold) if _np is not None \
        else _yin_pure(samples, sample_rate, fmin, fmax, threshold)
    if result is None:
        return None
    frequency, clarity = result
    return frequency, clarity, rms
