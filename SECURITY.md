# Security

Fretboard is an unprivileged local Omarchy shell plugin. Its audio helpers use local
stdio and PipeWire/PulseAudio command-line clients; they do not require `sudo`,
`pkexec`, a service, or a network connection.

## Audio-device enumeration boundary

`helper/audio_devices.py` is the only device-enumeration helper. Its v0.5.2 boundary
is deliberately narrow:

- The executable identity is the literal absolute path `/usr/bin/pactl`. Before
  execution it must be a root-owned executable regular file, must not be a symlink,
  and must not be group- or world-writable. Inherited `PATH` is never consulted.
- `pactl` is invoked directly with the argv `-f json list sources`; no shell is
  involved. It starts in a new process group/session.
- The child environment is cleared. Fixed `LANG=C.UTF-8` and `LC_ALL=C.UTF-8` values
  keep JSON text deterministic. `XDG_RUNTIME_DIR` is retained only to locate the
  current user's normal PipeWire/PulseAudio runtime socket, and `PULSE_SERVER` only
  when the user/session explicitly selected another Pulse-compatible server. No
  `PATH`, `HOME`, dynamic-loader, D-Bus, credential, or unrelated variable is
  inherited.
- stdout and stderr are read concurrently with nonblocking selector-driven reads.
  stdout may contribute at most 262,144 bytes and stderr at most 16,384 bytes. Each
  read is limited to the remaining allowance plus one byte; a would-be overflow is
  rejected before that chunk is appended. stderr is counted but never retained.
- The complete execution/drain deadline is 5.0 seconds. A deadline or byte breach
  sends `SIGTERM` to the process group, waits 250 ms, sends `SIGKILL` if necessary,
  then waits for/reaps the child. Partial stdout is discarded and never parsed.
- A valid result contains at most 64 non-monitor devices. Device ids are at most
  256 UTF-8 bytes and descriptions at most 512 UTF-8 bytes. Non-array documents,
  non-object records, absent/wrong-type fields, malformed JSON, excessive counts,
  and oversized fields fail closed. The helper's final ASCII JSON is capped at
  61,440 bytes.

`Service.qml` is an independent supervisor boundary. Empty-marker `SplitParser`
instances deliver available stdout/stderr chunks without whole-stream retention.
The service calculates each chunk's UTF-8 size before appending it, retaining no more
than 65,536 stdout bytes and no stderr content (stderr is counted to an 8,192-byte
ceiling). It accepts data only after a zero exit and a second schema/count/field
validation. Its own six-second deadline or output breach terminates the helper,
escalates to signal 9 after 250 ms, lets Quickshell's `QProcess` reap it, clears the
partial result, and exposes a safe retryable enumeration error.

## Verification

`helper/tests/test_audio_devices.py` uses controlled executables rather than the
workstation device list to cover normal and zero-device results, malformed JSON,
stdout/stderr floods, the exact output boundary, excessive device count, oversized
fields, timeout, ignored `SIGTERM`, cleanup/reaping, trusted identity, hostile
`PATH`, and environment closure. Its offscreen Quickshell test substitutes an
oversized helper independently of the Python `pactl` logic and proves the QML cap,
kill escalation, and reap path. `tests/device_output.test.mjs` tests the exact QML
payload validator and statically guards cap-before-retain streaming configuration.

The v0.5.2 audit found no new shell execution, privilege escalation, network
behavior, secrets/API keys, or agent-control/session artifacts. The existing two
explicit user-clicked lyrics browser handoffs remain unchanged and are not part of
device enumeration.
