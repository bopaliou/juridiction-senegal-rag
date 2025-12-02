#!/bin/bash

# Script de démarrage pour Render
# Vérifie si Chroma DB existe, sinon lance l'ingestion en arrière-plan
# Puis démarre le serveur FastAPI immédiatement

# Ne pas utiliser set -e car on veut que le serveur démarre même si l'ingestion échoue
set +e

echo "🚀 Démarrage de YoonAssist AI Backend..."

# Chemin vers la base de données Chroma (depuis la racine du projet)
CHROMA_DB_PATH="data/chroma_db"

# Vérifier si Chroma DB existe
if [ ! -d "$CHROMA_DB_PATH" ] || [ -z "$(ls -A $CHROMA_DB_PATH 2>/dev/null)" ]; then
    echo "📚 Chroma DB introuvable ou vide. Lancement de l'ingestion en arrière-plan..."
    # Lancer l'ingestion en arrière-plan pour ne pas bloquer le démarrage du serveur
    # Utiliser python -u pour unbuffered output
    nohup python -u src/ingestion.py > ingestion.log 2>&1 &
    INGESTION_PID=$!
    echo "✅ Ingestion lancée en arrière-plan (PID: $INGESTION_PID). Le serveur démarre pendant l'ingestion..."
    echo "📝 Les logs d'ingestion seront disponibles dans ingestion.log"
else
    echo "✅ Chroma DB trouvée. Pas besoin d'ingestion."
fi

# Démarrer le serveur FastAPI immédiatement
# Render définit automatiquement la variable PORT
PORT=${PORT:-8000}
echo "🌐 Démarrage du serveur FastAPI sur le port $PORT..."
echo "📍 Répertoire de travail: $(pwd)"
echo "📁 Contenu du répertoire data: $(ls -la data/ 2>/dev/null | head -5 || echo 'Répertoire data non trouvé')"

# Démarrer uvicorn
exec uvicorn src.server:app --host 0.0.0.0 --port $PORT

