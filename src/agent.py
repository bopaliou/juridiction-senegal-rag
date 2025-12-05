"""
Agent RAG pour le droit sénégalais.
Version refactorisée pour une cohérence absolue entre sources et réponses.
"""

from dotenv import load_dotenv
from typing import List, TypedDict, Optional
from pathlib import Path
import os
import json
import random
import gc
import functools
import time

from langchain_groq import ChatGroq
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, AIMessage

from langgraph.graph import StateGraph, END

load_dotenv()

# =============================================================================
# CONFIGURATION
# =============================================================================

BASE_DIR = Path(__file__).resolve().parent.parent
CHROMA_DB_PATH = BASE_DIR / "data" / "chroma_db"

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY non définie")

# Seuil de pertinence minimum pour les documents (après reranking)
# Note: FlashRank ne retourne pas toujours relevance_score, donc on utilise directement les top rerankés
RELEVANCE_THRESHOLD = 0.0  # Désactivé car FlashRank gère déjà le tri par pertinence

# =============================================================================
# LAZY LOADING DES RESSOURCES
# =============================================================================

_embedding_function = None
_db = None
_retriever = None
_reranker = None


def get_embedding_function():
    """Lazy loading du modèle d'embeddings (optimisé)."""
    global _embedding_function
    if _embedding_function is None:
        _embedding_function = HuggingFaceEmbeddings(
            model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={
                'normalize_embeddings': True,
                'batch_size': 32,
                'show_progress_bar': False  # Désactiver la barre de progression pour la performance
            }
        )
        # Forcer le garbage collection après chargement
        gc.collect()
    return _embedding_function


def get_db():
    """Lazy loading de ChromaDB."""
    global _db
    if _db is None:
        if not CHROMA_DB_PATH.exists():
            raise FileNotFoundError(f"Base Chroma introuvable: {CHROMA_DB_PATH}")
        
        _db = Chroma(
            persist_directory=str(CHROMA_DB_PATH),
            embedding_function=get_embedding_function(),
            collection_name="juridiction_senegal"
        )
    return _db


def get_retriever():
    """Lazy loading du retriever (optimisé pour récupérer plus de documents)."""
    global _retriever
    if _retriever is None:
        _retriever = get_db().as_retriever(
            search_type="similarity",
            search_kwargs={"k": 10}  # Augmenter à 10 pour avoir plus de choix après reranking
        )
    return _retriever


def get_reranker():
    """Lazy loading du reranker FlashRank (fallback silencieux si indisponible)."""
    global _reranker
    if _reranker is None:
        try:
            from langchain_community.document_compressors import FlashrankRerank
            _reranker = FlashrankRerank(
                top_n=4,
                model="ms-marco-MiniLM-L-12-v2"
            )
            print("✅ FlashRank Reranker chargé")
        except Exception as e:
            print(f"ℹ️ Reranker indisponible: {e}")
            _reranker = False  # Marquer comme non disponible
    return _reranker if _reranker else None


# Initialisation au démarrage
try:
    db = get_db()
    retriever = get_retriever()
    print(f"✅ Base de données chargée: {CHROMA_DB_PATH}")
except Exception as e:
    print(f"❌ Erreur d'initialisation: {e}")
    db = None
    retriever = None

# LLMs
# Modèle pour le routage (rapide, peu de tokens)
router_llm = ChatGroq(
    model_name="llama-3.3-70b-versatile",  # Modèle actuel Groq
    temperature=0,
    max_tokens=50,
    timeout=30
)

# Modèle pour la génération (plus capable)
generation_llm = ChatGroq(
    model_name="llama-3.3-70b-versatile",  # Modèle actuel Groq
    temperature=0,
    max_tokens=2000,
    timeout=60
)


# =============================================================================
# ÉTAT DE L'AGENT
# =============================================================================

class AgentState(TypedDict):
    question: str
    category: str
    context_documents: List[dict]  # Documents sérialisables (pas Document objects)
    answer: str
    sources: List[str]
    messages: List
    suggested_questions: List[str]


# =============================================================================
# UTILITAIRES
# =============================================================================

def extract_source_name(source_path: str) -> str:
    """Extrait un nom de source propre depuis un chemin ou URL."""
    if not source_path:
        return "Document juridique"
    
    # URLs connues
    if "conseilconstitutionnel" in source_path.lower():
        return "Constitution du Sénégal"
    if "collectivites" in source_path.lower():
        return "Code des Collectivités Locales"
    if "aviation" in source_path.lower():
        return "Code de l'Aviation Civile"
    
    # Fichiers PDF - utiliser source_name si disponible dans les métadonnées
    # Sinon extraire du chemin
    name = Path(source_path).stem
    
    # Mapping des noms connus
    name_mapping = {
        "codedutravail": "Code du Travail",
        "code_du_travail": "Code du Travail",
        "codepenal": "Code Pénal",
        "code_penal": "Code Pénal",
        "constitution": "Constitution du Sénégal",
        "codefamille": "Code de la Famille",
        "codecivil": "Code Civil",
    }
    
    name_lower = name.lower().replace("-", "").replace("_", "")
    for key, value in name_mapping.items():
        if key in name_lower:
            return value
    
    # Fallback: nettoyer le nom
    return name.replace("_", " ").replace("-", " ").title()


def document_to_source(doc: Document, idx: int) -> dict:
    """Convertit un Document LangChain en objet source sérialisable."""
    metadata = doc.metadata or {}
    source_path = metadata.get('source', metadata.get('source_name', ''))
    
    # Utiliser source_name si disponible (format amélioré de l'ingestion)
    source_name = metadata.get('source_name', extract_source_name(source_path))
    
    # Extraire un extrait pertinent (max 500 caractères)
    content = doc.page_content or ""
    if len(content) > 500:
        content = content[:500] + "..."
    
    return {
        "id": f"source_{idx}",
        "title": source_name,
        "content": content,
        "article": metadata.get('article', ''),
        "breadcrumb": metadata.get('breadcrumb', ''),
        "page": metadata.get('page'),
        "url": source_path if source_path.startswith('http') else None
    }


# =============================================================================
# QUESTIONS CITOYENNES SUGGÉRÉES
# =============================================================================

CITIZEN_QUESTIONS = [
    # Travail
    "Combien de jours de congé ai-je droit par an ?",
    "Mon employeur peut-il me licencier sans préavis ?",
    "Que faire si mon employeur ne me paie pas ?",
    "Comment démissionner de mon travail ?",
    "Quels sont mes droits si je suis licencié ?",
    "Est-ce que j'ai droit à un contrat écrit ?",
    "Quelle est la durée légale du travail au Sénégal ?",
    "Ai-je droit à une pause pendant ma journée ?",
    "Quels sont mes droits en cas d'accident de travail ?",
    "Ai-je droit à un congé de maternité ?",
    "Quel est le salaire minimum au Sénégal ?",
    "Combien de temps dure la période d'essai ?",
    
    # Retraite
    "À quel âge puis-je partir à la retraite ?",
    "Comment calculer ma pension de retraite ?",
    "Combien d'années faut-il cotiser pour la retraite ?",
    
    # Droits fondamentaux
    "Le travail forcé est-il interdit au Sénégal ?",
    "Ai-je le droit de m'exprimer librement au travail ?",
    "Peut-on me discriminer à l'embauche ?",
    
    # Syndicats
    "Ai-je le droit de créer un syndicat ?",
    "Puis-je faire grève au Sénégal ?",
    
    # Justice
    "Quelles sont les sanctions pour harcèlement au travail ?",
    "Comment porter plainte contre mon employeur ?",
    "Comment saisir l'inspection du travail ?",
]


def generate_suggested_questions(question: str, sources: List[dict], answer: str) -> List[str]:
    """Génère 3 questions suggérées basées sur le contexte."""
    if not sources or not answer or "Je ne dispose pas" in answer:
        return []
    
    # Détecter le domaine de la question
    question_lower = question.lower()
    domain_keywords = {
        'travail': ['travail', 'employeur', 'salarié', 'congé', 'salaire', 'licenciement'],
        'retraite': ['retraite', 'pension', 'cotisation'],
        'penal': ['pénal', 'peine', 'infraction', 'tribunal'],
    }
    
    detected_domain = 'general'
    for domain, keywords in domain_keywords.items():
        if any(kw in question_lower for kw in keywords):
            detected_domain = domain
            break
    
    # Scorer les questions par pertinence
    scored = []
    for q in CITIZEN_QUESTIONS:
        if q.lower() == question_lower:
            continue
        
        score = 0
        q_lower = q.lower()
        
        # Bonus si même domaine
        for domain, keywords in domain_keywords.items():
            if domain == detected_domain and any(kw in q_lower for kw in keywords):
                score += 5
        
        # Bonus pour mots communs
        common = set(question_lower.split()) & set(q_lower.split())
        score += len([w for w in common if len(w) > 4])
        
        scored.append((score, q))
    
    # Mélanger les questions à score élevé pour variété
    scored.sort(key=lambda x: -x[0])
    top_questions = [q for _, q in scored[:12]]
    random.shuffle(top_questions)
    
    return top_questions[:3]


# =============================================================================
# MOTS-CLÉS JURIDIQUES
# =============================================================================

JURIDIQUE_KEYWORDS = [
    "travail", "employeur", "salarié", "contrat", "licenciement", "congé", "salaire",
    "retraite", "syndicat", "grève", "pénal", "peine", "infraction", "tribunal",
    "constitution", "président", "parlement", "droit", "loi", "décret", "code",
    "article", "sénégal", "juridique", "juridiction", "obligation", "sanction"
]


# =============================================================================
# NŒUDS DU GRAPHE
# =============================================================================

def classify_question(state: AgentState) -> dict:
    """Classifie la question comme juridique ou hors-sujet."""
    question = state["question"].lower()
    messages = state.get("messages", [])
    messages.append(HumanMessage(content=state["question"]))
    
    # Classification rapide par mots-clés
    if any(kw in question for kw in JURIDIQUE_KEYWORDS):
        print(f"✅ Question juridique (mots-clés)")
        return {"category": "JURIDIQUE", "messages": messages}
    
    # Classification LLM pour les cas ambigus
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Tu classifies les questions pour un assistant juridique sénégalais.
Réponds UNIQUEMENT 'JURIDIQUE' ou 'AUTRE'.
En cas de doute, réponds 'JURIDIQUE'."""),
        ("human", "{question}")
    ])
    
    try:
        response = (prompt | router_llm).invoke({"question": state["question"]})
        category = "AUTRE" if "AUTRE" in response.content.upper() else "JURIDIQUE"
    except Exception:
        category = "JURIDIQUE"
    
    print(f"📊 Classification: {category}")
    return {"category": category, "messages": messages}


def handle_non_juridique(state: AgentState) -> dict:
    """Répond poliment aux questions hors-sujet."""
    messages = state.get("messages", [])
    answer = "Je suis un assistant spécialisé dans le droit sénégalais. Je ne peux répondre qu'aux questions juridiques concernant le Sénégal (Code du Travail, Code Pénal, Constitution, etc.)."
    messages.append(AIMessage(content=answer))
    
    return {
        "answer": answer,
        "sources": [],
        "messages": messages,
        "suggested_questions": [],
        "context_documents": []
    }


def retrieve_node(state: AgentState) -> dict:
    """Récupère et reranke les documents pertinents."""
    question = state["question"]
    
    if not retriever:
        print("❌ Retriever non disponible")
        return {"context_documents": []}
    
    try:
        # Récupération initiale
        docs = retriever.invoke(question)
        print(f"📊 Récupérés: {len(docs)} documents")
        
        if not docs:
            return {"context_documents": []}
        
        # Garder les documents originaux pour fallback
        original_docs = docs[:3]  # Top 3 originaux
        
        # Reranking avec FlashRank si disponible
        reranker = get_reranker()
        if reranker:
            try:
                reranked = reranker.compress_documents(docs, question)
                
                # FlashRank ne retourne pas toujours relevance_score dans metadata
                # Utiliser les documents rerankés directement (déjà triés par pertinence)
                if reranked and len(reranked) > 0:
                    # Prendre les top documents rerankés (déjà triés par pertinence)
                    # Utiliser au moins 3 documents pour avoir du contexte
                    docs = reranked[:max(3, len(reranked))]
                    print(f"📊 Après reranking: {len(docs)} documents retenus (top rerankés)")
                else:
                    # Fallback si reranking échoue
                    docs = original_docs
                    print(f"⚠️ Reranking vide, utilisation des originaux")
                
            except Exception as e:
                print(f"⚠️ Erreur reranking: {e}")
                docs = original_docs  # Utiliser les originaux en cas d'erreur
        
        # Convertir en format sérialisable
        context_docs = [document_to_source(doc, i) for i, doc in enumerate(docs)]
        
        return {"context_documents": context_docs}
        
    except Exception as e:
        print(f"❌ Erreur retrieval: {e}")
        return {"context_documents": []}


def generate_node(state: AgentState) -> dict:
    """Génère la réponse en utilisant UNIQUEMENT les documents récupérés."""
    question = state["question"]
    context_docs = state.get("context_documents", [])
    messages = state.get("messages", [])
    
    # CAS 1: Aucun document pertinent
    if not context_docs:
        answer = "Je ne dispose pas de cette information dans les textes de loi fournis. Veuillez reformuler votre question ou consulter un professionnel du droit."
        messages.append(AIMessage(content=answer))
        return {
            "answer": answer,
            "sources": [],
            "messages": messages,
            "suggested_questions": [],
            "context_documents": []
        }
    
    # CAS 2: Construire le contexte à partir des documents
    context_parts = []
    for doc in context_docs:
        part = f"[{doc['title']}]"
        if doc.get('article'):
            part += f" {doc['article']}"
        if doc.get('breadcrumb'):
            part += f" ({doc['breadcrumb']})"
        part += f"\n{doc['content']}"
        context_parts.append(part)
    
    context = "\n\n---\n\n".join(context_parts)
    
    # Construire l'historique de conversation
    history_str = ""
    if len(messages) > 1:
        recent = messages[-8:]
        parts = []
        for msg in recent:
            if isinstance(msg, HumanMessage):
                parts.append(f"Utilisateur: {msg.content}")
            elif isinstance(msg, AIMessage):
                parts.append(f"Assistant: {msg.content}")
        history_str = "\n".join(parts)
    
    # Prompt équilibré
    template = """Tu es YoonAssist, assistant juridique spécialisé dans le droit sénégalais. Réponds UNIQUEMENT avec le CONTEXTE fourni.

STYLE DE RÉPONSE:
- Donne une réponse COMPLÈTE mais STRUCTURÉE (ni trop courte ni trop longue)
- Commence directement par l'information demandée
- Explique les points importants avec des détails utiles (montants, délais, conditions)
- Utilise des listes à puces pour les énumérations
- Cite les articles de loi entre crochets à la fin de chaque point : [Article X du Code Y]
- Termine par une note pratique si pertinent
- Si l'information n'est pas dans le contexte : "Je ne dispose pas de cette information dans les textes fournis."

{history}

CONTEXTE:
{context}

QUESTION: {question}

RÉPONSE:"""
    
    prompt = ChatPromptTemplate.from_template(template)
    
    try:
        history_block = f"HISTORIQUE:\n{history_str}\n\n" if history_str else ""
        response = (prompt | generation_llm).invoke({
            "question": question,
            "context": context,
            "history": history_block
        })
        answer = response.content.strip()
    except Exception as e:
        print(f"❌ Erreur génération: {e}")
        answer = "Une erreur s'est produite lors de la génération de la réponse."
    
    messages.append(AIMessage(content=answer))
    
    # COHÉRENCE: Si le LLM dit qu'il n'a pas l'info, ne pas afficher de sources
    no_info_phrases = [
        "je ne dispose pas",
        "je n'ai pas trouvé",
        "je ne trouve pas",
        "pas d'information",
        "aucune information",
        "je ne peux pas répondre",
        "information non disponible",
    ]
    
    answer_lower = answer.lower()
    has_no_info = any(phrase in answer_lower for phrase in no_info_phrases)
    
    if has_no_info:
        # Le LLM indique qu'il n'a pas l'info → pas de sources
        print("⚠️ Réponse 'pas d'info' détectée → sources vidées pour cohérence")
        return {
            "answer": answer,
            "sources": [],
            "messages": messages,
            "suggested_questions": [],
            "context_documents": []
        }
    
    # Les sources sont EXACTEMENT les documents qui ont servi au contexte
    sources_list = [json.dumps(doc) for doc in context_docs]
    
    # Générer les questions suggérées
    suggested = generate_suggested_questions(question, context_docs, answer)
    
    return {
        "answer": answer,
        "sources": sources_list,
        "messages": messages,
        "suggested_questions": suggested,
        "context_documents": []
    }


# =============================================================================
# CONSTRUCTION DU GRAPHE
# =============================================================================

workflow = StateGraph(AgentState)

# Nœuds
workflow.add_node("classify", classify_question)
workflow.add_node("retrieve", retrieve_node)
workflow.add_node("generate", generate_node)
workflow.add_node("non_juridique", handle_non_juridique)

# Point d'entrée
workflow.set_entry_point("classify")


# Routage conditionnel
def route_after_classify(state: AgentState) -> str:
    return "retrieve" if state.get("category") == "JURIDIQUE" else "non_juridique"


workflow.add_conditional_edges("classify", route_after_classify)
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)
workflow.add_edge("non_juridique", END)

# Compilation (sans checkpointer pour éviter les erreurs de sérialisation)
agent_app = workflow.compile()

print("✅ Agent RAG initialisé")
