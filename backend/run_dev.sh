#!/bin/bash
set -e

# Check if .env.dev exists
ENV_FILE="../.env.dev"
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found!"
    exit 1
fi

# Load environment variables from .env.dev
echo "Loading environment variables from .env.dev"
set -a
source "$ENV_FILE"
set +a

# Activate virtual environment (cross-platform)
if [ -z "${VIRTUAL_ENV}" ]; then
    echo "Activating virtual environment..."
    if [ -f ".venv/Scripts/activate" ]; then
        source .venv/Scripts/activate  # Windows (Git Bash)
    elif [ -f ".venv/bin/activate" ]; then
        source .venv/bin/activate      # Linux/macOS
    else
        echo "Error: Virtual environment not found. Please run:"
        echo "  python -m venv .venv"
        exit 1
    fi
fi

# Wait for service dependencies
echo "Waiting for database and Redis..."

python <<EOF
import os
import time
import pymysql
import redis

mysql_cfg = dict(
    host=os.getenv("MYSQL_HOST"),
    port=3306,
    user=os.getenv("MYSQL_USER"),
    password=os.getenv("MYSQL_PASSWORD"),
    database=os.getenv("MYSQL_DATABASE"),
    connect_timeout=2,
)

redis_cfg = dict(
    host=os.getenv("REDIS_HOST"),
    port=6379,
    password=os.getenv('REDIS_PASSWORD'),
    db=int(os.getenv("REDIS_DB")),
    socket_connect_timeout=2,
)

while True:
    mysql_ok = redis_ok = False

    try:
        conn = pymysql.connect(**mysql_cfg)
        conn.close()
        mysql_ok = True
    except Exception:
        print("MySQL not ready")

    try:
        r = redis.Redis(**redis_cfg)
        r.ping()
        r.close()
        redis_ok = True
    except Exception:
        print("Redis not ready")

    if mysql_ok and redis_ok:
        break

    time.sleep(1)
EOF

echo "Database and Redis are up"

# Run migrations
echo "Running database migrations..."
flask db upgrade

# Start Flask app
echo "Starting Flask app..."
exec python run_app.py