import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { tryParseJson } from './json-repair.js';

describe('tryParseJson · clean input', () => {
  test('valid object parses on fast path with no repairs', () => {
    const r = tryParseJson('{"a": 1}');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value, { a: 1 });
    assert.deepEqual(r.repaired, []);
  });

  test('valid array parses on fast path', () => {
    const r = tryParseJson('[1,2,3]');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value, [1, 2, 3]);
    assert.deepEqual(r.repaired, []);
  });

  test('valid nested structure parses on fast path', () => {
    const r = tryParseJson<{ a: { b: number[] } }>('{"a":{"b":[1,2]}}');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value.a.b, [1, 2]);
  });
});

describe('tryParseJson · markdown code fence', () => {
  test('strips ```json ... ``` wrapper', () => {
    const r = tryParseJson('```json\n{"verdict": "PASS"}\n```');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value, { verdict: 'PASS' });
    assert.ok(r.repaired.includes('codeFence'));
  });

  test('strips bare ``` ... ``` wrapper', () => {
    const r = tryParseJson('```\n{"a": 1}\n```');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value, { a: 1 });
  });

  test('strips ```javascript / ```js wrappers', () => {
    for (const lang of ['javascript', 'js']) {
      const r = tryParseJson('```' + lang + '\n{"a": 1}\n```');
      assert.equal(r.ok, true, `lang=${lang}`);
    }
  });
});

describe('tryParseJson · prose around JSON', () => {
  test('strips leading "Here is the JSON:" prose', () => {
    const r = tryParseJson('Here is the JSON: {"verdict": "PASS"} hope this helps');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value, { verdict: 'PASS' });
    assert.ok(r.repaired.includes('leadingTrailingProse'));
  });

  test('strips prose around an array', () => {
    const r = tryParseJson('Output: [1, 2, 3]\nThat is the result.');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value, [1, 2, 3]);
  });

  test('keeps stray braces inside string values intact', () => {
    const r = tryParseJson('Result: {"text": "use { and } as syntax"} done');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value, { text: 'use { and } as syntax' });
  });
});

describe('tryParseJson · trailing commas', () => {
  test('removes trailing comma before }', () => {
    const r = tryParseJson('{"a": 1, "b": 2,}');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value, { a: 1, b: 2 });
    assert.ok(r.repaired.includes('trailingCommas'));
  });

  test('removes trailing comma before ]', () => {
    const r = tryParseJson('[1, 2, 3,]');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value, [1, 2, 3]);
  });

  test('handles trailing comma with whitespace', () => {
    const r = tryParseJson('{"a": 1, \n}');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value, { a: 1 });
  });
});

describe('tryParseJson · smart quotes', () => {
  test('replaces left/right double smart quotes', () => {
    const r = tryParseJson('{“a”: 1}');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value, { a: 1 });
    assert.ok(r.repaired.includes('smartQuotes'));
  });
});

describe('tryParseJson · BOM', () => {
  test('strips BOM at start', () => {
    const r = tryParseJson('﻿{"a": 1}');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value, { a: 1 });
    assert.ok(r.repaired.includes('bom'));
  });
});

describe('tryParseJson · combined malformations', () => {
  test('code fence + trailing comma in one input', () => {
    const r = tryParseJson('```json\n{"a": 1, "b": 2,}\n```');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value, { a: 1, b: 2 });
    assert.ok(r.repaired.includes('codeFence'));
    assert.ok(r.repaired.includes('trailingCommas'));
  });

  test('prose + smart quotes + trailing comma', () => {
    const r = tryParseJson('Output:\n{“a”: 1, “b”: 2,}\nThanks!');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.value, { a: 1, b: 2 });
  });
});

describe('tryParseJson · refuses risky repairs', () => {
  test('does NOT silently fix single-quoted strings', () => {
    const r = tryParseJson("{'a': 1}");
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.match(r.error, /JSON|token|parse/i);
  });

  test('does NOT silently fix unquoted keys', () => {
    const r = tryParseJson('{a: 1}');
    assert.equal(r.ok, false);
  });

  test('does NOT invent data for truncated JSON', () => {
    const r = tryParseJson('{"a": 1, "b":');
    assert.equal(r.ok, false);
  });
});

describe('tryParseJson · failure shape', () => {
  test('returns error message and attempted transforms on irreparable input', () => {
    const r = tryParseJson('not even close to JSON');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(typeof r.error, 'string');
    assert.ok(Array.isArray(r.attempted));
  });

  test('attempts BOM strip even when subsequent parse fails', () => {
    const r = tryParseJson('﻿not json');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.ok(r.attempted.includes('bom'));
  });
});
