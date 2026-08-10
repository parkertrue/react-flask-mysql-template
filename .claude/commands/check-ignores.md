Audit `.gitignore` and `.dockerignore` for completeness and consistency.

**Diff the two files**
- List every entry in `.gitignore` that is absent from `.dockerignore` — explain whether this is intentional or an oversight
- List every entry in `.dockerignore` that is absent from `.gitignore` — explain whether this is intentional or an oversight

**Verify required entries are present in both files**
Check that the following are covered (where they exist in this project):
- `.env.dev`, `.env.prod`, `.env.test`
- `nginx/certs/`
- `backend/.venv/`
- `backend/.coverage`, `backend/.pytest_cache/`
- `frontend/node_modules/`, `frontend/coverage/`, `frontend/playwright-report/`, `frontend/test-results/`
- `__pycache__/`
- Any `*.pem`, `*.key`, `*.crt`, `*.p12` certificate files

**Scan for sensitive untracked files**
Run `git status --porcelain` and flag any untracked files that look sensitive:
- `*.env`, `*.pem`, `*.key`, `*.p12`, `*.crt`, `*.pfx`, `id_rsa`, `debug_*.py`

**Rules:**
- Do not suggest adding entries speculatively — only flag actual gaps for file types that exist in this project
- Keep both files as minimal as possible
- If a gap is intentional (e.g., README.md excluded from Docker but not git), confirm and explain why
