Audit `README.md` for accuracy against the current state of the project. Read both the README and the actual config files before reporting anything.

**What to read:**
- `README.md`
- `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.test.yml` (service names, ports, profiles)
- `.env.examples` (all required variables and their descriptions)
- `nginx/default.conf` (ports, SSL configuration)
- `CLAUDE.md` (dev workflow commands, test commands)

**What to check:**
- Every port number mentioned in the README matches the actual compose/nginx config
- Every command shown in the README (docker compose, npm, pytest, etc.) matches the actual scripts and flags used
- Every service name and URL mentioned is accurate
- The SSL/HTTPS Setup section reflects the current nginx and cert setup
- The environment variable list matches `.env.examples`
- Any architecture description matches the actual file structure

**Sections most likely to drift:** SSL/HTTPS Setup, ports table, test commands, development workflow steps.

**How to report:**
- For each inaccuracy: quote the stale README text, state what it should say, and give the source file that proves it
- For missing content: describe what should be added and why
- Do not flag sections that are accurate — only report genuine gaps or errors
- Do not rewrite the README — produce a list of changes for review first
