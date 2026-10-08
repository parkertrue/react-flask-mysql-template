"""notes table (example feature)

Belongs to the notes example feature. When starting a new app from this
template, delete this file along with the notes model, then generate your own
tables with `flask db migrate`; they will chain onto 0001_users.

Revision ID: 0002_notes
Revises: 0001_users
Create Date: 2026-10-01

"""
from alembic import op
import sqlalchemy as sa


revision = '0002_notes'
down_revision = '0001_users'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('content', sa.String(length=256), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    # MySQL drops the index it made for the foreign key once this one can
    # serve it instead
    op.create_index('ix_notes_user_id_id', 'notes', ['user_id', 'id'])


def downgrade():
    op.drop_table('notes')
