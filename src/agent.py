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
CHROMA_DB_PATH = BASE_DIR / "data" / "chroma_db_with_web"  # Base avec PDFs uniquement (temporaire)

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
                'batch_size': 32
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
            print(f"⚠️ Base Chroma introuvable: {CHROMA_DB_PATH}")
            return None
        
        _db = Chroma(
            persist_directory=str(CHROMA_DB_PATH),
            embedding_function=get_embedding_function(),
            collection_name="juridiction_senegal"
        )
    return _db


def get_retriever():
    """Lazy loading du retriever (optimisé pour performance)."""
    global _retriever
    if _retriever is None:
        db = get_db()
        if db is None:
            return None
        _retriever = db.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 10}  # Récupérer plus de docs pour meilleur reranking
        )
    return _retriever


def get_reranker():
    """Lazy loading du reranker FlashRank (optimisé pour performance)."""
    global _reranker
    if _reranker is None:
        try:
            from langchain_community.document_compressors import FlashrankRerank
            _reranker = FlashrankRerank(
                top_n=3,  # Réduit à 3 pour plus de rapidité
                model="ms-marco-MiniLM-L-12-v2"
            )
        except Exception as e:
            _reranker = False  # Marquer comme non disponible
    return _reranker if _reranker else None


# Initialisation au démarrage
try:
    db = get_db()
    retriever = get_retriever()
except Exception as e:
    db = None
    retriever = None

# LLMs
# Modèle pour le routage (rapide, peu de tokens) - utiliser modèle plus rapide
router_llm = ChatGroq(
    model_name="llama-3.1-8b-instant",  # Modèle rapide pour classification
    temperature=0,
    max_tokens=20,  # Réduit pour plus de rapidité
    timeout=15  # Timeout réduit
)

# Modèle pour la génération (optimisé pour vitesse)
generation_llm = ChatGroq(
    model_name="llama-3.3-70b-versatile",  # Modèle actuel Groq
    temperature=0,
    max_tokens=1500,  # Réduit pour des réponses plus rapides
    timeout=45  # Timeout réduit
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


def generate_initial_questions() -> List[str]:
    """
    Génère 4-5 questions suggérées à l'accueil basées sur le contenu réel de la base de données.
    Récupère des documents variés et utilise le LLM pour générer des questions contextualisées.
    """
    try:
        db = get_db()
        if not db or not retriever:
            # Fallback sur questions statiques si pas d'accès à la base
            domain_questions = {
                "travail": [
                    "Combien de jours de congé ai-je droit par an ?",
                    "Quels sont mes droits si je suis licencié ?",
                ],
                "constitution": [
                    "Qui peut être président du Sénégal ?",
                    "Quels sont mes droits fondamentaux ?",
                ],
                "syndicats": [
                    "Puis-je faire grève au Sénégal ?",
                ],
                "droits": [
                    "Peut-on me discriminer à l'embauche ?",
                ],
                "penal": [
                    "Quelles sont les peines pour violence au Sénégal ?",
                ],
            }
            selected = []
            for domain, questions in domain_questions.items():
                selected.extend(random.sample(questions, 1))
            return selected[:5]
        
        # Récupérer des documents variés avec des requêtes thématiques
        search_queries = [
            "droit travail contrat employeur",
            "constitution président gouvernement droits",
            "syndicat grève représentation",
            "discrimination égalité protection",
            "pénal infraction sanction",
            "protection sociale retraite"
        ]
        
        all_docs = []
        for query in search_queries:
            try:
                docs = retriever.invoke(query)
                if docs:
                    all_docs.extend(docs[:2])
            except:
                pass
        
        if not all_docs:
            # Fallback sur questions statiques
            return [
                "Combien de jours de congé ai-je droit par an ?",
                "Qui peut être président du Sénégal ?",
                "Puis-je faire grève au Sénégal ?",
            ]
        
        # Sélectionner les 10 documents uniques les plus pertinents
        unique_docs = {}
        for doc in all_docs[:20]:
            content_hash = doc.page_content[:100] if doc.page_content else ""
            if content_hash and content_hash not in unique_docs:
                unique_docs[content_hash] = doc
        
        sample_docs = list(unique_docs.values())[:10]
        
        # Préparer le contexte pour le LLM
        docs_context = "\n".join([
            f"- {doc.metadata.get('source_name', 'Document')}: {doc.page_content[:250]}..."
            for doc in sample_docs
        ])
        
        # Générer les questions avec le LLM basées sur les documents
        prompt = ChatPromptTemplate.from_template("""Tu es un assistant juridique sénégalais expert. Basé sur les documents juridiques réels suivants,
génère 4 à 5 questions pratiques et variées que les citoyens sénégalais pourraient se poser.

Les questions DOIVENT:
1. Être directement basées sur les documents fournis
2. Couvrir DIFFÉRENTS THÈMES DIFFÉRENTS (travail, constitution, syndicats, droits, pénal, etc.)
3. Être des questions pratiques et du quotidien
4. Être des questions que les gens cherchent vraiment à poser
5. Être formulées en français clair et simple
6. VARIERZ LES FORMULATIONS - Ne pas toutes commencer par "Combien", "Mon employeur", "Ai-je droit"

Documents réels de la base:
{docs_context}

Génère 4 à 5 questions VARIÉES (différents domaines), une par ligne, sans numérotation ni tirets:
Question 1?
Question 2?
Question 3?
Question 4?""")
        
        chain = prompt | generation_llm
        result = chain.invoke({"docs_context": docs_context})
        
        # Extraire et parser les questions
        suggested = result.content.strip().split('\n')
        suggested = [
            q.strip().rstrip('?').strip() + '?' 
            for q in suggested 
            if q.strip() and len(q.strip()) > 10 and '?' in q
        ]
        
        # Mélanger les questions pour plus de variété à chaque appel
        random.shuffle(suggested)
        
        # Retourner 4-5 questions variées basées sur les documents
        final_questions = suggested[:5] if len(suggested) >= 4 else suggested
        
        if final_questions:
            return final_questions
        
        # Fallback si pas de questions générées
        return [
            "Quels sont mes droits au travail ?",
            "Qui peut être président du Sénégal ?",
            "Puis-je faire grève ?",
        ]
    
    except Exception as e:
        print(f"⚠️ Erreur génération questions initiales: {str(e)}")
        # Fallback robuste
        return [
            "Quels sont mes droits au travail ?",
            "Qui peut être président du Sénégal ?",
            "Puis-je faire grève ?",
        ]


def generate_suggested_questions(question: str, sources: List[dict], answer: str) -> List[str]:
    """
    Génère 3 questions suggérées dynamiquement basées sur le contenu réel des documents.
    Utilise le LLM pour créer des questions pertinentes au contexte.
    """
    try:
        # Si pas de sources ou réponse vide, retourner liste vide
        if not sources or not answer or "Je ne dispose pas" in answer:
            return []
        
        # Préparer le contexte des sources pour le LLM
        sources_context = "\n".join([
            f"- {s.get('source', 'Document')}: {s.get('content', '')[:300]}"
            for s in sources[:3]
        ])
        
        # Prompt pour générer des questions basées sur le contenu réel
        prompt = ChatPromptTemplate.from_template("""Tu es un assistant juridique sénégalais expert. Basé sur les documents suivants et la réponse fournie, 
génère exactement 3 questions suggérées pertinentes que l'utilisateur pourrait poser ensuite.

Les questions doivent:
1. Être directement liées au contenu des documents fournis
2. Approfondir les thèmes abordés dans la réponse
3. Être des questions pratiques et pertinentes pour un citoyen sénégalais
4. Être formulées en français clair et simple
5. Ne pas être la même question que celle posée initialement: "{question}"

Documents source:
{sources_context}

Réponse fournie:
{answer}

Génère exactement 3 questions, une par ligne, sans numérotation ni tirets. Format simple:
Question 1?
Question 2?
Question 3?""")
        
        # Générer les questions avec le LLM
        chain = prompt | generation_llm
        result = chain.invoke({
            "question": question,
            "sources_context": sources_context,
            "answer": answer
        })
        
        # Extraire et parser les questions
        suggested = result.content.strip().split('\n')
        suggested = [q.strip().rstrip('?').strip() + '?' for q in suggested if q.strip()]
        
        # Retourner les 3 premières questions valides
        return suggested[:3]
    
    except Exception as e:
        # En cas d'erreur, fallback sur la liste statique
        print(f"⚠️ Erreur génération questions: {str(e)}")
        if CITIZEN_QUESTIONS:
            shuffled = CITIZEN_QUESTIONS.copy()
            random.shuffle(shuffled)
            return shuffled[:3]
        return []


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
        return {"category": "JURIDIQUE", "messages": messages}
    
    # Classification LLM pour les cas ambigus (optimisé)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Réponds 'JURIDIQUE' ou 'AUTRE'. En cas de doute: 'JURIDIQUE'."),
        ("human", "{question}")
    ])
    
    try:
        response = (prompt | router_llm).invoke({"question": state["question"]})
        category = "AUTRE" if "AUTRE" in response.content.upper() else "JURIDIQUE"
    except Exception:
        category = "JURIDIQUE"
    
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
    """Récupère et reranke les documents pertinents pour garantir la cohérence."""
    question = state["question"]
    
    if not retriever:
        return {"context_documents": []}
    
    try:
        # Récupération initiale (k=10 pour avoir plus de choix)
        docs = retriever.invoke(question)
        
        if not docs:
            return {"context_documents": []}
        
        # Reranking avec FlashRank pour améliorer la pertinence
        reranker = get_reranker()
        if reranker:
            try:
                # Reranker tous les documents récupérés
                reranked = reranker.compress_documents(docs, question)
                
                if reranked and len(reranked) > 0:
                    # Prendre les top 3 documents les plus pertinents
                    docs = reranked[:3]
                else:
                    # Fallback: prendre les 3 premiers documents originaux
                    docs = docs[:3]
                
            except Exception as e:
                # Fallback en cas d'erreur de reranking
                docs = docs[:3]
        else:
            # Pas de reranker: utiliser directement les top 3
            docs = docs[:3]
        
        # Filtrer les documents vides ou de mauvaise qualité
        filtered_docs = []
        for doc in docs:
            content = doc.page_content.strip()
            # Ignorer les documents trop courts (< 50 caractères)
            if len(content) >= 50:
                filtered_docs.append(doc)
        
        # Si tous les documents sont filtrés, utiliser les originaux
        if not filtered_docs:
            filtered_docs = docs[:3]
        
        # Convertir en format sérialisable avec informations enrichies
        context_docs = [document_to_source(doc, i) for i, doc in enumerate(filtered_docs)]
        
        return {"context_documents": context_docs}
        
    except Exception as e:
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
    
    # CAS 2: Construire le contexte à partir des documents avec formatage clair
    context_parts = []
    for idx, doc in enumerate(context_docs[:3], 1):  # Limiter à 3 documents max
        # En-tête de source clair avec numérotation
        header = f"SOURCE {idx}: {doc['title']}"
        if doc.get('article'):
            header += f" - {doc['article']}"
        if doc.get('breadcrumb'):
            header += f" (Section: {doc['breadcrumb']})"
        
        # Contenu (limité pour performance)
        content = doc.get('content', '')
        if len(content) > 500:
            content = content[:500] + "..."
        
        part = f"{header}\n{'='*60}\n{content}"
        context_parts.append(part)
    
    context = "\n\n".join(context_parts)
    
    # Construire l'historique de conversation (optimisé - seulement 4 derniers messages)
    history_str = ""
    if len(messages) > 1:
        recent = messages[-4:]  # Réduits de 8 à 4 pour performance
        parts = []
        for msg in recent:
            if isinstance(msg, HumanMessage):
                parts.append(f"U: {msg.content[:100]}")  # Limiter la longueur
            elif isinstance(msg, AIMessage):
                parts.append(f"A: {msg.content[:150]}")  # Limiter la longueur
        history_str = "\n".join(parts) + "\n\n"
    
    # Prompt renforcé pour garantir la cohérence sources-réponse
    template = """Tu es YoonAssist, assistant juridique sénégalais expert.

⚠️ RÈGLES STRICTES - NON NÉGOCIABLES:
1. Réponds UNIQUEMENT en te basant sur le CONTEXTE ci-dessous
2. NE JAMAIS inventer ou ajouter d'informations non présentes dans le CONTEXTE
3. Si la réponse n'est PAS dans le CONTEXTE: réponds "Je ne dispose pas de cette information précise dans les textes juridiques fournis."
4. TOUJOURS citer la source exacte: [Article X du Code Y] ou [Titre du document]
5. Si plusieurs articles sont pertinents, cite-les tous

FORMAT DE RÉPONSE:
- Réponse directe et précise (2-4 phrases)
- Citer la source entre crochets: [Article X du Code Y]
- Détails concrets: montants, délais, conditions
- Langage clair et accessible

{history}CONTEXTE JURIDIQUE (SOURCE DE VÉRITÉ):
{context}

QUESTION: {question}

RÉPONSE (basée strictement sur le CONTEXTE):"""
    
    prompt = ChatPromptTemplate.from_template(template)
    
    try:
        history_block = f"HISTORIQUE:\n{history_str}\n\n" if history_str else ""
        response = (prompt | generation_llm).invoke({
            "question": question,
            "context": context,
            "history": history_block
        })
        answer = response.content.strip()
        
        # Vérification de cohérence: si la réponse cite des articles non présents dans le contexte
        # On ajoute un avertissement (pour debug)
        context_lower = context.lower()
        answer_lower = answer.lower()
        
        # Extraire les références d'articles de la réponse
        import re
        article_refs = re.findall(r'article\s+\d+', answer_lower)
        
        # Vérifier que ces articles sont bien dans le contexte
        for ref in article_refs:
            if ref not in context_lower:
                # L'article cité n'est pas dans le contexte fourni!
                # En mode production, on pourrait logger cela
                pass  # Pour l'instant on laisse passer mais c'est détectable
        
    except Exception as e:
        answer = "Une erreur s'est produite lors de la génération de la réponse. Veuillez réessayer."
    
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

# Agent RAG initialisé