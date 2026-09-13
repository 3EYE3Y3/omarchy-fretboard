#!/usr/bin/env python3
"""Metronome + drone playback engine.

Spawned by Service.qml as a long-lived child process, shared by the
metronome and the reference-tone drone since both are just "render PCM,
pipe it to `pw-cat --playback`" - only the waveform differs. Control comes
in as newline-delimited JSON on stdin; beat events and status go out the
same way on stdout.

The actual audible timing is paced by the sink consuming samples at a fixed
rate (the audio clock) rather than by a sleep()/QML Timer loop that desktop
load could make late or jittery. See docs/ARCHITECTURE.md for why this runs
as a separate process at all.
"""

import array
import json
import math
import random
import shutil
import signal
import subprocess
import sys
import threading

import click_schedule as cs
import jam_synth as jsynth

SAMPLE_RATE = 48000
CHUNK_SAMPLES = 960  # 20ms per chunk written to the playback sink
CLICK_MS = 12
ACCENT_FREQ = 1500.0
NORMAL_FREQ = 1000.0
DRONE_FADE_SECONDS = 0.03


def log(payload):
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def click_envelope(freq, amplitude, sample_rate):
    length = max(1, int(sample_rate * CLICK_MS / 1000))
    samples = []
    for i in range(length):
        t = i / sample_rate
        envelope = math.exp(-i / (length * 0.28))
        samples.append(amplitude * envelope * math.sin(2 * math.pi * freq * t))
    return samples


def tone_envelope(freq, amplitude, length_ms, decay, sample_rate):
    length = max(1, int(sample_rate * length_ms / 1000))
    out = []
    for i in range(length):
        t = i / sample_rate
        envelope = math.exp(-i / (length * decay))
        out.append(amplitude * envelope * math.sin(2 * math.pi * freq * t))
    return out


def chord_envelope(freqs, amplitude, length_ms, sample_rate):
    length = max(1, int(sample_rate * length_ms / 1000))
    out = [0.0] * length
    per_tone = amplitude / max(1, len(freqs))
    for freq in freqs:
        for i in range(length):
            t = i / sample_rate
            envelope = math.exp(-i / (length * 0.5))
            out[i] += per_tone * envelope * math.sin(2 * math.pi * freq * t)
    return out


def kick_envelope(amplitude, sample_rate):
    """A short pitch-dropping sine sweep (~150Hz -> ~45Hz) - a lightweight,
    unmistakably "kick drum" transient without needing a sampled drum hit."""
    length = max(1, int(sample_rate * 120 / 1000))
    out = []
    phase = 0.0
    for i in range(length):
        progress = i / length
        freq = 150.0 * math.exp(-4 * progress) + 45.0
        phase += 2 * math.pi * freq / sample_rate
        envelope = math.exp(-i / (length * 0.22))
        out.append(amplitude * envelope * math.sin(phase))
    return out


def noise_envelope(amplitude, length_ms, decay, sample_rate):
    """A short burst of white noise under an exponential decay - stands in
    for a snare (longer, louder) or hi-hat (shorter, quieter) without real
    drum-kit sample libraries, matching this project's local/offline,
    lightweight-accompaniment goal rather than DAW-quality drums."""
    length = max(1, int(sample_rate * length_ms / 1000))
    return [amplitude * math.exp(-i / (length * decay)) * random.uniform(-1.0, 1.0) for i in range(length)]


class Engine:
    def __init__(self):
        self.lock = threading.Lock()
        self.running = False
        self.mode = "metronome"
        self.bpm = 120
        self.time_signature_id = "4-4"
        self.subdivision_id = "quarter"
        self.volume = 0.8
        self.frequency = 220.0
        # Jam Session backing-track state (mode == "jam"): current chord and
        # rhythmic feel, pushed by Service.qml's stage engine as the
        # progression advances. See jam_synth.py for the note/role math.
        self.chord_root = 0
        self.chord_quality = "dominant7"
        self.feel = "straight"
        self.playback = None
        self.writer_thread = None
        self.stop_flag = threading.Event()
        self.playback_available = shutil.which("pw-cat") is not None

    def apply(self, cmd):
        with self.lock:
            if "mode" in cmd and cmd["mode"] in ("metronome", "drone", "jam"):
                self.mode = cmd["mode"]
            if "bpm" in cmd:
                self.bpm = cs.clamp_bpm(cmd["bpm"])
            if "timeSignatureId" in cmd:
                self.time_signature_id = cmd["timeSignatureId"]
            if "subdivisionId" in cmd:
                self.subdivision_id = cmd["subdivisionId"]
            if "frequency" in cmd:
                try:
                    self.frequency = max(1.0, float(cmd["frequency"]))
                except (TypeError, ValueError):
                    pass
            if "volume" in cmd:
                try:
                    self.volume = max(0.0, min(1.0, float(cmd["volume"])))
                except (TypeError, ValueError):
                    pass
            if "chordRoot" in cmd:
                try:
                    self.chord_root = int(cmd["chordRoot"]) % 12
                except (TypeError, ValueError):
                    pass
            if "chordQuality" in cmd and cmd["chordQuality"] in jsynth.CHORD_QUALITY_INTERVALS:
                self.chord_quality = cmd["chordQuality"]
            if "feel" in cmd and cmd["feel"] in ("straight", "shuffle", "swing"):
                self.feel = cmd["feel"]

    def snapshot(self):
        with self.lock:
            return (self.mode, self.bpm, self.time_signature_id, self.subdivision_id, self.volume,
                    self.frequency, self.chord_root, self.chord_quality, self.feel)

    def start(self, cmd):
        self.apply(cmd)
        if self.running:
            log({"type": "status", "running": True, "mode": self.mode, "bpm": self.bpm})
            return
        if not self.playback_available:
            log({"type": "error", "message": "pw-cat is not available; audio playback is disabled"})
            return
        try:
            self.playback = subprocess.Popen(
                ["pw-cat", "--playback", "--rate", str(SAMPLE_RATE), "--channels", "1",
                 "--format", "f32", "--raw", "-"],
                stdin=subprocess.PIPE,
            )
        except OSError as error:
            log({"type": "error", "message": "failed to start audio playback: %s" % error})
            return

        self.running = True
        self.stop_flag.clear()
        self.writer_thread = threading.Thread(target=self._write_loop, daemon=True)
        self.writer_thread.start()
        log({"type": "status", "running": True, "mode": self.mode, "bpm": self.bpm})

    def stop(self):
        if not self.running:
            log({"type": "status", "running": False, "mode": self.mode, "bpm": self.bpm})
            return
        self.running = False
        self.stop_flag.set()
        if self.writer_thread:
            self.writer_thread.join(timeout=2)
        self._terminate_playback()
        log({"type": "status", "running": False, "mode": self.mode, "bpm": self.bpm})

    def _terminate_playback(self):
        if self.playback is None:
            return
        try:
            if self.playback.stdin:
                self.playback.stdin.close()
            self.playback.terminate()
            self.playback.wait(timeout=2)
        except Exception:
            try:
                self.playback.kill()
            except Exception:
                pass
        self.playback = None

    def _write_chunk(self, chunk):
        buffer = array.array("f", (max(-1.0, min(1.0, s)) for s in chunk))
        if self.playback and self.playback.stdin:
            self.playback.stdin.write(buffer.tobytes())

    def _jam_tick_envelopes(self, beat_index, sub_index, chord_root, chord_quality, volume):
        """One eighth-note tick's worth of sound events, decided purely by
        jam_synth.beat_role - see that module for the rhythm/note design."""
        role = jsynth.beat_role(beat_index, sub_index)
        if role == "hihat":
            return [noise_envelope(volume * 0.22, 25, 0.3, SAMPLE_RATE)]
        if role == "kick_bass":
            bass_pc = jsynth.bass_pitch_class_for_beat(chord_root, chord_quality, beat_index)
            bass_freq = jsynth.note_frequency(bass_pc, 2)
            return [kick_envelope(volume * 0.95, SAMPLE_RATE),
                    tone_envelope(bass_freq, volume * 0.55, 220, 0.6, SAMPLE_RATE)]
        # snare_comp
        tones = jsynth.chord_tone_pitch_classes(chord_root, chord_quality)
        comp_freqs = [jsynth.note_frequency(t, 4) for t in tones]
        return [noise_envelope(volume * 0.45, 90, 0.35, SAMPLE_RATE),
                chord_envelope(comp_freqs, volume * 0.28, 260, SAMPLE_RATE)]

    def _write_loop(self):
        tick_index = 0
        next_tick_sample = 0
        sample_position = 0
        pending_clicks = []  # each: [start_sample_in_stream, envelope_samples, consumed_index]
        phase = 0.0
        fade = 0.0
        fade_step = 1.0 / max(1, int(SAMPLE_RATE * DRONE_FADE_SECONDS))

        try:
            while not self.stop_flag.is_set():
                mode, bpm, ts_id, sub_id, volume, frequency, chord_root, chord_quality, feel = self.snapshot()

                if mode == "jam":
                    fade = 0.0
                    chunk_end = sample_position + CHUNK_SAMPLES
                    eighth_samples = cs.samples_per_tick(bpm, "eighth", SAMPLE_RATE)
                    swing = jsynth.swing_offset_samples(SAMPLE_RATE, bpm, feel)
                    while next_tick_sample < chunk_end:
                        beat_index, sub_index, is_bar_start = cs.tick_info(tick_index, ts_id, "eighth")
                        scheduled_sample = next_tick_sample + (swing if sub_index == 1 else 0)
                        for envelope in self._jam_tick_envelopes(beat_index, sub_index, chord_root, chord_quality, volume):
                            pending_clicks.append([scheduled_sample, envelope, 0])
                        log({
                            "type": "beat", "tickIndex": tick_index, "beatIndex": beat_index,
                            "subIndex": sub_index, "accent": is_bar_start,
                            "atSample": next_tick_sample, "atSeconds": next_tick_sample / SAMPLE_RATE,
                        })
                        tick_index += 1
                        next_tick_sample += eighth_samples

                    chunk = [0.0] * CHUNK_SAMPLES
                    still_pending = []
                    for click in pending_clicks:
                        start, envelope, consumed = click
                        offset = start + consumed - sample_position
                        i = consumed
                        while i < len(envelope):
                            pos = offset + (i - consumed)
                            if pos >= CHUNK_SAMPLES:
                                break
                            if pos >= 0:
                                chunk[pos] += envelope[i]
                            i += 1
                        click[2] = i
                        if i < len(envelope):
                            still_pending.append(click)
                    pending_clicks = still_pending

                    try:
                        self._write_chunk(chunk)
                    except (BrokenPipeError, OSError):
                        log({"type": "error", "message": "audio playback stream closed unexpectedly"})
                        break

                    sample_position = chunk_end
                    continue

                if mode == "drone":
                    chunk = [0.0] * CHUNK_SAMPLES
                    for i in range(CHUNK_SAMPLES):
                        fade = min(1.0, fade + fade_step)
                        chunk[i] = volume * fade * math.sin(phase)
                        phase += 2 * math.pi * frequency / SAMPLE_RATE
                        if phase > 2 * math.pi:
                            phase -= 2 * math.pi
                    self._write_chunk(chunk)
                    sample_position += CHUNK_SAMPLES
                    tick_index = 0
                    next_tick_sample = sample_position
                    pending_clicks = []
                    continue

                # metronome mode
                fade = 0.0
                chunk_end = sample_position + CHUNK_SAMPLES
                while next_tick_sample < chunk_end:
                    beat_index, sub_index, accent = cs.tick_info(tick_index, ts_id, sub_id)
                    amplitude = volume * (1.0 if accent else 0.65)
                    freq = ACCENT_FREQ if accent else NORMAL_FREQ
                    envelope = click_envelope(freq, amplitude, SAMPLE_RATE)
                    pending_clicks.append([next_tick_sample, envelope, 0])
                    log({
                        "type": "beat", "tickIndex": tick_index, "beatIndex": beat_index,
                        "subIndex": sub_index, "accent": accent,
                        "atSample": next_tick_sample, "atSeconds": next_tick_sample / SAMPLE_RATE,
                    })
                    tick_index += 1
                    next_tick_sample += cs.samples_per_tick(bpm, sub_id, SAMPLE_RATE)

                chunk = [0.0] * CHUNK_SAMPLES
                still_pending = []
                for click in pending_clicks:
                    start, envelope, consumed = click
                    offset = start + consumed - sample_position
                    i = consumed
                    while i < len(envelope):
                        pos = offset + (i - consumed)
                        if pos >= CHUNK_SAMPLES:
                            break
                        if pos >= 0:
                            chunk[pos] += envelope[i]
                        i += 1
                    click[2] = i
                    if i < len(envelope):
                        still_pending.append(click)
                pending_clicks = still_pending

                try:
                    self._write_chunk(chunk)
                except (BrokenPipeError, OSError):
                    log({"type": "error", "message": "audio playback stream closed unexpectedly"})
                    break

                sample_position = chunk_end
        finally:
            # A short silent fade-out chunk avoids an audible pop when a
            # sustained drone tone is cut off mid-waveform.
            try:
                fade_out = [volume * max(0.0, fade - fade_step * i) * math.sin(phase + i * 2 * math.pi * frequency / SAMPLE_RATE)
                            for i in range(min(CHUNK_SAMPLES, int(SAMPLE_RATE * DRONE_FADE_SECONDS)))]
                if fade > 0:
                    self._write_chunk(fade_out)
            except Exception:
                pass


def main():
    engine = Engine()

    def handle_signal(signum, frame):
        # A direct child left running after this process dies would keep
        # holding the playback device open (reparented to init), so any
        # termination signal must stop pw-cat before this process exits.
        engine.stop()
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    log({"type": "ready", "playbackAvailable": engine.playback_available})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            cmd = json.loads(line)
        except json.JSONDecodeError:
            log({"type": "error", "message": "invalid control JSON"})
            continue

        action = cmd.get("cmd")
        if action == "start":
            engine.start(cmd)
        elif action == "update":
            engine.apply(cmd)
            log({"type": "status", "running": engine.running, "mode": engine.mode, "bpm": engine.bpm})
        elif action == "stop":
            engine.stop()
        elif action == "ping":
            log({"type": "pong"})
        elif action == "shutdown":
            engine.stop()
            break

    engine.stop()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
