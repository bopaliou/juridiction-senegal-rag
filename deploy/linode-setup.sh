#!/bin/bash

# ===========================================
# Script d'installation YoonAssist AI sur Linode
# Ubuntu 22.04 LTS - Nanode 1GB
# ===========================================

set -e

echo "=========================================="
echo "   Installation YoonAssist AI sur Linode"
echo "=========================================="

# Variables
APP_USER="yoonassist"
APP_DIR="/opt/yoonassist"
REPO_URL="https://github.com/bopaliou/juridiction-senegal-rag.git"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ===========================================
# 1. Mise à jour du système
# ===========================================
log_info "Mise à jour du système..."
sudo apt update && sudo apt upgrade -y

# ===========================================
# 2. Installation des dépendances
# ===========================================
log_info "Installation des dépendances système..."

# Python 3.11
sudo apt install -y software-properties-common
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3.11-dev

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Nginx et autres outils
sudo apt install -y nginx git curl wget ufw

# ===========================================
# 3. Configuration du pare-feu
# ===========================================
log_info "Configuration du pare-feu..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# ===========================================
# 4. Création de l'utilisateur applicatif
# ===========================================
log_info "Création de l'utilisateur $APP_USER..."
if ! id "$APP_USER" &>/dev/null; then
    sudo useradd -m -s /bin/bash $APP_USER
fi

# ===========================================
# 5. Clonage du repository
# ===========================================
log_info "Clonage du repository..."
sudo mkdir -p $APP_DIR
sudo chown $APP_USER:$APP_USER $APP_DIR

sudo -u $APP_USER git clone $REPO_URL $APP_DIR || {
    log_warn "Repository déjà existant, mise à jour..."
    cd $APP_DIR && sudo -u $APP_USER git pull
}

# ===========================================
# 6. Configuration du Backend
# ===========================================
log_info "Configuration du Backend Python..."

cd $APP_DIR

# Créer l'environnement virtuel
sudo -u $APP_USER python3.11 -m venv venv

# Installer les dépendances
sudo -u $APP_USER $APP_DIR/venv/bin/pip install --upgrade pip
sudo -u $APP_USER $APP_DIR/venv/bin/pip install -r requirements.txt

# Créer le fichier .env si inexistant
if [ ! -f "$APP_DIR/.env" ]; then
    log_warn "Fichier .env non trouvé. Veuillez le créer avec votre GROQ_API_KEY"
    echo "# Configuration YoonAssist AI" | sudo -u $APP_USER tee $APP_DIR/.env
    echo "GROQ_API_KEY=votre_cle_api_groq" | sudo -u $APP_USER tee -a $APP_DIR/.env
    echo "ALLOWED_ORIGINS=http://localhost:3000,http://$(curl -s ifconfig.me)" | sudo -u $APP_USER tee -a $APP_DIR/.env
    echo "ENABLE_RERANKER=false" | sudo -u $APP_USER tee -a $APP_DIR/.env
fi

# ===========================================
# 7. Configuration du Frontend
# ===========================================
log_info "Configuration du Frontend Next.js..."

cd $APP_DIR/legal-rag-frontend

# Installer les dépendances npm
sudo -u $APP_USER npm install

# Créer le fichier .env.local
SERVER_IP=$(curl -s ifconfig.me)
echo "NEXT_PUBLIC_API_URL=http://$SERVER_IP:8000" | sudo -u $APP_USER tee .env.local

# Build du frontend
sudo -u $APP_USER npm run build

# ===========================================
# 8. Installation des services systemd
# ===========================================
log_info "Installation des services systemd..."

# Backend service
sudo cp $APP_DIR/deploy/yoonassist-backend.service /etc/systemd/system/
sudo cp $APP_DIR/deploy/yoonassist-frontend.service /etc/systemd/system/

# Recharger systemd
sudo systemctl daemon-reload

# Activer les services
sudo systemctl enable yoonassist-backend
sudo systemctl enable yoonassist-frontend

# ===========================================
# 9. Configuration Nginx
# ===========================================
log_info "Configuration de Nginx..."

sudo cp $APP_DIR/deploy/nginx-yoonassist.conf /etc/nginx/sites-available/yoonassist
sudo ln -sf /etc/nginx/sites-available/yoonassist /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test de la configuration Nginx
sudo nginx -t

# Redémarrer Nginx
sudo systemctl restart nginx

# ===========================================
# 10. Lancement de l'ingestion (première fois)
# ===========================================
log_info "Vérification de la base de données..."

if [ ! -d "$APP_DIR/data/chroma_db" ] || [ -z "$(ls -A $APP_DIR/data/chroma_db 2>/dev/null)" ]; then
    log_info "Lancement de l'ingestion des documents..."
    cd $APP_DIR
    sudo -u $APP_USER $APP_DIR/venv/bin/python src/ingestion.py
else
    log_info "Base de données Chroma déjà existante."
fi

# ===========================================
# 11. Démarrage des services
# ===========================================
log_info "Démarrage des services..."

sudo systemctl start yoonassist-backend
sleep 5
sudo systemctl start yoonassist-frontend

# ===========================================
# 12. Vérification finale
# ===========================================
log_info "Vérification des services..."

echo ""
echo "=========================================="
echo "   Installation terminée !"
echo "=========================================="
echo ""
echo "Services status:"
sudo systemctl status yoonassist-backend --no-pager -l | head -5
echo ""
sudo systemctl status yoonassist-frontend --no-pager -l | head -5
echo ""
echo "=========================================="
echo "   Accès à l'application"
echo "=========================================="
echo ""
echo "URL: http://$SERVER_IP"
echo ""
echo "N'oubliez pas de configurer votre GROQ_API_KEY dans $APP_DIR/.env"
echo ""
echo "Commandes utiles:"
echo "  - Logs backend:  sudo journalctl -u yoonassist-backend -f"
echo "  - Logs frontend: sudo journalctl -u yoonassist-frontend -f"
echo "  - Restart:       sudo systemctl restart yoonassist-backend yoonassist-frontend"
echo ""

