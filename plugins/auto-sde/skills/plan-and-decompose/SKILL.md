---
name: plan-and-decompose
description: Use before implementing anything beyond a one-line fix — a multi-file change, a refactor, a new feature, or a task whose shape isn't obvious yet. Covers what to establish before planning, how to sequence steps so each one is verifiable, when to delegate a subtask with spawn_agent, and when to stop planning and start.
---

# Plan and decompose

Load this at the planning phase, before you edit anything. A plan is cheap and a
wrong implementation is not: most wasted work in a coding task comes from
starting before the shape of the change was clear, then discovering it halfway
through and carrying the false start along.

The output of this phase is a `write_tasks` checklist. Not prose, not an
intention — the actual tool call, so the plan survives compaction and the user
can see it.

## Before you can plan

You cannot plan a change you don't understand. Establish these four things
first; if you can't answer one, go read code until you can.

1. **The change site.** Which function, which file, which layer. Not "the auth
   module" — the specific place the behaviour lives now.
2. **The contract.** What the code you're changing promises its callers: inputs,
   outputs, errors, invariants. This is what tells you whether your change is
   local or breaking.
3. **The blast radius.** Who calls this. `rg` the symbol. A change with three
   callers is a different plan from one with thirty.
4. **The verification.** How you'll know it worked — which test, which command.
   Decide this *before* implementing, not after. A plan whose last step is
   "verify" without naming the check is a plan with no ending.

If the task turns out to be a one-line fix with an obvious test, skip the
checklist entirely and just do it. Ceremony on a trivial task is its own waste.

## Writing the plan

**Three to seven steps.** Fewer means you haven't decomposed; more means you're
planning past what you know and the later steps will be wrong anyway.

**Each step is independently verifiable.** "Add the field, update the callers,
run the module tests" is one step you can check. "Refactor the module" is not —
you'd have no way to tell whether it worked except by reading everything.

**Order by dependency, then by risk.** What must exist first goes first. Beyond
that, do the step most likely to invalidate the plan early — if the approach is
going to fail, fail it on step two, not step six after four steps of work built
on it.

**Name the files.** A step that doesn't say which file it touches hasn't been
thought through.

**Put the verification in the plan, as its own step or attached to the steps it
covers.** See the `verify-and-debug` skill for how to pick the check.

## Working the plan

- Keep **exactly one** task `in_progress`. Mark it `completed` the moment it's
  done, then promote the next one. The checklist is a live picture of where you
  are, not a record of what you intended an hour ago.
- **Revise when evidence arrives.** Discovering on step two that the contract is
  different than you thought means rewriting steps three through six, not
  pushing on and patching the difference at the end.
- **Don't add steps you weren't asked for.** A plan is also a scope boundary. If
  you find something worth fixing that isn't the task, note it in your final
  report and leave it.

## Delegating with `spawn_agent`

Delegation buys you a clean context window for a subtask; it costs you a full
model run and everything the subagent learned that doesn't fit in its final
answer. It is worth it when the subtask is **self-contained, read-heavy, and
summarizable**.

Delegate when all of these hold:

- The subtask can be stated completely in one prompt, with no back-and-forth.
- Its output is a *conclusion* — an answer, a summary, a recommendation — not a
  set of edits. A subagent's file changes are invisible to you except through
  its text.
- Doing it inline would flood your context with material you won't need again.
  "Read these nine files and tell me which one owns the retry logic" is the
  shape: nine files in, one sentence out.

Do **not** delegate when:

- The subtask needs the context you already have. Re-establishing it costs more
  than doing the work.
- You need the intermediate detail, not just the conclusion.
- It's the actual implementation. You are accountable for the diff; don't hand
  it to an agent whose work you'd have to re-read line by line anyway.
- It's small. A subagent has a fixed cost that a two-file read does not justify.

Subagents are depth-capped at one level and get no `spawn_agent` of their own, so
you cannot build a tree — one focused hand-off, then back to you.

## When to stop planning

Stop when the next concrete action is obvious and you believe steps one and two
are right. You do not need certainty about step six; you will know more by then.
Planning past the point where you're guessing produces detail that reads like
confidence and isn't.
