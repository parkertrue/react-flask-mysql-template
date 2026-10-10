"""Block until MySQL and Redis accept connections, or exit 1 after a timeout.

Run by entrypoint.sh before the container's command (gunicorn, or the
migrate service's `flask db upgrade`) and by run_dev.sh (local dev). Reads
the same environment variables as app/config.py.
"""
import os
import sys
import time

import pymysql
import redis

TIMEOUT_SECONDS = int(os.getenv('WAIT_FOR_SERVICES_TIMEOUT', '60'))

# Checked up front: a missing value would otherwise look like a service that
# never comes up, and the loop below would wait out the whole timeout.
REQUIRED = ('DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
            'REDIS_HOST', 'REDIS_USERNAME', 'REDIS_PASSWORD')


def mysql_ready():
    try:
        pymysql.connect(
            host=os.environ['DB_HOST'],
            port=int(os.getenv('DB_PORT', '3306')),
            user=os.environ['DB_USER'],
            password=os.environ['DB_PASSWORD'],
            database=os.environ['DB_NAME'],
            connect_timeout=2,
        ).close()
        return True
    except Exception:
        return False


def redis_ready():
    try:
        client = redis.Redis(
            host=os.environ['REDIS_HOST'],
            port=int(os.getenv('REDIS_PORT', '6379')),
            username=os.environ['REDIS_USERNAME'],
            password=os.environ['REDIS_PASSWORD'],
            db=int(os.getenv('REDIS_DB', '0')),
            socket_connect_timeout=2,
        )
        client.ping()
        client.close()
        return True
    except Exception:
        return False


def main():
    missing = [name for name in REQUIRED if not os.getenv(name)]
    if missing:
        sys.exit(f"Missing required environment variables: {', '.join(missing)}")

    deadline = time.monotonic() + TIMEOUT_SECONDS
    while True:
        waiting = [name for name, ready in (('MySQL', mysql_ready), ('Redis', redis_ready))
                   if not ready()]
        if not waiting:
            print('Database and Redis are up')
            return
        if time.monotonic() > deadline:
            print(f"Gave up after {TIMEOUT_SECONDS}s waiting for: {', '.join(waiting)}",
                  file=sys.stderr)
            sys.exit(1)
        print(f"Waiting for: {', '.join(waiting)}")
        time.sleep(1)


if __name__ == '__main__':
    main()
