---
name: audit-security
description: Security review against OWASP ASVS Level 2 and the Cheat Sheets (code, config, containers), dependency vulnerabilities and unused packages, and a local scan of the running test stack. Live checks against a deployment are skipped until one exists.
argument-hint: "[code|deps|scan]"
disable-model-invocation: true
context: fork
---

# /audit-security

First read `.claude/skills/_audit-shared/RULES.md` and follow it throughout.
Then read `CLAUDE.md`, plus `SOURCES.md` (Cross-cutting: security, and each
layer's section) and `DECISIONS.md` from the same folder as RULES.md.
DECISIONS.md's accepted trade-offs matter most here: do not re-report them.

**Scope:** `$ARGUMENTS`. If empty, run all three parts.

Think like an attacker with the source code. For every finding, give the
attack (who, from where, doing what, gaining what), not just the weakness.

## 1. code: application and configuration review

Read all of `backend/app/`, `frontend/src/` (except tests), `nginx/`, the
Dockerfiles and compose files. Walk the ASVS Level 2 chapters that apply to
this app and record what each one turns up:

- **Authentication and sessions:** password policy and NFKC handling,
  hashing parameters and the concurrency limit, login timing, rate limits per
  IP and per account (key functions, `normalize_email`, ProxyFix with
  `TRUSTED_PROXY_COUNT`), access and refresh token lifetimes, rotation (the
  Lua script, the race), revocation, `logout-all`, the session cap, cookie
  flags (`Secure`, `HttpOnly`, `SameSite`, path), CSRF double-submit on
  refresh, `clear-cookies`, what happens to sessions when a user is deleted.
- **Access control:** every route that touches user data requires a token
  and scopes queries to `current_user` (try reading or paginating another
  user's notes via the cursor). Nothing reads identity from
  `get_jwt_identity()`.
- **Input and output:** every request body and query passes through a Pydantic
  schema; size limits at nginx and Flask; email and password normalization;
  no raw SQL with interpolation; no `dangerouslySetInnerHTML`; no
  `eval`/`subprocess`/`os.system` in app code; error responses leak no stack
  traces, SQL, or internal hostnames.
- **Secrets:** nothing secret in git history
  (`git log -p --all -S 'SECRET_KEY=' -- . ':!*.example' ':!.env.dev' ':!.env.test'`
  plus a scan for key-shaped strings), `ProductionConfig`'s secret checks,
  root DB password reaching only `migrate`, secrets never logged (grep the
  logging calls).
- **Transport and headers:** TLS config, HSTS, CSP, frame, referrer,
  permissions and content-type headers; HTTP→HTTPS; the catch-all host.
- **Containers and Redis:** non-root users, capabilities, read-only roots,
  networks (can nginx reach MySQL? should it?), exposed ports, the Redis ACL,
  and the MySQL privileges left after `restrict_db_user.py`.
- **Denial of service:** body limits, connection limits, hashing slots, slow
  clients, unbounded queries or lists, Redis memory growth.
- **What is missing:** ASVS L2 requirements the app neither meets nor has
  recorded in DECISIONS.md. Report each one as a gap with its ASVS number.

## 2. deps: dependencies

- Python: `pip-audit -r backend/requirements.txt` and
  `pip-audit -r backend/requirements-dev.txt` (if `pip-audit` isn't
  installed in the venv, run it with `pipx run pip-audit`, or install it into
  a throwaway venv in your scratch directory, never into the project venv).
- JavaScript: `npm audit` in `frontend/` (all deps) and `npm audit --omit=dev`
  (what ships).
- Dependabot: `gh api repos/{owner}/{repo}/dependabot/alerts --jq '.[] | select(.state=="open")'`
  and open Dependabot PRs (`gh pr list --author app/dependabot`).
- Images: are the pinned base images (Dockerfiles, compose files, the
  hadolint digest in CI) current releases of supported versions?
- Unused or misplaced packages: compare `requirements.in` and
  `package.json` against actual imports (`backend/app`, `frontend/src`), config
  files and scripts. A package used only by tests belongs in the dev lists.

A critical or high CVE in something that ships is a blocker. Dev-only CVEs are
rated by whether they can reach CI or a developer's machine.

## 3. scan: the running test stack

Bring up the E2E stack (follow the Docker rules in RULES.md; generate
self-signed certs in `nginx/certs/` only if none exist, as the E2E CI job does):
`docker compose --env-file .env.test -f docker-compose.test.yml --profile e2e up -d --build --wait`.
Then, against `https://localhost:8443` only:

- **Headers and TLS:** `curl -skI` on `/`, `/assets/<a real asset>`, `/api/health`,
  an unknown path, and an unknown Host header. Use testssl.sh via Docker if
  available (`docker run --rm --network host drwetter/testssl.sh localhost:8443`;
  on Docker Desktop, use `host.docker.internal:8443`).
- **ZAP:** a full active scan is acceptable here, since the stack is
  throwaway. `docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py -t https://host.docker.internal:8443 -I`
  (fall back to `zap-baseline.py` if the full scan exceeds 20 minutes).
  Triage every alert. Most will be false positives for an SPA plus JSON API;
  report only what holds up, with the request that shows it.
- **Hand probes** the scanners can't do: replay a rotated refresh token,
  send a refresh without the CSRF header, read another user's notes via the
  cursor, exceed the login limit for one account from rotating
  `X-Forwarded-For` values, send a 17 KB body, send malformed JSON, and log in
  with a password that differs only by Unicode normalization.

Tear the stack down when done.

**Skipped until deployed** (list under *Skipped*): Observatory and SSL Labs
against the real domain, Docker Bench and CIS on the host, SSH, firewall and
Fail2ban drift. The OWASP Testing Checklist and WSTG items that need a real
deployment go here too.

## Out of scope
Fixing anything. Infra style and simplicity (`/audit-infra`).

Write the report as RULES.md describes, with ID prefix `SEC`. For each
finding, include the ASVS requirement or cheat sheet it comes from, if any.
