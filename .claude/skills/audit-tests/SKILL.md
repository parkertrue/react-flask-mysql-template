---
name: audit-tests
description: Audit the testing system at every level (backend unit and integration, frontend unit with MSW, Playwright E2E). First the infrastructure, config and patterns for reliability and scalability; then coverage gaps measured against behavior.
argument-hint: "[backend|frontend|e2e]"
disable-model-invocation: true
context: fork
---

# /audit-tests

First read `.claude/skills/_audit-shared/RULES.md` and follow it throughout.
Then read `CLAUDE.md` (its **Test Architecture** section is the spec for this
check), plus `SOURCES.md` (Testing section) and `DECISIONS.md` from the same
folder as RULES.md.

**Scope:** `$ARGUMENTS`. If empty, cover all three suites.

## 1. Current state

- CI: `gh run list --branch main --limit 10`. Record the latest result of the
  `CI` and `Integration & E2E` workflows, and any job that failed and then
  passed on retry (flaky).
- Run locally what is cheap and needs no Docker:
  `cd backend && ./run_tests.sh unit` and `cd frontend && npm run test:coverage`.
  Record the counts, coverage, the random seed each one printed, and how long
  each took.
- Do not run integration or E2E locally unless CI is red or older than the
  last commit that touched tested code. If you do, follow the Docker rules in
  RULES.md.

## 2. Infrastructure, config and patterns

Read the test config and shared helpers: `backend/pytest.ini`,
`backend/.coveragerc`, `backend/tests/conftest.py`,
`backend/tests/unit/conftest.py`, `backend/run_tests.sh`,
`frontend/vite.config.js` (test block), `frontend/src/test/` (setup, server,
router, fixtures), `frontend/playwright.config.js`, `frontend/e2e/helpers.js`.

- Do the configs enforce what CLAUDE.md claims: strict mode, warnings as
  errors, branch coverage at 95% (backend and frontend), random order,
  unhandled MSW requests failing, `act()` warnings failing, `mockReset`?
- Isolation: any test that depends on order, leftover data, wall-clock time,
  real network, or a shared account? Any fixture using `current_app` without
  requesting `app`? E2E: does every test register its own account?
- Speed and scale: slowest tests (`pytest --durations=15`, Vitest's report).
  Will the patterns hold at ten features: fixtures per feature, table-driven
  cases, no copy-paste per case?
- Flakiness: E2E `waitForTimeout`, fixed sleeps, polling without a deadline,
  selectors tied to markup instead of roles and labels.

## 3. Assertion quality

CLAUDE.md requires that every assertion can fail. Search all suites for
violations:
- Assertions behind `if`, inside `try/except`, or after `isVisible()` checks;
  status sets (`in [400, 422]`, `toBeOneOf`); assertions only on mocks being
  called, never on outcomes; snapshots of large markup; `expect(true)`.
- Tests that never assert, or whose only assertion is that nothing threw.
- Frontend tests asserting class names, markup structure or `data-testid`
  instead of roles, labels and text.

**Mutation spot check:** pick at least five places where a bug would hurt
most (auth checks, token rotation, rate-limit keys, input validation, error
handlers, the api client's refresh logic). For each, break the code in a
**scratch git worktree** (`git worktree add <scratchpad>/audit-mut HEAD`, then
change the code there, never in the main tree), run only the relevant tests, and
record whether any test failed. A mutation that survives is a high finding.
Remove the worktree afterward (`git worktree remove --force`).

## 4. Coverage gaps (behavior, not files)

Build an inventory of the behaviors the app promises: every route and its
documented status codes, every error code in `backend/app` (the frontend
`errorBody` list must match), every config guard, every CLAUDE.md claim about
failure handling (Redis down, DB dropped, refresh race, rate limit hit), and
every user journey (register, login, logout, logout-all, refresh, notes create
and paginate, the protected route redirect, the 404 and error pages).

For each behavior, name the test that pins it, at the right level:
- **unit** for logic and route behavior,
- **integration** only for what needs real MySQL or Redis (CLAUDE.md's list),
- **E2E** for full journeys and nginx's promises.

Report behaviors with no test, behaviors tested only at a level that cannot
show the bug (for example, a MySQL-specific behavior tested only on SQLite),
and tests at a heavier level than needed. Lines left uncovered in the coverage
reports are leads, not findings in themselves: report one only if it hides
untested behavior.

## Out of scope
Code changes, and the security quality of the code under test (`/audit-security`).

Write the report as RULES.md describes, with ID prefix `TEST`. Put the counts,
coverage and seeds from step 1 at the top of the report's *Verified* section.
