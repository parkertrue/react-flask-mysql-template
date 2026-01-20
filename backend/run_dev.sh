#!/bin/sh
set -e

# Fail if .env.dev does not exist
if [ ! -f .env.dev ]; then
    echo "Error: .env.dev not found!"
    exit 1
fi

# Load all variables from .env.dev
echo "Loading environment variables from .env.dev"
set -a
source .env.dev
set +a

# Wait for MySQL to be ready
echo "Waiting for database at $MYSQL_HOST:$MYSQL_PORT..."

python3 <<EOF
import os
import time
import pymysql

host = os.getenv("MYSQL_HOST")
port = int(os.getenv("MYSQL_PORT"))
user = os.getenv("MYSQL_USER")
password = os.getenv("MYSQL_PASSWORD")
database = os.getenv("MYSQL_DATABASE")

while True:
    try:
        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
            connect_timeout=2
        )
        conn.close()
        break
    except Exception:
        print("Database not ready, retrying...")
        time.sleep(1)
EOF

echo "Database is up!"

echo "Running database migrations..."
flask db upgrade

echo "Starting Flask app..."
exec python run_app.py
