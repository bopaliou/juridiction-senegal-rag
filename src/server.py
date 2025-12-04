from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from typing import List
import traceback
import os
import asyncio
from contextlib import asynccontextmanager

from src.agent import agent_app
from src.security import SecureQueryRequest, sanitize_input
from src.middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    RequestLoggingMiddleware,
)
from langchain_core.messages import HumanMessage, AIMessage

# Configuration depuis les variables d'environnement
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
).split(",")

REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "120"))  # 2 minutes par défaut


class MessageHistory(BaseModel):
    """Modèle pour l'historique des messages."""
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1)


class QueryResponse(BaseModel):
    """Modèle de réponse de l'API."""
    reponse: str
    sources: List[str]
    history: List[MessageHistory] = []
    suggested_questions: List[str] = []


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Gestion du cycle de vie de l'application."""
    # Startup
    print("🚀 Démarrage de l'API Agent Juridique Sénégalais RAG...")
    yield
    # Shutdown
    print("🛑 Arrêt de l'API...")


app = FastAPI(
    title="Agent Juridique Sénégalais RAG API",
    description="API sécurisée pour interagir avec l'agent juridique basé sur RAG.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Middlewares de sécurité (ordre important)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)  # Compression pour les réponses > 1KB

# Configuration CORS sécurisée
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # Limiter aux méthodes nécessaires
    allow_headers=["Content-Type", "Authorization"],  # Limiter les en-têtes
    expose_headers=["X-Process-Time"],  # Exposer uniquement les en-têtes nécessaires
    max_age=3600,  # Cache des prérequêtes CORS pendant 1 heure
)


@app.get("/health")
async def health_check():
    """Endpoint de santé pour vérifier que l'API fonctionne."""
    # Vérifier si Chroma DB existe
    import os
    from pathlib import Path
    chroma_db_path = Path("data/chroma_db")
    db_ready = chroma_db_path.exists() and any(chroma_db_path.iterdir())
    
    return {
        "status": "healthy" if db_ready else "initializing",
        "service": "Agent Juridique Sénégalais RAG API",
        "database_ready": db_ready
    }

@app.post("/ask", response_model=QueryResponse)
async def ask_question(request: SecureQueryRequest):
    """
    Endpoint principal : Reçoit une question, interroge l'agent, 
    et retourne la réponse avec les sources.
    
    Sécurisé avec validation, rate limiting, et timeout.
    """
    try:
        # Invoke avec timeout pour éviter les requêtes trop longues
        # Note: Le checkpointer est désactivé pour éviter les erreurs de sérialisation des Documents
        try:
            final_state = await asyncio.wait_for(
                asyncio.to_thread(
                    agent_app.invoke,
                    {"question": request.question, "messages": []}
                ),
                timeout=REQUEST_TIMEOUT
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=504,
                detail=f"La requête a pris plus de {REQUEST_TIMEOUT} secondes. Veuillez reformuler votre question."
            )
        
        # Les sources sont déjà extraites dans les nœuds (generate_node ou handle_non_juridique)
        sources = final_state.get("sources", ["Aucune source disponible"])
        
        # Ne pas sanitizer les sources (React les sécurise automatiquement)
        # Seulement filtrer les sources vides et limiter la longueur
        filtered_sources = [
            source[:10000] if len(source) > 10000 else source
            for source in sources 
            if source and source != "Aucune source disponible"
        ]
        
        if not filtered_sources:
            filtered_sources = ["Aucune source disponible"]
        
        # Extraire et formater l'historique (les 5 derniers messages)
        messages = final_state.get("messages", [])
        history = []
        
        # Prendre les 5 derniers messages (10 messages max pour 5 échanges)
        recent_messages = messages[-10:] if len(messages) > 10 else messages
        
        for msg in recent_messages:
            if isinstance(msg, HumanMessage):
                # Limiter la longueur mais ne pas encoder HTML (React le gère)
                content = msg.content[:5000] if len(msg.content) > 5000 else msg.content
                history.append(MessageHistory(role="user", content=content))
            elif isinstance(msg, AIMessage):
                # Limiter la longueur mais ne pas encoder HTML (React le gère)
                content = msg.content[:10000] if len(msg.content) > 10000 else msg.content
                history.append(MessageHistory(role="assistant", content=content))
        
        # Récupérer les questions suggérées depuis l'état
        suggested_questions_raw = final_state.get("suggested_questions", [])
        suggested_questions = [
            q[:200] if len(q) > 200 else q
            for q in suggested_questions_raw[:5]  # Limiter à 5 questions max
            if q and len(q.strip()) > 0
        ]
        
        # Ne pas sanitizer la réponse (React la sécurise automatiquement)
        # Seulement limiter la longueur
        answer = final_state.get("answer", "Aucune réponse générée")
        if len(answer) > 50000:
            answer = answer[:50000]
        
        return QueryResponse(
            reponse=answer,
            sources=filtered_sources,
            history=history,
            suggested_questions=suggested_questions
        )
    except HTTPException:
        # Re-raise les HTTPException sans modification
        raise
    except Exception as e:
        # Logger l'erreur complète côté serveur uniquement
        print("\n--- ERREUR INTERNE DE L'AGENT LANGGRAPH ---")
        print(f"Type d'erreur: {type(e).__name__}")
        print(f"Message: {str(e)}")
        import sys
        traceback.print_exc(file=sys.stdout)
        print("------------------------------------------\n")
        
        # Ne pas exposer les détails de l'erreur au client
        raise HTTPException(
            status_code=500,
            detail="Une erreur interne est survenue. Veuillez réessayer plus tard."
        ) from e
    