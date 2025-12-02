# Guide de Déploiement sur Railway

## 🚂 Railway - Plateforme Cloud Moderne

Railway est une plateforme cloud moderne qui offre un plan gratuit avec $5 de crédits par mois, idéale pour déployer rapidement des applications.

## 📋 Prérequis

1. **Compte Railway** : Créer un compte sur https://railway.app/
2. **Compte GitHub** : Repository avec le code
3. **Carte de crédit** : Requise pour activer le compte (mais le plan gratuit est disponible)

## 🚀 Déploiement du Backend

### Étape 1 : Créer un nouveau projet

1. Aller sur https://railway.app/
2. Cliquer sur **"New Project"**
3. Sélectionner **"Deploy from GitHub repo"**
4. Choisir le repository `bopaliou/juridiction-senegal-rag`

### Étape 2 : Configurer le service Backend

1. Railway détecte automatiquement le projet
2. Créer un nouveau service : **"New Service"** > **"GitHub Repo"**
3. Sélectionner le repository

### Étape 3 : Configuration du service

Railway détecte automatiquement Python. Configurer :

**Build Settings** :
- **Build Command** : `pip install -r requirements.txt`
- **Start Command** : `chmod +x start.sh && ./start.sh`

**Variables d'environnement** :
```
GROQ_API_KEY=votre_cle_api_groq
ALLOWED_ORIGINS=https://votre-frontend.up.railway.app
ENABLE_RERANKER=false
PORT=8000
```

**Settings** :
- **Root Directory** : `/` (racine du projet)
- **Healthcheck Path** : `/health` (optionnel)

### Étape 4 : Configurer le volume persistant (Chroma DB)

1. Aller dans **Settings** > **Volumes**
2. Créer un nouveau volume :
   - **Mount Path** : `/app/data`
   - **Name** : `chroma-db`

Cela permet de persister la base de données Chroma entre les redéploiements.

## 🎨 Déploiement du Frontend

### Étape 1 : Créer un nouveau service

1. Dans le même projet Railway, cliquer sur **"New Service"**
2. Sélectionner **"GitHub Repo"** (même repository)
3. Railway détectera automatiquement Next.js

### Étape 2 : Configuration du service Frontend

**Build Settings** :
- **Root Directory** : `legal-rag-frontend`
- **Build Command** : `npm install && npm run build`
- **Start Command** : `npm start`

**Variables d'environnement** :
```
NEXT_PUBLIC_API_URL=https://votre-backend.up.railway.app
NODE_ENV=production
```

**Settings** :
- **Port** : `3000` (défini automatiquement par Railway)

## 🔧 Configuration Post-Déploiement

### 1. Récupérer les URLs

Après le déploiement, Railway génère automatiquement des URLs :
- Backend : `https://votre-backend.up.railway.app`
- Frontend : `https://votre-frontend.up.railway.app`

### 2. Mettre à jour les variables d'environnement

**Backend** :
- Mettre à jour `ALLOWED_ORIGINS` avec l'URL du frontend

**Frontend** :
- Mettre à jour `NEXT_PUBLIC_API_URL` avec l'URL du backend

### 3. Redéployer

Railway redéploie automatiquement après chaque changement de variables d'environnement.

## 📊 Gestion des Ressources

### Plan Gratuit

- **$5 de crédits gratuits par mois**
- **512MB RAM** par défaut (peut être augmenté)
- **Pas de limite de CPU** (mais consommation de crédits)
- **Volume persistant** : 1GB gratuit

### Monitoring

Railway fournit :
- **Logs en temps réel** : Accessibles dans l'interface
- **Métriques** : CPU, RAM, réseau
- **Alertes** : Notifications en cas de problème

## 🔄 Déploiement Automatique

Railway déploie automatiquement :
- À chaque push sur la branche `main`
- Lors de changements de variables d'environnement
- Lors de modifications de configuration

## 🐳 Utilisation de Docker (Optionnel)

Si Railway ne détecte pas automatiquement le langage, vous pouvez utiliser Docker :

### Backend Dockerfile

Le fichier `Dockerfile` à la racine sera utilisé automatiquement.

### Frontend Dockerfile

Le fichier `legal-rag-frontend/Dockerfile` sera utilisé si Railway détecte Docker.

## ⚙️ Configuration Avancée

### Railway.toml (Optionnel)

Créer un fichier `railway.toml` à la racine pour une configuration avancée :

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "chmod +x start.sh && ./start.sh"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### Variables d'environnement par service

Chaque service peut avoir ses propres variables d'environnement dans Railway.

## 💰 Estimation des Coûts

### Plan Gratuit

- **Backend** : ~$2-3/mois (selon utilisation)
- **Frontend** : ~$1-2/mois
- **Total** : ~$3-5/mois (dans la limite des crédits gratuits)

Si vous dépassez les crédits gratuits, Railway facture à l'usage :
- **$0.000463/GB-seconde** de RAM
- **$0.000231/GB-seconde** de CPU

## 🆚 Avantages de Railway

✅ **Déploiement automatique** depuis GitHub
✅ **Interface moderne** et intuitive
✅ **Logs en temps réel**
✅ **Métriques détaillées**
✅ **SSL automatique**
✅ **Volumes persistants**
✅ **Plan gratuit généreux**

## 🆚 Inconvénients

⚠️ **Pas open source** (mais gratuit)
⚠️ **Limite de crédits** (peut nécessiter un upgrade)
⚠️ **Moins de contrôle** que CapRover

## 🆘 Support

- **Documentation** : https://docs.railway.app/
- **Discord** : https://discord.gg/railway
- **GitHub** : https://github.com/railwayapp

## 📝 Checklist de Déploiement

- [ ] Créer un compte Railway
- [ ] Connecter le repository GitHub
- [ ] Créer le service Backend
- [ ] Configurer les variables d'environnement Backend
- [ ] Créer le volume persistant pour Chroma DB
- [ ] Créer le service Frontend
- [ ] Configurer les variables d'environnement Frontend
- [ ] Récupérer les URLs des services
- [ ] Mettre à jour `ALLOWED_ORIGINS` avec l'URL frontend
- [ ] Mettre à jour `NEXT_PUBLIC_API_URL` avec l'URL backend
- [ ] Tester l'application

## 🔍 Dépannage

### Problème : Build échoue

- Vérifier les logs dans Railway
- Vérifier que `requirements.txt` est à jour
- Vérifier que `start.sh` est exécutable

### Problème : Out of memory

- Augmenter la RAM dans les settings du service
- Désactiver le reranker (`ENABLE_RERANKER=false`)
- Optimiser les dépendances

### Problème : Chroma DB ne persiste pas

- Vérifier que le volume est monté correctement
- Vérifier le chemin dans `start.sh` et `src/ingestion.py`

