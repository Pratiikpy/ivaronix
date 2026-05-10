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
RUST_DIR = REPO / "ivaronix-verifier-rs"

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


def rs_jcs(value) -> str:
    """Pipe `value` (as JSON) through the Rust reference, return its stdout.

    Builds in release mode lazily on first call; subsequent calls reuse
    the cached binary. Cargo prints to stderr; we discard it to keep the
    cross-impl output clean.
    """
    payload = json.dumps(value).encode("utf-8")
    proc = subprocess.run(
        ["cargo", "run", "-q", "--release"],
        input=payload,
        capture_output=True,
        cwd=RUST_DIR,
        timeout=120,
        shell=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"Rust verifier exited {proc.returncode}: {proc.stderr.decode('utf-8', 'replace')}"
        )
    return proc.stdout.decode("utf-8")


def main() -> int:
    failures = 0
    diverged_inputs: list = []

    for i, v in enumerate(VECTORS):
        outs: dict[str, str] = {}
        for lang, fn in (("py", lambda x=v: py_jcs(x)), ("ts", lambda x=v: ts_jcs(x)), ("rs", lambda x=v: rs_jcs(x))):
            try:
                outs[lang] = fn()
            except Exception as e:  # noqa: BLE001
                print(f"#{i:>3}  {lang.upper()} ERROR: {e}  input={v!r}")
                outs[lang] = f"<<ERROR: {e}>>"

        unique = set(outs.values())
        if len(unique) == 1 and not any(s.startswith("<<ERROR:") for s in outs.values()):
            sample = next(iter(unique))
            display = sample[:60] + ("…" if len(sample) > 60 else "")
            print(f"#{i:>3}  ok  {display}")
        else:
            print(f"#{i:>3}  DIVERGE")
            print(f"     input: {v!r}")
            for lang in ("py", "ts", "rs"):
                print(f"     {lang}: {outs.get(lang, '<missing>')!r}")
            failures += 1
            diverged_inputs.append((i, v))

    print()
    if failures:
        print(
            f"FAIL: {failures} of {len(VECTORS)} vectors diverged across TS + Python + Rust"
        )
        return 1
    print(
        f"OK: {len(VECTORS)} vectors byte-equal across TS + Python + Rust"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
