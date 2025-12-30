# 🏛️ YoonAssist - Agent Juridique IA Sénégal

Application **RAG (Retrieval-Augmented Generation)** pour répondre à des questions juridiques sur le droit sénégalais avec sources et citations précises.

## ✨ Fonctionnalités principales

✅ **RAG Intelligent** - Réponses basées sur documents juridiques réels  
✅ **Sources citées** - Chaque réponse inclut les sources utilisées  
✅ **Questions suggérées** - Générées dynamiquement basées sur le contenu  
✅ **Authentification** - Via Supabase (email/mot de passe)  
✅ **Historique** - Conversations sauvegardées localement  
✅ **Responsive Design** - Mobile, tablette, desktop  

## 🚀 Déploiement sur Render (5 minutes)

### Étape 1: Prérequis
- Compte GitHub (ce repository)
- Compte Render gratuit ([render.com](https://render.com))
- Clés API :
  - `GROQ_API_KEY` (Groq)
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Étape 2: Déployer
1. Allez sur [render.com/dashboard](https://render.com/dashboard)
2. Cliquez **"New +"** → **"Blueprint"**
3. Sélectionnez ce repository
4. Render détecte `render.yaml` automatiquement
5. Configurez les variables d'environnement (voir prérequis)
6. Cliquez **"Apply"**
7. Attendez 15-20 minutes ✅

**Résultat** :
- Backend: `https://yoonassist-backend-xxx.onrender.com`
- Frontend: `https://yoonassist-frontend-xxx.onrender.com`

[📖 Guide détaillé: DEPLOIEMENT_RENDER.md](./DEPLOIEMENT_RENDER.md)

## 🛠️ Développement local

### Backend
```bash
pip install -r requirements.txt
uvicorn src.server:app --reload --host 127.0.0.1 --port 8000
```

### Frontend
```bash
cd legal-rag-frontend
npm install
npm run dev
# → http://127.0.0.1:3000
```

## 🏗️ Architecture

```
Backend (FastAPI):
├─ Agent RAG (LangGraph)
├─ ChromaDB (base vectorielle)
├─ Groq LLM (génération)
└─ Supabase (crédits)

Frontend (Next.js):
├─ App Router
├─ React 19
├─ Supabase Auth
└─ Tailwind CSS
```

## 📁 Structure du projet

```
src/
├── server.py         # API FastAPI + routes
├── agent.py          # Agent RAG + LLM
├── ingestion.py      # Chargement docs PDF
├── security.py       # Validation
├── middleware.py     # CORS, rate limit
├── auth/             # Auth logic
├── credits/          # Système crédits
└── database/         # BD connection

legal-rag-frontend/
├── app/              # Pages Next.js
├── components/       # Composants React
├── lib/              # Utilitaires
└── public/           # Assets

data/
└── chroma_db/        # Base vecteurs
```

## 🔑 Variables d'environnement

**Backend** (`.env`) :
```env
GROQ_API_KEY=gsk_...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
REQUEST_TIMEOUT=60
```

**Frontend** (`.env.local`) :
```env
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000  # Adapter en production
```

## 📊 Domaines couverts

- 📋 **Code du Travail** (congés, salaires, licenciement)
- ⚖️ **Droit Pénal** (infractions, sanctions)
- 🏛️ **Constitution** (droits, gouvernement)
- 🏘️ **Collectivités Locales**
- ✈️ **Aviation Civile**

## 🐛 Dépannage

| Problème | Solution |
|----------|----------|
| Backend ne démarre pas | Vérifier `GROQ_API_KEY` |
| Frontend ne se connecte pas | Vérifier `NEXT_PUBLIC_API_URL` |
| "Service Unavailable" (Render) | Normal sur plan free (mise en veille après 15min) |
| Réponses lentes | Le modèle ML charge au 1er appel |

## 📈 Performance

- **Taille** : ~150MB (incl. ChromaDB)
- **Démarrage** : <30s (local), ~60s (Render free)
- **Réponse** : 1-2s (Groq API inclus)
- **Mémoire** : 400MB (optimisé pour 512MB Render)

## 🔗 Ressources

- [Render Docs](https://render.com/docs)
- [LangChain Docs](https://python.langchain.com/)
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)

---

**Made with ❤️ for Senegal's legal system**
