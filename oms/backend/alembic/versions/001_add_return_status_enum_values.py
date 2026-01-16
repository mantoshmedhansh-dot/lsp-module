"""Add missing ReturnStatus enum values

Revision ID: 001_add_return_status
Revises:
Create Date: 2026-01-17

Adds PROCESSED and COMPLETED values to the ReturnStatus PostgreSQL enum
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_add_return_status'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add PROCESSED and COMPLETED to ReturnStatus enum"""
    # PostgreSQL requires special handling for adding enum values
    # We need to use raw SQL with COMMIT to add values to existing enum

    # Check if values already exist before adding
    op.execute("""
        DO $$
        BEGIN
            -- Add PROCESSED if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'PROCESSED'
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReturnStatus')
            ) THEN
                ALTER TYPE "ReturnStatus" ADD VALUE 'PROCESSED';
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    """)

    op.execute("""
        DO $$
        BEGIN
            -- Add COMPLETED if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'COMPLETED'
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReturnStatus')
            ) THEN
                ALTER TYPE "ReturnStatus" ADD VALUE 'COMPLETED';
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    """)


def downgrade() -> None:
    """
    Note: PostgreSQL does not support removing enum values directly.
    To downgrade, you would need to:
    1. Create a new enum type without the values
    2. Update all columns to use the new type
    3. Drop the old type
    4. Rename the new type

    This is intentionally left as a no-op for safety.
    """
    pass
