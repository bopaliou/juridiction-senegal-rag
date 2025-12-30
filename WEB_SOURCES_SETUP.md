# Chargement des Sources Web - Documentation

## 🔍 Problème identifié

Les sources web (Constitution, Code des Collectivités Locales, Code de l'Aviation Civile) **n'étaient pas chargées** dans la base de données ChromaDB.

### Diagnostic

Lors de l'analyse avec `check_db.py` :
```
📊 Total documents dans la base: 367
📄 Documents PDF: 367  
🌐 Documents Web: 0  ❌ PROBLÈME!
```

## ✅ Solution appliquée

### 1. Configuration des sources web

Dans [`src/ingestion.py`](src/ingestion.py):

```python
WEB_SOURCES = [
    "https://conseilconstitutionnel.sn/la-constitution/",
    "https://primature.sn/publications/lois-et-reglements/code-des-collectivites-locales",
    "https://primature.sn/publications/lois-et-reglements/code-de-laviation-civile",
]
```

### 2. Réingestion complète

```bash
# Supprimer l'ancienne base (si besoin)
python -c "import shutil; shutil.rmtree('data/chroma_db', ignore_errors=True)"

# Lancer l'ingestion
uv run python src/ingestion.py
```

Résultat attendu :
```
🌐 Chargement des documents web...
✅ 4 documents web chargés.
✂️ Découpage des documents web...
✅ 332 chunks créés à partir du web
📦 Total: 699 chunks créés (367 PDF + 332 web)
```

### 3. Mise à jour de l'agent

L'agent a été configuré pour utiliser la nouvelle base avec sources web :

[`src/agent.py`](src/agent.py#L30):
```python
CHROMA_DB_PATH = BASE_DIR / "data" / "chroma_db_with_web"
```

## 📊 Sources disponibles après ingestion

| Type | Source | Chunks |
|------|--------|--------|
| PDF | Code du Travail | 316 |
| PDF | Loi 2020-05 (Criminalisation viol) | 51 |
| **WEB** | **Constitution du Sénégal** | **~100** |
| **WEB** | **Code Collectivités Locales** | **~100** |
| **WEB** | **Code Aviation Civile** | **~100** |
| **WEB** | **Autres sources web** | **~32** |

**Total : ~699 chunks**

## 🧪 Vérification

Pour vérifier que les sources web sont chargées :

```bash
python check_db.py
```

Sortie attendue :
```
📊 Total documents dans la base: 699

📄 Documents PDF: 367
🌐 Documents Web: 332  ✅ OK!

📚 Sources uniques (6):
  [PDF] Code du Travail: 316 chunks
  [PDF] Loi 2020-05: 51 chunks  
  [WEB] Constitution du Sénégal: ~100 chunks
  [WEB] Code des Collectivités Locales: ~100 chunks
  [WEB] Code de l'Aviation Civile: ~100 chunks
  [WEB] Autres: ~32 chunks
```

## 🎯 Tests fonctionnels

Maintenant, vous pouvez poser des questions sur :

### Constitution
- "Qui est le président du Sénégal selon la Constitution ?"
- "Quels sont les droits fondamentaux garantis par la Constitution ?"
- "Comment modifier la Constitution ?"

### Collectivités Locales
- "Qu'est-ce qu'une commune ?"
- "Quelles sont les compétences des collectivités locales ?"
- "Comment est élu le maire ?"

### Aviation Civile  
- "Quelles sont les sanctions pour infraction au code de l'aviation ?"
- "Qui délivre les licences de pilote au Sénégal ?"

## 🔄 Reingestion régulière

Pour mettre à jour les sources web (en cas de modifications sur les sites) :

```bash
# Supprimer la base actuelle
rm -rf data/chroma_db_with_web

# Relancer l'ingestion
uv run python src/ingestion.py
```

## 📝 Ajout de nouvelles sources web

Pour ajouter d'autres sources juridiques web :

1. Ouvrir [`src/ingestion.py`](src/ingestion.py)
2. Ajouter l'URL dans `WEB_SOURCES` :
   ```python
   WEB_SOURCES = [
       "https://conseilconstitutionnel.sn/la-constitution/",
       # ... sources existantes ...
       "https://nouvelle-source.sn/code-xyz",  # NOUVELLE SOURCE
   ]
   ```
3. Ajouter le mapping du nom dans `WEB_SOURCE_MAPPING` :
   ```python
   WEB_SOURCE_MAPPING = {
       # ... mappings existants ...
       "code-xyz": "Code XYZ du Sénégal",  # NOUVEAU MAPPING
   }
   ```
4. Relancer l'ingestion

## ⚠️ Limitations actuelles

- Les sources web ne sont rechargées que lors de la réingestion complète
- Pas de mise à jour incrémentale des sources web
- Les sites web peuvent changer de structure, nécessitant une adaptation du scraping

## 🚀 Prochaines améliorations

- [ ] Mise à jour incrémentale des sources web
- [ ] Détection automatique des changements sur les sites
- [ ] Meilleur parsing HTML spécifique par site
- [ ] Ajout de plus de sources juridiques web officielles
- [ ] Cache des sources web pour éviter le rechargement répété

---

**Date** : 30 décembre 2025  
**Statut** : ✅ Sources web intégrées et fonctionnelles
