#!/bin/bash

# Script de déploiement pour Linode
# Usage: ./scripts/setup-production.sh

set -e

echo "🚀 Configuration de l'environnement de production YoonAssist AI"

# Créer .env.local pour la production si nécessaire
if [ ! -f ".env.local" ]; then
    echo "📝 Création du fichier .env.local pour la production"
    cat > .env.local << EOF
# Configuration Supabase
NEXT_PUBLIC_SUPABASE_URL=https://uaordlnuhjowjtdiknfh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhb3JkbG51aGpvd2p0ZGlrbmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTgxMzMsImV4cCI6MjA4MDQzNDEzM30.fpkI3SBYkrzeEFRDfPWiEx3DNf9kkPjs0THHHR4iu94

# URLs de production
NEXT_PUBLIC_SITE_URL=http://172.233.114.185
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
EOF
    echo "✅ .env.local créé avec la configuration de production"
else
    echo "✅ .env.local existe déjà - vérification de la configuration production..."

    # Vérifier et corriger les URLs si nécessaire
    if ! grep -q "NEXT_PUBLIC_SITE_URL=http://172.233.114.185" .env.local; then
        sed -i 's|NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=http://172.233.114.185|' .env.local
        echo "✅ URL du site corrigée pour la production"
    fi

    if ! grep -q "NEXT_PUBLIC_API_URL=http://127.0.0.1:8000" .env.local; then
        sed -i 's|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://127.0.0.1:8000|' .env.local
        echo "✅ URL de l'API corrigée pour la production"
    fi
fi

# Installer les dépendances
echo "📦 Installation des dépendances..."
npm ci --only=production

# Build de l'application
echo "🔨 Build de l'application..."
npm run build

echo "✅ Configuration de production terminée!"
echo ""
echo "🎯 L'application est prête pour le déploiement"
echo "   Utilisez le service systemd pour démarrer:"
echo "   sudo systemctl restart yoonassist-frontend"
