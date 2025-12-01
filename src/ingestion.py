from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader,PyPDFLoader,WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pathlib import Path
import shutil

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

load_dotenv()

# Resolve data paths relative to the project root (one level up from `src/`)
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "data"
DATA_DB_PATH = BASE_DIR / "data" / "chroma_db"
URL_CONSTITUTION = "https://conseilconstitutionnel.sn/la-constitution/"
URL_CODE_DES_COLLECTIVITES_LOCALES ="https://primature.sn/publications/lois-et-reglements/code-des-collectivites-locales"
URL_CODE_DE_AVIATION_CIVILE="https://primature.sn/publications/lois-et-reglements/code-de-laviation-civile"
URL_MISE_A_JOUR_CONSTITUTION="https://primature.sn/publications/lois-et-reglements/mises-jour-de-la-constitution"

def ingest_documents():
    #1. Chargtement recursif des documents
    print(f"Chargement des documents depuis : {DATA_PATH}")

    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Data directory not found: '{DATA_PATH}'.\nExpected 'data' directory at project root ({BASE_DIR})."
        )

    loader_pdf = DirectoryLoader(
        path=str(DATA_PATH),
        glob="**/*.pdf",
        loader_cls=PyPDFLoader,
        show_progress=True,
    )
    documents_pdf = loader_pdf.load()
    print(f"{len(documents_pdf)} documents chargés.")
    
    loader_web = WebBaseLoader(
        web_path=[URL_CONSTITUTION,URL_CODE_DES_COLLECTIVITES_LOCALES,URL_CODE_DE_AVIATION_CIVILE,URL_MISE_A_JOUR_CONSTITUTION],
        show_progress=True,
    )
    documents_web = loader_web.load()
    print(f"{len(documents_web)} documents chargés.")
    
    documents = documents_pdf + documents_web
    print(f"{len(documents)} documents chargés.")
    
    #Decoupage(chunking) des documents
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""],
    
    )
    chunks = text_splitter.split_documents(documents)
    print(f"{len(chunks)} chunks créés après découpage.")
    
    # Supprimer l'ancienne base de données si elle existe pour éviter les conflits
    if DATA_DB_PATH.exists():
        print(f"⚠️  Suppression de l'ancienne base de données à : {DATA_DB_PATH}")
        shutil.rmtree(DATA_DB_PATH)
    
    # Créer le répertoire s'il n'existe pas
    DATA_DB_PATH.mkdir(parents=True, exist_ok=True)
    
    #vectorisation et stockage dans la base de données Chroma
    print("🔄 Création des embeddings et stockage dans Chroma...")
    embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    # Créer la base de données Chroma avec tous les chunks
    # Utiliser collection_name pour éviter les conflits
    print(f"📦 Stockage de {len(chunks)} chunks dans Chroma...")
    
    # Vérifier que les chunks contiennent du contenu
    valid_chunks = [chunk for chunk in chunks if chunk.page_content and len(chunk.page_content.strip()) > 0]
    print(f"📊 {len(valid_chunks)} chunks valides sur {len(chunks)} total")
    
    if len(valid_chunks) == 0:
        print("❌ ERREUR: Aucun chunk valide à stocker!")
        return
    
    # Créer la base de données Chroma
    print("🔄 Création de la base de données Chroma...")
    print(f"   📁 Répertoire: {DATA_DB_PATH}")
    print(f"   📦 Nombre de documents: {len(valid_chunks)}")
    print("   ⏳ Cela peut prendre plusieurs minutes...")
    
    # Créer la base avec from_documents (cela peut prendre du temps)
    try:
        db = Chroma.from_documents(
            documents=valid_chunks,
            embedding=embedding_model,
            persist_directory=str(DATA_DB_PATH),
            collection_name="juridiction_senegal",  # Nom explicite pour la collection
        )
        print("✅ Base de données Chroma créée.")
    except Exception as e:
        print(f"❌ ERREUR lors de la création: {e}")
        import traceback
        traceback.print_exc()
        return
    
    print("🔄 Vérification de la persistance...")
    
    # Vérifier immédiatement que les données ont été stockées
    try:
        # Attendre un peu pour que la persistance se termine
        import time
        print("   ⏳ Attente de 2 secondes pour la persistance...")
        time.sleep(2)
        
        # Vérifier les fichiers créés
        if DATA_DB_PATH.exists():
            files = list(DATA_DB_PATH.iterdir())
            print(f"   📂 Fichiers créés: {len(files)}")
            total_size = 0
            for f in files[:10]:  # Afficher les 10 premiers fichiers
                if f.is_file():
                    size = f.stat().st_size
                    total_size += size
                    print(f"      - {f.name} ({size:,} bytes)")
            print(f"   💾 Taille totale: {total_size:,} bytes")
        
        # Recharger la base pour vérifier
        print("🔍 Rechargement de la base de données...")
        db_check = Chroma(
            persist_directory=str(DATA_DB_PATH),
            embedding_function=embedding_model,
            collection_name="juridiction_senegal"
        )
        
        # Vérifier le nombre de documents
        collection = db_check._collection
        count = collection.count() if collection else 0
        print(f"✅ Base de données Chroma créée à : {DATA_DB_PATH}")
        print(f"✅ {count} documents stockés dans la base de données.")
        
        if count == 0:
            print("❌ ERREUR: Aucun document n'a été stocké!")
            print("💡 Tentative de diagnostic...")
            
            # Vérifier si le répertoire existe et contient des fichiers
            if DATA_DB_PATH.exists():
                files = list(DATA_DB_PATH.iterdir())
                print(f"   📂 Fichiers dans le répertoire: {len(files)}")
                for f in files[:5]:  # Afficher les 5 premiers fichiers
                    print(f"      - {f.name}")
            
            # Essayer de voir les collections disponibles avec chromadb directement
            try:
                import chromadb
                client = chromadb.PersistentClient(path=str(DATA_DB_PATH))
                collections = client.list_collections()
                print(f"   📚 Collections trouvées: {len(collections)}")
                for col in collections:
                    col_count = col.count()
                    print(f"      - {col.name}: {col_count} documents")
                    if col_count > 0:
                        print(f"         ✅ Collection '{col.name}' contient {col_count} documents!")
            except Exception as e2:
                print(f"   ⚠️  Erreur lors de la vérification des collections: {e2}")
                import traceback
                traceback.print_exc()
            
            return
        
        # Test de récupération pour confirmer
        print("🔍 Test de récupération...")
        test_results = db_check.similarity_search("test", k=1)
        if test_results:
            print(f"✅ Test de récupération réussi: {len(test_results)} document(s) trouvé(s)")
            print(f"   📄 Premier document: {test_results[0].page_content[:100]}...")
        else:
            print("⚠️  Avertissement: Test de récupération n'a retourné aucun résultat")
            
    except Exception as e:
        print(f"⚠️  Erreur lors de la vérification : {e}")
        import traceback
        traceback.print_exc()
        print(f"✅ Base de données Chroma créée à : {DATA_DB_PATH}")
    
if __name__ == "__main__":
    print(BASE_DIR)
    ingest_documents()  