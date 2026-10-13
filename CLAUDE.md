# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack application template: React (Vite) frontend, Flask backend, MySQL database, Redis (refresh tokens and rate limits), Nginx reverse proxy. Three Docker Compose environments: dev, test, and production.

It ships with **auth** (register/login/logout/refresh with rotating refresh tokens) and a minimal **notes** CRUD feature (list, create, edit in place, delete). The notes feature is a deliberately thin vertical slice — model, schema, routes, service, hook, components, tests — meant to be **replaced** by whatever the real app is. Use it as the worked example of how a feature is wired end to end, then rename it into the first real feature or delete it (README, "Starting a New App").

## Environment Setup

`.env.dev` and `.env.test` are committed with throwaway values (dev services bind to 127.0.0.1 only), so dev and test run as cloned. Only `.env.prod` is gitignored: copy it from `.env.prod.example`, which lists just the seven per-deployment values (database name, user, passwords, `SECRET_KEY`, and `SERVER_NAME`, the domain nginx serves); hosts, ports and `APP_ENV` are fixed in the compose files. Backend containers get an explicit `environment:` list rather than the whole env file, so `DB_ROOT_PASSWORD` never reaches the running app; only the one-shot `migrate` service holds it. Redis runs with its `default` user disabled; the app connects as the ACL user `app` (`REDIS_USERNAME`), which may touch only its own keys and no `@dangerous` command, nor any command of the modules the `redis:8` image loads (search, JSON, time series, probabilistic), since `@dangerous` doesn't cover those (`tests/integration/test_redis_acl.py`). `FLASK_DEBUG=0 ./run_dev.sh` overrides the dev file's debug setting for one run. Unit tests need no env file (`UnitTestConfig` requires no MySQL/Redis settings, and `tests/conftest.py` supplies `SECRET_KEY`).

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

First-time setup: `cd backend && python -m venv .venv && source .venv/Scripts/activate && pip install -r requirements-dev.txt` (`.venv/Scripts/activate` is the Windows Git Bash path; Linux/macOS use `.venv/bin/activate`) and `cd frontend && npm install`.

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
ruff check .                     # Lint (errors, quote style, no print, commented-out code or TODO, no naive datetimes, eval or subprocess, no get_jwt_identity or skipped tests, no unused noqa; CI fails on any finding)
```

### Frontend
```bash
cd frontend
npm run lint          # ESLint, no console outside tests, e2e and config files, no raw form controls outside FormField, no disabled, data-testid or dangerouslySetInnerHTML, no TODO or eval; a warning fails it too (CI fails on any finding)
npm run test          # Watch mode
npm run test:run      # Run once (CI)
npm run test:coverage
npm run test:e2e      # Playwright against dockerized stack (https://localhost:8443)
npm run test:e2e:ui
npm run test:e2e:debug
```

CI also fails on trailing whitespace outside `*.md` and on a file without a final newline (`.editorconfig`; the Workflows job in `ci.yml`).

### Running a single backend test
```bash
cd backend
source .venv/Scripts/activate   # or .venv/bin/activate on Linux/macOS
pytest tests/unit/auth/test_routes.py::TestClassName::test_method_name -v
```

## Audits

Skills in `.claude/skills/` that audit the template, run on demand only, never automatically. Each check runs in its own subagent, changes nothing, and writes its findings to `temp/audits/YYYY-MM-DD-<check>.md`, comparing them with its previous report.

| Command | Covers | When to run |
|---|---|---|
| `/audit-infra [layer]` | Config and infrastructure at every layer, bottlenecks | Daily, or after any config or infra change |
| `/audit-tests` | Test infrastructure and patterns, then coverage gaps; mutation spot checks | After a feature lands |
| `/audit-security` | ASVS L2 code review, dependency CVEs, scans of the local test stack | After auth, config or dependency changes |
| `/audit-recovery` | Failure drills on a throwaway production-config stack; restore and compromise readiness | After infra changes |
| `/audit-code` | Comments, dead code, debug leftovers, naming consistency; imports a built-in or a common library could replace; the lint setup itself | Before a PR |
| `/audit-a11y` | WCAG 2.2 AA beyond what axe catches | After UI changes |
| `/audit-legal` | Licenses (the template's and its dependencies'), privacy law, terms, user content, accessibility law, required notices; risks for a lawyer, not legal advice | Before publishing, and after a change that collects new personal data or adds a third-party service or dependency |
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
Organized by feature, like the frontend: one package per feature (`account/`, `auth/`, `health/`, `notes/`), each with modules named by role (`models.py`, `schemas.py`, `routes.py`), around a shared core (`__init__.py`, `config.py`, `utils/`). Imports point one way: the core imports no feature; a feature uses the core and `auth/` (every app keeps it), never another feature; and only the factory imports `features.py`, the one list that wires features in, and no feature besides `auth/`. `tests/unit/test_import_rules.py` enforces this, and ruff bans relative imports (`TID252`), which it could not see.
- **`__init__.py`** — App factory. Registers all Flask extensions (JWT, SQLAlchemy, Limiter, Redis) and the blueprints listed in `features.py`. There is no CORS: the browser only ever calls a relative `/api`, which is same-origin in every environment (Vite's proxy in dev, nginx elsewhere). The JWT blocklist loader **fails closed**: if Redis is unavailable, every refresh token is refused, with a 503 `SERVICE_UNAVAILABLE` rather than a revocation, so clients keep their session and retry instead of signing the user out. The JWT user loader looks up the token's user on every `@jwt_required` request and answers 401 if the account no longer exists; routes read it as `flask_jwt_extended.current_user`, never from `get_jwt_identity()`. Every response gets `Cache-Control: no-store` unless the route sets its own, since API bodies carry tokens and private data. A MySQL outage (stopped, hung past the query timeout, or a dropped connection: SQLAlchemy's `OperationalError`/`InterfaceError`) answers 503 `SERVICE_UNAVAILABLE` too, logged; other database errors stay 500s, since they are bugs.
- **`config.py`** — Config classes per environment (`DevelopmentConfig`, `UnitTestConfig`, `IntegrationConfig`, `ProductionConfig`). Controls DB URI, Redis usage, rate limiting, JWT settings, and `TRUSTED_PROXY_COUNT` (Production trusts one proxy, nginx, so rate limits key on the real client IP). `APP_ENV` is the only switch that selects a config class — no other env var may promote or demote one. `ProductionConfig` rejects a `SECRET_KEY` under 32 characters or equal to the template placeholder, and the example file's placeholder passwords. `MAX_CONTENT_LENGTH` caps request bodies at 16 KB (nginx enforces the same). Rate-limit counters fall back to per-worker memory while Redis is down. MySQL calls time out (connect 5s, each query 15s, set by `DB_QUERY_TIMEOUT`), so a hung database frees request threads well before nginx's 60s; the `migrate` service sets it to 0, since a migration may run longer. The backend's `dns_opt` caps a lookup of a stopped container at 1s.
- **`features.py`** — the one place a feature plugs in: its blueprint, one import and one list entry. Importing a feature's routes imports its models, which is how Flask-Migrate sees every table.
- **Models and schemas, in every feature** — SQLAlchemy models and Pydantic request/response schemas. A column's size is a named constant beside it (`EMAIL_MAX_LENGTH`, `NOTE_MAX_LENGTH`) that the schemas import; migrations keep literal sizes, since each is a snapshot. Timestamps are UTC: the MySQL connection's time zone is pinned to it, and since DATETIME comes back naive, a response schema declares each one as `UtcDatetime` (`utils/schemas.py`), which states the zone when serializing, or browsers read it as local time. A list that grows needs an index on its owner and id (`Note`'s `(user_id, id)`); when generating its migration, keep only `drop_table` in `downgrade()`, since MySQL will not drop an index a foreign key uses and dropping the table drops its indexes anyway. Every free-text field (passwords, note content) must pass `utils/text.py`'s `is_plain_text`: letters, marks, numbers, punctuation, math/currency/modifier symbols and spaces, inside the Basic Multilingual Plane, so no emoji, no © or °, and no control or zero-width characters. Staying in the BMP makes every character one UTF-16 unit, so the frontend counts with plain `.length` and the native `maxLength`; apply the same check to any new text field.
- **`auth/`** — the `User` model (auth logic lives on it), the auth schemas and the `auth` blueprint: login/register/logout/logout-all/refresh, plus clear-cookies for when logout itself fails; logout is best effort, but logout-all answers 503 if Redis could not revoke the sessions, since that is its whole effect. A session ends after 7 days without a refresh (`SESSION_IDLE_TIMEOUT`), and 30 days after login however often it refreshes: each refresh token expires at the earlier of the two, since its `auth_time` claim is carried through every rotation. The refresh cookie is `__Secure-refresh_token`, so it is `Secure` in every environment; browsers accept that on `http://localhost`. Only login, register and refresh declare a rate limit, since a per-IP quota on the whole API would lock out users sharing an address. Login is limited loosely per IP, tightly per account and IP (5 failures a minute, so a stranger's wrong guesses lock out only the stranger's address) and loosely per account alone (100 failures an hour); only failed logins count toward the account limits. Refresh is limited per user, register per IP. `schemas.py` accepts only a plain `local@domain` email whose local part is ASCII (deliverable without SMTPUTF8) and stores it in ASCII form (`bücher.de` → `xn--bcher-kva.de`); `normalize_email` is the one canonical form, which the login rate limit keys on too. Passwords are NFKC-normalized before the length checks and hashing, at register and login alike; both refuse spaces, but only registration applies the strength rules (length, letter case, a number). `frontend/src/utils/validation.js` mirrors all of this (`hasUnsupportedCharacters`).
- **`account/`** — `GET /api/account` (`{email, created_at}`), the signed-in user's own account. Every app keeps it, so shared tests use it as their logged-in route; account settings and deletion belong here.
- **`health/`** — `GET /api/health`, unlimited like every route without its own limit; the Docker healthchecks and Playwright wait on it.
- **`notes/`** — the example CRUD feature. `GET /api/notes` is cursor-paginated, newest first: `?before=<next_cursor>&limit=`, and the frontend's `useNotes` exposes `loadMore`/`hasMore`. Keep that pattern, with an index on the owner and id like `Note`'s `(user_id, id)`, for any list that grows. `PUT`/`DELETE /api/notes/<id>` edit and delete one note through `get_own_note_or_404`, so another user's note is a 404 exactly like a missing one; copy that helper for any owned resource. A create past `NOTES_MAX_PER_USER` (1000, beside `NOTE_MAX_LENGTH`) answers 409 `QUOTA_EXCEEDED` through `quota_exceeded`: every feature that stores user rows needs a per-user cap like it, a count on the owner index, since nginx's per-IP rate bounds requests, not storage.
- **`utils/`** — shared helpers: `ids.py` (`ID_MAX`, the largest id a URL or cursor may hold), `schemas.py` (`UtcDatetime`), `text.py` (`is_plain_text`), `passwords.py` (hashing, at most `PASSWORD_HASH_CONCURRENCY` at once), `errors.py`, and the Redis service (refresh-token allowlist: one sorted set per user, JTI scored by expiry, at most `MAX_SESSIONS_PER_USER` = 10 with the oldest evicted; refresh swaps old for new in one Lua script run inside Redis, so a refresh token rotates exactly once: of two requests racing with the same token, the second gets 401 `AUTH_TOKEN_REVOKED`, never a second session. The app's instance lives on `app.extensions["redis_service"]`, read it with `get_redis_service()`, never import it). The app's Redis client uses `REDIS_CLIENT_OPTIONS` (2s timeouts, one immediate retry) and the rate limiter's `RATELIMIT_REDIS_OPTIONS` (the same, with no retry: while Redis is down the limiter re-checks it on any request), and once Redis proves unreachable `RedisService` stops calling it for `RECONNECT_INTERVAL_SECONDS`, so an outage fails fast instead of hanging requests (looking up a stopped container's name alone can take seconds). Login/refresh answer 503 when the new refresh token cannot be recorded. `errors.py` holds `error_response`, which builds the `{"error": {"code", "message"}}` body that every route and the error handlers in `__init__.py` return, and `quota_exceeded`, the 409 a feature answers when a user's rows reach its cap. User text is stored **verbatim**, markup included; output safety is the render layer's job (React escapes text by default). Never render user text with `dangerouslySetInnerHTML` without sanitizing it there.
- **`migrations/`** — Alembic migrations for MySQL. `0001_users` is the auth table every app keeps; `0002_notes` belongs to the example feature and is deleted with it, so a new app's migrations chain straight onto `0001_users`.

### Frontend (`frontend/src/`)
Organized by feature. Imports point one way: `routes.jsx` and `pages/` use `features/`, and both use the shared folders (`auth/`, `api/`, `components/`, `utils/`); shared code never imports a feature, and features never import each other. Import across folders with the `@/` alias for `src/` (`vite.config.js`; `jsconfig.json` tells the editor) and within a folder with `./`, never `../../`; `eslint.config.js` enforces these rules, the one-way imports included: its local `relative-within-folder` rule resolves each relative import and refuses one that leaves its folder (a feature counts as its own folder), and `src/__tests__/eslintRules.test.js` checks every rule, these and the others in `eslint.config.js`, on planted code. Prefer a React or React Router built-in to hand-written code whenever one fits.
- **`main.jsx` / `routes.jsx`** — `createBrowserRouter` over the route objects in `routes.jsx`, inside `AuthProvider`. `ProtectedRoute` and `GuestRoute` are pathless parent routes: nest a page under one to guard it. Each route level has an `errorElement` (`ErrorPage`), so a page that throws shows an error under the navbar instead of a blank screen; unknown paths get `NotFoundPage`.
- **`appName.js`** — `APP_NAME`, the app's one name. `PageTitle` and the home page's `h1` use it, and unit and E2E tests build their expected text from it.
- **`auth/`** — everything auth, kept by every app: `storage.js` (token storage, the one copy of the session; see the comment there on the accepted localStorage XSS trade-off. The api client ends a refused session with `endSession`, which also sets a flag, so the login page says "Your session has ended"; a logout, `clearAuth`, never does), `AuthProvider` (reads storage with `useSyncExternalStore`, so a session ended by the api client or another tab re-renders the app at once, with no page reload), `AuthContext` (in its own file so fast refresh keeps working), `useAuth`, `authService`, the route guards (`ProtectedRoute` remembers the page, `GuestRoute` returns there after login, else to `AFTER_LOGIN_PATH`), and `LogoutButton`.
- **`api/`** — the centralized Axios instance (`api.js`: token refresh, CSRF header) and `getErrorMessage`. All backend calls go through it, via a service module beside the code that uses it (`auth/authService.js`, `features/notes/notesService.js`).
- **`features/`** — one folder per feature, holding its service, hook, page, components, CSS (imported by its components) and tests, so removing one is deleting a folder plus its route. `notes/` is the example; `health/` is the home page's API-status demo (`ApiStatus`), removable like notes.
- **`pages/`** — the pages every app keeps: `HomePage`, `LoginPage`, `RegisterPage`, `AccountPage` (reached from the navbar's email link; loads `GET /api/account` to show when the user joined, holds "Log out all devices", and is where account settings such as account deletion belong), `NotFoundPage`, `ErrorPage`.
- **`components/`** — shared UI: `layout/` (`Layout`, `Navbar`, `PageTitle`), `forms/` (`FormField`, whose children sit on the input's line, as a one-line form's buttons do; `useFormFields`, with `reset` to clear a form after it saves) and `dialogs/` (`ConfirmDialog`, a yes/no question on the native modal `<dialog>`; ask with it before anything that cannot be undone, as deleting a note does).
- **`utils/`** — `validation.js` (the auth field validators); a feature keeps its own (`features/notes/validation.js`).
- **`styles/`** — global CSS: `tokens.css` (the app's only colors: `styles/__tests__/stylesheets.test.js` fails on a color written anywhere else, on a token no CSS uses and on one never defined; every pairing meets WCAG AA contrast, and `styles/__tests__/tokens.test.js` checks each one: add a row there for a new pairing), then reset, base and shared components, then page styles. Layouts adapt by wrapping (`flex-wrap`, `clamp()`) rather than at a fixed breakpoint, so no stylesheet has a width media query.
- **`e2e/`** — Playwright tests for full user journeys. Shared steps (register, log in, open the account page, log out, unique emails) and checks (`expectNoViolations`, `expectNoCspViolations`, `expectReflow`, `expectVisibleFocus`, `expectTargetSize`; lint counts any `expect*` helper as an assertion) live in `e2e/helpers.js`, with `holdRequests` to show a busy or failed state; a feature's own steps and checks live in its spec (`notes-crud.spec.js`).

**Accessibility (WCAG 2.2 AA)** is a requirement, not a polish step. Every page renders a `<PageTitle>` and one `h1`. Form fields go through `FormField` (label, hint and message tied to the input with `aria-describedby`, `autoComplete` set; lint refuses a raw `<input>`, `<textarea>` or `<select>` anywhere else), and a live limit such as a character counter is its hint; forms are `noValidate`, so the app's own messages show, and a failed submit focuses the first invalid field. Messages that appear after an action use `role="alert"` (errors) or `role="status"`. An outcome shown only visually (a note added, saved or deleted) is announced on one persistent, `.visually-hidden` `role="status"` line, as `NotesPage` does: a live region must be in the page before its text changes. When a control that has focus goes away (the last "Load more"), move focus to what replaced it. While busy, mark controls `aria-disabled` or `readOnly` rather than `disabled`, which drops keyboard focus, and guard the handler instead; `buttons.css` gives a busy button one inactive look whatever its color, still 4.5:1, and its label ("Saving...") says what it is doing. `Layout` moves focus to the new page's `h1` on navigation (a screen reader reads it, naming the page), or to `<main>` on a page without one. Colors come from `tokens.css`. `e2e/accessibility.spec.js` runs axe on every shared page and on its busy and failed states, and checks each page's reflow at 320px, text spacing and 200% text, visible focus on every Tab stop, 24px targets, and focus after back and forward; each feature's spec does the same for its own pages.

### Test Architecture
Shared tests (auth, errors, the api client, E2E sessions) use `/account` and `/api/account` as their logged-in route, never a feature's, so replacing a feature leaves them green; only the wiring points' tests (`routes.test.jsx`, `Navbar`, `HomePage`) name one. CI's Scaffold job holds that line: `.github/scripts/remove_examples.py` deletes notes and the health demo, rewires the wiring points (README, "Where a feature plugs in") to the account page, and lint and both unit suites must pass on the result. Edit the script along with a wiring point; never make it touch any other file, which would mean shared code depends on an example. Every assertion must be able to fail: never accept a set of statuses (`in [400, 422]`), assert behind an `if`, or wrap an `assert` in `try/except`. Pin the one answer the code gives. `tests/unit/test_assertions.py` (backend) and the `vitest/` and `playwright/` lint rules in `eslint.config.js` (frontend) refuse an assertion that may not run (behind an `if`, in a `try`/`catch`; the backend's also under `match`, `while` or `suppress`), a test that asserts nothing, and a skipped or focused test (ruff bans `pytest.skip` and `xfail`). The backend's refuses an assert that accepts several answers (`a or b`, `in (400, 422)`) and a test whose every assert passes for almost any value (`is not None`, `isinstance`, a bare name); the frontend's refuses those matchers outright (`toBeDefined`, `toBeTruthy`, `toBeOneOf`, ...). Mutation-check a new test (break the code, watch it fail) before trusting it.
- **Backend unit tests** (`tests/unit/`): `UnitTestConfig` uses SQLite in-memory, disables Redis and rate limiting. Route tests live here too — they need no real services. The app treats a missing token store as an outage (login and refresh answer 503), so every test of the unit app gets the in-memory `fake_redis` automatically (`tests/unit/conftest.py`); request `no_redis` to test the outage. Tests mirror the app: a folder per feature (`tests/unit/auth/`, `tests/unit/notes/`, ...) and `utils/`, with tests of the whole app at the top. Shared fixtures are in `tests/conftest.py`; a feature keeps its own in its folder's `conftest.py` (`tests/unit/notes/conftest.py`). `pytest.ini` makes a bare `pytest` run these only, turns on pytest's strict mode, and fails on any warning. `.coveragerc` measures branches and fails unit runs below 95%, and `run_tests.sh unit` (what CI runs) also fails any one package of `app/`, or the core files at its top, below 95%, so a feature cannot hide its gaps in the total. `pytest-randomly` runs the tests in a new order each time, so a test that leans on another's leftovers fails: replay an order with the seed from the header (`pytest --randomly-seed=<seed>`). Any fixture whose code uses `current_app` must request `app`, not rely on another test having created it.
- **Backend integration tests** (`tests/integration/`, a folder per feature for its own checks, infrastructure at the top): `IntegrationConfig` connects to real MySQL (port 3307) and Redis (port 6380) from `docker-compose.test.yml`, via the `integration_*` fixtures. Reserve these for behavior that genuinely needs a real service, which SQLite cannot show: column sizes, case-insensitive email matching, `ON DELETE CASCADE`, the UTC session time zone, dropped pooled connections, the Redis token store and rate-limit counters under the app's ACL user, and the migrations themselves (`test_migrations.py` upgrades an empty database and fails if the models have drifted from them).
- **Frontend unit tests**: Vitest + jsdom. Most tests `vi.mock` the service modules; `api/__tests__/api.test.js` (interceptors, token refresh) and `test/integration/auth-flow.test.jsx` run MSW against the real Axios client via `setupMswServer` (`src/test/server.js`), which fails any unhandled request. Shared fake API responses come from `src/test/fixtures.js` (`errorBody`, `tokens`); `errorBody` refuses an error code the backend never sends, and a test keeps that list in sync with `backend/app`. A feature keeps its own in `__tests__/fixtures.js` (`note`, `notesPage`, `notesHandlers`). Render anything that routes with `renderRoutes` (`src/test/router.jsx`: a memory data router inside the real `AuthProvider`), and use `signIn()` for a session: tests use the real `localStorage` (cleared after each test), never a mocked `storage`. Mocks are reset before every test (`mockReset`), tests run in a shuffled order (`sequence.shuffle`; replay with `--sequence.seed=<seed>`), and a state update outside `act()` fails the test (`src/test/setup.js`, which also stands in for the `<dialog>` methods jsdom lacks). Test what the user sees and does (roles, labels, text, outcomes), not class names, markup structure or `data-testid` (production markup has none); prefer one table-driven `it.each` to a near-copy per case. Coverage thresholds (95%) live in `vite.config.js`, over the whole of `src/` and again for every folder of `src/`, each feature folder and the root files, so a new feature cannot hide its gaps in the total; test code, a feature's `__tests__/fixtures.js` included, counts toward none of them. CI runs `test:coverage`.
- **E2E tests**: Playwright against the full stack via `docker-compose.test.yml` with the `e2e` profile. Ignores self-signed TLS cert errors. E2E runs against the **test** stack, never the production compose file. Each test registers its own account (`registerAndLogin` in `e2e/helpers.js`), so tests never share state and a retry starts clean. `expireAccessToken` re-signs the page's token as expired to exercise refresh. `accessibility.spec.js` runs axe (WCAG 2.2 A/AA, including contrast) on every shared page and its busy and failed states, and each feature's spec on its own. `nginx.spec.js` checks nginx's own promises over the wire (security headers, caching, HTTPS redirect, unknown hosts, JSON 413 and 429, `/api/` proxied whatever the extension while `/apidocs` stays the SPA's, the favicon); it also stops and replaces the test stack's backend, checking that a stopped one answers a JSON 504 within the 2s connect timeout and a replaced one is reached within 3s of serving.

### Nginx (`nginx/`)
- **`templates/default.conf.template`** — rendered at container start with `NGINX_SERVER_NAME` (prod compose sets it from `SERVER_NAME`; only `NGINX_*` variables are substituted). A catch-all server drops any other Host or a bare IP. HTTP→HTTPS redirect, TLS, SPA routing (HTML is `no-cache`; Vite's content-hashed `/assets/` are cached for a year; the build's `third-party-licenses.txt`, the bundled libraries' license notices, is served beside `index.html`; the placeholder icon is `frontend/public/favicon.svg`, and `/favicon.ico` is a 404 rather than the page), `/api/` proxy (a 2s connect timeout, so a stopped backend fails fast), 16 KB body cap, per-IP `limit_req`/`limit_conn` on `/api` only (static assets are unlimited, since HTTP/2 counts every stream as a connection). Upstream 500/502/504, and nginx's own 413 and 429, get JSON bodies in the API's error shape, keeping the original status (the backend's 503 is already JSON and passes through).
- **`nginx.conf`** — the `backend` upstream re-resolves through Docker's DNS, so a recreated backend container is picked up without restarting nginx; it caches each answer for only 2s, since a "not found" seen mid-swap would otherwise keep a healthy new backend unreachable.
- **`security_headers.conf`** — shared security headers. Every location includes it, because a location that declares its own `add_header` inherits none from the server block.
- **`resource_headers.conf`** — `security_headers.conf` plus a CSP that allows nothing, for every location that serves something other than the page (the API, its JSON errors, `/assets/`, the favicon), so a response opened directly in a tab cannot run scripts or be framed.
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
- **Singular for one thing, plural for a collection.** Model classes are singular (`Note`); tables are plural (`notes`). Names that handle one item are singular (`NoteForm`, `NoteCreateRequest`, `NoteResponse`); names that handle many are plural (`NotesList`, `NotesListQuery`, `NotesPage`). A backend feature package takes its API resource's name (`notes` for `/api/notes`) and names its modules by role (`models.py`, `schemas.py`, `routes.py`); test folders mirror the packages, and test files are named after the module they test (`tests/unit/notes/test_schemas.py`).

## Starting a New App From This Template

The steps live in `README.md`, "Starting a New App From This Template" (one copy, so the two documents cannot drift). Follow them in order.
