from flask import jsonify


# Every outage answers 503 with these words, whichever service is down: the
# user can only wait, and a signed-in user mustn't read "Sign-in is unavailable"
SERVICE_UNAVAILABLE_MESSAGE = 'The service is temporarily unavailable, please try again shortly'


# Keyword-only, so the error-code sync test (frontend fixtures.test.js) can
# find every code by its `code='...'`
def error_response(*, code, message, status=400):
    payload = {
        'error': {
            'code': code,
            'message': message
        }
    }

    return jsonify(payload), status


# A create refused because the user already stores as many rows of that kind
# as a feature allows (NOTES_MAX_PER_USER). Shared, so every feature answers
# a full quota alike.
def quota_exceeded(message):
    return error_response(code='QUOTA_EXCEEDED', message=message, status=409)
