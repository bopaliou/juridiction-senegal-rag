from fastapi import FastAPI,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import traceback

from src.agent import agent_app
from langchain_core.messages import HumanMessage, AIMessage

class QueryRequest(BaseModel):
    question: str
    thread_id: str = "default"  # ID de thread pour la conversation
    
class MessageHistory(BaseModel):
    role: str  # "user" ou "assistant"
    content: str
    
class QueryResponse(BaseModel):
    reponse: str
    sources: List[str]
    history: List[MessageHistory] = []  # Les 5 derniers messages
    suggested_questions: List[str] = []  # Questions suggérées basées sur les documents
    
app = FastAPI(
    title="Agent Juridique Sénégalais RAG API",
    description="API pour interagir avec l'agent juridique basé sur RAG.",
    version="1.0.0",
    )

# Configuration CORS pour permettre les requêtes depuis Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/ask", response_model=QueryResponse)
async def ask_question(request: QueryRequest):
    """
    Endpoint principal : Reçoit une question, interroge l'agent, 
    et retourne la réponse avec les sources.
    """
    try:
        # Utiliser le checkpointer avec un thread_id pour maintenir l'historique
        config = {"configurable": {"thread_id": request.thread_id}}
        
        # Récupérer l'état précédent depuis le checkpointer pour obtenir l'historique
        # Si c'est une nouvelle conversation, l'état sera None
        try:
            # Obtenir l'état actuel depuis le checkpointer
            current_state = agent_app.get_state(config)
            previous_messages = current_state.values.get("messages", []) if current_state else []
        except Exception:  # noqa: BLE001
            previous_messages = []
        
        # Invoke avec le config pour utiliser le checkpointer
        # Passer les messages précédents pour maintenir l'historique
        final_state = agent_app.invoke(
            {"question": request.question, "messages": previous_messages},
            config=config
        )
        
        # Les sources sont déjà extraites dans les nœuds (generate_node ou handle_non_juridique)
        sources = final_state.get("sources", ["Aucune source disponible"])
        
        # Extraire et formater l'historique (les 5 derniers messages)
        messages = final_state.get("messages", [])
        history = []
        
        # Prendre les 5 derniers messages (10 messages max pour 5 échanges)
        recent_messages = messages[-10:] if len(messages) > 10 else messages
        
        for msg in recent_messages:
            if isinstance(msg, HumanMessage):
                history.append(MessageHistory(role="user", content=msg.content))
            elif isinstance(msg, AIMessage):
                history.append(MessageHistory(role="assistant", content=msg.content))
        
        # Récupérer les questions suggérées depuis l'état
        suggested_questions = final_state.get("suggested_questions", [])
        
        return QueryResponse(
            reponse = final_state.get("answer", "Aucune réponse générée"),
            sources = sources if sources else ["Aucune source disponible"],
            history = history,
            suggested_questions = suggested_questions
        )
    except Exception as e:
        # --- BLOC DE DÉBOGAGE TEMPORAIRE ---
        print("\n--- ERREUR INTERNE DE L'AGENT LANGGRAPH ---")
        traceback.print_exc() # Affiche l'erreur complète dans le terminal Uvicorn
        print("------------------------------------------\n")
        
        # Levez une HTTPException pour que l'API réponde, mais avec un message clair
        raise HTTPException(
            status_code=500, 
            detail="Une erreur interne est survenue. Consultez les logs du terminal Uvicorn pour le détail."
        ) from e
    