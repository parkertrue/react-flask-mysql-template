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

python wait_for_services.py

# Run migrations
echo "Running database migrations..."
flask db upgrade

# Start Flask app
echo "Starting Flask app..."
exec python run_app.py