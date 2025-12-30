"""
Moteur de crédits YoonAssist AI
Gère l'attribution, le débit et le suivi des crédits utilisateur
"""

import math
import logging
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass

from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc

from ..database.connection import get_db_session
from ..models.credit_models import (
    UserCredits, UsageLog, CreditTransaction, CreditEstimate,
    PlanType, TopUpPack, REQUEST_COSTS, PLAN_CONFIGS,
    TOPUP_CONFIGS, ABUSE_LIMITS
)
from ..database.models import User, UsageLog as DBUsageLog, CreditTransaction as DBCreditTransaction

logger = logging.getLogger(__name__)


@dataclass
class CreditResult:
    """Résultat d'une opération de crédit"""
    success: bool
    message: str
    new_balance: Optional[int] = None
    transaction_id: Optional[int] = None


class CreditEngine:
    """Moteur principal de gestion des crédits"""

    def __init__(self):
        try:
            self.db_session = get_db_session()
            self.use_db = True
        except Exception as e:
            logger.warning(f"Mode développement sans DB: {e}")
            self.db_session = None
            self.use_db = False

    def get_user_credits(self, user_id: str) -> Optional[UserCredits]:
        """Récupère les informations de crédit d'un utilisateur"""
        # Mode développement sans base de données
        if not self.use_db or not self.db_session:
            logger.info("Mode dev - retour de crédits simulés")
            return UserCredits(
                user_id=user_id,
                credits=30,
                plan="free",
                monthly_quota=30,
                reset_date=datetime.now().date() + timedelta(days=30)
            )
        
        try:
            user = self.db_session.query(User).filter(User.id == user_id).first()
            if not user:
                return None

            return UserCredits.from_orm(user)
        except Exception as e:
            logger.error(f"Erreur récupération crédits utilisateur {user_id}: {e}")
            return None

    def estimate_cost(self, request_type: str, estimated_tokens: Optional[int] = None) -> CreditEstimate:
        """Estime le coût en crédits pour une requête"""
        try:
            if request_type not in REQUEST_COSTS:
                raise ValueError(f"Type de requête inconnu: {request_type}")

            base_cost = REQUEST_COSTS[request_type]

            # Utiliser l'estimation fournie ou la valeur par défaut
            tokens = estimated_tokens or base_cost["tokens"]
            credits = math.ceil(tokens / 1000)  # Formule: ceil(total_tokens / 1000)

            # S'assurer qu'on ne descend pas en dessous du coût minimum
            credits = max(credits, base_cost["credits"])

            return CreditEstimate(
                estimated_tokens=tokens,
                estimated_credits=credits,
                can_execute=True
            )
        except Exception as e:
            logger.error(f"Erreur estimation coût: {e}")
            return CreditEstimate(
                estimated_tokens=0,
                estimated_credits=0,
                can_execute=False,
                message=str(e)
            )

    def can_execute_request(self, user_id: str, request_type: str,
                          estimated_tokens: Optional[int] = None,
                          client_ip: Optional[str] = None) -> Tuple[bool, str]:
        """Vérifie si un utilisateur peut exécuter une requête"""
        try:
            user = self.get_user_credits(user_id)
            if not user:
                return False, "Utilisateur non trouvé"

            # Vérifier les limites anti-abus
            abuse_check = self._check_abuse_limits(user_id, client_ip)
            if not abuse_check[0]:
                return abuse_check

            # Estimer le coût
            estimate = self.estimate_cost(request_type, estimated_tokens)

            if user.credits < estimate.estimated_credits:
                return False, f"Crédits insuffisants. Besoin de {estimate.estimated_credits}, disponible: {user.credits}"

            return True, f"OK - Coût estimé: {estimate.estimated_credits} crédits"

        except Exception as e:
            logger.error(f"Erreur vérification requête {user_id}: {e}")
            return False, f"Erreur système: {str(e)}"

    def debit_credits(self, user_id: str, credits_needed: int, reason: str,
                     request_type: str = "unknown") -> CreditResult:
        """Débite des crédits du compte utilisateur"""
        try:
            user = self.db_session.query(User).filter(User.id == user_id).first()
            if not user:
                return CreditResult(success=False, message="Utilisateur non trouvé")

            if user.credits < credits_needed:
                return CreditResult(
                    success=False,
                    message=f"Crédits insuffisants. Disponible: {user.credits}, requis: {credits_needed}",
                    new_balance=user.credits
                )

            # Débiter les crédits
            old_balance = user.credits
            user.credits -= credits_needed
            user.updated_at = datetime.utcnow()

            # Créer la transaction
            transaction = DBCreditTransaction(
                user_id=user_id,
                amount=-credits_needed,
                reason=reason
            )
            self.db_session.add(transaction)
            self.db_session.commit()

            logger.info(f"Crédits débités: {user_id} -{credits_needed} ({reason})")

            return CreditResult(
                success=True,
                message=f"Crédits débités: {credits_needed}",
                new_balance=user.credits,
                transaction_id=transaction.id
            )

        except Exception as e:
            self.db_session.rollback()
            logger.error(f"Erreur débit crédits {user_id}: {e}")
            return CreditResult(success=False, message=f"Erreur débit: {str(e)}")

    def add_credits(self, user_id: str, credits_to_add: int, reason: str,
                   pack_type: Optional[TopUpPack] = None, payment_id: Optional[str] = None) -> CreditResult:
        """Ajoute des crédits au compte utilisateur"""
        try:
            user = self.db_session.query(User).filter(User.id == user_id).first()
            if not user:
                return CreditResult(success=False, message="Utilisateur non trouvé")

            # Ajouter les crédits
            old_balance = user.credits
            user.credits += credits_to_add
            user.last_topup_at = datetime.utcnow()
            user.updated_at = datetime.utcnow()

            # Créer la transaction
            transaction = DBCreditTransaction(
                user_id=user_id,
                amount=credits_to_add,
                reason=reason,
                pack_type=pack_type.value if pack_type else None,
                payment_id=payment_id
            )
            self.db_session.add(transaction)
            self.db_session.commit()

            logger.info(f"Crédits ajoutés: {user_id} +{credits_to_add} ({reason})")

            return CreditResult(
                success=True,
                message=f"Crédits ajoutés: {credits_to_add}",
                new_balance=user.credits,
                transaction_id=transaction.id
            )

        except Exception as e:
            self.db_session.rollback()
            logger.error(f"Erreur ajout crédits {user_id}: {e}")
            return CreditResult(success=False, message=f"Erreur ajout: {str(e)}")

    def log_usage(self, user_id: str, tokens_in: int, tokens_out: int,
                 request_type: str, credits_spent: int,
                 client_ip: Optional[str] = None, user_agent: Optional[str] = None) -> bool:
        """Log l'utilisation des crédits"""
        try:
            total_tokens = tokens_in + tokens_out

            usage_log = DBUsageLog(
                user_id=user_id,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                total_tokens=total_tokens,
                credits_spent=credits_spent,
                request_type=request_type,
                client_ip=client_ip,
                user_agent=user_agent
            )

            self.db_session.add(usage_log)
            self.db_session.commit()

            logger.info(f"Usage loggé: {user_id} - {credits_spent} crédits ({total_tokens} tokens)")
            return True

        except Exception as e:
            self.db_session.rollback()
            logger.error(f"Erreur logging usage {user_id}: {e}")
            return False

    def reset_monthly_credits(self) -> int:
        """Reset les crédits mensuels pour tous les utilisateurs éligibles"""
        try:
            # Trouver les utilisateurs dont la date de reset est dépassée
            users_to_reset = self.db_session.query(User).filter(
                User.reset_date <= date.today()
            ).all()

            reset_count = 0
            for user in users_to_reset:
                plan_config = PLAN_CONFIGS.get(PlanType(user.plan))
                if plan_config:
                    old_credits = user.credits
                    user.credits = plan_config.monthly_credits
                    user.monthly_quota = plan_config.monthly_credits
                    user.reset_date = date.today() + timedelta(days=30)
                    user.updated_at = datetime.utcnow()

                    # Log la transaction de reset
                    transaction = DBCreditTransaction(
                        user_id=user.id,
                        amount=plan_config.monthly_credits - old_credits,
                        reason="monthly_reset"
                    )
                    self.db_session.add(transaction)
                    reset_count += 1

            self.db_session.commit()
            logger.info(f"Reset mensuel effectué pour {reset_count} utilisateurs")
            return reset_count

        except Exception as e:
            self.db_session.rollback()
            logger.error(f"Erreur reset mensuel: {e}")
            return 0

    def _check_abuse_limits(self, user_id: str, client_ip: Optional[str] = None) -> Tuple[bool, str]:
        """Vérifie les limites anti-abus"""
        try:
            user = self.get_user_credits(user_id)
            if not user:
                return False, "Utilisateur non trouvé"

            plan_limits = ABUSE_LIMITS.get(user.plan)
            if not plan_limits:
                return True, "OK"

            # Vérifier les requêtes par heure
            hour_ago = datetime.utcnow() - timedelta(hours=1)
            recent_requests = self.db_session.query(DBUsageLog).filter(
                and_(
                    DBUsageLog.user_id == user_id,
                    DBUsageLog.timestamp >= hour_ago
                )
            ).count()

            if recent_requests >= plan_limits["requests_per_hour"]:
                return False, f"Limite de {plan_limits['requests_per_hour']} requêtes/heure atteinte"

            return True, "OK"

        except Exception as e:
            logger.error(f"Erreur vérification abuse {user_id}: {e}")
            return False, f"Erreur vérification: {str(e)}"

    def get_usage_stats(self, user_id: str, days: int = 30) -> Dict[str, Any]:
        """Récupère les statistiques d'utilisation d'un utilisateur"""
        try:
            since_date = datetime.utcnow() - timedelta(days=days)

            # Statistiques générales
            stats = self.db_session.query(
                func.count(DBUsageLog.id).label('total_requests'),
                func.sum(DBUsageLog.total_tokens).label('total_tokens'),
                func.sum(DBUsageLog.credits_spent).label('total_credits_spent'),
                func.avg(DBUsageLog.total_tokens).label('avg_tokens_per_request')
            ).filter(
                and_(
                    DBUsageLog.user_id == user_id,
                    DBUsageLog.timestamp >= since_date
                )
            ).first()

            # Répartition par type de requête
            request_types = self.db_session.query(
                DBUsageLog.request_type,
                func.count(DBUsageLog.id).label('count'),
                func.sum(DBUsageLog.credits_spent).label('credits')
            ).filter(
                and_(
                    DBUsageLog.user_id == user_id,
                    DBUsageLog.timestamp >= since_date
                )
            ).group_by(DBUsageLog.request_type).all()

            return {
                "period_days": days,
                "total_requests": stats.total_requests or 0,
                "total_tokens": stats.total_tokens or 0,
                "total_credits_spent": stats.total_credits_spent or 0,
                "avg_tokens_per_request": float(stats.avg_tokens_per_request or 0),
                "request_types": [
                    {
                        "type": rt.request_type,
                        "count": rt.count,
                        "credits": rt.credits or 0
                    } for rt in request_types
                ]
            }

        except Exception as e:
            logger.error(f"Erreur récupération stats {user_id}: {e}")
            return {}


# Instance globale du moteur de crédits
credit_engine = CreditEngine()
