Audit comments across all source files in `backend/app/` and `frontend/src/`. Do not check test files or node_modules.

**Unresolved temporary comments — must all be addressed before publishing**
Grep for the following patterns (case-insensitive) and list every match with file:line:
- `TODO`, `FIXME`, `HACK`, `XXX`, `NOCOMMIT`
- Comments that look like dev notes left during development (e.g., `# ADD DEBUG OUTPUT`, `# Make sure int() is here`, `# Initialize extensions` above obvious code)
- Commented-out blocks of code (multiple consecutive commented lines that look like disabled code)

For each finding: quote the comment, give the file:line, and recommend: resolve, delete, or convert to proper documentation.

**Over-commenting**
Flag lines or blocks where the comment just restates what the code literally does and adds no information. Example: `# Initialize extensions` above `jwt.init_app(app)`. These should be deleted.

**Under-commenting**
Flag complex logic that has no explanation and genuinely needs one:
- Non-obvious auth flows or token validation logic
- Redis blocklist behavior
- Any conditional logic where the "why" is not obvious from the code
- Non-standard config interactions

**Rule:** Every flagged item must be resolved — do not leave temporary comments for later. Produce a prioritized list of changes.
