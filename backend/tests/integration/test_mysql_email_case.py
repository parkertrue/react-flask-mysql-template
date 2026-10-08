"""Emails match case-insensitively on MySQL, which SQLite does not.

users.email uses MySQL's default case-insensitive collation, so one address
in different cases is one account. The per-account login rate limit lowercases
the email to agree with it.
"""
PASSWORD = 'TestPassword123'


def _register(client, email):
    return client.post('/api/auth/register', json={'email': email, 'password': PASSWORD})


def test_an_email_in_another_case_is_already_registered(integration_client):
    assert _register(integration_client, 'Casey@example.com').status_code == 201

    response = _register(integration_client, 'casey@EXAMPLE.com')

    assert response.status_code == 409
    assert response.get_json()['error']['code'] == 'EMAIL_ALREADY_REGISTERED'


def test_login_accepts_the_email_in_any_case(integration_client, integration_redis):
    assert _register(integration_client, 'Casey@example.com').status_code == 201

    response = integration_client.post(
        '/api/auth/login', json={'email': 'CASEY@example.com', 'password': PASSWORD})

    assert response.status_code == 200
