"""
Ingestion des documents juridiques sénégalais avec découpage sémantique.

Ce module implémente un découpage intelligent qui respecte la structure
hiérarchique des textes de loi (Livre > Titre > Chapitre > Section > Article).
"""

from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader, WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
import shutil
import warnings
import logging
import re
import gc

load_dotenv()

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Supprimer les avertissements non critiques
warnings.filterwarnings('ignore', category=UserWarning, module='pypdf')
warnings.filterwarnings('ignore', message='.*Multiple definitions in dictionary.*')

# Chemins
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "data"
DATA_DB_PATH = BASE_DIR / "data" / "chroma_db"

# URLs des sources web
WEB_SOURCES = [
    "https://conseilconstitutionnel.sn/la-constitution/",
    "https://primature.sn/publications/lois-et-reglements/code-des-collectivites-locales",
    "https://primature.sn/publications/lois-et-reglements/code-de-laviation-civile",
    "https://primature.sn/publications/lois-et-reglements/mises-jour-de-la-constitution"
]


class SenegalLegalChunker:
    """
    Découpeur sémantique pour les textes juridiques sénégalais.
    
    Respecte la hiérarchie légale : LIVRE > TITRE > CHAPITRE > SECTION > Article
    et maintient un fil d'ariane contextuel pour chaque chunk.
    """
    
    # Patterns de détection de la hiérarchie légale
    HIERARCHY_PATTERNS = {
        'livre': re.compile(
            r'^[\s]*(?:LIVRE|Livre)\s+([IVXLCDM]+|PREMIER|DEUXIÈME|TROISIÈME|QUATRIÈME|CINQUIÈME|PREMIER|SECOND|\d+)',
            re.IGNORECASE | re.MULTILINE
        ),
        'titre': re.compile(
            r'^[\s]*(?:TITRE|Titre)\s+([IVXLCDM]+|PREMIER|DEUXIÈME|TROISIÈME|PRÉLIMINAIRE|\d+)',
            re.IGNORECASE | re.MULTILINE
        ),
        'chapitre': re.compile(
            r'^[\s]*(?:CHAPITRE|Chapitre)\s+([IVXLCDM]+|PREMIER|DEUXIÈME|PRÉLIMINAIRE|\d+)',
            re.IGNORECASE | re.MULTILINE
        ),
        'section': re.compile(
            r'^[\s]*(?:SECTION|Section)\s+([IVXLCDM]+|PREMIÈRE|DEUXIÈME|\d+)',
            re.IGNORECASE | re.MULTILINE
        ),
    }
    
    # Pattern pour détecter les articles
    ARTICLE_PATTERN = re.compile(
        r'^\s*(?:Article|Art\.?)\s+([A-Z]?\.?\s?\d+[a-z]*(?:\s?bis|ter|quater)?[^\n]*)',
        re.IGNORECASE | re.MULTILINE
    )
    
    # Patterns pour le nettoyage OCR
    OCR_NOISE_PATTERNS = [
        re.compile(r'---\s*PAGE\s*\d+\s*---', re.IGNORECASE),
        re.compile(r'page\s*\d+\s*/\s*\d+', re.IGNORECASE),
        re.compile(r'^\s*JURISCONSULT\s*$', re.IGNORECASE | re.MULTILINE),
        re.compile(r'^\s*\d+\s*$', re.MULTILINE),  # Numéros de page isolés
        re.compile(r'\x0c'),  # Form feed characters
    ]
    
    def __init__(self, chunk_size: int = 1500, chunk_overlap: int = 200):
        """
        Initialise le chunker.
        
        Args:
            chunk_size: Taille maximale d'un chunk (en caractères)
            chunk_overlap: Chevauchement entre chunks pour les articles longs
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.current_breadcrumb: Dict[str, str] = {}
    
    def clean_text(self, text: str) -> str:
        """
        Nettoie le texte du bruit OCR et des artefacts de pagination.
        
        Args:
            text: Texte brut à nettoyer
            
        Returns:
            Texte nettoyé
        """
        cleaned = text
        
        # Appliquer les patterns de nettoyage
        for pattern in self.OCR_NOISE_PATTERNS:
            cleaned = pattern.sub('', cleaned)
        
        # Normaliser les espaces multiples
        cleaned = re.sub(r' {2,}', ' ', cleaned)
        
        # Normaliser les sauts de ligne multiples
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        
        # Supprimer les espaces en début/fin de ligne
        cleaned = '\n'.join(line.strip() for line in cleaned.split('\n'))
        
        return cleaned.strip()
    
    def get_breadcrumb(self) -> str:
        """
        Génère le fil d'ariane actuel.
        
        Returns:
            Chaîne formatée du contexte hiérarchique (ex: "Livre I > Titre II > Chapitre 1")
        """
        parts = []
        for level in ['livre', 'titre', 'chapitre', 'section']:
            if level in self.current_breadcrumb and self.current_breadcrumb[level]:
                parts.append(self.current_breadcrumb[level])
        
        return ' > '.join(parts) if parts else ''
    
    def update_breadcrumb(self, text: str) -> None:
        """
        Met à jour le fil d'ariane en détectant les marqueurs hiérarchiques.
        
        Args:
            text: Texte à analyser pour les marqueurs de hiérarchie
        """
        for level, pattern in self.HIERARCHY_PATTERNS.items():
            match = pattern.search(text)
            if match:
                # Extraire le numéro/nom du niveau
                level_value = match.group(1).strip()
                level_name = level.capitalize()
                self.current_breadcrumb[level] = f"{level_name} {level_value}"
                
                # Réinitialiser les niveaux inférieurs
                levels = list(self.HIERARCHY_PATTERNS.keys())
                current_idx = levels.index(level)
                for lower_level in levels[current_idx + 1:]:
                    self.current_breadcrumb.pop(lower_level, None)
    
    def extract_articles(self, text: str) -> List[Tuple[str, str, int, int]]:
        """
        Extrait tous les articles du texte avec leurs positions.
        
        Args:
            text: Texte source
            
        Returns:
            Liste de tuples (numéro_article, contenu, position_début, position_fin)
        """
        articles = []
        matches = list(self.ARTICLE_PATTERN.finditer(text))
        
        for i, match in enumerate(matches):
            article_num = match.group(1).strip()
            start_pos = match.start()
            
            # La fin de l'article est le début du prochain article ou la fin du texte
            if i + 1 < len(matches):
                end_pos = matches[i + 1].start()
            else:
                end_pos = len(text)
            
            article_content = text[start_pos:end_pos].strip()
            articles.append((article_num, article_content, start_pos, end_pos))
        
        return articles
    
    def chunk_article(self, article_num: str, article_content: str, breadcrumb: str, metadata: dict) -> List[Document]:
        """
        Découpe un article en chunks si nécessaire.
        
        Args:
            article_num: Numéro de l'article
            article_content: Contenu complet de l'article
            breadcrumb: Fil d'ariane contextuel
            metadata: Métadonnées du document source
            
        Returns:
            Liste de Documents (chunks)
        """
        chunks = []
        
        # Construire le préfixe contextuel
        context_prefix = ""
        if breadcrumb:
            context_prefix = f"[{breadcrumb}]\n"
        context_prefix += f"Article {article_num}\n\n"
        
        # Si l'article tient dans un seul chunk
        full_content = context_prefix + article_content
        if len(full_content) <= self.chunk_size:
            chunk_metadata = {
                **metadata,
                'article': f"Article {article_num}",
                'breadcrumb': breadcrumb,
                'chunk_type': 'article_complet'
            }
            chunks.append(Document(page_content=full_content, metadata=chunk_metadata))
        else:
            # Découper l'article en plusieurs chunks avec chevauchement
            # Essayer de couper aux phrases
            sentences = re.split(r'(?<=[.!?])\s+', article_content)
            current_chunk = context_prefix
            chunk_idx = 0
            
            for sentence in sentences:
                if len(current_chunk) + len(sentence) + 1 <= self.chunk_size:
                    current_chunk += sentence + ' '
                else:
                    # Sauvegarder le chunk actuel
                    if current_chunk.strip():
                        chunk_metadata = {
                            **metadata,
                            'article': f"Article {article_num}",
                            'breadcrumb': breadcrumb,
                            'chunk_type': 'article_partiel',
                            'chunk_index': chunk_idx
                        }
                        chunks.append(Document(page_content=current_chunk.strip(), metadata=chunk_metadata))
                        chunk_idx += 1
                    
                    # Commencer un nouveau chunk avec contexte
                    current_chunk = f"[{breadcrumb}] Article {article_num} (suite)\n\n{sentence} "
            
            # Ajouter le dernier chunk
            if current_chunk.strip() and len(current_chunk) > len(context_prefix):
                chunk_metadata = {
                    **metadata,
                    'article': f"Article {article_num}",
                    'breadcrumb': breadcrumb,
                    'chunk_type': 'article_partiel',
                    'chunk_index': chunk_idx
                }
                chunks.append(Document(page_content=current_chunk.strip(), metadata=chunk_metadata))
        
        return chunks
    
    def chunk_document(self, text: str, metadata: dict) -> List[Document]:
        """
        Découpe un document juridique complet en chunks sémantiques.
        
        Args:
            text: Texte complet du document
            metadata: Métadonnées du document
            
        Returns:
            Liste de Documents (chunks)
        """
        # Réinitialiser le fil d'ariane pour chaque document
        self.current_breadcrumb = {}
        
        # Nettoyer le texte
        cleaned_text = self.clean_text(text)
        
        if not cleaned_text:
            logger.warning(f"⚠️ Document vide après nettoyage: {metadata.get('source', 'inconnu')}")
            return []
        
        chunks = []
        
        # Extraire les articles
        articles = self.extract_articles(cleaned_text)
        
        if articles:
            logger.info(f"   📑 {len(articles)} articles détectés")
            
            # Traiter le texte avant le premier article (préambule, etc.)
            first_article_pos = articles[0][2]
            if first_article_pos > 0:
                preamble = cleaned_text[:first_article_pos].strip()
                if preamble and len(preamble) > 50:
                    self.update_breadcrumb(preamble)
                    breadcrumb = self.get_breadcrumb()
                    
                    # Découper le préambule si nécessaire
                    if len(preamble) <= self.chunk_size:
                        chunk_metadata = {
                            **metadata,
                            'breadcrumb': breadcrumb,
                            'chunk_type': 'preambule'
                        }
                        chunks.append(Document(page_content=preamble, metadata=chunk_metadata))
                    else:
                        # Utiliser un splitter basique pour le préambule
                        splitter = RecursiveCharacterTextSplitter(
                            chunk_size=self.chunk_size,
                            chunk_overlap=self.chunk_overlap
                        )
                        preamble_chunks = splitter.split_text(preamble)
                        for i, pc in enumerate(preamble_chunks):
                            chunk_metadata = {
                                **metadata,
                                'breadcrumb': breadcrumb,
                                'chunk_type': 'preambule',
                                'chunk_index': i
                            }
                            chunks.append(Document(page_content=pc, metadata=chunk_metadata))
            
            # Traiter chaque article
            for article_num, article_content, start_pos, end_pos in articles:
                # Mettre à jour le fil d'ariane avec le contenu précédant l'article
                preceding_text = cleaned_text[max(0, start_pos - 500):start_pos]
                self.update_breadcrumb(preceding_text)
                breadcrumb = self.get_breadcrumb()
                
                # Découper l'article
                article_chunks = self.chunk_article(article_num, article_content, breadcrumb, metadata)
                chunks.extend(article_chunks)
        else:
            # Aucun article détecté - utiliser un découpage par paragraphes
            logger.info(f"   ℹ️ Pas d'articles détectés, découpage par paragraphes")
            
            paragraphs = cleaned_text.split('\n\n')
            current_chunk = ""
            
            for para in paragraphs:
                para = para.strip()
                if not para:
                    continue
                
                # Mettre à jour le fil d'ariane
                self.update_breadcrumb(para)
                
                if len(current_chunk) + len(para) + 2 <= self.chunk_size:
                    current_chunk += para + '\n\n'
                else:
                    if current_chunk.strip():
                        breadcrumb = self.get_breadcrumb()
                        chunk_metadata = {
                            **metadata,
                            'breadcrumb': breadcrumb,
                            'chunk_type': 'paragraphe'
                        }
                        chunks.append(Document(page_content=current_chunk.strip(), metadata=chunk_metadata))
                    current_chunk = para + '\n\n'
            
            # Dernier chunk
            if current_chunk.strip():
                breadcrumb = self.get_breadcrumb()
                chunk_metadata = {
                    **metadata,
                    'breadcrumb': breadcrumb,
                    'chunk_type': 'paragraphe'
                }
                chunks.append(Document(page_content=current_chunk.strip(), metadata=chunk_metadata))
        
        return chunks


def group_pdf_pages_by_file(documents: List[Document]) -> Dict[str, str]:
    """
    Regroupe les pages PDF par fichier source.
    
    Args:
        documents: Liste de Documents (pages individuelles)
        
    Returns:
        Dictionnaire {chemin_fichier: texte_complet}
    """
    grouped = defaultdict(list)
    
    for doc in documents:
        source = doc.metadata.get('source', 'unknown')
        page_num = doc.metadata.get('page', 0)
        grouped[source].append((page_num, doc.page_content))
    
    # Trier par numéro de page et concaténer
    result = {}
    for source, pages in grouped.items():
        pages.sort(key=lambda x: x[0])
        result[source] = '\n\n'.join(content for _, content in pages)
    
    return result


def ingest_documents():
    """
    Ingère les documents PDF et web avec découpage juridique sémantique.
    """
    logger.info(f"📚 Début de l'ingestion des documents depuis : {DATA_PATH}")
    
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Répertoire data non trouvé: '{DATA_PATH}'.\n"
            f"Attendu: répertoire 'data' à la racine du projet ({BASE_DIR})."
        )
    
    all_chunks: List[Document] = []
    
    # =================================================================
    # 1. CHARGEMENT ET TRAITEMENT DES PDFs (Découpage juridique)
    # =================================================================
    logger.info("📄 Chargement des documents PDF...")
    
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            loader_pdf = DirectoryLoader(
                path=str(DATA_PATH),
                glob="**/*.pdf",
                loader_cls=PyPDFLoader,
                show_progress=True,
            )
            documents_pdf = loader_pdf.load()
        logger.info(f"✅ {len(documents_pdf)} pages PDF chargées.")
    except Exception as e:
        logger.error(f"❌ Erreur lors du chargement des PDFs: {e}")
        documents_pdf = []
    
    if documents_pdf:
        # Regrouper les pages par fichier PDF
        logger.info("📑 Regroupement des pages par fichier PDF...")
        pdf_files = group_pdf_pages_by_file(documents_pdf)
        logger.info(f"   📁 {len(pdf_files)} fichiers PDF détectés")
        
        # Découpage juridique sémantique
        logger.info("✂️ Découpage juridique sémantique des PDFs...")
        legal_chunker = SenegalLegalChunker(chunk_size=1500, chunk_overlap=200)
        
        for source_path, full_text in pdf_files.items():
            logger.info(f"   📄 Traitement: {Path(source_path).name}")
            
            metadata = {
                'source': source_path,
                'source_type': 'pdf',
                'document_name': Path(source_path).stem
            }
            
            file_chunks = legal_chunker.chunk_document(full_text, metadata)
            all_chunks.extend(file_chunks)
            logger.info(f"      → {len(file_chunks)} chunks créés")
        
        logger.info(f"✅ {len(all_chunks)} chunks créés à partir des PDFs")
    
    # =================================================================
    # 2. CHARGEMENT ET TRAITEMENT DES DOCUMENTS WEB (Découpage classique)
    # =================================================================
    logger.info("🌐 Chargement des documents web...")
    
    try:
        loader_web = WebBaseLoader(
            web_path=WEB_SOURCES,
            show_progress=True,
        )
        documents_web = loader_web.load()
        logger.info(f"✅ {len(documents_web)} documents web chargés.")
    except Exception as e:
        logger.error(f"❌ Erreur lors du chargement des documents web: {e}")
        documents_web = []
    
    if documents_web:
        # Découpage classique pour les documents web
        logger.info("✂️ Découpage des documents web...")
        web_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""],
        )
        
        web_chunks = web_splitter.split_documents(documents_web)
        
        # Ajouter les métadonnées
        for chunk in web_chunks:
            chunk.metadata['source_type'] = 'web'
            chunk.metadata['chunk_type'] = 'web_content'
        
        all_chunks.extend(web_chunks)
        logger.info(f"✅ {len(web_chunks)} chunks créés à partir du web")
    
    # =================================================================
    # 3. VALIDATION DES CHUNKS
    # =================================================================
    logger.info(f"📦 Total: {len(all_chunks)} chunks créés")
    
    # Filtrer les chunks invalides
    logger.info("🔍 Validation des chunks...")
    valid_chunks = [
        chunk for chunk in all_chunks
        if chunk.page_content and len(chunk.page_content.strip()) > 20
    ]
    
    invalid_count = len(all_chunks) - len(valid_chunks)
    if invalid_count > 0:
        logger.warning(f"⚠️ {invalid_count} chunks invalides ignorés")
    
    logger.info(f"📊 {len(valid_chunks)} chunks valides")
    
    if not valid_chunks:
        logger.error("❌ Aucun chunk valide à stocker!")
        return
    
    # =================================================================
    # 4. PRÉPARATION DE LA BASE DE DONNÉES
    # =================================================================
    if DATA_DB_PATH.exists():
        logger.warning(f"⚠️ Suppression de l'ancienne base: {DATA_DB_PATH}")
        shutil.rmtree(DATA_DB_PATH)
    
    DATA_DB_PATH.mkdir(parents=True, exist_ok=True)
    
    # =================================================================
    # 5. CRÉATION DES EMBEDDINGS (Modèle multilingue optimisé)
    # =================================================================
    logger.info("🔄 Initialisation du modèle d'embeddings multilingue...")
    embedding_model = HuggingFaceEmbeddings(
        model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )
    logger.info("✅ Modèle paraphrase-multilingual-MiniLM-L12-v2 chargé")
    
    # =================================================================
    # 6. INSERTION PAR LOTS DANS CHROMADB
    # =================================================================
    logger.info("🔄 Création de la base de données Chroma...")
    logger.info(f"   📁 Répertoire: {DATA_DB_PATH}")
    logger.info(f"   📦 Nombre de chunks: {len(valid_chunks)}")
    
    BATCH_SIZE = 500
    total_batches = (len(valid_chunks) + BATCH_SIZE - 1) // BATCH_SIZE
    
    try:
        # Créer la base avec le premier lot
        first_batch = valid_chunks[:BATCH_SIZE]
        logger.info(f"   ⏳ Lot 1/{total_batches} ({len(first_batch)} chunks)...")
        
        db = Chroma.from_documents(
            documents=first_batch,
            embedding=embedding_model,
            persist_directory=str(DATA_DB_PATH),
            collection_name="juridiction_senegal",
        )
        
        # Ajouter les lots suivants
        for i in range(1, total_batches):
            start_idx = i * BATCH_SIZE
            end_idx = min((i + 1) * BATCH_SIZE, len(valid_chunks))
            batch = valid_chunks[start_idx:end_idx]
            
            logger.info(f"   ⏳ Lot {i + 1}/{total_batches} ({len(batch)} chunks)...")
            db.add_documents(batch)
            
            # Libérer la mémoire entre les lots
            gc.collect()
        
        logger.info("✅ Base de données Chroma créée avec succès.")
        
    except Exception as e:
        logger.error(f"❌ Erreur lors de la création: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # =================================================================
    # 7. VÉRIFICATION DE LA PERSISTANCE
    # =================================================================
    logger.info("🔄 Vérification de la persistance...")
    
    try:
        import time
        time.sleep(2)
        
        # Vérifier les fichiers créés
        if DATA_DB_PATH.exists():
            files = list(DATA_DB_PATH.iterdir())
            total_size = sum(f.stat().st_size for f in files if f.is_file())
            logger.info(f"   💾 Taille totale: {total_size / 1024 / 1024:.2f} MB")
        
        # Recharger et vérifier
        db_check = Chroma(
            persist_directory=str(DATA_DB_PATH),
            embedding_function=embedding_model,
            collection_name="juridiction_senegal"
        )
        
        collection = db_check._collection
        count = collection.count() if collection else 0
        logger.info(f"✅ {count} documents stockés dans la base de données")
        
        if count == 0:
            logger.error("❌ Aucun document stocké!")
            return
        
        # Test de récupération
        logger.info("🔍 Test de récupération...")
        test_results = db_check.similarity_search("Article L.2 Code du Travail", k=3)
        if test_results:
            logger.info(f"✅ Test réussi: {len(test_results)} résultat(s)")
            for i, res in enumerate(test_results[:2]):
                preview = res.page_content[:150].replace('\n', ' ')
                logger.info(f"   {i+1}. {preview}...")
        
    except Exception as e:
        logger.error(f"⚠️ Erreur lors de la vérification: {e}")
        import traceback
        traceback.print_exc()
    
    # Libérer la mémoire
    gc.collect()
    logger.info("🧹 Mémoire libérée")


if __name__ == "__main__":
    logger.info(f"📁 Répertoire de base: {BASE_DIR}")
    logger.info("=" * 60)
    logger.info("   INGESTION JURIDIQUE SÉMANTIQUE - SÉNÉGAL")
    logger.info("=" * 60)
    
    try:
        ingest_documents()
        logger.info("=" * 60)
        logger.info("🎉 Ingestion terminée avec succès!")
        logger.info("=" * 60)
    except Exception as e:
        logger.error(f"❌ Erreur fatale: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
