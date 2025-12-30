"""
API endpoints pour le système de crédits YoonAssist AI
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional
import logging
from datetime import datetime

from ..database.connection import get_db
from ..auth.dependencies import get_current_user
from .credit_engine import credit_engine
from ..models.credit_models import (
    CreditEstimate, PlanInfo, TopUpInfo, PLAN_CONFIGS, TOPUP_CONFIGS
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/credits", tags=["credits"])


@router.get("/balance", response_model=dict)
async def get_credit_balance(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Récupère le solde de crédits de l'utilisateur"""
    try:
        user_credits = credit_engine.get_user_credits(current_user["id"])
        if not user_credits:
            # Mode développement - retour de données par défaut
            return {
                "credits": 30,
                "plan": "free",
                "monthlyQuota": 30,
                "resetDate": datetime.utcnow().isoformat(),
                "usagePercentage": 0
            }

        return {
            "credits": user_credits.credits,
            "plan": user_credits.plan,
            "monthlyQuota": user_credits.monthly_quota,
            "resetDate": user_credits.reset_date.isoformat(),
            "usagePercentage": (user_credits.monthly_quota - user_credits.credits) / user_credits.monthly_quota * 100 if user_credits.monthly_quota > 0 else 0
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur récupération solde {current_user['id']}: {e}")
        # Mode dégradé - retour de données par défaut
        return {
            "credits": 30,
            "plan": "free",
            "monthlyQuota": 30,
            "resetDate": datetime.utcnow().isoformat(),
            "usagePercentage": 0
        }


@router.post("/estimate", response_model=CreditEstimate)
async def estimate_request_cost(
    request_type: str,
    estimated_tokens: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Estime le coût en crédits pour une requête"""
    try:
        # Vérifier d'abord si l'utilisateur peut faire cette requête
        can_execute, message = credit_engine.can_execute_request(
            current_user["id"], request_type, estimated_tokens
        )

        estimate = credit_engine.estimate_cost(request_type, estimated_tokens)
        user_credits = credit_engine.get_user_credits(current_user["id"])

        estimate.can_execute = can_execute
        estimate.current_balance = user_credits.credits if user_credits else 0
        estimate.message = message

        return estimate
    except Exception as e:
        logger.error(f"Erreur estimation coût {current_user['id']}: {e}")
        raise HTTPException(status_code=500, detail="Erreur estimation")


@router.get("/plans", response_model=list[PlanInfo])
async def get_available_plans():
    """Récupère la liste des plans disponibles"""
    return list(PLAN_CONFIGS.values())


@router.get("/topups", response_model=list[TopUpInfo])
async def get_topup_packs():
    """Récupère la liste des packs de recharge disponibles"""
    return list(TOPUP_CONFIGS.values())


@router.post("/topup")
async def purchase_topup(
    pack_type: str,
    payment_method: str = "mobile_money",  # Simulation
    current_user: dict = Depends(get_current_user)
):
    """Achète un pack de recharge"""
    try:
        if pack_type not in TOPUP_CONFIGS:
            raise HTTPException(status_code=400, detail="Pack invalide")

        pack_info = TOPUP_CONFIGS[pack_type]

        # Simulation de paiement réussi
        # En production, intégrer un vrai processeur de paiement
        payment_id = f"simulated_{current_user['id']}_{pack_type}"

        result = credit_engine.add_credits(
            user_id=current_user["id"],
            credits_to_add=pack_info.credits,
            reason=f"topup_{pack_type}",
            pack_type=pack_type,
            payment_id=payment_id
        )

        if not result.success:
            raise HTTPException(status_code=400, detail=result.message)

        return {
            "success": True,
            "pack_type": pack_type,
            "credits_added": pack_info.credits,
            "new_balance": result.new_balance,
            "payment_id": payment_id,
            "amount_paid": pack_info.price_xof
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur achat topup {current_user['id']}: {e}")
        raise HTTPException(status_code=500, detail="Erreur achat")


@router.get("/usage/stats")
async def get_usage_statistics(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Récupère les statistiques d'utilisation"""
    try:
        stats = credit_engine.get_usage_stats(current_user["id"], days)
        return stats
    except Exception as e:
        logger.error(f"Erreur récupération stats {current_user['id']}: {e}")
        raise HTTPException(status_code=500, detail="Erreur récupération statistiques")


@router.get("/transactions")
async def get_credit_transactions(
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Récupère l'historique des transactions de crédits"""
    try:
        from ..database.models import CreditTransaction

        transactions = db.query(CreditTransaction).filter(
            CreditTransaction.user_id == current_user["id"]
        ).order_by(CreditTransaction.timestamp.desc()).offset(offset).limit(limit).all()

        return {
            "transactions": [
                {
                    "id": t.id,
                    "amount": t.amount,
                    "reason": t.reason,
                    "pack_type": t.pack_type,
                    "timestamp": t.timestamp.isoformat(),
                    "payment_id": t.payment_id
                } for t in transactions
            ],
            "total": len(transactions)
        }
    except Exception as e:
        logger.error(f"Erreur récupération transactions {current_user['id']}: {e}")
        raise HTTPException(status_code=500, detail="Erreur récupération transactions")


# Endpoint administrateur pour reset mensuel (protégé)
@router.post("/admin/reset-monthly")
async def admin_reset_monthly_credits(
    # TODO: Ajouter authentification admin
):
    """Reset mensuel des crédits (admin seulement)"""
    try:
        reset_count = credit_engine.reset_monthly_credits()
        return {"success": True, "users_reset": reset_count}
    except Exception as e:
        logger.error(f"Erreur reset mensuel: {e}")
        raise HTTPException(status_code=500, detail="Erreur reset mensuel")
