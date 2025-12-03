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
    
    # Liste étendue de mots-clés juridiques pour une classification rapide
    # Inclut des variantes, synonymes et termes connexes
    juridique_keywords = [
        # Droit du travail
        "travail", "travailleur", "travailleurs", "employeur", "employeurs", "employé", "employés", 
        "salarié", "salariés", "contrat", "contrats", "licenciement", "licenciements", 
        "préavis", "retraite", "retraites", "syndicat", "syndicats", "grève", "grèves", 
        "congé", "congés", "salaire", "salaires", "code du travail", "l.2", "l.69", 
        "article l.", "articles l.", "aménagement", "peine", "peines",
        # Droit pénal
        "pénal", "penal", "peine", "peines", "infraction", "infractions", "sanction", 
        "sanctions", "prison", "détenu", "détenus", "juge", "juges", "tribunal", 
        "tribunaux", "procédure", "procédures", "prescription", "loi 2020", "code pénal",
        "viol", "violence", "pédophilie", "délai", "délais", "recours", "correctionnelle",
        # Droit constitutionnel
        "constitution", "constitutionnel", "président", "parlement", "pouvoir", "pouvoirs", 
        "droit fondamental", "droits fondamentaux", "liberté", "libertés",
        # Droit financier
        "budget", "budgets", "finance", "finances", "impôt", "impôts", "taxe", "taxes", 
        "fiscal", "déficit", "ressource", "ressources", "charge", "charges", "plf", 
        "loi de finance", "lois de finance", "macroéconomique", "macroéconomiques",
        # Droit administratif
        "collectivité", "collectivités", "municipalité", "municipalités", "commune", 
        "communes", "région", "régions", "administration", "administratif", "fonction publique",
        # Aviation
        "aviation", "aérien", "aérienne", "aériennes",
        # Termes généraux juridiques
        "droit", "droits", "loi", "lois", "décret", "décrets", "règlement", "règlements", 
        "juridique", "juridiques", "juridiction", "juridictions", "jurisprudence",
        "article", "articles", "code", "codes", "texte", "textes", "disposition", "dispositions",
        # Géographique
        "sénégal", "sénégalais", "sénégalaise", "sénégalaises",
        # Questions courantes
        "comment", "quand", "où", "qui", "quoi", "pourquoi", "combien", "quel", "quelle", 
        "quels", "quelles", "peut", "peuvent", "doit", "doivent", "peut-on", "peut on",
        # Termes de procédure
        "mission", "missions", "rôle", "rôles", "obligation", "obligations", "condition", 
        "conditions", "règle", "règles", "démarche", "démarches", "processus", "étape", "étapes"
    ]
    
    # Classification rapide basée sur les mots-clés (plus fiable)
    contains_juridique_keyword = any(keyword in question for keyword in juridique_keywords)
    
    # Si aucun mot-clé juridique n'est trouvé, utiliser le LLM pour une classification plus fine
    # MAIS être très permissif : par défaut, classer comme JURIDIQUE si incertain
    if not contains_juridique_keyword:
        prompt = ChatPromptTemplate.from_messages([
            ("system", """Tu es un classificateur binaire pour un assistant juridique sénégalais.
Ta tâche est de déterminer si la question concerne le droit sénégalais ou un sujet juridique général.

IMPORTANT : Sois TRÈS PERMISSIF. En cas de doute, classe toujours comme JURIDIQUE.

Une question est JURIDIQUE si elle concerne :
- Le droit du travail (contrats, licenciement, congés, salaires, retraite, etc.)
- Le droit pénal (infractions, peines, procédures, tribunaux, etc.)
- Le droit constitutionnel (Constitution, pouvoirs, droits fondamentaux, etc.)
- Le droit financier (budget, impôts, finances publiques, etc.)
- Le droit administratif (collectivités, organisation administrative, etc.)
- Toute question sur les lois, décrets, codes, règlements sénégalais
- Toute question juridique générale même sans mention explicite du Sénégal
- Toute question qui pourrait avoir une réponse dans des documents juridiques
- Toute question commençant par "Comment", "Quel", "Quelle", "Quels", "Quelles", "Qui", "Quand", "Où", "Pourquoi" concernant des sujets administratifs, sociaux, ou réglementaires

Une question est AUTRE UNIQUEMENT si elle concerne clairement :
- La météo, le sport, la cuisine, les loisirs (sans lien juridique)
- Des questions techniques non juridiques (programmation, mathématiques pures, etc.)
- Des questions personnelles sans aucun lien juridique (ex: "Quel est mon nom ?")

RÈGLE D'OR : Si tu hésites entre JURIDIQUE et AUTRE, choisis TOUJOURS JURIDIQUE.

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
            
            # Détection très permissive : si "AUTRE" n'est pas explicitement présent, classer comme JURIDIQUE
            if "AUTRE" in response_content and response_content.startswith("AUTRE") and "JURIDIQUE" not in response_content:
                category = "AUTRE"
            else:
                # Par défaut, classer comme JURIDIQUE (très permissif)
                category = "JURIDIQUE"
                print(f"✅ Classification permissive - Question classée comme JURIDIQUE par défaut")
        except Exception as e:
            print(f"⚠️  Erreur lors de la classification LLM: {e}")
            # En cas d'erreur, être permissif et classer comme JURIDIQUE par défaut
            category = "JURIDIQUE"
            print(f"✅ Classification par défaut après erreur - Question classée comme JURIDIQUE")
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

def detect_domain_from_question(question: str) -> str:
    """Détecte le domaine juridique à partir de la question de manière générale."""
    question_lower = question.lower()
    
    # Détection basée sur les mots-clés du domaine
    domain_keywords = {
        'penal': ['pénal', 'penal', 'peine', 'peines', 'détenu', 'detenu', 'prison', 'pénitentiaire', 'penitentiaire',
                  'infraction', 'infractions', 'sanction', 'sanctions', 'tribunal', 'juge', 'procédure', 'procedure',
                  'prescription', 'aménagement', 'amenagement', 'commission pénitentiaire', 'commission penitentiaire'],
        'travail': ['travail', 'travailleur', 'travailleurs', 'employeur', 'employeurs', 'employé', 'employés', 'employe', 'employes',
                    'salarié', 'salariés', 'salarie', 'salaries', 'contrat', 'contrats', 'licenciement', 'préavis', 'preavis',
                    'retraite', 'syndicat', 'syndicats', 'grève', 'greve', 'congé', 'conge', 'salaire', 'salaires',
                    'code du travail', 'codedutravail'],
        'constitution': ['constitution', 'constitutionnel', 'constitutionnelle', 'président', 'president', 'parlement',
                         'pouvoir', 'pouvoirs', 'droit fondamental', 'droits fondamentaux', 'liberté', 'liberte', 'libertés', 'libertes'],
        'finance': ['budget', 'budgets', 'finance', 'finances', 'impôt', 'impots', 'impôts', 'taxe', 'taxes', 'fiscal',
                    'déficit', 'deficit', 'ressource', 'ressources', 'charge', 'charges', 'plf', 'loi de finance', 'lois de finance'],
        'administration': ['administration', 'administratif', 'administrative', 'fonction publique', 'collectivité', 'collectivités',
                          'collectivite', 'collectivites', 'municipalité', 'municipalites', 'commune', 'communes', 'région', 'region', 'régions', 'regions'],
        'aviation': ['aviation', 'aérien', 'aerien', 'aérienne', 'aerienne', 'aériennes', 'aeriennes']
    }
    
    # Compter les correspondances pour chaque domaine
    domain_scores = {}
    for domain, keywords in domain_keywords.items():
        score = sum(1 for keyword in keywords if keyword in question_lower)
        if score > 0:
            domain_scores[domain] = score
    
    # Retourner le domaine avec le score le plus élevé
    if domain_scores:
        return max(domain_scores, key=domain_scores.get)
    else:
        return 'general'

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

# Liste officielle et exhaustive des questions autorisées (basées sur les documents disponibles)
AUTHORIZED_QUESTIONS = [
    # Questions sur le droit du travail - Dispositions générales (Code du Travail)
    "Qui est considéré comme travailleur selon l'article L.2 du Code du Travail ?",
    "Qu'est-ce qu'un travailleur au sens de l'article L.2 du Code du Travail ?",
    "Quelles sont les personnes soumises au Code du Travail sénégalais ?",
    "Qu'est-ce qu'une entreprise selon l'article L.3 du Code du Travail ?",
    "Qu'est-ce qu'un établissement au sens du Code du Travail ?",
    "Quelles sont les obligations de l'employeur envers les travailleurs ?",
    "Quel est le droit au travail selon l'article L.1 du Code du Travail ?",
    "Comment l'État assure-t-il l'égalité de chance en matière d'emploi ?",
    "Quelles sont les obligations de l'État envers les travailleurs ?",
    "Le travail forcé est-il interdit au Sénégal selon l'article L.4 ?",
    "Qu'est-ce que le travail forcé ou obligatoire selon l'article L.4 ?",
    "Quelles sont les exceptions à l'interdiction du travail forcé ?",
    "Qu'est-ce que le droit à l'expression des travailleurs selon l'article L.5 ?",
    "Quel est l'objet du droit d'expression des travailleurs dans l'entreprise ?",
    "Les opinions des travailleurs peuvent-elles motiver un licenciement selon l'article L.5 ?",
    "Quelles sont les conditions d'application du droit d'expression des travailleurs ?",
    "Un travailleur peut-il bénéficier d'avantages supérieurs à ceux du Code du Travail ?",
    "Les personnes nommées dans un emploi permanent de l'administration sont-elles soumises au Code du Travail ?",
    
    # Questions sur les syndicats professionnels (Code du Travail)
    "Quelles sont les règles de création d'un syndicat professionnel ?",
    "Quel est l'objet des syndicats professionnels selon l'article L.6 ?",
    "Qui peut constituer un syndicat professionnel selon l'article L.7 ?",
    "Qui peut adhérer à un syndicat professionnel ?",
    "Quelles sont les conditions pour créer un syndicat professionnel ?",
    "Comment fonctionne la procédure de dépôt des statuts d'un syndicat ?",
    "Où doit-on déposer les statuts d'un syndicat professionnel selon l'article L.8 ?",
    "Quels documents doivent être déposés pour créer un syndicat ?",
    "Quel est le délai pour le dépôt des statuts d'un syndicat ?",
    "Qui délivre le récépissé de reconnaissance d'un syndicat ?",
    "Quelles sont les conditions d'accès aux fonctions de direction syndicale ?",
    "Qui vérifie la régularité des statuts d'un syndicat ?",
    "Quelles sont les conséquences si un membre ne remplit pas les conditions pour diriger un syndicat ?",
    "Quand peut-on demander la dissolution d'un syndicat ?",
    "Quelles protections s'appliquent aux travailleurs dans l'exercice du droit d'expression ?",
    "Quelles sont les infractions concernant le travail forcé ?",
    "Quels sont les droits des syndicats devant la justice ?",
    "Quelles protections s'appliquent aux biens d'un syndicat ?",
    "Quelles sont les règles applicables aux syndicats ?",
    
    # Questions sur la retraite (Loi sur la retraite)
    "Quel est l'âge légal de départ à la retraite au Sénégal ?",
    "Quels sont les conditions pour bénéficier de la retraite ?",
    "Comment calculer la pension de retraite ?",
    "Quels travailleurs peuvent poursuivre leur activité au-delà de l'âge de la retraite ?",
    "Quelles sont les modalités de versement de la pension de retraite ?",
    "Comment fonctionne le système de retraite au Sénégal ?",
    "Quelles sont les cotisations nécessaires pour la retraite ?",
    "Quels sont les droits des retraités ?",
    "Comment faire une demande de retraite ?",
    "Quelles sont les conditions d'ancienneté pour la retraite ?",
    
    # Questions sur le droit pénal (Loi 84-20 du 02 février 1984)
    "Quelles sont les infractions prévues par la loi 84-20 du 02 février 1984 ?",
    "Quelles sont les peines prévues par la loi 84-20 ?",
    "Comment s'applique la loi 84-20 du 02 février 1984 ?",
    "Quelles sont les dispositions de la loi 84-20 concernant les infractions pénales ?",
    "Quels sont les délits réprimés par la loi 84-20 ?",
    "Quelles sont les sanctions prévues par la loi 84-20 ?",
    
    # Questions sur le droit pénal (Loi 2020-05 du 10 janvier 2020)
    "Quelles sont les modifications apportées par la loi 2020-05 du 10 janvier 2020 ?",
    "Comment la loi 2020-05 modifie-t-elle les peines pour violences sexuelles ?",
    "Quelles sont les nouvelles peines prévues par la loi 2020-05 ?",
    "Quelles sont les infractions concernées par la loi 2020-05 ?",
    "Comment s'applique la loi 2020-05 du 10 janvier 2020 ?",
    "Quelles sont les circonstances aggravantes prévues par la loi 2020-05 ?",
    "Quels sont les délais de prescription modifiés par la loi 2020-05 ?",
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
        # Récupérer plus de documents initialement pour avoir un meilleur pool
        documents = retriever.invoke(question)
        
        # Si le reranker est activé, l'utiliser pour améliorer la pertinence
        if ENABLE_RERANKER and compressor:
            try:
                print(f"🔄 Reranking de {len(documents)} documents...")
                documents = compressor.compress_documents(documents, question)
                print(f"✅ {len(documents)} documents sélectionnés après reranking")
            except Exception as e:
                print(f"⚠️  Erreur lors du reranking: {e}. Utilisation des documents originaux.")
        
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
    # Filtrer les mots-clés pour ne garder que ceux significatifs (plus de 3 caractères)
    question_keywords = {w for w in question_words if len(w) > 3}
    
    # Filtrer les documents pour ne garder que ceux qui sont pertinents
    # Utiliser un système de scoring plus strict
    question_lower = question.lower()
    
    # Extraire les concepts clés spécifiques de la question
    key_concepts = {w for w in question_lower.split() if len(w) > 4}
    # Ajouter des concepts spécifiques selon le type de question
    if 'commission' in question_lower:
        if 'pénitentiaire' in question_lower or 'penitentiaire' in question_lower:
            key_concepts.update(['pénitentiaire', 'penitentiaire', 'aménagement', 'amenagement'])
    
    relevant_documents = []
    for doc in documents:
        if doc.page_content:
            content_lower = doc.page_content.lower()
            score = 0
            
            # Score basé sur les mots-clés significatifs (plus de 3 caractères)
            keyword_matches = sum(1 for keyword in question_keywords if keyword in content_lower)
            score += keyword_matches
            
            # Bonus pour les concepts clés spécifiques
            concept_matches = sum(1 for concept in key_concepts if concept in content_lower)
            score += concept_matches * 2  # Poids plus élevé pour les concepts clés
            
            # Vérifier la cohérence du domaine
            metadata = doc.metadata if hasattr(doc, 'metadata') and doc.metadata else {}
            source = metadata.get('source', '')
            doc_domain = detect_domain_from_source(str(source))
            
            # Détecter le domaine de la question
            question_domain = 'general'
            if any(word in question_lower for word in ['pénal', 'penal', 'peine', 'peines', 'détenu', 'detenu', 'prison', 'pénitentiaire', 'penitentiaire']):
                question_domain = 'penal'
            elif any(word in question_lower for word in ['travail', 'travailleur', 'employeur']):
                question_domain = 'travail'
            
            # Bonus si le domaine correspond
            if question_domain != 'general' and doc_domain == question_domain:
                score += 5
            # Pénalité si le domaine ne correspond pas
            elif question_domain != 'general' and doc_domain != question_domain and doc_domain != 'general':
                score -= 3
            
            # Un document est pertinent s'il a un score >= 2
            if score >= 2:
                relevant_documents.append((score, doc))
    
    # Trier par score décroissant (documents les plus pertinents en premier)
    relevant_documents.sort(reverse=True, key=lambda x: x[0])
    # Prendre les 3-5 documents les plus pertinents
    filtered_documents = [doc for _, doc in relevant_documents[:5]]
    
    # Si aucun document pertinent n'est trouvé, utiliser les 2 premiers documents (fallback minimal)
    if not filtered_documents:
        print("⚠️  Aucun document pertinent trouvé avec les critères stricts. Utilisation des 2 premiers documents.")
        filtered_documents = documents[:2]  # Limiter à 2 documents max en fallback
    
    print(f"📚 {len(filtered_documents)} documents pertinents sélectionnés sur {len(documents)} récupérés")
    
    for idx, doc in enumerate(filtered_documents):
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
    
    # Si aucun document pertinent n'a été trouvé, retourner une réponse appropriée
    if not filtered_documents or not context.strip():
        return {
            "answer": "Je ne trouve pas l'information dans les textes fournis.",
            "sources": ["Aucun document pertinent trouvé pour cette question."],
            "messages": messages,
            "suggested_questions": []
        }
    
    # Construire le template avec l'historique si disponible
    if history_str:
        template = """TU ES UN ASSISTANT JURIDIQUE SÉNÉGALAIS STRICTEMENT FACTUEL ET DÉTAILLÉ. 
    TON RÔLE est de répondre aux questions de l'utilisateur en te basant EXCLUSIVEMENT sur les extraits de loi CONTEXTE.
    
    RÈGLES CRITIQUES POUR TA RÉPONSE :
    1. SOIS COMPLET ET DÉTAILLÉ : Fournis une réponse exhaustive qui couvre tous les aspects de la question. Ne sois pas bref - l'utilisateur veut une explication complète et approfondie.
    2. STRUCTURE TA RÉPONSE AVEC HIÉRARCHIE :
       - Commence par une réponse directe et complète (2-3 phrases qui résument la réponse)
       - Développe ensuite avec des détails précis, des exemples concrets, et des explications pédagogiques
       - Utilise des listes à puces (-) pour les points importants, les missions, les conditions, les droits, les obligations, etc.
       - Utilise des listes numérotées (1., 2., 3.) pour les étapes, processus, ou séquences chronologiques
       - Inclus toujours les chiffres précis, dates, montants, délais, pourcentages mentionnés dans le contexte
       - Termine par les références légales entre crochets [Article X, Code Y]
    3. UTILISE DES LISTES POUR FACILITER LA LECTURE : Au lieu de longs paragraphes, utilise des listes à puces pour les éléments multiples (missions, conditions, droits, obligations, etc.).
    4. SOIS UN VRAI ASSISTANT PÉDAGOGIQUE : Explique le droit de manière simple et accessible, sans jargon inutile. Donne des exemples concrets quand c'est possible.
    5. INCLUS TOUJOURS TOUS les détails spécifiques du contexte : nombres exacts, dates précises, montants, délais, pourcentages, conditions spécifiques. Ne généralise pas - sois précis.
    6. NE COMMENCE JAMAIS par citer un article : Commence par la réponse concrète et l'explication.
    7. NE METS JAMAIS de titres ou sections : Écris de manière fluide mais structurée avec des listes.
    8. DÉVELOPPE TES RÉPONSES : Ne sois pas bref. Si la question demande des détails, fournis-les. Si elle demande une explication, explique en profondeur.
    9. Si le CONTEXTE ne contient pas l'information, réponds : 'Je ne trouve pas l'information dans les textes fournis.'
    
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
    1. SOIS COMPLET ET DÉTAILLÉ : Fournis une réponse exhaustive qui couvre tous les aspects de la question. Ne sois pas bref - l'utilisateur veut une explication complète et approfondie.
    2. STRUCTURE TA RÉPONSE AVEC HIÉRARCHIE :
       - Commence par une réponse directe et complète (2-3 phrases qui résument la réponse)
       - Développe ensuite avec des détails précis, des exemples concrets, et des explications pédagogiques
       - Utilise des listes à puces (-) pour les points importants, les missions, les conditions, les droits, les obligations, etc.
       - Utilise des listes numérotées (1., 2., 3.) pour les étapes, processus, ou séquences chronologiques
       - Inclus toujours les chiffres précis, dates, montants, délais, pourcentages mentionnés dans le contexte
       - Termine par les références légales entre crochets [Article X, Code Y]
    3. UTILISE DES LISTES POUR FACILITER LA LECTURE : Au lieu de longs paragraphes, utilise des listes à puces pour les éléments multiples (missions, conditions, droits, obligations, etc.).
    4. SOIS UN VRAI ASSISTANT PÉDAGOGIQUE : Explique le droit de manière simple et accessible, sans jargon inutile. Donne des exemples concrets quand c'est possible.
    5. INCLUS TOUJOURS TOUS les détails spécifiques du contexte : nombres exacts, dates précises, montants, délais, pourcentages, conditions spécifiques. Ne généralise pas - sois précis.
    6. NE COMMENCE JAMAIS par citer un article : Commence par la réponse concrète et l'explication.
    7. NE METS JAMAIS de titres ou sections : Écris de manière fluide mais structurée avec des listes.
    8. DÉVELOPPE TES RÉPONSES : Ne sois pas bref. Si la question demande des détails, fournis-les. Si elle demande une explication, explique en profondeur.
    9. Si le CONTEXTE ne contient pas l'information, réponds : 'Je ne trouve pas l'information dans les textes fournis.'
    
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
    
    # Filtrer les sources pour ne garder que celles qui sont réellement utilisées dans la réponse
    # Vérifier la cohérence entre la réponse et les sources avec un système de scoring strict
    answer_lower = answer_content.lower()
    question_lower = question.lower()
    
    # Extraire les concepts clés de la question de manière générale
    # 1. Mots significatifs (plus de 4 caractères, excluant les mots vides)
    stop_words = {'comment', 'quelle', 'quelles', 'quels', 'quel', 'qui', 'quoi', 'quand', 'où', 'pourquoi', 'combien', 
                  'peut', 'peuvent', 'doit', 'doivent', 'sont', 'est', 'être', 'etre', 'dans', 'pour', 'avec', 'sans',
                  'selon', 'selon', 'selon', 'fonctionne', 'fonctionnent', 'fonctionnement'}
    question_key_concepts = {w for w in question_lower.split() if len(w) > 4 and w not in stop_words}
    
    # 2. Extraire les noms propres et termes techniques (mots avec majuscules ou termes juridiques spécifiques)
    # Les termes juridiques importants sont généralement des noms composés ou des concepts spécifiques
    question_words = question_lower.split()
    for i, word in enumerate(question_words):
        # Détecter les noms composés (ex: "code du travail", "juge de l'application")
        if i < len(question_words) - 1:
            bigram = f"{word} {question_words[i+1]}"
            if len(bigram.replace(' ', '')) > 8:  # Noms composés significatifs
                question_key_concepts.add(bigram.replace(' ', ''))
    
    # 3. Ajouter les variantes avec/sans accents pour les termes français
    additional_concepts = set()
    for concept in question_key_concepts:
        # Variantes avec accents
        if 'e' in concept:
            additional_concepts.add(concept.replace('e', 'é'))
            additional_concepts.add(concept.replace('e', 'è'))
        if 'a' in concept:
            additional_concepts.add(concept.replace('a', 'à'))
        if 'u' in concept:
            additional_concepts.add(concept.replace('u', 'ù'))
    question_key_concepts.update(additional_concepts)
    
    # Détecter le domaine de la question de manière générale
    question_domain = detect_domain_from_question(question_lower)
    
    filtered_sources = []
    source_scores = []
    
    for source_json in sources_list:
        try:
            source_data = json.loads(source_json)
            source_content = source_data.get("content", "").lower()
            source_title = source_data.get("title", "").lower()
            source_domain = source_data.get("domain", "general")
            
            # Score de pertinence (plus le score est élevé, plus la source est pertinente)
            relevance_score = 0
            
            # 1. Vérifier la cohérence du domaine (critère important)
            if question_domain != 'general' and source_domain == question_domain:
                relevance_score += 10  # Bonus important pour le même domaine
            elif question_domain != 'general' and source_domain != question_domain and source_domain != 'general':
                relevance_score -= 5  # Pénalité si domaine différent
            
            # 2. Vérifier la présence des concepts clés de la question dans la source
            source_concept_matches = sum(1 for concept in question_key_concepts if concept in source_content)
            if source_concept_matches >= 2:  # Au moins 2 concepts clés
                relevance_score += source_concept_matches * 3
            elif source_concept_matches == 1:
                relevance_score += 1  # Score faible si seulement 1 concept
            
            # 3. Vérifier si des phrases significatives de la source apparaissent dans la réponse
            # Extraire des phrases de la source et vérifier leur présence dans la réponse
            source_sentences = [s.strip() for s in source_content.split('.') if len(s.strip()) > 20]
            significant_matches = 0
            for sentence in source_sentences[:10]:  # Prendre les 10 premières phrases
                sentence_words = [w for w in sentence.split() if len(w) > 3]
                if len(sentence_words) >= 4:  # Phrases avec au moins 4 mots significatifs
                    # Vérifier si au moins 3 mots de la phrase sont dans la réponse
                    matches = sum(1 for word in sentence_words if word in answer_lower)
                    if matches >= 3:
                        significant_matches += 1
                        relevance_score += 5  # Bonus pour chaque phrase significative
            
            # 4. Vérifier si le titre de la source contient des concepts de la question
            if source_title:
                title_concept_matches = sum(1 for concept in question_key_concepts if concept in source_title)
                if title_concept_matches > 0:
                    relevance_score += title_concept_matches * 2
            
            # 5. Vérifier la présence de termes spécifiques dans le contenu de la source
            # Bonus pour les concepts spécifiques qui apparaissent ensemble (indique une forte pertinence)
            concept_pairs = []
            for i, concept1 in enumerate(list(question_key_concepts)[:5]):  # Limiter pour performance
                for concept2 in list(question_key_concepts)[i+1:6]:
                    if concept1 in source_content and concept2 in source_content:
                        relevance_score += 3  # Bonus pour chaque paire de concepts trouvée
            
            # 6. Vérifier la cohérence sémantique : si la source contient plusieurs concepts clés ensemble
            concepts_found = sum(1 for concept in question_key_concepts if concept in source_content)
            if concepts_found >= 3:  # Au moins 3 concepts clés trouvés
                relevance_score += 5
            elif concepts_found == 2:
                relevance_score += 2
            
            # 7. Pénalité pour les sources qui contiennent des mots génériques mais pas les concepts spécifiques
            # Détecter les mots génériques courants qui peuvent créer des faux positifs
            generic_words = ['commission', 'conseil', 'comité', 'comite', 'organe', 'institution', 'autorité', 'autorite']
            generic_in_question = [word for word in generic_words if word in question_lower]
            
            if generic_in_question:
                # Si la source contient un mot générique mais pas les concepts spécifiques
                for generic_word in generic_in_question:
                    if generic_word in source_content:
                        # Vérifier si les concepts spécifiques (hors mots génériques) sont présents
                        specific_concepts = {c for c in question_key_concepts if c not in generic_words and len(c) > 5}
                        if specific_concepts:
                            specific_found = sum(1 for concept in specific_concepts if concept in source_content)
                            if specific_found == 0 and source_domain != question_domain:
                                relevance_score -= 10  # Forte pénalité pour faux positif
            
            # Une source est pertinente si son score est >= 5
            if relevance_score >= 5:
                source_scores.append((relevance_score, source_json))
                print(f"✅ Source '{source_data.get('title', 'Unknown')}' - Score: {relevance_score}")
            else:
                print(f"❌ Source '{source_data.get('title', 'Unknown')}' rejetée - Score: {relevance_score}")
                
        except Exception as e:
            # En cas d'erreur de parsing, ne pas inclure la source
            print(f"⚠️  Erreur lors du filtrage de la source: {e}")
    
    # Trier les sources par score décroissant et prendre les meilleures
    source_scores.sort(reverse=True, key=lambda x: x[0])
    filtered_sources = [source_json for score, source_json in source_scores if score >= 5]
    
    # Limiter à 3 sources maximum pour éviter la surcharge
    filtered_sources = filtered_sources[:3]
    
    # Si aucune source n'est pertinente mais qu'on a des sources, ne pas en garder
    # (mieux vaut ne pas avoir de sources que des sources non pertinentes)
    if not filtered_sources and sources_list:
        print("⚠️  Aucune source pertinente trouvée. Aucune source ne sera retournée.")
    
    # Utiliser les sources filtrées
    sources_list = filtered_sources if filtered_sources else ["Aucune source pertinente disponible"]
    
    print(f"📋 {len(sources_list)} sources cohérentes sélectionnées")
    
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


# Initialiser le reranker si activé
compressor = None
if ENABLE_RERANKER:
    try:
        compressor = BGEReranker(
            model_name="BAAI/bge-reranker-base",
            top_n=3,  # Limiter à 3 documents les plus pertinents
            enabled=True
        )
        print("✅ Reranker BGE initialisé")
    except Exception as e:
        print(f"⚠️  Erreur lors de l'initialisation du reranker: {e}")
        compressor = None
else:
    print("ℹ️  Reranker désactivé (ENABLE_RERANKER=false)")

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
