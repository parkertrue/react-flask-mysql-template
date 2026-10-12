from flask import jsonify


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
