---
name: audit-scaffold
description: Prove the template scaffolds cleanly - in a throwaway git worktree, follow CLAUDE.md's "Starting a New App" steps literally, replace the notes example with a tiny feature, and check lint, tests, build and migrations still pass. Reports every step that was wrong, missing or harder than it should be.
disable-model-invocation: true
context: fork
---

# /audit-scaffold

First read `.claude/skills/_audit-shared/RULES.md` and follow it throughout
(especially the worktree notes under **Environment**). Then read `CLAUDE.md`,
and `DECISIONS.md` from the same folder as RULES.md.

The template's promise is that a new app starts by deleting the example and
renaming a few things. This check acts it out. Everything happens in a
scratch worktree. Never modify the main working tree.

## 1. Set up

`git worktree add <scratch>/scaffold HEAD`, link the backend venv and
frontend modules as RULES.md describes, and confirm that lint and unit tests
pass in the worktree before changing anything (baseline).

## 2. Follow the steps literally

Carry out CLAUDE.md's **Starting a New App** steps in order, exactly as
written, as a developer who knows only what the docs say. For each step,
record:
- whether every file, symbol and command it names exists,
- what you had to do that the step does not say (each one is a finding),
- what was left behind that still mentions notes or health (grep
  `-i 'note'` and `health` across the worktree afterward, excluding
  `/api/health`, which is kept on purpose).

For step 5, use a stand-in feature instead of a real one: a `bookmarks`
resource (`url` and `title`, owned by a user, cursor-paginated list, create),
built by following the notes slice's pattern as CLAUDE.md describes it (model,
schema, routes, migration, service, hook, page, tests). Keep it minimal. The
point is to discover what the pattern makes hard, not to write a good feature.
Generate its migration as CLAUDE.md says; if that needs a database, use the test
stack's `db` per RULES.md, and tear it down afterward.

Skip step 7 (rewriting docs); just note which sections of README and
CLAUDE.md would need rewriting, as a measure of how much is notes-specific.

## 3. Verify

In the worktree: `ruff check .`, the backend unit tests with coverage,
`npm run lint`, `npm run test:coverage`, and `npm run build`. Each must pass,
including the coverage thresholds. If the test stack is available, also run
`test_migrations.py` against it, so the new migration is checked against the
model.

## 4. Judge the experience

- How many files did removing the example touch, and how many had to be
  edited rather than deleted? Every edit outside the feature's own folders is
  a coupling to question: could shared code avoid knowing about the example?
- Which renames (`app`, `appdb`, `APP_NAME`, compose projects) were spread over
  more places than the steps admit?
- Could any step be replaced by a check that fails loudly (a test or lint
  rule) instead of a line in the docs?

Clean up: tear down any stack, remove the worktree
(`git worktree remove --force`), and delete any branch you created.

Write the report as RULES.md describes, with ID prefix `SCAF`. Add a table of
the steps with columns: step, as written, what was actually needed, verdict.
