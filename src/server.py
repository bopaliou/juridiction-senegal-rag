"""
API FastAPI pour l'Agent Juridique Sénégalais RAG.
Gère le parsing des sources JSON et la validation Pydantic.
"""

import asyncio
import json
import logging
import os
import traceback
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional, Union

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, AIMessage

from src.agent import agent_app
from src.security import SecureQueryRequest
from src.middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    RequestLoggingMiddleware,
)

# =============================================================================
# CONFIGURATION DU LOGGING
# =============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(name)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("api")

# =============================================================================
# CONFIGURATION
# =============================================================================

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
).split(",")

REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "90"))  # 90 secondes par défaut (optimisé)
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "4"))  # Nombre de workers pour le thread pool


# =============================================================================
# MODÈLES PYDANTIC
# =============================================================================

class SourceModel(BaseModel):
    """Modèle pour une source juridique structurée."""
    id: str = Field(default="unknown", description="Identifiant unique de la source")
    title: str = Field(default="Document Juridique", description="Titre de la source")
    content: str = Field(default="", description="Extrait du contenu")
    article: Optional[str] = Field(default=None, description="Numéro d'article si applicable")
    breadcrumb: Optional[str] = Field(default=None, description="Contexte hiérarchique")
    url: Optional[str] = Field(default=None, description="URL de la source si disponible")
    page: Optional[Union[str, int]] = Field(default=None, description="Numéro de page")
    domain: Optional[str] = Field(default=None, description="Domaine juridique")


class MessageHistory(BaseModel):
    """Modèle pour l'historique des messages."""
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1)


class QueryResponse(BaseModel):
    """Modèle de réponse de l'API avec sources typées."""
    reponse: str
    sources: List[SourceModel] = []
    history: List[MessageHistory] = []
    suggested_questions: List[str] = []


# =============================================================================
# PARSING DES SOURCES
# =============================================================================

def parse_sources(raw_sources: List) -> List[SourceModel]:
    """
    Parse intelligemment les sources renvoyées par l'agent.
    
    Gère les cas:
    - String JSON valide: '{"title": "Code...", "content": "..."}'
    - Dictionnaire Python
    - String simple (message d'erreur ou fallback)
    
    Args:
        raw_sources: Liste mixte de sources (str, dict, etc.)
        
    Returns:
        Liste de SourceModel validés
    """
    parsed_sources: List[SourceModel] = []
    
    if not raw_sources:
        return []
    
    for idx, item in enumerate(raw_sources):
        try:
            data = None
            
            # CAS 1: String JSON (commence par { ou [)
            if isinstance(item, str):
                item_stripped = item.strip()
                
                # Ignorer les messages système/erreur
                if item_stripped in [
                    "Aucune source pertinente disponible",
                    "Aucune source disponible",
                    "Aucun document trouvé pour cette question.",
                    "Question jugée hors du champ d'expertise juridique."
                ]:
                    logger.debug(f"Source ignorée (message système): {item_stripped[:50]}")
                    continue
                
                # Tenter le parsing JSON
                if item_stripped.startswith('{') or item_stripped.startswith('['):
                    try:
                        data = json.loads(item_stripped)
                    except json.JSONDecodeError as e:
                        logger.warning(f"Erreur parsing JSON source {idx}: {e}")
                        # Fallback: créer une source basique
                        data = {
                            "id": f"source_{idx}",
                            "title": "Document Juridique",
                            "content": item_stripped[:500]
                        }
                else:
                    # String simple - créer une source info
                    data = {
                        "id": f"info_{idx}",
                        "title": "Information",
                        "content": item_stripped[:500]
                    }
            
            # CAS 2: Dictionnaire Python
            elif isinstance(item, dict):
                data = item
            
            # CAS 3: Autre type - ignorer
            else:
                logger.warning(f"Type de source non supporté: {type(item)}")
                continue
            
            # Valider et créer le SourceModel
            if data:
                # Assurer les champs obligatoires
                if 'id' not in data:
                    data['id'] = f"source_{idx}"
                if 'title' not in data:
                    data['title'] = "Document Juridique"
                if 'content' not in data:
                    data['content'] = ""
                
                # Tronquer le contenu si trop long
                if len(data.get('content', '')) > 10000:
                    data['content'] = data['content'][:10000] + "..."
                
                source = SourceModel(**data)
                parsed_sources.append(source)
                logger.debug(f"Source parsée: {source.title[:40]}")
                
        except Exception as e:
            logger.error(f"Erreur parsing source {idx}: {e}")
            continue
    
    return parsed_sources


# =============================================================================
# APPLICATION FASTAPI
# =============================================================================

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Gestion du cycle de vie de l'application."""
    logger.info("🚀 Démarrage de l'API Agent Juridique Sénégalais RAG...")
    yield
    logger.info("🛑 Arrêt de l'API...")


app = FastAPI(
    title="Agent Juridique Sénégalais RAG API",
    description="API sécurisée pour interagir avec l'agent juridique basé sur RAG.",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Middlewares de sécurité (ordre important)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestLoggingMiddleware)
# Compression GZip optimisée (compresser à partir de 500 bytes)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Configuration CORS sécurisée et optimisée
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    expose_headers=["X-Process-Time", "X-Rate-Limit-Remaining"],
    max_age=3600,  # Cache preflight requests pendant 1 heure
)


# =============================================================================
# ENDPOINTS
# =============================================================================

@app.get("/health")
async def health_check():
    """Endpoint de santé pour vérifier que l'API fonctionne."""
    chroma_db_path = Path("data/chroma_db")
    db_ready = chroma_db_path.exists() and any(chroma_db_path.iterdir())
    
    return {
        "status": "healthy" if db_ready else "initializing",
        "service": "Agent Juridique Sénégalais RAG API",
        "version": "2.0.0",
        "database_ready": db_ready
    }


@app.post("/ask", response_model=QueryResponse)
async def ask_question(request: SecureQueryRequest):
    """
    Endpoint principal: interroge l'agent et retourne une réponse structurée.
    
    Sécurisé avec validation, rate limiting, et timeout.
    """
    logger.info(f"📥 Question reçue: {request.question[:50]}...")
    
    try:
        # Invoke avec timeout et gestion mémoire optimisée
        try:
            # Utiliser un thread pool pour éviter de bloquer l'event loop
            loop = asyncio.get_event_loop()
            final_state = await asyncio.wait_for(
                loop.run_in_executor(
                    None,  # Utiliser le thread pool par défaut
                    agent_app.invoke,
                    {"question": request.question, "messages": []}
                ),
                timeout=REQUEST_TIMEOUT
            )
            
            # Forcer le garbage collection après traitement pour libérer la mémoire
            import gc
            gc.collect()
            
        except asyncio.TimeoutError:
            logger.warning(f"⏱️ Timeout après {REQUEST_TIMEOUT}s")
            # Nettoyer la mémoire en cas de timeout
            import gc
            gc.collect()
            raise HTTPException(
                status_code=504,
                detail=f"La requête a pris plus de {REQUEST_TIMEOUT} secondes. Veuillez reformuler votre question."
            )
        
        # =================================================================
        # PARSING DES SOURCES (JSON → SourceModel)
        # =================================================================
        raw_sources = final_state.get("sources", [])
        parsed_sources = parse_sources(raw_sources)
        
        logger.info(f"📚 {len(parsed_sources)} sources parsées")
        
        # =================================================================
        # EXTRACTION DE L'HISTORIQUE
        # =================================================================
        messages = final_state.get("messages", [])
        history: List[MessageHistory] = []
        
        recent_messages = messages[-10:] if len(messages) > 10 else messages
        
        for msg in recent_messages:
            try:
                if isinstance(msg, HumanMessage):
                    content = msg.content[:5000] if len(msg.content) > 5000 else msg.content
                    history.append(MessageHistory(role="user", content=content))
                elif isinstance(msg, AIMessage):
                    content = msg.content[:10000] if len(msg.content) > 10000 else msg.content
                    history.append(MessageHistory(role="assistant", content=content))
            except Exception as e:
                logger.warning(f"Erreur parsing message: {e}")
        
        # =================================================================
        # QUESTIONS SUGGÉRÉES
        # =================================================================
        suggested_questions_raw = final_state.get("suggested_questions", [])
        suggested_questions = [
            q[:200] if len(q) > 200 else q
            for q in suggested_questions_raw[:5]
            if q and len(q.strip()) > 0
        ]
        
        # =================================================================
        # RÉPONSE
        # =================================================================
        answer = final_state.get("answer", "Aucune réponse générée")
        if len(answer) > 50000:
            answer = answer[:50000]
        
        logger.info(f"✅ Réponse générée ({len(answer)} caractères)")
        
        return QueryResponse(
            reponse=answer,
            sources=parsed_sources,
            history=history,
            suggested_questions=suggested_questions
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("--- ERREUR INTERNE ---")
        logger.error(f"Type: {type(e).__name__}")
        logger.error(f"Message: {str(e)}")
        traceback.print_exc(file=sys.stdout)
        logger.error("----------------------")
        
        raise HTTPException(
            status_code=500,
            detail="Une erreur interne est survenue. Veuillez réessayer plus tard."
        ) from e
