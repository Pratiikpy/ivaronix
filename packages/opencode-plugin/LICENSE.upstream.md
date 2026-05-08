# Upstream provenance — opencode plugin package

The TypeScript source files in `src/` were copied verbatim on 2026-05-08 from:

- Repo: `https://github.com/sst/opencode` (vendored locally at `CLI Open Source Project/opencode/`)
- Path: `packages/plugin/src/`
- Version: `1.14.40`
- License: **MIT** (see below)

Per the MIT license, we preserve the original copyright notice. Our additions on top of these files are also released under MIT.

---

```
MIT License

Copyright (c) 2025 opencode

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Status

- **F-1a (this commit):** source files vendored. Package marked private + `typecheck` short-circuited. Not yet integrated into the workspace `apps/cli/` deps.
- **F-1b–F-1g:** vendor the rest of the OpenCode packages we need (sdk, function, script, extensions, core, opencode-bin) under `packages/opencode-*/`.
- **F-1h:** resolve `catalog:` references → real version pins. Resolve zod@3→zod@4 migration (or workspace alias) since `@ivaronix/receipts` currently uses zod@^3. Add ambient types from `sst-env.d.ts`.
- **F-2 onwards:** re-skin to Ivaronix brand, replace identity, layer the four 0G plugins, swap the binary name, cutover.
