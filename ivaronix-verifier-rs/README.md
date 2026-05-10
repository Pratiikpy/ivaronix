# `ivaronix-verifier` · RFC-8785 reference verifier in Rust

Companion to `packages/core/src/jcs.ts` (TS) and `scripts/verifier-py/jcs.py`
(Python). All three implementations produce byte-identical canonical-JSON
output. Cross-impl byte-equality is enforced by
`scripts/verifier-py/cross_check.py` and (when shipped) the GitHub Actions
job at `.github/workflows/jcs-roundtrip.yml`.

## Run

```bash
echo '{"b":1,"a":[3,2,1]}' | cargo run -q
```

Outputs:

```
{"a":[3,2,1],"b":1}
```

## Test

```bash
cargo test -q
```

Test corpus mirrors `packages/core/src/jcs.test.ts` and
`scripts/verifier-py/test_jcs.py` vector-for-vector.

## Why this exists

The headline product claim — *any machine, any language can re-verify an
Ivaronix receipt* — only holds if the canonical hash is reproducible from
any language. Rust is the language with the most existing 0G ecosystem
support (`0g-da-rust-sdk`) and the cleanest path to a no-Node verifier.

Spec: <https://www.rfc-editor.org/rfc/rfc8785>
Cross-impl coverage: see `docs/HASH_FUNCTION.md` in the parent repo.

## Publish (operator-action)

When ready to publish to crates.io:

```bash
! cargo login
cargo publish --dry-run
cargo publish
```

The `! cargo login` step is operator-side; the verifier code itself ships
with no operator dependencies.
