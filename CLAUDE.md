# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack application template: React (Vite) frontend, Flask backend, MySQL database, Redis (refresh tokens and rate limits), Nginx reverse proxy. Three Docker Compose environments: dev, test, and production.

It ships with **auth** (register/login/logout/refresh with rotating refresh tokens) and a minimal **notes** CRUD feature. The notes feature is a deliberately thin vertical slice — model, schema, routes, service, hook, components, tests — meant to be **replaced** by whatever the real app is. Use it as the worked example of how a feature is wired end to end, then delete it.

## Environment Setup

`.env.dev` and `.env.test` are committed with throwaway values (dev services bind to 127.0.0.1 only), so dev and test run as cloned. Only `.env.prod` is gitignored: copy it from `.env.prod.example`, which lists just the seven per-deployment values (database name, user, passwords, `SECRET_KEY`, and `SERVER_NAME`, the domain nginx serves); hosts, ports and `APP_ENV` are fixed in the compose files. Backend containers get an explicit `environment:` list rather than the whole env file, so `DB_ROOT_PASSWORD` never reaches the running app; only the one-shot `migrate` service holds it. Redis runs with its `default` user disabled; the app connects as the ACL user `app` (`REDIS_USERNAME`), which may touch only its own keys and no `@dangerous` command. `FLASK_DEBUG=0 ./run_dev.sh` overrides the dev file's debug setting for one run. Unit tests need no env file (`UnitTestConfig` requires no MySQL/Redis settings, and `tests/conftest.py` supplies `SECRET_KEY`).

## Development Workflow

**Step 1 — Start DB and Redis (Terminal 1):**
```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml up
```

**Step 2 — Start backend (Terminal 2):**
```bash
cd backend && ./run_dev.sh
```

**Step 3 — Start frontend (Terminal 3):**
```bash
cd frontend && npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api/health

First-time setup: `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements-dev.txt` and `cd frontend && npm install`.

Python dependencies: edit `backend/requirements.in` (runtime) or `requirements-dev.in` (tools), then run `backend/lock_deps.sh` (Docker) to regenerate the pinned `.txt` locks. Never edit the `.txt` files by hand.

## Running Tests

### Backend
```bash
cd backend
./run_tests.sh unit              # Fast, SQLite in-memory, no Docker required
./run_tests.sh integration       # Real MySQL + Redis (spins up docker-compose.test.yml)
./run_tests.sh combined          # All tests with merged coverage report
./run_tests.sh unit --verbose    # Verbose output
./run_tests.sh unit --no-coverage
ruff check .                     # Lint (errors + quote style; CI fails on any finding)
```

### Frontend
```bash
cd frontend
npm run lint          # ESLint (CI fails on any finding)
npm run test          # Watch mode
npm run test:run      # Run once (CI)
npm run test:coverage
npm run test:e2e      # Playwright against dockerized stack (https://localhost:8443)
npm run test:e2e:ui
npm run test:e2e:debug
```

### Running a single backend test
```bash
cd backend
source .venv/bin/activate
pytest tests/unit/test_routes/test_auth_routes.py::TestClassName::test_method_name -v
```

## Custom Commands

Slash commands for quality checks. Run these on demand — never automatically.

| Command | When to run |
|---------|-------------|
| `/security` | After any auth, config, or infra change; before every release |
| `/check-tests` | After adding or modifying any feature |
| `/check-readme` | After significant feature, architecture, or config changes |
| `/check-ignores` | When adding new file types, services, or dependencies |
| `/check-obsolete` | Periodically, or before a release |
| `/check-comments` | Before any PR or release |
| `/check-debug` | Before any PR or release |
| `/check-deps` | After adding/updating dependencies; before every release |
| `/check-env` | After adding new env variables or config classes |
| `/pre-publish` | Before any public release — runs all checks above in sequence |

The instructions for these commands live in `.claude/commands/`. To update a check (e.g., new file patterns to scan, new security rules), edit the corresponding file there.

## Production Build
```bash
docker compose --env-file .env.prod build
docker compose --env-file .env.prod up
```

## Architecture

### Request Flow
Browser → Nginx (port 80/443) → static React assets or `/api/*` proxied to Flask (Gunicorn) → MySQL/Redis

### Backend (`backend/app/`)
- **`__init__.py`** — App factory. Registers all Flask extensions (JWT, SQLAlchemy, Limiter, Redis) and blueprints. There is no CORS: the browser only ever calls a relative `/api`, which is same-origin in every environment (Vite's proxy in dev, nginx elsewhere). The JWT blocklist loader **fails closed**: if Redis is unavailable, every refresh token is treated as revoked rather than valid. The JWT user loader looks up the token's user on every `@jwt_required` request and answers 401 if the account no longer exists; routes read it as `flask_jwt_extended.current_user`, never from `get_jwt_identity()`.
- **`config.py`** — Config classes per environment (`DevelopmentConfig`, `UnitTestConfig`, `IntegrationConfig`, `ProductionConfig`). Controls DB URI, Redis usage, rate limiting, JWT settings, and `TRUSTED_PROXY_COUNT` (Production trusts one proxy, nginx, so rate limits key on the real client IP). `APP_ENV` is the only switch that selects a config class — no other env var may promote or demote one. `ProductionConfig` rejects a `SECRET_KEY` under 32 characters or equal to the template placeholder, and the example file's placeholder passwords. `MAX_CONTENT_LENGTH` caps request bodies at 16 KB (nginx enforces the same). Rate-limit counters fall back to per-worker memory while Redis is down.
- **`routes/`** — API blueprints: `auth` (login/register/logout/logout-all/refresh, plus clear-cookies for when logout itself fails; logout is best effort, but logout-all answers 503 if Redis could not revoke the sessions, since that is its whole effect), `health` (unlimited, like every route without its own limit: only login, register and refresh declare one, since a per-IP quota on the whole API would lock out users sharing an address. Login is limited loosely per IP and tightly per account, refresh per user, register per IP), `notes` (the example CRUD feature; `GET` is cursor-paginated, newest first: `?before=<next_cursor>&limit=`, and the frontend's `useNotes` exposes `loadMore`/`hasMore`. Keep that pattern, with an index on the owner and id like `Note`'s `(user_id, id)`, for any list that grows).
- **`models/`** — SQLAlchemy ORM models, one singular module per model (`user.py` → `User`, `note.py` → `Note`). Auth logic lives on the User model. A column's size is a named constant beside it (`EMAIL_MAX_LENGTH`, `NOTE_MAX_LENGTH`) that the schemas import; migrations keep literal sizes, since each is a snapshot. Timestamps are UTC: the MySQL connection's time zone is pinned to it, and since DATETIME comes back naive, a response schema states the zone when serializing (`NoteResponse.created_at`), or browsers read it as local time.
- **`schemas/`** — Pydantic schemas for request validation. Schema and route modules are named after the API resource (`auth`, `notes` → `/api/notes`).
- **`utils/`** — Redis service (refresh-token allowlist: one sorted set per user, JTI scored by expiry, at most `MAX_SESSIONS_PER_USER` = 10 with the oldest evicted; refresh swaps old for new in one Lua script run inside Redis, so a refresh token rotates exactly once: of two requests racing with the same token, the second gets 401 `AUTH_TOKEN_REVOKED`, never a second session. The app's instance lives on `app.extensions["redis_service"]`, read it with `get_redis_service()`, never import it). The app's and the rate limiter's Redis clients share `REDIS_CLIENT_OPTIONS` (2s timeouts, one immediate retry) so a Redis outage fails fast instead of hanging requests, and login/refresh answer 503 when the new refresh token cannot be recorded. `errors.py` holds `error_response`, which builds the `{"error": {"code", "message"}}` body that every route and the error handlers in `__init__.py` return. User text is stored **verbatim**, markup included; output safety is the render layer's job (React escapes text by default). Never render user text with `dangerouslySetInnerHTML` without sanitizing it there.
- **`migrations/`** — Alembic migrations for MySQL. `0001_users` is the auth table every app keeps; `0002_notes` belongs to the example feature and is deleted with it, so a new app's migrations chain straight onto `0001_users`.

### Frontend (`frontend/src/`)
- **`api/`** — Centralized Axios instance + service modules (auth, health, notes). All backend calls go through here.
- **`contexts/`** — `AuthProvider` holds global auth state (user, tokens, login/logout); `AuthContext` is the bare context, in its own file so fast refresh keeps working.
- **`hooks/`** — `useAuth`, `useHealth`, `useNotes`.
- **`utils/`** — `validation.js` (shared field validators), `storage.js` (token storage; see the comment there on the accepted localStorage XSS trade-off).
- **`components/`** — `layout/` (Navbar, LogoutDropdown), `notes/` (the example feature), `health/` (`ApiStatus`, the home page's API-status demo, removable like notes). Each with co-located unit tests in `__tests__/`.
- **`pages/`** — `HomePage`, `LoginPage`, `RegisterPage`, `NotesPage`.
- **`e2e/`** — Playwright tests for full user journeys. Shared steps (register, log in, unique emails) live in `e2e/helpers.js`.

### Test Architecture
- **Backend unit tests** (`tests/unit/`): `UnitTestConfig` uses SQLite in-memory, disables Redis and rate limiting. Route tests live here too — they need no real services. Refresh-cookie routes (`/refresh`, `/logout`, `/logout-all`) fail closed without Redis, so their tests use the `fake_redis` fixture. Fixtures in `tests/conftest.py`.
- **Backend integration tests** (`tests/integration/`): `IntegrationConfig` connects to real MySQL (port 3307) and Redis (port 6380) from `docker-compose.test.yml`, via the `integration_*` fixtures. Reserve these for behavior that genuinely needs a real service.
- **Frontend unit tests**: Vitest + jsdom. Most tests `vi.mock` the service modules; `api/__tests__/api.test.js` (interceptors, token refresh) and `test/integration/auth-flow.test.jsx` run MSW servers against the real Axios client. Setup in `src/test/setup.js`.
- **E2E tests**: Playwright against the full stack via `docker-compose.test.yml` with the `e2e` profile. Ignores self-signed TLS cert errors. E2E runs against the **test** stack, never the production compose file.

### Nginx (`nginx/`)
- **`templates/default.conf.template`** — rendered at container start with `NGINX_SERVER_NAME` (prod compose sets it from `SERVER_NAME`; only `NGINX_*` variables are substituted). A catch-all server drops any other Host or a bare IP. HTTP→HTTPS redirect, TLS, SPA routing (HTML is `no-cache`; Vite's content-hashed `/assets/` are cached for a year), `/api` proxy, 16 KB body cap, per-IP `limit_req`/`limit_conn` on `/api` only (static assets are unlimited, since HTTP/2 counts every stream as a connection). Upstream 5xx, 413 and 429s get JSON bodies in the API's error shape, keeping the original status.
- **`nginx.conf`** — the `backend` upstream re-resolves through Docker's DNS, so a recreated backend container is picked up without restarting nginx.
- **`security_headers.conf`** — shared security headers. Every location includes it, because a location that declares its own `add_header` inherits none from the server block.
- **`templates/00-rate-limits.conf.template`** — rate-limit zones rendered from `NGINX_AUTH_RATE`/`NGINX_API_RATE` at container start. Production defaults are in `nginx/Dockerfile`; `docker-compose.test.yml` relaxes the auth rate for E2E.

### Docker Compose Files
Each file names its own Compose project (`app_dev`, `app_test`, `app`), so the stacks never share containers or volumes and can run side by side. Names follow one pattern: production gets the bare name, other environments a suffix (`appdb` / `appdb_dev` / `appdb_test`). The app's MySQL and Redis users are both `app` in dev and test.

| File | Purpose |
|------|---------|
| `docker-compose.dev.yml` | Dev: MySQL + Redis only (backend/frontend run locally), bound to 127.0.0.1 |
| `docker-compose.test.yml` | Test: isolated MySQL (3307) + Redis (6380); `e2e` profile adds migrate + backend + Nginx, hardened like production |
| `docker-compose.yml` | Production: all services with resource limits, health checks, explicit stop grace periods and hardening (`no-new-privileges`, pids limits; backend read-only with no capabilities). MySQL/Redis on an `internal` network that nginx cannot reach. A one-shot `migrate` service applies migrations as root, then `backend/restrict_db_user.py` leaves `DB_USER` with `SELECT, INSERT, UPDATE, DELETE` only; the backend starts after it succeeds. Gunicorn runs 2 gthread workers × 4 threads (workers from `WEB_CONCURRENCY`); each worker hashes at most `PASSWORD_HASH_CONCURRENCY` = 2 passwords at once, so a login burst can't take every thread, and a login that waits too long for a slot gets a 503 |

## Naming Conventions

How each environment's names line up. Production gets the bare name; every other environment adds a suffix.

| Environment | Env file | `APP_ENV` | Config class | Compose project | Database |
|---|---|---|---|---|---|
| Development | `.env.dev` | `development` | `DevelopmentConfig` | `app_dev` | `appdb_dev` |
| Unit tests | none | `unit` | `UnitTestConfig` | none | in-memory SQLite |
| Integration tests | `.env.test` | `integration` | `IntegrationConfig` | `app_test` | `appdb_test` |
| E2E | `.env.test` | `integration`, plus `E2E_MODE=true` | `IntegrationConfig` | `app_test` (`e2e` profile) | `appdb_test` |
| Production | `.env.prod` | `production` | `ProductionConfig` | `app` | `appdb` (set per deployment) |

- **Env vars:** the app reads `DB_*` for the database and `REDIS_*` for Redis. `MYSQL_*` appears only inside the compose `db` services, as the MySQL image's own keys. The app's database and Redis users are both `app` in dev and test.
- **`.env.prod`, not `.env`:** Compose reads a `.env` in the project directory automatically, so production values in a bare `.env` would leak into every dev and test command.
- **Singular for one thing, plural for a collection.** Model classes and model modules are singular (`Note`, `models/note.py`); tables are plural (`notes`). Names that handle one item are singular (`NoteForm`, `NoteCreateRequest`, `NoteResponse`); names that handle many are plural (`NotesList`, `NotesListQuery`, `NotesPage`). Route and schema modules take the API resource's name (`notes` for `/api/notes`), and test files are named after the module they test (`test_notes_schemas.py`).

## Starting a New App From This Template

1. Replace the notes slice: `backend/app/models/note.py`, `backend/app/{schemas,routes}/notes.py`, `backend/migrations/versions/0002_notes.py`, `frontend/src/{api/services,hooks,components,pages}` notes files, and their tests.
2. Remove the API-status demo on the home page, unless you want it: delete `frontend/src/components/health/`, `hooks/useHealth.js`, `api/services/healthService.js` and `styles/components/api-status.css` with their tests, the `api-status.css` import in `styles/base/index.css`, and `<ApiStatus />` and its `vi.mock` in `HomePage`. Keep the backend's `/api/health`: the Docker healthchecks and Playwright wait on it.
3. Update `Note` references in `backend/tests/conftest.py` fixtures.
4. Update `frontend/src/utils/validation.js` (the note-length validators).
5. Update the nav link in `frontend/src/components/layout/Navbar.jsx` and the post-login redirects in `LoginPage`/`RegisterPage`.
6. Generate an Alembic migration for the new tables (`flask db migrate`); it chains onto `0001_users`.
7. Rename the Compose projects (`name:` at the top of each compose file: `app_dev`, `app_test`, `app`) and the databases in `.env.dev`/`.env.test` (`appdb_dev`, `appdb_test`), so two apps built from this template never share containers or volumes.
8. Rewrite this file and `README.md` for the new app.
