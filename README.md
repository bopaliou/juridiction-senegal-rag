# YoonAssist AI - Assistant Juridique Sénégalais RAG

Assistant juridique intelligent basé sur RAG (Retrieval-Augmented Generation) pour le droit sénégalais. Application complète avec authentification, interface moderne et API sécurisée.

## 🎯 Fonctionnalités

- **Recherche intelligente** : Recherche sémantique dans les documents juridiques sénégalais
- **RAG avancé** : ChromaDB pour le stockage vectoriel et FlashRank pour le reranking
- **Interface moderne** : Frontend Next.js 16 avec design responsive
- **Authentification** : Système d'authentification complet avec Supabase (email/password)
- **Historique de conversation** : Gestion de l'historique avec localStorage
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
- **Groq** : LLM pour la génération (llama-3.3-70b-versatile)
- **Sécurité** : Rate limiting, validation, sanitization, headers HTTP

### Frontend (Next.js 16)
- **Next.js 16** : Framework React avec App Router
- **TypeScript** : Typage statique complet
- **Tailwind CSS** : Styling utilitaire moderne
- **Supabase** : Authentification et gestion des sessions
- **Optimisations** : React.memo, debouncing, compression

## 📚 Domaines juridiques couverts

- **Droit du Travail** : Code du Travail, congés payés, licenciement, salaires
- **Droit Pénal** : Code Pénal, procédure pénale, sanctions
- **Droit Constitutionnel** : Constitution du Sénégal, droits fondamentaux
- **Collectivités Locales** : Code des collectivités locales
- **Aviation Civile** : Code de l'aviation civile

## 🚀 Installation

### Prérequis

- Python 3.11+
- Node.js 18+
- UV (gestionnaire de paquets Python)
- Compte Supabase (pour l'authentification)

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
REQUEST_TIMEOUT=120
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

### Déploiement sur Linode

Voir `DEPLOIEMENT_LINODE.md` pour les instructions complètes de déploiement.

### Services systemd

- `yoonassist-backend.service` : Service backend FastAPI
- `yoonassist-frontend.service` : Service frontend Next.js

### Nginx

Configuration Nginx disponible dans `deploy/nginx-yoonassist.conf`

## 🛠️ Technologies utilisées

### Backend
- **LangChain/LangGraph** : Framework pour applications LLM
- **ChromaDB** : Base de données vectorielle
- **FastAPI** : Framework web Python moderne
- **Groq** : API LLM rapide
- **HuggingFace** : Modèles d'embeddings et reranking

### Frontend
- **Next.js 16** : Framework React avec App Router
- **TypeScript** : Typage statique
- **Tailwind CSS** : Framework CSS utilitaire
- **Supabase** : Authentification et backend
- **Lucide React** : Icônes modernes

## 🔒 Sécurité

- **Headers HTTP** : Security headers complets (CSP, HSTS, X-Frame-Options, etc.)
- **Rate Limiting** : Protection contre les abus (100 req/min par IP)
- **Validation** : Validation stricte des entrées utilisateur
- **Sanitization** : Protection contre XSS et injections
- **Authentification** : Système d'authentification sécurisé avec Supabase

## 📊 Optimisations

- **Performance** : React.memo, debouncing, compression GZip
- **Mémoire** : Garbage collection optimisé, lazy loading
- **Cache** : LRU cache pour rate limiting
- **Logging** : Logging optimisé (uniquement requêtes lentes/erreurs)

Voir `legal-rag-frontend/OPTIMISATIONS.md` et `src/OPTIMISATIONS.md` pour plus de détails.

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
