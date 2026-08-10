Audit project dependencies for security vulnerabilities and unnecessary packages.

**Python — CVE scan**
Run the following in the backend virtualenv:
```bash
cd backend && source .venv/bin/activate && pip install pip-audit --quiet && pip-audit -r requirements.txt
```
- Report any vulnerabilities found, severity, affected package, and recommended fix version
- Treat critical and high severity as blockers

**JavaScript — CVE scan**
Run:
```bash
cd frontend && npm audit
```
- Report any vulnerabilities found, severity, affected package, and recommended fix
- Treat critical and high severity as blockers

**Python — unused packages**
Compare every package in `backend/requirements.txt` against actual `import` statements across `backend/app/`:
- Flag any package with no apparent usage in application code
- Note: some packages register Flask extensions implicitly (e.g., `flask-migrate`) — verify before flagging

**JavaScript — unused packages**
Compare `dependencies` and `devDependencies` in `frontend/package.json` against actual imports across `frontend/src/`:
- Flag any package with no apparent usage
- Note: some packages are used via config files (e.g., Vite plugins, Playwright) — verify before flagging

**Test-only packages in main dependencies**
- Python: flag any package in `requirements.txt` (non-dev section) that is only used in `backend/tests/`
- JavaScript: flag any package in `dependencies` (not `devDependencies`) that is only used in tests

Produce a prioritized list: blockers first (CVEs), then cleanup opportunities.
