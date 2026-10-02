Audit environment variable definitions and usage for completeness and correctness.

**Read these files first:**
- `.env.dev.example`, `.env.test.example`, `.env.prod.example`
- `backend/app/config.py`

**Every variable in the `.env.*.example` files must have:**
- A corresponding `os.getenv()` call in `config.py`
- A presence check (raises `ValueError` if missing) for variables that are required at runtime
- Flag any variable listed in the `.env.*.example` files with no corresponding usage in `config.py`

**Every variable used in `config.py` must appear in the `.env.*.example` files:**
- Grep `backend/app/config.py` for all `os.getenv(` calls
- For each variable found, verify it appears in the `.env.*.example` files
- Flag any variable the app requires that is absent from an `.env.*.example` file (would silently break a new setup)

**TestingConfig correctness:**
- `TestingConfig` sets `SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'` and `REDIS_ENABLED = False`
- Verify that the base `Config.__init__()` required-variable checks do not break when running under `TestingConfig`
- If `TestingConfig` inherits checks for Redis or DB variables that are irrelevant in test mode, flag this

**`.env.*.example` content safety:**
- Confirm the dev and prod examples contain only placeholder values (e.g., `your_password_here`); the test example holds throwaway test credentials by design
- Flag any line that looks like a real credential, key, or token

Report each finding with the variable name, the file where the issue exists, and a recommended fix.
