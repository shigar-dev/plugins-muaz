---
name: verify-and-debug
description: Use when running tests, verifying a code change works, or debugging a failure. Covers per-framework test selectors, output trimming, the cheapest-check-first verification strategy, and a debugging playbook for failures and regressions.
allowed-tools: shell:*
---

# Verify and debug

Load this when you reach the verify phase or hit a failure. The goal is the same as always: get a trustworthy signal with the fewest tokens. Run the cheapest relevant check first; widen only when it passes and the risk justifies it.

## The verification rings (inner → outer)

Run inner rings first. Stop at the first failure, fix, and re-run from that ring. Only reach the full suite when inner rings pass and the change is risky or cross-cutting — and run it once, at the end, not after every edit.

1. **Static / type / lint** on the changed files only — fast, free, catches typos:
   - Rust: `cargo check -p <crate>` then `cargo clippy -p <crate>`
   - TypeScript: `tsc --noEmit` (or `tsc --noEmit -p tsconfig.json`)
   - Python: `python -m py_compile path.py`, `ruff check path.py`
   - Go: `go vet ./pkg/...`
2. **Targeted unit test** — only the test(s) covering your change:
   - Rust: `cargo test -p <crate> module::tests::test_name`
   - pytest: `pytest tests/test_foo.py::TestBar::test_baz -x --tb=short -q`
   - jest: `jest path/to/file.test.ts -t "describe name"`
   - vitest: `npx vitest run path/to/file --reporter=dot`
   - go: `go test ./pkg/foo -run TestBaz`
3. **Module / package tests** — the surrounding module, once the targeted test passes.
4. **Affected suites** — tests depending on changed files: `pytest --lf`, `jest --findRelatedTests <file>`, `nx affected:test`.
5. **Full suite** — last resort, once.

## Reading output without drowning

- **Fail fast:** `-x` / `--bail` / `--maxfail=1` — stop at the first failure instead of paging through cascades.
- **Short tracebacks:** `--tb=short` (pytest); `RUST_BACKTRACE=0` until you actually need a backtrace.
- **Quiet successes:** `-q`, `--reporter=dot` — you only need to see what failed.
- **Grep big logs:** `… 2>&1 | grep -E 'FAIL|ERROR|assert|panicked|Error:'`, or redirect to a file and `sed -n` the relevant slice.
- Don't re-run a passing command just to look again — you already saw it.

## Build hygiene

- Prefer incremental builds: `cargo build` (not `cargo clean && build`), `tsc --incremental`, `make` (not `make clean all`).
- Build only the affected target: `cargo build -p <crate>`, `go build ./pkg/...`, `yarn workspace X build`.
- Don't rebuild to verify a comment or doc change — match verification to the actual risk.

## "Verified" means

- It compiles / type-checks.
- The most relevant existing tests still pass.
- Any test you added passes.
- A representative behavior check confirms the intended effect.

You do **not** need to run every test in the repo for a small change. State what you ran and what you skipped.

## Debugging playbook

When something fails:

1. **Read the actual error.** The stack trace usually names the file and line. Don't pattern-match to a similar error you remember — read what *this* one says.
2. **Reproduce minimally.** Reduce to the smallest input/command that triggers it. A 3-line repro is faster to fix than a full integration run, and confirms you understand the trigger.
3. **Localize before changing.** Read the slice around the failing line (`sed -n`), check the inputs reaching it, and form one hypothesis. Add a temporary diagnostic (a print/log) only if reading can't resolve it — and remove it before you finish.
4. **Two failed fixes = stop.** If the same approach fails twice, the assumption is wrong. Re-read more context; don't keep poking.
5. **Bisect a regression.** When a previously-working thing broke, narrow by halves — `git log`/`git bisect`, or revert changes in groups — rather than staring at the whole diff.
6. **Don't fight the harness.** If a test is genuinely flaky, say so and tell the user; don't silently `skip`/`ignore` it and call the task done.
