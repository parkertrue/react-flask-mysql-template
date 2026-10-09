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
(`-p app_audit`). Then read `CLAUDE.md`, plus `SOURCES.md` (Recovery row,
Redis persistence, MySQL Backup and Recovery, SRE) and `DECISIONS.md` from
the same folder as RULES.md.

**Scope:** `$ARGUMENTS`. If empty, run both parts.

## 1. drills: failure injection

Set up the production-config stack as RULES.md describes, with `--build`
and `--wait`. Use the existing `nginx/certs/` pair if present; otherwise make a
self-signed one in the scratch directory and mount it with the override file,
never writing into the repository. Write a small driver script in the scratch
directory that, against `https://localhost` (Host `localhost`, `-k`), can:
register a user, log in, create a note, list notes, refresh, and call
`/api/health`. Run it once to establish the baseline.

For each drill: record what the user sees **during** the failure (status
codes and bodies of the driver's calls), whether the stack **recovers on its
own** once the cause is removed (and how long it takes), and whether any data
or session was **lost or corrupted**. Then reset to a healthy stack before the
next drill. Expected behavior comes from CLAUDE.md: if it promises something
(fail closed, 503 not hang, rate limits fall back to memory), test exactly
that.

| Drill | How |
|---|---|
| Backend crash | `docker kill` the backend container. Does `restart: unless-stopped` bring it back? Does nginx reach the new one without a restart (upstream re-resolution)? |
| Backend hang | `docker pause` the backend for 60s. What do clients see, and how fast (nginx timeouts)? Unpause and recheck. |
| Redis down | `docker stop` redis for 60s. Login and refresh should answer 503 promptly; existing access tokens keep working; rate limits fall back. Start it again; does the app reconnect without a restart? Are sessions intact (AOF)? |
| Redis restart | `docker restart` redis. Do refresh tokens survive (persistence)? |
| Redis full | The `default` user is off and the app's user cannot run `ACL`, so fill Redis under the app's own key pattern: `docker exec` into redis and use `redis-cli --user app` (the password is in your scratch env file) to write large throwaway values to `refresh_tokens:audit-fill-*` until writes fail. What do login and refresh do under `noeviction`? Delete the keys and confirm login works again. |
| MySQL down | `docker stop` db for 60s. Requests needing the DB fail fast with the API's error shape, not hang; `/api/health` reports it? Start it again; do pooled connections recover (pre-ping) without a backend restart? |
| MySQL restart | `docker restart` db. Is data intact? |
| Disk full | Simulate a full MySQL volume if it can be done safely (for example, an override with a small `tmpfs` or size-limited volume for `db_data` in a second short run). If not safe or not possible, review instead what happens when the disk fills: MySQL, Redis AOF, Docker logs (rotation settings), nginx logs. |
| nginx restart | `docker restart` nginx. Brief outage only; no config errors in logs. |
| Whole stack restart | `docker compose ... stop` then `start`, simulating a host reboot. Does everything come back in dependency order, with data and sessions intact? Does `migrate` re-run harmlessly? |
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
