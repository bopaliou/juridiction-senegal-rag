# 🚀 Guide Déploiement Railway.app

Votre application sera déployée gratuitement sur Railway.app avec 1GB+ de RAM.

---

## 📋 PRÉ-REQUIS

✅ Compte GitHub (vous l'avez)
✅ Votre repo: `juridiction-senegal-rag` (vous l'avez)
✅ 10 minutes de temps

---

## 🎯 ÉTAPE 1: Créer Compte Railway

### 1.1 Ouvrir Railway
```
https://railway.app
```

### 1.2 Cliquer "Sign Up"
- Choisir: **GitHub** (c'est plus rapide)
- Autoriser Railway à accéder à vos repos

### 1.3 Créer nouveau projet
- Cliquer **"New Project"**
- Sélectionner: **"Deploy from GitHub repo"**
- Chercher: `juridiction-senegal-rag`
- Cliquer: **"Deploy"**

Railway va cloner votre repo et détecter automatiquement les services.

---

## 🔧 ÉTAPE 2: Configurer les Services

Railway va créer les services automatiquement. Vous devez les configurer:

### Service 1: BACKEND (FastAPI)

**Localisation dans Railway:**
1. Cliquer sur votre projet dans Railway
2. Onglet **"Services"** → Cliquer sur **"yoonassist-backend"** (ou créer s'il n'existe pas)

**Configuration:**
```
Name: yoonassist-backend
Root Directory: (laisser vide - racine du repo)

Settings → Build:
  Build Command: (laisser vide - auto-détecté)
  
Settings → Deploy:
  Start Command: 
    uvicorn src.server:app --host 0.0.0.0 --port $PORT
  
  Port: 8000
  Restart Policy: Always
```

### Service 2: FRONTEND (Next.js)

**Dans Railway:**
1. Onglet **"Services"** → Cliquer **"+"** 
2. Choisir: **"GitHub Repo"** → Même repo
3. Configurer:

```
Name: yoonassist-frontend
Root Directory: legal-rag-frontend

Settings → Build:
  Build Command: npm install && npm run build
  
Settings → Deploy:
  Start Command: npm start
  Port: 3000
  Restart Policy: Always
```

---

## 🔑 ÉTAPE 3: Ajouter Variables d'Environnement

**Backend (src/server.py):**

1. Dans Railway → Service: yoonassist-backend
2. Onglet **"Variables"**
3. Ajouter ces variables:

```
GROQ_API_KEY = your_groq_api_key_here
SUPABASE_URL = https://uaordlnuhjowjtdiknfh.supabase.co
SUPABASE_ANON_KEY = your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
ALLOWED_ORIGINS = https://yoonassist-frontend-xxx.railway.app
REQUEST_TIMEOUT = 60
MAX_WORKERS = 1
```

💡 **Où les trouver:**
- `GROQ_API_KEY`: Votre clé Groq (dans les secrets locaux)
- `SUPABASE_*`: Votre fichier `.env.local` (visible dans l'attachement)

**Frontend (legal-rag-frontend):**

1. Dans Railway → Service: yoonassist-frontend
2. Onglet **"Variables"**
3. Ajouter:

```
NEXT_PUBLIC_SUPABASE_URL = https://uaordlnuhjowjtdiknfh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = your_supabase_anon_key
NEXT_PUBLIC_API_URL = https://yoonassist-backend-xxx.railway.app
NEXT_PUBLIC_SITE_URL = https://yoonassist-frontend-xxx.railway.app
NODE_ENV = production
```

💡 **Note importante:**
- Remplacer `xxx` par les URLs réelles que Railway va générer
- Railway affichera les URLs dans le dashboard après le déploiement

---

## 🚀 ÉTAPE 4: Déployer

### Option A: Depuis Railway (recommandé)

1. Railway détecte automatiquement vos changements GitHub
2. Chaque `git push origin main` redéploie automatiquement
3. Voir l'état du déploiement dans **"Deployments"** tab

### Option B: Manuellement

```bash
# Dans votre terminal VS Code:
cd c:\Users\serig\Desktop\AI\ai-projetcs\juridiction-senegal-rag

# Ajouter et committer les changements
git add .
git commit -m "🚀 Préparer déploiement Railway"

# Pousser
git push origin main
```

Railway va automatiquement déployer après le push!

---

## ⏳ ÉTAPE 5: Attendre le Déploiement

**Timeline:**
- Backend: ~2-3 minutes (installation dépendances Python)
- Frontend: ~1-2 minutes (build Next.js)
- **Total: 5-10 minutes**

Vous verrez dans Railway:
```
✅ Building...
✅ Deploying...
✅ Running
```

---

## 🧪 ÉTAPE 6: Tester l'Application

### Vérifier le backend
```
Aller à: https://yoonassist-backend-xxx.railway.app/health
Vous devriez voir: {"status": "ok"}
```

### Vérifier le frontend
```
Aller à: https://yoonassist-frontend-xxx.railway.app
Vous devriez voir: Votre application!
```

### Tester une requête
```bash
curl -X POST https://yoonassist-backend-xxx.railway.app/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Quel est le salaire minimum au Sénégal?",
    "user_id": "test@test.com"
  }'
```

---

## 📊 Monitoring

### Voir les logs
1. Railway dashboard → Service
2. Onglet **"Logs"**
3. Vous verrez tous les logs en temps réel

### Voir la consommation
1. Railway dashboard → Service
2. Onglet **"Metrics"**
3. Voir: CPU, Mémoire, Requêtes

---

## 💡 Tips Railway

### 1. Variables d'env: Référencer les URLs automatiques

Railway génère automatiquement les URLs. Vous pouvez les utiliser dans d'autres services:

```
NEXT_PUBLIC_API_URL = ${{ services.yoonassist-backend.url }}
```

Railway remplace automatiquement `${{ ... }}` par l'URL réelle!

### 2. Logs en streaming

```bash
# Terminal pour suivre logs en live:
railway logs -s yoonassist-backend --follow
```

### 3. Redéployer manuellement

Si quelque chose ne marche pas:
```bash
railway redeploy -s yoonassist-backend
```

### 4. Voir les variables d'env

```bash
railway variables -s yoonassist-backend
```

---

## 🐛 Troubleshooting

### ❌ "Build failed"
**Solution:**
1. Voir les logs: Railway → Logs
2. Chercher l'erreur (souvent: dépendances manquantes)
3. Corriger dans `requirements.txt` ou `package.json`
4. Faire `git push` → Railway redéploie

### ❌ "Service not running"
**Solution:**
1. Voir les logs pour l'erreur
2. Vérifier les variables d'env sont bien configurées
3. Redéployer: `railway redeploy -s yoonassist-backend`

### ❌ "Connection timeout"
**Solution:**
1. Vérifier que le port est correct (8000 backend, 3000 frontend)
2. Vérifier que le service écoute sur `0.0.0.0` (pas `localhost`)

### ❌ "Out of memory"
**Solution:**
Cela NE DEVRAIT PAS arriver sur Railway (1GB+ RAM)
Si c'est le cas, augmenter: Railway Settings → Plan → Pro

---

## ✨ Après le Déploiement

### Mettre à jour ALLOWED_ORIGINS

Maintenant que vous avez l'URL du frontend, mettez à jour dans Railway:

```
Backend Variables → ALLOWED_ORIGINS = https://yoonassist-frontend-xxx.railway.app
```

### Ou dans le code
Éditer [src/server.py](src/server.py#L70):
```python
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "https://yoonassist-frontend-xxx.railway.app"
).split(",")
```

### Tester CORS
```bash
curl -X POST https://yoonassist-backend-xxx.railway.app/query \
  -H "Origin: https://yoonassist-frontend-xxx.railway.app" \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
```

---

## 🎉 Vous Avez Réussi!

Votre application est maintenant:
- ✅ Déployée sur Railway
- ✅ Avec 1GB+ de RAM
- ✅ Auto-scaling
- ✅ Gratuite (au démarrage)
- ✅ Mise à jour automatique (git push = redeploy)

---

## 📞 Besoin d'aide?

- Railway Docs: https://docs.railway.app
- Status: https://status.railway.app
- Communauté Discord: https://discord.gg/railway
