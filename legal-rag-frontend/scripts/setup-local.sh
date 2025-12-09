#!/bin/bash

# Script de configuration pour l'environnement local
# Usage: ./scripts/setup-local.sh

set -e

echo "🚀 Configuration de l'environnement local YoonAssist AI"

# Vérifier si .env.local existe
if [ ! -f ".env.local" ]; then
    echo "📝 Création du fichier .env.local depuis env.example"
    cp env.example .env.local
    echo "⚠️  IMPORTANT: Modifiez .env.local avec vos vraies clés Supabase!"
    echo "   - NEXT_PUBLIC_SUPABASE_URL"
    echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
else
    echo "✅ .env.local existe déjà"
fi

# Installer les dépendances
echo "📦 Installation des dépendances..."
npm install

# Vérifier la configuration
echo "🔍 Vérification de la configuration..."
if ! grep -q "NEXT_PUBLIC_SUPABASE_URL=https://" .env.local; then
    echo "❌ NEXT_PUBLIC_SUPABASE_URL n'est pas configuré dans .env.local"
    exit 1
fi

if ! grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY=ey" .env.local; then
    echo "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY n'est pas configuré dans .env.local"
    exit 1
fi

echo "✅ Configuration terminée!"
echo ""
echo "🎯 Pour démarrer en local:"
echo "   npm run dev"
echo ""
echo "📱 Application accessible sur: http://localhost:3000"
