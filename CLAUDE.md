# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack application template: React (Vite) frontend, Flask backend, MySQL database, Redis caching, Nginx reverse proxy. Three Docker Compose environments: dev, test, and production.

It ships with **auth** (register/login/logout/refresh with rotating refresh tokens) and a minimal **notes** CRUD feature. The notes feature is a deliberately thin vertical slice — model, schema, routes, service, hook, components, tests — meant to be **replaced** by whatever the real app is. Use it as the worked example of how a feature is wired end to end, then delete it.

## Environment Setup

Copy `.env.examples` to create `.env.dev`, `.env.prod`, and `.env.test` before running any environment.

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

First-time setup: `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt` and `cd frontend && npm install`.

## Running Tests

### Backend
```bash
cd backend
./run_tests.sh unit              # Fast, SQLite in-memory, no Docker required
./run_tests.sh integration       # Real MySQL + Redis (spins up docker-compose.test.yml)
./run_tests.sh combined          # All tests with merged coverage report
./run_tests.sh unit --verbose    # Verbose output
./run_tests.sh unit --no-coverage
```

### Frontend
```bash
cd frontend
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
- **`__init__.py`** — App factory. Registers all Flask extensions (JWT, SQLAlchemy, CORS, Limiter, Redis) and blueprints. The JWT blocklist loader **fails closed**: if Redis is unavailable, every refresh token is treated as revoked rather than valid.
- **`config.py`** — Config classes per environment (`DevelopmentConfig`, `TestingConfig`, `IntegrationConfig`, `ProductionConfig`). Controls DB URI, Redis usage, rate limiting, JWT settings. `FLASK_ENV` is the only switch that selects a config class — no other env var may promote or demote one.
- **`routes/`** — API blueprints: `auth` (login/register/logout/logout-all/refresh), `health`, `notes` (the example CRUD feature).
- **`models/`** — SQLAlchemy ORM models (User, Note). Auth logic lives on the User model.
- **`schemas/`** — Pydantic schemas for request validation.
- **`utils/`** — Redis service (JWT blocklist + caching), error handlers, and the HTML sanitizer (`InputSanitizer.sanitize_text`). The sanitizer returns **plain text, not HTML-escaped text** — rely on the render layer (React escapes by default) for output safety.
- **`migrations/`** — Alembic migrations for MySQL.

### Frontend (`frontend/src/`)
- **`api/`** — Centralized Axios instance + service modules (auth, health, notes). All backend calls go through here.
- **`contexts/AuthContext`** — Global auth state (user, tokens, login/logout).
- **`hooks/`** — `useAuth`, `useHealth`, `useNotes`.
- **`utils/`** — `validation.js` (shared field validators), `storage.js` (token storage; see the comment there on the accepted localStorage XSS trade-off).
- **`components/`** — `layout/` (Navbar, LogoutDropdown), `notes/` (the example feature). Each with co-located unit tests in `__tests__/`.
- **`pages/`** — `HomePage`, `LoginPage`, `RegisterPage`, `NotesPage`.
- **`e2e/`** — Playwright tests for full user journeys.

### Test Architecture
- **Backend unit tests** (`tests/unit/`): `TestingConfig` uses SQLite in-memory, disables Redis and rate limiting. Route tests live here too — they need no real services. Fixtures in `tests/conftest.py`.
- **Backend integration tests** (`tests/integration/`): `IntegrationConfig` connects to real MySQL (port 3307) and Redis (port 6380) from `docker-compose.test.yml`, via the `integration_*` fixtures. Reserve these for behavior that genuinely needs a real service.
- **Frontend unit tests**: Vitest + jsdom + MSW (Mock Service Worker) for API mocking. Setup in `src/test/setup.js`.
- **E2E tests**: Playwright against the full stack via `docker-compose.test.yml` with the `e2e` profile. Ignores self-signed TLS cert errors. E2E runs against the **test** stack, never the production compose file.

### Docker Compose Files
| File | Purpose |
|------|---------|
| `docker-compose.dev.yml` | Dev: MySQL + Redis only (backend/frontend run locally), bound to 127.0.0.1 |
| `docker-compose.test.yml` | Test: isolated MySQL (3307) + Redis (6380); `e2e` profile adds backend + Nginx |
| `docker-compose.yml` | Production: all services with resource limits and health checks |

## Starting a New App From This Template

1. Replace the notes slice: `backend/app/{models,schemas,routes}/notes.py`, `frontend/src/{api/services,hooks,components,pages}` notes files, and their tests.
2. Update `Note` references in `backend/tests/conftest.py` fixtures.
3. Update `frontend/src/utils/validation.js` (the note-length validators).
4. Update the nav link in `frontend/src/components/layout/Navbar.jsx` and the post-login redirects in `LoginPage`/`RegisterPage`.
5. Add an Alembic migration for the new tables.
6. Rewrite this file and `README.md` for the new app.
