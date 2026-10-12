#!/bin/bash
# Regenerate requirements.txt and requirements-dev.txt from the .in files.
# Pass --upgrade to move every package to its newest release.
#
# Runs pip-compile inside the production base image, so the locks resolve for
# Linux and Python 3.12 whatever machine this is run on.
# click<8.2: newer click makes pip-tools before 7.6.2 write a spurious
# --no-index into the lock's header, which Dependabot would then replay
# (https://github.com/jazzband/pip-tools/issues/2472). Fixed in pip-tools
# 7.6.2 (2026-10-07): drop the pin and pin pip-tools>=7.6.2 instead.
set -e
cd "$(dirname "$0")"

MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/src" -w /src python:3.12-slim sh -c "
  pip install -q --root-user-action=ignore pip-tools 'click<8.2' &&
  pip-compile -q --strip-extras $* -o requirements.txt requirements.in &&
  pip-compile -q --strip-extras $* -o requirements-dev.txt requirements-dev.in"

echo "Locks updated; reinstall with: pip install -r requirements-dev.txt"
