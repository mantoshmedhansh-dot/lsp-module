"""Fix StockAdjustment Schema

Revision ID: 003_fix_stock_adjustment
Revises: 002_wms_phase1
Create Date: 2026-01-20

This migration fixes the StockAdjustment table schema:
1. Adds missing 'status' column
2. Adds missing 'updatedAt' column
3. Adds missing 'createdById' column (copies from adjustedById if exists)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '003_fix_stock_adjustment'
down_revision: Union[str, None] = '002_wms_phase1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix StockAdjustment schema"""

    # Add status column if not exists
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'StockAdjustment' AND column_name = 'status'
            ) THEN
                ALTER TABLE "StockAdjustment" ADD COLUMN status VARCHAR DEFAULT 'DRAFT';
            END IF;
        END $$;
    """)

    # Add updatedAt column if not exists
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'StockAdjustment' AND column_name = 'updatedAt'
            ) THEN
                ALTER TABLE "StockAdjustment" ADD COLUMN "updatedAt" TIMESTAMP DEFAULT NOW();
                -- Update existing rows to use createdAt value
                UPDATE "StockAdjustment" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
            END IF;
        END $$;
    """)

    # Add createdById column if not exists - copy from adjustedById if it exists
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'StockAdjustment' AND column_name = 'createdById'
            ) THEN
                ALTER TABLE "StockAdjustment" ADD COLUMN "createdById" UUID REFERENCES "User"(id);

                -- Copy values from adjustedById if that column exists
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'StockAdjustment' AND column_name = 'adjustedById'
                ) THEN
                    UPDATE "StockAdjustment" SET "createdById" = "adjustedById";
                END IF;
            END IF;
        END $$;
    """)

    # Create index on status if not exists
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE indexname = 'ix_stockadjustment_status'
            ) THEN
                CREATE INDEX ix_stockadjustment_status ON "StockAdjustment" (status);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Rollback StockAdjustment schema fixes"""
    op.execute("""
        ALTER TABLE "StockAdjustment"
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS "updatedAt",
        DROP COLUMN IF EXISTS "createdById";
    """)
