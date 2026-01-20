# React + Flask + MySQL Template

This repository is a ready-to-use template for a React + Flask + MySQL web application, designed to eliminate the overhead of initial project scaffolding and environment configuration. 

**Features**: 

* Fully Dockerized production setup
* Hybrid development setup (local app + Dockerized database)
* Flask application using the factory pattern
* MySQL database with Alembic migrations
* Nginx reverse proxy for serving the frontend and API in production

**Full-stack template**:

* **Frontend**: React (Vite)
* **Backend**: Flask + SQLAlchemy + Alembic
* **Database**: MySQL
* **Reverse proxy (prod)**: Nginx
* **Containers**: Docker / Docker Compose

---

## Required Software

Make sure the following tools are installed before running the project:

* **Docker & Docker Compose**\
  Used for MySQL and production builds.\
  [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)

* **Python 3.12+**\
    Used for the Flask backend.\
    [https://www.python.org/downloads/](https://www.python.org/downloads/)

* **Node.js 20+ (includes npm)**\
  Used for the React frontend (Vite).\
  [https://nodejs.org/](https://nodejs.org/)

> ⚠️ Make sure Docker is running before executing any docker compose commands.

---

## Environment Files

You must create these locally (not committed):

* `.env.dev` → Development (local backend + frontend, Docker DB)
* `.env.prod` → Production (fully Dockerized)

Copy the examples from `.env.examples`. Make sure to set strong, unique passwords for MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD, and SECRET_KEY. Use different credentials for dev and prod.

You can generate secure values with:

```
python3 -c "import uuid; print(uuid.uuid4().hex)"
```

---

## Optional File Cleanup

While not required, the following files can be removed to reduce clutter once your environment is set up:

* Remove **`.env.examples`**\
  ⚠️ Ensure **`.env.dev`** and **`.env.prod`** are created first.

* Remove unused dev scripts:

  * **Windows users:** you may delete `run_dev.sh`
  * **Linux/macOS users:** you may delete `run_dev.ps1`

* **Do NOT delete `entrypoint.sh`**\
  This file is required for the production Docker image, even on Windows.

---

# Production Mode (Docker)

Run your web application in a consistent, production-like environment.

**Architecture (Prod)**

* MySQL → Docker
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

Add `--build` only if images changed:

```bash
docker compose --env-file .env.prod up --build
```

**Production URL:** [http://localhost](http://localhost)

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

The dev database runs in Docker, while Flask and React run locally for faster iteration, hot reloading, and easier debugging.

**Architecture (Dev)**

* MySQL → Docker
* Flask → Local machine
* React → Local machine

---

## One-Time Setup (Development)

These steps only need to be done **once per machine** (or when dependencies change).

---

### 1: Build / Pull Docker Images (DB)

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml build
```

---

### 2️: Backend Virtual Environment

From the `backend/` directory:

#### Windows

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

#### Linux / macOS

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

### 3️: Frontend Dependencies

From the `frontend/` directory:

```bash
npm install
```

---

## Daily Development Workflow

These are the commands you’ll run **every time you start working**.

---

### Start Database (Dev)

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml up
```

MySQL will be available on the host at the port defined in `.env.dev`.

---

### Start Backend (Dev)

From `backend/`:

#### Windows

```powershell
.\run_dev.ps1
```

#### Linux / macOS

```bash
./run_dev.sh
```

What this does:

* Loads `.env.dev`
* Waits for MySQL to be ready
* Runs `flask db upgrade`
* Starts the Flask app

---

### Start Frontend (Dev)

From `frontend/`:

```bash
npm run dev
```

**Dev URLs**

| Service                 | URL                                            |
| ----------------------- | ---------------------------------------------- |
| Frontend                | [http://localhost:5173](http://localhost:5173) |
| Backend                 | [http://localhost:5000/api/health](http://localhost:5000/api/health) |

---

## Database Schema Changes (During Dev)

To modify SQLAlchemy models, from `backend/`:

```bash
flask db migrate -m "describe change"
flask db upgrade
```

---

## Summary

| Mode | DB     | Backend | Frontend |
| ---- | ------ | ------- | -------- |
| Prod | Docker | Docker  | Docker   |
| Dev  | Docker | Local   | Local    |
