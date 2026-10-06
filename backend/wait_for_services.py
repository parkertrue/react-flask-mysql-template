"""Block until MySQL and Redis accept connections, or exit 1 after a timeout.

Run before `flask db upgrade` by entrypoint.sh (containers) and run_dev.sh
(local dev). Reads the same environment variables as app/config.py.
"""
import os
import sys
import time

import pymysql
import redis

TIMEOUT_SECONDS = int(os.getenv("WAIT_FOR_SERVICES_TIMEOUT", "60"))


def mysql_ready():
    try:
        pymysql.connect(
            host=os.getenv("MYSQL_HOST"),
            port=int(os.getenv("MYSQL_PORT", "3306")),
            user=os.getenv("MYSQL_USER"),
            password=os.getenv("MYSQL_PASSWORD"),
            database=os.getenv("MYSQL_DATABASE"),
            connect_timeout=2,
        ).close()
        return True
    except Exception:
        return False


def redis_ready():
    try:
        client = redis.Redis(
            host=os.getenv("REDIS_HOST"),
            port=int(os.getenv("REDIS_PORT", "6379")),
            username=os.getenv("REDIS_USERNAME", "default"),
            password=os.getenv("REDIS_PASSWORD"),
            db=int(os.getenv("REDIS_DB", "0")),
            socket_connect_timeout=2,
        )
        client.ping()
        client.close()
        return True
    except Exception:
        return False


def main():
    deadline = time.monotonic() + TIMEOUT_SECONDS
    while True:
        waiting = [name for name, ready in (("MySQL", mysql_ready), ("Redis", redis_ready))
                   if not ready()]
        if not waiting:
            print("Database and Redis are up")
            return
        if time.monotonic() > deadline:
            print(f"Gave up after {TIMEOUT_SECONDS}s waiting for: {', '.join(waiting)}",
                  file=sys.stderr)
            sys.exit(1)
        print(f"Waiting for: {', '.join(waiting)}")
        time.sleep(1)


if __name__ == "__main__":
    main()
