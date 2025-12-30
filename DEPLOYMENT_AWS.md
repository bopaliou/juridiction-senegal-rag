# 🚀 Déploiement sur AWS - Guide Complet

Comparez les options et choisissez celle qui vous convient!

---

## 📊 COMPARAISON DES OPTIONS AWS

| Option | RAM | CPU | Coût | Gratuit | Complexité | Setup |
|--------|-----|-----|------|---------|-----------|-------|
| **Elastic Beanstalk** | 1GB | 1 | $10-20/mois | 1 an free tier | Faible | 10 min |
| **AppRunner** | 1GB | 1 | $7/mois | 750h/mois | Très faible | 5 min |
| **EC2 t2.micro** | 1GB | 1 | Gratuit | 1 an ✅ | Moyenne | 15 min |
| **ECS Fargate** | 1GB+ | 0.5-4 | $15+/mois | - | Moyenne-Haute | 20 min |
| **Amplify (Frontend)** | S.O. | S.O. | Gratuit | ✅ | Très faible | 3 min |

---

## 🎯 TOP 3 RECOMMANDATIONS

### 1️⃣ **AWS Amplify (Frontend) + AppRunner (Backend)** ⭐⭐⭐ RECOMMANDÉ

**Meilleur ratio Simplicité ↔ Coût ↔ Performance**

**Avantages:**
- ✅ Frontend: **GRATUIT** sur Amplify
- ✅ Backend: $7/mois AppRunner (750h/mois gratuit pendant 1 an!)
- ✅ Git-connected: git push = auto deploy
- ✅ SSL/HTTPS automatique
- ✅ Scalable automatiquement
- ✅ **Total: $0-7/mois**

**Architecture:**
```
Frontend (AWS Amplify)
├── URL: https://yoonassist.amplifyapp.com
├── Déploiement: git push → auto build Next.js
└── Gratuit

Backend (AWS AppRunner)
├── URL: https://yoonassist-api-xxx.us-east-1.apprunner.amazonaws.com
├── Déploiement: Docker image → auto scaling
└── $7/mois (~750h gratuits/mois)
```

**Setup: 10 min total**

---

### 2️⃣ **Elastic Beanstalk (Backend + Frontend ensemble)** ⭐⭐

**Meilleur pour Free Tier complet**

**Avantages:**
- ✅ Free Tier: 1 an gratuit (t2.micro)
- ✅ Gère l'infra automatiquement
- ✅ Git-connected
- ✅ Backend + Frontend sur une seule instance
- ✅ Scalable
- ✅ **Total: $0 pendant 1 an**

**Inconvénient:**
- ⚠️ Après 1 an: ~$15-20/mois

**Setup: 10 min**

---

### 3️⃣ **EC2 t2.micro (Contrôle total)** ⭐

**Meilleur pour apprenants/développeurs**

**Avantages:**
- ✅ Free Tier: 1 an gratuit
- ✅ Contrôle total de l'infra
- ✅ Linux/Ubuntu directement
- ✅ SSH access complet
- ✅ **Total: $0 pendant 1 an**

**Inconvénient:**
- ⚠️ À gérer manuellement (nginx, PM2, etc.)
- ⚠️ Après 1 an: ~$10/mois

**Setup: 20 min (plus complex)**

---

## ✨ CHOIX FINAL: AWS Amplify + AppRunner

### Pourquoi c'est parfait:
1. ✅ **Frontend GRATUIT** sur Amplify
2. ✅ **Backend $7/mois** (750h/mois = presque gratuit la 1ère année)
3. ✅ **Zéro ops** = configuration minimale
4. ✅ **Git-connected** = git push = deploy automatique
5. ✅ **Scalable** = géré automatiquement
6. ✅ **Sécurisé** = HTTPS automatique

### Total: **$7/mois après 1 an** (gratuit la 1ère année)

---

## 🚀 GUIDE RAPIDE: Amplify + AppRunner

### PHASE 1: Frontend sur AWS Amplify (3 min)

1. Aller à: https://console.aws.amazon.com/amplify
2. Cliquer: **"Create app"** → **"Host web app"**
3. Choisir: **GitHub**
4. Sélectionner: `juridiction-senegal-rag` repo
5. Configurer build:
   ```
   Root directory: legal-rag-frontend
   Build command: npm install && npm run build
   Output directory: .next
   ```
6. Ajouter variables d'env:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://uaordlnuhjowjtdiknfh.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx
   NEXT_PUBLIC_API_URL=https://yoonassist-api-xxx.us-east-1.apprunner.amazonaws.com
   NODE_ENV=production
   ```
7. Cliquer: **"Deploy"** → Attendez ~5 min

**Résultat:** `https://main.yoonassist.amplifyapp.com` ✅

---

### PHASE 2: Backend sur AWS AppRunner (5 min)

#### 2.1 Créer repository ECR (Docker)
```bash
# 1. Aller à: https://console.aws.amazon.com/ecr
# 2. Cliquer: "Create repository"
# 3. Repository name: juridiction-senegal-rag-backend
# 4. Cliquer: "Create"

# 5. Cliquer: "Push commands" et suivre:
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin [account-id].dkr.ecr.us-east-1.amazonaws.com

docker build -t juridiction-senegal-rag-backend .

docker tag juridiction-senegal-rag-backend:latest [account-id].dkr.ecr.us-east-1.amazonaws.com/juridiction-senegal-rag-backend:latest

docker push [account-id].dkr.ecr.us-east-1.amazonaws.com/juridiction-senegal-rag-backend:latest
```

#### 2.2 Déployer sur AppRunner
```
1. Aller à: https://console.aws.amazon.com/apprunner
2. Cliquer: "Create service"
3. Source: "Container registry"
4. Repository URI: [image ECR]
5. Port: 8000
6. Cliquer: "Create & Deploy"
7. Attendre ~3 min...
```

**Résultat:** `https://yoonassist-api-xxx.us-east-1.apprunner.amazonaws.com` ✅

---

#### 2.3 Configurer variables d'env dans AppRunner
```
GROQ_API_KEY=xxxx
SUPABASE_URL=https://uaordlnuhjowjtdiknfh.supabase.co
SUPABASE_ANON_KEY=xxxx
SUPABASE_SERVICE_ROLE_KEY=xxxx
ALLOWED_ORIGINS=https://main.yoonassist.amplifyapp.com
```

---

### PHASE 3: Mettre à jour Frontend avec URL Backend
```
1. Amplify Dashboard
2. App settings → Environment variables
3. Modifier: NEXT_PUBLIC_API_URL = https://yoonassist-api-xxx.us-east-1.apprunner.amazonaws.com
4. Redéployer: "Redeploy this version"
```

---

## 💰 COÛTS

### 1ère année:
```
Frontend (Amplify): $0 (gratuit)
Backend (AppRunner): $0 (750h/mois = presque gratuit)
Total: $0-10
```

### Après 1 an:
```
Frontend (Amplify): $0 (gratuit indefinitely)
Backend (AppRunner): $7/mois (~750h usage)
Total: $7/mois
```

---

## 🔧 Fichiers à Créer

### 1. Dockerfile (déjà créé)
✅ Utilisez le [Dockerfile](Dockerfile) déjà dans votre repo

### 2. .dockerignore
```
.git
.gitignore
.env
.env.local
__pycache__
*.pyc
.pytest_cache
node_modules
.next
.nuxt
dist
build
```

### 3. aws.json (AppRunner config)
```json
{
  "version": 1.0,
  "runtime": "PYTHON_3_11",
  "build": {
    "commands": {
      "build": [
        "pip install --no-cache-dir -r requirements.txt"
      ]
    }
  },
  "run": {
    "command": ["uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8000"],
    "network": {
      "port": 8000
    },
    "env": {}
  }
}
```

---

## 📋 CHECKLIST DÉPLOIEMENT

- [ ] Créer compte AWS (https://aws.amazon.com/free)
- [ ] Configurer AWS CLI sur votre machine
- [ ] Créer repository ECR
- [ ] Build et push Docker image vers ECR
- [ ] Créer AppRunner service
- [ ] Configurer variables d'env AppRunner
- [ ] Connecter Amplify à votre GitHub repo
- [ ] Configurer variables d'env Amplify
- [ ] Tester frontend
- [ ] Tester backend
- [ ] Vérifier CORS

---

## 🐛 Troubleshooting

### AppRunner: "Service failed to deploy"
**Solution:**
1. Vérifier les logs: AppRunner → Logs
2. Vérifier Dockerfile est correct
3. Vérifier variables d'env sont configurées
4. Redéployer

### Amplify: "Build failed"
**Solution:**
1. Vérifier logs: Amplify → App → Deployments → Logs
2. Chercher l'erreur (souvent: node_modules ou build)
3. Corriger dans `package.json`
4. Git push → auto redeploy

### CORS error
**Solution:**
Vérifier dans AppRunner variables d'env:
```
ALLOWED_ORIGINS=https://main.yoonassist.amplifyapp.com
```

---

## ✅ Après le Déploiement

### Tester backend
```bash
curl https://yoonassist-api-xxx.us-east-1.apprunner.amazonaws.com/health
```

### Tester frontend
```
Ouvrir: https://main.yoonassist.amplifyapp.com
```

### Configurer domaine personnalisé (optionnel)
```
Amplify: App settings → Domain management → Ajouter domaine
```

---

## 📚 Ressources AWS

- [AWS Amplify Docs](https://docs.amplify.aws/)
- [AWS AppRunner Docs](https://docs.aws.amazon.com/apprunner/)
- [AWS Free Tier](https://aws.amazon.com/free/)
- [AWS Console](https://console.aws.amazon.com/)
