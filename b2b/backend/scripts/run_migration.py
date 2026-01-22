"""
Run database migration for B2B Logistics
"""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Remove pgbouncer parameter for DDL operations - use direct connection
if "pooler.supabase.com" in DATABASE_URL:
    # Extract project ref from: postgres.<project-ref>@aws-1-...
    import re
    match = re.search(r'postgres\.([a-z]+):', DATABASE_URL)
    if match:
        project_ref = match.group(1)
        # Build direct connection URL: db.<project-ref>.supabase.co:5432
        DATABASE_URL = DATABASE_URL.replace("?pgbouncer=true", "")
        DATABASE_URL = re.sub(
            r'@aws-\d+-[a-z-]+\.pooler\.supabase\.com:\d+/',
            f'@db.{project_ref}.supabase.co:5432/',
            DATABASE_URL
        )

print(f"Connecting to database...")

engine = create_engine(DATABASE_URL)

# Read migration file
migration_file = Path(__file__).parent.parent / "migrations" / "001_initial_schema.sql"
with open(migration_file, "r") as f:
    migration_sql = f.read()

print("Running migration...")

with engine.connect() as conn:
    # Split by semicolons and execute each statement
    statements = [s.strip() for s in migration_sql.split(";") if s.strip() and not s.strip().startswith("--")]

    for i, statement in enumerate(statements):
        if statement:
            try:
                conn.execute(text(statement))
                print(f"  Statement {i+1} executed.")
            except Exception as e:
                print(f"  Statement {i+1} error: {e}")

    conn.commit()

print("\nMigration completed!")

# Verify
with engine.connect() as conn:
    result = conn.execute(text('SELECT email, name, role FROM "User" WHERE role = \'SUPER_ADMIN\''))
    for row in result:
        print(f"Admin user: {row[0]} ({row[1]}) - Role: {row[2]}")
