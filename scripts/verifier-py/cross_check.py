"""
Cross-implementation byte-equality harness for the JCS canonical hash.

For each input in `vectors`, computes the JCS string in both languages
and asserts byte-for-byte equality. Run with:

    python scripts/verifier-py/cross_check.py

The TS reference is invoked via `pnpm exec tsx packages/core/src/jcs-cli.ts`
which reads JSON on stdin and writes the canonical string on stdout.

When the Rust + Go impls land, this harness will gain `cargo run -q --
verify` and `go run ./cmd/verifier-go` paths and compare all four
languages on the same corpus.

Exit code is non-zero on any divergence.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
TS_ENTRY = REPO / "packages" / "core" / "src" / "jcs-cli.ts"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from jcs import jcs as py_jcs  # noqa: E402


VECTORS: list = [
    None,
    True,
    False,
    0,
    -0,
    1,
    -1,
    1234567890,
    1.5,
    0.1,
    "",
    "hello",
    'a"b',
    "a\\b",
    "a\nb",
    "a\tb",
    "a\rb",
    "a\bb",
    "a\fb",
    "ab",
    "café",
    {},
    [],
    {"b": 1, "a": 2},
    {"z": 1, "A": 2},
    [1, 2, 3],
    [{"b": 1, "a": 2}],
    {
        "type": "doc_ask",
        "request": {"skillId": "private-doc-review", "skillVersion": "0.1.0"},
        "agent": {"ownerWallet": "0xabcdef"},
        "outputs": {"riskLevel": "low"},
    },
    {
        "list": [3, 1, 2, {"z": "last", "a": "first"}],
        "str": "café",
        "n": 0,
        "b": True,
        "nullField": None,
    },
]


def ts_jcs(value) -> str:
    """Pipe `value` (as JSON) through the TS reference, return its stdout.

    Windows note: `pnpm` is a `.cmd` shim — Python's default subprocess
    PATH search does not append `.cmd`, so we route through cmd.exe on
    Windows. POSIX uses pnpm directly.
    """
    payload = json.dumps(value).encode("utf-8")
    if sys.platform == "win32":
        cmd = ["cmd", "/c", "pnpm", "exec", "tsx", str(TS_ENTRY)]
    else:
        cmd = ["pnpm", "exec", "tsx", str(TS_ENTRY)]
    proc = subprocess.run(
        cmd,
        input=payload,
        capture_output=True,
        cwd=REPO,
        timeout=60,
        shell=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"TS jcs-cli exited {proc.returncode}: {proc.stderr.decode('utf-8', 'replace')}"
        )
    return proc.stdout.decode("utf-8")


def main() -> int:
    failures = 0
    for i, v in enumerate(VECTORS):
        try:
            py_out = py_jcs(v)
        except Exception as e:  # noqa: BLE001
            print(f"#{i:>3}  PY ERROR: {e}  input={v!r}")
            failures += 1
            continue
        try:
            ts_out = ts_jcs(v)
        except Exception as e:  # noqa: BLE001
            print(f"#{i:>3}  TS ERROR: {e}  input={v!r}")
            failures += 1
            continue
        if py_out == ts_out:
            print(f"#{i:>3}  ok  {py_out[:60]}{'…' if len(py_out) > 60 else ''}")
        else:
            print(f"#{i:>3}  DIVERGE")
            print(f"     input: {v!r}")
            print(f"     py:    {py_out!r}")
            print(f"     ts:    {ts_out!r}")
            failures += 1

    print()
    if failures:
        print(f"FAIL: {failures} of {len(VECTORS)} vectors diverged across TS + Python")
        return 1
    print(f"OK: {len(VECTORS)} vectors byte-equal across TS + Python")
    return 0


if __name__ == "__main__":
    sys.exit(main())
