# Alternatives Gratuites et Open Source à Render

## 🎯 Solutions Recommandées pour YoonAssist AI

### 1. **CapRover** ⭐ (Recommandé - Open Source)
- **Type**: Auto-hébergé, Open Source
- **Gratuit**: Oui (sur votre propre serveur)
- **Avantages**:
  - ✅ 100% open source
  - ✅ Interface web conviviale
  - ✅ Support Docker natif
  - ✅ Gestion de domaines et SSL automatique
  - ✅ Support des bases de données (PostgreSQL, MongoDB, etc.)
  - ✅ Pas de limite de mémoire (dépend de votre serveur)
- **Inconvénients**:
  - ⚠️ Nécessite un serveur VPS (gratuit avec Oracle Cloud Free Tier, AWS Free Tier, etc.)
  - ⚠️ Configuration initiale requise
- **Installation**: `docker run -p 80:80 -p 443:443 -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock -v /captain:/captain caprover/caprover`
- **Site**: https://caprover.com/
- **GitHub**: https://github.com/caprover/caprover

### 2. **Dokku** (Open Source)
- **Type**: Auto-hébergé, Open Source
- **Gratuit**: Oui (sur votre propre serveur)
- **Avantages**:
  - ✅ 100% open source
  - ✅ Interface CLI similaire à Heroku
  - ✅ Support Git push to deploy
  - ✅ Plugins pour bases de données
- **Inconvénients**:
  - ⚠️ Interface en ligne de commande uniquement
  - ⚠️ Nécessite un serveur VPS
- **Site**: https://dokku.com/
- **GitHub**: https://github.com/dokku/dokku

### 3. **Fly.io** (Gratuit, pas open source)
- **Type**: Cloud Platform
- **Gratuit**: Oui (plan gratuit généreux)
- **Avantages**:
  - ✅ 3 VMs gratuites (256MB RAM chacune)
  - ✅ Déploiement global (edge computing)
  - ✅ Support Docker natif
  - ✅ Base de données PostgreSQL gratuite (3GB)
  - ✅ Pas de limite de mémoire stricte (mais 256MB par VM)
- **Inconvénients**:
  - ⚠️ Pas open source
  - ⚠️ Limite de 256MB par VM (peut nécessiter plusieurs VMs)
- **Site**: https://fly.io/
- **Documentation**: https://fly.io/docs/

### 4. **Railway** (Gratuit, pas open source)
- **Type**: Cloud Platform
- **Gratuit**: Oui (plan gratuit avec crédits)
- **Avantages**:
  - ✅ $5 de crédits gratuits par mois
  - ✅ Déploiement automatique depuis GitHub
  - ✅ Support PostgreSQL gratuit
  - ✅ Interface moderne et intuitive
- **Inconvénients**:
  - ⚠️ Pas open source
  - ⚠️ Limite de crédits (peut nécessiter un upgrade)
- **Site**: https://railway.app/

### 5. **Vercel** (Gratuit pour Frontend)
- **Type**: Cloud Platform
- **Gratuit**: Oui (pour frontend Next.js)
- **Avantages**:
  - ✅ Optimisé pour Next.js
  - ✅ Déploiement automatique
  - ✅ CDN global
  - ✅ SSL automatique
- **Inconvénients**:
  - ⚠️ Pas open source
  - ⚠️ Limité au frontend (backend nécessite un autre service)
- **Site**: https://vercel.com/

## 🏆 Recommandation pour YoonAssist AI

### Option 1: CapRover sur VPS Gratuit (Meilleure pour Open Source)
**Architecture**:
- **Frontend**: Next.js sur CapRover
- **Backend**: FastAPI sur CapRover
- **Base de données**: Chroma DB (fichiers locaux) ou PostgreSQL sur CapRover

**VPS Gratuits disponibles**:
1. **Oracle Cloud Free Tier**: 2 VMs (1GB RAM chacune) - Permanent
2. **AWS Free Tier**: 1 VM (1GB RAM) - 12 mois
3. **Google Cloud Free Tier**: $300 crédits - 90 jours
4. **Azure Free Tier**: $200 crédits - 30 jours

**Avantages**:
- ✅ 100% gratuit et open source
- ✅ Pas de limite de mémoire (dépend du VPS)
- ✅ Contrôle total
- ✅ Pas de restrictions de déploiement

### Option 2: Fly.io (Meilleure pour Simplicité)
**Architecture**:
- **Frontend**: Next.js sur Fly.io
- **Backend**: FastAPI sur Fly.io (peut nécessiter 2-3 VMs pour la mémoire)
- **Base de données**: Chroma DB (fichiers locaux) ou PostgreSQL Fly.io

**Avantages**:
- ✅ Déploiement simple
- ✅ Pas de gestion de serveur
- ✅ Plan gratuit généreux

## 📋 Guide de Migration vers CapRover

### Prérequis
1. Serveur VPS (Oracle Cloud Free Tier recommandé)
2. Docker installé
3. Domaine (optionnel, peut utiliser IP publique)

### Étapes de Migration

1. **Installer CapRover sur le VPS**:
```bash
docker run -p 80:80 -p 443:443 -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /captain:/captain \
  caprover/caprover
```

2. **Configurer CapRover**:
   - Accéder à `http://votre-ip:3000`
   - Créer un mot de passe admin
   - Configurer le domaine (optionnel)

3. **Déployer le Backend**:
   - Créer une nouvelle app "yoonassist-backend"
   - Connecter le dépôt GitHub
   - Configurer les variables d'environnement
   - Définir le port: `8000`

4. **Déployer le Frontend**:
   - Créer une nouvelle app "yoonassist-frontend"
   - Connecter le dépôt GitHub
   - Configurer `NEXT_PUBLIC_API_URL` avec l'URL du backend

## 📋 Guide de Migration vers Fly.io

### Étapes de Migration

1. **Installer Fly CLI**:
```bash
curl -L https://fly.io/install.sh | sh
```

2. **Créer un compte Fly.io**:
```bash
fly auth signup
```

3. **Déployer le Backend**:
```bash
cd /path/to/project
fly launch --name yoonassist-backend
# Configurer fly.toml avec:
# - Port 8000
# - Memory: 512MB (ou plus si nécessaire)
# - Variables d'environnement
```

4. **Déployer le Frontend**:
```bash
cd legal-rag-frontend
fly launch --name yoonassist-frontend
# Configurer fly.toml avec:
# - Port 3000
# - Build command: npm install && npm run build
# - Start command: npm start
```

## 🔄 Comparaison Rapide

| Plateforme | Open Source | Gratuit | Limite RAM | Difficulté |
|------------|-------------|---------|------------|------------|
| **CapRover** | ✅ Oui | ✅ Oui | Dépend du VPS | Moyenne |
| **Dokku** | ✅ Oui | ✅ Oui | Dépend du VPS | Moyenne |
| **Fly.io** | ❌ Non | ✅ Oui | 256MB/VM | Facile |
| **Railway** | ❌ Non | ✅ Oui | Variable | Facile |
| **Vercel** | ❌ Non | ✅ Oui | Variable | Très Facile |

## 💡 Recommandation Finale

Pour **YoonAssist AI**, je recommande **CapRover** sur **Oracle Cloud Free Tier** car:
1. ✅ 100% gratuit et open source
2. ✅ 2 VMs avec 1GB RAM chacune (suffisant pour le projet)
3. ✅ Pas de limite de mémoire stricte
4. ✅ Contrôle total sur l'infrastructure
5. ✅ Interface web conviviale

**Alternative rapide**: **Fly.io** si vous préférez ne pas gérer de serveur.

