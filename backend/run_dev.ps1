$ErrorActionPreference = "Stop"

$envFile = Join-Path ".." ".env.dev"

# Check if .env.dev exists
if (-Not (Test-Path $envFile)) {
    Write-Error "$envFile not found!"
    exit 1
}

# Load environment variables from .env.dev
Write-Host "Loading environment variables from .env.dev"
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*#") { return }
    if ($_ -match "=") {
        $parts = $_ -split "=", 2
        $name = $parts[0].Trim()
        $value = $parts[1].Trim()
        Set-Item -Path "Env:$name" -Value $value
    }
}

# Wait for service dependencies
Write-Host "Waiting for database and Redis..."

python -c "
import os
import time
import pymysql
import redis

mysql_cfg = dict(
    host=os.getenv('MYSQL_HOST'),
    port=3306,
    user=os.getenv('MYSQL_USER'),
    password=os.getenv('MYSQL_PASSWORD'),
    database=os.getenv('MYSQL_DATABASE'),
    connect_timeout=2,
)

redis_cfg = dict(
    host=os.getenv('REDIS_HOST'),
    port=6379,
    password=os.getenv('REDIS_PASSWORD'),
    db=int(os.getenv('REDIS_DB')),
    socket_connect_timeout=2,
)

while True:
    mysql_ok = redis_ok = False

    try:
        conn = pymysql.connect(**mysql_cfg)
        conn.close()
        mysql_ok = True
    except Exception:
        print('MySQL not ready')

    try:
        r = redis.Redis(**redis_cfg)
        r.ping()
        r.close()
        redis_ok = True
    except Exception:
        print('Redis not ready')

    if mysql_ok and redis_ok:
        break

    time.sleep(1)
"

Write-Host "Database and Redis are up"

# Run migrations
Write-Host "Running database migrations..."
flask db upgrade

# Start Flask app
Write-Host "Starting Flask app..."
python run_app.py
