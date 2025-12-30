# 🚀 Alternatives de Déploiement (512MB RAM insuffisant)

## 📊 Comparaison des Plateformes

| Plateforme | RAM Gratuit | CPU | Disque | Démarrage Froid | Coût Upgrade |
|---|---|---|---|---|---|
| **Render** | 512MB ❌ | 0.5 CPU | 1GB | ~30s | $7/mois |
| **Railway** | ~1GB ✅ | 1 CPU | 10GB | ~5s | Gratuit (inclus) |
| **Fly.io** | 256MB | 1 CPU partagé | Inclus | ~10s | Gratuit |
| **Heroku** | ❌ PAYANT | - | - | - | $25/mois min |
| **Hugging Face Spaces** | 2GB ✅ | Inclus | Inclus | ~5s | **GRATUIT** |
| **PythonAnywhere** | 512MB | Limité | 512MB | N/A | $5/mois |
| **Replit** | 1GB ✅ | 1 CPU | 5GB | ~10s | Gratuit |
| **Oracle Cloud** | 2GB gratuit ✅ | 1 OCPU | 100GB | N/A | Gratuit (1 an) |
| **Google Cloud Run** | Inclus | Auto-scale | Inclus | ~3s | Gratuit (2M req/mois) |

---

## ✨ TOP 3 RECOMMANDATIONS

### 1️⃣ **Hugging Face Spaces** ⭐ MEILLEUR CHOIX

**Pourquoi c'est parfait pour votre RAG:**
- ✅ 2GB RAM (vs 512MB Render)
- ✅ GRATUIT pour projets open-source
- ✅ Infrastructure ML optimisée
- ✅ Déploiement ultra-simple (git push)
- ✅ Zéro démarrage froid après 1ère requête

**Inconvénient:**
- ⚠️ Frontend + Backend ensemble (pas de séparation)
- ⚠️ Hibernation après 48h inactivité (gratuit)

**Setup (5 min):**
```bash
# 1. Créer space: https://huggingface.co/new-space
#    - Name: juridiction-senegal-rag
#    - SDK: Docker (ou Streamlit si vous voulez interface simple)

# 2. Pusher le code
git remote add hf https://huggingface.co/spaces/[username]/juridiction-senegal-rag
git push hf main

# 3. Configure env vars dans Settings → Secrets
#    - GROQ_API_KEY=xxx
#    - SUPABASE_URL=xxx
#    - SUPABASE_ANON_KEY=xxx
```

**Dockerfile pour Spaces:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copier les fichiers
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY data/chroma_db ./data/chroma_db

ENV GROQ_API_KEY=$GROQ_API_KEY
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# Backend + Frontend ensemble
CMD ["sh", "-c", "cd legal-rag-frontend && npm run build && npm start & uvicorn src.server:app --host 0.0.0.0 --port 8000"]
```

---

### 2️⃣ **Railway.app** ⭐⭐ MEILLEUR RATIO

**Pourquoi:**
- ✅ 1GB+ RAM (gratuit)
- ✅ UI très intuitive
- ✅ Base de données PostgreSQL gratuite
- ✅ Déploiement GitHub facile
- ✅ Scaling automatique

**Inconvénient:**
- ⚠️ Crédit de $5 (gratuit au départ, puis payant)

**Setup (3 min):**
```bash
# 1. Connecter GitHub repo à https://railway.app
# 2. Créer 2 services:
#    - Backend (Python)
#    - Frontend (Node.js)
# 3. Ajouter variables d'env

# C'est tout! Railway détecte automatiquement
```

---

### 3️⃣ **Google Cloud Run** ⭐⭐⭐ SCALABILITÉ

**Pourquoi:**
- ✅ Gratuit jusqu'à **2M requêtes/mois**
- ✅ Auto-scaling illimité
- ✅ Pas de démarrage froid après 10 min
- ✅ Pay-per-use (vous n'utilisez que ce que vous consommez)

**Inconvénient:**
- ⚠️ Nécessite compte Google Cloud + carte bancaire
- ⚠️ Setup plus complexe

---

## 🔧 ARCHITECTURE RECOMMANDÉE

### Option A: Hugging Face Spaces (PLUS SIMPLE)
```
juridiction-senegal-rag (Hugging Face Spaces)
├── Backend FastAPI (port 8000)
└── Frontend Next.js (port 3000)
└── Data: chroma_db
```

### Option B: Railway (MEILLEUR CONTRÔLE)
```
Backend Service (Railway)
├── FastAPI + uvicorn
├── ChromaDB
└── Python 3.11

Frontend Service (Railway)
├── Next.js
├── React 19
└── Node 20
```

### Option C: Google Cloud Run (PRODUCTION)
```
Cloud Run Service
├── Docker (Backend + Frontend)
├── Cloud SQL (PostgreSQL)
└── Cloud Storage (ChromaDB backup)
```

---

## 📋 PLAN D'ACTION

### Recommandation FINALE: **Railway.app**

**Raisons:**
1. ✅ Suffisamment de RAM (1GB)
2. ✅ Déploiement simple (connect GitHub)
3. ✅ Gratuit au démarrage
4. ✅ Architecture frontend/backend séparée
5. ✅ Pas besoin de modifier le code

**Étapes (10 min total):**

1. **Créer compte Railway:**
   ```
   https://railway.app → Sign up → GitHub
   ```

2. **Connecter votre repo:**
   ```
   New Project → Deploy from GitHub repo
   Sélectionner: juridiction-senegal-rag
   ```

3. **Créer 2 services:**

   **Service 1: Backend**
   ```
   - Root directory: /
   - Start command: 
     pip install -r requirements.txt && \
     uvicorn src.server:app --host 0.0.0.0 --port $PORT
   ```

   **Service 2: Frontend**
   ```
   - Root directory: legal-rag-frontend
   - Start command: npm install && npm run build && npm start
   - Port: 3000
   ```

4. **Variables d'environnement:**
   ```
   Backend:
   - GROQ_API_KEY=xxx
   - SUPABASE_URL=xxx
   - SUPABASE_ANON_KEY=xxx
   - SUPABASE_SERVICE_ROLE_KEY=xxx

   Frontend:
   - NEXT_PUBLIC_SUPABASE_URL=xxx
   - NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
   - NEXT_PUBLIC_API_URL=https://[backend-url]
   ```

5. **Deploy:**
   ```
   Railway détecte automatiquement et redéploie à chaque push
   ```

---

## 💰 COÛTS MENSUELS

| Plateforme | Gratuit | Minimum Payant |
|---|---|---|
| Hugging Face Spaces | ✅ | ✅ (gratuit indéfini) |
| Railway | 30 min gratuit | $5 après |
| Google Cloud Run | ✅ 2M req/mois | $0.25 par 1M req |
| Render | ❌ | $7/mois |
| Fly.io | ✅ | $11.50/mois |

---

## 🎯 CHOIX FINAL

**JE RECOMMANDE: Railway.app**

Raisons:
1. Meilleur équilibre **Coût ↔ Performance ↔ Facilité**
2. Suffisamment de RAM pour vos modèles ML
3. Déploiement GitHub ultra-simple
4. Support multi-service (backend + frontend séparés)
5. Base de données gratuite si besoin

Prêt à migrer vers Railway? 🚀
