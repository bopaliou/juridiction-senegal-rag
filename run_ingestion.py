"""
Script d'ingestion rapide pour terminer l'ajout des sources web
Sans interrompre le serveur en cours
"""

import sys
from pathlib import Path

# Ajouter au path
sys.path.insert(0, str(Path(__file__).parent))

print("🚀 Lancement de l'ingestion complète...")
print("⏱️  Cela peut prendre 5-10 minutes")
print("💡 Le serveur peut continuer à tourner pendant ce temps\n")

# Importer et lancer
from src.ingestion import ingest_documents

if __name__ == "__main__":
    try:
        ingest_documents()
        print("\n✅ Ingestion terminée!")
        print("📝 Pour utiliser la nouvelle base:")
        print("   1. Arrêtez le serveur (Ctrl+C)")
        print("   2. Dans src/agent.py, changez:")
        print('      CHROMA_DB_PATH = BASE_DIR / "data" / "chroma_db_with_web"')
        print("   3. Relancez le serveur")
    except KeyboardInterrupt:
        print("\n⚠️ Ingestion interrompue par l'utilisateur")
    except Exception as e:
        print(f"\n❌ Erreur: {e}")
