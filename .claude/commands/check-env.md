Audit environment variable definitions and usage for completeness and correctness.

**Read these files first:**
- `.env.dev`, `.env.test` (committed, throwaway values), `.env.prod.example`
- `backend/app/config.py`, `backend/wait_for_services.py`
- The `environment:` blocks in `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.test.yml`

**Every variable in an env file must be read somewhere:**
- By `config.py` / `wait_for_services.py` (`os.getenv()`), or interpolated by a compose file (`${VAR}`)
- Flag any variable nothing reads, and any variable set to the same value as its code default (redundant)

**Every variable the app requires must reach it in each environment:**
- Grep `config.py` for `os.getenv(` calls without a default
- Dev: present in `.env.dev`. Integration tests: present in `.env.test`.
- Prod and E2E: listed in the backend service's `environment:` block (`docker-compose.yml`, `docker-compose.test.yml`) and, unless fixed there, present in `.env.prod.example` / `.env.test`
- `.env.prod.example` holds only per-deployment values; hosts, ports and `FLASK_ENV` belong in `docker-compose.yml`

**Least privilege:**
- Backend services must use an explicit `environment:` list, never `env_file:`, so `MYSQL_ROOT_PASSWORD` stays out of the backend container

**TestingConfig correctness:**
- `TestingConfig` sets `SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'` and `REDIS_ENABLED = False`
- Verify that the base `Config.__init__()` required-variable checks do not break when running under `TestingConfig`
- If `TestingConfig` inherits checks for Redis or DB variables that are irrelevant in test mode, flag this

**Env file content safety:**
- `.env.prod.example` contains only placeholder values (e.g., `your_password_here`)
- `.env.dev` and `.env.test` hold obviously throwaway values by design; flag anything in them that looks like a real credential, key, or token
- `.env.prod` is gitignored and not tracked (`git ls-files .env.prod` is empty)

Report each finding with the variable name, the file where the issue exists, and a recommended fix.
