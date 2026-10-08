import pytest

from tests.conftest import FakeRedisService


@pytest.fixture(autouse=True)
def fake_redis(request):
    """Every test of the unit app gets an in-memory Redis token store.

    UnitTestConfig runs without Redis, but the app treats a missing store as
    an outage (login answers 503, refresh tokens count as revoked), so tests
    sign in through the same path production does. Request `no_redis` to test
    the outage itself.
    """
    if 'app' not in request.fixturenames:
        yield None
        return
    app = request.getfixturevalue('app')
    fake = FakeRedisService()
    app.extensions['redis_service'] = fake
    yield fake
    app.extensions['redis_service'] = None


@pytest.fixture
def no_redis(app, fake_redis):
    """The unit app with Redis unreachable"""
    app.extensions['redis_service'] = None
