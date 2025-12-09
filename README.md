# YoonAssist AI - Assistant Juridique Sénégalais RAG

Assistant juridique intelligent basé sur RAG (Retrieval-Augmented Generation) pour le droit sénégalais. Application complète avec authentification Supabase (email/mot de passe), interface moderne et API sécurisée/optimisée.

## 🎯 Fonctionnalités

- **Recherche intelligente** : Recherche sémantique dans les documents juridiques sénégalais
- **RAG avancé** : ChromaDB pour le stockage vectoriel et FlashRank pour le reranking
- **Interface moderne** : Next.js 16 (App Router) + Tailwind, logo mis en avant, fond contextualisé
- **Authentification** : Supabase (email/mot de passe), redirections protégées, erreurs traduites en français (Google OAuth retiré)
- **Historique de conversation** : Gestion de l'historique avec localStorage (écritures débouncées)
- **Questions suggérées** : Suggestions de questions de suivi basées sur le contexte
- **Sources citées** : Affichage des sources juridiques utilisées pour chaque réponse
- **Sécurité** : Headers de sécurité, rate limiting, validation des entrées

## 🏗️ Architecture

### Backend (FastAPI)
- **FastAPI** : API REST sécurisée
- **LangChain/LangGraph** : Orchestration de l'agent RAG
- **ChromaDB** : Base de données vectorielle persistante
- **HuggingFace Embeddings** : Modèle `paraphrase-multilingual-MiniLM-L12-v2`
- **FlashRank** : Reranking des documents pour améliorer la pertinence
- **Groq** : LLM génération (llama-3.3-70b-versatile) + routeur rapide (llama-3.1-8b-instant)
- **Sécurité** : Rate limiting, validation, sanitization, headers HTTP

### Frontend (Next.js 16)
- **Next.js 16** : App Router, compression activée, headers de sécurité
- **TypeScript / Tailwind** : Typage statique et UI utilitaire
- **Supabase SSR** : Sessions côté serveur, middleware de protection, reset password corrigé
- **Optimisations** : React.memo, debouncing localStorage, design des cartes sources (typo, listes, overlay, hover)

## 📚 Domaines juridiques couverts

- **Droit du Travail** : Code du Travail, congés payés, licenciement, salaires
- **Droit Pénal** : Code Pénal, procédure pénale, sanctions
- **Droit Constitutionnel** : Constitution du Sénégal, droits fondamentaux
- **Collectivités Locales** : Code des collectivités locales
- **Aviation Civile** : Code de l'aviation civile

## 🚀 Installation et Configuration

### Prérequis

- Python 3.11+
- Node.js 18+
- UV (gestionnaire de paquets Python)
- Compte Supabase (pour l'authentification)

### ⚙️ Configuration rapide

#### Pour le développement local

1. **Configuration automatique** :
```bash
cd legal-rag-frontend
npm run setup:local
```

2. **Configuration manuelle** :
```bash
# Copier le fichier d'exemple
cp env.example .env.local

# Éditer avec vos vraies valeurs
nano .env.local
```

**Variables requises pour .env.local** :
```env
# Supabase (obligatoire)
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon

# URLs locales (par défaut)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend

1. **Installer les dépendances** :
```bash
uv sync
```

2. **Configurer les variables d'environnement** :
```bash
cp .env.example .env
# Éditer .env et ajouter :
# - GROQ_API_KEY
# - ALLOWED_ORIGINS
```

3. **Ingérer les documents** :
```bash
uv run src/ingestion.py
```

4. **Lancer le serveur** :
```bash
uvicorn src.server:app --reload
```

### Frontend

1. **Aller dans le répertoire** :
```bash
cd legal-rag-frontend
```

2. **Installer les dépendances** :
```bash
npm install
```

3. **Configurer Supabase** :
```bash
# Créer .env.local avec :
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

4. **Lancer le serveur de développement** :
```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

## 📁 Structure du projet

```
juridiction-senegal-rag/
├── src/
│   ├── agent.py          # Agent LangGraph avec workflow RAG
│   ├── server.py         # API FastAPI avec sécurité
│   ├── ingestion.py      # Script d'ingestion des documents
│   ├── security.py       # Validation et rate limiting
│   └── middleware.py     # Middlewares de sécurité
├── data/
│   ├── chroma_db/        # Base de données vectorielle
│   ├── droitsocial/      # Documents droit social
│   └── droitpenal/       # Documents droit pénal
├── legal-rag-frontend/   # Application Next.js
│   ├── app/              # Pages et routes
│   ├── components/       # Composants React
│   ├── lib/              # Utilitaires et API
│   └── public/           # Assets statiques
├── deploy/               # Scripts de déploiement Linode
└── README.md
```

## 🔧 Configuration

### Variables d'environnement Backend

```env
GROQ_API_KEY=votre_cle_api_groq
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
REQUEST_TIMEOUT=90
# Optionnel : nombre de workers threadpool
MAX_WORKERS=4
```

### Variables d'environnement Frontend

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Configuration Supabase

Voir `legal-rag-frontend/CONFIGURATION_SUPABASE.md` pour la configuration complète.

## 🚀 Déploiement

### 🔄 Déploiement automatique sur Linode

#### Depuis votre poste de développement

1. **Push des changements** :
```bash
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push origin main
```

2. **Déploiement sur Linode** :
```bash
# Se connecter à Linode
ssh root@172.233.114.185

# Mise à jour automatique
cd /opt/yoonassist
sudo -u yoonassist git pull origin main

# Configuration production (si nécessaire)
cd legal-rag-frontend
sudo -u yoonassist npm run setup:production

# Redémarrage des services
sudo systemctl restart yoonassist-backend
sudo systemctl restart yoonassist-frontend

# Vérification
sudo systemctl status yoonassist-frontend
sudo systemctl status yoonassist-backend
```

#### Configuration production automatique

Le script `setup:production` configure automatiquement :
- Variables d'environnement pour Linode
- URLs de production (`http://172.233.114.185`)
- Build optimisé pour la production

#### Variables d'environnement production

```env
# Configuration Supabase (inchangée)
NEXT_PUBLIC_SUPABASE_URL=https://uaordlnuhjowjtdiknfh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# URLs de production
NEXT_PUBLIC_SITE_URL=http://172.233.114.185
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### Services systemd

- `yoonassist-backend.service` : Service backend FastAPI
- `yoonassist-frontend.service` : Service frontend Next.js

### Nginx

Configuration Nginx disponible dans `deploy/nginx-yoonassist.conf`

### 🔍 Vérification du déploiement

Après déploiement, vérifiez :
- ✅ `http://172.233.114.185` - Page d'accueil
- ✅ `http://172.233.114.185/login` - Authentification
- ✅ `http://172.233.114.185/pricing` - Page tarification
- ✅ API backend : `curl http://127.0.0.1:8000/docs`

## 🛠️ Technologies utilisées

### Backend
- **LangChain/LangGraph** : Framework pour applications LLM
- **ChromaDB** : Base de données vectorielle
- **FastAPI** : Framework web Python moderne
- **Groq** : API LLM rapide
- **HuggingFace** : Modèles d'embeddings et reranking

### Frontend
- **Next.js 16** : App Router, compression, headers sécurité
- **TypeScript / Tailwind** : UI moderne
- **Supabase** : Auth email/mot de passe (Google retiré), messages d’erreur traduits
- **Lucide React** : Icônes

### Points UX récents
- Logo plus lisible (fond blanc, bordure, ombre)
- Pages auth centrées sur fond `senegal_droit.jpg` avec overlay discret
- Cartes de sources retravaillées (listes, titres, gradient, hover), comptage fiable (doublons filtrés)

## 🔒 Sécurité

- **Headers HTTP** : CSP, HSTS, X-Frame-Options, Referrer-Policy, etc.
- **Rate Limiting** : LRU cache thread-safe (100 req/min/IP) + cleanup
- **Validation/Sanitization** : Entrées nettoyées côté front & back
- **Authentification** : Supabase SSR, routes protégées, reset password vérifié

## 📊 Optimisations

- **Frontend** : Debounce localStorage, compression, images optimisées, typographie des sources
- **Backend** : Moins de docs (k=6, top 3 rerank), contexte 400 chars, historique réduit, timeouts abaissés
- **Cache/CPU** : LRU rate limiting mémoire bornée, MAX_WORKERS configurable
- **Logging** : Uniquement requêtes lentes (>1s) ou erreurs, ignore OPTIONS

Voir `legal-rag-frontend/OPTIMISATIONS.md` et `src/OPTIMISATIONS.md` pour plus de détails.

## 📚 Documentation utile

- `legal-rag-frontend/CONFIGURATION_SUPABASE.md` : setup Supabase (URLs, callbacks, variables)
- `legal-rag-frontend/OPTIMISATIONS.md` : perf/sécurité frontend
- `src/OPTIMISATIONS.md` : perf/sécurité backend
- `DEPLOIEMENT_LINODE.md` / `DEPLOIEMENT_LINODE_FIX.md` : procédures de déploiement Linode

## 📝 Utilisation

1. Lancez le serveur FastAPI (backend)
2. Lancez le serveur Next.js (frontend)
3. Ouvrez `http://localhost:3000` dans votre navigateur
4. Créez un compte ou connectez-vous
5. Posez vos questions juridiques dans l'interface

## 📄 Licence

Ce projet est sous licence MIT.

## 👥 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.
