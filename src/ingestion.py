from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader,PyPDFLoader,WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pathlib import Path
import shutil
import warnings
import logging

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

load_dotenv()

# Configurer le logging pour réduire le bruit
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Supprimer les avertissements non critiques de PyPDF
warnings.filterwarnings('ignore', category=UserWarning, module='pypdf')
warnings.filterwarnings('ignore', message='.*Multiple definitions in dictionary.*')

# Resolve data paths relative to the project root (one level up from `src/`)
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "data"
DATA_DB_PATH = BASE_DIR / "data" / "chroma_db"
URL_CONSTITUTION = "https://conseilconstitutionnel.sn/la-constitution/"
URL_CODE_DES_COLLECTIVITES_LOCALES ="https://primature.sn/publications/lois-et-reglements/code-des-collectivites-locales"
URL_CODE_DE_AVIATION_CIVILE="https://primature.sn/publications/lois-et-reglements/code-de-laviation-civile"
URL_MISE_A_JOUR_CONSTITUTION="https://primature.sn/publications/lois-et-reglements/mises-jour-de-la-constitution"

def ingest_documents():
    """Ingère les documents PDF et web, les découpe en chunks et les stocke dans Chroma."""
    logger.info(f"📚 Début de l'ingestion des documents depuis : {DATA_PATH}")

    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Data directory not found: '{DATA_PATH}'.\nExpected 'data' directory at project root ({BASE_DIR})."
        )

    # 1. Chargement des documents PDF
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
        logger.info(f"✅ {len(documents_pdf)} documents PDF chargés avec succès.")
    except Exception as e:
        logger.error(f"❌ Erreur lors du chargement des PDFs: {e}")
        documents_pdf = []
    
    # 2. Chargement des documents web
    logger.info("🌐 Chargement des documents web...")
    try:
        loader_web = WebBaseLoader(
            web_path=[
                URL_CONSTITUTION,
                URL_CODE_DES_COLLECTIVITES_LOCALES,
                URL_CODE_DE_AVIATION_CIVILE,
                URL_MISE_A_JOUR_CONSTITUTION
            ],
            show_progress=True,
        )
        documents_web = loader_web.load()
        logger.info(f"✅ {len(documents_web)} documents web chargés avec succès.")
    except Exception as e:
        logger.error(f"❌ Erreur lors du chargement des documents web: {e}")
        documents_web = []
    
    documents = documents_pdf + documents_web
    logger.info(f"📦 Total: {len(documents)} documents chargés ({len(documents_pdf)} PDF + {len(documents_web)} web).")
    
    # 3. Découpage (chunking) des documents
    logger.info("✂️  Découpage des documents en chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""],
    )
    chunks = text_splitter.split_documents(documents)
    logger.info(f"✅ {len(chunks)} chunks créés après découpage.")
    
    # 4. Préparation de la base de données
    if DATA_DB_PATH.exists():
        logger.warning(f"⚠️  Suppression de l'ancienne base de données à : {DATA_DB_PATH}")
        shutil.rmtree(DATA_DB_PATH)
    
    # Créer le répertoire s'il n'existe pas
    DATA_DB_PATH.mkdir(parents=True, exist_ok=True)
    
    # 5. Vérification et filtrage des chunks valides
    logger.info("🔍 Vérification de la validité des chunks...")
    valid_chunks = [
        chunk for chunk in chunks 
        if chunk.page_content and len(chunk.page_content.strip()) > 0
    ]
    invalid_count = len(chunks) - len(valid_chunks)
    if invalid_count > 0:
        logger.warning(f"⚠️  {invalid_count} chunks invalides ignorés (vides ou sans contenu).")
    logger.info(f"📊 {len(valid_chunks)} chunks valides sur {len(chunks)} total.")
    
    if len(valid_chunks) == 0:
        logger.error("❌ ERREUR: Aucun chunk valide à stocker!")
        return
    
    # 6. Création des embeddings et stockage dans Chroma
    logger.info("🔄 Initialisation du modèle d'embeddings...")
    embedding_model = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )
    
    logger.info("🔄 Création de la base de données Chroma...")
    logger.info(f"   📁 Répertoire: {DATA_DB_PATH}")
    logger.info(f"   📦 Nombre de documents: {len(valid_chunks)}")
    logger.info("   ⏳ Cela peut prendre plusieurs minutes...")
    
    # Créer la base avec from_documents (cela peut prendre du temps)
    try:
        Chroma.from_documents(
            documents=valid_chunks,
            embedding=embedding_model,
            persist_directory=str(DATA_DB_PATH),
            collection_name="juridiction_senegal",
        )
        logger.info("✅ Base de données Chroma créée avec succès.")
    except (ValueError, RuntimeError, OSError) as e:
        logger.error(f"❌ ERREUR lors de la création: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # 7. Vérification de la persistance
    logger.info("🔄 Vérification de la persistance...")
    
    try:
        import time
        logger.info("   ⏳ Attente de 2 secondes pour la persistance...")
        time.sleep(2)
        
        # Vérifier les fichiers créés
        if DATA_DB_PATH.exists():
            files = list(DATA_DB_PATH.iterdir())
            logger.info(f"   📂 Fichiers créés: {len(files)}")
            total_size = 0
            for f in files[:10]:
                if f.is_file():
                    size = f.stat().st_size
                    total_size += size
                    logger.info(f"      - {f.name} ({size:,} bytes)")
            logger.info(f"   💾 Taille totale: {total_size:,} bytes ({total_size / 1024 / 1024:.2f} MB)")
        
        # Recharger la base pour vérifier
        logger.info("🔍 Rechargement de la base de données pour vérification...")
        db_check = Chroma(
            persist_directory=str(DATA_DB_PATH),
            embedding_function=embedding_model,
            collection_name="juridiction_senegal"
        )
        
        # Vérifier le nombre de documents
        # Note: Accès à _collection nécessaire pour vérifier le count
        collection = db_check._collection  # type: ignore[attr-defined]
        count = collection.count() if collection else 0
        logger.info(f"✅ Base de données Chroma créée à : {DATA_DB_PATH}")
        logger.info(f"✅ {count} documents stockés dans la base de données.")
        
        if count == 0:
            logger.error("❌ ERREUR: Aucun document n'a été stocké!")
            logger.info("💡 Tentative de diagnostic...")
            
            if DATA_DB_PATH.exists():
                files = list(DATA_DB_PATH.iterdir())
                logger.info(f"   📂 Fichiers dans le répertoire: {len(files)}")
                for f in files[:5]:
                    logger.info(f"      - {f.name}")
            
            try:
                import chromadb
                client = chromadb.PersistentClient(path=str(DATA_DB_PATH))
                collections = client.list_collections()
                logger.info(f"   📚 Collections trouvées: {len(collections)}")
                for col in collections:
                    col_count = col.count()
                    logger.info(f"      - {col.name}: {col_count} documents")
                    if col_count > 0:
                        logger.info(f"         ✅ Collection '{col.name}' contient {col_count} documents!")
            except (ImportError, RuntimeError, OSError) as e2:
                logger.error(f"   ⚠️  Erreur lors de la vérification des collections: {e2}")
                import traceback
                traceback.print_exc()
            
            return
        
        # Test de récupération pour confirmer
        logger.info("🔍 Test de récupération...")
        test_results = db_check.similarity_search("test", k=1)
        if test_results:
            logger.info(f"✅ Test de récupération réussi: {len(test_results)} document(s) trouvé(s)")
            logger.info(f"   📄 Aperçu: {test_results[0].page_content[:100]}...")
        else:
            logger.warning("⚠️  Avertissement: Test de récupération n'a retourné aucun résultat")
            
    except (ValueError, RuntimeError, OSError, ImportError) as e:
        logger.error(f"⚠️  Erreur lors de la vérification : {e}")
        import traceback
        traceback.print_exc()
        logger.info(f"✅ Base de données Chroma créée à : {DATA_DB_PATH}")
    
if __name__ == "__main__":
    logger.info(f"📁 Répertoire de base: {BASE_DIR}")
    try:
        ingest_documents()
        logger.info("🎉 Ingestion terminée avec succès!")
    except Exception as e:
        logger.error(f"❌ Erreur fatale lors de l'ingestion: {e}")
        import traceback
        traceback.print_exc()
        exit(1)  