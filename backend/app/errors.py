from flask import jsonify


def error_response(code, message, status=400):
    payload = {
        "error": {
            "code": code,
            "message": message
        }
    }

    return jsonify(payload), status
