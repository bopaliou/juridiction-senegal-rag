import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Pour Render Static Site, on peut utiliser output: 'export'
  // Mais comme on utilise des API routes et du client-side, on utilisera un Web Service
  // output: 'export', // Décommenter si on veut un export statique
  
  // Configuration pour les images - désactiver l'optimisation pour les images statiques locales
  images: {
    unoptimized: true, // Désactiver l'optimisation pour éviter les problèmes avec les images statiques
  },
};

export default nextConfig;
