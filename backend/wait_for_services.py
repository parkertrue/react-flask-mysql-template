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

# Matches the backend healthcheck's start_period (docker-compose.yml and
# docker-compose.test.yml), which covers this wait: change them together.
TIMEOUT_SECONDS = 60

# Checked up front: a missing value would otherwise look like a service that
# never comes up, and the loop below would wait out the whole timeout.
REQUIRED = ('DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
            'REDIS_HOST', 'REDIS_USERNAME', 'REDIS_PASSWORD')


def describe(error):
    return str(error) or type(error).__name__


def mysql_error():
    """None once MySQL accepts the app's login, else why it does not"""
    try:
        pymysql.connect(
            host=os.environ['DB_HOST'],
            port=int(os.getenv('DB_PORT', '3306')),
            user=os.environ['DB_USER'],
            password=os.environ['DB_PASSWORD'],
            database=os.environ['DB_NAME'],
            connect_timeout=2,
        ).close()
        return None
    except Exception as error:
        return describe(error)


def redis_error():
    """None once Redis accepts the app's login, else why it does not"""
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
        return None
    except Exception as error:
        return describe(error)


def main():
    missing = [name for name in REQUIRED if not os.getenv(name)]
    if missing:
        sys.exit(f"Missing required environment variables: {', '.join(missing)}")

    deadline = time.monotonic() + TIMEOUT_SECONDS
    shown = None
    while True:
        errors = [(name, error) for name, error in
                  (('MySQL', mysql_error()), ('Redis', redis_error())) if error]
        if not errors:
            print('Database and Redis are up')
            return
        # Each error names its cause, which tells a service still booting
        # from one that never will (a wrong password, a missing database).
        waiting = ', '.join(f'{name} ({error})' for name, error in errors)
        if time.monotonic() > deadline:
            print(f'Gave up after {TIMEOUT_SECONDS}s waiting for: {waiting}',
                  file=sys.stderr)
            sys.exit(1)
        # Only when it changes, so a long wait doesn't repeat it every second
        if waiting != shown:
            print(f'Waiting for: {waiting}')
            shown = waiting
        time.sleep(1)


if __name__ == '__main__':
    main()
