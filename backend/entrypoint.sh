#!/bin/sh
set -e

python wait_for_services.py

# Migrations are not run here: the compose files' one-shot migrate service
# runs them with admin credentials the app's own container never holds.
exec "$@"
