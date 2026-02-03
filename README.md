# React + Flask + MySQL Template

This repository is a ready-to-use template for a React + Flask + MySQL web application, designed to eliminate the overhead of initial project scaffolding and environment configuration. 

**Features**: 

* Fully Dockerized production setup
* Hybrid development setup (local app + Dockerized database)
* Flask application using the factory pattern
* MySQL database with Alembic migrations
* Redis for session management and rate limiting
* Nginx reverse proxy for serving the frontend and API in production
* HTTPS support with self-signed certificates for development

**Full-stack template**:

* **Frontend**: React (Vite)
* **Backend**: Flask + SQLAlchemy + Alembic
* **Database**: MySQL
* **Cache/Sessions**: Redis
* **Reverse proxy (prod)**: Nginx
* **Containers**: Docker / Docker Compose

---

## Required Software

Make sure the following tools are installed before running the project:

* **Docker & Docker Compose**  
  Used for MySQL, Redis, and production builds.  
  [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)

* **Python 3.12+**  
  Used for the Flask backend.  
  [https://www.python.org/downloads/](https://www.python.org/downloads/)

* **Node.js 20+ (includes npm)**  
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

You must create these locally (not committed):

* `.env.dev` → Development (local backend + frontend, Docker DB + Redis)
* `.env.prod` → Production (fully Dockerized)

Copy the examples from `.env.examples`. Make sure to set strong, unique passwords for MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD, REDIS_PASSWORD, and SECRET_KEY. Use different credentials for dev and prod.

You can generate secure values with:

```bash
python3 -c "import uuid; print(uuid.uuid4().hex)"
```

---

# SSL/HTTPS Setup

The production app must run over HTTPS. To enable HTTPS:

## Production Testing (Self-Signed Certificate)

```bash
# 1. Generate self-signed certificate
mkdir -p nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/privkey.pem \
  -out nginx/certs/fullchain.pem \
  -subj "/C=US/ST=California/L=San Francisco/O=Dev/CN=localhost"

# 2. Update nginx/default.conf and docker-compose.yml for HTTPS
# See HTTPS_Upgrade_Guide.md for detailed instructions

# 3. Rebuild and restart
docker compose --env-file .env.prod up --build
```

Visit `https://localhost` and bypass the browser security warning (expected for self-signed certs).

## Production (Let's Encrypt)

For production with a real domain:

```bash
# 1. Install Certbot on your server
sudo apt install certbot  # Ubuntu/Debian

# 2. Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# 3. Update nginx/default.conf with your domain
# 4. Mount /etc/letsencrypt in docker-compose.yml
# See HTTPS_Upgrade_Guide.md for complete production setup
```

**For complete HTTPS setup instructions, see `HTTPS_Upgrade_Guide.md`.**

---

# Production Mode (Docker)

Run your web application in a consistent, production-like environment.

**Architecture (Prod)**

* MySQL → Docker
* Redis → Docker
* Flask (Gunicorn) → Docker
* React → Built & served by Nginx

---

## One-Time Setup (Production)

```bash
docker compose --env-file .env.prod build
```

---

## Start Production App

```bash
docker compose --env-file .env.prod up
```

**When to rebuild:**

Frontend changes require `--build` (React app is built into `dist/` and served by Nginx):

```bash
docker compose --env-file .env.prod up --build
```

Backend changes do NOT require `--build` — Gunicorn reloads automatically when Python files change.

**Production URL:** [http://localhost](http://localhost) (or [https://localhost](https://localhost) if SSL is configured)

---

## Stop Production App

```bash
CTRL+C
docker compose --env-file .env.prod down
```

---

## Full Reset (⚠️ Deletes Database)

Stops everything and **removes all volumes (data loss)**:

```bash
docker compose --env-file .env.prod down --volumes --remove-orphans
docker system prune -af
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

### 1: Build / Pull Docker Images (DB + Redis)

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml build
```

### 2: Backend Virtual Environment

From `backend/`:

```bash
python -m venv .venv
source .venv/Scripts/activate   # Windows (Git Bash)
source .venv/bin/activate       # Linux/macOS
pip install -r requirements.txt
```

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

MySQL will be available on port 3306, Redis on port 6379.

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

### Stop Backend (Dev)

From `backend/`:

```bash
CTRL+C
```

### Stop Frontend (Dev)

From `frontend/`:

```bash
CTRL+C
```

---

# Testing Mode

Run tests in an isolated environment.

## Backend Testing

From `backend/`:

```bash
./run_tests.sh all
```

Runs all unit and integration tests with coverage.

### Testing Options

To learn about running specific types of tests:

```bash
./run_tests.sh help
```

---

## Frontend Testing

From `frontend/`:

```bash
npm run test:run      # Run tests once (ideal for CI)
npm run test          # Watch mode (auto re-runs on changes)
npm run test:coverage # Generate coverage report (coverage/ folder)
```

---

## Summary

| Mode | DB     | Redis  | Backend | Frontend |
|------|--------|--------|---------|----------|
| Prod | Docker | Docker | Docker  | Docker   |
| Dev  | Docker | Docker | Local   | Local    |
| Test | Memory | N/A    | Local   | Local    |