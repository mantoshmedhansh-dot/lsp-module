from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# Handle Supabase connection pooling
database_url = settings.DATABASE_URL
if "pgbouncer=true" in database_url:
    # For Supabase with pgbouncer, use NullPool
    from sqlalchemy.pool import NullPool
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
