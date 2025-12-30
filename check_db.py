"""Script pour vérifier le contenu de la base ChromaDB"""

from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from pathlib import Path

db_path = Path("data/chroma_db")

if not db_path.exists():
    print("❌ La base de données n'existe pas!")
    exit(1)

print("🔍 Chargement de la base de données...")
emb = HuggingFaceEmbeddings(
    model_name='sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
)

db = Chroma(
    persist_directory=str(db_path),
    embedding_function=emb,
    collection_name="juridiction_senegal"
)

# Récupérer tous les documents
docs_data = db.get()

total = len(docs_data['ids'])
print(f"\n📊 Total documents dans la base: {total}")

# Compter par type de source
pdf_count = 0
web_count = 0
unknown_count = 0

source_names = set()

for meta in docs_data['metadatas']:
    source_type = meta.get('source_type', 'unknown')
    source_name = meta.get('source_name', 'Unknown')
    
    source_names.add(source_name)
    
    if source_type == 'pdf':
        pdf_count += 1
    elif source_type == 'web':
        web_count += 1
    else:
        unknown_count += 1

print(f"\n📄 Documents PDF: {pdf_count}")
print(f"🌐 Documents Web: {web_count}")
print(f"❓ Documents inconnus: {unknown_count}")

print(f"\n📚 Sources uniques ({len(source_names)}):")
for name in sorted(source_names):
    count = sum(1 for m in docs_data['metadatas'] if m.get('source_name') == name)
    source_type = next((m.get('source_type', '?') for m in docs_data['metadatas'] if m.get('source_name') == name), '?')
    print(f"  [{source_type.upper():3}] {name}: {count} chunks")
