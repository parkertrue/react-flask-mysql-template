Run the full pre-publish checklist. Execute each check in sequence and produce a consolidated report.

Run the following slash commands one at a time, wait for each to complete, then continue:

1. `/check-debug` — debug statements and debug config
2. `/check-comments` — unresolved TODOs and temporary comments
3. `/check-env` — environment variable completeness
4. `/check-ignores` — .gitignore and .dockerignore gaps
5. `/security` — security vulnerabilities (runs as subagent with opus)
6. `/check-tests` — test coverage audit
7. `/check-deps` — dependency CVEs and unused packages
8. `/check-obsolete` — dead code and unused files
9. `/check-readme` — README accuracy

After all checks complete, produce a **consolidated summary** with three sections:

**Blockers** — must be fixed before publishing:
- Any critical or high severity security finding
- Any critical or high CVE in dependencies
- Any failing tests
- Debug print blocks in production code
- Hardcoded secrets or credentials
- Unresolved NOCOMMIT comments

**Should Fix** — important but not blocking a release:
- Medium severity security findings
- Missing test coverage for new code
- Stale README sections
- TODO/FIXME comments
- Unused dependencies
- Orphaned files

**Optional / Low Priority:**
- Low severity findings
- Minor comment cleanup
- Speculative dependency pruning

State clearly: **READY TO PUBLISH** or **BLOCKED — N issues require resolution** at the top of the summary.
