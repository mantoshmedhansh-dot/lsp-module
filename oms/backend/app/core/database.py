from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from .config import settings

# Handle Supabase connection pooling
# psycopg2 doesn't understand ?pgbouncer=true, so we strip it
database_url = settings.DATABASE_URL
use_nullpool = False

if database_url and "pgbouncer=true" in database_url:
    # Strip the pgbouncer parameter that psycopg2 doesn't understand
    database_url = database_url.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")
    use_nullpool = True

if use_nullpool:
    engine = create_engine(database_url, poolclass=NullPool)
else:
    engine = create_engine(database_url)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
