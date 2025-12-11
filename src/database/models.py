"""
Modèles SQLAlchemy pour la base de données
"""

from datetime import datetime, date
from sqlalchemy import Column, String, Integer, DateTime, Date, Text, Float, ForeignKey
from sqlalchemy.orm import relationship
from .connection import Base


class User(Base):
    """Modèle utilisateur avec crédits"""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    plan = Column(String, default="free")
    credits = Column(Integer, default=30)
    monthly_quota = Column(Integer, default=30)
    reset_date = Column(Date, default=lambda: date.today())
    last_topup_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    usage_logs = relationship("UsageLog", back_populates="user")
    credit_transactions = relationship("CreditTransaction", back_populates="user")


class UsageLog(Base):
    """Log d'utilisation des crédits"""
    __tablename__ = "usage_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    credits_spent = Column(Integer, default=0)
    request_type = Column(String, default="unknown")
    client_ip = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="usage_logs")


class CreditTransaction(Base):
    """Transactions de crédits"""
    __tablename__ = "credit_transactions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)
    pack_type = Column(String, nullable=True)
    payment_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="credit_transactions")
