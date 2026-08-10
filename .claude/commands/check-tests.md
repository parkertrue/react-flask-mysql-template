Perform a comprehensive test coverage audit for this project. Read actual source files and test files — do not guess at coverage.

**Backend unit tests (`backend/tests/unit/`)**
- For every file in `backend/app/routes/`, verify a corresponding test file exists in `backend/tests/unit/test_routes/`
- For every file in `backend/app/models/`, verify a corresponding test file exists in `backend/tests/unit/test_models/`
- For every file in `backend/app/schemas/`, verify a corresponding test file exists in `backend/tests/unit/test_schemas/`
- For every file in `backend/app/utils/`, verify a corresponding test file exists in `backend/tests/unit/test_utils/`
- For each test file that exists, check that it covers: happy path, auth failure (where applicable), validation failure (where applicable), and at least one edge case
- Run `cd backend && ./run_tests.sh unit` and report pass/fail and coverage percentage

**Backend integration tests (`backend/tests/integration/`)**
- Verify Redis-dependent behavior (token blocklist, caching) has integration test coverage
- Verify the full auth flow (register → login → refresh → logout) is tested against real MySQL + Redis
- Run `cd backend && ./run_tests.sh integration` and report pass/fail

**Frontend unit tests (`frontend/src/**/__tests__/`)**
- For every component in `frontend/src/components/`, verify a co-located `__tests__/` directory with at least one test file exists
- For every hook in `frontend/src/hooks/`, verify a test file exists in `frontend/src/hooks/__tests__/`
- For every utility in `frontend/src/utils/`, verify a test file exists
- For every API service in `frontend/src/api/services/`, verify a test file exists
- Check that MSW handlers cover all API endpoints used by components under test
- Check that error states (network failure, 401, 422, 500) are tested alongside happy paths
- Run `cd frontend && npm run test:run` and report pass/fail and coverage percentage

**E2E tests (`frontend/e2e/`)**
- Verify these user journeys are covered: register, login, note CRUD operations, logout
- Check whether auth failure and session expiry scenarios are covered
- Report any critical user paths with no E2E coverage (do not run E2E — they require Docker)

**Summary**
- List every source file added or modified recently that has no test coverage
- List any test files whose source file no longer exists (orphaned tests)
- State the overall coverage status: passing, gaps found, or failing
