# Déploiement des corrections sur Linode

## 🔧 Commandes à exécuter sur Linode

### 1. Mettre à jour le code backend

```bash
# Se connecter en SSH à Linode
ssh root@172.233.114.185

# Aller dans le répertoire du projet
cd /opt/yoonassist

# Récupérer les dernières modifications
sudo -u yoonassist git pull origin main

# Vérifier que les changements sont bien là
sudo -u yoonassist git log --oneline -5
```

### 2. Redémarrer le service backend

```bash
# Redémarrer le service backend
sudo systemctl restart yoonassist-backend

# Vérifier le statut
sudo systemctl status yoonassist-backend

# Voir les logs en temps réel
sudo journalctl -u yoonassist-backend -f
```

### 3. Vérifier que le backend fonctionne

```bash
# Tester l'endpoint de santé
curl http://127.0.0.1:8000/health

# Vérifier les logs pour voir si les documents sont bien récupérés
sudo journalctl -u yoonassist-backend -n 50
```

## 📊 Vérification des logs

Après avoir posé une question, vous devriez voir dans les logs :

```
📊 Récupérés: X documents
📊 Après reranking: X documents retenus (top rerankés)
📚 Utilisation de X documents pour générer la réponse
```

## 🔍 Si le problème persiste

### Vérifier que ChromaDB est bien chargé

```bash
# Vérifier que le répertoire existe
ls -la /opt/yoonassist/data/chroma_db

# Vérifier qu'il contient des fichiers
ls -la /opt/yoonassist/data/chroma_db/*

# Vérifier la taille de la base
du -sh /opt/yoonassist/data/chroma_db
```

### Vérifier les permissions

```bash
# Vérifier les permissions du répertoire
ls -la /opt/yoonassist/data/

# Si nécessaire, corriger les permissions
sudo chown -R yoonassist:yoonassist /opt/yoonassist/data/
```

### Vérifier les variables d'environnement

```bash
# Vérifier que GROQ_API_KEY est définie
sudo -u yoonassist cat /opt/yoonassist/.env | grep GROQ_API_KEY

# Vérifier les autres variables
sudo -u yoonassist cat /opt/yoonassist/.env
```

## 🚀 Commandes complètes (copier-coller)

```bash
cd /opt/yoonassist
sudo -u yoonassist git pull origin main
sudo systemctl restart yoonassist-backend
sudo systemctl status yoonassist-backend
```

## 📝 Notes

- Les changements corrigent le problème de filtrage des documents
- Le backend récupère maintenant 10 documents au lieu de 6
- Les documents rerankés sont utilisés directement (pas de filtrage par score)
- Les logs sont améliorés pour le debugging

