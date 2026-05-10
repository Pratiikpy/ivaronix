//! Ivaronix · RFC-8785 (JCS) canonical-JSON reference verifier in Rust.
//!
//! Companion to `packages/core/src/jcs.ts` (TS) and
//! `scripts/verifier-py/jcs.py` (Python). All three implementations MUST
//! produce byte-identical output for every vector in
//! `docs/HASH_FUNCTION.md` §3.
//!
//! Why a Rust voice: the headline product claim is "any machine, any
//! language can re-verify a receipt." Rust is the language with the most
//! existing 0G ecosystem support (the upstream `0g-da-rust-sdk`) and the
//! cleanest path to a no-Node verifier that anyone can `cargo run`.
//!
//! Spec: <https://www.rfc-editor.org/rfc/rfc8785>

use serde_json::Value;
use std::collections::BTreeMap;
use unicode_normalization::UnicodeNormalization;

/// Canonicalize a `serde_json::Value` per RFC-8785. Returns the JCS string.
pub fn jcs(value: &Value) -> Result<String, String> {
    let mut out = String::new();
    canonicalize_into(value, &mut out, "$")?;
    Ok(out)
}

/// Same as `jcs(value)` but returns the UTF-8 byte buffer for hashing.
pub fn jcs_bytes(value: &Value) -> Result<Vec<u8>, String> {
    Ok(jcs(value)?.into_bytes())
}

fn canonicalize_into(value: &Value, out: &mut String, path: &str) -> Result<(), String> {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Value::Number(n) => serialize_number(n, out, path)?,
        Value::String(s) => serialize_string(s, out),
        Value::Array(arr) => {
            out.push('[');
            for (i, v) in arr.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                canonicalize_into(v, out, &format!("{}[{}]", path, i))?;
            }
            out.push(']');
        }
        Value::Object(map) => {
            // RFC-8785 §3.2.3: sort keys by UTF-16 code-unit value. Rust's
            // String Ord is by UTF-8 byte order, which agrees with UTF-16
            // code-unit order for every BMP character, including all keys
            // appearing in current receipts. (Supplementary-plane keys,
            // none of which appear in any Ivaronix receipt today, would
            // need a code-unit-order comparator; out of scope.)
            let mut sorted: BTreeMap<&str, &Value> = BTreeMap::new();
            for (k, v) in map.iter() {
                sorted.insert(k.as_str(), v);
            }
            out.push('{');
            for (i, (k, v)) in sorted.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                serialize_string(k, out);
                out.push(':');
                canonicalize_into(v, out, &format!("{}.{}", path, k))?;
            }
            out.push('}');
        }
    }
    Ok(())
}

fn serialize_string(s: &str, out: &mut String) {
    // RFC-8785 §3.2.2.2 — UTF-8 NFC normalisation, then minimal escaping.
    let normalised: String = s.nfc().collect();
    out.push('"');
    for ch in normalised.chars() {
        let code = ch as u32;
        match code {
            0x22 => out.push_str("\\\""),
            0x5C => out.push_str("\\\\"),
            0x08 => out.push_str("\\b"),
            0x09 => out.push_str("\\t"),
            0x0A => out.push_str("\\n"),
            0x0C => out.push_str("\\f"),
            0x0D => out.push_str("\\r"),
            c if c < 0x20 => out.push_str(&format!("\\u{:04x}", c)),
            _ => out.push(ch),
        }
    }
    out.push('"');
}

fn serialize_number(n: &serde_json::Number, out: &mut String, path: &str) -> Result<(), String> {
    // RFC-8785 §3.2.2.3 — match ECMAScript Number.toString for the receipt
    // numeric range. serde_json's Number is union of i64 / u64 / f64;
    // we render each so the output matches the TS + Python references.

    // Integers: render via `to_string()` directly.
    if let Some(i) = n.as_i64() {
        out.push_str(&i.to_string());
        return Ok(());
    }
    if let Some(u) = n.as_u64() {
        out.push_str(&u.to_string());
        return Ok(());
    }
    // Floats: reject NaN + Infinity (already rejected by serde_json's
    // Number constructor, but we double-check), normalise -0 -> 0.
    if let Some(f) = n.as_f64() {
        if f.is_nan() {
            return Err(format!("jcs: NaN is not allowed (at {})", path));
        }
        if f.is_infinite() {
            return Err(format!("jcs: Infinity is not allowed (at {})", path));
        }
        if f == 0.0 {
            out.push('0');
            return Ok(());
        }
        // Rust's f64::to_string uses a shortest-roundtrip representation
        // (Grisu / Ryu). For the integer-valued float case (e.g. 1.0 ->
        // "1"), the trailing zero pattern needs collapsing to match
        // ECMAScript Number.toString which prints "1" not "1.0".
        let s = ryu_print(f);
        out.push_str(&s);
        return Ok(());
    }
    Err(format!("jcs: number type not supported (at {})", path))
}

fn ryu_print(f: f64) -> String {
    // Use std f64 Display, which gives shortest-roundtrip output that
    // matches Python's repr for every value in the receipt range.
    // Strip trailing ".0" suffix to align with ECMAScript / Python's
    // collapsed-integer-float form.
    let s = format!("{}", f);
    if let Some(stripped) = s.strip_suffix(".0") {
        return stripped.to_string();
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn assert_jcs(value: Value, expected: &str) {
        assert_eq!(jcs(&value).unwrap(), expected);
    }

    #[test]
    fn primitives_null_and_booleans() {
        assert_jcs(json!(null), "null");
        assert_jcs(json!(true), "true");
        assert_jcs(json!(false), "false");
    }

    #[test]
    fn numbers_zero_handling() {
        assert_jcs(json!(0), "0");
        // -0 round-trips through JSON as 0; this is fine for receipt parity.
        assert_jcs(json!(0.0), "0");
        assert_jcs(json!(-0.0), "0");
    }

    #[test]
    fn numbers_simple() {
        assert_jcs(json!(1), "1");
        assert_jcs(json!(-1), "-1");
        assert_jcs(json!(1234567890), "1234567890");
        assert_jcs(json!(1.5), "1.5");
        assert_jcs(json!(0.1), "0.1");
    }

    #[test]
    fn strings_ascii_passthrough() {
        assert_jcs(json!("hello"), "\"hello\"");
        assert_jcs(json!(""), "\"\"");
    }

    #[test]
    fn strings_escape_required() {
        assert_jcs(json!("a\"b"), "\"a\\\"b\"");
        assert_jcs(json!("a\\b"), "\"a\\\\b\"");
        assert_jcs(json!("a\nb"), "\"a\\nb\"");
        assert_jcs(json!("a\tb"), "\"a\\tb\"");
        assert_jcs(json!("a\rb"), "\"a\\rb\"");
        assert_jcs(json!("a\u{08}b"), "\"a\\bb\"");
        assert_jcs(json!("a\u{0c}b"), "\"a\\fb\"");
        assert_jcs(json!("a\u{01}b"), "\"a\\u0001b\"");
    }

    #[test]
    fn strings_nfc_normalisation() {
        // U+0065 + U+0301 (decomposed) should normalise to U+00E9 and
        // produce the same canonical output as the precomposed form.
        let composed = json!("\u{00e9}");
        let decomposed = json!("e\u{0301}");
        assert_eq!(jcs(&composed).unwrap(), jcs(&decomposed).unwrap());
    }

    #[test]
    fn objects_keys_sorted() {
        assert_jcs(json!({"b": 1, "a": 2}), r#"{"a":2,"b":1}"#);
        assert_jcs(json!({"z": 1, "A": 2}), r#"{"A":2,"z":1}"#);
        assert_jcs(json!({}), "{}");
    }

    #[test]
    fn arrays_preserve_order() {
        assert_jcs(json!([1, 2, 3]), "[1,2,3]");
        assert_jcs(json!([{"b": 1, "a": 2}]), r#"[{"a":2,"b":1}]"#);
        assert_jcs(json!([]), "[]");
    }

    #[test]
    fn nested_receipt_shape() {
        let v = json!({
            "type": "doc_ask",
            "request": {"skillId": "private-doc-review", "skillVersion": "0.1.0"},
            "agent": {"ownerWallet": "0xabcdef"},
            "outputs": {"riskLevel": "low"},
        });
        assert_eq!(
            jcs(&v).unwrap(),
            r#"{"agent":{"ownerWallet":"0xabcdef"},"outputs":{"riskLevel":"low"},"request":{"skillId":"private-doc-review","skillVersion":"0.1.0"},"type":"doc_ask"}"#
        );
    }

    #[test]
    fn jcs_bytes_round_trip() {
        let v = json!({"hello": "world"});
        let bytes = jcs_bytes(&v).unwrap();
        let text = jcs(&v).unwrap();
        assert_eq!(String::from_utf8(bytes).unwrap(), text);
    }

    #[test]
    fn determinism_across_calls() {
        let v = json!({
            "list": [3, 1, 2, {"z": "last", "a": "first"}],
            "str": "café",
            "n": 0,
            "b": true,
            "nullField": null,
        });
        let out1 = jcs(&v).unwrap();
        let out2 = jcs(&v).unwrap();
        assert_eq!(out1, out2);
        assert_eq!(
            out1,
            r#"{"b":true,"list":[3,1,2,{"a":"first","z":"last"}],"n":0,"nullField":null,"str":"café"}"#
        );
    }
}
