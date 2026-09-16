#!/usr/bin/env python3
"""Safely list input devices for the tuner's device picker.

The helper is intentionally one-shot. It executes only Omarchy's packaged
``/usr/bin/pactl``, with a closed environment, and applies byte and time limits
while draining both output pipes. Service.qml applies a second, independent
limit to this helper's own output.
"""

import json
import os
import selectors
import signal
import stat
import subprocess
import sys
import time


TRUSTED_PACTL_PATH = "/usr/bin/pactl"
PACTL_STDOUT_LIMIT_BYTES = 256 * 1024
PACTL_STDERR_LIMIT_BYTES = 16 * 1024
HELPER_OUTPUT_LIMIT_BYTES = 60 * 1024
PACTL_TIMEOUT_SECONDS = 5.0
TERMINATE_GRACE_SECONDS = 0.25
READ_CHUNK_BYTES = 8192
MAX_DEVICES = 64
MAX_DEVICE_NAME_BYTES = 256
MAX_DEVICE_DESCRIPTION_BYTES = 512

_active_process = None


class DeviceEnumerationError(Exception):
    """A controlled device-enumeration failure."""


def trusted_pactl_path():
    """Return the fixed packaged pactl identity, or fail closed."""
    try:
        info = os.stat(TRUSTED_PACTL_PATH)
    except OSError as error:
        raise DeviceEnumerationError("trusted pactl is unavailable") from error
    if (
        not os.path.isabs(TRUSTED_PACTL_PATH)
        or os.path.realpath(TRUSTED_PACTL_PATH) != TRUSTED_PACTL_PATH
        or not stat.S_ISREG(info.st_mode)
        or info.st_uid != 0
        or info.st_mode & 0o022
        or not os.access(TRUSTED_PACTL_PATH, os.X_OK)
    ):
        raise DeviceEnumerationError("trusted pactl identity is invalid")
    return TRUSTED_PACTL_PATH


def pactl_environment(source=None):
    """Build the closed environment needed to reach the user's audio socket."""
    inherited = os.environ if source is None else source
    environment = {"LANG": "C.UTF-8", "LC_ALL": "C.UTF-8"}
    for name in ("XDG_RUNTIME_DIR", "PULSE_SERVER"):
        value = inherited.get(name)
        if value:
            environment[name] = value
    return environment


def _terminate_and_reap(process):
    """Terminate the pactl process group, escalate if needed, and reap it."""
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        process.wait(timeout=TERMINATE_GRACE_SECONDS)
        return
    except subprocess.TimeoutExpired:
        pass
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    process.wait()


def _read_bounded(process):
    """Drain stdout/stderr concurrently without retaining bytes over a limit."""
    output = bytearray()
    stderr_bytes = 0
    deadline = time.monotonic() + PACTL_TIMEOUT_SECONDS
    stream_limits = {
        process.stdout: ("stdout", PACTL_STDOUT_LIMIT_BYTES),
        process.stderr: ("stderr", PACTL_STDERR_LIMIT_BYTES),
    }

    with selectors.DefaultSelector() as selector:
        for stream, (name, _limit) in stream_limits.items():
            os.set_blocking(stream.fileno(), False)
            selector.register(stream, selectors.EVENT_READ, name)

        while selector.get_map():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise DeviceEnumerationError("pactl timed out")
            events = selector.select(remaining)
            if not events:
                raise DeviceEnumerationError("pactl timed out")

            for key, _mask in events:
                stream = key.fileobj
                name, limit = stream_limits[stream]
                retained = len(output) if name == "stdout" else stderr_bytes
                read_size = min(READ_CHUNK_BYTES, limit - retained + 1)
                try:
                    chunk = os.read(stream.fileno(), read_size)
                except BlockingIOError:
                    continue
                if not chunk:
                    selector.unregister(stream)
                    continue
                if retained + len(chunk) > limit:
                    raise DeviceEnumerationError(f"pactl {name} exceeded its byte limit")
                if name == "stdout":
                    output.extend(chunk)
                else:
                    stderr_bytes += len(chunk)

    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise DeviceEnumerationError("pactl timed out")
    try:
        return_code = process.wait(timeout=remaining)
    except subprocess.TimeoutExpired as error:
        raise DeviceEnumerationError("pactl timed out") from error
    if return_code != 0:
        raise DeviceEnumerationError("pactl failed")
    return bytes(output)


def run_pactl(pactl_path, environment):
    """Execute a specified absolute pactl fixture/identity under hard limits."""
    global _active_process
    try:
        process = subprocess.Popen(
            [pactl_path, "-f", "json", "list", "sources"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=environment,
            start_new_session=True,
        )
    except OSError as error:
        raise DeviceEnumerationError("pactl could not be started") from error

    _active_process = process
    try:
        return _read_bounded(process)
    except DeviceEnumerationError:
        _terminate_and_reap(process)
        raise
    except (OSError, ValueError) as error:
        _terminate_and_reap(process)
        raise DeviceEnumerationError("pactl output could not be read safely") from error
    except BaseException:
        _terminate_and_reap(process)
        raise
    finally:
        if process.stdout is not None:
            process.stdout.close()
        if process.stderr is not None:
            process.stderr.close()
        _active_process = None


def _bounded_text(value, limit, field):
    if not isinstance(value, str) or not value:
        raise DeviceEnumerationError(f"invalid pactl {field}")
    try:
        size = len(value.encode("utf-8"))
    except UnicodeError as error:
        raise DeviceEnumerationError(f"invalid pactl {field}") from error
    if size > limit:
        raise DeviceEnumerationError(f"pactl {field} exceeded its byte limit")
    return value


def parse_sources(output):
    """Validate bounded pactl JSON and return a bounded device list."""
    try:
        sources = json.loads(output)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise DeviceEnumerationError("pactl returned malformed JSON") from error
    if not isinstance(sources, list):
        raise DeviceEnumerationError("pactl returned an unexpected document")

    devices = []
    for source in sources:
        if not isinstance(source, dict):
            raise DeviceEnumerationError("pactl returned an invalid source record")
        name = _bounded_text(source.get("name"), MAX_DEVICE_NAME_BYTES, "source name")
        raw_description = source.get("description")
        description = name if raw_description in (None, "") else _bounded_text(
            raw_description, MAX_DEVICE_DESCRIPTION_BYTES, "source description"
        )
        if name.endswith(".monitor"):
            continue
        if len(devices) >= MAX_DEVICES:
            raise DeviceEnumerationError("pactl returned too many input devices")
        devices.append({"id": name, "label": description})
    return devices


def serialize_devices(devices):
    payload = (
        json.dumps(devices, ensure_ascii=True, separators=(",", ":")) + "\n"
    ).encode("ascii")
    if len(payload) > HELPER_OUTPUT_LIMIT_BYTES:
        raise DeviceEnumerationError("device result exceeded its byte limit")
    return payload


def list_sources():
    path = trusted_pactl_path()
    output = run_pactl(path, pactl_environment())
    return parse_sources(output)


def _handle_termination(signum, _frame):
    process = _active_process
    if process is not None:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    raise SystemExit(128 + signum)


def main():
    signal.signal(signal.SIGTERM, _handle_termination)
    signal.signal(signal.SIGINT, _handle_termination)
    try:
        payload = serialize_devices(list_sources())
    except DeviceEnumerationError:
        sys.stderr.write("Audio device enumeration failed safely.\n")
        return 1
    sys.stdout.buffer.write(payload)
    sys.stdout.buffer.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
