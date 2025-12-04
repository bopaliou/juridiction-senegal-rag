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
import time

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

# =================================================================
# MAPPING DES NOMS DE SOURCES OFFICIELS
# =================================================================
# Ce dictionnaire mappe les noms de fichiers PDF vers leurs titres officiels
# pour un affichage propre dans l'interface utilisateur

SOURCE_MAPPING = {
    # Codes principaux
    "codedutravail.pdf": "Code du Travail",
    "codedutravail": "Code du Travail",
    "code_du_travail.pdf": "Code du Travail",
    "code_travail.pdf": "Code du Travail",
    "codetravail.pdf": "Code du Travail",
    
    "codepenal.pdf": "Code Pénal",
    "code_penal.pdf": "Code Pénal",
    "code-penal.pdf": "Code Pénal",
    
    "codecivil.pdf": "Code Civil",
    "code_civil.pdf": "Code Civil",
    
    "codefamille.pdf": "Code de la Famille",
    "code_famille.pdf": "Code de la Famille",
    "code-famille.pdf": "Code de la Famille",
    
    "constitution.pdf": "Constitution du Sénégal",
    "constitution_senegal.pdf": "Constitution du Sénégal",
    
    "cocc.pdf": "Code des Obligations Civiles et Commerciales",
    "code_obligations.pdf": "Code des Obligations Civiles et Commerciales",
    
    # Lois spécifiques
    "loi-2020-05-du-10-janvier-2020.pdf": "Loi 2020-05 du 10 janvier 2020 (Criminalisation du viol)",
    "loi-2020-05-du-10-JANVIER-2020.pdf": "Loi 2020-05 du 10 janvier 2020 (Criminalisation du viol)",
    "loi-84-20-du-02-fevrier-1984.pdf": "Loi 84-20 du 02 février 1984",
    "Loi-84-20-du-02-fevrier-1984.pdf": "Loi 84-20 du 02 février 1984",
    
    # Autres codes
    "code_collectivites.pdf": "Code des Collectivités Locales",
    "code_aviation.pdf": "Code de l'Aviation Civile",
    "code_environnement.pdf": "Code de l'Environnement",
    "code_commerce.pdf": "Code de Commerce",
    "code_douanes.pdf": "Code des Douanes",
    "code_impots.pdf": "Code Général des Impôts",
}

# Mapping des URLs vers noms officiels
WEB_SOURCE_MAPPING = {
    "conseilconstitutionnel.sn": "Constitution du Sénégal",
    "code-des-collectivites-locales": "Code des Collectivités Locales",
    "code-de-laviation-civile": "Code de l'Aviation Civile",
    "mises-jour-de-la-constitution": "Mises à jour de la Constitution",
}

# URLs des sources web
WEB_SOURCES = [
    "https://conseilconstitutionnel.sn/la-constitution/",
    "https://primature.sn/publications/lois-et-reglements/code-des-collectivites-locales",
    "https://primature.sn/publications/lois-et-reglements/code-de-laviation-civile",
    "https://primature.sn/publications/lois-et-reglements/mises-jour-de-la-constitution"
]


def get_official_source_name(source_path: str) -> str:
    """
    Obtient le nom officiel d'une source à partir de son chemin ou URL.
    
    Args:
        source_path: Chemin du fichier ou URL
        
    Returns:
        Nom officiel formaté de la source
    """
    # Extraire le nom du fichier
    filename = Path(source_path).name.lower()
    
    # Vérifier dans le mapping des PDFs
    if filename in SOURCE_MAPPING:
        return SOURCE_MAPPING[filename]
    
    # Vérifier avec le stem (sans extension)
    stem = Path(source_path).stem.lower()
    if stem in SOURCE_MAPPING:
        return SOURCE_MAPPING[stem]
    
    # Vérifier si c'est une URL web
    source_lower = source_path.lower()
    for url_part, official_name in WEB_SOURCE_MAPPING.items():
        if url_part in source_lower:
            return official_name
    
    # Fallback: Nettoyer et formater le nom de fichier
    name = Path(source_path).stem
    # Remplacer les séparateurs courants
    name = name.replace('_', ' ').replace('-', ' ')
    # Supprimer les répétitions (ex: "codedutravailtravail" -> "code du travail")
    name = re.sub(r'(\w+)\1+', r'\1', name, flags=re.IGNORECASE)
    # Ajouter des espaces avant les majuscules (camelCase)
    name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
    # Title case
    name = name.title()
    # Nettoyer les espaces multiples
    name = re.sub(r'\s+', ' ', name).strip()
    
    return name


class SenegalLegalChunker:
    """
    Découpeur sémantique pour les textes juridiques sénégalais.
    
    Respecte la hiérarchie légale : LIVRE > TITRE > CHAPITRE > SECTION > Article
    et maintient un fil d'ariane contextuel pour chaque chunk.
    """
    
    # Patterns de détection de la hiérarchie légale
    HIERARCHY_PATTERNS = {
        'livre': re.compile(
            r'^[\s]*(?:LIVRE|Livre)\s+([IVXLCDM]+|PREMIER|DEUXIÈME|TROISIÈME|QUATRIÈME|CINQUIÈME|SECOND|\d+)',
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
    
    # Patterns pour le nettoyage avancé
    CLEANING_PATTERNS = [
        # Pagination et navigation
        (re.compile(r'---\s*PAGE\s*\d+\s*---', re.IGNORECASE), ''),
        (re.compile(r'page\s*\d+\s*/\s*\d+', re.IGNORECASE), ''),
        (re.compile(r'^\s*\d+\s*/\s*\d+\s*$', re.MULTILINE), ''),
        
        # Numéros de page isolés et résidus de pied de page
        (re.compile(r'^\s*\d{1,4}\s*[;.]?\s*$', re.MULTILINE), ''),
        (re.compile(r'^\s*-\s*\d+\s*-\s*$', re.MULTILINE), ''),
        
        # Mentions "(suite)" après les articles coupés
        (re.compile(r'\(suite\)', re.IGNORECASE), ''),
        (re.compile(r'\(Suite\)', re.IGNORECASE), ''),
        (re.compile(r'\.\.\.\s*suite', re.IGNORECASE), ''),
        
        # En-têtes/pieds de page répétés
        (re.compile(r'^\s*JURISCONSULT\s*$', re.IGNORECASE | re.MULTILINE), ''),
        (re.compile(r'^\s*Journal\s+Officiel\s*$', re.IGNORECASE | re.MULTILINE), ''),
        (re.compile(r'^\s*J\.?O\.?\s+\d+.*$', re.IGNORECASE | re.MULTILINE), ''),
        
        # Noms de documents répétés/mal formatés
        (re.compile(r'Codedutravailtravail', re.IGNORECASE), 'Code du Travail'),
        (re.compile(r'Codedutravail(?![\w])', re.IGNORECASE), 'Code du Travail'),
        (re.compile(r'CodeduTravail', re.IGNORECASE), 'Code du Travail'),
        (re.compile(r'CODEDUTRAVAIL', re.IGNORECASE), 'Code du Travail'),
        (re.compile(r'Codepenal(?![\w])', re.IGNORECASE), 'Code Pénal'),
        (re.compile(r'CODEPENAL', re.IGNORECASE), 'Code Pénal'),
        
        # Form feed et caractères spéciaux
        (re.compile(r'\x0c'), ''),  # Form feed
        (re.compile(r'\x00'), ''),  # Null
        (re.compile(r'[\x01-\x08\x0b\x0e-\x1f]'), ''),  # Autres caractères de contrôle
        
        # Lignes avec seulement des tirets ou underscores
        (re.compile(r'^[\s_\-=]{5,}$', re.MULTILINE), ''),
        
        # Points de suspension excessifs
        (re.compile(r'\.{4,}'), '...'),
    ]
    
    # Seuil pour déclencher le sub-chunking (en caractères)
    LONG_ARTICLE_THRESHOLD = 2000
    
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
        
        # Splitter secondaire pour les articles longs
        self.sub_chunker = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " ", ""],
            keep_separator=True
        )
    
    def clean_text(self, text: str) -> str:
        """
        Nettoie le texte du bruit OCR, des artefacts de pagination et des erreurs courantes.
        
        Args:
            text: Texte brut à nettoyer
            
        Returns:
            Texte nettoyé
        """
        if not text:
            return ''
        
        cleaned = text
        
        # Appliquer tous les patterns de nettoyage
        for pattern, replacement in self.CLEANING_PATTERNS:
            cleaned = pattern.sub(replacement, cleaned)
        
        # Normaliser les espaces multiples (mais garder un seul espace)
        cleaned = re.sub(r' {2,}', ' ', cleaned)
        
        # Normaliser les sauts de ligne multiples (max 2 consécutifs)
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        
        # Supprimer les espaces en début/fin de ligne
        lines = []
        for line in cleaned.split('\n'):
            stripped = line.strip()
            # Ignorer les lignes qui ne contiennent que des espaces ou ponctuation
            if stripped and not re.match(r'^[\s\.\,\;\:\-\_\=]+$', stripped):
                lines.append(stripped)
        
        cleaned = '\n'.join(lines)
        
        # Supprimer les lignes vides au début et à la fin
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
            # Nettoyer le numéro d'article
            article_num = re.sub(r'\s+', ' ', article_num)
            article_num = article_num.split('\n')[0].strip()  # Prendre seulement la première ligne
            
            start_pos = match.start()
            
            # La fin de l'article est le début du prochain article ou la fin du texte
            if i + 1 < len(matches):
                end_pos = matches[i + 1].start()
            else:
                end_pos = len(text)
            
            article_content = text[start_pos:end_pos].strip()
            articles.append((article_num, article_content, start_pos, end_pos))
        
        return articles
    
    def format_chunk_content(self, source_name: str, breadcrumb: str, article_num: str, 
                              content: str, part_info: Optional[str] = None) -> str:
        """
        Formate le contenu d'un chunk avec une structure claire pour l'affichage.
        
        Args:
            source_name: Nom officiel de la source
            breadcrumb: Fil d'ariane contextuel
            article_num: Numéro de l'article
            content: Contenu de l'article
            part_info: Information sur la partie (ex: "(Partie 1/3)")
            
        Returns:
            Contenu formaté
        """
        parts = []
        
        # En-tête structuré
        parts.append(f"Source: {source_name}")
        
        if breadcrumb:
            parts.append(f"Contexte: {breadcrumb}")
        
        if article_num:
            article_label = f"Article {article_num}"
            if part_info:
                article_label += f" {part_info}"
            parts.append(article_label)
        
        parts.append("")  # Ligne vide avant le contenu
        parts.append(content)
        
        return '\n'.join(parts)
    
    def chunk_article(self, article_num: str, article_content: str, breadcrumb: str, 
                      metadata: dict, source_name: str) -> List[Document]:
        """
        Découpe un article en chunks si nécessaire (Sub-Chunking pour articles longs).
        
        Utilise RecursiveCharacterTextSplitter pour garantir qu'aucun contenu n'est tronqué,
        même pour les articles très longs (plusieurs pages).
        
        Args:
            article_num: Numéro de l'article
            article_content: Contenu complet de l'article
            breadcrumb: Fil d'ariane contextuel
            metadata: Métadonnées du document source
            source_name: Nom officiel de la source
            
        Returns:
            Liste de Documents (chunks)
        """
        chunks = []
        
        # Nettoyer le contenu de l'article
        clean_content = self.clean_text(article_content)
        if not clean_content:
            return []
        
        # Calculer la taille de l'en-tête pour ajuster les limites
        header_template = f"Source: {source_name}\nContexte: {breadcrumb}\nArticle {article_num}\n\n"
        header_size = len(header_template) + 20  # +20 pour "(Partie X/Y)" potentiel
        
        # Taille effective pour le contenu
        effective_chunk_size = self.chunk_size - header_size
        
        # =================================================================
        # CAS 1: Article court (< LONG_ARTICLE_THRESHOLD caractères)
        # =================================================================
        if len(clean_content) < self.LONG_ARTICLE_THRESHOLD:
            formatted_content = self.format_chunk_content(source_name, breadcrumb, article_num, clean_content)
            
            # Si même formaté ça tient dans un chunk
            if len(formatted_content) <= self.chunk_size:
                chunk_metadata = {
                    **metadata,
                    'source_name': source_name,
                    'article': f"Article {article_num}",
                    'breadcrumb': breadcrumb,
                    'chunk_type': 'article_complet',
                    'total_parts': 1,
                    'part_number': 1
                }
                chunks.append(Document(page_content=formatted_content, metadata=chunk_metadata))
                return chunks
        
        # =================================================================
        # CAS 2: Article long (>= LONG_ARTICLE_THRESHOLD caractères)
        # Utilisation du Sub-Chunking avec RecursiveCharacterTextSplitter
        # =================================================================
        
        # Découper le contenu en sous-parties avec le splitter secondaire
        sub_chunks = self.sub_chunker.split_text(clean_content)
        total_parts = len(sub_chunks)
        
        if total_parts == 0:
            return []
        
        # Si après split on n'a qu'une partie, créer un seul document
        if total_parts == 1:
            formatted_content = self.format_chunk_content(source_name, breadcrumb, article_num, sub_chunks[0])
            chunk_metadata = {
                **metadata,
                'source_name': source_name,
                'article': f"Article {article_num}",
                'breadcrumb': breadcrumb,
                'chunk_type': 'article_complet',
                'total_parts': 1,
                'part_number': 1
            }
            chunks.append(Document(page_content=formatted_content, metadata=chunk_metadata))
            return chunks
        
        # Créer un document pour chaque sous-partie avec indication de la partie
        for part_idx, sub_content in enumerate(sub_chunks, start=1):
            # Formater l'en-tête avec indication de la partie
            part_indicator = f"(Partie {part_idx}/{total_parts})"
            article_label = f"{article_num} {part_indicator}"
            
            # Construire le contenu formaté
            parts = []
            parts.append(f"Source: {source_name}")
            if breadcrumb:
                parts.append(f"Contexte: {breadcrumb}")
            parts.append(f"Article {article_label}")
            parts.append("")  # Ligne vide
            parts.append(sub_content.strip())
            
            full_content = '\n'.join(parts)
            
            # Métadonnées enrichies
            chunk_metadata = {
                **metadata,
                'source_name': source_name,
                'article': f"Article {article_num}",
                'article_display': f"Article {article_label}",
                'breadcrumb': breadcrumb,
                'chunk_type': 'article_partiel',
                'part_number': part_idx,
                'total_parts': total_parts,
                'chunk_index': part_idx - 1
            }
            
            chunks.append(Document(page_content=full_content, metadata=chunk_metadata))
        
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
        
        # Obtenir le nom officiel de la source
        source_name = get_official_source_name(metadata.get('source', ''))
        
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
                    
                    preamble_content = self.format_chunk_content(source_name, breadcrumb, "", preamble)
                    
                    if len(preamble_content) <= self.chunk_size:
                        chunk_metadata = {
                            **metadata,
                            'source_name': source_name,
                            'breadcrumb': breadcrumb,
                            'chunk_type': 'preambule'
                        }
                        chunks.append(Document(page_content=preamble_content, metadata=chunk_metadata))
                    else:
                        splitter = RecursiveCharacterTextSplitter(
                            chunk_size=self.chunk_size,
                            chunk_overlap=self.chunk_overlap
                        )
                        preamble_chunks = splitter.split_text(preamble)
                        for i, pc in enumerate(preamble_chunks):
                            formatted = self.format_chunk_content(source_name, breadcrumb, "", pc)
                            chunk_metadata = {
                                **metadata,
                                'source_name': source_name,
                                'breadcrumb': breadcrumb,
                                'chunk_type': 'preambule',
                                'chunk_index': i
                            }
                            chunks.append(Document(page_content=formatted, metadata=chunk_metadata))
            
            # Traiter chaque article
            for article_num, article_content, start_pos, end_pos in articles:
                # Mettre à jour le fil d'ariane avec le contenu précédant l'article
                preceding_text = cleaned_text[max(0, start_pos - 500):start_pos]
                self.update_breadcrumb(preceding_text)
                breadcrumb = self.get_breadcrumb()
                
                # Découper l'article
                article_chunks = self.chunk_article(article_num, article_content, breadcrumb, metadata, source_name)
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
                
                self.update_breadcrumb(para)
                
                if len(current_chunk) + len(para) + 2 <= self.chunk_size:
                    current_chunk += para + '\n\n'
                else:
                    if current_chunk.strip():
                        breadcrumb = self.get_breadcrumb()
                        formatted = self.format_chunk_content(source_name, breadcrumb, "", current_chunk.strip())
                        chunk_metadata = {
                            **metadata,
                            'source_name': source_name,
                            'breadcrumb': breadcrumb,
                            'chunk_type': 'paragraphe'
                        }
                        chunks.append(Document(page_content=formatted, metadata=chunk_metadata))
                    current_chunk = para + '\n\n'
            
            # Dernier chunk
            if current_chunk.strip():
                breadcrumb = self.get_breadcrumb()
                formatted = self.format_chunk_content(source_name, breadcrumb, "", current_chunk.strip())
                chunk_metadata = {
                    **metadata,
                    'source_name': source_name,
                    'breadcrumb': breadcrumb,
                    'chunk_type': 'paragraphe'
                }
                chunks.append(Document(page_content=formatted, metadata=chunk_metadata))
        
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


def safe_rmtree(path: Path, max_retries: int = 3, delay: float = 1.0) -> bool:
    """
    Supprime un répertoire de manière sécurisée avec gestion des erreurs Windows.
    
    Args:
        path: Chemin du répertoire à supprimer
        max_retries: Nombre maximum de tentatives
        delay: Délai entre les tentatives (secondes)
        
    Returns:
        True si suppression réussie, False sinon
    """
    if not path.exists():
        return True
    
    for attempt in range(max_retries):
        try:
            shutil.rmtree(path)
            return True
        except PermissionError as e:
            if attempt < max_retries - 1:
                logger.warning(f"⚠️ Fichiers verrouillés, tentative {attempt + 2}/{max_retries}...")
                gc.collect()
                time.sleep(delay)
            else:
                logger.error(f"❌ Impossible de supprimer {path}: {e}")
                logger.info("💡 Essayez de fermer les applications qui utilisent la base de données.")
                return False
    return False


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
            official_name = get_official_source_name(source_path)
            logger.info(f"   📄 Traitement: {official_name}")
            
            metadata = {
                'source': source_path,
                'source_type': 'pdf',
                'document_name': official_name
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
        
        # Ajouter les métadonnées avec noms officiels
        for chunk in web_chunks:
            source_url = chunk.metadata.get('source', '')
            official_name = get_official_source_name(source_url)
            chunk.metadata['source_type'] = 'web'
            chunk.metadata['source_name'] = official_name
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
        if not safe_rmtree(DATA_DB_PATH):
            logger.error("❌ Impossible de supprimer l'ancienne base. Abandon.")
            return
    
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
        test_results = db_check.similarity_search("Article L.2 du Code du Travail", k=3)
        if test_results:
            logger.info(f"✅ Test réussi: {len(test_results)} résultat(s)")
            for i, res in enumerate(test_results[:2]):
                preview = res.page_content[:150].replace('\n', ' ')
                source_name = res.metadata.get('source_name', 'N/A')
                logger.info(f"   {i+1}. [{source_name}] {preview}...")
        
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
