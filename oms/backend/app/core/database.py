"""
Database Configuration for SQLModel
Supports both sync and async operations
"""
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import NullPool, QueuePool
from sqlalchemy import event
from typing import Generator
from contextlib import contextmanager

from .config import settings


# Determine pool class based on environment
# Use NullPool for Supabase (external pooler) or serverless
# Use QueuePool for local development
def _get_pool_class():
    if "supabase" in settings.DATABASE_URL or "pgbouncer" in settings.DATABASE_URL:
        return NullPool
    return QueuePool


# Create sync engine for SQLModel
# connect_timeout: fail fast if DB is unreachable (default is no timeout = hang forever)
_connect_args = {"connect_timeout": 10}  # 10 second connection timeout

engine = create_engine(
    settings.database_url_sync,
    poolclass=_get_pool_class(),
    pool_pre_ping=True,  # Verify connections before use
    echo=settings.DEBUG,  # Log SQL in debug mode
    connect_args=_connect_args,
)


# Enable foreign key constraints for SQLite (if used in testing)
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if "sqlite" in settings.DATABASE_URL:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def create_db_and_tables():
    """Create all tables defined in SQLModel models"""
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """
    FastAPI dependency for database sessions.
    Usage: db: Session = Depends(get_session)
    """
    with Session(engine) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


@contextmanager
def get_session_context() -> Generator[Session, None, None]:
    """
    Context manager for database sessions (for use outside FastAPI).
    Usage: with get_session_context() as session: ...
    """
    session = Session(engine)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# Alias for backward compatibility with existing code
def get_db() -> Generator[Session, None, None]:
    """Alias for get_session - maintains backward compatibility"""
    yield from get_session()
