#!/usr/bin/env python3
"""One-shot input-device listing for the tuner's device picker.

Runs, prints a single JSON array to stdout, and exits - invoked on demand by
Service.qml whenever the tuner panel's device dropdown is opened, not kept
running. Uses `pactl` (shipped with pipewire-pulse) since it already
produces structured JSON, rather than parsing `wpctl status`'s tree output.
"""

import json
import shutil
import subprocess
import sys


def list_sources():
    if shutil.which("pactl") is None:
        return []
    try:
        output = subprocess.check_output(["pactl", "-f", "json", "list", "sources"], timeout=5)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return []
    try:
        sources = json.loads(output)
    except json.JSONDecodeError:
        return []

    devices = []
    for source in sources:
        name = source.get("name")
        if not name or name.endswith(".monitor"):
            continue  # exclude monitor sources (loopback of an output), not microphones
        description = source.get("description") or name
        devices.append({"id": name, "label": description})
    return devices


def main():
    print(json.dumps(list_sources()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
