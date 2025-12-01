# Assistant Juridique Sénégalais RAG

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
- **Groq** : LLM pour la génération de réponses (Llama 3.1 8B)

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

Créez un fichier `.env` à la racine du projet :

```env
GROQ_API_KEY=votre_cle_api_groq
```

### Base de données Chroma

La base de données vectorielle est créée automatiquement lors de l'ingestion. Les documents PDF dans `data/` et les URLs configurées dans `src/ingestion.py` sont automatiquement chargés et vectorisés.

## 📝 Utilisation

1. Lancez le serveur FastAPI (backend)
2. Lancez le serveur Next.js (frontend)
3. Ouvrez `http://localhost:3000` dans votre navigateur
4. Posez vos questions juridiques dans l'interface

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

