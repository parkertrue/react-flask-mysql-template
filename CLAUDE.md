# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack application template: React (Vite) frontend, Flask backend, MySQL database, Redis (refresh tokens and rate limits), Nginx reverse proxy. Three Docker Compose environments: dev, test, and production.

It ships with **auth** (register/login/logout/refresh with rotating refresh tokens) and a minimal **notes** CRUD feature (list, create, edit in place, delete). The notes feature is a deliberately thin vertical slice — model, schema, routes, service, hook, components, tests — meant to be **replaced** by whatever the real app is. Use it as the worked example of how a feature is wired end to end, then delete it (on the frontend, one folder: `features/notes/`).

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
ruff check .                     # Lint (errors, quote style, no print or commented-out code; CI fails on any finding)
```

### Frontend
```bash
cd frontend
npm run lint          # ESLint, no console outside tests, no raw form controls outside FormField (CI fails on any finding)
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

## Audits

Skills in `.claude/skills/` that audit the template, run on demand only, never automatically. Each check runs in its own subagent, changes nothing, and writes its findings to `temp/audits/YYYY-MM-DD-<check>.md`, comparing them with its previous report.

| Command | Covers | When to run |
|---|---|---|
| `/audit-infra [layer]` | Config and infrastructure at every layer, bottlenecks | Daily, or after any config or infra change |
| `/audit-tests` | Test infrastructure and patterns, then coverage gaps; mutation spot checks | After a feature lands |
| `/audit-security` | ASVS L2 code review, dependency CVEs, scans of the local test stack | After auth, config or dependency changes |
| `/audit-recovery` | Failure drills on a throwaway production-config stack; restore and compromise readiness | After infra changes |
| `/audit-code` | Comments, dead code, debug leftovers, naming consistency | Before a PR |
| `/audit-a11y` | WCAG 2.2 AA beyond what axe catches | After UI changes |
| `/audit-docs` | README and CLAUDE.md against the code | After significant changes |
| `/audit-scaffold` | Acts out "Starting a New App" in a throwaway worktree | After structural changes |
| `/audit <tier>` | Runs a tier (`daily`, `periodic`, `ops`, `release`) and merges the reports | `release` before publishing |

Shared material lives in `.claude/skills/_audit-shared/`: `RULES.md` (what every check follows: CLAUDE.md is the spec, read-only boundaries, severity, report format), `SOURCES.md` (the outside standards each layer is measured against), and `DECISIONS.md` (accepted trade-offs and known gaps, so audits stop re-reporting them). When a finding is kept on purpose, record it in `DECISIONS.md`; when a finding could be caught mechanically, add the lint rule, test or CI job instead of more prompt text.

## Production Build
```bash
docker compose --env-file .env.prod build
docker compose --env-file .env.prod up
```

## Architecture

### Request Flow
Browser → Nginx (port 80/443) → static React assets or `/api/*` proxied to Flask (Gunicorn) → MySQL/Redis

### Backend (`backend/app/`)
- **`__init__.py`** — App factory. Registers all Flask extensions (JWT, SQLAlchemy, Limiter, Redis) and blueprints. There is no CORS: the browser only ever calls a relative `/api`, which is same-origin in every environment (Vite's proxy in dev, nginx elsewhere). The JWT blocklist loader **fails closed**: if Redis is unavailable, every refresh token is refused, with a 503 `SERVICE_UNAVAILABLE` rather than a revocation, so clients keep their session and retry instead of signing the user out. The JWT user loader looks up the token's user on every `@jwt_required` request and answers 401 if the account no longer exists; routes read it as `flask_jwt_extended.current_user`, never from `get_jwt_identity()`. Every response gets `Cache-Control: no-store` unless the route sets its own, since API bodies carry tokens and private data.
- **`config.py`** — Config classes per environment (`DevelopmentConfig`, `UnitTestConfig`, `IntegrationConfig`, `ProductionConfig`). Controls DB URI, Redis usage, rate limiting, JWT settings, and `TRUSTED_PROXY_COUNT` (Production trusts one proxy, nginx, so rate limits key on the real client IP). `APP_ENV` is the only switch that selects a config class — no other env var may promote or demote one. `ProductionConfig` rejects a `SECRET_KEY` under 32 characters or equal to the template placeholder, and the example file's placeholder passwords. `MAX_CONTENT_LENGTH` caps request bodies at 16 KB (nginx enforces the same). Rate-limit counters fall back to per-worker memory while Redis is down. MySQL calls time out (connect 5s, each query 15s, set by `DB_QUERY_TIMEOUT`), so a hung database frees request threads well before nginx's 60s; the `migrate` service sets it to 0, since a migration may run longer. The backend's `dns_opt` caps a lookup of a stopped container at 1s.
- **`routes/`** — API blueprints: `auth` (login/register/logout/logout-all/refresh, plus clear-cookies for when logout itself fails; logout is best effort, but logout-all answers 503 if Redis could not revoke the sessions, since that is its whole effect. A session ends 30 days after login however often it refreshes: the refresh token's `auth_time` claim is carried through every rotation and caps its expiry. The refresh cookie is `__Secure-refresh_token`, so it is `Secure` in every environment; browsers accept that on `http://localhost`), `health` (unlimited, like every route without its own limit: only login, register and refresh declare one, since a per-IP quota on the whole API would lock out users sharing an address. Login is limited loosely per IP, tightly per account and IP (5 failures a minute, so a stranger's wrong guesses lock out only the stranger's address) and loosely per account alone (100 failures an hour); only failed logins count toward the account limits. Refresh is limited per user, register per IP), `notes` (the example CRUD feature; `GET` is cursor-paginated, newest first: `?before=<next_cursor>&limit=`, and the frontend's `useNotes` exposes `loadMore`/`hasMore`. Keep that pattern, with an index on the owner and id like `Note`'s `(user_id, id)`, for any list that grows. `PUT`/`DELETE /api/notes/<id>` edit and delete one note through `get_own_note_or_404`, so another user's note is a 404 exactly like a missing one; copy that helper for any owned resource).
- **`models/`** — SQLAlchemy ORM models, one singular module per model (`user.py` → `User`, `note.py` → `Note`). Auth logic lives on the User model. A column's size is a named constant beside it (`EMAIL_MAX_LENGTH`, `NOTE_MAX_LENGTH`) that the schemas import; migrations keep literal sizes, since each is a snapshot. Timestamps are UTC: the MySQL connection's time zone is pinned to it, and since DATETIME comes back naive, a response schema states the zone when serializing (`NoteResponse.created_at`), or browsers read it as local time.
- **`schemas/`** — Pydantic schemas for request validation. Schema and route modules are named after the API resource (`auth`, `notes` → `/api/notes`). `auth.py` accepts only a plain `local@domain` email whose local part is ASCII (deliverable without SMTPUTF8) and stores it in ASCII form (`bücher.de` → `xn--bcher-kva.de`); `normalize_email` is the one canonical form, which the login rate limit keys on too. Passwords are NFKC-normalized before the length checks and hashing, at register and login alike; both refuse spaces, but only registration applies the strength rules (length, letter case, a number). Every free-text field (passwords, note content) must pass `utils/text.py`'s `is_plain_text`: letters, marks, numbers, punctuation, math/currency/modifier symbols and spaces, inside the Basic Multilingual Plane, so no emoji, no © or °, and no control or zero-width characters. Staying in the BMP makes every character one UTF-16 unit, so the frontend counts with plain `.length` and the native `maxLength`; apply the same check to any new text field. `frontend/src/utils/validation.js` mirrors all of this (`hasUnsupportedCharacters`).
- **`utils/`** — Redis service (refresh-token allowlist: one sorted set per user, JTI scored by expiry, at most `MAX_SESSIONS_PER_USER` = 10 with the oldest evicted; refresh swaps old for new in one Lua script run inside Redis, so a refresh token rotates exactly once: of two requests racing with the same token, the second gets 401 `AUTH_TOKEN_REVOKED`, never a second session. The app's instance lives on `app.extensions["redis_service"]`, read it with `get_redis_service()`, never import it). The app's and the rate limiter's Redis clients share `REDIS_CLIENT_OPTIONS` (2s timeouts, one immediate retry), and once Redis proves unreachable `RedisService` stops calling it for `RECONNECT_INTERVAL_SECONDS`, so an outage fails fast instead of hanging requests (looking up a stopped container's name alone can take seconds). Login/refresh answer 503 when the new refresh token cannot be recorded. `errors.py` holds `error_response`, which builds the `{"error": {"code", "message"}}` body that every route and the error handlers in `__init__.py` return. User text is stored **verbatim**, markup included; output safety is the render layer's job (React escapes text by default). Never render user text with `dangerouslySetInnerHTML` without sanitizing it there.
- **`migrations/`** — Alembic migrations for MySQL. `0001_users` is the auth table every app keeps; `0002_notes` belongs to the example feature and is deleted with it, so a new app's migrations chain straight onto `0001_users`.

### Frontend (`frontend/src/`)
Organized by feature. Imports point one way: `routes.jsx` and `pages/` use `features/`, and both use the shared folders (`auth/`, `api/`, `components/`, `utils/`); shared code never imports a feature, and features never import each other. Import with the `@/` alias for `src/` (`vite.config.js`; `jsconfig.json` tells the editor), and prefer a React or React Router built-in to hand-written code whenever one fits.
- **`main.jsx` / `routes.jsx`** — `createBrowserRouter` over the route objects in `routes.jsx`, inside `AuthProvider`. `ProtectedRoute` and `GuestRoute` are pathless parent routes: nest a page under one to guard it. Each route level has an `errorElement` (`ErrorPage`), so a page that throws shows an error under the navbar instead of a blank screen; unknown paths get `NotFoundPage`.
- **`appName.js`** — `APP_NAME`, the app's one name. `PageTitle` and the home page's `h1` use it, and unit and E2E tests build their expected text from it.
- **`auth/`** — everything auth, kept by every app: `storage.js` (token storage, the one copy of the session; see the comment there on the accepted localStorage XSS trade-off), `AuthProvider` (reads storage with `useSyncExternalStore`, so a session ended by the api client or another tab re-renders the app at once, with no page reload), `AuthContext` (in its own file so fast refresh keeps working), `useAuth`, `authService`, the route guards (`ProtectedRoute` remembers the page, `GuestRoute` returns there after login, else to `AFTER_LOGIN_PATH`), and `LogoutButton`.
- **`api/`** — the centralized Axios instance (`api.js`: token refresh, CSRF header) and `getErrorMessage`. All backend calls go through it, via a service module beside the code that uses it (`auth/authService.js`, `features/notes/notesService.js`).
- **`features/`** — one folder per feature, holding its service, hook, page, components, CSS (imported by its components) and tests, so removing one is deleting a folder plus its route. `notes/` is the example; `health/` is the home page's API-status demo (`ApiStatus`), removable like notes.
- **`pages/`** — the pages every app keeps: `HomePage`, `LoginPage`, `RegisterPage`, `AccountPage` (reached from the navbar's email link; holds "Logout All Devices", and is where account settings such as account deletion belong), `NotFoundPage`, `ErrorPage`.
- **`components/`** — shared UI: `layout/` (`Layout`, `Navbar`, `PageTitle`), `forms/` (`FormField`, whose children sit on the input's line, as a one-line form's buttons do; `useFormFields`, with `reset` to clear a form after it saves) and `dialogs/` (`ConfirmDialog`, a yes/no question on the native modal `<dialog>`; ask with it before anything that cannot be undone, as deleting a note does).
- **`utils/`** — `validation.js` (the auth field validators); a feature keeps its own (`features/notes/validation.js`).
- **`styles/`** — global CSS: `tokens.css` (the color palette; every pairing meets WCAG AA contrast, keep it that way), then reset, base and shared components, then page styles.
- **`e2e/`** — Playwright tests for full user journeys. Shared steps (register, log in, log out, unique emails) live in `e2e/helpers.js`.

**Accessibility (WCAG 2.2 AA)** is a requirement, not a polish step. Every page renders a `<PageTitle>` and one `h1`. Form fields go through `FormField` (label, hint and message tied to the input with `aria-describedby`, `autoComplete` set; lint refuses a raw `<input>`, `<textarea>` or `<select>` anywhere else), and a live limit such as a character counter is its hint; forms are `noValidate`, so the app's own messages show, and a failed submit focuses the first invalid field. Messages that appear after an action use `role="alert"` (errors) or `role="status"`. An outcome shown only visually (a note added, saved or deleted) is announced on one persistent, `.visually-hidden` `role="status"` line, as `NotesPage` does: a live region must be in the page before its text changes. When a control that has focus goes away (the last "Load more"), move focus to what replaced it. While busy, mark controls `aria-disabled` or `readOnly` rather than `disabled`, which drops keyboard focus, and guard the handler instead; a busy button keeps full contrast, its label ("Saving...") saying what it is doing. `Layout` moves focus to the new page's `h1` on navigation (a screen reader reads it, naming the page), or to `<main>` on a page without one. Colors come from `tokens.css`. `e2e/accessibility.spec.js` runs axe on every page.

### Test Architecture
Every assertion must be able to fail: never accept a set of statuses (`in [400, 422]`), assert behind an `if`, or wrap an `assert` in `try/except`. Pin the one answer the code gives. Mutation-check a new test (break the code, watch it fail) before trusting it.
- **Backend unit tests** (`tests/unit/`): `UnitTestConfig` uses SQLite in-memory, disables Redis and rate limiting. Route tests live here too — they need no real services. The app treats a missing token store as an outage (login and refresh answer 503), so every test of the unit app gets the in-memory `fake_redis` automatically (`tests/unit/conftest.py`); request `no_redis` to test the outage. Shared fixtures in `tests/conftest.py`. `pytest.ini` makes a bare `pytest` run these only, turns on pytest's strict mode, and fails on any warning. `.coveragerc` measures branches and fails unit runs below 95%. `pytest-randomly` runs the tests in a new order each time, so a test that leans on another's leftovers fails: replay an order with the seed from the header (`pytest --randomly-seed=<seed>`). Any fixture whose code uses `current_app` must request `app`, not rely on another test having created it.
- **Backend integration tests** (`tests/integration/`): `IntegrationConfig` connects to real MySQL (port 3307) and Redis (port 6380) from `docker-compose.test.yml`, via the `integration_*` fixtures. Reserve these for behavior that genuinely needs a real service, which SQLite cannot show: column sizes, case-insensitive email matching, `ON DELETE CASCADE`, the UTC session time zone, dropped pooled connections, the Redis token store and rate-limit counters under the app's ACL user, and the migrations themselves (`test_migrations.py` upgrades an empty database and fails if the models have drifted from them).
- **Frontend unit tests**: Vitest + jsdom. Most tests `vi.mock` the service modules; `api/__tests__/api.test.js` (interceptors, token refresh) and `test/integration/auth-flow.test.jsx` run MSW against the real Axios client via `setupMswServer` (`src/test/server.js`), which fails any unhandled request. Shared fake API responses come from `src/test/fixtures.js` (`errorBody`, `tokens`); `errorBody` refuses an error code the backend never sends, and a test keeps that list in sync with `backend/app`. A feature keeps its own in `__tests__/fixtures.js` (`note`, `notesPage`, `notesHandlers`). Render anything that routes with `renderRoutes` (`src/test/router.jsx`: a memory data router inside the real `AuthProvider`), and use `signIn()` for a session: tests use the real `localStorage` (cleared after each test), never a mocked `storage`. Mocks are reset before every test (`mockReset`), tests run in a shuffled order (`sequence.shuffle`; replay with `--sequence.seed=<seed>`), and a state update outside `act()` fails the test (`src/test/setup.js`, which also stands in for the `<dialog>` methods jsdom lacks). Test what the user sees and does (roles, labels, text, outcomes), not class names, markup structure or `data-testid` (production markup has none); prefer one table-driven `it.each` to a near-copy per case. Coverage thresholds (95%) live in `vite.config.js`; CI runs `test:coverage`.
- **E2E tests**: Playwright against the full stack via `docker-compose.test.yml` with the `e2e` profile. Ignores self-signed TLS cert errors. E2E runs against the **test** stack, never the production compose file. Each test registers its own account (`registerAndLogin` in `e2e/helpers.js`), so tests never share state and a retry starts clean. `expireAccessToken` re-signs the page's token as expired to exercise refresh. `accessibility.spec.js` runs axe (WCAG 2.2 A/AA, including contrast) on every page. `nginx.spec.js` checks nginx's own promises over the wire (security headers, caching, HTTPS redirect, unknown hosts, JSON 413, `/api` proxied whatever the extension).

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

1. Replace the notes slice: `backend/app/models/note.py`, `backend/app/{schemas,routes}/notes.py`, `backend/migrations/versions/0002_notes.py`, `frontend/src/features/notes/` and its route in `routes.jsx`, and their tests.
2. Remove the API-status demo on the home page, unless you want it: delete `frontend/src/features/health/`, and `<ApiStatus />` and its `vi.mock` in `HomePage`. Keep the backend's `/api/health`: the Docker healthchecks and Playwright wait on it.
3. Update `Note` references in `backend/tests/conftest.py` fixtures, the notes cases and `notesHandlers` in `frontend/src/test/integration/auth-flow.test.jsx`, and the notes integration (`test_mysql_limits.py`, `test_mysql_cascade.py`) and E2E (`notes-crud.spec.js`) tests.
4. Point the frontend at the new feature: the nav link in `components/layout/Navbar.jsx`, the link in `pages/HomePage.jsx`, and `AFTER_LOGIN_PATH` in `auth/GuestRoute.jsx`. Name the app in `APP_NAME` (`src/appName.js`) and the `<title>` in `index.html` (a test checks they match).
5. Generate an Alembic migration for the new tables (`flask db migrate`, with `.env.dev` loaded as README's "Database Schema Changes" shows); it chains onto `0001_users`.
6. Rename the Compose projects (`name:` at the top of each compose file: `app_dev`, `app_test`, `app`) and the databases in `.env.dev`/`.env.test` (`appdb_dev`, `appdb_test`), so two apps built from this template never share containers or volumes.
7. Rewrite this file and `README.md` for the new app.
