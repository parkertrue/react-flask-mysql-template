from datetime import datetime, timedelta


def test_returns_the_signed_in_users_account(client, sample_user, auth_headers):
    response = client.get('/api/account', headers=auth_headers)

    assert response.status_code == 200
    body = response.get_json()
    assert set(body) == {'email', 'created_at'}
    assert body['email'] == sample_user.email


def test_created_at_is_sent_as_utc(client, sample_user, auth_headers):
    """The database's naive DATETIME goes out with its zone stated"""
    response = client.get('/api/account', headers=auth_headers)

    created_at = datetime.fromisoformat(response.get_json()['created_at'])
    assert created_at.utcoffset() == timedelta(0)
    assert created_at.replace(tzinfo=None) == sample_user.created_at


def test_another_users_token_gets_their_own_account(
        client, second_user, second_auth_headers):
    response = client.get('/api/account', headers=second_auth_headers)

    assert response.get_json()['email'] == second_user.email


def test_requires_a_token(client):
    response = client.get('/api/account')

    assert response.status_code == 401
    assert response.get_json()['error']['code'] == 'AUTH_MISSING_TOKEN'
