#!/bin/bash

# Script de démarrage pour Render
# Vérifie si Chroma DB existe, sinon lance l'ingestion
# Puis démarre le serveur FastAPI

set -e

echo "🚀 Démarrage de YoonAssist AI Backend..."

# Chemin vers la base de données Chroma
CHROMA_DB_PATH="data/chroma_db"

# Vérifier si Chroma DB existe
if [ ! -d "$CHROMA_DB_PATH" ] || [ -z "$(ls -A $CHROMA_DB_PATH 2>/dev/null)" ]; then
    echo "📚 Chroma DB introuvable ou vide. Lancement de l'ingestion..."
    python src/ingestion.py
    echo "✅ Ingestion terminée."
else
    echo "✅ Chroma DB trouvée. Pas besoin d'ingestion."
fi

# Démarrer le serveur FastAPI
# Render définit automatiquement la variable PORT
PORT=${PORT:-8000}
echo "🌐 Démarrage du serveur FastAPI sur le port $PORT..."
exec uvicorn src.server:app --host 0.0.0.0 --port $PORT

