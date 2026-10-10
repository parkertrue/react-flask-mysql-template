---
name: audit-code
description: Review code hygiene across the repo - comments (stale, redundant, change-history, author-specific, missing where needed), dead code and orphaned files, debug leftovers, and naming and pattern consistency against CLAUDE.md's conventions.
argument-hint: "[comments|dead|naming]"
disable-model-invocation: true
context: fork
---

# /audit-code

First read `.claude/skills/_audit-shared/RULES.md` and follow it throughout.
Then read `CLAUDE.md` (its **Naming Conventions** and the folder rules under
**Architecture** are the spec here), plus `DECISIONS.md` from the same folder
as RULES.md.

**Scope:** `$ARGUMENTS`. If empty, run all three parts.

**Files:** every tracked file (`git ls-files`) except lockfiles,
`backend/migrations/{README,alembic.ini,script.py.mako}` (Alembic's
generated files), and `.claude/`. Tests are in scope, but for test comments
report only stale or wrong ones, not redundant narration.

Whitespace and formatting (trailing spaces, final newlines) are out of scope,
except for one finding proposing a guard (an `.editorconfig` or lint rule) if
they are inconsistent.

## 1. comments

Comments should explain *why* (a constraint, a trade-off, a non-obvious
consequence) to a developer who has just cloned the template. Read every
comment and flag:

- **Stale:** it names a file, function, variable, setting, version or behavior
  that no longer exists or no longer works that way. Check each reference.
- **Change history:** it explains what used to be there or why something
  changed ("now", "no longer", "used to", "was moved", "instead of the old",
  "after the fix"). Git holds history; the comment should state the current
  reason or go.
- **Author- or machine-specific:** it mentions a person, a local path, a
  particular machine or OS setup, a ticket, a chat or audit, or a date, where
  the general template reader has no use for it.
- **Redundant:** it restates what the code says (`# Initialize extensions`
  above `init_app`).
- **Too long:** a paragraph where a sentence would do, or the same explanation
  repeated in several files (keep it in one place and point there, or keep it
  only where a reader needs it).
- **Missing:** non-obvious code with no reason given: security-sensitive
  logic, magic numbers, workarounds, ordering that matters, anything a
  maintainer might "simplify" into a bug.
- **Temporary markers:** `TODO`, `FIXME`, `HACK`, `XXX`, `NOCOMMIT`. Each one
  is a finding: resolve it, or move it to the project's issue list.
- **Inconsistent style:** comment tone, capitalization and punctuation
  differ from the file's neighbors.

For each comment finding, give the replacement text (or "delete").
Comment findings are rated **low** or **nit** unless the comment is wrong in a
way that would mislead someone into a bug (then **medium**).

## 2. dead: dead code and leftovers

- Python: unused functions, classes, constants and parameters in
  `backend/app/` and the backend scripts (ruff already catches unused imports).
  Grep for each definition's uses; remember Flask registers routes and loaders
  by decorator.
- JavaScript: exports nothing imports, components and hooks nothing renders,
  CSS selectors no markup uses (check `frontend/src/styles/` and feature CSS
  against the JSX), and fixtures or test helpers no test uses.
- Routes the frontend never calls that are not documented as API-only.
- Files: anything tracked that nothing references (scripts, configs, assets),
  and test files whose subject is gone.
- Config: settings, env vars, compose keys and CI steps that have no effect.
- Code only tests use (a method, parameter or return value no app code
  reads) counts as dead, unless a comment marks it as a deliberate test seam.
- Debug leftovers that lint can't see. Lint already enforces `print` (ruff
  T20), commented-out Python (ruff ERA), `console.*` in app code (ESLint
  `no-console`), and `.only` in E2E (Playwright `forbidOnly` in CI). Look only
  for commented-out JS, `.skip` and `.only` in Vitest files, and debug-level
  logging or `FLASK_DEBUG` reaching production config.

## 3. naming: consistency

Check names and patterns against CLAUDE.md's conventions and against each other:

- Singular vs plural (model, table, schema, component, hook, test file names).
- Route and schema modules named after the API resource; test files after the
  module they test.
- The same concept spelled the same way everywhere (for example, error codes,
  env var prefixes, compose service and volume names, CSS custom properties,
  and UI wording such as "Log out" vs "Logout").
- The same job done the same way everywhere: error responses through
  `error_response`, backend calls through a service module, forms through
  `FormField`, imports through `@/`, React or React Router built-ins instead of
  hand-written equivalents. One file doing it differently is a finding.
- Import direction rules (shared code never imports a feature or page;
  features never import each other). ESLint enforces part of this; check what
  it misses.

## Out of scope
README and CLAUDE.md prose (`/audit-docs`); behavior (other checks).

Write the report as RULES.md describes, with ID prefix `CODE`. Group comment
problems into findings by kind (for example, "CODE-3: 7 change-history
comments"), and put every individual edit in a separate *Comment edits* table
(file:line, current text, proposed text), since applying them is the point of
part 1. The table's rows are not findings: they don't count toward the
severity counts or the cap on nits.
