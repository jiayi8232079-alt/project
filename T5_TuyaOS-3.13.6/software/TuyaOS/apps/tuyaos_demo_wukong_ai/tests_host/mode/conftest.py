"""Mode C unit-test harness with TAP output parsing."""

import re
import subprocess
from pathlib import Path

import pytest

_TESTS_DIR = Path(__file__).parent
_APP_SRC = (_TESTS_DIR / "../..").resolve()
_MODE_DIR = _TESTS_DIR.parent


def _parse_tap(stdout: str) -> tuple[int, int]:
    passed = total = 0
    for line in stdout.splitlines():
        if re.match(r"^ok \d+", line):
            passed += 1
            total += 1
        elif re.match(r"^not ok \d+", line):
            total += 1
    return passed, total


class CTestHarness:
    _CC_FLAGS = ["-D_GNU_SOURCE", "-std=c99", "-Wall", "-Wextra", "-Werror"]

    def __init__(self, tmp_path: Path) -> None:
        self._tmp = tmp_path
        self._sources: list[Path] = []
        self._includes: list[Path] = [
            _TESTS_DIR / "stubs",
            _TESTS_DIR,
            _MODE_DIR,
            _APP_SRC / "src/wukong/tm/tests/stubs",
        ]

    def add_test_source(self, name: str) -> "CTestHarness":
        self._sources.append(_TESTS_DIR / name)
        return self

    def add_sdk_source(self, rel_path: str) -> "CTestHarness":
        self._sources.append(_APP_SRC / rel_path)
        return self

    def include_sdk(self, rel_path: str) -> "CTestHarness":
        self._includes.append(_APP_SRC / rel_path)
        return self

    def run(self) -> None:
        binary = self._tmp / "test_binary"
        cmd = [
            "cc",
            *self._CC_FLAGS,
            *[f"-I{d}" for d in self._includes],
            *[str(s) for s in self._sources],
            "-o", str(binary),
        ]
        comp = subprocess.run(cmd, capture_output=True, text=True)
        if comp.returncode != 0:
            pytest.fail(f"Compilation failed:\n{comp.stderr.strip()}")

        result = subprocess.run(
            [str(binary)], capture_output=True, text=True, timeout=30,
        )
        passed, total = _parse_tap(result.stdout)

        if result.returncode != 0 or passed < total:
            output = result.stdout.strip()
            if result.stderr.strip():
                output += "\n" + result.stderr.strip()
            pytest.fail(f"({passed}/{total} passed)\n\n{output}")


@pytest.fixture
def c_test(tmp_path: Path) -> CTestHarness:
    return CTestHarness(tmp_path)
