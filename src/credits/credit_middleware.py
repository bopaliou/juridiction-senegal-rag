"""
Middleware de crédits pour les appels LLM
Gère automatiquement l'estimation, la vérification et le débit des crédits
"""

import time
import logging
from typing import Optional, Dict, Any, Callable
from functools import wraps

logger = logging.getLogger(__name__)


class CreditMiddleware:
    """Middleware pour gérer les crédits lors des appels LLM"""

    def __init__(self, credit_engine):
        self.credit_engine = credit_engine

    def wrap_llm_call(self, func: Callable) -> Callable:
        """Wrapper pour les appels LLM avec gestion des crédits"""

        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extraire les informations de l'utilisateur
            user_id = kwargs.get('user_id')
            request_type = kwargs.get('request_type', 'simple')
            estimated_tokens = kwargs.get('estimated_tokens')
            client_ip = kwargs.get('client_ip')
            user_agent = kwargs.get('user_agent')

            if not user_id:
                raise ValueError("user_id requis pour la gestion des crédits")

            # Étape 1: Vérifier si l'utilisateur peut exécuter la requête
            can_execute, message = self.credit_engine.can_execute_request(
                user_id, request_type, estimated_tokens, client_ip
            )

            if not can_execute:
                logger.warning(f"Requête bloquée pour {user_id}: {message}")
                return {
                    "error": "credit_limit_exceeded",
                    "message": message,
                    "low_balance": True
                }

            # Étape 2: Estimer le coût
            estimate = self.credit_engine.estimate_cost(request_type, estimated_tokens)
            logger.info(f"Coût estimé pour {user_id}: {estimate.estimated_credits} crédits")

            try:
                # Étape 3: Exécuter l'appel LLM
                start_time = time.time()
                result = await func(*args, **kwargs)
                execution_time = time.time() - start_time

                # Étape 4: Calculer les tokens réels utilisés
                usage = result.get('usage', {})
                tokens_in = usage.get('prompt_tokens', 0)
                tokens_out = usage.get('completion_tokens', 0)
                total_tokens = tokens_in + tokens_out

                # Étape 5: Calculer les crédits réellement dépensés
                actual_credits = max(1, (total_tokens + 999) // 1000)  # ceil(total_tokens / 1000)

                # Étape 6: Vérifier que l'utilisateur a assez de crédits (double vérification)
                user_credits = self.credit_engine.get_user_credits(user_id)
                if user_credits and user_credits.credits < actual_credits:
                    logger.error(f"Crédits insuffisants après exécution pour {user_id}")
                    return {
                        "error": "insufficient_credits",
                        "message": "Crédits insuffisants pour cette requête"
                    }

                # Étape 7: Débiter les crédits
                debit_result = self.credit_engine.debit_credits(
                    user_id=user_id,
                    credits_needed=actual_credits,
                    reason=f"llm_{request_type}",
                    request_type=request_type
                )

                if not debit_result.success:
                    logger.error(f"Échec débit crédits pour {user_id}: {debit_result.message}")
                    # En cas d'erreur de débit, on pourrait annuler la réponse
                    # Mais pour éviter de perdre du travail, on log juste l'erreur
                    result["credit_warning"] = "Erreur de débit des crédits"

                # Étape 8: Logger l'utilisation
                self.credit_engine.log_usage(
                    user_id=user_id,
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    request_type=request_type,
                    credits_spent=actual_credits,
                    client_ip=client_ip,
                    user_agent=user_agent
                )

                # Étape 9: Ajouter les informations de crédit à la réponse
                result["credits_used"] = actual_credits
                result["credits_remaining"] = debit_result.new_balance if debit_result.success else None

                logger.info(f"LLM call completed for {user_id}: {actual_credits} credits used, "
                           f"{total_tokens} tokens, {execution_time:.2f}s")

                return result

            except Exception as e:
                # En cas d'erreur LLM, on ne débite pas les crédits
                logger.error(f"Erreur LLM pour {user_id}: {e}")
                raise e

        return wrapper


# Fonction utilitaire pour estimer avant l'appel
def estimate_llm_cost(request_type: str, estimated_tokens: Optional[int] = None) -> Dict[str, Any]:
    """Fonction utilitaire pour estimer le coût avant l'appel LLM"""
    from .credit_engine import credit_engine

    estimate = credit_engine.estimate_cost(request_type, estimated_tokens)
    return {
        "estimated_credits": estimate.estimated_credits,
        "estimated_tokens": estimate.estimated_tokens,
        "can_estimate": True
    }


# Fonction utilitaire pour vérifier les limites d'abus
def check_abuse_limits(user_id: str, request_type: str, client_ip: Optional[str] = None) -> Dict[str, Any]:
    """Vérifie les limites anti-abus avant l'appel"""
    from .credit_engine import credit_engine

    can_execute, message = credit_engine.can_execute_request(user_id, request_type, None, client_ip)
    return {
        "can_execute": can_execute,
        "message": message
    }


# Instance globale du middleware
credit_middleware = CreditMiddleware(None)  # Sera initialisé avec le credit_engine
