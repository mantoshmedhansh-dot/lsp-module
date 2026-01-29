#!/usr/bin/env python3
"""
Script to run SQL migrations using SQLAlchemy
Usage: python run_migration.py <migration_file.sql>
"""
import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text

# OMS Database URL (Tokyo - rilakxywitslblkgikzf)
DATABASE_URL = "postgresql://postgres.rilakxywitslblkgikzf:Aquapurite2026@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"

def run_migration(sql_file: str):
    """Execute a SQL migration file"""
    print(f"Reading migration file: {sql_file}")

    with open(sql_file, 'r') as f:
        sql_content = f.read()

    # Split into individual statements (handle comments)
    statements = []
    current_statement = []

    for line in sql_content.split('\n'):
        # Skip comment-only lines but keep non-comment content
        stripped = line.strip()
        if stripped.startswith('--'):
            continue
        if stripped:
            current_statement.append(line)
        # Check if statement ends with semicolon
        if stripped.endswith(';'):
            full_statement = '\n'.join(current_statement).strip()
            if full_statement:
                statements.append(full_statement)
            current_statement = []

    print(f"Found {len(statements)} SQL statements to execute")
    print(f"Connecting to database...")

    # Use autocommit for each statement
    engine = create_engine(DATABASE_URL, isolation_level="AUTOCOMMIT")

    success_count = 0
    error_count = 0
    skipped_count = 0

    with engine.connect() as conn:
        for i, stmt in enumerate(statements, 1):
            try:
                # Show abbreviated statement
                preview = stmt[:80].replace('\n', ' ')
                if len(stmt) > 80:
                    preview += '...'
                print(f"[{i}/{len(statements)}] Executing: {preview}")

                result = conn.execute(text(stmt))
                success_count += 1

                # Show result if it's a SELECT
                if stmt.strip().upper().startswith('SELECT'):
                    for row in result:
                        print(f"    Result: {row}")

            except Exception as e:
                error_str = str(e)
                # Ignore "column does not exist" errors (column already renamed or doesn't exist)
                if 'does not exist' in error_str or 'already exists' in error_str:
                    print(f"    Skipped: {error_str[:60]}...")
                    skipped_count += 1
                else:
                    print(f"    ERROR: {error_str[:100]}")
                    error_count += 1

    print(f"\n{'='*60}")
    print(f"Migration completed!")
    print(f"  Successful: {success_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Errors: {error_count}")
    print(f"{'='*60}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_migration.py <migration_file.sql>")
        sys.exit(1)

    migration_file = sys.argv[1]
    if not os.path.exists(migration_file):
        print(f"Error: File not found: {migration_file}")
        sys.exit(1)

    run_migration(migration_file)
