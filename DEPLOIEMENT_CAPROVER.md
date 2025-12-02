# Guide de Déploiement sur CapRover

## 🎯 CapRover - Plateforme Open Source Auto-hébergée

CapRover est une plateforme de déploiement open source que vous pouvez installer sur votre propre serveur. C'est l'alternative open source idéale à Render.

## 📋 Prérequis

1. **Serveur VPS** (recommandé : Oracle Cloud Free Tier)
   - 1GB RAM minimum (2GB recommandé)
   - Ubuntu 20.04+ ou Debian 11+
   - Accès root ou sudo

2. **Domaine** (optionnel, peut utiliser IP publique)

## 🚀 Installation de CapRover

### Étape 1 : Préparer le serveur

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker $USER
```

### Étape 2 : Installer CapRover

```bash
# Installer CapRover
docker run -p 80:80 -p 443:443 -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /captain:/captain \
  caprover/caprover
```

### Étape 3 : Configuration initiale

1. Accéder à `http://votre-ip:3000`
2. Créer un mot de passe admin
3. (Optionnel) Configurer un domaine :
   - Ajouter un enregistrement DNS A pointant vers votre IP
   - Configurer le domaine dans CapRover

## 📦 Déploiement de YoonAssist AI

### 1. Déployer le Backend

1. **Créer une nouvelle app** :
   - Nom : `yoonassist-backend`
   - Port : `8000`

2. **Connecter le dépôt GitHub** :
   - Repository : `bopaliou/juridiction-senegal-rag`
   - Branch : `main`
   - Dockerfile : Créer un `Dockerfile` pour le backend

3. **Variables d'environnement** :
   ```
   GROQ_API_KEY=votre_cle_api
   ALLOWED_ORIGINS=https://votre-frontend.caprover.domain
   ENABLE_RERANKER=false
   ```

4. **Volume persistant** (pour Chroma DB) :
   - Path : `/captain/data/yoonassist-backend/data`
   - Mount : `/app/data`

### 2. Déployer le Frontend

1. **Créer une nouvelle app** :
   - Nom : `yoonassist-frontend`
   - Port : `3000`

2. **Connecter le dépôt GitHub** :
   - Repository : `bopaliou/juridiction-senegal-rag`
   - Branch : `main`
   - Root Directory : `legal-rag-frontend`

3. **Variables d'environnement** :
   ```
   NEXT_PUBLIC_API_URL=https://yoonassist-backend.caprover.domain
   ```

## 🐳 Dockerfile pour le Backend

Créer un fichier `Dockerfile` à la racine du projet :

```dockerfile
FROM python:3.13-slim

WORKDIR /app

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    build-essential \
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

# Démarrer l'application
CMD ["./start.sh"]
```

## 🐳 Dockerfile pour le Frontend

Créer un fichier `legal-rag-frontend/Dockerfile` :

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
RUN npm ci

# Copier le code source
COPY . .

# Build l'application
RUN npm run build

# Stage de production
FROM node:18-alpine

WORKDIR /app

# Copier les fichiers nécessaires
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Exposer le port
EXPOSE 3000

# Démarrer l'application
CMD ["npm", "start"]
```

## 🔧 Configuration CapRover

### Activer HTTPS (SSL automatique)

1. Aller dans **Apps** > **HTTP Settings**
2. Activer **Force HTTPS by redirecting all HTTP traffic to HTTPS**
3. CapRover génère automatiquement les certificats SSL via Let's Encrypt

### Configurer les volumes persistants

Pour le backend, configurer un volume pour Chroma DB :
- **Volume Name** : `yoonassist-data`
- **Mount Path** : `/app/data`

## 📊 Avantages de CapRover

✅ **100% Open Source** : Contrôle total sur votre infrastructure
✅ **Gratuit** : Pas de coûts si vous utilisez un VPS gratuit
✅ **Pas de limite de mémoire** : Dépend uniquement de votre serveur
✅ **Interface web conviviale** : Gestion facile via l'interface
✅ **SSL automatique** : Certificats Let's Encrypt gratuits
✅ **Déploiement automatique** : Intégration GitHub/GitLab

## 🆚 Comparaison avec Render

| Fonctionnalité | Render | CapRover |
|----------------|--------|----------|
| Open Source | ❌ | ✅ |
| Gratuit | ⚠️ Limité (512MB) | ✅ (dépend du VPS) |
| Limite RAM | 512MB (starter) | Dépend du VPS |
| SSL | ✅ | ✅ |
| Interface web | ✅ | ✅ |
| Déploiement auto | ✅ | ✅ |
| Contrôle total | ❌ | ✅ |

## 🆘 Support

- **Documentation CapRover** : https://caprover.com/docs/
- **GitHub** : https://github.com/caprover/caprover
- **Discord** : https://discord.gg/caprover

