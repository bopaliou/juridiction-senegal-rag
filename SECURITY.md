# 🔒 Sécurité et Optimisations

Ce document décrit les mesures de sécurité et optimisations implémentées dans le projet.

## 🛡️ Sécurité Backend

### Validation et Sanitization
- **Validation stricte des inputs** : Utilisation de Pydantic avec `SecureQueryRequest` pour valider toutes les requêtes
- **Sanitization XSS** : Nettoyage de tous les inputs utilisateur pour prévenir les attaques XSS
- **Limites de longueur** : 
  - Questions : max 5000 caractères
  - Thread ID : max 100 caractères
  - Réponses : max 50000 caractères

### Rate Limiting
- **100 requêtes/minute** par adresse IP
- Nettoyage automatique des anciennes entrées toutes les 5 minutes
- Réponse HTTP 429 avec en-tête `Retry-After` en cas de dépassement

### En-têtes de Sécurité HTTP
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`
- `Content-Security-Policy` configuré
- `Referrer-Policy: strict-origin-when-cross-origin`

### CORS Sécurisé
- Origines autorisées configurées via variable d'environnement
- Méthodes HTTP limitées : GET, POST, OPTIONS uniquement
- En-têtes autorisés limités : Content-Type, Authorization
- Cache des prérequêtes CORS : 1 heure

### Timeout et Gestion d'Erreurs
- **Timeout des requêtes** : 120 secondes (configurable)
- Gestion d'erreur robuste sans exposition de détails sensibles
- Logging sécurisé (pas de données sensibles dans les logs)

### Protection des Secrets
- Variables d'environnement pour les clés API
- Validation de la présence de `GROQ_API_KEY` au démarrage
- Pas de secrets hardcodés dans le code

## 🔒 Sécurité Frontend

### Sanitization XSS
- Fonction `sanitizeText()` pour échapper le HTML
- Validation des questions avant envoi
- Détection de patterns dangereux (script tags, javascript:, etc.)

### Validation des Inputs
- Validation côté client avant l'envoi
- Limites de longueur respectées
- Validation du format du thread_id

### Gestion d'Erreurs
- Messages d'erreur clairs sans exposition de détails techniques
- Gestion spécifique des erreurs 429 (rate limit), 504 (timeout)
- Fallback gracieux en cas d'erreur réseau

### Protection localStorage
- Vérification `typeof window !== 'undefined'` pour éviter les erreurs SSR
- Validation des données avant stockage
- Limite de 50 conversations maximum

## ⚡ Optimisations Performance

### Backend

#### Lazy Loading
- **Embeddings** : Chargement à la demande uniquement
- **Base de données Chroma** : Initialisation différée
- **Retriever** : Création uniquement quand nécessaire
- **BGE Reranker** : Chargement lazy avec gestion d'erreur gracieuse

#### Compression
- **GZIP** activé pour les réponses > 1KB
- Réduction de la bande passante

#### Optimisations DB
- Normalisation des embeddings activée
- Limite de 5 documents par recherche
- Reranking avec top_n=3

#### Timeout et Async
- Requêtes async avec timeout configurable
- Utilisation de `asyncio.to_thread` pour les opérations bloquantes

### Frontend

#### Memoization React
- `useCallback` pour `handleSubmit` et `handleSuggestionClick`
- `useMemo` pour les calculs coûteux
- Réduction des re-renders inutiles

#### Debouncing
- Timeout des requêtes API (120 secondes)
- AbortController pour annuler les requêtes en cours

#### Optimisations de Code
- Client API centralisé (`lib/api.ts`)
- Gestion d'erreur centralisée
- Validation réutilisable

## 📊 Monitoring et Logging

### Logging Sécurisé
- Logs des requêtes sans données sensibles
- Temps de traitement dans l'en-tête `X-Process-Time`
- Format de log standardisé : `[YYYY-MM-DD HH:MM:SS] METHOD PATH - STATUS - TIME`

### Health Check
- Endpoint `/health` pour vérifier l'état de l'API
- Pas de rate limiting sur les endpoints de santé

## 🔧 Configuration

### Variables d'Environnement Backend
```env
GROQ_API_KEY=votre_cle_api
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
REQUEST_TIMEOUT=120
```

### Variables d'Environnement Frontend
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_TIMEOUT=120000
```

## 🚨 Bonnes Pratiques

1. **Ne jamais exposer les secrets** dans le code ou les logs
2. **Toujours valider et sanitizer** les inputs utilisateur
3. **Utiliser HTTPS** en production
4. **Mettre à jour régulièrement** les dépendances
5. **Monitorer les logs** pour détecter les anomalies
6. **Tester les limites** de rate limiting et timeout
7. **Documenter les changements** de sécurité

## 📝 Notes

- Le rate limiting est en mémoire (non persistant entre redémarrages)
- Pour la production, considérer l'utilisation d'un rate limiter distribué (Redis)
- Les timeouts peuvent être ajustés selon les besoins
- La compression GZIP est automatique pour les réponses > 1KB

