# React + Flask Template

This repository is a ready-to-use template for a React + Flask + MySQL web application, designed to eliminate the overhead of initial project scaffolding and environment configuration. 

**Features**: 

* Fully Dockerized production setup behind an HTTPS Nginx reverse proxy
* Hybrid development setup (local app + Dockerized database)
* Flask application using the factory pattern
* MySQL database with Alembic migrations
* JWT auth: short-lived access tokens plus rotating, revocable refresh tokens in HttpOnly cookies; a session ends after 7 days unused, and 30 days after login at most
* Redis for refresh-token tracking and rate limiting
* Unit, integration, and end-to-end tests, run in GitHub Actions

**Full-stack template**:

* **Frontend**: React (Vite)
* **Backend**: Flask + SQLAlchemy + Alembic
* **Database**: MySQL
* **Sessions/Rate limits**: Redis
* **Reverse proxy (prod)**: Nginx
* **Containers**: Docker / Docker Compose

The app ships with auth and a minimal **notes** feature: list, create, edit and delete. Notes is a deliberately thin example of one feature wired end to end (model, schema, route, API service, hook, components, tests), meant to be replaced by your real app. See [Starting a New App](#starting-a-new-app-from-this-template).

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

| File | In git | Used by |
|------|--------|---------|
| `.env.dev` | Yes, throwaway values | Development (local backend + frontend, Docker DB + Redis on 127.0.0.1) |
| `.env.test` | Yes, throwaway values | Integration and E2E tests |
| `.env.prod` | No, create from `.env.prod.example` | Production (fully Dockerized) |

Dev and test work as cloned. Production is the only file to create:

```bash
cp .env.prod.example .env.prod
```

It holds only the seven values that differ per deployment (including `SERVER_NAME`, the domain nginx serves); hosts, ports and `APP_ENV` are fixed in `docker-compose.yml`. Set strong, unique values for every password and `SECRET_KEY`. Production refuses to start with a `SECRET_KEY` shorter than 32 characters or with the example file's placeholder passwords. Generate values with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

**Changing a value later.** The database keeps its own copy of its users and passwords; `.env.prod` only tells the app what they are. Editing a database value in `.env.prod` alone therefore locks the app out (every request gets a 502). Change it in the database first, then in `.env.prod`, then run `docker compose --env-file .env.prod up -d`. With the bundled MySQL, which reads the `DB_*` values only when its volume is first created:

```bash
docker compose --env-file .env.prod exec db mysql -uroot -p -e "ALTER USER '<DB_USER>'@'%' IDENTIFIED BY '<new password>'"
```

For a new `DB_ROOT_PASSWORD`, change both `'root'@'%'` and `'root'@'localhost'`. A new `REDIS_PASSWORD` needs only `up -d`. A new `SECRET_KEY` signs every user out.

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

`.env.dev` turns the Flask debugger on. To run without it, override it from the shell: `FLASK_DEBUG=0 ./run_dev.sh`.

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

`run_dev.sh` applies pending migrations each time it starts. To generate one after changing the SQLAlchemy models, from `backend/` with the virtualenv active and the dev database running, load the dev environment first (the `flask` command needs it):

```bash
set -a && source ../.env.dev && set +a
flask db migrate -m "describe change"
flask db upgrade
```

---

## Python Dependencies (During Dev)

`requirements.in` lists the packages the app imports and `requirements-dev.in` the test tools. The `.txt` files are locks compiled from them: every package, transitive ones included, pinned to an exact version, so each install and image build gets exactly what was tested. Never edit the `.txt` files by hand. After changing a `.in` file, from `backend/` (needs Docker):

```bash
./lock_deps.sh             # Re-resolve after editing a .in file
./lock_deps.sh --upgrade   # Move every package to its newest release
pip install -r requirements-dev.txt
```

The script compiles inside the production base image, so the locks resolve for Linux and Python 3.12 whatever machine runs it.

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

Backend and frontend unit tests need no environment file. Integration and E2E tests use the committed `.env.test` (see [Environment Files](#environment-files)).

## Backend Tests

From `backend/`:

```bash
./run_tests.sh unit          # Fast: in-memory SQLite, no Docker
./run_tests.sh integration   # Real MySQL + Redis from docker-compose.test.yml
./run_tests.sh combined      # Both, with one merged coverage report
./run_tests.sh help          # All options
ruff check .                # Lint
```

Integration runs start the test containers on ports 3307 (MySQL) and 6380 (Redis), wait for them to be healthy, and remove them afterwards. A bare `pytest` runs the unit tests only.

Unit runs fail below 95% coverage of `app/`, branches included, in total or for any one package (`backend/.coveragerc`, `run_tests.sh`), and any warning fails a test (`backend/pytest.ini`), so a deprecation gets fixed when it first appears rather than when the next major release removes it. Tests run in a new random order each time (`pytest-randomly`); to replay a failing order, pass the seed printed in the header: `pytest --randomly-seed=<seed>`.

## Frontend Tests

From `frontend/`:

```bash
npm run lint          # ESLint
npm run test:run      # Run unit tests once
npm run test          # Watch mode (auto re-runs on changes)
npm run test:coverage # Unit tests with coverage (coverage/ folder); what CI runs
```

Coverage below the thresholds in `vite.config.js` fails the run. Tests run in a shuffled order; replay one with `npx vitest run --sequence.seed=<seed>`, using the seed printed at the start of the run. A test also fails if React reports a state update outside `act()`, which means it asserted before the page settled: await the final state with `findBy*` or `waitFor`. Tests that fake the network build responses from `src/test/fixtures.js`, whose list of error codes is checked against the backend's, and start MSW with `setupMswServer` from `src/test/server.js`; a feature keeps its own fake responses and handlers in its `__tests__/fixtures.js`. Pages are rendered through the real router and `AuthProvider` with `renderRoutes` from `src/test/router.jsx`, and `signIn()` stores a session the way logging in does.

## End-to-End Tests

Playwright drives a real browser against the full stack: Nginx, Flask, MySQL, and Redis from `docker-compose.test.yml`, served at `https://localhost:8443`. It needs Docker and a certificate in `nginx/certs/` (see [SSL/HTTPS Setup](#sslhttps-setup)).

From `frontend/`:

```bash
npx playwright install chromium   # First time only
npm run test:e2e                  # Builds and starts the stack, then runs the tests
npm run test:e2e:ui               # Interactive mode
```

Locally, Playwright reuses a test stack that is already running (for quick reruns while editing tests), even if the app code has changed since it was built. After changing app code, or after an interrupted run, stop it first, and again when done, from the repository root:

```bash
docker compose --env-file .env.test -f docker-compose.test.yml --profile e2e down -v
```

`accessibility.spec.js` runs [axe](https://github.com/dequelabs/axe-core) on every page against the WCAG 2.2 A and AA rules, catching what jsdom cannot, such as color contrast.

## Continuous Integration

GitHub Actions (`.github/workflows/`):

* **CI** (`ci.yml`) runs lint and the backend and frontend unit suites, runs them again after deleting the example code as [Starting a New App](#starting-a-new-app-from-this-template) describes (`.github/scripts/remove_examples.py`), validates all three compose files, lints the workflows and Dependabot config (zizmor) and both Dockerfiles (hadolint), and checks the rendered nginx config (`nginx -T`, then the gixy-ng security analyzer), on every push and pull request to `main`.
* **Integration & E2E** (`integration-e2e.yml`) runs the integration and Playwright suites on every push and pull request to `main`, nightly to catch drift in base images, and on demand from the Actions tab.

Every job has a read-only token and a timeout, and actions are pinned to commit SHAs.

Dependabot (`.github/dependabot.yml`) opens weekly update PRs for the Python locks, npm, Docker images and GitHub Actions. For it to also open security fixes as soon as an advisory is published, enable Dependabot alerts and security updates under the repository's Settings > Advanced Security.

To stop a failing check from merging, require these status checks on `main` (Settings > Branches): Backend unit, Frontend unit, Compose files, Workflows, Dockerfiles, Nginx config, Backend integration and Playwright E2E.

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

Visit `https://localhost` and bypass the browser security warning (expected for self-signed certs). For local production testing, set `SERVER_NAME=localhost` in `.env.prod`.

On a server, keep the key private: `chmod 600 nginx/certs/privkey.pem` (openssl already creates it that way). The nginx container can still read it, whoever owns it on the host.

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

4. In `.env.prod`, set `SERVER_NAME=yourdomain.com www.yourdomain.com`. In `nginx/templates/default.conf.template`, point the certificate at Certbot's paths:

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

Only Nginx is published (ports 80 and 443). Nginx reaches only Flask; MySQL and Redis sit on an internal network with no outbound access, reachable only from Flask. Every container runs with `no-new-privileges`, Flask on a read-only filesystem with no Linux capabilities. Redis's `default` user is disabled; the app connects as an ACL user limited to its own keys, with dangerous commands (FLUSHALL, CONFIG, KEYS, ...) refused.

---

## Build and Start

Requires `.env.prod` and a certificate in `nginx/certs/` (see above).

```bash
docker compose --env-file .env.prod up --build
```

A one-shot `migrate` container applies migrations as the MySQL root user, restricts the app's database user to reading and writing rows (`backend/restrict_db_user.py`), and exits. The backend then starts Gunicorn with credentials that cannot change the schema, and nginx starts once the backend passes its health check. Local development (`run_dev.sh`) still migrates with the dev user directly.

**When to rebuild:** frontend and backend code are both copied into their images, so rerun with `--build` after any code change.

**Production URL:** `https://<SERVER_NAME>` ([https://localhost](https://localhost) when testing locally with `SERVER_NAME=localhost`).

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

# Summary

| Mode | DB | Redis | Backend | Frontend |
|------|----|-------|---------|----------|
| Prod | Docker | Docker | Docker | Docker (Nginx) |
| Dev | Docker | Docker | Local | Local |
| Unit tests | SQLite in memory | Not used | Local | Local (jsdom) |
| Integration tests | Docker | Docker | Local | n/a |
| E2E tests | Docker | Docker | Docker | Docker (Nginx) |

---

# Starting a New App From This Template

**What is example code.** Notes, a small CRUD feature that shows how a feature is wired end to end, and the API-status demo on the home page. Everything else is what every app keeps: auth, the account page and `/api/account`, `/api/health` (the Docker healthchecks and Playwright wait on it), the layout, forms and dialogs.

**Where a feature plugs in:**
- `backend/app/features.py`: its blueprint
- `frontend/src/routes.jsx`: its page's route, and `frontend/src/__tests__/routes.test.jsx`
- `frontend/src/components/layout/Navbar.jsx` and `frontend/src/pages/HomePage.jsx`: the links to it, and their tests
- `AFTER_LOGIN_PATH` in `frontend/src/auth/GuestRoute.jsx`: where logging in leads

CI's Scaffold job deletes the examples and edits exactly these files (`.github/scripts/remove_examples.py`), then runs lint and the unit suites, so shared code can't come to depend on an example. Changing a wiring point means changing the script with it.

**Steps:**

1. Rename the Compose projects (`name:` at the top of each compose file: `app_dev`, `app_test`, `app`) and the databases in `.env.dev` and `.env.test` (`appdb_dev`, `appdb_test`). Two apps built from this template then never share containers or volumes, and your dev and test stacks start with empty databases.
2. Replace notes with your first feature, in one of two ways:
   - **Rename it** into your feature, the quickest start when that feature is also a list of things a user owns: `backend/app/notes/`, `frontend/src/features/notes/` and their tests (`backend/tests/unit/notes/`, `backend/tests/integration/notes/`, `frontend/e2e/notes-crud.spec.js`).
   - **Delete it**, and build your feature in the same shape: delete those folders and files.

   Either way, delete `backend/migrations/versions/0002_notes.py` (step 4 generates yours) and update the wiring points above.
3. Remove the API-status demo, unless you want it: delete `frontend/src/features/health/`, the `ApiStatus` import and element in `frontend/src/pages/HomePage.jsx`, and the line in `renderPage` of `frontend/src/pages/__tests__/HomePage.test.jsx` that waits for the API status.
4. Generate a migration for your tables. From `backend/`, with `.env.dev` loaded as in [Database Schema Changes](#database-schema-changes-during-dev). If the dev backend ran after step 1 while `0002_notes.py` still existed, the database refers to a migration that is gone: reset it first (`docker compose --env-file .env.dev -f docker-compose.dev.yml down -v`, then start it again).

   ```bash
   flask db upgrade
   flask db migrate -m "<your feature>" --rev-id 0002_<your_feature>
   ```

   Upgrade first: Alembic only writes a migration against an up-to-date database. In the generated file, keep only the `op.drop_table(...)` lines in `downgrade()`: MySQL will not drop an index that a foreign key uses, and dropping the table drops its indexes anyway. Then run `./run_tests.sh integration`, whose `test_migrations.py` checks that the migrations match the models and undo cleanly.
5. Name the app: `APP_NAME` in `frontend/src/appName.js` and the `<title>` in `frontend/index.html` (a test checks they match).
6. Rewrite this README and `CLAUDE.md` for your app, and choose its license: replace `LICENSE` and the `license` field in `frontend/package.json` (keeping MIT still means putting your own name on the copyright line).

# License

MIT, see [`LICENSE`](LICENSE). The production build also writes the bundled libraries' own notices to `third-party-licenses.txt`, which nginx serves beside the app.
