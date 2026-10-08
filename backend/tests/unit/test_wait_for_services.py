"""wait_for_services.py, which every container runs before its command.

The checks themselves are faked: what matters here is the loop around them,
which must give up on a typo at once and on a dead service after the timeout.
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
    """Fake the two checks: each answers from its list, repeating the last"""
    def check(answers):
        return lambda: answers.pop(0) if len(answers) > 1 else answers[0]
    monkeypatch.setattr(wait, 'mysql_ready', check(mysql))
    monkeypatch.setattr(wait, 'redis_ready', check(redis_))


def test_missing_settings_fail_at_once_naming_them(monkeypatch):
    for name in ENV:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv('DB_HOST', 'db')
    monkeypatch.setattr(wait, 'mysql_ready', lambda: pytest.fail('should not connect'))

    with pytest.raises(SystemExit) as exit_info:
        wait.main()

    assert 'DB_NAME' in str(exit_info.value) and 'REDIS_PASSWORD' in str(exit_info.value)
    assert 'DB_HOST' not in str(exit_info.value)


def test_returns_once_both_services_answer(env, clock, monkeypatch, capsys):
    services(monkeypatch, mysql=[False, True], redis_=[False, False, True])

    wait.main()

    out = capsys.readouterr().out
    assert 'Waiting for: MySQL, Redis' in out
    assert 'Waiting for: Redis' in out
    assert 'Database and Redis are up' in out
    assert clock[0] == 2


def test_gives_up_after_the_timeout_naming_what_is_down(env, clock, monkeypatch, capsys):
    services(monkeypatch, mysql=[True], redis_=[False])

    with pytest.raises(SystemExit) as exit_info:
        wait.main()

    assert exit_info.value.code == 1
    assert clock[0] > wait.TIMEOUT_SECONDS
    assert 'waiting for: Redis' in capsys.readouterr().err


def test_a_check_that_raises_counts_as_not_ready(env, monkeypatch):
    """Refused, timed out or wrong password: all just mean "not yet\""""
    def refuse_mysql(**kwargs):
        raise pymysql.err.OperationalError(2003, 'refused')

    def refuse_redis(self):
        raise redis.ConnectionError('refused')

    monkeypatch.setattr(wait.pymysql, 'connect', refuse_mysql)
    monkeypatch.setattr(redis.Redis, 'ping', refuse_redis)

    assert wait.mysql_ready() is False
    assert wait.redis_ready() is False


def test_a_check_that_connects_counts_as_ready(env, monkeypatch):
    class Connection:
        def close(self):
            pass
    monkeypatch.setattr(wait.pymysql, 'connect', lambda **kwargs: Connection())
    monkeypatch.setattr(redis.Redis, 'ping', lambda self: True)

    assert wait.mysql_ready() is True
    assert wait.redis_ready() is True
