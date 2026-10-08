"""restrict_db_user.py against real MySQL, on a throwaway user.

The suite's own DB_USER keeps its privileges: integration fixtures create
and drop tables with it.
"""
import os

import pymysql
import pytest

import restrict_db_user

PROBE_USER = 'restrict_probe'
PROBE_PASSWORD = 'probe-password-123'


def _connect(user, password, database=None):
    return pymysql.connect(
        host=os.environ['DB_HOST'],
        port=int(os.getenv('DB_PORT', '3306')),
        user=user,
        password=password,
        database=database,
        autocommit=True,
    )


@pytest.fixture
def probe_user(integration_db, monkeypatch):
    """A user with GRANT ALL on the database, as the MySQL image creates"""
    database = os.environ['DB_NAME']
    root = _connect('root', os.environ['DB_ROOT_PASSWORD'])
    with root.cursor() as cursor:
        cursor.execute("DROP USER IF EXISTS %s@'%%'", (PROBE_USER,))
        cursor.execute(
            "CREATE USER %s@'%%' IDENTIFIED BY %s", (PROBE_USER, PROBE_PASSWORD))
        cursor.execute(f"GRANT ALL ON `{database}`.* TO %s@'%%'", (PROBE_USER,))

    # The migrate service's environment: admin credentials, app user to restrict
    monkeypatch.setenv('DB_USER', 'root')
    monkeypatch.setenv('DB_PASSWORD', os.environ['DB_ROOT_PASSWORD'])
    monkeypatch.setenv('APP_DB_USER', PROBE_USER)

    yield database

    with root.cursor() as cursor:
        cursor.execute("DROP USER IF EXISTS %s@'%%'", (PROBE_USER,))
    root.close()


def _probe(database):
    return _connect(PROBE_USER, PROBE_PASSWORD, database)


def test_app_user_keeps_data_access(probe_user):
    restrict_db_user.main()

    with _probe(probe_user) as conn, conn.cursor() as cursor:
        cursor.execute("INSERT INTO users (email, password_hash) VALUES ('p@x.com', 'h')")
        cursor.execute("UPDATE users SET password_hash = 'h2' WHERE email = 'p@x.com'")
        cursor.execute("SELECT password_hash FROM users WHERE email = 'p@x.com'")
        assert cursor.fetchone() == ('h2',)
        cursor.execute("DELETE FROM users WHERE email = 'p@x.com'")
        assert cursor.rowcount == 1


@pytest.mark.parametrize('statement', [
    'CREATE TABLE probe_table (id INT)',
    'DROP TABLE notes',
    'ALTER TABLE users ADD COLUMN probe INT',
    'CREATE INDEX probe_idx ON users (email)',
])
def test_app_user_cannot_change_the_schema(probe_user, statement):
    restrict_db_user.main()

    with _probe(probe_user) as conn, conn.cursor() as cursor:
        with pytest.raises(pymysql.err.OperationalError) as error:
            cursor.execute(statement)
    assert error.value.args[0] == 1142  # ER_TABLEACCESS_DENIED_ERROR


def test_running_twice_is_harmless(probe_user):
    """The migrate service runs it on every deploy"""
    restrict_db_user.main()
    restrict_db_user.main()

    with _probe(probe_user) as conn, conn.cursor() as cursor:
        cursor.execute('SHOW GRANTS')
        grants = ' '.join(row[0] for row in cursor.fetchall())
    assert 'SELECT, INSERT, UPDATE, DELETE' in grants
    assert 'CREATE' not in grants and 'DROP' not in grants


def test_rejects_an_unsafe_database_name(monkeypatch):
    monkeypatch.setenv('DB_NAME', 'app`; DROP DATABASE x; --')
    monkeypatch.setenv('APP_DB_USER', PROBE_USER)

    with pytest.raises(SystemExit):
        restrict_db_user.main()
