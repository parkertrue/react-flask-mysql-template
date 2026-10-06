# React + Flask + MySQL Template

This repository is a ready-to-use template for a React + Flask + MySQL web application, designed to eliminate the overhead of initial project scaffolding and environment configuration. 

**Features**: 

* Fully Dockerized production setup behind an HTTPS Nginx reverse proxy
* Hybrid development setup (local app + Dockerized database)
* Flask application using the factory pattern
* MySQL database with Alembic migrations
* JWT auth: short-lived access tokens plus rotating, revocable refresh tokens in HttpOnly cookies
* Redis for refresh-token tracking and rate limiting
* Unit, integration, and end-to-end tests, run in GitHub Actions

**Full-stack template**:

* **Frontend**: React (Vite)
* **Backend**: Flask + SQLAlchemy + Alembic
* **Database**: MySQL
* **Cache/Sessions**: Redis
* **Reverse proxy (prod)**: Nginx
* **Containers**: Docker / Docker Compose

The app ships with auth and a minimal **notes** feature. Notes is a deliberately thin example of one feature wired end to end (model, schema, route, API service, hook, components, tests), meant to be replaced by your real app. See [Starting a New App](#starting-a-new-app-from-this-template).

---

## Required Software

Make sure the following tools are installed before running the project:

* **Docker & Docker Compose**  
  Used for MySQL, Redis, tests, and production builds.  
  [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)

* **Python 3.12+**  
  Used for the Flask backend.  
  [https://www.python.org/downloads/](https://www.python.org/downloads/)

* **Node.js 24 LTS (includes npm)**  
  Used for the React frontend (Vite).  
  [https://nodejs.org/](https://nodejs.org/)

* **Git Bash (Windows users only)**  
  Provides a Unix-like shell on Windows so you can use the same commands as Linux/macOS.  
  Installed automatically with Git for Windows.  
  [https://git-scm.com/download/win](https://git-scm.com/download/win)

> ⚠️ **Windows users:** Use Git Bash for all commands in this README.  
> ⚠️ **All users:** Make sure Docker is running before executing any docker compose commands.

---

## Environment Files

Create these locally from the matching example (they are gitignored):

| File | Copy from | Used by |
|------|-----------|---------|
| `.env.dev` | `.env.dev.example` | Development (local backend + frontend, Docker DB + Redis) |
| `.env.test` | `.env.test.example` | Integration and E2E tests (usable as-is) |
| `.env.prod` | `.env.prod.example` | Production (fully Dockerized) |

```bash
cp .env.dev.example .env.dev
cp .env.test.example .env.test
cp .env.prod.example .env.prod
```

Set strong, unique values for `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `REDIS_PASSWORD`, and `SECRET_KEY` in `.env.dev` and `.env.prod`, with different credentials for each. Production refuses to start with a `SECRET_KEY` shorter than 32 characters. Generate values with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

# SSL/HTTPS Setup

Nginx serves the app over HTTPS only (port 80 redirects to 443), so it needs a certificate in `nginx/certs/` before it will start: `fullchain.pem` and `privkey.pem`. The production and test stacks mount that folder into the container.

## Self-Signed Certificate (local production testing and E2E)

```bash
mkdir -p nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/privkey.pem \
  -out nginx/certs/fullchain.pem \
  -subj "/C=US/ST=California/L=San Francisco/O=Dev/CN=localhost"
```

Visit `https://localhost` and bypass the browser security warning (expected for self-signed certs).

## Real Domain (Let's Encrypt)

```bash
# 1. Install Certbot on your server
sudo apt install certbot  # Ubuntu/Debian

# 2. Obtain a certificate (port 80 must be free, so stop the stack first)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

3. In `docker-compose.yml`, replace the nginx volume `./nginx/certs:/etc/nginx/certs:ro` with the whole Certbot directory. Its `live/` files are relative symlinks into `archive/`, so mounting only `live/` breaks them.

   ```yaml
   volumes:
     - /etc/letsencrypt:/etc/letsencrypt:ro
   ```

4. In `nginx/default.conf`, set `server_name yourdomain.com www.yourdomain.com;` in both server blocks, and point the certificate at Certbot's paths:

   ```nginx
   ssl_certificate      /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
   ssl_certificate_key  /etc/letsencrypt/live/yourdomain.com/privkey.pem;
   ```

5. Rebuild and restart: `docker compose --env-file .env.prod up -d --build`

Let's Encrypt certificates expire after 90 days. Renew with `certbot renew` (the standalone method needs port 80 free, so stop nginx first), then restart nginx.

---

# Production Mode (Docker)

Run your web application in a consistent, production-like environment.

**Architecture (Prod)**

* MySQL → Docker
* Redis → Docker
* Flask (Gunicorn) → Docker
* React → Built & served by Nginx

Only Nginx is published (ports 80 and 443); MySQL, Redis, and Flask are reachable only inside the Docker network.

---

## Build and Start

Requires `.env.prod` and a certificate in `nginx/certs/` (see above).

```bash
docker compose --env-file .env.prod up --build
```

The backend waits for MySQL and Redis, applies migrations, then starts Gunicorn. Nginx starts once the backend passes its health check.

**When to rebuild:** frontend and backend code are both copied into their images, so rerun with `--build` after any code change.

**Production URL:** [https://localhost](https://localhost)

---

## Stop Production App

```bash
CTRL+C
docker compose --env-file .env.prod down
```

---

## Full Reset (⚠️ Deletes Database)

Stops everything and **removes this project's volumes (data loss)**:

```bash
docker compose --env-file .env.prod down --volumes --remove-orphans
```

---

# Development Mode

The dev database and Redis run in Docker, while Flask and React run locally for faster iteration, hot reloading, and easier debugging.

**Architecture (Dev)**

* MySQL → Docker
* Redis → Docker
* Flask → Local machine
* React → Local machine

---

## One-Time Setup (Dev)

These steps only need to be done **once per machine** (or when dependencies change).

### 1: Pull Docker Images (DB + Redis)

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml pull
```

### 2: Backend Virtual Environment

From `backend/`:

```bash
python -m venv .venv
source .venv/Scripts/activate   # Windows (Git Bash)
source .venv/bin/activate       # Linux/macOS
pip install -r requirements-dev.txt
```

`requirements-dev.txt` adds the test tools on top of `requirements.txt`, which is all the production image installs.

### 3: Frontend Dependencies

From `frontend/`:

```bash
npm install
```

---

## Daily Development Workflow

These are the commands you'll run **every time you start working**.

### Start Database + Redis (Dev)

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml up
```

MySQL will be available on `localhost:3306`, Redis on `localhost:6379`.

---

### Start Backend (Dev)

From `backend/`:

```bash
./run_dev.sh
```

What this does:
* Loads `.env.dev`
* Activates virtual environment (if not already active)
* Waits for MySQL and Redis to be ready
* Runs `flask db upgrade`
* Starts the Flask app

---

### Start Frontend (Dev)

From `frontend/`:

```bash
npm run dev
```

The dev server listens on localhost only. To open it from another device on your network, run `npm run dev -- --host`.

**Dev URLs**

| Service  | URL |
|----------|-----|
| Frontend | [http://localhost:5173](http://localhost:5173) |
| Backend  | [http://localhost:5000/api/health](http://localhost:5000/api/health) |

---

## Database Schema Changes (During Dev)

To modify SQLAlchemy models, from `backend/`:

```bash
flask db migrate -m "describe change"
flask db upgrade
```

---

## Stop Development Mode

Stop development servers and database.

### Stop Database + Redis (Dev)

```bash
CTRL+C
docker compose --env-file .env.dev -f docker-compose.dev.yml down
```

### Stop Backend and Frontend (Dev)

Press `CTRL+C` in each terminal.

---

# Testing

All test suites need `.env.test` (see [Environment Files](#environment-files)).

## Backend Tests

From `backend/`:

```bash
./run_tests.sh unit          # Fast: in-memory SQLite, no Docker
./run_tests.sh integration   # Real MySQL + Redis from docker-compose.test.yml
./run_tests.sh combined      # Both, with one merged coverage report
./run_tests.sh help          # All options
```

Integration runs start the test containers on ports 3307 (MySQL) and 6380 (Redis), wait for them to be healthy, and remove them afterwards.

## Frontend Tests

From `frontend/`:

```bash
npm run lint          # ESLint
npm run test:run      # Run unit tests once
npm run test          # Watch mode (auto re-runs on changes)
npm run test:coverage # Generate coverage report (coverage/ folder)
```

## End-to-End Tests

Playwright drives a real browser against the full stack: Nginx, Flask, MySQL, and Redis from `docker-compose.test.yml`, served at `https://localhost:8443`. It needs Docker and a certificate in `nginx/certs/` (see [SSL/HTTPS Setup](#sslhttps-setup)).

From `frontend/`:

```bash
npx playwright install chromium   # First time only
npm run test:e2e                  # Builds and starts the stack, then runs the tests
npm run test:e2e:ui               # Interactive mode
```

## Continuous Integration

GitHub Actions (`.github/workflows/`):

* **Tests** runs the backend and frontend unit suites on every push and pull request to `main`.
* **Integration & E2E** runs the integration and Playwright suites nightly, and on demand from the Actions tab.

---

## Summary

| Mode | DB | Redis | Backend | Frontend |
|------|----|-------|---------|----------|
| Prod | Docker | Docker | Docker | Docker (Nginx) |
| Dev | Docker | Docker | Local | Local |
| Unit tests | SQLite in memory | Not used | Local | Local (jsdom) |
| Integration tests | Docker | Docker | Local | n/a |
| E2E tests | Docker | Docker | Docker | Docker (Nginx) |

---

# Starting a New App From This Template

1. Replace the notes feature: `backend/app/{models,schemas,routes}/notes.py`, the migration `backend/migrations/versions/0002_notes.py`, the notes files in `frontend/src/{api/services,hooks,components,pages}`, and their tests.
2. Update the `Note` fixtures in `backend/tests/conftest.py`.
3. Update the note-length validators in `frontend/src/utils/validation.js`.
4. Update the nav link in `frontend/src/components/layout/Navbar.jsx` and the post-login redirects in `LoginPage` and `RegisterPage`.
5. Generate a migration for your new tables (`flask db migrate -m "..."`). It chains onto `0001_users`, which holds the auth table every app keeps.
6. Rewrite this README and `CLAUDE.md` for your app.
