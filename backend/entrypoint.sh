#!/bin/sh
set -e

python wait_for_services.py

echo "Running database migrations..."
flask db upgrade

echo "Starting application..."
exec "$@"
