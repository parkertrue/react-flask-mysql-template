# Audit decisions

Choices an audit would otherwise flag, recorded so every run stops re-raising
them. Each entry says what was chosen and why. A check reports an entry here
only if its **Revisit when** condition has come true, or the code no longer
matches the entry (then the entry is stale and that is the finding).

Add an entry when a finding is deliberately kept as-is. Delete one when the
code changes so it no longer applies.

## Accepted trade-offs

**Access token in localStorage.** The 15-minute access token is readable by
any XSS; the refresh token stays in an HttpOnly cookie. Mitigated by the short
expiry, the CSP, and React's escaping. Keeps the client simple: no cookie for
API calls, so no CSRF on them. See the comment in `frontend/src/auth/storage.js`.
*Revisit when:* the app renders third-party or user-supplied HTML.

**Register answers 409 for a taken email.** This tells an attacker an
account exists. Accepted for the clearer sign-up message; register is rate
limited per IP, and login timing no longer leaks it (dummy hash).
*Revisit when:* email verification exists. Then register can answer the same
way for both and send a "you already have an account" email instead.

**No refresh-token reuse detection.** A replayed, already rotated refresh token
gets 401 `AUTH_TOKEN_REVOKED`, but does not revoke the rest of that user's
sessions. Revoking on reuse would also log out a second tab that lost the
rotation race. *Revisit when:* the app holds data that justifies logging users
out on a false positive.

**No per-IP quota on the whole API.** Only login, register and refresh have
Flask limits; users sharing an address (offices, carrier NAT) would lock each
other out. nginx's per-IP `limit_req`/`limit_conn` on `/api` is the coarse
backstop.

**Rate limits fall back to per-worker memory while Redis is down.** Limits get
looser (per worker, reset on restart) instead of every limited route failing.

**User text stored verbatim.** No server-side sanitizing; output escaping is
the render layer's job (React escapes text). Sanitizing on input corrupts data
and still misses other output contexts.

**No CORS.** The browser only calls a relative `/api`, same-origin in every
environment. Adding CORS would only widen what can call the API.

**gixy-ng skips `hsts_header` and `try_files_is_evil_too`.** HSTS is
meaningless on the port-80 redirect server (RFC 6797 8.1) and is asserted
over HTTPS by `e2e/nginx.spec.js`; the `try_files` warning is a performance
opinion that doesn't matter for a few static files. See the `nginx` job in
`.github/workflows/ci.yml`.

**Dev keeps a debug toggle.** `.env.dev` turns Flask debug on; `FLASK_DEBUG=0
./run_dev.sh` turns it off for one run. Production forces it off in
`ProductionConfig`.

**No mutation-testing tool.** New tests are mutation-checked by hand (CLAUDE.md
Test Architecture). *Revisit when:* the suites grow past what spot checks can
cover; mutmut and Stryker are the candidates (SOURCES.md, Testing).

## Deferred until the app grows

**TanStack Query.** It would replace the hand-written loading, error and
pagination code in `useNotes` and `useHealth`, but it costs a dependency and a
provider, needs retry and refetch-on-focus defaults turned off, and must be
cleared on logout. *Revisit when:* there are several server lists, or data
shared across pages.

**React 19 form actions (`<form action>`, `useActionState`).** In a
client-only SPA React resets the form after every submit (a failed login would
wipe the email), and live error clearing and the note character counter need
controlled inputs anyway. The real gains need server rendering. *Revisit
when:* the app adopts a server-rendering framework.

## Known gaps (open work, not new findings)

A check mentions these only when its findings bear on one (for example, the
recovery check is blocked by the missing backups). They are not new findings.

- **Notes update/delete.** The API has GET and POST only; `updateNote` and
  `deleteNote` in `features/notes/notesService.js` are commented out, and the
  `can update a note` / `can delete a note` E2E tests assert nothing until the
  feature exists. When it lands, those tests must assert.
- **Account deletion** on `AccountPage`; **email verification**.
- **No deployment yet**, so these don't exist: automated backups and a
  restore procedure, server hardening (SSH, firewall, Fail2ban), certificate
  auto-renewal, CD, monitoring, centralized logging, a CDN.
- **TLS between containers and encryption at rest** (MySQL volume, Redis,
  backups) are undecided.
