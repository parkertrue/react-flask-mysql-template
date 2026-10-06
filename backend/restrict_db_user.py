"""Leave the app's MySQL user with data rights only, once migrations are done.

The MySQL image grants MYSQL_USER every privilege on the database. The
migrate service in docker-compose.yml runs this as root after
`flask db upgrade`, narrowing that user to what the running app needs, so a
compromised backend can read and write rows but never drop or alter tables.
Safe to run on every deploy, including against databases created before it.

Reads MYSQL_HOST/PORT/DATABASE and the admin MYSQL_USER/MYSQL_PASSWORD like
app/config.py; APP_MYSQL_USER names the user to restrict.
"""
import os
import re
import sys

import pymysql

DATA_PRIVILEGES = "SELECT, INSERT, UPDATE, DELETE"
# Every other database-level privilege that the image's GRANT ALL included
SCHEMA_PRIVILEGES = (
    "ALTER, ALTER ROUTINE, CREATE, CREATE ROUTINE, CREATE TEMPORARY TABLES, "
    "CREATE VIEW, DROP, EVENT, EXECUTE, INDEX, LOCK TABLES, REFERENCES, "
    "SHOW VIEW, TRIGGER"
)


def main():
    database = os.environ["MYSQL_DATABASE"]
    # Identifiers cannot be passed as query parameters, so only allow names
    # that are safe to put between backticks
    if not re.fullmatch(r"\w+", database):
        sys.exit(f"Refusing unexpected database name: {database!r}")
    app_user = os.environ["APP_MYSQL_USER"]

    connection = pymysql.connect(
        host=os.environ["MYSQL_HOST"],
        port=int(os.getenv("MYSQL_PORT", "3306")),
        user=os.environ["MYSQL_USER"],
        password=os.environ["MYSQL_PASSWORD"],
    )
    with connection, connection.cursor() as cursor:
        # Grant before revoking: a backend still serving from the previous
        # deploy keeps its data access throughout. IF EXISTS makes revoking
        # privileges already gone (every run after the first) a no-op.
        cursor.execute(
            f"GRANT {DATA_PRIVILEGES} ON `{database}`.* TO %s@'%%'", (app_user,))
        cursor.execute(
            f"REVOKE IF EXISTS {SCHEMA_PRIVILEGES} ON `{database}`.* FROM %s@'%%'",
            (app_user,))
    print(f"{app_user} restricted to {DATA_PRIVILEGES} on {database}")


if __name__ == "__main__":
    main()
