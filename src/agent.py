from dotenv import load_dotenv
from typing import List, TypedDict, Optional
import os

from langchain_groq import ChatGroq
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, AIMessage

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

# Custom BGE Reranker implementation
from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch
import gc


class BGEReranker:
    """Custom reranker using BGE reranker model from HuggingFace with lazy loading."""
    
    def __init__(self, model_name: str = "BAAI/bge-reranker-base", top_n: int = 3, device: Optional[str] = None):
        """
        Initialize the BGE reranker with lazy loading.
        
        Args:
            model_name: Name of the BGE reranker model from HuggingFace
            top_n: Number of top documents to return after reranking
            device: Device to run the model on ('cuda', 'cpu', or None for auto)
        """
        self.model_name = model_name
        self.top_n = top_n
        self._tokenizer = None
        self._model = None
        
        # Auto-detect device if not specified
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
    
    @property
    def tokenizer(self):
        """Lazy load tokenizer only when needed."""
        if self._tokenizer is None:
            # Use use_fast=False to avoid loading the large tokenizer.json if possible
            # Try to load with memory-efficient settings
            try:
                self._tokenizer = AutoTokenizer.from_pretrained(
                    self.model_name,
                    use_fast=False,  # Use slower but more memory-efficient tokenizer
                    local_files_only=False
                )
            except Exception as e:
                print(f"Error loading tokenizer: {e}")
                # Fallback: try with use_fast=True
                self._tokenizer = AutoTokenizer.from_pretrained(
                    self.model_name,
                    use_fast=True,
                    local_files_only=False
                )
        return self._tokenizer
    
    @property
    def model(self):
        """Lazy load model only when needed."""
        if self._model is None:
            try:
                # Load model with low_cpu_mem_usage if available
                self._model = AutoModelForSequenceClassification.from_pretrained(
                    self.model_name,
                    low_cpu_mem_usage=True,
                    torch_dtype=torch.float32 if self.device == "cpu" else torch.float16
                )
                self._model.to(self.device)
                self._model.eval()
            except Exception as e:
                print(f"Error loading reranker model: {e}")
                raise
        return self._model
    
    def compress_documents(
        self, documents: List[Document], query: str, batch_size: int = 8
    ) -> List[Document]:
        """
        Rerank documents based on relevance to the query.
        Processes documents in batches to reduce memory usage.
        
        Args:
            documents: List of Document objects to rerank
            query: Query string to rank documents against
            batch_size: Number of documents to process at once (default: 8)
            
        Returns:
            List of reranked Document objects (top_n)
        """
        if not documents:
            return documents
        
        # If we have fewer documents than top_n, just return all
        if len(documents) <= self.top_n:
            return documents
        
        scored_docs = []
        
        # Process in batches to reduce memory usage
        try:
            with torch.no_grad():
                for i in range(0, len(documents), batch_size):
                    batch_docs = documents[i:i + batch_size]
                    pairs = [[query, doc.page_content] for doc in batch_docs]
                    
                    # Tokenize batch
                    inputs = self.tokenizer(
                        pairs,
                        padding=True,
                        truncation=True,
                        return_tensors="pt",
                        max_length=512
                    ).to(self.device)
                    
                    # Get scores for batch
                    scores = self.model(**inputs, return_dict=True).logits.view(-1).float()
                    
                    # Store scores with documents
                    batch_scores = scores.cpu().tolist()
                    scored_docs.extend(list(zip(batch_scores, batch_docs)))
                    
                    # Clear cache periodically
                    if self.device == "cuda":
                        torch.cuda.empty_cache()
                    
                    # Force garbage collection every few batches
                    if i % (batch_size * 4) == 0:
                        gc.collect()
            
            # Sort by score (descending) and take top_n
            scored_docs.sort(key=lambda x: x[0], reverse=True)
            top_docs = [doc for _, doc in scored_docs[:self.top_n]]
            
            return top_docs
            
        except RuntimeError as e:
            if "out of memory" in str(e).lower() or "memory" in str(e).lower():
                print(f"Memory error during reranking: {e}")
                print("Falling back to returning original documents without reranking.")
                # Return original documents if reranking fails due to memory
                return documents[:self.top_n]
            else:
                raise


load_dotenv()

# Utiliser un chemin absolu pour éviter les problèmes de chemin relatif
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent
CHROMA_DB_PATH = BASE_DIR / "data" / "chroma_db"

# Configuration depuis les variables d'environnement
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY n'est pas définie dans les variables d'environnement")

# Initialiser l'embedding function (lazy loading pour optimiser le démarrage)
_embedding_function = None
_db = None
_retriever = None

def get_embedding_function():
    """Lazy loading de l'embedding function."""
    global _embedding_function
    if _embedding_function is None:
        _embedding_function = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'},  # Utiliser CPU par défaut pour éviter les problèmes GPU
            encode_kwargs={'normalize_embeddings': True}  # Normaliser pour de meilleures performances
        )
    return _embedding_function

def get_db():
    """Lazy loading de la base de données Chroma."""
    global _db
    if _db is None:
        if not CHROMA_DB_PATH.exists():
            raise FileNotFoundError(
                f"Base de données Chroma introuvable: {CHROMA_DB_PATH}\n"
                "Exécutez: python src/ingestion.py"
            )
        
        _db = Chroma(
            persist_directory=str(CHROMA_DB_PATH),
            embedding_function=get_embedding_function(),
            collection_name="juridiction_senegal"
        )
        
        # Vérifier que la base de données contient des documents
        try:
            collection = _db._collection
            count = collection.count() if collection else 0
            if count == 0:
                print("⚠️  ATTENTION: La base de données Chroma est vide! Exécutez: python src/ingestion.py")
            else:
                print(f"✅ Base de données Chroma chargée: {count} documents disponibles")
        except Exception as e:
            print(f"⚠️  Erreur lors de la vérification de la base de données: {e}")
    
    return _db

def get_retriever():
    """Lazy loading du retriever."""
    global _retriever
    if _retriever is None:
        db = get_db()
        _retriever = db.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 5}  # Limiter à 5 documents pour de meilleures performances
        )
    return _retriever

# Initialiser au démarrage (peut être commenté pour un vrai lazy loading)
try:
    db = get_db()
    retriever = get_retriever()
except Exception as e:
    print(f"⚠️  Erreur lors de l'initialisation de la base de données: {e}")
    db = None
    retriever = None

# Configuration des LLMs avec gestion d'erreur
try:
    router_llm = ChatGroq(
        model_name="llama-3.1-8b-instant",
        temperature=0,
        max_tokens=100,  # Limiter pour le routage
        timeout=30,  # Timeout de 30 secondes
    )
    generation_llm = ChatGroq(
        model_name="llama-3.1-8b-instant",
        temperature=0,
        max_tokens=2000,  # Limiter la longueur des réponses
        timeout=60,  # Timeout de 60 secondes
    )
except Exception as e:
    print(f"❌ Erreur lors de l'initialisation des LLMs: {e}")
    raise

# Initialiser le checkpointer pour la mémoire des conversations
memory = MemorySaver()

class AgentState(TypedDict):
    question: str
    documents: List[Document]
    category: str
    answer: str
    sources: List[str]
    messages: List  # Historique des messages pour le checkpointer
    
    
    
def classify_question(state: AgentState):
    """Nœud qui utilise le router_llm pour classer la question (le plus rapide)."""
    # Ajouter le message de l'utilisateur à l'historique
    messages = state.get("messages", [])
    messages.append(HumanMessage(content=state["question"]))
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Tu es un classificateur binaire. Ta seule tâche est de déterminer si la question de l'utilisateur concerne le droit sénégalais (Constitution, Code du Travail, Code Pénal, etc.). Réponds UNIQUEMENT avec le mot 'JURIDIQUE' si oui, ou 'AUTRE' si non."),
        ("human", "{question}")
    ])
    
    chain = prompt | router_llm # FIX : Utilise SEULEMENT le router_llm
    category = chain.invoke({"question": state["question"]}).content.strip().upper()
    
    return {"category": category, "messages": messages}

def route_question(state: AgentState):
    if state.get("category") == "JURIDIQUE":
        return "retrieve"
    return "refuse" # <-- Changé de "end" à "refuse"

def handle_non_juridique(state: AgentState):
    """Génère une réponse polie avec le router_llm lorsque la question est hors-sujet."""
    question = state["question"]
    messages = state.get("messages", [])
    
    template = "La question suivante n'est pas juridique: '{question}'. Rédige une réponse polie et concise (moins de 20 mots) indiquant que tu ne peux pas répondre car tu es un assistant juridique spécialisé dans le droit sénégalais."
    
    prompt = ChatPromptTemplate.from_template(template)
    chain = prompt | router_llm # FIX : Utilise SEULEMENT le router_llm (pour la vitesse)
    
    response = chain.invoke({"question": question})
    
    # Ajouter la réponse à l'historique
    messages.append(AIMessage(content=response.content))
    
    return {
        "answer": response.content,
        # CHANGEMENT : on utilise la clé 'sources'
        "sources": ["Question jugée hors du champ d'expertise juridique."],
        "messages": messages,
        "suggested_questions": []
    }

def detect_domain_from_source(source_path: str) -> str:
    """Détecte le domaine juridique à partir du chemin de la source."""
    source_lower = source_path.lower()
    
    # Détection basée sur les chemins de fichiers et URLs
    if 'droitsocial' in source_lower or 'codedutravail' in source_lower or 'travail' in source_lower or 'retraite' in source_lower:
        return 'travail'
    elif 'droitpenal' in source_lower or 'penal' in source_lower or 'prescription' in source_lower:
        return 'penal'
    elif 'finance' in source_lower or 'budget' in source_lower or 'loi de finances' in source_lower:
        return 'finance'
    elif 'organisationadministration' in source_lower or 'fonction publique' in source_lower or 'administration' in source_lower:
        return 'administration'
    elif 'constitution' in source_lower or 'conseilconstitutionnel' in source_lower:
        return 'constitution'
    elif 'collectivites' in source_lower or 'collectivités' in source_lower:
        return 'collectivites'
    elif 'aviation' in source_lower:
        return 'aviation'
    else:
        return 'general'

def generate_suggested_questions(question: str, documents: List[Document], answer: str) -> List[str]:
    """Génère des questions suggérées basées sur les documents réels et leur domaine."""
    if not documents:
        return []
    
    # Détecter les domaines des documents retournés
    domains = set()
    for doc in documents:
        metadata = doc.metadata if hasattr(doc, 'metadata') and doc.metadata else {}
        source = metadata.get('source', metadata.get('file_path', ''))
        domain = detect_domain_from_source(str(source))
        domains.add(domain)
    
    # Déterminer le domaine principal (le plus fréquent ou le premier)
    primary_domain = list(domains)[0] if domains else 'general'
    
    # Extraire des mots-clés de la question et de la réponse
    question_lower = question.lower()
    answer_lower = answer.lower()
    
    # Questions suggérées par domaine basées sur les documents réels
    domain_questions = {
        'travail': [
            'Quelle est la durée légale du préavis de démission ?',
            'Comment sont calculés les congés payés ?',
            'Quels sont mes droits en cas de licenciement abusif ?',
            'Quelles sont les conditions d\'un CDD ?',
            'Quelle est la durée maximale du temps de travail ?',
            'Comment fonctionne la retraite au Sénégal ?',
            'Quels sont les droits des travailleurs en cas de grève ?',
        ],
        'penal': [
            'Quelles sont les peines encourues pour cette infraction ?',
            'Quel est le délai de prescription en droit pénal ?',
            'Comment se déroule la procédure pénale ?',
            'Quels sont les recours possibles en droit pénal ?',
            'Quelles sont les conditions de suspension des délais de prescription ?',
        ],
        'finance': [
            'Quels sont les principes budgétaires de l\'État ?',
            'Comment est organisée la nomenclature budgétaire ?',
            'Quelles sont les voies et moyens de l\'État ?',
            'Comment fonctionne le budget vert ?',
            'Quelle est la stratégie de gestion de la dette ?',
        ],
        'administration': [
            'Quelle est l\'organisation de la fonction publique ?',
            'Comment sont structurées les administrations centrales ?',
            'Quels sont les pouvoirs du Président de la République ?',
            'Comment fonctionne la répartition des services de l\'État ?',
        ],
        'constitution': [
            'Quels sont les droits fondamentaux garantis par la Constitution ?',
            'Comment est organisée la séparation des pouvoirs ?',
            'Quels sont les pouvoirs du Président de la République ?',
            'Comment fonctionne le Parlement ?',
            'Quelle est la procédure de révision constitutionnelle ?',
        ],
        'collectivites': [
            'Quels sont les pouvoirs des collectivités territoriales ?',
            'Quelle est l\'organisation territoriale du Sénégal ?',
            'Quels sont les budgets des collectivités locales ?',
            'Comment fonctionnent les élections locales ?',
        ],
        'aviation': [
            'Quelles sont les règles de sécurité aérienne ?',
            'Quels sont les droits des passagers aériens ?',
            'Quelle est la responsabilité du transporteur aérien ?',
            'Quels sont les documents requis pour un vol international ?',
        ],
        'general': [
            'Quels sont les délais applicables ?',
            'Quelle est la procédure à suivre ?',
            'Quels sont les recours possibles ?',
            'Y a-t-il des exceptions prévues ?',
        ]
    }
    
    # Obtenir les questions du domaine principal
    available_questions = domain_questions.get(primary_domain, domain_questions['general'])
    
    # Filtrer les questions qui sont trop similaires à la question actuelle
    filtered_questions = []
    for q in available_questions:
        # Éviter les questions trop similaires
        q_lower = q.lower()
        similarity = sum(1 for word in question_lower.split() if word in q_lower and len(word) > 3)
        if similarity < 3:  # Moins de 3 mots en commun
            filtered_questions.append(q)
    
    # Si on n'a pas assez de questions, compléter avec des questions générales
    while len(filtered_questions) < 3 and len(available_questions) > len(filtered_questions):
        for q in available_questions:
            if q not in filtered_questions:
                filtered_questions.append(q)
                break
    
    # Prendre 3 questions au maximum
    return filtered_questions[:3]

def retrieve_noeud(state: AgentState):

    question = state["question"]
    # Use the Chroma retriever to fetch relevant documents for the question
    try:
        documents = retriever.invoke(question)
        return {"documents": documents}
    except Exception as e:
        print(f"❌ ERREUR dans retrieve_noeud: {e}")
        return {"documents": []}

def generate_node(state: AgentState):
    """Génère la réponse finale en utilisant le modèle de génération."""
    question = state["question"]
    documents = state.get("documents", [])
    messages = state.get("messages", [])
    
    # Construire l'historique de conversation à partir des messages précédents
    history_str = ""
    if len(messages) > 1:  # Plus qu'un seul message (la question actuelle)
        # Prendre les 5 derniers échanges (10 messages max)
        recent_messages = messages[-10:]
        history_parts = []
        for msg in recent_messages:
            if isinstance(msg, HumanMessage):
                history_parts.append(f"Utilisateur: {msg.content}")
            elif isinstance(msg, AIMessage):
                history_parts.append(f"Assistant: {msg.content}")
        if history_parts:
            history_str = "\n".join(history_parts)
    
    # Préparer le contexte (sans références inline) et les sources pour l'affichage
    context_parts = []
    sources_list = []
    
    if not documents:
        return {
            "answer": "Je ne trouve pas l'information dans les textes fournis.",
            "sources": ["Aucun document trouvé pour cette question."],
            "messages": messages,
            "suggested_questions": []
        }
    
    # Extraire les mots-clés de la question pour trouver les parties pertinentes
    question_words = set(question.lower().split())
    
    for doc in documents:
        # Extraire les métadonnées
        metadata = doc.metadata if hasattr(doc, 'metadata') and doc.metadata else {}
        source = metadata.get('source', metadata.get('file_path', 'Document juridique'))
        page = metadata.get('page', metadata.get('page_number', ''))
        
        # Nettoyer le nom de la source (enlever le chemin complet si présent)
        if isinstance(source, str):
            source_name = os.path.basename(source) if os.path.sep in source else source
            # Enlever l'extension si présente
            source_name = os.path.splitext(source_name)[0]
        else:
            source_name = str(source)
        
        # Ajouter le contenu au contexte (sans référence inline)
        if doc.page_content:
            context_parts.append(doc.page_content)
        
        # Formater la source pour l'affichage dans la section "📚 Voir les articles de loi sources"
        if page:
            source_info = f"{source_name} (page {page})"
        else:
            source_info = f"{source_name}"
        
        # Extraire un extrait pertinent du contenu
        content = doc.page_content if doc.page_content else "(Contenu vide)"
        
        # Si le contenu est long, essayer de trouver la partie la plus pertinente
        if len(content) > 500:
            # Chercher les phrases contenant des mots-clés de la question
            sentences = content.split('.')
            relevant_sentences = []
            
            for sentence in sentences:
                sentence_lower = sentence.lower()
                # Compter combien de mots-clés sont présents dans la phrase
                matches = sum(1 for word in question_words if word in sentence_lower and len(word) > 3)
                if matches > 0:
                    relevant_sentences.append((matches, sentence))
            
            if relevant_sentences:
                # Trier par pertinence et prendre les meilleures phrases
                relevant_sentences.sort(reverse=True, key=lambda x: x[0])
                # Prendre jusqu'à 3-4 phrases les plus pertinentes
                selected_sentences = [s[1] for s in relevant_sentences[:4]]
                # Trouver leur position dans le texte original
                start_pos = content.find(selected_sentences[0])
                if start_pos > 0:
                    # Commencer un peu avant pour avoir du contexte
                    start_pos = max(0, start_pos - 100)
                end_pos = content.find(selected_sentences[-1]) + len(selected_sentences[-1])
                if end_pos < len(content):
                    # Finir un peu après pour avoir du contexte
                    end_pos = min(len(content), end_pos + 100)
                
                # Extraire l'extrait pertinent
                extracted_content = content[start_pos:end_pos].strip()
                # Ajouter "..." si nécessaire
                if start_pos > 0:
                    extracted_content = "..." + extracted_content
                if end_pos < len(content):
                    extracted_content = extracted_content + "..."
                
                content = extracted_content
            else:
                # Si pas de correspondance, prendre le début (mais essayer de commencer par une phrase complète)
                first_period = content.find('.')
                if first_period > 0 and first_period < 200:
                    content = content[:min(600, len(content))]
                else:
                    # Prendre les premiers 500 caractères
                    content = content[:500] + "..."
        
        # Stocker la source avec le contenu formaté
        source_text = f"{source_info}\n\n{content}"
        sources_list.append(source_text)
    
    context = "\n\n".join(context_parts)
    
    # Construire le template avec l'historique si disponible
    if history_str:
        template = """TU ES UN ASSISTANT JURIDIQUE SÉNÉGALAIS STRICTEMENT FACTUEL. 
    TON RÔLE UNIQUE est de répondre aux questions de l'utilisateur en te basant EXCLUSIVEMENT sur les extraits de loi CONTEXTE. 
    Si le CONTEXTE ne contient pas l'information, tu dois répondre : 'Je ne trouve pas l'information dans les textes fournis.'
    
    NE GÉnÈRE JAMAIS de salutations, de listes d'expertise, ou de références aux sources dans le texte. 
    NE CITE PAS les sources directement dans ta réponse - elles seront affichées séparément.
    Commence la réponse immédiatement par l'information demandée de manière claire et factuelle.

    HISTORIQUE DE LA CONVERSATION:
    {history}

    CONTEXTE:
    {context}

    QUESTION: {question}
    """
    else:
        template = """TU ES UN ASSISTANT JURIDIQUE SÉNÉGALAIS STRICTEMENT FACTUEL. 
    TON RÔLE UNIQUE est de répondre aux questions de l'utilisateur en te basant EXCLUSIVEMENT sur les extraits de loi CONTEXTE. 
    Si le CONTEXTE ne contient pas l'information, tu dois répondre : 'Je ne trouve pas l'information dans les textes fournis.'
    
    NE GÉnÈRE JAMAIS de salutations, de listes d'expertise, ou de références aux sources dans le texte. 
    NE CITE PAS les sources directement dans ta réponse - elles seront affichées séparément.
    Commence la réponse immédiatement par l'information demandée de manière claire et factuelle.

    CONTEXTE:
    {context}

    QUESTION: {question}
    """
    
    prompt = ChatPromptTemplate.from_template(template)
    chain = prompt | generation_llm # FIX : Utilise SEULEMENT le generation_llm
    
    if history_str:
        response = chain.invoke({"question": question, "context": context, "history": history_str})
    else:
        response = chain.invoke({"question": question, "context": context})
    
    # Ajouter la réponse de l'assistant à l'historique
    messages.append(AIMessage(content=response.content))
    
    # S'assurer que sources_list n'est jamais vide
    if not sources_list:
        sources_list = ["Aucune source disponible"]
    
    # Générer des questions suggérées basées sur les documents et leur domaine
    suggested_questions = generate_suggested_questions(question, documents, response.content)
    
    return {
        "answer": response.content,
        "sources": sources_list, # <-- CLÉ FINALE POUR L'API avec métadonnées
        "messages": messages,
        "suggested_questions": suggested_questions
    }


compressor = None
RERANKER_AVAILABLE = False

# Initialize reranker lazily - only create when first needed
def get_reranker():
    """Get or create the reranker instance (lazy initialization)."""
    global compressor, RERANKER_AVAILABLE
    if compressor is None and not RERANKER_AVAILABLE:
        try:
            compressor = BGEReranker(
                model_name="BAAI/bge-reranker-base",
                top_n=3
            )
            RERANKER_AVAILABLE = True
        except (MemoryError, RuntimeError, OSError) as e:
            print(f"Warning: Could not initialize BGE reranker due to memory/resource constraints: {e}")
            print("Reranking will be skipped. Documents will be returned as-is.")
            RERANKER_AVAILABLE = False
            compressor = None
    return compressor

def rerank_node(state: AgentState):
    """Rerank documents using the BGE reranker model."""
    question = state["question"]
    # On récupère les documents bruts de l'état
    documents_bruts = state.get("documents", [])
    
    if not documents_bruts:
        return {"documents": []}
    
    # Try to get reranker (lazy initialization)
    reranker = get_reranker()
    
    # Utiliser le reranker pour classer et filtrer les documents
    if reranker is not None:
        try:
            reranked_docs = reranker.compress_documents(documents_bruts, question)
            
            # Protection: si le reranker retourne une liste vide, utiliser les documents originaux
            if not reranked_docs and documents_bruts:
                reranked_docs = documents_bruts[:reranker.top_n] if len(documents_bruts) > reranker.top_n else documents_bruts
            
            return {"documents": reranked_docs}
        except (MemoryError, RuntimeError) as e:
            print(f"❌ Error during reranking: {e}")
            # Return top_n documents without reranking
            fallback_docs = documents_bruts[:reranker.top_n] if reranker else documents_bruts[:3]
            return {"documents": fallback_docs}
    else:
        # If reranker is not available, just return top_n documents
        top_docs = documents_bruts[:3]
        return {"documents": top_docs}

# Dans src/agent.py, après handle_non_juridique, par exemple
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage



workflow = StateGraph(AgentState)
# Ajout des nœuds
workflow.add_node("classify", classify_question)
workflow.add_node("retrieve", retrieve_noeud)
workflow.add_node("rerank", rerank_node)
workflow.add_node("generate", generate_node)
workflow.add_node("refuse", handle_non_juridique)

# 1. Le point d'entrée
workflow.set_entry_point("classify")

# 2. Le routage conditionnel (FIX du BUG : 'refuse' doit être la clé)
workflow.add_conditional_edges(
    "classify",
    route_question,
    {
        "retrieve": "retrieve", # Si JURIDIQUE
        "refuse": "refuse"      # Si AUTRE (Va au nœud de refus)
    }
)

# 3. Les arêtes linéaires
workflow.add_edge("retrieve", "rerank")
workflow.add_edge("rerank", "generate")
workflow.add_edge("generate", END)
workflow.add_edge("refuse", END) # Le nœud de refus termine le graphe proprement

agent_app = workflow.compile(checkpointer=memory)

if __name__ == "__main__":
    question_test = input("Posez votre question juridique : ")
    result = agent_app.invoke({"question": question_test})
    
    print("Réponse de l'agent :")
    print(result["answer"])


