-- Migration complète du système de crédits YoonAssist AI
-- À exécuter dans le SQL Editor de Supabase
-- https://supabase.com/dashboard/project/[PROJECT_ID]/sql

-- =====================================================
-- SYSTÈME DE CRÉDITS YOONASSIST AI - MIGRATION
-- =====================================================

-- Vérifier si les tables existent déjà et les supprimer si nécessaire
DROP TABLE IF EXISTS abuse_limits CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS usage_logs CASCADE;

-- Note: La table users devrait déjà exister via Supabase Auth
-- Nous allons juste ajouter les colonnes nécessaires

-- =====================================================
-- 1. AJOUT DES COLONNES À LA TABLE USERS EXISTANTE
-- =====================================================

-- Vérifier si les colonnes existent déjà
DO $$
BEGIN
    -- Ajouter la colonne plan si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'plan') THEN
        ALTER TABLE users ADD COLUMN plan VARCHAR(20) NOT NULL DEFAULT 'free'
            CHECK (plan IN ('free', 'premium', 'premium_plus', 'pro'));
    END IF;

    -- Ajouter la colonne credits si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'credits') THEN
        ALTER TABLE users ADD COLUMN credits INTEGER NOT NULL DEFAULT 30
            CHECK (credits >= 0);
    END IF;

    -- Ajouter la colonne monthly_quota si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'monthly_quota') THEN
        ALTER TABLE users ADD COLUMN monthly_quota INTEGER NOT NULL DEFAULT 30
            CHECK (monthly_quota >= 0);
    END IF;

    -- Ajouter la colonne reset_date si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'reset_date') THEN
        ALTER TABLE users ADD COLUMN reset_date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;

    -- Ajouter la colonne last_topup_at si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'last_topup_at') THEN
        ALTER TABLE users ADD COLUMN last_topup_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Ajouter la colonne updated_at si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'updated_at') THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- =====================================================
-- 2. CRÉATION DES NOUVELLES TABLES
-- =====================================================

-- Table des logs d'utilisation
CREATE TABLE IF NOT EXISTS usage_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tokens_in INTEGER NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
    tokens_out INTEGER NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
    total_tokens INTEGER NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
    credits_spent INTEGER NOT NULL DEFAULT 0 CHECK (credits_spent >= 0),
    request_type VARCHAR(50) NOT NULL,
    client_ip INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des transactions de crédits
CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- positif pour ajout, négatif pour débit
    reason VARCHAR(255) NOT NULL,
    pack_type VARCHAR(20) CHECK (pack_type IN ('pack_small', 'pack_medium', 'pack_large')),
    payment_id VARCHAR(255), -- référence de paiement externe
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des limites anti-abus (cache des requêtes récentes)
CREATE TABLE IF NOT EXISTS abuse_limits (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_type VARCHAR(20) NOT NULL DEFAULT 'hour' CHECK (window_type IN ('hour', 'day')),
    UNIQUE(user_id, window_start, window_type)
);

-- =====================================================
-- 3. INDEX POUR LES PERFORMANCES
-- =====================================================

-- Index sur usage_logs
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON usage_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_logs_request_type ON usage_logs(request_type);

-- Index sur credit_transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_timestamp ON credit_transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_pack_type ON credit_transactions(pack_type);

-- Index sur abuse_limits
CREATE INDEX IF NOT EXISTS idx_abuse_limits_user_window ON abuse_limits(user_id, window_start, window_type);

-- =====================================================
-- 4. FONCTIONS UTILITAIRES
-- =====================================================

-- Fonction pour reset mensuel des crédits
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void AS $$
DECLARE
    plan_credits RECORD;
BEGIN
    -- Reset pour chaque plan
    UPDATE users
    SET credits = CASE
            WHEN plan = 'free' THEN 30
            WHEN plan = 'premium' THEN 500
            WHEN plan = 'premium_plus' THEN 1500
            WHEN plan = 'pro' THEN 10000
            ELSE credits
        END,
        monthly_quota = CASE
            WHEN plan = 'free' THEN 30
            WHEN plan = 'premium' THEN 500
            WHEN plan = 'premium_plus' THEN 1500
            WHEN plan = 'pro' THEN 10000
            ELSE monthly_quota
        END,
        reset_date = CURRENT_DATE + INTERVAL '1 month',
        updated_at = NOW()
    WHERE reset_date <= CURRENT_DATE;

    -- Log des resets
    INSERT INTO credit_transactions (user_id, amount, reason)
    SELECT id, CASE
            WHEN plan = 'free' THEN 30
            WHEN plan = 'premium' THEN 500
            WHEN plan = 'premium_plus' THEN 1500
            WHEN plan = 'pro' THEN 10000
            ELSE 0
        END, 'monthly_reset'
    FROM users
    WHERE reset_date <= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour updated_at sur la table users
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. POLITIQUES RLS (Row Level Security)
-- =====================================================

-- Activer RLS sur les nouvelles tables
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_limits ENABLE ROW LEVEL SECURITY;

-- Politiques pour usage_logs (utilisateur voit seulement ses logs)
CREATE POLICY "Users can view their own usage logs" ON usage_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage logs" ON usage_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Politiques pour credit_transactions (utilisateur voit seulement ses transactions)
CREATE POLICY "Users can view their own credit transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credit transactions" ON credit_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Politiques pour abuse_limits (privé système)
CREATE POLICY "Users can view their own abuse limits" ON abuse_limits
    FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- 6. DONNÉES DE TEST (OPTIONNEL)
-- =====================================================

-- Insérer quelques données de test si la table est vide
-- Décommentez ces lignes pour ajouter des données de test

/*
-- Utilisateur de test (remplacez l'UUID par un vrai utilisateur)
INSERT INTO users (id, email, plan, credits, monthly_quota)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'test@yoonassist.ai', 'premium', 500, 500)
ON CONFLICT (id) DO NOTHING;

-- Quelques transactions de test
INSERT INTO credit_transactions (user_id, amount, reason, pack_type)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 500, 'initial_setup', 'pack_medium'),
    ('550e8400-e29b-41d4-a716-446655440000', -3, 'llm_procedure', NULL)
ON CONFLICT DO NOTHING;
*/

-- =====================================================
-- 7. VÉRIFICATIONS FINALES
-- =====================================================

-- Vérifier que toutes les tables ont été créées
DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    -- Vérifier users
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'credits')
    INTO table_exists;

    IF NOT table_exists THEN
        RAISE EXCEPTION 'Migration échouée: colonne credits manquante dans users';
    END IF;

    -- Vérifier usage_logs
    SELECT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_name = 'usage_logs')
    INTO table_exists;

    IF NOT table_exists THEN
        RAISE EXCEPTION 'Migration échouée: table usage_logs manquante';
    END IF;

    -- Vérifier credit_transactions
    SELECT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_name = 'credit_transactions')
    INTO table_exists;

    IF NOT table_exists THEN
        RAISE EXCEPTION 'Migration échouée: table credit_transactions manquante';
    END IF;

    RAISE NOTICE 'Migration du système de crédits terminée avec succès !';
END $$;

-- =====================================================
-- MIGRATION TERMINÉE
-- =====================================================

-- Instructions pour la suite :
-- 1. Vérifiez que toutes les tables ont été créées dans le Table Editor
-- 2. Testez les politiques RLS avec un utilisateur authentifié
-- 3. Configurez un cron job pour reset_monthly_credits() (une fois par mois)
-- 4. Mettez à jour vos variables d'environnement avec la DATABASE_URL
