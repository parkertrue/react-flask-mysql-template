$ErrorActionPreference = "Stop"

$envFile = Join-Path ".." ".env.dev"

# Check if .env.dev exists
if (-Not (Test-Path $envFile)) {
    Write-Error "$envFile not found!"
    exit 1
}

# Load environment variables from .env.dev
Write-Host "Loading environment variables from $envFile"
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*#") { return }  # skip comments
    if ($_ -match "=") {
        $parts = $_ -split "=", 2
        $name = $parts[0].Trim()
        $value = $parts[1].Trim()
        Set-Item -Path "Env:$name" -Value $value
    }
}

# Wait for MySQL to be ready
Write-Host "Waiting for database at $($env:MYSQL_HOST):$($env:MYSQL_PORT)..."
python -c "
import os, time, pymysql

host = os.getenv('MYSQL_HOST')
port = int(os.getenv('MYSQL_PORT'))
user = os.getenv('MYSQL_USER')
password = os.getenv('MYSQL_PASSWORD')
database = os.getenv('MYSQL_DATABASE')

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
    except:
        print('Database not ready, retrying...')
        time.sleep(1)
"

Write-Host "Database is up!"

# Run migrations
Write-Host "Running database migrations..."
flask db upgrade

# Start Flask app
Write-Host "Starting Flask app..."
python run_app.py