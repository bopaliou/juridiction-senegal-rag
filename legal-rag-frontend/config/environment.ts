// Configuration d'environnement pour YoonAssist AI
// Ce fichier centralise la gestion des environnements (local/production)

export const getEnvironmentConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = process.env.VERCEL === '1';
  const isLinode = process.env.LINODE_ENV === '1' || process.env.NEXT_PUBLIC_SITE_URL?.includes('172.233.114.185');

  return {
    isProduction,
    isVercel,
    isLinode,
    environment: isProduction ? 'production' : 'development',

    // URLs
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',

    // Supabase
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,

    // Configuration spécifique par environnement
    corsOrigins: isProduction
      ? ['https://yoonassist.ai', 'http://172.233.114.185']
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],

    // Logging
    enableDetailedLogs: !isProduction,

    // Cache
    cacheTimeout: isProduction ? 3600000 : 300000, // 1h en prod, 5min en dev
  };
};

// Validation des variables d'environnement critiques
export const validateEnvironment = () => {
  const config = getEnvironmentConfig();
  const errors: string[] = [];

  if (!config.supabaseUrl) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is required');
  }

  if (!config.supabaseAnonKey) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  return config;
};
