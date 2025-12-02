# YoonAssist AI - Assistant Juridique Sénégalais RAG

Une application d'assistant juridique basée sur RAG (Retrieval-Augmented Generation) pour le droit sénégalais, utilisant LangChain, LangGraph, FastAPI et Next.js.

## 🎯 Fonctionnalités

- **Recherche intelligente** : Recherche sémantique dans les documents juridiques sénégalais
- **RAG avancé** : Utilisation de Chroma DB pour le stockage vectoriel et BGE Reranker pour améliorer la pertinence
- **Interface moderne** : Frontend Next.js avec Tailwind CSS, design responsive et moderne
- **Historique de conversation** : Gestion de l'historique des conversations avec checkpointer LangGraph
- **Questions suggérées** : Suggestions de questions de suivi basées sur le contexte juridique
- **Sources citées** : Affichage des sources juridiques utilisées pour chaque réponse

## 🏗️ Architecture

### Backend
- **FastAPI** : API REST pour les requêtes
- **LangChain/LangGraph** : Orchestration de l'agent RAG
- **Chroma DB** : Base de données vectorielle pour les embeddings
- **HuggingFace Embeddings** : Modèle `sentence-transformers/all-MiniLM-L6-v2`
- **BGE Reranker** : Reclassement des documents pour améliorer la pertinence
- **Groq** : LLM pour la génération de réponses (openai/gpt-oss-120b)

### Frontend
- **Next.js 14+** : Framework React avec App Router
- **TypeScript** : Typage statique
- **Tailwind CSS** : Styling utilitaire
- **Lucide React** : Icônes modernes

## 📚 Domaines juridiques couverts

- **Droit du Travail** : Code du Travail, congés payés, licenciement, etc.
- **Droit Pénal** : Code Pénal, procédure pénale, prescription
- **Droit Constitutionnel** : Constitution du Sénégal, droits fondamentaux
- **Droit Financier** : Budget, lois de finances, nomenclature budgétaire
- **Droit Administratif** : Fonction publique, organisation administrative
- **Collectivités Locales** : Code des collectivités locales
- **Aviation Civile** : Code de l'aviation civile

## 🚀 Installation

### Prérequis

- Python 3.13+
- Node.js 18+
- UV (gestionnaire de paquets Python)

### Backend

1. Installer les dépendances :
```bash
uv sync
```

2. Configurer les variables d'environnement :
```bash
cp .env.example .env
# Éditer .env et ajouter votre clé API Groq
```

3. Ingérer les documents :
```bash
uv run src/ingestion.py
```

4. Lancer le serveur FastAPI :
```bash
uvicorn src.server:app --reload
```

### Frontend

1. Aller dans le répertoire frontend :
```bash
cd legal-rag-frontend
```

2. Installer les dépendances :
```bash
npm install
```

3. Lancer le serveur de développement :
```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

## 📁 Structure du projet

```
juridiction-senegal-rag/
├── src/
│   ├── agent.py          # Agent LangGraph avec workflow RAG
│   ├── server.py         # API FastAPI
│   └── ingestion.py      # Script d'ingestion des documents
├── data/
│   ├── chroma_db/        # Base de données vectorielle Chroma
│   ├── droitsocial/      # Documents droit social
│   ├── droitpenal/       # Documents droit pénal
│   ├── finance/          # Documents finances
│   └── organisationadministration/ # Documents administration
├── legal-rag-frontend/   # Application Next.js
│   ├── app/
│   │   ├── page.tsx      # Page principale
│   │   └── layout.tsx    # Layout racine
│   └── components/
│       ├── Sidebar.tsx   # Barre latérale
│       ├── SuggestedQuestions.tsx # Questions suggérées
│       └── EmptyState.tsx # Écran d'accueil
└── README.md
```

## 🔧 Configuration

### Variables d'environnement

Créez un fichier `.env` à la racine du projet (voir `.env.example` pour la liste complète) :

```env
GROQ_API_KEY=votre_cle_api_groq
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Base de données Chroma

La base de données vectorielle est créée automatiquement lors de l'ingestion. Les documents PDF dans `data/` et les URLs configurées dans `src/ingestion.py` sont automatiquement chargés et vectorisés.

## 📝 Utilisation

1. Lancez le serveur FastAPI (backend)
2. Lancez le serveur Next.js (frontend)
3. Ouvrez `http://localhost:3000` dans votre navigateur
4. Posez vos questions juridiques dans l'interface

## 🚀 Déploiement

### Alternatives de Déploiement

Ce projet peut être déployé sur plusieurs plateformes. Consultez **[ALTERNATIVES_DEPLOIEMENT.md](ALTERNATIVES_DEPLOIEMENT.md)** pour une comparaison détaillée des alternatives gratuites et open source à Render.

**Recommandations** :
- **CapRover** (Open Source) : Sur VPS gratuit (Oracle Cloud Free Tier)
- **Fly.io** (Gratuit) : Déploiement cloud simple
- **Railway** (Gratuit) : Interface moderne avec crédits gratuits

### Déploiement sur Render

#### Prérequis

- Compte Render avec carte de crédit configurée
- Token API Render (disponible sur https://dashboard.render.com/account/api-keys)
- Repository GitHub avec le code

#### Architecture de déploiement

Le projet est déployé avec **deux services séparés** :

1. **Backend** : Web Service Python (FastAPI) avec Chroma DB persistant
2. **Frontend** : Static Site (Next.js) ou Web Service Node.js

### Étapes de déploiement

#### 1. Backend (Web Service Python)

1. Créer un nouveau Web Service sur Render
2. Configuration :
   - **Name** : `yoonassist-backend`
   - **Runtime** : `Python 3`
   - **Build Command** : `pip install -r requirements.txt`
   - **Start Command** : `chmod +x start.sh && ./start.sh`
   - **Repository** : `https://github.com/bopaliou/juridiction-senegal-rag.git`
   - **Branch** : `main`
   - **Plan** : `Starter` (ou supérieur)

3. Variables d'environnement :
   - `GROQ_API_KEY` : Votre clé API Groq
   - `ALLOWED_ORIGINS` : URL du frontend (à mettre à jour après déploiement frontend)
   - `PORT` : Automatiquement défini par Render

4. Le script `start.sh` vérifie automatiquement si Chroma DB existe et lance l'ingestion si nécessaire.

#### 2. Frontend (Static Site Next.js)

1. Créer un nouveau Static Site sur Render
2. Configuration :
   - **Name** : `yoonassist-frontend`
   - **Build Command** : `cd legal-rag-frontend && npm install && npm run build`
   - **Publish Directory** : `legal-rag-frontend/.next` (ou `legal-rag-frontend/out` si export statique)
   - **Repository** : `https://github.com/bopaliou/juridiction-senegal-rag.git`
   - **Branch** : `main`

3. Variables d'environnement :
   - `NEXT_PUBLIC_API_URL` : URL du backend Render (ex: `https://yoonassist-backend.onrender.com`)

#### 3. Configuration post-déploiement

Après le déploiement des deux services :

1. Récupérer l'URL du backend (ex: `https://yoonassist-backend.onrender.com`)
2. Récupérer l'URL du frontend (ex: `https://yoonassist-frontend.onrender.com`)
3. Mettre à jour `ALLOWED_ORIGINS` du backend avec l'URL du frontend
4. Mettre à jour `NEXT_PUBLIC_API_URL` du frontend avec l'URL du backend
5. Redéployer les deux services

### Notes importantes

- **Chroma DB** : Persiste dans `data/chroma_db` sur le disque local du service backend
- **Port** : Render définit automatiquement la variable `PORT`, le script `start.sh` l'utilise
- **CORS** : Configuré via `ALLOWED_ORIGINS` (doit inclure l'URL du frontend)
- **Ingestion** : Se lance automatiquement au premier démarrage si Chroma DB n'existe pas

## 🛠️ Technologies utilisées

- **LangChain** : Framework pour applications LLM
- **LangGraph** : Création de workflows d'agents
- **Chroma DB** : Base de données vectorielle
- **FastAPI** : Framework web Python
- **Next.js** : Framework React
- **Tailwind CSS** : Framework CSS
- **Groq** : API LLM rapide
- **HuggingFace** : Modèles d'embeddings et reranking

## 📄 Licence

Ce projet est sous licence MIT.

## 👥 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

