#!/usr/bin/env tsx
/**
 * JCS CLI · reads JSON on stdin, writes the canonical RFC-8785 string on
 * stdout. Used by the cross-impl byte-equality harness in
 * scripts/verifier-py/cross_check.py and (when shipped) the Rust + Go
 * cross-impl tests in CI.
 *
 * Exits 0 on success, 1 on parse / canonicalize error.
 */
import { jcs } from './jcs.js';

(async () => {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    const value = JSON.parse(raw);
    process.stdout.write(jcs(value));
    process.exit(0);
  } catch (err) {
    process.stderr.write(`jcs-cli: ${(err as Error).message}\n`);
    process.exit(1);
  }
})();
