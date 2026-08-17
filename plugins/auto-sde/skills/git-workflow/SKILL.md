---
name: git-workflow
description: Use when committing, branching, writing a commit message or PR description, or inspecting history to understand why code is the way it is. Covers what to stage, how to write a message that stays useful, branch hygiene, and the git operations that need explicit human sign-off.
---

# Git workflow

Load this when the task touches version control. Two rules frame everything
below.

**Commit and push only when asked.** A working tree the user hasn't reviewed is
theirs to commit. Making the commit for them removes the review step they were
about to do, and an unwanted commit costs more to undo than one they asked for
costs to make.

**Never rewrite shared history or force anything without being told to, in this
task, explicitly.** `push --force` (even `--force-with-lease`), `reset --hard`,
`rebase` onto a pushed branch, `commit --amend` on something already pushed,
`clean -fd`, branch deletion. These destroy work that may not exist anywhere
else. If one of them is genuinely the right move, say so and ask.

## Before committing

**Read the diff first.** `git diff` for unstaged, `git diff --staged` for what
you're about to commit. See the `review-changes` skill — committing is where
leftover diagnostics and stray edits become permanent.

**Check what's actually there.** `git status` — untracked files you didn't
intend, and anything that shouldn't be in version control at all: `.env`,
credentials, keys, a large binary, a local config. If you find one, stop and
tell the user rather than adding it to `.gitignore` yourself; they may need to
know it existed.

**Stage deliberately.** Name the paths — `git add src/auth.rs src/auth_test.rs`.
`git add -A` sweeps up whatever else is lying around, which is how unrelated
files end up in a commit nobody can cleanly revert.

**One logical change per commit.** A bug fix and the refactor you did along the
way are two commits. This matters exactly when it's expensive to fix: at
`git bisect`, `git revert`, and code review.

## Commit messages

The message explains **why**; the diff already shows what.

```
Fix retry budget being consumed by cancelled requests

A cancelled request decremented the retry counter before the
cancellation check, so a client that timed out twice exhausted the
budget for the real attempt that followed.

Move the check above the decrement and add a test for the
cancel-then-retry sequence.
```

- **Subject: imperative, under ~72 characters, no trailing period.** "Fix retry
  budget…", not "Fixed" or "Fixes".
- **Blank line, then the body** — but only if there's something to say. A commit
  whose subject fully explains it doesn't need a body.
- **Body says why, and what a reader would otherwise have to reconstruct.** The
  symptom, the cause, the reason for this approach over the obvious alternative.
- **Match the repository's existing style.** `git log --oneline -20` first. If
  the project uses Conventional Commits (`fix:`, `feat:`), or references issue
  numbers, follow that.
- **No filler.** Don't restate the diff file by file. Don't write "various
  improvements".

## Branches

- **Check where you are before you commit:** `git branch --show-current`.
- **Don't commit to the default branch.** If you're on `main`/`master` and the
  work isn't trivial, create a branch first.
- **Name it for the work:** `fix/retry-budget-cancellation`, not `patch-1`.
- **Follow the repo's convention** if it has one — `git branch -a` shows you the
  shape.

## Pull request descriptions

Written for a reviewer who has not read the diff and does not have your context.

- **What changed and why**, in a short paragraph. Lead with the problem, not the
  solution.
- **How it was verified** — the actual commands and results.
- **Anything a reviewer should look at closely**: a decision that could have gone
  another way, a piece you're unsure about, a compatibility implication.
- **Link the issue** if there is one.

Skip the file-by-file walkthrough. The reviewer can read the diff; what they
can't reconstruct is your reasoning.

## Reading history

History is the cheapest source of "why is this like this" a codebase has, and it
is all read-only:

- `git log --oneline -20 -- path/to/file` — how this file has changed.
- `git log -S "someSymbol" --oneline` — the commits that added or removed a
  string. Best tool for finding when a behaviour appeared.
- `git blame -L 40,80 path` — who last touched these lines and in which commit.
- `git show <sha>` — the full commit, message included. The message is usually
  the answer.

When a change looks wrong, check whether a past commit explains it before
"fixing" it. Code that looks like a mistake is often a fix for something you
haven't hit yet.
