-- Schéma de base de données pour le système de crédits YoonAssist AI
-- Compatible avec Supabase (PostgreSQL)

-- Table des utilisateurs avec crédits
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'premium_plus', 'pro')),
    credits INTEGER NOT NULL DEFAULT 30 CHECK (credits >= 0),
    monthly_quota INTEGER NOT NULL DEFAULT 30 CHECK (monthly_quota >= 0),
    reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_topup_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des logs d'utilisation
CREATE TABLE usage_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
CREATE TABLE credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- positif pour ajout, négatif pour débit
    reason VARCHAR(255) NOT NULL,
    pack_type VARCHAR(20) CHECK (pack_type IN ('pack_small', 'pack_medium', 'pack_large')),
    payment_id VARCHAR(255), -- référence de paiement externe
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des limites anti-abus (cache des requêtes récentes)
CREATE TABLE abuse_limits (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_type VARCHAR(20) NOT NULL DEFAULT 'hour' CHECK (window_type IN ('hour', 'day')),
    UNIQUE(user_id, window_start, window_type)
);

-- Index pour les performances
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_timestamp ON usage_logs(timestamp);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_timestamp ON credit_transactions(timestamp);
CREATE INDEX idx_abuse_limits_user_window ON abuse_limits(user_id, window_start, window_type);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
        reset_date = CURRENT_DATE + INTERVAL '1 month'
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
$$ LANGUAGE plpgsql;

-- Job automatique pour reset mensuel (à exécuter quotidiennement)
-- Peut être configuré dans pg_cron ou un scheduler externe
