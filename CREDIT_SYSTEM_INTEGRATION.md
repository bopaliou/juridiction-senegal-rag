# Système de Crédits YoonAssist AI - Guide d'intégration

## ✅ État actuel

Le système de crédits est maintenant **activé et fonctionnel en mode développement**.

## 🎯 Fonctionnalités intégrées

### Backend (FastAPI)

✅ **Routes API activées** (`/credits/*`)
- `GET /credits/balance` - Récupère le solde de crédits
- `POST /credits/estimate` - Estime le coût d'une requête
- `GET /credits/plans` - Liste des plans disponibles
- `GET /credits/topups` - Packs de recharge disponibles
- `POST /credits/topup` - Achat de pack (simulation)

✅ **Moteur de crédits** (`credit_engine.py`)
- Gestion des crédits utilisateur
- Estimation des coûts
- Vérification des limites anti-abus
- Mode développement sans base de données

✅ **Authentification** (`auth/dependencies.py`)
- Système d'authentification basique pour le développement
- Prêt pour intégration JWT Supabase en production

### Frontend (Next.js)

✅ **Client de crédits** (`lib/credits/client.ts`)
- Fonctions pour interroger l'API crédits
- Types TypeScript complets

✅ **Composants UI**
- `CreditGauge.tsx` - Affichage du solde
- `CreditCostBadge.tsx` - Badge de coût
- `LowBalancePopup.tsx` - Alerte solde bas

✅ **Hook React** (`useCredits.ts`)
- Gestion de l'état des crédits
- Rechargement automatique

## 🔧 Configuration actuelle

### Mode Développement (actuel)

Le système fonctionne **sans base de données** avec des données simulées :
- **Crédits par défaut** : 30 crédits
- **Plan** : Free
- **Quota mensuel** : 30 crédits
- **Authentification** : Utilisateur dev par défaut

### Configuration requise pour la production

Pour activer le système complet avec base de données, configurez ces variables dans `.env` :

```env
# Base de données Supabase
SUPABASE_DB_HOST=db.xxx.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=votre_mot_de_passe

# Authentification JWT
SUPABASE_JWT_SECRET=votre_secret_jwt
```

## 📊 Coûts par type de requête

| Type | Tokens estimés | Crédits |
|------|----------------|---------|
| Simple | 1500 | 1 |
| Procédure | 3000 | 3 |
| PDF | 7000 | 10 |

## 💰 Plans disponibles

| Plan | Crédits/mois | Prix (XOF) | Fonctionnalités |
|------|--------------|------------|-----------------|
| **Gratuit** | 30 | 0 | Questions basiques, Support communautaire |
| **Premium** | 500 | 2,000 | Questions illimitées, Procédures guidées |
| **Premium+** | 1,500 | 4,500 | Analyse PDF basique, Modèles juridiques |
| **Pro** | 10,000 | 15,000 | Analyse PDF avancée, IA spécialisée, API |

## 🔄 Packs de recharge

| Pack | Crédits | Prix (XOF) | Description |
|------|---------|------------|-------------|
| **Dépanne** | 100 | 500 | Question urgente |
| **Dossier** | 500 | 2,000 | Dossier complet |
| **Pro** | 1,500 | 5,000 | Volume élevé |

## 🛡️ Limites anti-abus

| Plan | Req/heure | Max tokens/req | PDF bloqué |
|------|-----------|----------------|------------|
| Free | 5 | 2,000 | ✅ |
| Premium | 50 | 5,000 | ❌ |
| Premium+ | 200 | 10,000 | ❌ |
| Pro | 1,000 | 50,000 | ❌ |

## 🚀 Test du système

### Tester l'endpoint de crédits

```bash
# Vérifier le solde
curl http://127.0.0.1:8000/credits/balance

# Estimer un coût
curl "http://127.0.0.1:8000/credits/estimate?request_type=simple" -X POST

# Liste des plans
curl http://127.0.0.1:8000/credits/plans

# Liste des packs
curl http://127.0.0.1:8000/credits/topups
```

### Utilisation dans le frontend

```typescript
import { getCreditBalance, estimateCost } from '@/lib/credits/client';

// Récupérer le solde
const balance = await getCreditBalance();
console.log(`Crédits: ${balance.credits}/${balance.monthlyQuota}`);

// Estimer le coût
const estimate = await estimateCost('simple');
console.log(`Coût estimé: ${estimate.estimatedCredits} crédits`);
```

## 📝 Intégration avec les requêtes

Pour déduire des crédits lors d'une requête utilisateur :

```python
from src.credits.credit_middleware import CreditMiddleware

# Dans votre endpoint
@app.post("/query")
async def query(
    request: QueryRequest,
    user: dict = Depends(get_current_user)
):
    # Vérifier si l'utilisateur peut exécuter
    can_execute, message = credit_engine.can_execute_request(
        user["id"], 
        "simple", 
        estimated_tokens=1500
    )
    
    if not can_execute:
        raise HTTPException(status_code=402, detail=message)
    
    # Exécuter la requête...
    response = await agent_query(request.question)
    
    # Déduire les crédits
    credit_engine.deduct_credits(
        user["id"],
        request_type="simple",
        tokens_used=response.total_tokens
    )
    
    return response
```

## 🔍 Logs et monitoring

Les logs indiquent l'état du système :

```
✅ Routes de crédits activées
⚠️ Mode développement sans DB: ...
INFO - Mode dev - retour de crédits simulés
```

## 📦 Structure des fichiers

```
src/
├── credits/
│   ├── credit_api.py         # Routes FastAPI
│   ├── credit_engine.py      # Logique métier
│   └── credit_middleware.py  # Middleware FastAPI
├── auth/
│   └── dependencies.py       # Authentification
├── models/
│   └── credit_models.py      # Modèles Pydantic
└── database/
    ├── models.py             # Modèles SQLAlchemy
    └── connection.py         # Connexion DB

legal-rag-frontend/
├── lib/
│   ├── credits/
│   │   └── client.ts         # Client API
│   └── hooks/
│       └── useCredits.ts     # Hook React
└── components/
    └── credits/
        ├── CreditGauge.tsx
        ├── CreditCostBadge.tsx
        └── LowBalancePopup.tsx
```

## 🎉 Prochaines étapes

1. **Base de données** : Configurer Supabase pour la production
2. **Authentification** : Implémenter la vérification JWT complète
3. **Paiement** : Intégrer un processeur de paiement (Wave, Orange Money, etc.)
4. **Monitoring** : Ajouter des logs et métriques de consommation
5. **UI** : Afficher les informations de crédits dans l'interface

---

**État** : ✅ Système fonctionnel en mode développement  
**Dernière mise à jour** : 30 décembre 2025
