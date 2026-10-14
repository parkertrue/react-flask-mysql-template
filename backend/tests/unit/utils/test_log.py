import json
import logging
import sys
from datetime import datetime
from pathlib import Path

from app.utils import log
from app.utils.log import JsonFormatter
from tests.unit.test_app_factory import build_app


def record(message='hello', exc_info=None, **fields):
    entry = logging.LogRecord('app.test', logging.WARNING, __file__, 1, message, (), exc_info)
    entry.created = datetime.fromisoformat('2026-10-13T18:02:11.250+00:00').timestamp()
    if fields:
        entry.fields = fields
    return entry


class TestJsonFormatter:
    def test_a_line_holds_the_record_and_its_fields(self):
        line = json.loads(JsonFormatter().format(record(user_id=7, ip='203.0.113.7')))

        assert line == {
            'time': '2026-10-13T18:02:11.250+00:00', 'level': 'WARNING', 'logger': 'app.test',
            'message': 'hello', 'user_id': 7, 'ip': '203.0.113.7'}

    def test_an_exception_is_kept_with_its_traceback(self):
        try:
            raise ValueError('boom')
        except ValueError:
            line = json.loads(JsonFormatter().format(record(exc_info=sys.exc_info())))

        assert line['exc'].startswith('Traceback (most recent call last):')
        assert line['exc'].endswith('ValueError: boom')

    def test_a_value_json_cannot_hold_is_written_as_text(self):
        line = json.loads(JsonFormatter().format(record(path=Path('a'))))

        assert line['path'] == 'a'


def test_the_app_logger_has_one_handler_however_many_apps_are_built(monkeypatch):
    build_app(monkeypatch)
    app = build_app(monkeypatch)

    # Flask adds its own default handler to a logger that has none
    assert app.logger.handlers == [log._handler]
    assert app.logger.level == logging.INFO


def test_the_app_logs_json_lines_on_stdout(monkeypatch, capsys):
    # Put the handler's stream back afterwards: capsys closes its own
    monkeypatch.setattr(log._handler, 'stream', log._handler.stream)
    app = build_app(monkeypatch)

    app.logger.info('started')

    line = json.loads(capsys.readouterr().out)
    assert (line['logger'], line['level'], line['message']) == ('app', 'INFO', 'started')
