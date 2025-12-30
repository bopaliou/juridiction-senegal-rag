"""
Dépendances d'authentification pour FastAPI
"""

from fastapi import Depends, HTTPException, Header
from typing import Optional
import os
import logging

logger = logging.getLogger(__name__)

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    Récupère l'utilisateur actuel à partir du token JWT Supabase.
    Pour l'instant, retourne un utilisateur fictif pour le développement.
    """
    # Mode développement - retourne un utilisateur par défaut
    if not authorization or not SUPABASE_JWT_SECRET:
        logger.warning("Mode développement - authentification simplifiée")
        return {
            "id": "dev-user-123",
            "email": "dev@yoonassist.ai",
            "role": "authenticated"
        }
    
    # TODO: Implémenter la vérification JWT Supabase en production
    # from supabase import create_client
    # Vérifier le token et extraire l'utilisateur
    
    try:
        # Extraction basique du token
        token = authorization.replace("Bearer ", "")
        
        # Pour l'instant, retourne un utilisateur fictif
        # En production, décoder le JWT et vérifier la signature
        return {
            "id": "user-from-token",
            "email": "user@example.com",
            "role": "authenticated"
        }
    except Exception as e:
        logger.error(f"Erreur authentification: {e}")
        raise HTTPException(
            status_code=401,
            detail="Token invalide ou expiré"
        )


async def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    Version optionnelle de get_current_user.
    Retourne None si pas authentifié au lieu de lever une exception.
    """
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None
