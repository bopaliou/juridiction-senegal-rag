import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compression et optimisation
  compress: true,
  poweredByHeader: false, // Masquer le header X-Powered-By pour la sécurité
  
  // Configuration pour les images
  images: {
    unoptimized: true, // Désactiver l'optimisation pour éviter les problèmes avec les images statiques
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  // Headers de sécurité
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co http://localhost:8000 http://127.0.0.1:8000",
              "frame-ancestors 'self'",
            ].join('; ')
          },
        ],
      },
    ];
  },
  
  // Optimisation du bundle
  experimental: {
    optimizeCss: true,
  },
  
  // Note: swcMinify est activé par défaut dans Next.js 16+, pas besoin de le spécifier
  
  // Optimisation des exports
  output: 'standalone',
};

export default nextConfig;
