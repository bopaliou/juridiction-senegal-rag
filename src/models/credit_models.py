"""
Modèles de données pour le système de crédits YoonAssist AI
Utilise Pydantic pour la validation et la sérialisation
"""

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class PlanType(str, Enum):
    FREE = "free"
    PREMIUM = "premium"
    PREMIUM_PLUS = "premium_plus"
    PRO = "pro"


class TopUpPack(str, Enum):
    SMALL = "pack_small"      # 100 crédits
    MEDIUM = "pack_medium"    # 500 crédits
    LARGE = "pack_large"      # 1500 crédits


class UserCredits(BaseModel):
    """Modèle utilisateur avec informations de crédits"""
    id: str
    email: str
    plan: PlanType
    credits: int = Field(..., ge=0, description="Crédits disponibles")
    monthly_quota: int = Field(..., ge=0, description="Quota mensuel total")
    reset_date: date = Field(..., description="Date de reset mensuel")
    created_at: datetime
    last_topup_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UsageLog(BaseModel):
    """Log d'utilisation pour tracking des crédits"""
    id: Optional[int] = None
    user_id: str
    tokens_in: int = Field(..., ge=0, description="Tokens d'entrée")
    tokens_out: int = Field(..., ge=0, description="Tokens de sortie")
    total_tokens: int = Field(..., ge=0, description="Total tokens")
    credits_spent: int = Field(..., ge=0, description="Crédits dépensés")
    request_type: str = Field(..., description="Type de requête (simple/procedure/pdf)")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class CreditEstimate(BaseModel):
    """Estimation de coût avant exécution"""
    estimated_tokens: int
    estimated_credits: int
    can_execute: bool
    current_balance: int
    message: Optional[str] = None


class CreditTransaction(BaseModel):
    """Transaction de crédits"""
    user_id: str
    amount: int = Field(..., description="Montant positif pour ajout, négatif pour débit")
    reason: str = Field(..., description="Raison de la transaction")
    pack_type: Optional[TopUpPack] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PlanInfo(BaseModel):
    """Informations sur un plan"""
    plan_type: PlanType
    name: str
    monthly_credits: int
    features: List[str]
    price_xof: int


class TopUpInfo(BaseModel):
    """Informations sur un pack de recharge"""
    pack_type: TopUpPack
    name: str
    credits: int
    price_xof: int
    description: str


# Constantes des plans
PLAN_CONFIGS = {
    PlanType.FREE: PlanInfo(
        plan_type=PlanType.FREE,
        name="Gratuit",
        monthly_credits=30,
        features=["Questions juridiques basiques", "Support communautaire"],
        price_xof=0
    ),
    PlanType.PREMIUM: PlanInfo(
        plan_type=PlanType.PREMIUM,
        name="Premium",
        monthly_credits=500,
        features=["Questions illimitées", "Procédures guidées", "Support prioritaire"],
        price_xof=2000
    ),
    PlanType.PREMIUM_PLUS: PlanInfo(
        plan_type=PlanType.PREMIUM_PLUS,
        name="Premium+",
        monthly_credits=1500,
        features=["Analyse PDF basique", "Modèles juridiques", "Support 24/7"],
        price_xof=4500
    ),
    PlanType.PRO: PlanInfo(
        plan_type=PlanType.PRO,
        name="Professionnel",
        monthly_credits=10000,
        features=["Analyse PDF avancée", "IA spécialisée", "API dédiée", "Support dédié"],
        price_xof=15000
    )
}

# Constantes des packs de recharge
TOPUP_CONFIGS = {
    TopUpPack.SMALL: TopUpInfo(
        pack_type=TopUpPack.SMALL,
        name="Pack Dépanne",
        credits=100,
        price_xof=500,
        description="Idéal pour une question urgente"
    ),
    TopUpPack.MEDIUM: TopUpInfo(
        pack_type=TopUpPack.MEDIUM,
        name="Pack Dossier",
        credits=500,
        price_xof=2000,
        description="Pour suivre un dossier complet"
    ),
    TopUpPack.LARGE: TopUpInfo(
        pack_type=TopUpPack.LARGE,
        name="Pack Pro",
        credits=1500,
        price_xof=5000,
        description="Volume élevé pour professionnels"
    )
}

# Constantes de coût par type de requête
REQUEST_COSTS = {
    "simple": {"tokens": 1500, "credits": 1},
    "procedure": {"tokens": 3000, "credits": 3},
    "pdf": {"tokens": 7000, "credits": 10}
}

# Limites anti-abus
ABUSE_LIMITS = {
    PlanType.FREE: {
        "requests_per_hour": 5,
        "block_pdf": True,
        "max_tokens_per_request": 2000
    },
    PlanType.PREMIUM: {
        "requests_per_hour": 50,
        "block_pdf": False,
        "max_tokens_per_request": 5000
    },
    PlanType.PREMIUM_PLUS: {
        "requests_per_hour": 200,
        "block_pdf": False,
        "max_tokens_per_request": 10000
    },
    PlanType.PRO: {
        "requests_per_hour": 1000,
        "block_pdf": False,
        "max_tokens_per_request": 50000
    }
}
