"""
RFC-8785 reference test vectors · Python.

Mirror of packages/core/src/jcs.test.ts. Every vector here MUST produce
the same canonical string the TS reference emits. The cross-impl harness
(test_cross_impl.py, future) feeds the same JSON to both languages and
asserts byte equality.

Run:
    python -m unittest scripts/verifier-py/test_jcs.py
"""

from __future__ import annotations

import unittest
from jcs import jcs, jcs_bytes


class JCSTest(unittest.TestCase):
    # ─── Primitives ─────────────────────────────────────────────────────

    def test_null(self) -> None:
        self.assertEqual(jcs(None), "null")

    def test_booleans(self) -> None:
        self.assertEqual(jcs(True), "true")
        self.assertEqual(jcs(False), "false")

    # ─── Numbers ────────────────────────────────────────────────────────

    def test_zero_handling(self) -> None:
        self.assertEqual(jcs(0), "0")
        self.assertEqual(jcs(-0), "0")
        self.assertEqual(jcs(0.0), "0")
        self.assertEqual(jcs(-0.0), "0")

    def test_simple_numbers(self) -> None:
        self.assertEqual(jcs(1), "1")
        self.assertEqual(jcs(-1), "-1")
        self.assertEqual(jcs(1234567890), "1234567890")
        self.assertEqual(jcs(1.5), "1.5")
        self.assertEqual(jcs(0.1), "0.1")

    def test_nan_rejected(self) -> None:
        with self.assertRaises(ValueError):
            jcs(float("nan"))

    def test_infinity_rejected(self) -> None:
        with self.assertRaises(ValueError):
            jcs(float("inf"))
        with self.assertRaises(ValueError):
            jcs(float("-inf"))

    # ─── Strings ────────────────────────────────────────────────────────

    def test_ascii_passthrough(self) -> None:
        self.assertEqual(jcs("hello"), '"hello"')
        self.assertEqual(jcs(""), '""')

    def test_string_escapes(self) -> None:
        self.assertEqual(jcs('a"b'), '"a\\"b"')
        self.assertEqual(jcs("a\\b"), '"a\\\\b"')
        self.assertEqual(jcs("a\nb"), '"a\\nb"')
        self.assertEqual(jcs("a\tb"), '"a\\tb"')
        self.assertEqual(jcs("a\rb"), '"a\\rb"')
        self.assertEqual(jcs("a\bb"), '"a\\bb"')
        self.assertEqual(jcs("a\fb"), '"a\\fb"')
        self.assertEqual(jcs("ab"), '"a\\u0001b"')

    def test_nfc_normalisation(self) -> None:
        # U+00E9 (precomposed é) vs U+0065 U+0301 (combining acute).
        composed = "é"
        decomposed = "é"
        self.assertEqual(jcs(composed), jcs(decomposed))

    # ─── Objects ────────────────────────────────────────────────────────

    def test_object_key_sort(self) -> None:
        self.assertEqual(jcs({"b": 1, "a": 2}), '{"a":2,"b":1}')
        self.assertEqual(jcs({"z": 1, "A": 2}), '{"A":2,"z":1}')
        self.assertEqual(jcs({}), "{}")

    # ─── Arrays ─────────────────────────────────────────────────────────

    def test_arrays(self) -> None:
        self.assertEqual(jcs([1, 2, 3]), "[1,2,3]")
        self.assertEqual(jcs([{"b": 1, "a": 2}]), '[{"a":2,"b":1}]')
        self.assertEqual(jcs([]), "[]")

    # ─── Nested ─────────────────────────────────────────────────────────

    def test_receipt_shape(self) -> None:
        value = {
            "type": "doc_ask",
            "request": {"skillId": "private-doc-review", "skillVersion": "0.1.0"},
            "agent": {"ownerWallet": "0xabcdef"},
            "outputs": {"riskLevel": "low"},
        }
        self.assertEqual(
            jcs(value),
            '{"agent":{"ownerWallet":"0xabcdef"},'
            '"outputs":{"riskLevel":"low"},'
            '"request":{"skillId":"private-doc-review","skillVersion":"0.1.0"},'
            '"type":"doc_ask"}',
        )

    # ─── jcs_bytes ──────────────────────────────────────────────────────

    def test_jcs_bytes_utf8(self) -> None:
        v = {"hello": "world"}
        self.assertEqual(jcs_bytes(v).decode("utf-8"), jcs(v))

    # ─── Determinism ────────────────────────────────────────────────────

    def test_large_nested_mix_deterministic(self) -> None:
        v = {
            "list": [3, 1, 2, {"z": "last", "a": "first"}],
            "str": "café",
            "n": -0,
            "b": True,
            "nullField": None,
        }
        out1 = jcs(v)
        out2 = jcs(v)
        self.assertEqual(out1, out2)
        expected = (
            '{"b":true,"list":[3,1,2,{"a":"first","z":"last"}],'
            '"n":0,"nullField":null,"str":"café"}'
        )
        self.assertEqual(out1, expected)


if __name__ == "__main__":
    unittest.main(verbosity=2)
