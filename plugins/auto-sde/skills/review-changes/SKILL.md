---
name: review-changes
description: Use after implementing and before reporting a change as done — read your own diff critically. Covers reading the diff as a reviewer would, the specific defects self-review catches, checking for leftovers and unintended edits, and what to tell the user about what you did and didn't verify.
---

# Review your own changes

Load this once the edits are in and the tests pass, before you say you're done.
Passing tests mean the change didn't break what was already checked. They say
nothing about the things nobody wrote a test for, and those are most of what
goes wrong.

Read the diff, not your memory of the diff. `git diff` (or `git diff --staged`).
You are looking at it as the person who has to review this, not the person who
just wrote it.

## Read the whole diff

Every hunk, including the ones you're sure about. The specific failure this
catches is the edit you made early, forgot about, and would have shipped: a
debug print, a commented-out line you meant to restore, a value you changed to
test something.

Three things to check on every pass:

- **Files you didn't mean to touch.** Lockfiles, formatter churn across a whole
  file, an editor's trailing-whitespace cleanup. If the diff is 400 lines and
  your change was 20, find out why before going further.
- **Leftovers.** Diagnostics you added, `TODO`s you wrote to yourself, a test
  temporarily narrowed to one case, a timeout you bumped to make something pass.
- **Whitespace-only hunks.** They're noise in review and they hide real changes
  inside them. `git diff -w` shows you the diff without them; if that's much
  smaller than the real diff, reformat back.

## What self-review catches that tests don't

Go through the changed logic and ask specifically:

**Error paths.** You tested the success case. What happens on the failure? Is the
error swallowed, logged and continued, or propagated? Does the caller expect it?
An error path with no test is the single most common place a change is wrong.

**Edge inputs.** Empty, zero, one, null/None, the maximum, a duplicate. Not
exhaustively — pick the ones that plausibly reach this code.

**The callers you didn't update.** You changed a signature, a return type, or the
meaning of a value. `rg` the symbol and confirm every call site still makes
sense. In a dynamically typed language nothing will tell you if you missed one.

**Partial application.** You changed one of three places that do the same thing.
Either change all three or say why you didn't. Half-applied patterns are worse
than the original, because the next reader can't tell which half is intentional.

**State you left behind.** A file created, a lock taken, a connection opened, a
temp directory. Is it cleaned up on the failure path as well as the success one?

**Concurrency, if any is involved.** A check-then-act across an await or a lock
release. A shared mutable value with no synchronization. If none of this applies,
move on in one second — but check.

## Match the change to the request

Re-read the original request, then the diff.

- **Did you do everything asked?** Scan the request for each thing it wanted and
  find it in the diff. Multi-part requests lose their last part surprisingly
  often.
- **Did you do more than was asked?** An unrequested refactor sitting inside a
  bug fix makes the fix harder to review and harder to revert. If it's genuinely
  needed, say so explicitly; if it isn't, take it out.
- **Does the code match its surroundings?** Naming, error handling, comment
  density, test style. Code that reads as foreign in its own file is a defect
  even when it works.

## Reporting

Say three things, briefly:

1. **What changed** — the files and the substance, not a narration of your
   process.
2. **What you ran** — the actual commands and their result. "Tests pass" is not
   a report; `cargo test -p muaz-core` (476 passed) is.
3. **What you didn't verify, and why it might matter.** The integration test you
   skipped, the platform you can't run on, the edge case you reasoned about but
   didn't exercise. This is the most valuable line in the report and the one
   most often left out.

If something failed, say so with the output. A change reported as done that
isn't costs far more than one reported as blocked.
