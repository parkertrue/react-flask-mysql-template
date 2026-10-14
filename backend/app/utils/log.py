"""The app's log: one JSON object per line, on stdout.

Docker collects stdout, and a log shipper parses a JSON line without a
pattern. Security events go through security_event, on the app.security
logger, so they can be picked out by name. Requests are logged once, by
nginx, whose access log is JSON too.
"""
import json
import logging
import sys
from datetime import datetime, timezone

from flask import current_app, request


class JsonFormatter(logging.Formatter):
    def format(self, record):
        line = {
            'time': datetime.fromtimestamp(record.created, timezone.utc)
            .isoformat(timespec='milliseconds'),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            **getattr(record, 'fields', {}),
        }
        if record.exc_info:
            line['exc'] = self.formatException(record.exc_info)
        return json.dumps(line, default=str)


_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(JsonFormatter())


def configure_logging(app):
    """Send the app's logger, and so every logger under it, to stdout as JSON.

    Only the app's own logger, not the root: libraries stay quiet, and a
    handler the root already has (pytest's caplog) keeps receiving records.
    With a handler in place, Flask adds no default one of its own.
    """
    logger = logging.getLogger(app.name)
    # stdout as it is now, which a test may have swapped for its own
    _handler.setStream(sys.stdout)
    logger.addHandler(_handler)  # a no-op when the logger already has it
    logger.setLevel(logging.INFO)


def security_event(event, **fields):
    """Log something an investigation would need (a login, a refused token,
    a rate limit hit) with the client's address.

    Pass ids, never a password, token, CSRF value or email: the log is kept
    and read by more people than the database.
    """
    current_app.logger.getChild('security').info(
        event, extra={'fields': {'ip': request.remote_addr, **fields}})
