# Déploiement YoonAssist AI sur Linode

Guide complet pour déployer YoonAssist AI sur une VM Linode.

## Prérequis

- Compte Linode avec crédits (100$ offerts pour les nouveaux comptes)
- Clé API GROQ valide
- Repository GitHub accessible

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Linode Nanode 1GB                 │
│                   (~5$/mois)                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│   ┌─────────────┐    ┌─────────────────────────┐   │
│   │   Nginx     │    │    Backend FastAPI      │   │
│   │   (port 80) │───▶│    (port 8000)          │   │
│   │             │    │    - Uvicorn            │   │
│   │             │    │    - ChromaDB           │   │
│   │             │    │    - HuggingFace        │   │
│   │             │    └─────────────────────────┘   │
│   │             │                                   │
│   │             │    ┌─────────────────────────┐   │
│   │             │───▶│    Frontend Next.js     │   │
│   │             │    │    (port 3000)          │   │
│   └─────────────┘    └─────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Étape 1 : Créer la VM Linode

1. Connectez-vous à [Linode Cloud Manager](https://cloud.linode.com/)
2. Cliquez sur **Create Linode**
3. Configurez :
   - **Image** : Ubuntu 22.04 LTS
   - **Region** : Choisissez la plus proche (ex: Frankfurt, EU)
   - **Plan** : Shared CPU → Nanode 1GB (~5$/mois)
   - **Label** : `yoonassist-prod`
   - **Root Password** : Mot de passe fort
   - **SSH Keys** : Ajoutez votre clé SSH publique (recommandé)
4. Cliquez sur **Create Linode**
5. Notez l'**adresse IP publique**

## Étape 2 : Connexion SSH

```bash
ssh root@<VOTRE_IP_LINODE>
```

## Étape 3 : Déploiement automatique

```bash
# Cloner le repository
git clone https://github.com/bopaliou/juridiction-senegal-rag.git
cd juridiction-senegal-rag

# Rendre le script exécutable
chmod +x deploy/linode-setup.sh

# Lancer l'installation
sudo ./deploy/linode-setup.sh
```

## Étape 4 : Configuration

### Configurer la clé API GROQ

```bash
sudo nano /opt/yoonassist/.env
```

Modifiez la ligne :
```
GROQ_API_KEY=votre_vraie_cle_api_groq
```

### Redémarrer les services

```bash
sudo systemctl restart yoonassist-backend yoonassist-frontend
```

## Étape 5 : Vérification

Ouvrez votre navigateur et accédez à :
```
http://<VOTRE_IP_LINODE>
```

## Commandes utiles

### Gérer les services

```bash
# Status des services
sudo systemctl status yoonassist-backend
sudo systemctl status yoonassist-frontend

# Redémarrer
sudo systemctl restart yoonassist-backend
sudo systemctl restart yoonassist-frontend

# Arrêter
sudo systemctl stop yoonassist-backend yoonassist-frontend

# Démarrer
sudo systemctl start yoonassist-backend yoonassist-frontend
```

### Consulter les logs

```bash
# Logs backend en temps réel
sudo journalctl -u yoonassist-backend -f

# Logs frontend en temps réel
sudo journalctl -u yoonassist-frontend -f

# Logs Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Mise à jour de l'application

```bash
cd /opt/yoonassist
sudo -u yoonassist git pull

# Backend
sudo -u yoonassist /opt/yoonassist/venv/bin/pip install -r requirements.txt

# Frontend
cd legal-rag-frontend
sudo -u yoonassist npm install
sudo -u yoonassist npm run build

# Redémarrer
sudo systemctl restart yoonassist-backend yoonassist-frontend
```

### Relancer l'ingestion

```bash
cd /opt/yoonassist
sudo -u yoonassist /opt/yoonassist/venv/bin/python src/ingestion.py
sudo systemctl restart yoonassist-backend
```

## Configuration SSL (optionnel)

Pour ajouter HTTPS avec un nom de domaine :

1. Pointez votre domaine vers l'IP Linode (DNS A record)
2. Installez Certbot :

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

3. Le certificat sera renouvelé automatiquement.

## Ressources

- **RAM utilisée** : ~700-800 MB
- **Stockage** : ~2-3 GB (avec ChromaDB)
- **Coût** : ~5$/mois (Nanode 1GB)
- **Avec 100$ de crédits** : ~20 mois gratuits

## Dépannage

### Le backend ne démarre pas

```bash
# Vérifier les logs
sudo journalctl -u yoonassist-backend -n 50

# Vérifier le fichier .env
cat /opt/yoonassist/.env

# Tester manuellement
cd /opt/yoonassist
sudo -u yoonassist /opt/yoonassist/venv/bin/uvicorn src.server:app --host 127.0.0.1 --port 8000
```

### Erreur de mémoire

Si vous avez des erreurs "Out of Memory", vérifiez que le reranker est désactivé :

```bash
# Dans /opt/yoonassist/.env
ENABLE_RERANKER=false
```

### Nginx erreur 502

```bash
# Vérifier que les services tournent
sudo systemctl status yoonassist-backend
sudo systemctl status yoonassist-frontend

# Vérifier les ports
sudo netstat -tlnp | grep -E '8000|3000'
```

