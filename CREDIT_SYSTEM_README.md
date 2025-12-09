# Système de Crédits YoonAssist AI

## Vue d'ensemble

Le système de crédits YoonAssist AI implémente une architecture complète de monétisation basée sur l'utilisation de tokens LLM. Il comprend la gestion des crédits, la facturation à l'usage, les limites anti-abus, et une interface utilisateur intuitive.

## Architecture

### Composants Principaux

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Backend   │    │   Base de       │
│   (React)       │◄──►│   (FastAPI)     │◄──►│   Données       │
│                 │    │                 │    │   (Supabase)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Middleware    │    │   Credit Engine │    │   LLM Gateway   │
│   Crédits       │    │                 │    │   (Groq)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Modèle Économique

### Plans d'Abonnement

| Plan | Crédits/Mois | Prix (XOF) | Fonctionnalités |
|------|-------------|------------|-----------------|
| Free | 30 | 0 | Questions basiques, support communautaire |
| Premium | 500 | 2000 | Questions illimitées, procédures guidées |
| Premium+ | 1500 | 4500 | Analyse PDF, modèles juridiques, support 24/7 |
| Pro | 10000 | 15000 | Analyse avancée, API dédiée, support dédié |

### Packs de Recharge

| Pack | Crédits | Prix (XOF) | Description |
|------|---------|------------|-------------|
| Dépanne | 100 | 500 | Question urgente |
| Dossier | 500 | 2000 | Dossier complet |
| Pro | 1500 | 5000 | Volume élevé |

### Coûts par Requête

| Type de Requête | Tokens Estimés | Crédits | Description |
|----------------|----------------|---------|-------------|
| Simple | 1500 | 1 | Question basique |
| Procédure | 3000 | 3 | Procédure guidée |
| PDF | 7000 | 10 | Analyse document |

## Formule de Calcul

```python
# Calcul des crédits dépensés
credits_spent = math.ceil(total_tokens / 1000)

# Exemples
# 500 tokens → 1 crédit
# 1500 tokens → 2 crédits
# 2500 tokens → 3 crédits
```

## Installation & Configuration

### 1. Configuration Base de Données

```sql
-- Exécuter le script schema.sql
\i src/database/schema.sql
```

### 2. Variables d'Environnement

```bash
# Backend (.env)
GROQ_API_KEY=votre_cle_groq
DATABASE_URL=votre_url_supabase
SECRET_KEY=votre_cle_secrete

# Frontend (.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Installation Dépendances

```bash
# Backend
pip install -r requirements.txt

# Frontend
npm install
```

## Utilisation

### API Endpoints

#### Récupération Solde
```http
GET /credits/balance
Authorization: Bearer <token>
```

**Réponse:**
```json
{
  "credits": 150,
  "plan": "premium",
  "monthly_quota": 500,
  "reset_date": "2025-01-01",
  "usage_percentage": 70.0
}
```

#### Estimation Coût
```http
POST /credits/estimate?request_type=simple&estimated_tokens=1000
Authorization: Bearer <token>
```

**Réponse:**
```json
{
  "estimated_tokens": 1000,
  "estimated_credits": 1,
  "can_execute": true,
  "current_balance": 150,
  "message": "OK - Coût estimé: 1 crédits"
}
```

#### Achat Pack Recharge
```http
POST /credits/topup
Authorization: Bearer <token>

{
  "pack_type": "pack_medium",
  "payment_method": "mobile_money"
}
```

**Réponse:**
```json
{
  "success": true,
  "pack_type": "pack_medium",
  "credits_added": 500,
  "new_balance": 650,
  "payment_id": "simulated_user_pack_medium",
  "amount_paid": 2000
}
```

#### Appel LLM avec Crédits
```http
POST /llm/execute
Authorization: Bearer <token>

{
  "question": "Quelle est la procédure de divorce au Sénégal?",
  "request_type": "procedure",
  "context": {}
}
```

**Réponse:**
```json
{
  "answer": "La procédure de divorce au Sénégal...",
  "credits_used": 3,
  "credits_remaining": 147,
  "usage": {
    "prompt_tokens": 250,
    "completion_tokens": 750,
    "total_tokens": 1000
  }
}
```

### Composants React

#### CreditGauge
```tsx
import { CreditGauge } from '@/components/credits/CreditGauge';

function Dashboard() {
  return (
    <CreditGauge
      credits={150}
      quota={500}
      plan="premium"
      resetDate="2025-01-01"
    />
  );
}
```

#### CreditCostBadge
```tsx
import { CreditCostBadge } from '@/components/credits/CreditCostBadge';

function QuestionForm() {
  return (
    <div>
      <CreditCostBadge cost={3} variant="warning" />
      <p>Cette question coûtera 3 crédits</p>
    </div>
  );
}
```

#### Hook useCredits
```tsx
import { useCredits } from '@/lib/hooks/useCredits';

function CreditDisplay() {
  const { balance, loading, error, isLowBalance, refreshBalance } = useCredits();

  if (loading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error}</div>;

  return (
    <div>
      <p>Crédits: {balance?.credits}</p>
      {isLowBalance && <p>Crédits faibles!</p>}
      <button onClick={refreshBalance}>Actualiser</button>
    </div>
  );
}
```

## Logique Anti-Abus

### Limites par Plan

| Plan | Requêtes/Heure | Blocage PDF | Tokens Max/Requête |
|------|----------------|-------------|-------------------|
| Free | 5 | ✅ | 2000 |
| Premium | 50 | ❌ | 5000 |
| Premium+ | 200 | ❌ | 10000 |
| Pro | 1000 | ❌ | 50000 |

### Vérifications Automatiques

1. **Limite horaire** : Compte des requêtes par fenêtre d'1 heure
2. **Blocage fonctionnalités** : PDF interdit pour plan Free
3. **Limite tokens** : Requêtes trop longues rejetées
4. **Fingerprinting** : IP et User-Agent tracés

## Logs et Monitoring

### Tables de Log

- **usage_logs** : Chaque appel LLM avec tokens et crédits
- **credit_transactions** : Tous les mouvements de crédits
- **abuse_limits** : Limites anti-abus par utilisateur

### Métriques Clés

```sql
-- Utilisation par jour
SELECT DATE(timestamp), SUM(credits_spent)
FROM usage_logs
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(timestamp);

-- Utilisateurs actifs
SELECT COUNT(DISTINCT user_id)
FROM usage_logs
WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days';
```

## Déploiement et Maintenance

### Reset Mensuel Automatique

```bash
# Script à exécuter le 1er de chaque mois
python -c "from src.credits.credit_engine import credit_engine; credit_engine.reset_monthly_credits()"
```

### Monitoring

```bash
# Vérifier l'utilisation
curl -H "Authorization: Bearer <admin_token>" http://localhost:8000/credits/admin/stats

# Alertes basses crédits
SELECT email, credits FROM users WHERE credits < monthly_quota * 0.1;
```

## Sécurité

### Protection contre la Fraude

1. **Validation stricte** : Tous les inputs validés
2. **Rate limiting** : Limites par IP et utilisateur
3. **Audit logging** : Toutes les transactions tracées
4. **Rollback automatique** : En cas d'erreur système

### Gestion des Erreurs

```python
try:
    # Débit crédits
    result = credit_engine.debit_credits(user_id, credits_needed, "llm_call")
    if not result.success:
        raise HTTPException(status_code=402, detail=result.message)

    # Appel LLM
    response = await groq_client.chat_completion(...)

    # Log usage
    credit_engine.log_usage(user_id, tokens_in, tokens_out, credits_spent)

except Exception as e:
    # Rollback si nécessaire
    logger.error(f"Erreur traitement crédits: {e}")
    raise HTTPException(status_code=500, detail="Erreur système")
```

## Tests et Validation

### Tests Unitaires

```bash
# Tests crédits
python -m pytest tests/test_credits.py -v

# Tests intégration
python -m pytest tests/test_llm_integration.py -v
```

### Tests de Charge

```bash
# Simulation utilisateurs multiples
locust -f tests/load_test.py --host=http://localhost:8000
```

## Support et Maintenance

### Commandes Utiles

```bash
# Vérifier solde utilisateur
curl -H "Authorization: Bearer <token>" http://localhost:8000/credits/balance

# Reset crédits manuellement
python -c "from src.credits import credit_engine; credit_engine.reset_monthly_credits()"

# Statistiques utilisation
curl -H "Authorization: Bearer <token>" http://localhost:8000/credits/usage/stats
```

### Alertes à Monitorer

- Utilisateurs avec crédits négatifs
- Taux d'erreur élevé sur les appels LLM
- Tentatives de contournement des limites
- Pics inhabituels d'utilisation

---

## Diagrammes de Flux

### Flux Normal d'Utilisation

```
Utilisateur → Question → Estimation → Vérification Crédits → OK
    ↓
Appel LLM → Calcul Tokens → Débit Crédits → Log Usage → Réponse
```

### Flux Crédits Insuffisants

```
Utilisateur → Question → Estimation → Crédits Insuffisants
    ↓
Popup "Recharge" → Sélection Pack → Paiement → Crédits Ajoutés
    ↓
Retry Question → OK
```

Ce système fournit une monétisation robuste, scalable et sécurisée pour YoonAssist AI.
