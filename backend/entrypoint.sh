#!/bin/sh
set -e

# Wait for MySQL to be ready
echo "Waiting for database..."

python <<EOF
import os
import time
import pymysql

host = os.getenv("MYSQL_HOST")
user = os.getenv("MYSQL_USER")
password = os.getenv("MYSQL_PASSWORD")
database = os.getenv("MYSQL_DATABASE")

while True:
    try:
        conn = pymysql.connect(
            host=host,
            user=user,
            password=password,
            database=database,
            connect_timeout=2,
        )
        conn.close()
        break
    except Exception as e:
        print("Database not ready, retrying...")
        time.sleep(1)
EOF

echo "Database is up"

echo "Running database migrations..."
flask db upgrade

echo "Starting application..."
exec "$@"
