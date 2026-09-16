import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from contextlib import ExitStack
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import audio_devices as devices  # noqa: E402


class FakePactlMixin:
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)

    def executable(self, body, name="pactl-fixture"):
        path = Path(self.tempdir.name, name)
        path.write_text("#!/usr/bin/python3\n" + body, encoding="utf-8")
        path.chmod(0o755)
        return str(path)

    def run_fixture(self, body, **limits):
        executable = self.executable(body)
        with ExitStack() as stack:
            for name, value in limits.items():
                stack.enter_context(mock.patch.object(devices, name, value))
            return devices.run_pactl(executable, devices.pactl_environment({}))


class BoundedPactlExecutionTests(FakePactlMixin, unittest.TestCase):
    def test_normal_bounded_output(self):
        payload = json.dumps([
            {"name": "mic.usb", "description": "USB Microphone"},
            {"name": "speaker.monitor", "description": "Monitor"},
        ])
        output = self.run_fixture(f"import os\nos.write(1, {payload.encode()!r})\n")
        self.assertEqual(devices.parse_sources(output), [{"id": "mic.usb", "label": "USB Microphone"}])

    def test_zero_devices(self):
        output = self.run_fixture("import os\nos.write(1, b'[]')\n")
        self.assertEqual(devices.parse_sources(output), [])

    def test_stdout_just_below_ceiling_is_retained(self):
        size = devices.PACTL_STDOUT_LIMIT_BYTES - 1
        output = self.run_fixture(f"import os\nos.write(1, b'x' * {size})\n")
        self.assertEqual(len(output), size)

    def test_stdout_exceeding_ceiling_fails(self):
        size = devices.PACTL_STDOUT_LIMIT_BYTES + 1
        with self.assertRaises(devices.DeviceEnumerationError):
            self.run_fixture(f"import os\nos.write(1, b'x' * {size})\n")

    def test_very_large_stdout_fails_without_retaining_it(self):
        size = devices.PACTL_STDOUT_LIMIT_BYTES * 8
        with self.assertRaises(devices.DeviceEnumerationError):
            self.run_fixture(f"import os\nos.write(1, b'x' * {size})\n")

    def test_very_large_stderr_fails_while_stdout_is_drained(self):
        size = devices.PACTL_STDERR_LIMIT_BYTES * 8
        with self.assertRaises(devices.DeviceEnumerationError):
            self.run_fixture(f"import os\nos.write(2, b'e' * {size})\nos.write(1, b'[]')\n")

    def test_hanging_child_times_out(self):
        started = time.monotonic()
        with self.assertRaises(devices.DeviceEnumerationError):
            self.run_fixture(
                "import time\nwhile True: time.sleep(1)\n",
                PACTL_TIMEOUT_SECONDS=0.15,
                TERMINATE_GRACE_SECONDS=0.05,
            )
        self.assertLess(time.monotonic() - started, 1.0)

    def test_child_ignoring_termination_is_killed_and_reaped(self):
        pid_file = Path(self.tempdir.name, "fixture.pid")
        body = (
            "import os, signal, time\n"
            f"open({str(pid_file)!r}, 'w').write(str(os.getpid()))\n"
            "signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
            "while True: time.sleep(1)\n"
        )
        with self.assertRaises(devices.DeviceEnumerationError):
            self.run_fixture(body, PACTL_TIMEOUT_SECONDS=0.15, TERMINATE_GRACE_SECONDS=0.05)
        pid = int(pid_file.read_text(encoding="utf-8"))
        with self.assertRaises(ProcessLookupError):
            os.kill(pid, 0)

    def test_nonzero_exit_is_a_controlled_failure(self):
        with self.assertRaises(devices.DeviceEnumerationError):
            self.run_fixture("import sys\nsys.exit(7)\n")


class ParserLimitTests(unittest.TestCase):
    def test_malformed_output_fails_closed(self):
        for payload in (b"not-json", b"{}", b'[null]', b'[{"description":"missing name"}]'):
            with self.subTest(payload=payload), self.assertRaises(devices.DeviceEnumerationError):
                devices.parse_sources(payload)

    def test_excessive_device_count_fails_closed(self):
        payload = json.dumps([
            {"name": f"mic.{index}", "description": f"Microphone {index}"}
            for index in range(devices.MAX_DEVICES + 1)
        ]).encode()
        with self.assertRaises(devices.DeviceEnumerationError):
            devices.parse_sources(payload)

    def test_oversized_device_fields_fail_closed(self):
        cases = [
            [{"name": "x" * (devices.MAX_DEVICE_NAME_BYTES + 1), "description": "Mic"}],
            [{"name": "mic", "description": "x" * (devices.MAX_DEVICE_DESCRIPTION_BYTES + 1)}],
        ]
        for sources in cases:
            with self.subTest(sources=sources), self.assertRaises(devices.DeviceEnumerationError):
                devices.parse_sources(json.dumps(sources).encode())

    def test_helper_serialization_has_its_own_byte_limit(self):
        devices_list = [{"id": "mic", "label": "x" * devices.MAX_DEVICE_DESCRIPTION_BYTES}]
        with mock.patch.object(devices, "HELPER_OUTPUT_LIMIT_BYTES", 32):
            with self.assertRaises(devices.DeviceEnumerationError):
                devices.serialize_devices(devices_list)


class TrustedExecutionTests(FakePactlMixin, unittest.TestCase):
    def test_trusted_executable_identity_is_absolute_root_owned_and_not_writable(self):
        path = devices.trusted_pactl_path()
        info = os.stat(path)
        self.assertEqual(path, "/usr/bin/pactl")
        self.assertTrue(os.path.isabs(path))
        self.assertEqual(info.st_uid, 0)
        self.assertEqual(info.st_mode & 0o022, 0)

    def test_hostile_path_cannot_substitute_fake_pactl(self):
        marker = Path(self.tempdir.name, "executed")
        fake = self.executable(f"open({str(marker)!r}, 'w').write('bad')\n", name="pactl")
        self.assertTrue(os.path.exists(fake))
        hostile = {"PATH": self.tempdir.name, "HOME": self.tempdir.name, "XDG_RUNTIME_DIR": "/run/user/1000"}
        with mock.patch.dict(os.environ, hostile, clear=True):
            with mock.patch.object(devices, "run_pactl", return_value=b"[]") as runner:
                self.assertEqual(devices.list_sources(), [])
        command_path, environment = runner.call_args.args
        self.assertEqual(command_path, "/usr/bin/pactl")
        self.assertNotIn("PATH", environment)
        self.assertNotIn("HOME", environment)
        self.assertFalse(marker.exists())

    def test_minimal_environment_retains_only_audio_socket_values(self):
        inherited = {
            "PATH": "/hostile",
            "HOME": "/hostile",
            "LD_PRELOAD": "/hostile/library.so",
            "XDG_RUNTIME_DIR": "/run/user/1000",
            "PULSE_SERVER": "unix:/run/user/1000/pulse/native",
        }
        environment = devices.pactl_environment(inherited)
        self.assertEqual(environment, {
            "LANG": "C.UTF-8",
            "LC_ALL": "C.UTF-8",
            "XDG_RUNTIME_DIR": "/run/user/1000",
            "PULSE_SERVER": "unix:/run/user/1000/pulse/native",
        })

        fixture = self.executable(
            "import json, os, sys\n"
            "assert sys.argv[1:] == ['-f', 'json', 'list', 'sources']\n"
            "os.write(1, json.dumps(dict(os.environ)).encode())\n"
        )
        observed = json.loads(devices.run_pactl(fixture, environment))
        self.assertEqual(observed, environment)


class QmlSupervisorIntegrationTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("qs"), "Quickshell is not installed")
    def test_qml_secondary_cap_kills_and_reaps_oversized_helper(self):
        repository = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as tempdir:
            temp = Path(tempdir)
            pid_file = temp / "helper.pid"
            fake_python = temp / "python3"
            fake_python.write_text(
                "#!/usr/bin/python3\n"
                "import os, signal, time\n"
                f"open({str(pid_file)!r}, 'w').write(str(os.getpid()))\n"
                "signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
                "os.write(1, b'x' * (70 * 1024))\n"
                "while True: time.sleep(1)\n",
                encoding="utf-8",
            )
            fake_python.chmod(0o755)

            service_url = (repository / "Service.qml").as_uri()
            qml = temp / "shell.qml"
            qml.write_text(
                "import QtQuick\n"
                "import Quickshell\n"
                "ShellRoot {\n"
                "    Loader {\n"
                "        id: loader\n"
                f"        source: {json.dumps(service_url)}\n"
                "        onLoaded: item.refreshTunerDevices()\n"
                "    }\n"
                "    Timer {\n"
                "        id: poll\n"
                "        interval: 50; repeat: true; running: true\n"
                "        onTriggered: {\n"
                "            if (loader.item && loader.item.tunerDeviceEnumerationError) {\n"
                "                running = false\n"
                "                settle.start()\n"
                "            }\n"
                "        }\n"
                "    }\n"
                "    Timer {\n"
                "        id: settle\n"
                "        interval: 1000\n"
                "        onTriggered: { console.log('QML_CAP_REJECTED'); Qt.quit() }\n"
                "    }\n"
                "    Timer {\n"
                "        interval: 5000; running: true\n"
                "        onTriggered: { console.log('QML_CAP_TIMEOUT'); Qt.quit() }\n"
                "    }\n"
                "}\n",
                encoding="utf-8",
            )

            environment = os.environ.copy()
            environment.update({
                "PATH": tempdir + ":/usr/bin",
                "QT_QPA_PLATFORM": "offscreen",
                "XDG_STATE_HOME": str(temp / "state"),
                "NO_COLOR": "1",
            })
            completed = subprocess.run(
                [shutil.which("qs"), "-p", str(qml)],
                capture_output=True,
                text=True,
                timeout=8,
                env=environment,
                check=False,
            )
            logs = completed.stdout + completed.stderr
            self.assertEqual(completed.returncode, 0, logs)
            self.assertIn("QML_CAP_REJECTED", logs)
            self.assertNotIn("QML_CAP_TIMEOUT", logs)
            pid = int(pid_file.read_text(encoding="utf-8"))
            with self.assertRaises(ProcessLookupError):
                os.kill(pid, 0)


if __name__ == "__main__":
    unittest.main()
