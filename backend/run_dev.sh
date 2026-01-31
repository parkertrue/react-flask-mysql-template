#!/bin/sh
set -e

# Check if .env.dev exists
if [ ! -f .env.dev ]; then
    echo "Error: .env.dev not found!"
    exit 1
fi

# Load environment variables from .env.dev
echo "Loading environment variables from .env.dev"
set -a
source .env.dev
set +a

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
