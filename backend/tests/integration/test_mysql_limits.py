"""Column limits that SQLite ignores, so unit tests cannot catch them."""


def test_overlong_email_is_a_validation_error(integration_client):
    """MySQL rejects an over-long email with a 500 unless the schema stops it"""
    email = 'a' * 130 + '@example.com'

    response = integration_client.post(
        '/api/auth/register',
        json={'email': email, 'password': 'TestPassword123'})

    assert response.status_code == 422
