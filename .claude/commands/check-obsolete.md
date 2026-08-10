Identify dead code, unused files, and unnecessary dependencies in this project. Read source files before drawing conclusions — do not guess.

**Unused imports**
- Python: for each file in `backend/app/`, check for imports that are never referenced in that file
- JavaScript: for each file in `frontend/src/`, check for imports that are never referenced in that file

**Dead routes**
- List every blueprint route defined in `backend/app/routes/`
- Verify each is either called from `frontend/src/api/` or documented as internal-only
- Flag any route that appears unreachable

**Unused frontend components**
- List every component file in `frontend/src/components/`
- Check whether each is imported anywhere in the codebase
- Flag any component with no imports

**Orphaned test files**
- For each test file in `backend/tests/` and `frontend/src/**/__tests__/`, verify its corresponding source file still exists
- Flag any test file whose source has been removed or renamed

**Unused dependencies**
- Python: compare every package in `backend/requirements.txt` against actual imports across `backend/app/` — flag packages with no apparent usage
- JavaScript: compare every package in `frontend/package.json` `dependencies` and `devDependencies` against actual imports across `frontend/src/` — flag packages with no apparent usage

**Temporary and debug files**
- Flag any file that appears to be temporary or development-only and not part of the application:
  - Any file matching `debug_*.py`, `test_*.py` outside the `tests/` directory, `scratch.*`, `tmp.*`
  - Any planning or audit document left at the repo root (`*-plan.md`, `*-audit.md`, `NOTES.md`)

**Stale migrations**
- List migration files in `backend/migrations/versions/`
- Flag any that appear to be duplicates or whose changes are already superseded

Report each finding with the file path and a clear recommendation: delete, move, or keep with explanation.
