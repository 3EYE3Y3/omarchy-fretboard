"""Pure sample-position math for the metronome engine.

Mirrors the tick/beat semantics of js/metronome.js so the audible click and
the panel's visual beat indicator agree on what "beat 1" and "subdivision"
mean, even though this file is never imported by QML. Kept dependency-free
and importable on its own so it can be unit tested without spawning any
audio process.
"""

TIME_SIGNATURES = {
    "2-4": 2, "3-4": 3, "4-4": 4, "5-4": 5,
    "6-8": 2, "7-8": 7, "9-8": 3, "12-8": 4,
}

SUBDIVISIONS = {
    "quarter": 1,
    "eighth": 2,
    "triplet": 3,
    "sixteenth": 4,
}

MIN_BPM = 30
MAX_BPM = 300


def clamp_bpm(value):
    try:
        number = round(float(value))
    except (TypeError, ValueError):
        number = MIN_BPM
    return max(MIN_BPM, min(MAX_BPM, number))


def beats_per_bar(time_signature_id):
    return TIME_SIGNATURES.get(time_signature_id, 4)


def ticks_per_beat(subdivision_id):
    return SUBDIVISIONS.get(subdivision_id, 1)


def samples_per_tick(bpm, subdivision_id, sample_rate):
    """A beat is a quarter note in simple /4 meters and a dotted quarter in
    compound 6/8, 9/8 and 12/8. Subdivision three gives the written eighths
    of compound meter."""
    beat_seconds = 60.0 / clamp_bpm(bpm)
    tick_seconds = beat_seconds / ticks_per_beat(subdivision_id)
    return max(1, round(tick_seconds * sample_rate))


def tick_info(tick_index, time_signature_id, subdivision_id):
    """Returns (beat_index, sub_index, is_accent) for an absolute tick
    count since playback started."""
    per_beat = ticks_per_beat(subdivision_id)
    ticks_per_bar = beats_per_bar(time_signature_id) * per_beat
    within_bar = tick_index % ticks_per_bar
    beat_index = within_bar // per_beat
    sub_index = within_bar % per_beat
    return beat_index, sub_index, (beat_index == 0 and sub_index == 0)
