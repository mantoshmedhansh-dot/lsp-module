"""
Database Configuration for SQLModel
"""
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import NullPool, QueuePool
from typing import Generator
from contextlib import contextmanager

from .config import settings


def _get_pool_class():
    if "supabase" in settings.DATABASE_URL or "pgbouncer" in settings.DATABASE_URL:
        return NullPool
    return QueuePool


engine = create_engine(
    settings.database_url_sync,
    poolclass=_get_pool_class(),
    pool_pre_ping=True,
    echo=settings.DEBUG,
)


def create_db_and_tables():
    """Create all tables defined in SQLModel models"""
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency for database sessions"""
    with Session(engine) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


@contextmanager
def get_session_context() -> Generator[Session, None, None]:
    """Context manager for database sessions"""
    session = Session(engine)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Generator[Session, None, None]:
    """Alias for get_session"""
    yield from get_session()
