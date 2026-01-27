"""updated email max length to 128

Revision ID: 40460e983e45
Revises: 8cc00b6eefbb
Create Date: 2026-01-26 09:12:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '40460e983e45'
down_revision = '8cc00b6eefbb'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column(
            'email',
            existing_type=mysql.VARCHAR(length=256),
            type_=sa.String(length=128),
            existing_nullable=False
        )


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column(
            'email',
            existing_type=sa.String(length=128),
            type_=mysql.VARCHAR(length=256),
            existing_nullable=False
        )
