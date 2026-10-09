---
name: audit-infra
description: Review config and infrastructure at every layer (env, nginx, Docker/Compose, Flask, MySQL, Redis, React build, CI) for correctness, security, simplicity and template-readiness, plus performance bottlenecks. The daily check.
argument-hint: "[layer: env|nginx|docker|flask|mysql|redis|frontend|ci|perf]"
disable-model-invocation: true
context: fork
---

# /audit-infra

First read `.claude/skills/_audit-shared/RULES.md` and follow it throughout.
Then read `CLAUDE.md`, plus `SOURCES.md` and `DECISIONS.md` from the same
folder as RULES.md.

**Scope:** `$ARGUMENTS`. If empty, cover every layer below. If it names
layers, cover only those.

For each layer: read every file listed, check each CLAUDE.md claim about that
layer against the code, compare the layer with its SOURCES.md section, then
work through the questions. The questions are starting points, not the limit.
Report anything a senior engineer would flag on review.

## Layers

### env: environment and config selection
Files: `.env.dev`, `.env.test`, `.env.prod.example`, `backend/app/config.py`,
`backend/wait_for_services.py`, `backend/restrict_db_user.py`, every
`environment:` block in the three compose files, `.gitignore`, `.dockerignore`,
`backend/.dockerignore`.
- Is every variable in an env file read by something (`os.getenv`, or `${VAR}`
  in a compose file)? Is any set to its code default (redundant)?
- Does every variable the app requires reach it in each environment
  (CLAUDE.md's Naming Conventions table)? Are they listed explicitly, never via
  `env_file:`? Does only the `migrate` service get the root password?
- Does `APP_ENV` alone select the config class? Can anything else promote or
  demote one? Does `ProductionConfig` reject weak or placeholder secrets, and
  is that tested?
- Do `.env.dev` and `.env.test` hold only obviously throwaway values? Is
  `.env.prod` untracked (`git ls-files .env.prod` empty)?
- Ignores: does each ignore file cover what exists in this repo (venvs, caches,
  coverage, reports, certs, `.env.prod`, keys) and nothing speculative? Do
  Docker build contexts exclude env files, tests and certs? Run
  `git status --porcelain --ignored` and flag sensitive-looking files.

### nginx
Files: `nginx/` (Dockerfile, `nginx.conf`, `proxy_params.conf`,
`security_headers.conf`, `templates/`).
- Compare TLS settings with the Mozilla "intermediate" profile, and headers and
  caching with h5bp `server-configs-nginx`. Is the CSP as strict as the
  built app allows (check `frontend/index.html` and the build output for inline
  scripts and styles)?
- Does every `location` that sets `add_header` include `security_headers.conf`?
- Body cap, rate and connection limits, and JSON error bodies: consistent with
  Flask's limits and the API's error shape?
- Catch-all server, HTTP→HTTPS redirect, upstream re-resolution, timeouts and
  keepalive in line with gunicorn's settings?

### docker: images and Compose
Files: `backend/Dockerfile`, `backend/entrypoint.sh`, `nginx/Dockerfile`,
`docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.test.yml`.
- Base images pinned and current (MySQL, Redis, Python, Node, nginx all
  supported releases)? Multi-stage builds, non-root users, minimal layers?
- Production: health checks on every service, restart policies, resource
  limits, `stop_grace_period` ≥ the app's graceful timeout, log rotation,
  `no-new-privileges`, `cap_drop`, `read_only` where possible, and an
  `internal` network that nginx cannot reach?
- Does the test stack mirror production's hardening, so E2E catches breakage?
- Are dev, test and production consistent in naming (CLAUDE.md table) and
  image versions?

### flask: application
Files: `backend/app/__init__.py`, `config.py`, `routes/`, `utils/`, `wsgi.py`,
`backend/requirements.in`.
- Do app factory, extension setup, error handlers and the JWT loaders match
  CLAUDE.md (fail closed, user loader, error shape)?
- Are timeouts, pool settings and Redis client options set so an outage fails
  fast instead of hanging?
- Is anything example-feature specific leaking into shared code?

### mysql
Files: `backend/app/models/`, `backend/migrations/`, the `db` services.
- Indexes for every query pattern (grep the routes for filters and orderings),
  constraints and `ON DELETE` behavior, column sizes matching the named
  constants, UTC session time zone, `pool_pre_ping` or recycle settings.
- Do migrations match the models (`test_migrations.py` checks this; is it
  green in CI)? Least-privilege DB user after `restrict_db_user.py`?
- MySQL server settings worth setting explicitly (character set, SQL mode)?
  Startup warnings: run the test stack's `db` and read `docker compose logs db`.

### redis
Files: `backend/app/utils/redis_service.py` (and the rest of `utils/`), the
`redis` services.
- ACL user scope (key patterns, `-@dangerous`), `noeviction`, `maxmemory`,
  persistence settings in production vs what losing Redis would cost
  (sessions and rate limits), key TTLs so nothing grows without bound.

### frontend: build and runtime config
Files: `frontend/vite.config.js`, `package.json`, `index.html`,
`eslint.config.js`, `jsconfig.json`, `src/main.jsx`, `src/routes.jsx`,
`src/api/api.js`.
- Production build: run `npm run build` in `frontend/` and look at the output
  sizes. Are there source maps, dev-only code or unused dependencies in the
  bundle?
- Does `package.json` have runtime vs dev dependencies in the right place,
  engines pinned, and scripts that match CLAUDE.md?

### ci: workflows and supply chain
Files: `.github/workflows/`, `.github/dependabot.yml`, `backend/lock_deps.sh`,
`backend/requirements*.in/.txt`.
- Actions pinned by SHA, least `permissions:`, `persist-credentials: false`,
  timeouts, no untrusted input interpolated into `run:`?
- Does every check CLAUDE.md says CI runs actually run? Is anything run twice?
- Read the latest runs (`gh run list --branch main --limit 10`). Any red,
  flaky (failed then passed on retry), or slow jobs?

### perf: bottlenecks
- Request path cost: queries per request (N+1), missing indexes, unbounded
  lists, password hashing cost vs worker and thread counts
  (`PASSWORD_HASH_CONCURRENCY`, `WEB_CONCURRENCY`), Redis round trips per
  request, nginx buffering and keepalive.
- Frontend: bundle size, waterfalls, polling intervals, re-renders on hot
  paths.
- Estimate the first bottleneck under load (which resource saturates first,
  roughly at what request rate) and whether the template documents how to
  scale past it. Do not load-test beyond a few dozen requests against the
  local test stack.

## Out of scope
Code-level security review and dependency CVEs (`/audit-security`), tests
(`/audit-tests`), comments and dead code (`/audit-code`), README and CLAUDE.md
prose accuracy (`/audit-docs`). Note anything you spot in passing under
*Unverified / Skipped* as "for /audit-…", without investigating.

Write the report as RULES.md describes, with ID prefix `INFRA`.
