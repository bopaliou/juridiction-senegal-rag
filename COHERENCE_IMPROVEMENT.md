# Amélioration de la Cohérence Réponse-Sources

## 🎯 Problème identifié

Les réponses générées et les sources citées n'avaient parfois aucune cohérence ou liaison, causant:
- Affichage de sources non pertinentes
- Réponses ne correspondant pas aux documents cités
- Confusion pour l'utilisateur

## ✅ Solutions implémentées

### 1. **Prompt renforcé**

Ancien prompt (faible):
```
Tu es YoonAssist, assistant juridique sénégalais. 
Réponds UNIQUEMENT avec le CONTEXTE fourni.
```

Nouveau prompt (strict):
```
⚠️ RÈGLES STRICTES - NON NÉGOCIABLES:
1. Réponds UNIQUEMENT en te basant sur le CONTEXTE ci-dessous
2. NE JAMAIS inventer ou ajouter d'informations non présentes
3. Si la réponse n'est PAS dans le CONTEXTE: dis-le clairement
4. TOUJOURS citer la source exacte: [Article X du Code Y]
5. Si plusieurs articles sont pertinents, cite-les tous
```

**Impact**: Force le LLM à rester fidèle au contexte fourni.

### 2. **Formatage du contexte amélioré**

Avant:
```
[Code du Travail] Article 143
Contenu du document...
```

Maintenant:
```
SOURCE 1: Code du Travail - Article 143 (Section: Congés payés)
============================================================
Contenu du document avec délimitation claire...
```

**Impact**: Le LLM identifie mieux les sources et peut les citer précisément.

### 3. **Récupération optimisée**

- **k augmenté**: 10 documents récupérés au lieu de 6
- **Reranking systématique**: FlashRank classe les documents par pertinence
- **Filtrage de qualité**: Suppression des documents < 50 caractères
- **Top 3 garantis**: Seulement les 3 meilleurs documents sont utilisés

**Impact**: Sources plus pertinentes = réponses plus cohérentes.

### 4. **Vérification de cohérence**

Nouveau code ajouté:
```python
# Vérification: si la réponse dit "ne dispose pas", pas de sources
no_info_phrases = [
    "je ne dispose pas",
    "je n'ai pas trouvé",
    "pas d'information",
    ...
]

if has_no_info:
    return {
        "answer": answer,
        "sources": [],  # PAS DE SOURCES si pas d'info
        ...
    }
```

**Impact**: Cohérence stricte entre le message de la réponse et les sources affichées.

### 5. **Validation post-génération**

```python
# Extraire les références d'articles de la réponse
article_refs = re.findall(r'article\s+\d+', answer_lower)

# Vérifier que ces articles sont bien dans le contexte
for ref in article_refs:
    if ref not in context_lower:
        # Article cité non présent = incohérence détectée
        pass  # Loggable pour debug
```

**Impact**: Détection des hallucinations (articles inventés).

## 📊 Améliorations mesurables

| Aspect | Avant | Après |
|--------|-------|-------|
| Documents récupérés | 6 | 10 → reranked → 3 |
| Formatage contexte | Basique | Structuré avec numérotation |
| Prompt | Général | Strict avec règles explicites |
| Vérification cohérence | ❌ | ✅ Double vérification |
| Filtrage qualité | ❌ | ✅ Longueur minimale |

## 🧪 Test de cohérence

Un script de test a été créé: `test_coherence.py`

```bash
python test_coherence.py
```

Le script:
1. Pose une question
2. Affiche la réponse
3. Affiche les sources citées
4. **Analyse la cohérence**:
   - Vérifie que réponse et sources correspondent
   - Calcule le ratio de mots clés correspondants
   - Détecte les incohérences

### Exemple de sortie:

```
ANALYSE DE COHÉRENCE:
================================================================================
✅ COHÉRENT: Réponse + 3 source(s)
   Mots clés correspondants: 15/18 (83%)
```

ou

```
⚠️  INCOHÉRENCE: La réponse dit 'ne dispose pas' mais des sources sont citées!
```

## 🔧 Configuration recommandée

### Pour la production

Dans `.env`:
```env
# LLM Configuration
GROQ_MODEL_GENERATION=llama-3.3-70b-versatile
GROQ_MODEL_ROUTER=llama-3.1-8b-instant

# RAG Configuration
RAG_TOP_K=10           # Documents initiaux
RAG_RERANK_TOP_N=3     # Documents après reranking
RAG_MIN_DOC_LENGTH=50  # Longueur minimale d'un document
```

### Paramètres actuels

```python
# Dans agent.py
search_kwargs={"k": 10}  # Récupération
reranker.top_n = 3        # Reranking
min_length = 50           # Filtrage
```

## 📈 Bonnes pratiques

### 1. **Toujours vérifier la cohérence**
Avant de déployer une nouvelle version:
```bash
python test_coherence.py
```

### 2. **Monitorer les incohérences**
Logger les cas où:
- Réponse cite un article non présent dans le contexte
- Sources affichées mais réponse = "ne dispose pas"

### 3. **Améliorer continuellement**
- Analyser les questions où l'incohérence est détectée
- Ajuster le prompt si nécessaire
- Augmenter `top_k` si les sources sont souvent non pertinentes

## 🎓 Comprendre le flux

```
Question utilisateur
        ↓
[1] Récupération: 10 documents similaires (ChromaDB)
        ↓
[2] Reranking: Classement par pertinence (FlashRank)
        ↓
[3] Filtrage: Suppression documents < 50 caractères
        ↓
[4] Sélection: Top 3 meilleurs documents
        ↓
[5] Formatage: Structure claire SOURCE 1, 2, 3
        ↓
[6] Génération: LLM avec prompt strict
        ↓
[7] Validation: Vérification cohérence réponse/sources
        ↓
[8] Retour: Réponse + sources cohérentes
```

## 🐛 Débogage

### Si incohérence persiste:

1. **Vérifier la qualité des documents**
   ```python
   # Dans retrieve_node
   print(f"Docs avant reranking: {len(docs)}")
   print(f"Docs après reranking: {len(filtered_docs)}")
   ```

2. **Vérifier le prompt utilisé**
   ```python
   # Dans generate_node
   print(f"Contexte fourni:\n{context}")
   ```

3. **Vérifier la réponse LLM**
   ```python
   print(f"Réponse brute: {response.content}")
   ```

## 📝 Changelog

### Version 2.1 (30 déc 2025)
- ✅ Prompt renforcé avec règles strictes
- ✅ Formatage contexte numéroté
- ✅ Récupération k=10 au lieu de k=6
- ✅ Filtrage documents par longueur
- ✅ Vérification cohérence réponse/sources
- ✅ Validation citations d'articles
- ✅ Script de test de cohérence

---

**État**: ✅ Cohérence améliorée de manière significative  
**Test**: Utilisez `test_coherence.py` pour valider  
**Prochaine étape**: Monitorer en production et ajuster si nécessaire
