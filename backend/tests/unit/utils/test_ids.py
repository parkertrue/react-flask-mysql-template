from sqlalchemy import Integer

from app.auth.models import User
from app.utils.ids import ID_MAX


def test_id_max_is_the_largest_int_id():
    """ID_MAX fits the INT primary keys; a wider id type needs a new bound"""
    assert type(User.__table__.c.id.type) is Integer
    assert ID_MAX == 2**31 - 1
