---
name: audit-recovery
description: Break a throwaway production-config stack on purpose (crashes, outages, full storage, restarts) and check the app fails safe and recovers on its own; review backup/restore and compromised-host readiness. Restore drills run once backups exist.
argument-hint: "[drills|review]"
disable-model-invocation: true
context: fork
---

# /audit-recovery

First read `.claude/skills/_audit-shared/RULES.md` and follow it throughout,
especially **Boundaries**: this check uses the production-config stack
(`-p app_audit`). Then read `CLAUDE.md`, plus `SOURCES.md` (its "Start with"
table's `/audit-recovery` row, and the Redis, MySQL, architecture and ops
sections it points to) and `DECISIONS.md` from the same folder as RULES.md.

This check takes about 30 minutes. Give long commands explicit timeouts, and
wait with until-loops that have deadlines (RULES.md).

**Scope:** `$ARGUMENTS`. If empty, run both parts.

## 1. drills: failure injection

Set up the production-config stack as RULES.md describes, with `--build`
and `--wait`. Certificates: follow RULES.md (use the `nginx/certs/` pair,
creating a self-signed one only if none exists). Write a small driver script
in the scratch directory that, against `https://localhost` (connect to
127.0.0.1 with SNI and Host `localhost`, skipping certificate checks; see
RULES.md on requests from the host), can: log in, create a note, list notes,
refresh, and call `/api/health`, timing each call. Production rate limits
apply: register allows 10 per hour per IP and login 5 per minute per email,
so **register a few accounts once** at the start and reuse them, rotating
logins across them. Run the driver once to establish the baseline.

For each drill: record what the user sees **during** the failure (status
codes and bodies of the driver's calls), whether the stack **recovers on its
own** once the cause is removed (and how long it takes), and whether any data
or session was **lost or corrupted**. Then reset to a healthy stack before the
next drill. Expected behavior comes from CLAUDE.md: if it promises something
(fail closed, fail fast, rate limits fall back to memory), test exactly
that. Also, for every write that got an error or timeout during a drill,
check afterward whether it committed anyway: a client told "failed" that
retries will create duplicates.

| Drill | How |
|---|---|
| Backend crash | Crash the process from inside, since Docker treats `docker kill` as a manual stop and `unless-stopped` then never restarts it: `docker exec <backend> python -c "import os,signal; os.kill(1, signal.SIGKILL)"` (the image has no `kill` or `ps`). Does the restart policy bring it back, and how fast? Separately, `up -d --force-recreate backend` (new IP): does nginx reach it without a restart (upstream re-resolution)? |
| Backend hang | `docker pause` the backend for 60s. What do clients see, and how fast (nginx timeouts)? Unpause and recheck. |
| Redis down | `docker stop` redis for 60s. Per CLAUDE.md: login answers 503 (the token can't be recorded) and refresh fails closed (treated as revoked); both must answer **promptly**, within the Redis client timeouts. Time them. Existing access tokens keep working; rate limits fall back to memory. Record the user-visible effect of each answer (does the frontend end the session?). Start it again; does the app reconnect without a restart? Are sessions intact (AOF)? |
| Redis restart | `docker restart` redis. Do refresh tokens survive (persistence)? |
| Redis crash | `docker kill` redis (no clean shutdown). With AOF `everysec`, up to a second of writes may be lost: does a session created just before survive? |
| Redis full | The `default` user is off, and the app's user can't run `ACL` or `INFO` (both `@dangerous`), so you can't read memory use. Fill under the app's own key pattern: `docker exec` into redis and use `redis-cli --user app` (password in your scratch env file) to write large values to `refresh_tokens:audit-fill-*` until **several writes in a row** are refused (memory hovers at the limit). Before filling, log in and keep that refresh token, since rotation still works under OOM (its script deletes first). Probe login, refresh with the saved token, and logout. Avoid logout-all, which wipes the test sessions. Delete the fill keys and confirm login works again. |
| MySQL hang | `docker pause` db for 60s, the most damaging DB failure. What do clients see, how long do threads stay blocked, and do healthchecks notice? Unpause and recheck. |
| MySQL down | `docker stop` db for 60s. Requests needing the DB fail fast with the API's error shape, not hang. Record what `/api/health` and the Docker healthchecks say during the outage (does anything tell an operator the DB is down?). Start it again; do pooled connections recover (pre-ping) without a backend restart? |
| MySQL restart | `docker restart` db. Is data intact? |
| Disk full | In a second short run, give `db` a size-limited `tmpfs` for its data directory (a fresh MySQL 8.4 data dir is about 209 MB; allow ~260 MB) via an override (`volumes: !reset []` plus `tmpfs`), then fill it from inside the container with a throwaway file (`MSYS_NO_PATHCONV=1` for paths in `docker exec` from Git Bash). Writes may hang rather than fail; "remove the cause" by deleting the filler file, not via SQL. Record what clients and healthchecks see. Teardown: `down -v` misses the named `db_data` volume hidden by the override, so remove `app_audit_db_data` by hand. Redis AOF and log volumes filling are reviewed on paper only. |
| nginx restart | `docker restart` nginx. Brief outage only; no config errors in logs. |
| Whole stack restart | `docker compose ... stop` then `start`, simulating a host reboot. Does everything come back, with data and sessions intact? Does `migrate` re-run harmlessly? (After a real reboot, restart policies start containers without honoring `depends_on`; that can't be tested safely on Docker Desktop, so review it on paper.) |
| Bad deploy | Recreate the backend with a startup failure that needs no code change: a `SECRET_KEY` under 32 characters in the scratch env file (`up -d --force-recreate backend`). Does it refuse to start, does nginx answer with the JSON 5xx body, and does restoring the key bring it back? |

Also read the logs (`docker compose ... logs`) after each drill: are
failures logged clearly enough that an operator would know what happened?

Tear the stack down (`down -v`) when finished, even if a drill failed.

## 2. review: readiness on paper

- **Backups and restore:** DECISIONS.md lists backups as a known gap. Until a
  backup procedure exists, report "Restore drill: blocked, no backups" under
  *Skipped*, and review only what a backup would need: which volumes hold
  state (MySQL, Redis AOF), what can be lost without harm (rate-limit
  counters), consistent MySQL dumps (`--single-transaction`), and the 3-2-1
  rule. Once a backup procedure exists in the repo or README, this part must
  instead restore the most recent backup into a fresh `app_audit` stack and run
  the driver script against it.
- **Compromised host:** if an attacker gets a shell in each container (nginx,
  backend, db, redis) or on the host, what can they reach and what must be
  rotated? Is the rotation procedure documented (SECRET_KEY invalidates all
  tokens; DB and Redis passwords; TLS key)? Is there a way to revoke every
  session at once?
- **Operator documentation:** does README tell an operator how to restart,
  roll back a bad deploy, rotate secrets, and read logs? Missing runbook steps
  are findings.

## Out of scope
Fixing anything. Live production drills: there is no deployment, and drills
never run against production even once there is.

Write the report as RULES.md describes, with ID prefix `REC`. Include a table
of the drills with columns: drill, during, recovered (yes/no, time), data
lost, verdict.
