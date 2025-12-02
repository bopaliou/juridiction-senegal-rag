from dotenv import load_dotenv
from typing import List, TypedDict, Optional
import os
import json
import random

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
    
    def __init__(self, model_name: str = "BAAI/bge-reranker-base", top_n: int = 3, device: Optional[str] = None, enabled: bool = True):
        self.model_name = model_name
        self.top_n = top_n
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self._model = None
        self._tokenizer = None
        self.enabled = enabled  # Permet de désactiver le reranker pour économiser la mémoire
    
    @property
    def tokenizer(self):
        """Lazy loading du tokenizer."""
        if self._tokenizer is None:
            try:
                self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            except Exception as e:
                print(f"⚠️  Erreur lors du chargement du tokenizer: {e}")
                raise
        return self._tokenizer
    
    @property
    def model(self):
        """Lazy loading du modèle avec optimisation mémoire."""
        if self._model is None:
            try:
                print(f"🔄 Chargement du modèle BGE Reranker ({self.model_name})...")
                # Utiliser torch_dtype=torch.float16 pour réduire la mémoire de moitié
                # et low_cpu_mem_usage=True pour optimiser le chargement
                self._model = AutoModelForSequenceClassification.from_pretrained(
                    self.model_name,
                    torch_dtype=torch.float16 if self.device == "cpu" else torch.float32,
                    low_cpu_mem_usage=True,
                    device_map="auto" if self.device != "cpu" else None,
                )
                self._model.eval()
                self._model.to(self.device)
                # Forcer le garbage collection après le chargement
                gc.collect()
                if self.device == "cpu":
                    torch.set_num_threads(1)  # Limiter les threads CPU
                print(f"✅ Modèle BGE Reranker chargé sur {self.device}")
            except Exception as e:
                print(f"⚠️  Erreur lors du chargement du modèle: {e}")
                # Si erreur, essayer sans spécifier dtype
                try:
                    self._model = AutoModelForSequenceClassification.from_pretrained(
                        self.model_name,
                        low_cpu_mem_usage=True
                    )
                    self._model.eval()
                    self._model.to(self.device)
                    gc.collect()
                except Exception as e2:
                    print(f"❌ Erreur critique lors du chargement du modèle: {e2}")
                raise

        return self._model
    
    def compress_documents(
        self, documents: List[Document], query: str, batch_size: int = 8
    ) -> List[Document]:
        
        if not documents:
            return []
        
        # Si le reranker est désactivé, retourner simplement les top_n documents
        if not self.enabled:
            return documents[:self.top_n]
        
        try:
            # Préparer les paires (query, document)
            pairs = [[query, doc.page_content] for doc in documents]
            
            # Tokeniser et obtenir les scores
            tokenizer = self.tokenizer
            model = self.model
            
            # Traiter par batch pour éviter les problèmes de mémoire
            all_scores = []
            for i in range(0, len(pairs), batch_size):
                batch = pairs[i:i + batch_size]
                inputs = tokenizer(
                    batch,
                        padding=True,
                        truncation=True,
                        return_tensors="pt",
                        max_length=512
                    ).to(self.device)
                    
                with torch.no_grad():
                    scores = model(**inputs).logits.view(-1).float()
                    all_scores.extend(scores.cpu().tolist())
            
            # Créer une liste de tuples (score, document) et trier
            scored_docs = list(zip(all_scores, documents))
            scored_docs.sort(reverse=True, key=lambda x: x[0])
            
            # Retourner les top_n documents
            return [doc for _, doc in scored_docs[:self.top_n]]
            
        except torch.cuda.OutOfMemoryError:
            print("⚠️  Mémoire GPU insuffisante pour le reranking. Retour des documents originaux.")
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            return documents[:self.top_n]
        except Exception as e:
            print(f"⚠️  Erreur lors du reranking: {e}")
            # En cas d'erreur, retourner les documents originaux
            if "out of memory" in str(e).lower() or "cuda" in str(e).lower():
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                # Return original documents if reranking fails due to memory
                return documents[:self.top_n]
            else:
                raise


load_dotenv()

# Utiliser un chemin absolu pour éviter les problèmes de chemin relatif
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
CHROMA_DB_PATH = BASE_DIR / "data" / "chroma_db"

# Configuration depuis les variables d'environnement
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY n'est pas définie dans les variables d'environnement")

# Option pour désactiver le reranker (réduit l'utilisation mémoire)
# Par défaut, désactivé pour économiser la mémoire sur Render (plan starter 512MB)
ENABLE_RERANKER = os.getenv("ENABLE_RERANKER", "false").lower() == "true"

# Initialiser l'embedding function (lazy loading pour optimiser le démarrage)
_embedding_function = None
_db = None
_retriever = None

def get_embedding_function():
    """Lazy loading de l'embedding function avec optimisation mémoire."""
    global _embedding_function
    if _embedding_function is None:
        _embedding_function = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={
                'device': 'cpu',
                'trust_remote_code': False,
            },
            encode_kwargs={
                'normalize_embeddings': True,
                'batch_size': 32,  # Traiter par batch pour optimiser la mémoire
            }
        )
        # Forcer le garbage collection après le chargement
        gc.collect()
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
            collection = _db._collection  # type: ignore[attr-defined]
            count = collection.count() if collection else 0
            if count == 0:
                print("⚠️  ATTENTION: La base de données Chroma existe mais ne contient aucun document.")
                print("   Exécutez: python src/ingestion.py pour charger les documents.")

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
        model_name="openai/gpt-oss-120b",
        temperature=0,
        max_tokens=50,  # Limiter pour la classification
        timeout=30,  # Timeout de 30 secondes
    )
    generation_llm = ChatGroq(
        model_name="openai/gpt-oss-120b",
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
    
    question = state["question"].lower()
    
    # Liste de mots-clés juridiques pour une classification rapide
    juridique_keywords = [
        "travail", "travailleur", "employeur", "employé", "salarié", "contrat", 
        "licenciement", "préavis", "retraite", "syndicat", "grève", "congé", 
        "salaire", "code du travail", "l.2", "l.69", "article l.",
        "pénal", "penal", "peine", "infraction", "sanction", "prison", "détenu", 
        "juge", "tribunal", "procédure", "prescription", "loi 2020", "code pénal",
        "constitution", "président", "parlement", "pouvoir", "droit fondamental",
        "budget", "finance", "impôt", "taxe", "fiscal", "déficit", "ressource", 
        "charge", "plf", "loi de finance",
        "collectivité", "municipalité", "commune", "région",
        "aviation", "aérien",
        "droit", "loi", "décret", "règlement", "juridique", "juridiction",
        "sénégal", "sénégalais", "sénégalaise"
    ]
    
    # Classification rapide basée sur les mots-clés (plus fiable)
    contains_juridique_keyword = any(keyword in question for keyword in juridique_keywords)
    
    # Si aucun mot-clé juridique n'est trouvé, utiliser le LLM pour une classification plus fine
    if not contains_juridique_keyword:
        prompt = ChatPromptTemplate.from_messages([
            ("system", """Tu es un classificateur binaire pour un assistant juridique sénégalais.
Ta tâche est de déterminer si la question concerne le droit sénégalais ou un sujet juridique général.

Une question est JURIDIQUE si elle concerne :
- Le droit du travail (contrats, licenciement, congés, salaires, retraite, etc.)
- Le droit pénal (infractions, peines, procédures, tribunaux, etc.)
- Le droit constitutionnel (Constitution, pouvoirs, droits fondamentaux, etc.)
- Le droit financier (budget, impôts, finances publiques, etc.)
- Le droit administratif (collectivités, organisation administrative, etc.)
- Toute question sur les lois, décrets, codes, règlements sénégalais
- Toute question juridique générale même sans mention explicite du Sénégal

Une question est AUTRE si elle concerne :
- La météo, le sport, la cuisine, les loisirs
- Des questions techniques non juridiques (programmation, mathématiques pures, etc.)
- Des questions personnelles sans lien juridique

Réponds UNIQUEMENT avec le mot 'JURIDIQUE' ou 'AUTRE', sans autre texte."""),
            ("human", "{question}")
        ])
        
        try:
            chain = prompt | router_llm
            response = chain.invoke({"question": state["question"]})
            response_content = response.content.upper().strip()
            
            # Log pour le débogage
            print(f"🔍 Classification - Question: {state['question'][:50]}...")
            print(f"🔍 Réponse du LLM: {response.content}")
            
            # Détection plus robuste de "JURIDIQUE"
            if "JURIDIQUE" in response_content or response_content.startswith("JURIDIQUE"):
                category = "JURIDIQUE"
            else:
                category = "AUTRE"
        except Exception as e:
            print(f"⚠️  Erreur lors de la classification LLM: {e}")
            # En cas d'erreur, être permissif et classer comme JURIDIQUE par défaut
            category = "JURIDIQUE"
    else:
        # Si des mots-clés juridiques sont trouvés, classer directement comme JURIDIQUE
        category = "JURIDIQUE"
        print(f"✅ Classification rapide - Question juridique détectée par mots-clés")
    
    print(f"📊 Catégorie finale: {category}")
    
    return {"category": category, "messages": messages}

def handle_non_juridique(state: AgentState):
    """Génère une réponse polie avec le router_llm lorsque la question est hors-sujet."""
    messages = state.get("messages", [])
    prompt = ChatPromptTemplate.from_template(
        "Tu es un assistant juridique sénégalais. L'utilisateur a posé une question qui ne concerne pas le droit sénégalais. Réponds poliment que tu ne peux répondre qu'aux questions sur le droit sénégalais (Constitution, Code du Travail, Code Pénal, etc.). Sois bref et courtois."
    )
    chain = prompt | router_llm # FIX : Utilise SEULEMENT le router_llm (pour la vitesse)
    response = chain.invoke({"question": state["question"]})
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

# Liste officielle et exhaustive des questions autorisées (issues des documents fournis)
AUTHORIZED_QUESTIONS = [
    "Quelles sont les missions du juge de l'application des peines au Sénégal ?",
    "Comment fonctionne la commission pénitentiaire consultative de l'aménagement des peines ?",
    "Quelles sont les règles de séparation des détenus dans les établissements pénitentiaires ?",
    "Quelles sont les conditions d'application du travail d'intérêt général ?",
    "Comment se déroule l'extraction d'un détenu pour comparution devant un juge ?",
    "Quels sont les droits des détenus provisoires selon le décret 2001-362 ?",
    "Quel est le rôle des visiteurs de prison dans le système pénitentiaire ?",
    "Comment la loi 2020-05 modifie-t-elle les peines pour viol au Sénégal ?",
    "Quelles sont les nouvelles peines prévues pour les actes de pédophilie ?",
    "Quelles sont les circonstances aggravantes en matière de violences sexuelles ?",
    "Quels délais de prescription ont été suspendus pendant l'état d'urgence ?",
    "Comment la loi 2020-16 affecte-t-elle les délais de recours en matière pénale ?",
    "Quelles sont les règles concernant les contraintes par corps durant la période Covid-19 ?",
    "Quels dossiers sont jugés par les tribunaux départementaux en matière correctionnelle ?",
    "Quelles sont les infractions relevant uniquement du tribunal régional ?",
    "Comment s'effectue le transfert d'une procédure entre le tribunal régional et le tribunal départemental ?",
    "Qui est considéré comme travailleur selon l'article L.2 du Code du Travail ?",
    "Quelles sont les obligations de l'employeur envers les travailleurs ?",
    "Quelles sont les règles de création d'un syndicat professionnel ?",
    "Quelles protections s'appliquent aux travailleurs dans l'exercice du droit d'expression ?",
    "Quelles sont les infractions concernant le travail forcé ?",
    "Quels sont les droits des syndicats devant la justice ?",
    "Comment fonctionne la procédure de dépôt des statuts d'un syndicat ?",
    "Quelles sont les conditions d'accès aux fonctions de direction syndicale ?",
    "Quelles protections s'appliquent aux biens d'un syndicat ?",
    "Quel est l'âge légal de départ à la retraite au Sénégal ?",
    "Quels travailleurs peuvent poursuivre leur activité au-delà de 60 ans ?",
    "Quelles professions sont autorisées à travailler jusqu'à 65 ans ?",
    "Comment s'applique l'article L.69 modifié du Code du Travail ?",
    "Un travailleur peut-il continuer d'exercer volontairement après 60 ans ?",
    "Quels sont les axes stratégiques du budget 2025 ?",
    "Comment se répartissent les ressources et charges de l'État pour 2025 ?",
    "Quels sont les objectifs macroéconomiques du PLF 2026 ?",
    "Quelles taxes nouvelles sont prévues dans la stratégie SUPREC ?",
    "Quelles sont les mesures d'assainissement des finances publiques en 2026 ?",
    "Comment évolue le déficit budgétaire entre 2024, 2025 et 2026 ?",
    "Quels sont les domaines de dépenses prioritaires dans le budget 2026 ?",
    "Quels textes régissent l'organisation pénitentiaire au Sénégal ?",
    "Comment contester une décision judiciaire en matière correctionnelle ?",
    "Quelles sont les obligations de l'État envers les travailleurs ?",
    "Comment déterminer l'autorité compétente pour une infraction ?",
    "Quelles sont les règles applicables aux syndicats ?",
    "Quelles sont les récentes réformes impactant le droit pénal sénégalais ?",
    "Comment fonctionne la procédure d'aménagement de peine ?",
    "Quel est le rôle de l'État dans la protection sociale selon les budgets 2025/2026 ?",
]


def generate_suggested_questions(question: str, documents: List[Document], answer: str, conversation_history: Optional[str] = None) -> List[str]:
    """
    Génère exactement 3 questions suggérées contextuelles en sélectionnant les questions les plus pertinentes
    parmi la liste officielle autorisée, basées sur le contexte de la conversation.
    
    Règles:
    - Retourne exactement 3 questions les plus pertinentes selon le contexte
    - Utilise la question posée, la réponse donnée, les documents et l'historique pour déterminer la pertinence
    - Priorise les questions avec un score de pertinence élevé (>= 2)
    - Complète avec des questions du même domaine si nécessaire
    - Ne retourne jamais de questions absentes de la liste
    - Ne retourne rien si pas de documents ou réponse vide
    """
    # Si pas de documents ou réponse vide, ne pas proposer de questions
    if not documents or not answer:
        return []
    
    # Ne pas proposer de questions si la réponse est "Je ne trouve pas" ET qu'il n'y a vraiment pas de sources
    answer_stripped = answer.strip()
    if answer_stripped == "Je ne trouve pas l'information dans les textes fournis.":
        return []
    
    # Extraire les mots-clés du contexte (question + réponse + documents + historique)
    question_lower = question.lower()
    answer_lower = answer.lower()
    
    # Extraire les mots-clés des documents
    doc_keywords = set()
    for doc in documents[:3]:  # Utiliser les 3 premiers documents
        if doc.page_content:
            # Extraire les mots significatifs (plus de 4 caractères)
            words = doc.page_content.lower().split()
            doc_keywords.update([w for w in words if len(w) > 4])
    
    # Extraire les mots-clés de l'historique de conversation si disponible
    history_keywords = set()
    if conversation_history:
        history_words = conversation_history.lower().split()
        history_keywords.update([w for w in history_words if len(w) > 4])
    
    # Combiner tous les mots-clés du contexte
    context_keywords = set(question_lower.split())
    context_keywords.update(answer_lower.split())
    context_keywords.update(doc_keywords)
    context_keywords.update(history_keywords)
    
    # Détecter le domaine principal de la conversation
    domain_keywords = {
        'travail': ['travail', 'travailleur', 'employeur', 'employé', 'salarié', 'contrat', 'licenciement', 'préavis', 'retraite', 'syndicat', 'grève', 'congé', 'salaire'],
        'penal': ['pénal', 'penal', 'peine', 'infraction', 'sanction', 'prison', 'détenu', 'juge', 'tribunal', 'procédure', 'prescription'],
        'finance': ['budget', 'finance', 'impôt', 'taxe', 'fiscal', 'déficit', 'ressource', 'charge'],
        'constitution': ['constitution', 'président', 'parlement', 'pouvoir', 'droit fondamental'],
        'administration': ['administration', 'fonction publique', 'collectivité', 'organisation'],
    }
    
    detected_domain = 'general'
    max_matches = 0
    for domain, keywords in domain_keywords.items():
        matches = sum(1 for kw in keywords if kw in context_keywords)
        if matches > max_matches:
            max_matches = matches
            detected_domain = domain
    
    # Scorer chaque question selon sa pertinence au contexte
    question_scores = []
    for q in AUTHORIZED_QUESTIONS:
        score = 0
        q_lower = q.lower()
        
        # Score basé sur les mots-clés communs avec la question
        question_words = set(q_lower.split())
        common_words = context_keywords.intersection(question_words)
        score += len(common_words) * 2  # Poids plus élevé pour les mots communs
        
        # Score basé sur le domaine détecté
        if detected_domain == 'travail':
            if any(word in q_lower for word in ['travail', 'travailleur', 'employeur', 'employé', 'salarié', 'contrat', 'licenciement', 'préavis', 'retraite', 'syndicat', 'grève', 'congé', 'salaire', 'l.2', 'l.69']):
                score += 5
        elif detected_domain == 'penal':
            if any(word in q_lower for word in ['pénal', 'penal', 'peine', 'infraction', 'sanction', 'prison', 'détenu', 'juge', 'tribunal', 'procédure', 'prescription', 'loi 2020']):
                score += 5
        elif detected_domain == 'finance':
            if any(word in q_lower for word in ['budget', 'finance', 'impôt', 'taxe', 'fiscal', 'déficit', 'ressource', 'charge', '2025', '2026']):
                score += 5
        elif detected_domain == 'constitution':
            if any(word in q_lower for word in ['constitution', 'président', 'parlement', 'pouvoir', 'droit fondamental']):
                score += 5
        
        # Score basé sur la similarité sémantique avec la question posée
        # Si la question suggérée contient des mots similaires à la question posée
        question_important_words = [w for w in question_lower.split() if len(w) > 4]
        q_important_words = [w for w in q_lower.split() if len(w) > 4]
        semantic_matches = len(set(question_important_words).intersection(set(q_important_words)))
        score += semantic_matches * 3
        
        # Bonus pour les questions sur le même sujet mais avec un angle différent
        # (éviter de suggérer la même question)
        if q_lower != question_lower:
            question_scores.append((score, q))
    
    # Trier par score décroissant et sélectionner les meilleures
    question_scores.sort(reverse=True, key=lambda x: x[0])
    
    # Sélectionner exactement 3 questions les plus pertinentes
    num_questions = 3
    
    if len(question_scores) >= num_questions:
        # Prendre les 3 meilleures questions avec les scores les plus élevés
        # Si plusieurs questions ont le même score, on peut en prendre aléatoirement parmi celles-ci
        # Mais on privilégie toujours les scores les plus élevés
        top_questions = question_scores[:num_questions * 2]  # Prendre 2x plus pour avoir du choix si scores égaux
        
        # Grouper par score et prendre les meilleures
        selected = []
        for score, q in top_questions:
            if len(selected) >= num_questions:
                break
            # Si le score est significatif (au moins 2 points), l'inclure
            if score >= 2:
                selected.append(q)
            elif len(selected) < num_questions and score > 0:
                # Si on n'a pas encore 3 questions et que le score est > 0, l'inclure
                selected.append(q)
    else:
        # Si pas assez de questions avec score, prendre toutes celles disponibles
        selected = [q for _, q in question_scores[:num_questions]]
    
    # Si on n'a pas assez de questions pertinentes (score > 0), compléter avec des questions du même domaine
    if len(selected) < num_questions:
        # Essayer de trouver des questions du même domaine
        domain_questions = []
        for q in AUTHORIZED_QUESTIONS:
            if q not in selected:
                q_lower = q.lower()
                if detected_domain == 'travail' and any(word in q_lower for word in ['travail', 'travailleur', 'employeur', 'employé', 'salarié', 'contrat', 'licenciement', 'préavis', 'retraite', 'syndicat']):
                    domain_questions.append(q)
                elif detected_domain == 'penal' and any(word in q_lower for word in ['pénal', 'penal', 'peine', 'infraction', 'sanction', 'prison', 'détenu', 'juge', 'tribunal']):
                    domain_questions.append(q)
                elif detected_domain == 'finance' and any(word in q_lower for word in ['budget', 'finance', 'impôt', 'taxe', 'fiscal', 'déficit']):
                    domain_questions.append(q)
        
        # Ajouter des questions du même domaine si disponibles
        if domain_questions:
            random.shuffle(domain_questions)
            selected.extend(domain_questions[:num_questions - len(selected)])
        
        # Si toujours pas assez, compléter avec des questions aléatoires
        if len(selected) < num_questions:
            remaining = [q for q in AUTHORIZED_QUESTIONS if q not in selected]
            random.shuffle(remaining)
            selected.extend(remaining[:num_questions - len(selected)])
    
    # Retourner exactement 3 questions
    return selected[:num_questions]


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
    
    for idx, doc in enumerate(documents):
        # Extraire les métadonnées
        metadata = doc.metadata if hasattr(doc, 'metadata') and doc.metadata else {}
        source = metadata.get('source', metadata.get('file_path', 'Document juridique'))
        page = metadata.get('page', metadata.get('page_number', None))
        
        # Détecter le domaine
        domain = detect_domain_from_source(str(source))
        
        # Extraire l'URL si présente
        url = None
        source_name = "Document juridique"
        
        if isinstance(source, str):
            # Si c'est une URL, l'extraire
            if source.startswith('http://') or source.startswith('https://'):
                url = source
                # Extraire un nom de document depuis l'URL
                if 'conseilconstitutionnel' in source.lower():
                    source_name = "Constitution du Sénégal"
                elif 'primature' in source.lower():
                    if 'collectivites' in source.lower():
                        source_name = "Code des Collectivités Locales"
                    elif 'aviation' in source.lower():
                        source_name = "Code de l'Aviation Civile"
                    else:
                        source_name = "Document Officiel"
                else:
                    source_name = os.path.basename(source)
            else:
                # C'est un chemin de fichier
                source_name = os.path.basename(source) if os.path.sep in source else source
                # Enlever l'extension si présente
                source_name = os.path.splitext(source_name)[0]
                # Nettoyer le nom (enlever les underscores, remplacer par espaces)
                source_name = source_name.replace('_', ' ').replace('-', ' ').title()
        else:
            source_name = str(source)
        
        # Ajouter le contenu au contexte (sans référence inline)
        if doc.page_content:
            context_parts.append(doc.page_content)
        
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
        
        # Formater la source en JSON pour un parsing facile côté frontend
        source_data = {
            "id": f"source_{idx}",
            "title": source_name,
            "url": url,
            "content": content,
            "page": page,
            "domain": domain
        }
        sources_list.append(json.dumps(source_data))
    
    context = "\n\n".join(context_parts)
    
    # Construire le template avec l'historique si disponible
    if history_str:
        template = """TU ES UN ASSISTANT JURIDIQUE SÉNÉGALAIS STRICTEMENT FACTUEL ET DÉTAILLÉ. 
    TON RÔLE est de répondre aux questions de l'utilisateur en te basant EXCLUSIVEMENT sur les extraits de loi CONTEXTE.
    
    RÈGLES CRITIQUES POUR TA RÉPONSE :
    1. SOIS CONCIS ET CLAIR : Limite ta réponse à 3-4 paragraphes maximum. Va droit au but, évite les répétitions et les détails superflus.
    2. STRUCTURE TA RÉPONSE AVEC HIÉRARCHIE :
       - Commence par une réponse directe et concise (1-2 phrases)
       - Utilise des listes à puces (-) pour les points importants, les missions, les conditions, etc.
       - Utilise des listes numérotées (1., 2., 3.) pour les étapes ou processus
       - Termine par les références légales entre crochets [Article X, Code Y]
    3. UTILISE DES LISTES POUR FACILITER LA LECTURE : Au lieu de longs paragraphes, utilise des listes à puces pour les éléments multiples (missions, conditions, droits, obligations, etc.).
    4. SOIS UN VRAI ASSISTANT PÉDAGOGIQUE : Explique le droit de manière simple et accessible, sans jargon inutile.
    5. INCLUS TOUJOURS les détails spécifiques : nombres, dates, montants, délais, mais de manière concise.
    6. NE COMMENCE JAMAIS par citer un article : Commence par la réponse concrète.
    7. NE METS JAMAIS de titres ou sections : Écris de manière fluide mais structurée avec des listes.
    8. Si le CONTEXTE ne contient pas l'information, réponds : 'Je ne trouve pas l'information dans les textes fournis.'
    
    EXEMPLES DE BONNES RÉPONSES :
    - Question: "Quel est l'âge légal de départ à la retraite ?"
      Bonne réponse: "Au Sénégal, un travailleur peut prendre sa retraite à partir de 60 ans. C'est l'âge minimum fixé par la loi pour pouvoir bénéficier de la retraite. Pour pouvoir partir à la retraite, il faut généralement avoir atteint cet âge ET avoir cotisé pendant un certain nombre d'années (les conditions exactes dépendent du régime de retraite). Cette règle de 60 ans est prévue par l'article L.69 du Code du Travail. [Référence pour spécialistes : Article L.69 du Code du Travail]"
      Mauvaise réponse: "Réponse directe et simple : 60 ans. Explication détaillée : L'article L.69..." (ne pas mettre de titres)
      Mauvaise réponse: "Selon l'article L.69 du Code du Travail, l'âge de la retraite est de 60 ans." (trop technique, commence par l'article)
    
    - Question: "Quelle est la durée du préavis ?"
      Bonne réponse: "Le préavis est la période pendant laquelle vous continuez de travailler après avoir été informé de la fin de votre contrat. Cette période vous permet de vous préparer à la fin de votre emploi. Au Sénégal, la durée du préavis dépend de votre ancienneté dans l'entreprise : si vous travaillez depuis moins de 2 ans, le préavis est de 1 mois. Si vous travaillez entre 2 et 5 ans, il est de 2 mois. Et si vous travaillez depuis plus de 5 ans, il est de 3 mois. Cette règle protège les travailleurs en leur donnant le temps de trouver un nouvel emploi. [Références : Code du Travail, articles relatifs au préavis]"
      Mauvaise réponse: "Réponse directe : Le préavis varie. Explication détaillée : Selon l'ancienneté..." (ne pas mettre de titres)
      Mauvaise réponse: "Le préavis est prévu par le Code du Travail selon l'ancienneté." (trop vague, ne donne pas les durées)
    
    NE GÉnÈRE JAMAIS de salutations, de listes d'expertise, ou de références aux sources dans le texte. 
    NE CITE PAS les sources directement dans ta réponse - elles seront affichées séparément.
    Commence la réponse immédiatement par l'information demandée de manière claire, factuelle et DÉTAILLÉE.

    HISTORIQUE DE LA CONVERSATION:
    {history}

    CONTEXTE:
    {context}

    QUESTION: {question}
    
    RÉPONSE (précise, détaillée, avec tous les chiffres et détails du contexte):
    """
    else:
        template = """TU ES UN ASSISTANT JURIDIQUE SÉNÉGALAIS STRICTEMENT FACTUEL ET DÉTAILLÉ. 
    TON RÔLE est de répondre aux questions de l'utilisateur en te basant EXCLUSIVEMENT sur les extraits de loi CONTEXTE.
    
    RÈGLES CRITIQUES POUR TA RÉPONSE :
    1. SOIS CONCIS ET CLAIR : Limite ta réponse à 3-4 paragraphes maximum. Va droit au but, évite les répétitions et les détails superflus.
    2. STRUCTURE TA RÉPONSE AVEC HIÉRARCHIE :
       - Commence par une réponse directe et concise (1-2 phrases)
       - Utilise des listes à puces (-) pour les points importants, les missions, les conditions, etc.
       - Utilise des listes numérotées (1., 2., 3.) pour les étapes ou processus
       - Termine par les références légales entre crochets [Article X, Code Y]
    3. UTILISE DES LISTES POUR FACILITER LA LECTURE : Au lieu de longs paragraphes, utilise des listes à puces pour les éléments multiples (missions, conditions, droits, obligations, etc.).
    4. SOIS UN VRAI ASSISTANT PÉDAGOGIQUE : Explique le droit de manière simple et accessible, sans jargon inutile.
    5. INCLUS TOUJOURS les détails spécifiques : nombres, dates, montants, délais, mais de manière concise.
    6. NE COMMENCE JAMAIS par citer un article : Commence par la réponse concrète.
    7. NE METS JAMAIS de titres ou sections : Écris de manière fluide mais structurée avec des listes.
    8. Si le CONTEXTE ne contient pas l'information, réponds : 'Je ne trouve pas l'information dans les textes fournis.'
    
    EXEMPLES DE BONNES RÉPONSES :
    - Question: "Quel est l'âge légal de départ à la retraite ?"
      Bonne réponse: "Au Sénégal, un travailleur peut prendre sa retraite à partir de 60 ans. C'est l'âge minimum fixé par la loi pour pouvoir bénéficier de la retraite. Pour pouvoir partir à la retraite, il faut généralement avoir atteint cet âge ET avoir cotisé pendant un certain nombre d'années (les conditions exactes dépendent du régime de retraite). Cette règle de 60 ans est prévue par l'article L.69 du Code du Travail. [Référence pour spécialistes : Article L.69 du Code du Travail]"
      Mauvaise réponse: "Réponse directe et simple : 60 ans. Explication détaillée : L'article L.69..." (ne pas mettre de titres)
      Mauvaise réponse: "Selon l'article L.69 du Code du Travail, l'âge de la retraite est de 60 ans." (trop technique, commence par l'article)
    
    - Question: "Quelle est la durée du préavis ?"
      Bonne réponse: "Le préavis est la période pendant laquelle vous continuez de travailler après avoir été informé de la fin de votre contrat. Cette période vous permet de vous préparer à la fin de votre emploi. Au Sénégal, la durée du préavis dépend de votre ancienneté dans l'entreprise : si vous travaillez depuis moins de 2 ans, le préavis est de 1 mois. Si vous travaillez entre 2 et 5 ans, il est de 2 mois. Et si vous travaillez depuis plus de 5 ans, il est de 3 mois. Cette règle protège les travailleurs en leur donnant le temps de trouver un nouvel emploi. [Références : Code du Travail, articles relatifs au préavis]"
      Mauvaise réponse: "Réponse directe : Le préavis varie. Explication détaillée : Selon l'ancienneté..." (ne pas mettre de titres)
      Mauvaise réponse: "Le préavis est prévu par le Code du Travail selon l'ancienneté." (trop vague, ne donne pas les durées)
    
    NE GÉnÈRE JAMAIS de salutations, de listes d'expertise, ou de références aux sources dans le texte. 
    NE CITE PAS les sources directement dans ta réponse - elles seront affichées séparément.
    Commence la réponse immédiatement par l'information demandée de manière claire, factuelle et DÉTAILLÉE.

    CONTEXTE:
    {context}

    QUESTION: {question}
    
    RÉPONSE (précise, détaillée, avec tous les chiffres et détails du contexte):
    """
    
    prompt = ChatPromptTemplate.from_template(template)
    chain = prompt | generation_llm # FIX : Utilise SEULEMENT le generation_llm
    
    if history_str:
        response = chain.invoke({"question": question, "context": context, "history": history_str})
    else:
        response = chain.invoke({"question": question, "context": context})
    
    # Ajouter la réponse de l'assistant à l'historique
    messages.append(AIMessage(content=response.content))
    
    # CORRECTION : Si des sources ont été trouvées mais que le LLM répond "Je ne trouve pas...",
    # c'est incohérent. On ne doit jamais retourner "Je ne trouve pas" si des sources existent.
    answer_content = response.content.strip()
    
    # Si des sources existent mais que la réponse dit "Je ne trouve pas", c'est incohérent
    # Dans ce cas, on utilise le contexte des documents pour générer une réponse
    if sources_list and len(sources_list) > 0 and answer_content == "Je ne trouve pas l'information dans les textes fournis.":
        # Si on a des sources, on ne devrait jamais dire qu'on ne trouve pas l'information
        # On va utiliser le contexte pour reformuler une réponse
        if context and len(context.strip()) > 0:
            # Prendre les premiers 500 caractères du contexte comme base de réponse
            context_excerpt = context[:500].strip()
            if len(context) > 500:
                context_excerpt += "..."
            # Reformuler avec le LLM en forçant une réponse basée sur le contexte
            reformulation_prompt = f"""Basé sur le contexte suivant, réponds à la question de manière factuelle et concise.
Ne dis jamais "Je ne trouve pas" car le contexte contient des informations.

CONTEXTE:
{context_excerpt}

QUESTION: {question}

RÉPONSE (factuelle et basée uniquement sur le contexte):"""
            
            try:
                reformulation_chain = ChatPromptTemplate.from_template(reformulation_prompt) | generation_llm
                reformulated_response = reformulation_chain.invoke({})
                answer_content = reformulated_response.content.strip()
                # Si la reformulation retourne encore "Je ne trouve pas", utiliser directement le contexte
                if answer_content == "Je ne trouve pas l'information dans les textes fournis.":
                    answer_content = f"D'après les documents juridiques consultés : {context_excerpt}"
            except Exception:
                # En cas d'erreur, utiliser directement un extrait du contexte
                answer_content = f"D'après les documents juridiques consultés : {context_excerpt}"
    
    # S'assurer que sources_list n'est jamais vide
    if not sources_list:
        sources_list = ["Aucune source disponible"]
    
    # Générer des questions suggérées basées sur les documents et leur domaine
    # Ne pas générer de questions si la réponse est "Je ne trouve pas" ET qu'il n'y a pas de sources
    if answer_content == "Je ne trouve pas l'information dans les textes fournis." and not sources_list:
        suggested_questions = []
    else:
        # Générer des questions suggérées contextuelles en incluant l'historique
        suggested_questions = generate_suggested_questions(
            question, 
            documents, 
            answer_content,
            conversation_history=history_str if history_str else None
        )
    
    return {
        "answer": answer_content,
        "sources": sources_list, # <-- CLÉ FINALE POUR L'API avec métadonnées
        "messages": messages,
        "suggested_questions": suggested_questions
    }


compressor = None

# Créer le graphe d'agent
workflow = StateGraph(AgentState)

# Ajouter les nœuds
workflow.add_node("classify", classify_question)
workflow.add_node("retrieve", retrieve_noeud)
workflow.add_node("generate", generate_node)
workflow.add_node("non_juridique", handle_non_juridique)

# Définir le point d'entrée
workflow.set_entry_point("classify")

# Ajouter les arêtes conditionnelles
def should_retrieve(state: AgentState):
    category = state.get("category", "")
    if category == "JURIDIQUE":
        return "retrieve"
    else:
        return "non_juridique"

workflow.add_conditional_edges("classify", should_retrieve)
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)
workflow.add_edge("non_juridique", END)

# Compiler le graphe avec le checkpointer pour la mémoire
agent_app = workflow.compile(checkpointer=memory)
