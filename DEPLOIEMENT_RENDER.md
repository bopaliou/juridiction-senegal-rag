# 🚀 Guide de Déploiement sur Render

Ce guide vous accompagne étape par étape pour déployer YoonAssist (backend + frontend) sur Render.

---

## 📋 Prérequis

### 1. Compte Render
- Créez un compte gratuit sur [render.com](https://render.com)
- Connectez votre compte GitHub

### 2. Repository GitHub
- Votre projet doit être sur GitHub
- Assurez-vous que tous les fichiers sont commités (sauf .env)

### 3. Clés API
- ✅ **GROQ_API_KEY** - Votre clé Groq (déjà dans .env)
- ✅ **SUPABASE_URL** - URL Supabase (déjà dans .env)
- ✅ **SUPABASE_ANON_KEY** - Clé publique Supabase
- ✅ **SUPABASE_SERVICE_ROLE_KEY** - Clé service Supabase

---

## 🎯 ÉTAPE 1 : Préparer les fichiers

### 1.1 Vérifier les fichiers nécessaires

Assurez-vous que ces fichiers existent :

```
juridiction-senegal-rag/
├── render.yaml              ✅ (créé automatiquement)
├── requirements.txt         ✅ (déjà existant)
├── src/
│   ├── server.py           ✅
│   └── agent.py            ✅
└── legal-rag-frontend/
    ├── package.json        ✅
    └── next.config.ts      ✅
```

### 1.2 Créer fichier .gitignore (si pas déjà fait)

```bash
# Ajouter ces lignes dans .gitignore
.env
.env.local
.env.production
__pycache__/
*.pyc
.venv/
node_modules/
.next/
data/chroma_db/
```

### 1.3 Pousser sur GitHub

```bash
# Dans votre terminal PowerShell
git add .
git commit -m "Préparation déploiement Render"
git push origin main
```

---

## 🚀 ÉTAPE 2 : Déployer sur Render

### 2.1 Créer un nouveau Blueprint

1. **Connectez-vous à [Render Dashboard](https://dashboard.render.com)**

2. **Cliquez sur "New +" → "Blueprint"**

3. **Sélectionnez votre repository GitHub**
   - Cherchez : `juridiction-senegal-rag`
   - Cliquez "Connect"

4. **Render détectera automatiquement `render.yaml`**
   - Il affichera 2 services :
     - ✅ yoonassist-backend (Python)
     - ✅ yoonassist-frontend (Node.js)

### 2.2 Configurer les variables d'environnement

Avant de cliquer "Apply", configurez les variables :

#### Pour le BACKEND (yoonassist-backend)

Cliquez sur le service backend, puis ajoutez :

| Nom de variable | Valeur | Source |
|----------------|--------|---------|
| `GROQ_API_KEY` | `gsk_5kwvm...` | Copier depuis votre .env |
| `SUPABASE_URL` | `https://uaordlnu...` | Copier depuis votre .env |
| `SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Copier depuis votre .env |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Copier depuis votre .env |

⚠️ **IMPORTANT**: Ne copiez pas les guillemets, juste la valeur!

#### Pour le FRONTEND (yoonassist-frontend)

| Nom de variable | Valeur |
|----------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Même valeur que SUPABASE_URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Même valeur que SUPABASE_ANON_KEY |

**Note**: `NEXT_PUBLIC_API_URL` sera configuré automatiquement!

### 2.3 Lancer le déploiement

1. **Cliquez sur "Apply"** en bas de la page

2. **Render va déployer les 2 services** :
   - Backend : 5-10 minutes (téléchargement modèles ML)
   - Frontend : 3-5 minutes

3. **Suivez les logs en temps réel**

---

## 📊 ÉTAPE 3 : Vérifier le déploiement

### 3.1 Backend

1. **Attendez que le backend soit "Live" (vert)**

2. **Récupérez l'URL** :
   - Format : `https://yoonassist-backend.onrender.com`

3. **Testez l'API** :
   ```bash
   curl https://yoonassist-backend.onrender.com/health
   ```
   
   Réponse attendue :
   ```json
   {
     "status": "healthy",
     "service": "Agent Juridique Sénégalais RAG API"
   }
   ```

### 3.2 Frontend

1. **Attendez que le frontend soit "Live"**

2. **URL** : `https://yoonassist-frontend.onrender.com`

3. **Ouvrez dans votre navigateur**
   - La page d'accueil doit s'afficher
   - Les questions suggérées doivent apparaître

---

## ⚙️ ÉTAPE 4 : Configuration post-déploiement

### 4.1 Configurer CORS backend

Le fichier `render.yaml` configure déjà CORS pour accepter le frontend.

Vérifiez que `ALLOWED_ORIGINS` inclut bien :
- Votre URL frontend Render
- Votre URL Vercel (si vous l'utilisez aussi)

### 4.2 Uploader la base ChromaDB

**Option 1 : Via GitHub**
```bash
# Ajouter temporairement les données
git add data/chroma_db/
git commit -m "Add ChromaDB data"
git push
```

Puis dans Render, trigger un redeploy.

**Option 2 : Via Render Disk (Recommandé)**

1. Connectez-vous en SSH au serveur Render (plan payant requis)
2. Ou réingérez les documents directement en production

### 4.3 Tester une question

1. Allez sur votre frontend : `https://yoonassist-frontend.onrender.com`
2. Posez une question : "Combien de jours de congé ai-je droit ?"
3. Vérifiez que la réponse provient bien des documents

---

## 🐛 ÉTAPE 5 : Dépannage

### Problème : Backend ne démarre pas

**Vérifiez les logs** :
1. Dashboard Render → yoonassist-backend → Logs
2. Cherchez les erreurs

**Erreurs courantes** :

#### "ModuleNotFoundError"
```
Solution: Vérifiez requirements.txt
```

#### "GROQ_API_KEY not found"
```
Solution: Ajoutez la variable dans Render Dashboard
Environment → Add Environment Variable
```

#### "Database connection failed"
```
Solution: Configurez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
```

### Problème : Frontend ne se connecte pas au backend

**Vérifiez** :
1. `NEXT_PUBLIC_API_URL` est bien définie
2. CORS est configuré correctement
3. Backend est "Live"

**Test rapide** :
```bash
# Dans la console du navigateur
fetch('https://yoonassist-backend.onrender.com/health')
  .then(r => r.json())
  .then(console.log)
```

### Problème : "Service Unavailable" après 15 min

**C'est normal avec le plan gratuit!**

Render met en veille les services gratuits après 15 min d'inactivité.
- Premier accès : 30-60 secondes de démarrage
- Ensuite : rapide tant que utilisé

**Solution**: Passez au plan payant ($7/mois) pour éviter la mise en veille.

---

## 💰 Plans Render

### Plan FREE (Gratuit)
- ✅ 750 heures/mois
- ⚠️ Mise en veille après 15 min
- ⚠️ Démarrage lent au réveil
- ✅ Suffisant pour tests/démo

### Plan STARTER ($7/mois par service)
- ✅ Pas de mise en veille
- ✅ Réponse instantanée
- ✅ Plus de ressources
- ✅ Recommandé pour production

---

## 🎉 ÉTAPE 6 : C'est prêt !

Votre application est maintenant en ligne sur :

- 🔗 **Backend API** : `https://yoonassist-backend.onrender.com`
- 🌐 **Frontend Web** : `https://yoonassist-frontend.onrender.com`

### Prochaines étapes

1. ✅ Testez toutes les fonctionnalités
2. ✅ Partagez l'URL avec des utilisateurs test
3. ✅ Surveillez les logs pour les erreurs
4. ✅ Configurez un nom de domaine personnalisé (optionnel)

---

## 📚 Ressources utiles

- [Documentation Render](https://render.com/docs)
- [Render Status](https://status.render.com)
- [Support Render](https://render.com/support)

---

## 🆘 Besoin d'aide ?

Si vous rencontrez des problèmes :

1. Vérifiez les logs dans Render Dashboard
2. Consultez ce guide
3. Vérifiez les variables d'environnement
4. Testez localement d'abord avec les mêmes configs

---

**✨ Félicitations ! Votre application juridique IA est maintenant en ligne ! 🎊**
