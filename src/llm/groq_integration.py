"""
Intégration Groq avec système de crédits YoonAssist AI
Utilise le middleware de crédits pour gérer automatiquement les coûts
"""

import logging
from typing import Optional, Dict, Any, List
from groq import Groq

from ..credits.credit_middleware import credit_middleware
from ..config.settings import settings

logger = logging.getLogger(__name__)


class GroqWithCredits:
    """Client Groq avec gestion automatique des crédits"""

    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)
        self.model = "llama-3-8b-instant"  # Modèle optimisé pour les coûts

    @credit_middleware.wrap_llm_call
    async def chat_completion(
        self,
        user_id: str,
        messages: List[Dict[str, str]],
        request_type: str = "simple",
        estimated_tokens: Optional[int] = None,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Effectue un appel chat completion avec gestion des crédits"""

        # Configuration par défaut pour les coûts
        completion_kwargs = {
            "model": self.model,
            "messages": messages,
            "max_tokens": 1000,  # Limite pour contrôler les coûts
            "temperature": 0.7,
            **kwargs
        }

        # Ajustements selon le type de requête
        if request_type == "procedure":
            completion_kwargs["max_tokens"] = 2000
        elif request_type == "pdf":
            completion_kwargs["max_tokens"] = 3000

        try:
            # Appel Groq
            response = self.client.chat.completions.create(**completion_kwargs)

            # Extraire les informations d'utilisation
            choice = response.choices[0]
            usage = response.usage

            result = {
                "content": choice.message.content,
                "finish_reason": choice.finish_reason,
                "usage": {
                    "prompt_tokens": usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens
                },
                "model": response.model,
                "request_type": request_type
            }

            return result

        except Exception as e:
            logger.error(f"Erreur Groq pour {user_id}: {e}")
            raise e

    def estimate_tokens(self, messages: List[Dict[str, str]]) -> int:
        """Estime approximativement le nombre de tokens pour des messages"""
        # Estimation simple : ~4 caractères par token en moyenne
        total_chars = sum(len(msg.get("content", "")) for msg in messages)
        estimated_tokens = total_chars // 4

        # Ajustement pour les messages système et l'overhead
        estimated_tokens = int(estimated_tokens * 1.1)

        return max(50, estimated_tokens)  # Minimum 50 tokens


# Fonction utilitaire pour les appels LLM avec crédits
async def call_llm_with_credits(
    user_id: str,
    messages: List[Dict[str, str]],
    request_type: str = "simple",
    client_ip: Optional[str] = None,
    user_agent: Optional[str] = None
) -> Dict[str, Any]:
    """Fonction utilitaire pour appeler LLM avec gestion des crédits"""

    groq_client = GroqWithCredits(settings.GROQ_API_KEY)

    # Estimer les tokens pour le coût
    estimated_tokens = groq_client.estimate_tokens(messages)

    # Effectuer l'appel avec le middleware de crédits
    result = await groq_client.chat_completion(
        user_id=user_id,
        messages=messages,
        request_type=request_type,
        estimated_tokens=estimated_tokens,
        client_ip=client_ip,
        user_agent=user_agent
    )

    return result


# Exemple d'utilisation dans une route API
"""
from fastapi import APIRouter, Depends
from ..credits.credit_api import get_current_user

router = APIRouter()

@router.post("/ask")
async def ask_question(
    question: str,
    request_type: str = "simple",
    current_user: dict = Depends(get_current_user),
    request: Request
):
    messages = [
        {"role": "system", "content": "Vous êtes un assistant juridique sénégalais."},
        {"role": "user", "content": question}
    ]

    try:
        result = await call_llm_with_credits(
            user_id=current_user["id"],
            messages=messages,
            request_type=request_type,
            client_ip=request.client.host,
            user_agent=request.headers.get("user-agent")
        )

        return {
            "answer": result["content"],
            "credits_used": result.get("credits_used"),
            "credits_remaining": result.get("credits_remaining")
        }

    except Exception as e:
        if "credit_limit_exceeded" in str(e):
            raise HTTPException(status_code=402, detail="Limite de crédits atteinte")
        raise HTTPException(status_code=500, detail="Erreur serveur")
"""
