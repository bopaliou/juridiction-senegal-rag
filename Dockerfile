FROM python:3.13-slim

WORKDIR /app

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copier les fichiers de dépendances
COPY requirements.txt pyproject.toml ./

# Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code source
COPY src/ ./src/
COPY start.sh ./
RUN chmod +x start.sh

# Créer le répertoire pour les données
RUN mkdir -p /app/data

# Exposer le port
EXPOSE 8000

# Variables d'environnement par défaut
ENV ENABLE_RERANKER=false

# Démarrer l'application
CMD ["./start.sh"]

