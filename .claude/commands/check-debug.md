Scan for debug statements and debug configuration that must be removed before publishing.

**Python debug statements in `backend/app/`** (not in tests)
Grep for:
- `print(` — list every occurrence with file:line and the content of the line
- `pprint(`
- Known issue: `backend/app/__init__.py` contains a large debug print block (approx lines 41–87) with a `DEBUG: Redis Initialization` header — this entire block must be removed

**JavaScript debug statements in `frontend/src/`** (not in `__tests__/` or `e2e/`)
Grep for:
- `console.log(`
- `console.warn(`
- `console.error(` — flag only those that appear to be debug output, not intentional error boundary logging
- `debugger`

**Debug configuration**
- Check `backend/app/config.py`: confirm `FLASK_DEBUG = False` in `ProductionConfig` and that no other config class sets it to `True` unexpectedly
- Check `docker-compose.yml`: confirm no `FLASK_DEBUG=true` or `FLASK_ENV=development` in the production compose file
- Check `nginx/nginx.conf` and `nginx/default.conf`: confirm no `error_log` set to `debug` level

Report every finding with file:line. For each `print()` block, note whether it is a single line or a multi-line debug block.
