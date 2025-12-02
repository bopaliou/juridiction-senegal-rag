#!/bin/bash

# Script de démarrage pour Render
# Démarre le serveur FastAPI immédiatement
# Lance l'ingestion en arrière-plan si Chroma DB n'existe pas

echo "🚀 Démarrage de YoonAssist AI Backend..."

# Chemin vers la base de données Chroma (depuis la racine du projet)
CHROMA_DB_PATH="data/chroma_db"

# Vérifier si Chroma DB existe et lancer l'ingestion en arrière-plan si nécessaire
if [ ! -d "$CHROMA_DB_PATH" ] || [ -z "$(ls -A $CHROMA_DB_PATH 2>/dev/null)" ]; then
    echo "📚 Chroma DB introuvable ou vide. Lancement de l'ingestion en arrière-plan..."
    # Lancer l'ingestion en arrière-plan immédiatement (sans attendre)
    python -u src/ingestion.py > ingestion.log 2>&1 &
    INGESTION_PID=$!
    echo "✅ Ingestion lancée en arrière-plan (PID: $INGESTION_PID)"
    echo "📝 Les logs d'ingestion seront disponibles dans ingestion.log"
else
    echo "✅ Chroma DB trouvée. Pas besoin d'ingestion."
fi

# Démarrer le serveur FastAPI immédiatement (sans attendre l'ingestion)
# Render définit automatiquement la variable PORT
PORT=${PORT:-8000}
echo "🌐 Démarrage du serveur FastAPI sur le port $PORT..."
echo "📍 Répertoire de travail: $(pwd)"

# Utiliser exec pour que uvicorn remplace le processus shell
# Cela permet à Render de gérer correctement le processus
exec uvicorn src.server:app --host 0.0.0.0 --port $PORT

