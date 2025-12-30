# 🚀 Google Cloud Deployment - Guide Complet

Déployez gratuitement sur Google Cloud Platform!

---

## 📊 COMPARAISON OPTIONS GOOGLE CLOUD

| Option | RAM | CPU | Coût | Gratuit | Setup |
|--------|-----|-----|------|---------|-------|
| **Cloud Run** | 1-8GB | 0.5-4 | $0.40/mois* | 2M req/mois ✅ | 5 min |
| **App Engine** | 512MB-2GB | 1 | $5-50/mois | Limité | 10 min |
| **Compute Engine** | Illimité | Illimité | $5+/mois | Free tier | 15 min |
| **Firebase Hosting** | N/A | N/A | $0 | ✅ Illimité | 3 min |

*Cloud Run: Vous ne payez que pour ce que vous utilisez (excellente valeur)

---

## 🎯 TOP 3 RECOMMANDATIONS

### 1️⃣ **Google Cloud Run (Backend) + Firebase Hosting (Frontend)** ⭐⭐⭐ RECOMMANDÉ

**Meilleur choix pour RAG + peu budget**

**Coûts:**
- Backend (Cloud Run): $0.40/mois (2M requêtes gratuites/mois!)
- Frontend (Firebase Hosting): **$0 GRATUIT** (illimité)
- **Total: Pratiquement GRATUIT**

**Architecture:**
```
Frontend (Firebase Hosting)
├── URL: https://yoonassist-web.web.app
├── CDN global
└── Gratuit

Backend (Cloud Run)
├── URL: https://yoonassist-backend-xxx-uc.a.run.app
├── Auto-scaling
├── Serverless
└── $0.40/mois (2M req gratuites)

Database (Supabase)
├── Déjà configuré
└── $25/mois
```

**Avantages:**
- ✅ Frontend GRATUIT
- ✅ Backend ultra-cheap ($0.40/mois)
- ✅ Auto-scaling parfait
- ✅ Pas de démarrage froid après 2 min
- ✅ Zéro gestion d'infra
- ✅ Logs en temps réel

**Setup: 10 min total**

---

### 2️⃣ **App Engine Standard (Backend + Frontend ensemble)** ⭐⭐

**Plus simple (une seule app)**

**Coûts:**
- Gratuit: Jusqu'à 28h/jour d'une instance f1-micro
- Après: $5-50/mois selon usage
- **Total: $0-50/mois**

**Avantages:**
- ✅ Très simple
- ✅ Git-connected
- ✅ Free tier existe
- ✅ Scaling automatique

**Inconvénient:**
- ⚠️ Moins cher que Cloud Run si peu usage
- ⚠️ Moins flexible

---

### 3️⃣ **Compute Engine (Contrôle total)** ⭐

**Pour apprenants**

**Coûts:**
- Free tier: 1 instance e2-micro gratuite
- Setup complexe: SSH, nginx, PM2

---

## ✨ CHOIX FINAL: Cloud Run + Firebase Hosting

**Pourquoi c'est parfait:**
1. ✅ **Frontend GRATUIT** sur Firebase
2. ✅ **Backend ultra-cheap** sur Cloud Run
3. ✅ **Auto-scaling** géré automatiquement
4. ✅ **Zéro ops** = zéro gestion infra
5. ✅ **Logs en temps réel** = debug facile
6. ✅ **Gratuit pour la plupart des cas d'usage**

---

## 🚀 GUIDE RAPIDE: Cloud Run + Firebase

### ÉTAPE 1: Créer un projet Google Cloud

```bash
# Option A: Via console web
1. Aller à: https://console.cloud.google.com
2. Cliquer: "Select a Project" → "New Project"
3. Name: juridiction-senegal-rag
4. Create!

# Option B: Via gcloud CLI
gcloud projects create juridiction-senegal-rag --set-as-default
```

### ÉTAPE 2: Activer les APIs

```bash
# Activer Cloud Run API
gcloud services enable run.googleapis.com

# Activer Firebase API
gcloud services enable firebase.googleapis.com

# Activer Container Registry
gcloud services enable containerregistry.googleapis.com

# Activer Cloud Build
gcloud services enable cloudbuild.googleapis.com
```

### ÉTAPE 3: Configurer gcloud CLI localement

```bash
# Installer gcloud CLI si pas encore: https://cloud.google.com/sdk/docs/install

# Se connecter
gcloud auth login

# Vérifier la config
gcloud config list
```

---

## 📦 PHASE 1: Déployer Backend sur Cloud Run

### Step 1: Build et push Docker image

```bash
# 1. Créer Artifact Registry (lieu de stockage des images)
gcloud artifacts repositories create docker-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker repository for juridiction-senegal-rag"

# 2. Configurer Docker authentication
gcloud auth configure-docker us-central1-docker.pkg.dev

# 3. Build l'image Docker
docker build -t us-central1-docker.pkg.dev/juridiction-senegal-rag/docker-repo/backend:latest .

# 4. Push vers Artifact Registry
docker push us-central1-docker.pkg.dev/juridiction-senegal-rag/docker-repo/backend:latest
```

### Step 2: Déployer sur Cloud Run

```bash
gcloud run deploy yoonassist-backend \
  --image us-central1-docker.pkg.dev/juridiction-senegal-rag/docker-repo/backend:latest \
  --platform managed \
  --region us-central1 \
  --port 8000 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 60 \
  --set-env-vars GROQ_API_KEY=your_key,SUPABASE_URL=https://uaordlnuhjowjtdiknfh.supabase.co,SUPABASE_ANON_KEY=your_key,SUPABASE_SERVICE_ROLE_KEY=your_key,ALLOWED_ORIGINS=https://yoonassist-web.web.app \
  --allow-unauthenticated
```

**Résultat:** 
```
Service URL: https://yoonassist-backend-xxx-uc.a.run.app ✅
```

### Step 3: Vérifier le déploiement

```bash
# Tester le health endpoint
curl https://yoonassist-backend-xxx-uc.a.run.app/health

# Voir les logs
gcloud run logs read yoonassist-backend --limit 50
```

---

## 🎨 PHASE 2: Déployer Frontend sur Firebase Hosting

### Step 1: Initialiser Firebase

```bash
# Installer Firebase CLI si pas encore
npm install -g firebase-tools

# Se connecter à Firebase
firebase login

# Initialiser le projet Firebase
cd legal-rag-frontend
firebase init hosting
```

Répondre aux questions:
```
? What do you want to use as your public directory? → .next
? Configure as a single-page app (rewrite all urls to /index.html)? → Y
? Set up automatic builds and deploys with GitHub? → Y (optionnel, ou manual deploy)
```

### Step 2: Build l'app

```bash
# Build Next.js pour production
npm run build
```

### Step 3: Configurer les variables d'environnement

Créer ou éditer `legal-rag-frontend/.env.production`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://uaordlnuhjowjtdiknfh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
NEXT_PUBLIC_API_URL=https://yoonassist-backend-xxx-uc.a.run.app
NEXT_PUBLIC_SITE_URL=https://yoonassist-web.web.app
NODE_ENV=production
```

### Step 4: Déployer

```bash
# Depuis le répertoire legal-rag-frontend
firebase deploy --only hosting

# Ou depuis la racine
firebase deploy -m "Production deployment" --only hosting
```

**Résultat:**
```
Hosting URL: https://yoonassist-web.web.app ✅
```

---

## 🔄 MISE À JOUR: Redéployer

### Backend (Cloud Run)
```bash
# Redéployer avec nouveau code
docker build -t us-central1-docker.pkg.dev/juridiction-senegal-rag/docker-repo/backend:latest .
docker push us-central1-docker.pkg.dev/juridiction-senegal-rag/docker-repo/backend:latest
gcloud run deploy yoonassist-backend --image us-central1-docker.pkg.dev/juridiction-senegal-rag/docker-repo/backend:latest
```

### Frontend (Firebase)
```bash
npm run build
firebase deploy --only hosting
```

---

## 📊 MONITORING & LOGS

### Cloud Run Logs
```bash
# Logs en temps réel
gcloud run logs read yoonassist-backend --limit 50 --follow

# Via console web
# https://console.cloud.google.com/run/detail/us-central1/yoonassist-backend/logs
```

### Firebase Logs
```bash
# Via Firebase Console
# https://console.firebase.google.com/project/juridiction-senegal-rag/hosting/usage
```

### Voir les metrics
```bash
# Cloud Run metrics
gcloud run metrics list

# Billing
# https://console.cloud.google.com/billing
```

---

## 💰 COÛTS RÉELS

### Estimation mensuelle
```
Cloud Run (2M requêtes):
  - 2 millions requêtes @ $0.40/M = $0.80
  - 1GB RAM × 1000 secondes @ $0.00001/GB-sec ≈ $0.01
  Total Cloud Run: ~$1/mois (généralement < 2M req)

Firebase Hosting:
  - 1GB stockage = Gratuit
  - 1GB transfert = Gratuit (à moins de 10GB/mois)
  Total Firebase: $0 (gratuit)

Supabase Database:
  - $25/mois (déjà payé)

TOTAL: ~$26/mois
```

---

## 🔧 FICHIERS CRÉÉS

### cloudbuild.yaml (déploiement automatique)
```yaml
version: '1'
steps:
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - build
      - -t
      - us-central1-docker.pkg.dev/$PROJECT_ID/docker-repo/backend:$SHORT_SHA
      - .

  # Push vers Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - push
      - us-central1-docker.pkg.dev/$PROJECT_ID/docker-repo/backend:$SHORT_SHA

  # Deploy sur Cloud Run
  - name: 'gcr.io/cloud-builders/run'
    args:
      - deploy
      - yoonassist-backend
      - --image=us-central1-docker.pkg.dev/$PROJECT_ID/docker-repo/backend:$SHORT_SHA
      - --region=us-central1
      - --platform=managed

images:
  - us-central1-docker.pkg.dev/$PROJECT_ID/docker-repo/backend:$SHORT_SHA
```

---

## ✅ CHECKLIST FINAL

- [ ] Créer projet Google Cloud
- [ ] Installer gcloud CLI
- [ ] Activer les APIs
- [ ] Build et push Docker image
- [ ] Déployer sur Cloud Run
- [ ] Initialiser Firebase Hosting
- [ ] Build Next.js app
- [ ] Déployer sur Firebase
- [ ] Tester les URLs
- [ ] Vérifier CORS
- [ ] Configurer domaine personnalisé (optionnel)

---

## 🎉 Résumé

| Aspect | Détail |
|--------|--------|
| **Frontend** | Firebase Hosting (gratuit) |
| **Backend** | Cloud Run ($0.40/mois) |
| **Database** | Supabase ($25/mois) |
| **Domaine** | .web.app (gratuit) ou custom |
| **Auto-scaling** | ✅ Inclus |
| **Logs** | ✅ Temps réel |
| **HTTPS** | ✅ Automatique |
| **CDN** | ✅ Global |
| **Uptime** | ✅ 99.95% |

---

## 📚 Ressources Utiles

- [Google Cloud Console](https://console.cloud.google.com)
- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Firebase Free Tier](https://firebase.google.com/pricing)
