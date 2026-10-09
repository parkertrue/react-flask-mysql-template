# Audit rules

Every `/audit-*` check follows these rules. Read this whole file before starting.

## What the audits are for

This repository is a template, and every run should leave it closer to
bulletproof. In priority order:

1. **Secure and production-grade.** Correct under failure, abuse and load.
2. **Test-driven.** Every behavior that matters is pinned by a test that can fail.
3. **Lean.** Little code, few dependencies, few moving parts. Removing
   something is as valid a finding as adding something. A recommendation to
   add anything (a dependency, a service, a config knob, a layer) must name the
   concrete gap it closes; "best practice says so" is not enough.
4. **Easy to scaffold.** A new app replaces the example feature and renames a
   few things. Anything that makes that harder (example code leaking into
   shared code, names tied to "notes" or "app", steps missing from CLAUDE.md's
   "Starting a New App") is a finding.

## Sources of truth

- **CLAUDE.md is the spec.** It states how every layer works and why. Check
  the code against each claim it makes in your scope. A claim the code doesn't
  honor is a finding: either the code is wrong or CLAUDE.md is stale. Say which,
  with evidence. Do not copy CLAUDE.md's facts into findings as if new.
- **`SOURCES.md`** (next to this file) lists the outside standards per layer
  (OWASP, official docs, reference templates). Its table at the end says which
  sources your check starts with. A source's advice is a prompt to check, not
  an order; adopt it only where it fixes a real gap in this app.
- **`DECISIONS.md`** (next to this file) lists accepted trade-offs and known
  gaps. Do not report them as findings. Report an entry only if its *Revisit
  when* condition has come true or the code no longer matches it.
- **Code beats prose.** Read the actual file before claiming anything about it.
  If a claim can be checked by running something (a test, a curl, a grep, a
  container), run it. Never report a guess as a finding; if you could not
  verify something, list it under *Unverified* with what would settle it.

## Boundaries

Audits are **read-only** with respect to the repository:

- Do not edit, create or delete tracked files, and do not commit, push, or
  change branches in the main working tree. The only file you write is your
  report (below).
- Do not touch `.env.prod`, or the dev (`app_dev`) and production (`app`)
  Compose projects or their volumes. They hold the user's data.
- Checks that need running services use one of two throwaway stacks, never
  both at once. Only one check may run Docker at a time (the `/audit`
  orchestrator runs them one after another), and each tears its stack down
  when done, volumes included.
  - The **test stack**: `docker-compose.test.yml`, project `app_test`, ports
    3307, 6380, 8080, 8443. Tear down with
    `docker compose --env-file .env.test -f docker-compose.test.yml --profile e2e down -v`.
  - A **production-config stack** for checks that need production behavior
    (persistent volumes, restart policies): `docker-compose.yml` with
    `-p app_audit`, an env file written to the scratch directory with fresh
    random secrets (`python -c "import secrets; print(secrets.token_urlsafe(48))"`)
    and `SERVER_NAME=localhost`, plus a scratch override file that rebinds
    nginx to `127.0.0.1` (`ports: !override ["127.0.0.1:80:80", "127.0.0.1:443:443"]`),
    so nothing listens on the network. Never use the bare project name `app`.
    Tear down with the same `-p app_audit` and `-f` flags plus `down -v`.
- There is no deployed server (see DECISIONS.md, Known gaps). Never scan, SSH
  into, or load-test anything other than localhost. A step that needs a real
  deployment is reported under *Skipped* with the reason.
- Scratch work (worktrees, probe files, scan output) goes in the session's
  scratchpad or the system temp directory, never in the repository.

## Environment

- Windows with Git Bash (POSIX syntax) and PowerShell; Docker Desktop.
- Backend tools: `source backend/.venv/Scripts/activate` (or `.venv/bin/activate`
  on Linux/macOS). Frontend: `npm` in `frontend/`.
- CI already runs, on every push: ruff, ESLint, both unit suites with coverage,
  compose validation, zizmor, hadolint and gixy-ng; integration and E2E run on
  `main` and daily. **Read CI results instead of re-running them:**
  `gh run list --branch main --limit 10` and `gh run view <id> --log-failed`.
  Re-run locally only what CI cannot show, or when CI is red or older than the
  last commit. If `gh` is unavailable, say so and run locally instead.
- Scratch worktrees (`git worktree add <scratch>/<name> HEAD`) have no
  `backend/.venv` or `frontend/node_modules`. Backend: run the main tree's
  venv from inside the worktree (`<repo>/backend/.venv/Scripts/python -m pytest`,
  or `.venv/bin/python` on Linux/macOS). Frontend: link the main tree's
  modules (`cmd //c mklink /J frontend\\node_modules <repo>\\frontend\\node_modules`
  on Windows, `ln -s` elsewhere), or run `npm ci` if the lockfile changed.
  Always `git worktree remove --force <path>` when done.
- Gotchas: `run_tests.sh integration` ends with `down -v`, which kills an E2E
  stack using the same project. Playwright reuses a running stack locally
  (`reuseExistingServer`), so tear down before rerunning E2E and pass
  `--build` when backend code changed.

## Turn findings into guards

For every finding, ask: could a lint rule, test, CI job or type check catch
this class of problem next time? If yes, the fix must include that guard (the
**Prevent** column). The goal is for each audit to leave less for the next one
to do by hand. A check that keeps finding the same mechanical problem should
recommend moving it into CI and dropping it from the prompt.

## Severity

| Severity | Meaning |
|---|---|
| **blocker** | Exploitable vulnerability, data loss, a red test or CI run, a secret in git, or production behavior that contradicts CLAUDE.md in a way users would hit. Release is blocked. |
| **high** | Real defect or exposure needing an unusual condition; a missing test for security-relevant or data-integrity behavior; a dependency CVE rated high or critical. |
| **medium** | Defect in an edge case; drift between code and CLAUDE.md or README; a test that cannot fail; a meaningful deviation from a SOURCES.md standard. |
| **low** | Hardening, simplification, consistency, or clarity with modest payoff. |
| **nit** | Wording or style. Report at most five; skip the rest. |

Rate by impact on a real deployment of an app built from this template, not by
how much work the fix is.

## Report

Write the report to `temp/audits/YYYY-MM-DD-<check>.md` (today's date, the
check's name, e.g. `2026-10-09-audit-infra.md`; `temp/` is gitignored). If a
report for the same check and date exists, overwrite it.

```markdown
# <check> — YYYY-MM-DD

Commit: <git rev-parse --short HEAD> (<branch>), working tree clean|dirty
Scope: <what was covered; arguments passed, if any>
Verdict: PASS | FINDINGS | BLOCKED   (BLOCKED if any blocker)
Counts: blocker N, high N, medium N, low N, nit N

## Findings

| ID | Sev | Location | Finding | Evidence | Fix | Prevent |
|---|---|---|---|---|---|---|
| INFRA-1 | high | `nginx/...:42` | One sentence. | What you read or ran that shows it. | Concrete change. | Guard that would catch it, or "—". |

## Compared with last run
Read the most recent earlier report for this check in `temp/audits/`, if any.
New: IDs. Resolved: the earlier findings that are now fixed. Recurring: IDs
also in the last report (call out any reported three times or more).

## Proposed DECISIONS.md entries
Findings that look deliberate: the entry you would add, for the user to accept or reject.

## Verified
Short bullets of important claims you checked and found true (one line each).

## Unverified / Skipped
What you could not check, and why (no deployment, Docker unavailable, ...).
```

ID prefixes: `INFRA`, `TEST`, `SEC`, `REC`, `CODE`, `A11Y`, `DOCS`, `SCAF`.
Order findings by severity. Give each one a precise `file:line`.

When done, reply with **only**: the verdict, the counts, the top five
findings (ID, severity, one line each), and the report path. The report holds
the detail.
