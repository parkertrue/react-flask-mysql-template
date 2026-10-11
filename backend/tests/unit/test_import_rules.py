"""Imports point one way: features use the shared core, never each other.

The shared core (config.py, utils/) imports no feature; a feature may import
the core and auth (every app keeps it), but no other feature; only the app
factory imports features.py, the one list that wires features in. Removing
or replacing a feature therefore touches nothing outside it but that list.
"""
import ast
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[2] / 'app'
CORE = {'__init__', 'config', 'utils', 'features'}
SHARED_FEATURES = {'auth'}


def _part(module):
    """'app.orders.routes' -> 'orders'; None for anything outside the app"""
    parts = module.split('.')
    if parts[0] != 'app':
        return None
    return parts[1] if len(parts) > 1 else '__init__'


def _imports(path, root):
    """Every app module this file imports, by dotted name"""
    for node in ast.walk(ast.parse(path.read_text(encoding='utf-8'))):
        if isinstance(node, ast.Import):
            yield from (alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.level == 0:
            yield node.module
            # `from app import orders` imports a package; `from app import db`
            # only an attribute of the app package itself
            if node.module == 'app':
                yield from (f'app.{alias.name}' for alias in node.names
                            if (root / alias.name).is_dir())


def _violations(path, root=APP):
    relative = path.relative_to(root)
    owner = relative.parts[0] if len(relative.parts) > 1 else relative.stem
    for module in _imports(path, root):
        target = _part(module)
        if target is None or target == owner:
            continue
        if target == 'features' and owner not in {'__init__', 'features'}:
            yield f'{relative} imports features.py'
        elif target not in CORE and owner in CORE - {'__init__', 'features'}:
            yield f'{relative} (shared core) imports the {target} feature'
        elif target not in CORE | SHARED_FEATURES and owner not in CORE:
            yield f'{relative} (the {owner} feature) imports the {target} feature'


def _plant(root, owner, source):
    for package in ('auth', 'orders', 'billing', 'utils'):
        (root / package).mkdir(exist_ok=True)
    path = root / owner
    path.write_text(source, encoding='utf-8')
    return path


def test_imports_point_one_way():
    violations = [v for path in sorted(APP.rglob('*.py')) for v in _violations(path)]

    assert violations == []


@pytest.mark.parametrize('owner, source, expected', [
    ('utils/x.py', 'from app.orders.models import Order', 'shared core'),
    ('config.py', 'import app.auth.models', 'shared core'),
    ('orders/x.py', 'from app.billing.routes import billing_bp', 'the orders feature'),
    ('orders/x.py', 'from app import billing', 'the orders feature'),
    ('auth/x.py', 'from app.features import BLUEPRINTS', 'imports features.py'),
])
def test_each_rule_catches_a_violation(tmp_path, owner, source, expected):
    """The scan itself works: a planted bad import is reported"""
    path = _plant(tmp_path, owner, source)

    assert expected in ' '.join(_violations(path, tmp_path))


@pytest.mark.parametrize('owner, source', [
    ('orders/x.py', 'from app.auth.models import User'),
    ('orders/x.py', 'from app.utils.ids import ID_MAX'),
    ('orders/x.py', 'from app import db'),
    ('features.py', 'from app.orders.routes import orders_bp'),
    ('__init__.py', 'from app.features import register_features'),
])
def test_allowed_imports_pass(tmp_path, owner, source):
    path = _plant(tmp_path, owner, source)

    assert list(_violations(path, tmp_path)) == []
