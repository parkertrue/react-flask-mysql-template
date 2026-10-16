"""Deleting an account deletes everything it owns, in one statement.

POST /api/account/delete deletes the users row and nothing else, so every
table a feature keeps per user must reference users.id with ON DELETE
CASCADE. Without it the delete fails on the foreign key (MySQL refuses it)
or, with a nullable one, leaves the user's rows behind.
"""
from app import db


def test_every_reference_to_a_user_cascades_on_delete(app):
    """Requests app: building it imports every feature's models"""
    not_cascading = [
        f'{table.name}.{fk.parent.name}'
        for table in db.metadata.tables.values()
        for fk in table.foreign_keys
        if fk.column.table.name == 'users' and fk.ondelete != 'CASCADE'
    ]

    assert not_cascading == []
