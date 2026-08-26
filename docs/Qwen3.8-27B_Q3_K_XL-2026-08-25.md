# hashwalk — Code Critique

**Date:** 2026-08-25
**Model:** agentic-Qwen3.8-27B:Q3_K_XL
**Scope:** Full codebase review after running all tests, including mutation testing.

---

## Test Results Summary

| Suite | Result |
|-------|--------|
| **Unit + Integration** | **83/83 passed** (0 failures, 0 skipped) |
| **Mutation Testing** | **98.45%** score — 118 killed, 9 timed out, **2 survived**, 39 errors |

### Surviving Mutants

- `lib/csv.ts:36` — `encoding: 'utf8'` → `{}` (harmless; utf8 is the default)
- `lib/walker.ts:23` — `entry.isSymbolicLink()` → `true` (always enters the symlink branch)

---

## Code Critique

### 1. Inconsistent error handling between `hashFile` and `hashFileStream`

`lib/hasher.ts` resolves with an error *string* on failure:

```ts
stream.on('error', (err) => resolve(`ERROR_${err.code ?? 'UNKNOWN'}_${Date.now()}`));
```

`lib/verify.ts` rejects the promise:

```ts
stream.on('error', reject);
```

This is the most significant design inconsistency in the codebase. Callers of `hashFile` must string-match `ERROR_` prefixes to detect failures, and the `Date.now()` suffix makes the value non-deterministic (hard to test, breaks idempotency of generated CSVs). Pick one strategy — rejecting is the better choice since it lets callers use `try/catch` and preserves the hash type as `string` (a real hash) rather than `string | error-marker`.

### 2. `writeCsv` doesn't handle backpressure

```ts
for await (const row of rows) {
  stream.write(line); // return value ignored
}
```

`stream.write()` returns `false` when the internal buffer is full. Ignoring it means the buffer grows unboundedly for large directory trees. The idiomatic fix is `await stream.write(line)` (Node streams support async writes) or checking the return value and awaiting `drain`.

### 3. Recursive `walkInternal` risks stack overflow

For deeply nested directory structures (e.g., `node_modules`-style trees or maliciously crafted paths), the recursion depth equals the directory depth. An iterative approach with an explicit stack would be safer. This is low-risk for a CLI tool but worth noting.

### 4. `realpath` called on every file entry

```ts
let realPath: string = fullPath;
try {
  realPath = await fs.promises.realpath(fullPath);
} catch { /* keep fullPath */ }
```

This is a syscall per file. For a tool whose purpose is to hash *many* files, this doubles the filesystem I/O. The deduplication is only necessary when symlinks are present. A cheaper approach: only call `realpath` when `entry.isSymbolicLink()` is true, and skip it for regular files (where `fullPath` is already unique within the walk).

### 5. Ambiguous `--compare` semantics

```ts
const shouldProcessAsFile = await isFile(compareFilePath);
if (shouldProcessAsFile) {
  // hash the file and compare
} else {
  // treat as raw checksum string
}
```

If a user passes a checksum string that happens to match a filename in the CWD, it's silently treated as a file. A `--compare-file` vs `--compare-hash` flag split (or requiring an explicit `file:` / `hash:` prefix) would remove the ambiguity.

### 6. `csvEscape` always quotes — correct but worth documenting the tradeoff

Unconditional quoting is RFC 4180-compliant and simplifies the parser, but it produces larger CSVs and makes manual inspection slightly noisier. The comment in the code acknowledges this; no action needed, just flagging that a consumer parsing these CSVs must handle quoted fields (which any RFC-compliant parser will).

### 7. `bin/hashwalk.ts` — no error handling on `main()` rejection

```ts
main().then((code) => process.exit(code));
```

If `main()` throws (it shouldn't, since it has a top-level `try/catch`, but defensively), the promise rejection is unhandled. A `.catch()` that logs and exits 1 would be more robust.

### 8. Mutation testing: 39 "error" mutants

The 39 error mutants (18 in `cli.ts`, 12 in `walker.ts`, etc.) indicate the test runner itself crashed on those mutants rather than a test failing. This usually points to instrumented code causing unhandled exceptions that kill the worker process. It inflates the "untested" surface and can mask real gaps. Worth investigating whether the TAP runner is swallowing errors that should be test failures.

---

## What's Done Well

- **Symlink handling** in the walker is thorough: broken links skipped, cycles prevented via `visited` set, deduplication by `realpath`. The test suite explicitly covers all four scenarios.
- **CSV escaping** is correct and well-tested against RFC 4180 edge cases (commas, quotes, newlines, carriage returns, backslashes).
- **Test structure** is clean: unit tests isolate functions with mocks, integration tests exercise the real CLI via child process, and the `runMain` helper avoids spawning a process for every assertion.
- **98.45% mutation score** with zero no-coverage mutants means the test suite is genuinely exercising the code paths, not just hitting them.
