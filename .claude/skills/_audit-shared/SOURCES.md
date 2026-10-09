# Best-practice sources

The outside references the `/audit-*` checks measure this template against. For each layer: the authoritative source
first, then opinionated guides, then tools. "Here:" notes say where the source
applies to this template. Last reviewed 2026-10-09; URLs move, so confirm a
link before citing it.

Ground rules when using these:
- Official docs and OWASP outrank blog posts and community repos.
- A guide's advice is a prompt to check, not an order. This template aims for
  lean, so adopt something only when it fixes a real gap.
- Several guides cover frameworks next to ours (FastAPI, Postgres). Take the
  principles, not the specifics.

---

## Cross-cutting: security (start here for the security check)

- **OWASP Cheat Sheet Series**: https://cheatsheetseries.owasp.org
  The most useful single source for this app. The sheets that map onto it:
  - JSON Web Token for Java (the JWT pitfalls apply to any language): access/refresh tokens, revocation
  - Session Management, Authentication, Password Storage, Forgot Password (for future account features)
  - REST Security, Input Validation, Mass Assignment, Error Handling, Logging
  - HTTP Headers, Content Security Policy, Cross-Site Request Forgery, XSS Prevention
  - Docker Security, NodeJS/npm Security, Secrets Management, Denial of Service
- **OWASP ASVS** (Application Security Verification Standard):
  https://owasp.org/www-project-application-security-verification-standard/
  A checklist of verifiable requirements, organized by level. Level 2 is a
  sensible target for "production-grade". Good for spotting what's *missing*,
  not just what's wrong.
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/ (headline risks)
- **OWASP Web Security Testing Guide (WSTG)**:
  https://owasp.org/www-project-web-security-testing-guide/
  The method behind the pen-test checklist below.
- **OWASP Testing Checklist**: https://github.com/tanprathan/OWASP-Testing-Checklist
  (the method `/audit-security` follows)

## Cross-cutting: architecture and operations

- **The Twelve-Factor App**: https://12factor.net
  Config in env vars, dev/prod parity, disposable processes, logs as streams.
  Here: the env-file layout, the `APP_ENV` switch, and stateless backend containers.
- **Google SRE books** (free online): https://sre.google/books/
  Monitoring, alerting, and postmortems; relevant to monitoring
  and to `/audit-recovery`.
- **tiangolo / full-stack-fastapi-template**: https://github.com/fastapi/full-stack-fastapi-template
  The closest whole-template analog (React + Python API + SQL + Docker +
  proxy). Compare decisions, not code: what it includes that this lacks,
  and vice versa.

---

## React / frontend

- **React docs**: https://react.dev
  Especially "You Might Not Need an Effect" (https://react.dev/learn/you-might-not-need-an-effect)
  and the Rules of React.
- **React Router docs**: https://reactrouter.com (data routers, errorElement, loaders)
- **Vite docs**: https://vite.dev (build, env variables, proxy)
- **bulletproof-react**: https://github.com/alan2207/bulletproof-react
  Feature folders, one-way imports, API layer, testing. Here: `features/`
  layout and the import direction rules in CLAUDE.md came from this.
- **TanStack Query docs**: https://tanstack.com/query/latest
  For deciding when hand-written data hooks should give way to a query library.
- **Accessibility**
  - WCAG 2.2 Quick Reference: https://www.w3.org/WAI/WCAG22/quickref/
  - WAI-ARIA Authoring Practices Guide (APG): https://www.w3.org/WAI/ARIA/apg/
    (patterns for dialogs, menus, live regions)
  - axe-core rules: https://github.com/dequelabs/axe-core (what e2e/accessibility.spec.js runs)
  - MDN Accessibility: https://developer.mozilla.org/en-US/docs/Web/Accessibility

## Flask / Python backend

- **Flask docs**: https://flask.palletsprojects.com/en/stable/
  - Patterns for Flask (app factory, blueprints, config): /patterns/
  - Security Considerations: /web-security/ (cookies, headers, XSS)
  - Deploying to Production: /deploying/
- **Miguel Grinberg's Flask Mega-Tutorial**: https://blog.miguelgrinberg.com
  The canonical long-form guide to structuring a Flask app.
- **cookiecutter-flask**: https://github.com/cookiecutter-flask/cookiecutter-flask
  A maintained, opinionated project skeleton to compare against.
- **zhanymkanov / fastapi-best-practices**: https://github.com/zhanymkanov/fastapi-best-practices
  The nearest Python analog to bulletproof-react. Project layout, Pydantic
  schema layering, config, and testing all carry over to Flask.
- **Extension docs** (the app's actual dependencies):
  - Flask-JWT-Extended: https://flask-jwt-extended.readthedocs.io (blocklist, refresh, CSRF double-submit)
  - Flask-Limiter: https://flask-limiter.readthedocs.io (key functions, storage fallback)
  - Pydantic: https://docs.pydantic.dev
  - Gunicorn: https://docs.gunicorn.org (Design page for worker types, Settings page)
- **Python tooling**
  - Ruff rules: https://docs.astral.sh/ruff/rules/ (rule sets worth enabling)
  - pytest Good Integration Practices: https://docs.pytest.org/en/stable/explanation/goodpractices.html
  - pip-tools (the lock workflow): https://pip-tools.readthedocs.io

## MySQL / SQLAlchemy

- **SQLAlchemy 2.0 docs**: https://docs.sqlalchemy.org/en/20/
  "Session Basics" (session lifecycle) and "Connection Pooling" (pool_pre_ping, dropped connections).
- **Alembic docs**: https://alembic.sqlalchemy.org (autogenerate limits, migration hygiene)
- **Use The Index, Luke**: https://use-the-index-luke.com
  Indexing in plain language. Its "No Offset" page explains the keyset
  pagination the notes list uses.
- **MySQL 8.4 Reference Manual**: https://dev.mysql.com/doc/refman/8.4/en/
  The Security chapter (general guidelines, account privileges, encrypted
  connections) covers TLS inside the Docker network and encryption at rest.
  The Backup and Recovery chapter is for `/audit-recovery`.

## Redis

- **Redis docs**: https://redis.io/docs/
  - Security and ACL pages (the app's `app` ACL user, disabled `default` user)
  - Persistence (RDB vs AOF): for encryption at rest and `/audit-recovery`
  - Anti-patterns / best-practices pages (key naming, large keys, KEYS command)
- **Redis eviction policies** (in the same docs): why this app runs `noeviction`

## Nginx

- **nginx docs**: https://nginx.org/en/docs/ (the directive reference is the authority)
- **h5bp / server-configs-nginx**: https://github.com/h5bp/server-configs-nginx
  The real "bulletproof nginx": modular, commented configs for security
  headers, caching, and compression. Compare `security_headers.conf` and the
  caching rules against it.
- **Mozilla SSL Configuration Generator**: https://ssl-config.mozilla.org
  The TLS block at the top of `templates/default.conf.template` follows its
  "intermediate" profile; regenerate and diff periodically.
- **Mozilla Server Side TLS guidelines**: https://wiki.mozilla.org/Security/Server_Side_TLS
- **nginx "Pitfalls and Common Mistakes"** (search that title; the old wiki moved).
  Covers the add_header inheritance trap, `if` in location, and root inside location.
- **gixy-ng**: https://github.com/dvershinin/gixy (runs in CI: the "Nginx config" job)
- **Over-the-wire checks against the deployed site**:
  - Mozilla HTTP Observatory: https://developer.mozilla.org/en-US/observatory
  - Qualys SSL Labs: https://www.ssllabs.com/ssltest/
  - securityheaders.com: https://securityheaders.com

## Docker / Compose

- **Docker build best practices**: https://docs.docker.com/build/building/best-practices/
- **Compose file reference**: https://docs.docker.com/reference/compose-file/
- **OWASP Docker Security Cheat Sheet** (in the Cheat Sheet Series above)
- **hadolint**: https://github.com/hadolint/hadolint (runs in CI: the "Dockerfiles" job)
- **Docker Bench for Security**: https://github.com/docker/docker-bench-security
  Run on the production host. It checks the daemon and running containers
  against the CIS Docker Benchmark.
- **CIS Benchmarks** (Docker, Ubuntu/Linux, NGINX): https://www.cisecurity.org/cis-benchmarks
  Free PDFs with registration; for the server-hardening check.

## Testing

- **Testing Library guiding principles**: https://testing-library.com/docs/guiding-principles
- **Kent C. Dodds, "Common mistakes with React Testing Library"**:
  https://kentcdodds.com/blog/common-mistakes-with-react-testing-library
- **MSW docs**: https://mswjs.io/docs (best practices section)
- **Vitest docs**: https://vitest.dev
- **Playwright best practices**: https://playwright.dev/docs/best-practices
- **pytest docs**: https://docs.pytest.org (fixtures, strict mode)
- **Mutation testing**: mutmut (https://github.com/boxed/mutmut) for Python,
  Stryker (https://stryker-mutator.io) for JS. Automates the "break the code,
  watch it fail" rule in CLAUDE.md, if manual checks stop scaling.

## CI / supply chain

- **GitHub Actions security hardening guide**: docs.github.com, search
  "Security hardening for GitHub Actions" (pinning, permissions, untrusted input).
- **zizmor**: https://github.com/zizmorcore/zizmor
  A static analyzer for GitHub Actions workflows (runs in CI: the "Workflows" job).
- **OpenSSF Scorecard**: https://github.com/ossf/scorecard (repo-level supply-chain checks)
- **Dependabot docs**: docs.github.com, "Dependabot version updates"

## Production / ops (for deploying the template)

- **Certbot / Let's Encrypt**: https://certbot.eff.org and https://letsencrypt.org/docs/ (automated renewal)
- **Linux server hardening**: CIS Ubuntu Benchmark (above); Fail2ban docs
  (https://github.com/fail2ban/fail2ban); `ufw` in the Ubuntu Server docs
- **Cloudflare docs**: https://developers.cloudflare.com, "Restoring original
  visitor IPs" (a CDN hop means updating TRUSTED_PROXY_COUNT and nginx real_ip)
- **Prometheus / Grafana**: https://prometheus.io/docs/practices/
- **Backups**: the 3-2-1 rule (3 copies, 2 media, 1 off-site); MySQL manual's
  Backup and Recovery chapter; Redis persistence docs (`/audit-recovery`)

---

## Which sources each check starts with

| Check | Start with |
|---|---|
| `/audit-infra` | The layer's section above; diff config against h5bp (nginx), Mozilla SSL generator (TLS), Docker best practices, bulletproof-react / fastapi-best-practices (structure), 12factor (config) |
| `/audit-tests` | Testing section; pytest good practices; Testing Library principles; Playwright best practices |
| `/audit-security` | OWASP ASVS L2 + Cheat Sheets; WSTG / Testing Checklist; once deployed: Observatory + SSL Labs against the site, Docker Bench + CIS on the host |
| `/audit-recovery` | MySQL Backup and Recovery chapter; Redis persistence; SRE book chapters on postmortems and data integrity |
| `/audit-a11y` | WCAG 2.2 quick reference; WAI-ARIA APG |
| `/audit-infra` (bottlenecks) | Use The Index, Luke; Gunicorn Design page; SQLAlchemy pooling |
| `/audit-code`, `/audit-docs`, `/audit-scaffold` | CLAUDE.md (the spec) and the layer sections above |
