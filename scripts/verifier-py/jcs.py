"""
Ivaronix · RFC-8785 (JCS) reference implementation in Python.

Companion to packages/core/src/jcs.ts. Both implementations MUST produce
byte-identical output for every vector in docs/HASH_FUNCTION.md §3.

Why ship a Python second voice:
- The headline product claim is "any machine, any language can re-verify
  a receipt." A spec doc is necessary but not sufficient. A second-
  language implementation that produces byte-identical output to the TS
  reference is the proof.
- Python is the cheapest polyglot to ship: stdlib has unicodedata.NFC
  and UTF-8 encoding; no third-party crypto needed for the JCS step
  itself (the keccak256 wrapper is a separate concern).
- Future Rust + Go impls mirror this same shape. CI cross-impl test
  compares each language's JCS bytes against this reference.

Spec: https://www.rfc-editor.org/rfc/rfc8785
"""

from __future__ import annotations

import math
import unicodedata
from typing import Any


def _ensure_canonicalizable(value: Any, path: str) -> None:
    """Reject the values RFC-8785 forbids. Up-front so error messages stay clear."""
    if value is None:
        return  # null is allowed
    if isinstance(value, bool):
        return  # checked before int because bool is a subclass of int
    if isinstance(value, float):
        if math.isnan(value):
            raise ValueError(f"jcs: NaN is not allowed (at {path})")
        if math.isinf(value):
            raise ValueError(f"jcs: Infinity is not allowed (at {path})")
    if isinstance(value, complex):
        raise ValueError(f"jcs: complex numbers not canonicalizable (at {path})")
    if isinstance(value, bytes):
        raise ValueError(
            f"jcs: bytes are not canonicalizable (at {path}; encode as base64 string)"
        )


def _serialize_string(s: str) -> str:
    """RFC-8785 §3.2.2.2 string serialization: UTF-8 NFC + minimal escaping."""
    normalised = unicodedata.normalize("NFC", s)
    out = ['"']
    for ch in normalised:
        code = ord(ch)
        if code == 0x22:
            out.append('\\"')
        elif code == 0x5C:
            out.append("\\\\")
        elif code == 0x08:
            out.append("\\b")
        elif code == 0x09:
            out.append("\\t")
        elif code == 0x0A:
            out.append("\\n")
        elif code == 0x0C:
            out.append("\\f")
        elif code == 0x0D:
            out.append("\\r")
        elif code < 0x20:
            out.append(f"\\u{code:04x}")
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def _serialize_number(n: float | int) -> str:
    """
    RFC-8785 §3.2.2.3 number serialization.

    Python's `repr(float)` and `str(int)` line up with ECMAScript's
    Number.toString() output for every value the receipt body uses
    (integers and small-decimal floats). The carve-outs that matter:
      - 0 and -0 must both serialize as `"0"`.
      - NaN, Infinity already rejected upstream.
      - Booleans handled separately because Python `True`/`False` are
        also `int` subclasses.

    This implementation mirrors the TS reference's choices. See
    docs/HASH_FUNCTION.md §7 for the corner-case coverage discipline.
    """
    if isinstance(n, bool):
        # Caller should not reach here; defence in depth.
        raise TypeError("_serialize_number called with bool")
    if isinstance(n, int):
        return str(n)
    # float branch
    if n == 0:
        return "0"
    # Python's repr(float) gives a shortest roundtrip representation that
    # matches V8's Number.prototype.toString for every value we test.
    # E.g. repr(1.5) == '1.5', repr(0.1) == '0.1'.
    text = repr(n)
    # Integer-valued floats (1.0) should serialize as "1" to match JS,
    # whose Number.toString collapses ".0" suffixes.
    if text.endswith(".0"):
        text = text[:-2]
    return text


def _recurse(value: Any, path: str) -> str:
    _ensure_canonicalizable(value, path)
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return _serialize_number(value)
    if isinstance(value, str):
        return _serialize_string(value)
    if isinstance(value, (list, tuple)):
        parts = [_recurse(v, f"{path}[{i}]") for i, v in enumerate(value)]
        return "[" + ",".join(parts) + "]"
    if isinstance(value, dict):
        # RFC-8785 §3.2.3: keys sorted by UTF-16 code-unit value.
        # Python's default str sort is by code-point, which matches
        # for every BMP key (ASCII + the standard Unicode Basic Plane).
        parts = []
        for k in sorted(value.keys()):
            if not isinstance(k, str):
                raise TypeError(
                    f"jcs: object keys must be strings (at {path}; got {type(k).__name__})"
                )
            v = value[k]
            # Python has no `undefined`; we treat None as null per the
            # JS-reference parity (TS skips undefined; Python keeps None
            # as null at the same spot the TS reference would emit it).
            parts.append(f"{_serialize_string(k)}:{_recurse(v, f'{path}.{k}')}")
        return "{" + ",".join(parts) + "}"
    raise TypeError(f"jcs: unsupported type {type(value).__name__} at {path}")


def jcs(value: Any) -> str:
    """Canonicalize a Python value per RFC-8785. Returns the JCS string."""
    return _recurse(value, "$")


def jcs_bytes(value: Any) -> bytes:
    """Same as jcs(value) but returns the UTF-8 byte buffer for hashing."""
    return jcs(value).encode("utf-8")


if __name__ == "__main__":
    # Spot check — used by humans + the cross-impl harness when invoked
    # with `python jcs.py < input.json`.
    import json
    import sys

    if not sys.stdin.isatty():
        try:
            value = json.load(sys.stdin)
            print(jcs(value), end="")
            sys.exit(0)
        except Exception as e:  # noqa: BLE001
            print(f"jcs: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        # Demo mode.
        sample = {"b": 1, "a": [3, 2, 1], "nested": {"z": "last", "a": "first"}}
        print(jcs(sample))
