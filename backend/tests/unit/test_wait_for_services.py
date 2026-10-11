"""wait_for_services.py, which every container runs before its command.

The checks themselves are faked: what matters here is the loop around them,
which must give up on a typo at once and on a dead service after the timeout,
saying why each service is not ready.
"""
import pymysql
import pytest
import redis

import wait_for_services as wait

ENV = {
    'DB_HOST': 'db', 'DB_NAME': 'app', 'DB_USER': 'app', 'DB_PASSWORD': 'pw',
    'REDIS_HOST': 'redis', 'REDIS_USERNAME': 'app', 'REDIS_PASSWORD': 'pw',
}


@pytest.fixture
def env(monkeypatch):
    for name, value in ENV.items():
        monkeypatch.setenv(name, value)


@pytest.fixture
def clock(monkeypatch):
    """A fake clock that sleeping advances, so waiting takes no real time"""
    now = [0.0]
    monkeypatch.setattr(wait.time, 'monotonic', lambda: now[0])
    monkeypatch.setattr(wait.time, 'sleep', lambda s: now.__setitem__(0, now[0] + s))
    return now


def services(monkeypatch, mysql, redis_):
    """Fake the two checks: each answers from its list, repeating the last.
    None means ready; anything else is the error."""
    def check(answers):
        return lambda: answers.pop(0) if len(answers) > 1 else answers[0]
    monkeypatch.setattr(wait, 'mysql_error', check(mysql))
    monkeypatch.setattr(wait, 'redis_error', check(redis_))


def test_missing_settings_fail_at_once_naming_them(monkeypatch):
    for name in ENV:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv('DB_HOST', 'db')
    monkeypatch.setattr(wait, 'mysql_error', lambda: pytest.fail('should not connect'))

    with pytest.raises(SystemExit) as exit_info:
        wait.main()

    assert 'DB_NAME' in str(exit_info.value) and 'REDIS_PASSWORD' in str(exit_info.value)
    assert 'DB_HOST' not in str(exit_info.value)


def test_returns_once_both_services_answer(env, clock, monkeypatch, capsys):
    services(monkeypatch, mysql=['refused', None], redis_=['refused', 'refused', None])

    wait.main()

    assert capsys.readouterr().out.splitlines() == [
        'Waiting for: MySQL (refused), Redis (refused)',
        'Waiting for: Redis (refused)',
        'Database and Redis are up',
    ]
    assert clock[0] == 2


def test_an_unchanged_wait_is_printed_once(env, clock, monkeypatch, capsys):
    services(monkeypatch, mysql=['booting', 'booting', 'booting', None], redis_=[None])

    wait.main()

    assert capsys.readouterr().out.splitlines() == [
        'Waiting for: MySQL (booting)',
        'Database and Redis are up',
    ]


def test_gives_up_after_the_timeout_naming_what_is_down(env, clock, monkeypatch, capsys):
    services(monkeypatch, mysql=[None], redis_=['refused'])

    with pytest.raises(SystemExit) as exit_info:
        wait.main()

    assert exit_info.value.code == 1
    assert clock[0] > wait.TIMEOUT_SECONDS
    assert capsys.readouterr().err.splitlines() == [
        f'Gave up after {wait.TIMEOUT_SECONDS}s waiting for: Redis (refused)']


def test_a_check_that_raises_reports_why(env, monkeypatch):
    """A wrong password looks like a slow start unless the log says which it is"""
    def refuse_mysql(**kwargs):
        raise pymysql.err.OperationalError(1045, "Access denied for user 'app'")

    def refuse_redis(self):
        raise redis.AuthenticationError('invalid username-password pair')

    monkeypatch.setattr(wait.pymysql, 'connect', refuse_mysql)
    monkeypatch.setattr(redis.Redis, 'ping', refuse_redis)

    assert wait.mysql_error() == "(1045, \"Access denied for user 'app'\")"
    assert wait.redis_error() == 'invalid username-password pair'


def test_an_error_without_a_message_is_named_by_its_type(env, monkeypatch):
    def time_out(self):
        raise redis.TimeoutError()
    monkeypatch.setattr(redis.Redis, 'ping', time_out)

    assert wait.redis_error() == 'TimeoutError'


def test_a_check_that_connects_reports_no_error(env, monkeypatch):
    class Connection:
        def close(self):
            pass
    monkeypatch.setattr(wait.pymysql, 'connect', lambda **kwargs: Connection())
    monkeypatch.setattr(redis.Redis, 'ping', lambda self: True)

    assert wait.mysql_error() is None
    assert wait.redis_error() is None
