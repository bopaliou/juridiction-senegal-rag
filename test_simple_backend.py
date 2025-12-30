#!/usr/bin/env python3
"""
Backend simplifié pour tester sans base vectorielle
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Configuration
app = FastAPI(title="YoonAssist Test API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

class QuestionRequest(BaseModel):
    question: str
    thread_id: str = "default"

class ApiResponse(BaseModel):
    reponse: str
    sources: list = []
    suggested_questions: list = []

@app.get("/health")
async def health():
    return {"status": "ok", "service": "YoonAssist Test"}

@app.get("/credits/balance")
async def get_credits():
    """Endpoint de test pour les crédits."""
    return {
        "balance": 1000,
        "user_id": "test_user",
        "plan": "test"
    }

@app.post("/ask", response_model=ApiResponse)
async def ask_question(request: QuestionRequest):
    """Endpoint de test qui répond immédiatement."""
    
    # Réponse de test immédiate
    response = f"""
    Voici une réponse de test pour votre question: "{request.question}"
    
    Cette réponse est générée par le backend de test pour vérifier que la communication 
    frontend-backend fonctionne correctement.
    
    Le système principal semble avoir des problèmes de performance avec la base vectorielle 
    ou le traitement IA. Cette version de test permet de valider que:
    
    1. ✅ La connexion frontend-backend fonctionne
    2. ✅ Les timeouts sont correctement configurés  
    3. ✅ L'authentification passe (si configurée)
    4. ✅ Le format de réponse est correct
    
    Pour résoudre les problèmes de performance du système principal, il faudra:
    - Vérifier les logs du backend principal
    - Optimiser le chargement de la base vectorielle
    - Réduire la taille des documents indexés
    - Optimiser les requêtes IA
    """
    
    return ApiResponse(
        reponse=response.strip(),
        sources=[
            "Test Source 1: Configuration système",
            "Test Source 2: Documentation technique"
        ],
        suggested_questions=[
            "Comment optimiser les performances ?",
            "Quels sont les logs d'erreur ?",
            "Comment réduire les timeouts ?"
        ]
    )

if __name__ == "__main__":
    print("🚀 Démarrage du backend de test...")
    print("📝 Ce backend répond immédiatement pour tester la communication")
    print("🌐 URL: http://127.0.0.1:8001")
    
    uvicorn.run(
        app, 
        host="127.0.0.1", 
        port=8001,  # Port différent pour ne pas interférer
        log_level="info"
    )