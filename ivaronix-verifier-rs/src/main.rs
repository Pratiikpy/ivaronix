//! `ivaronix-verifier` CLI — reads JSON on stdin, writes the canonical
//! RFC-8785 string on stdout. Mirrors `packages/core/src/jcs-cli.ts` so
//! the cross-impl harness in `scripts/verifier-py/cross_check.py` can
//! pipe the same input through both languages.
//!
//! Exits 0 on success, 1 on parse / canonicalize error.

use std::io::{self, Read, Write};

fn main() {
    let mut input = String::new();
    if let Err(e) = io::stdin().read_to_string(&mut input) {
        eprintln!("ivaronix-verifier: read stdin: {}", e);
        std::process::exit(1);
    }
    let value: serde_json::Value = match serde_json::from_str(&input) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("ivaronix-verifier: invalid JSON: {}", e);
            std::process::exit(1);
        }
    };
    match ivaronix_verifier::jcs(&value) {
        Ok(s) => {
            let _ = io::stdout().write_all(s.as_bytes());
            std::process::exit(0);
        }
        Err(e) => {
            eprintln!("ivaronix-verifier: {}", e);
            std::process::exit(1);
        }
    }
}
