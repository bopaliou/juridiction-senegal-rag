"""
Module de sécurité pour l'API FastAPI.
Gère la validation, la sanitization, et les middlewares de sécurité.
Optimisé pour la performance et la sécurité.
"""
import re
import html
from typing import Optional
from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, validator, Field
import time
from collections import defaultdict, OrderedDict
from functools import wraps
import threading

# Rate limiting optimisé avec LRU cache
_rate_limit_store: OrderedDict[str, list[float]] = OrderedDict()
_rate_limit_lock = threading.Lock()
_rate_limit_cleanup_interval = 300  # Nettoyer toutes les 5 minutes
_last_cleanup = time.time()
_max_rate_limit_entries = 10000  # Limiter le nombre d'entrées en mémoire

# Configuration de rate limiting
RATE_LIMIT_REQUESTS = 100  # Nombre de requêtes
RATE_LIMIT_WINDOW = 60  # Fenêtre de temps en secondes
MAX_QUESTION_LENGTH = 5000  # Longueur maximale de la question
MAX_THREAD_ID_LENGTH = 100  # Longueur maximale du thread_id


def sanitize_input(text: str, max_length: Optional[int] = None) -> str:
    """
    Nettoie et sanitize l'input utilisateur (optimisé).
    
    Args:
        text: Texte à nettoyer
        max_length: Longueur maximale autorisée
        
    Returns:
        Texte nettoyé
    """
    if not text or not isinstance(text, str):
        return ""
    
    # Vérifier la longueur avant traitement (optimisation)
    if max_length and len(text) > max_length:
        text = text[:max_length]
    
    # Échapper les caractères HTML
    text = html.escape(text)
    
    # Supprimer les caractères de contrôle (sauf \n, \r, \t)
    text = re.sub(r'[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    
    # Détecter et bloquer les patterns dangereux
    dangerous_patterns = [
        r'<script[^>]*>',
        r'javascript:',
        r'on\w+\s*=',
        r'data:text/html',
        r'vbscript:',
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            raise ValueError(f"Contenu dangereux détecté: {pattern}")
    
    return text.strip()


def validate_thread_id(thread_id: str) -> str:
    """
    Valide et nettoie le thread_id.
    
    Args:
        thread_id: ID de thread à valider
        
    Returns:
        Thread ID nettoyé
        
    Raises:
        HTTPException: Si le thread_id est invalide
    """
    if not thread_id:
        return "default"
    
    # Vérifier la longueur
    if len(thread_id) > MAX_THREAD_ID_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Thread ID trop long (max {MAX_THREAD_ID_LENGTH} caractères)"
        )
    
    # Vérifier le format (alphanumérique, tirets, underscores uniquement)
    if not re.match(r'^[a-zA-Z0-9_-]+$', thread_id):
        raise HTTPException(
            status_code=400,
            detail="Thread ID invalide. Utilisez uniquement des lettres, chiffres, tirets et underscores."
        )
    
    return thread_id


def rate_limit_check(client_id: str) -> bool:
    """
    Vérifie si le client a dépassé la limite de taux (optimisé avec LRU).
    
    Args:
        client_id: Identifiant du client (IP ou thread_id)
        
    Returns:
        True si la requête est autorisée, False sinon
    """
    global _last_cleanup
    
    current_time = time.time()
    cutoff_time = current_time - RATE_LIMIT_WINDOW
    
    with _rate_limit_lock:
        # Nettoyer les anciennes entrées périodiquement
        if current_time - _last_cleanup > _rate_limit_cleanup_interval:
            # Nettoyer les entrées expirées
            keys_to_remove = []
            for key, timestamps in _rate_limit_store.items():
                filtered = [ts for ts in timestamps if ts > cutoff_time]
                if filtered:
                    _rate_limit_store[key] = filtered
                else:
                    keys_to_remove.append(key)
            
            for key in keys_to_remove:
                _rate_limit_store.pop(key, None)
            
            # Limiter la taille du cache (LRU)
            while len(_rate_limit_store) > _max_rate_limit_entries:
                _rate_limit_store.popitem(last=False)  # Supprimer le plus ancien
            
            _last_cleanup = current_time
        
        # Vérifier le rate limit pour ce client
        if client_id in _rate_limit_store:
            # Déplacer en fin (LRU)
            timestamps = _rate_limit_store.pop(client_id)
            _rate_limit_store[client_id] = timestamps
        else:
            timestamps = []
            _rate_limit_store[client_id] = timestamps
        
        # Filtrer les timestamps dans la fenêtre
        timestamps = [ts for ts in timestamps if ts > cutoff_time]
        _rate_limit_store[client_id] = timestamps
        
        # Vérifier si la limite est dépassée
        if len(timestamps) >= RATE_LIMIT_REQUESTS:
            return False
        
        # Ajouter le timestamp actuel
        timestamps.append(current_time)
        _rate_limit_store[client_id] = timestamps
        
        return True


def get_client_id(request: Request) -> str:
    """
    Extrait l'identifiant du client depuis la requête.
    
    Args:
        request: Requête FastAPI
        
    Returns:
        Identifiant du client (IP)
    """
    # Utiliser l'IP du client
    if request.client:
        return request.client.host
    return "unknown"


class SecureQueryRequest(BaseModel):
    """Modèle Pydantic sécurisé pour les requêtes."""
    question: str = Field(..., min_length=1, max_length=MAX_QUESTION_LENGTH)
    thread_id: str = Field(default="default", max_length=MAX_THREAD_ID_LENGTH)
    
    @validator('question')
    def validate_question(cls, v):
        """Valide et nettoie la question."""
        if not v or not v.strip():
            raise ValueError('La question ne peut pas être vide')
        
        # Vérifier la longueur
        if len(v) > MAX_QUESTION_LENGTH:
            raise ValueError(f'La question est trop longue (max {MAX_QUESTION_LENGTH} caractères)')
        
        # Sanitize
        v = sanitize_input(v, max_length=MAX_QUESTION_LENGTH)
        
        return v
    
    @validator('thread_id')
    def validate_thread_id(cls, v):
        """Valide le thread_id."""
        if not v:
            return "default"
        
        if len(v) > MAX_THREAD_ID_LENGTH:
            raise ValueError(f'Thread ID trop long (max {MAX_THREAD_ID_LENGTH} caractères)')
        
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Thread ID invalide')
        
        return v
    
    class Config:
        """Configuration Pydantic."""
        str_strip_whitespace = True
        validate_assignment = True

