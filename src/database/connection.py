"""
Module de connexion à la base de données Supabase PostgreSQL
"""

import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base

logger = logging.getLogger(__name__)

Base = declarative_base()

_engine = None
_SessionLocal = None


def get_database_url() -> str:
    """Construit l'URL de connexion à la base de données"""
    host = os.getenv("SUPABASE_DB_HOST", "")
    port = os.getenv("SUPABASE_DB_PORT", "5432")
    name = os.getenv("SUPABASE_DB_NAME", "postgres")
    user = os.getenv("SUPABASE_DB_USER", "postgres")
    password = os.getenv("SUPABASE_DB_PASSWORD", "")
    
    if not host or not password or password == "YOUR_DB_PASSWORD_HERE":
        raise ValueError("Configuration base de données manquante ou incomplète")
    
    return f"postgresql://{user}:{password}@{host}:{port}/{name}"


def init_database():
    """Initialise la connexion à la base de données"""
    global _engine, _SessionLocal
    
    try:
        database_url = get_database_url()
        _engine = create_engine(
            database_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10
        )
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
        
        # Test de connexion
        with _engine.connect() as conn:
            conn.execute("SELECT 1")
        
        logger.info("✅ Connexion à la base de données établie")
        return True
        
    except Exception as e:
        logger.error(f"❌ Erreur connexion base de données: {e}")
        raise


def get_db_session() -> Session:
    """Retourne une session de base de données"""
    global _SessionLocal
    
    if _SessionLocal is None:
        init_database()
    
    return _SessionLocal()


def get_db():
    """Générateur de session pour FastAPI Depends"""
    db = get_db_session()
    try:
        yield db
    finally:
        db.close()
