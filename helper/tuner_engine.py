#!/usr/bin/env python3
"""Chromatic tuner pitch-detection engine.

Spawned by Service.qml only while the Tuner panel is open and listening.
Captures mono audio via `pw-record` and reports a raw frequency/clarity/rms
reading per hop as newline-delimited JSON on stdout. Note name, octave, and
cents-off-reference are deliberately NOT computed here - that conversion
lives in js/pitch.js so the reference-pitch (A4) logic has one home. Device
selection is argv-driven (`--target`); switching microphones means Service
.qml stops this process and starts a new one with a different --target,
which keeps this process itself dead simple and stateless about control.
"""

import argparse
import json
import shutil
import signal
import struct
import subprocess
import sys

import pitch_yin
import tuner_stability

SAMPLE_RATE = 48000
WINDOW_SAMPLES = 4096   # ~85ms at 48kHz - enough for low guitar/bass notes
HOP_SAMPLES = 1024      # ~21ms between readings
BYTES_PER_SAMPLE = 4    # 32-bit float


def log(payload):
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def read_exact(stream, num_bytes):
    chunks = []
    remaining = num_bytes
    while remaining > 0:
        chunk = stream.read(remaining)
        if not chunk:
            return None
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rate", type=int, default=SAMPLE_RATE)
    parser.add_argument("--target", type=str, default=None, help="PipeWire node id/name to capture from")
    parser.add_argument("--fmin", type=float, default=27.0)
    parser.add_argument("--fmax", type=float, default=1400.0)
    parser.add_argument("--sensitivity", type=str, default=tuner_stability.DEFAULT_SENSITIVITY,
                         choices=list(tuner_stability.SENSITIVITY_PRESETS.keys()))
    args = parser.parse_args()

    if shutil.which("pw-record") is None:
        log({"type": "error", "message": "pw-record is not available; tuner input is disabled"})
        return 1

    command = ["pw-record", "--rate", str(args.rate), "--channels", "1", "--format", "f32", "--raw"]
    if args.target:
        command += ["--target", args.target]
    command.append("-")

    try:
        capture = subprocess.Popen(command, stdout=subprocess.PIPE)
    except OSError as error:
        log({"type": "error", "message": "failed to start microphone capture: %s" % error})
        return 1

    def handle_signal(signum, frame):
        try:
            capture.terminate()
            capture.wait(timeout=2)
        except Exception:
            try:
                capture.kill()
            except Exception:
                pass
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    log({"type": "ready", "sampleRate": args.rate, "target": args.target, "sensitivity": args.sensitivity})

    threshold = tuner_stability.yin_threshold_for(args.sensitivity)
    stabilizer = tuner_stability.NoteStabilizer(args.sensitivity)

    window = []
    try:
        while True:
            raw = read_exact(capture.stdout, HOP_SAMPLES * BYTES_PER_SAMPLE)
            if raw is None:
                log({"type": "error", "message": "microphone stream ended"})
                break
            hop = list(struct.unpack("<%df" % HOP_SAMPLES, raw))
            window.extend(hop)
            if len(window) > WINDOW_SAMPLES:
                window = window[-WINDOW_SAMPLES:]
            if len(window) < WINDOW_SAMPLES:
                continue

            raw_result = pitch_yin.estimate_pitch(window, args.rate, fmin=args.fmin, fmax=args.fmax, threshold=threshold)
            stable_frequency = stabilizer.process(raw_result)
            if stable_frequency is None:
                log({"type": "reading", "frequency": None})
            else:
                # clarity/rms are diagnostic only - the frequency is what
                # the UI trusts, already gated/smoothed by the stabilizer.
                clarity = raw_result[1] if raw_result is not None else None
                rms = raw_result[2] if raw_result is not None else None
                log({"type": "reading", "frequency": stable_frequency, "clarity": clarity, "rms": rms})
    finally:
        handle_signal(None, None)

    return 0


if __name__ == "__main__":
    sys.exit(main())
