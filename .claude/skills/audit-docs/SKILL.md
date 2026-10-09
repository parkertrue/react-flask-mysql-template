---
name: audit-docs
description: Check README.md and CLAUDE.md against the code - every command, path, port, variable, count and architectural claim - and for gaps a new user or operator would hit.
disable-model-invocation: true
context: fork
---

# /audit-docs

First read `.claude/skills/_audit-shared/RULES.md` and follow it throughout.
Then read `DECISIONS.md` from the same folder.

**Documents:** `README.md`, `CLAUDE.md`, `.env.prod.example`'s comments, and
the `.claude/skills/` files themselves (they reference paths and commands too).

## 1. Every factual claim

Go through each document line by line. For each concrete claim (a command and
its flags, a file or folder path, a port, an env var, a service, project or
volume name, a version, a limit or number, a test count, a script's
behavior), find the source that proves or disproves it and record the result.
Run commands where it is cheap and safe to do so (`--help`, `config --quiet`,
`ls`). Pay most attention to the parts that drift: setup steps, test
commands, ports, env var lists, the HTTPS and deployment sections, and the
architecture descriptions of folders.

## 2. The two documents agree

README is for people using the template; CLAUDE.md is for working on it. The
same fact must not differ between them. Flag contradictions, and long passages
duplicated in both, which will drift apart (say which one should hold it).

## 3. Gaps

Follow the README as a new user would, top to bottom, without using knowledge
from the code: clone, set up, run dev, run each test suite, build and run
production. Note every step that is missing, out of order, or that only works
with knowledge the document doesn't give. Do the same for an operator: deploy,
renew certificates, back up, upgrade, roll back, rotate secrets, read logs.
Gaps that DECISIONS.md lists as known (no backups yet) are mentioned only if
the README fails to say they are not provided.

## 4. Form

- Writing that only makes sense to the original author (history, personal
  setup, references to past conversations or audits).
- Sections so long a reader will skip them, or that restate the code.
- Broken links: check every URL and relative link resolves (relative links
  against the repo; external ones with a HEAD request, noting any that fail).

## Out of scope
Code comments (`/audit-code`). The "Starting a New App" steps are executed by
`/audit-scaffold`; here, check only that the paths they name exist.

Write the report as RULES.md describes, with ID prefix `DOCS`. For every
finding, quote the current text and give the replacement.
